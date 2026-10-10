import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createProviderService } from "./adapters.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const matches = (value, digest) =>
  typeof value === "string" &&
  typeof digest === "string" &&
  digest.length === 64 &&
  timingSafeEqual(Buffer.from(hash(value)), Buffer.from(digest));
const bearer = (req) => {
  const value = req.get("authorization") || "";
  return value.startsWith("Bearer ") && value.length <= 4096
    ? value.slice(7)
    : "";
};
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const health = (v = "healthy") => {
  if (!["healthy", "degraded", "offline"].includes(v))
    throw invalid("Invalid worker health");
  return v;
};
function capabilities(value = {}) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !["providers", "models"].includes(k))
  )
    throw invalid("Invalid worker capabilities");
  const list = (items = [], max, provider = false) => {
    if (
      !Array.isArray(items) ||
      items.length > max ||
      items.some(
        (x) =>
          typeof x !== "string" ||
          !x.trim() ||
          x.length > 200 ||
          /[\x00-\x1f]/.test(x) ||
          (provider &&
            !["ollama", "openrouter", "openai-compatible"].includes(x)),
      )
    )
      throw invalid("Invalid worker capabilities");
    return [...new Set(items.map((x) => x.trim()))];
  };
  return {
    providers: list(value.providers, 3, true),
    models: list(value.models, 100),
  };
}

export function registerProviderRoutes(
  app,
  {
    store,
    providerFetch = fetch,
    ollamaFetch = providerFetch,
    env = process.env,
  } = {},
) {
  if (
    !store ||
    typeof store.get !== "function" ||
    typeof store.update !== "function"
  )
    throw new Error("providers require a store");
  const service = createProviderService({ providerFetch, ollamaFetch, env });
  const registrationHash = env.NEXUS_WORKER_REGISTRATION_SECRET
    ? hash(env.NEXUS_WORKER_REGISTRATION_SECRET)
    : null;
  const oneTimeHash = env.NEXUS_WORKER_ONE_TIME_SECRET
    ? hash(env.NEXUS_WORKER_ONE_TIME_SECRET)
    : null;
  const instanceId = randomBytes(16).toString("hex");
  const workers = () => store.get().providerWorkers || [];
  const publicWorker = (w) => {
    const connected =
      w.instanceId === instanceId &&
      Date.now() - Date.parse(w.lastSeenAt) < 90000 &&
      w.health !== "offline";
    return {
      id: w.id,
      name: w.name,
      capabilities: w.capabilities,
      health: w.health,
      registeredAt: w.registeredAt,
      lastSeenAt: w.lastSeenAt,
      connected,
      available: connected && w.health === "healthy",
      status: connected ? "connected" : "disconnected",
      schedulingSupported: false,
    };
  };
  const status = (items = workers()) => ({
    configured: Boolean(registrationHash || oneTimeHash),
    status: registrationHash || oneTimeHash ? "available" : "not_configured",
    workers: items.map(publicWorker),
    distributedScheduling: false,
    message:
      "Outbound registration and health reporting only; remote inference dispatch is not implemented",
  });
  const guard = (fn) => async (req, res) => {
    try {
      return await fn(req, res);
    } catch (error) {
      return res.status(error.status || 503).json({
        error: error.status
          ? error.message
          : "Worker registry operation failed",
      });
    }
  };

  app.get("/api/providers/catalog", async (_req, res) =>
    res.json(await service.catalog()),
  );
  app.get("/api/providers", async (_req, res) => {
    const catalog = await service.catalog();
    const providerStatus = service.status();
    res.json({
      providers: providerStatus.map((item) => ({
        id: item.id,
        provider: item.id,
        name: item.name,
        status: item.status,
      })),
      workers: workers()
        .map(publicWorker)
        .map((worker) => ({
          id: worker.id,
          name: worker.name,
          status: worker.status,
          models: worker.capabilities.models,
        })),
      models: catalog.providers.flatMap((provider) =>
        (provider.models || []).map((model) => ({
          ...model,
          provider: provider.id,
        })),
      ),
      defaultModel: env.NEXUS_DEFAULT_MODEL || "",
    });
  });
  app.get("/api/providers/status", (_req, res) =>
    res.json({ providers: service.status() }),
  );
  app.post("/api/providers/test", async (req, res) => {
    if (
      !req.body ||
      Object.keys(req.body).some((k) => !["providerId", "model"].includes(k)) ||
      !["ollama", "openrouter", "openai-compatible"].includes(
        req.body.providerId,
      ) ||
      (req.body.model != null &&
        (typeof req.body.model !== "string" ||
          !req.body.model.trim() ||
          req.body.model.length > 200))
    )
      return res.status(400).json({
        error:
          "Valid providerId and optional model are required; configuration is server-only",
      });
    try {
      return res.json(await service.probe(req.body.providerId, req.body.model));
    } catch (error) {
      return res.status(503).json({ error: error.message, connected: false });
    }
  });

  app.post(
    "/api/providers/workers/register",
    guard(async (req, res) => {
      const credential = bearer(req);
      const shared = matches(credential, registrationHash);
      const oneTime = matches(credential, oneTimeHash);
      if (!shared && !oneTime)
        return res
          .status(401)
          .json({ error: "Worker registration authentication required" });
      const b = req.body || {};
      if (
        Object.keys(b).some(
          (k) => !["name", "capabilities", "health"].includes(k),
        ) ||
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 120
      )
        throw invalid(
          "Worker name and capabilities are required; worker endpoints are not accepted",
        );
      const token = randomBytes(32).toString("base64url");
      const worker = {
        id: store.id("worker"),
        name: b.name.trim(),
        capabilities: capabilities(b.capabilities),
        health: health(b.health),
        tokenHash: hash(token),
        instanceId,
        registeredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      await store.update((state) => {
        state.providerWorkers ||= [];
        state.providerUsedWorkerSecrets ||= [];
        if (oneTime && !shared) {
          if (state.providerUsedWorkerSecrets.includes(oneTimeHash))
            throw Object.assign(
              new Error("One-time registration secret was already used"),
              { status: 401 },
            );
          state.providerUsedWorkerSecrets.push(oneTimeHash);
        }
        if (state.providerWorkers.length >= 1000)
          throw Object.assign(new Error("Worker registry is full"), {
            status: 409,
          });
        state.providerWorkers.push(worker);
      });
      // This is a per-worker protocol credential, not a model-provider API key. It is
      // returned once so the outbound worker can authenticate subsequent heartbeats.
      res.status(201).json({
        worker: publicWorker(worker),
        workerToken: token,
        heartbeatIntervalSeconds: 30,
        expiresAfterSeconds: 90,
      });
    }),
  );

  app.post(
    "/api/providers/workers/:id/heartbeat",
    guard(async (req, res) => {
      const w = workers().find((item) => item.id === req.params.id);
      if (!w || !matches(bearer(req), w.tokenHash))
        return res
          .status(401)
          .json({ error: "Worker authentication required" });
      const b = req.body || {};
      if (Object.keys(b).some((k) => !["health", "capabilities"].includes(k)))
        throw invalid("Only worker health and capabilities are accepted");
      const updated = await store.update((state) => {
        const current = state.providerWorkers.find((item) => item.id === w.id);
        current.health = health(b.health ?? current.health);
        if (b.capabilities !== undefined)
          current.capabilities = capabilities(b.capabilities);
        current.instanceId = instanceId;
        current.lastSeenAt = new Date().toISOString();
        return current;
      });
      res.json({ worker: publicWorker(updated) });
    }),
  );

  app.get(
    "/api/providers/workers/status",
    guard(async (req, res) => {
      const credential = bearer(req);
      if (matches(credential, registrationHash)) return res.json(status());
      const worker = workers().find((w) => matches(credential, w.tokenHash));
      if (!worker)
        return res
          .status(401)
          .json({ error: "Worker status authentication required" });
      return res.json(status([worker]));
    }),
  );
  return { service, workerStatus: status };
}

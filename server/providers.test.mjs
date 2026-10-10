import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  createProviderService,
  filterFreeModels,
  redactHeaders,
} from "./providers/adapters.mjs";
import { registerProviderRoutes } from "./providers/routes.mjs";
import { coordinatorSchema, specialistSchema } from "./orchestra/ollama.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const reply = { message: "Records inspected", tool: "", args: {}, done: true };
const request = {
  model: "vendor/current-model",
  system: "Review records",
  user: "Inspect",
  schema: specialistSchema([]),
};

test("header redaction is case insensitive and retains non-secret headers", () => {
  const redacted = redactHeaders({
    Authorization: "Bearer secret",
    "X-API-Key": "key",
    Cookie: "session=secret",
    "X-Worker-Token": "token",
    "content-type": "application/json",
  });
  assert.equal(redacted.Authorization, "[REDACTED]");
  assert.equal(redacted["X-API-Key"], "[REDACTED]");
  assert.equal(redacted.Cookie, "[REDACTED]");
  assert.equal(redacted["X-Worker-Token"], "[REDACTED]");
  assert.equal(redacted["content-type"], "application/json");
  assert.equal(
    redactHeaders(new Headers({ authorization: "secret" })).authorization,
    "[REDACTED]",
  );
});

test("OpenRouter uses fixed HTTPS endpoint, server key and shared structured contract", async () => {
  let calls = 0;
  const service = createProviderService({
    env: { OPENROUTER_API_KEY: "server-key" },
    providerFetch: async (url, init) => {
      calls++;
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init.headers.authorization, "Bearer server-key");
      assert.equal(init.redirect, "error");
      const body = JSON.parse(init.body);
      assert.equal(body.model, request.model);
      assert.equal(body.stream, false);
      assert.deepEqual(body.messages, [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ]);
      assert.deepEqual(body.response_format.json_schema.schema, request.schema);
      return json({
        choices: [{ message: { content: JSON.stringify(reply) } }],
      });
    },
  });
  assert.deepEqual(await service.askProvider("openrouter", request), reply);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(service.status()).includes("server-key"));
});

test("no OpenRouter key blocks inference and probe but permits public dynamic catalog", async () => {
  const calls = [];
  const service = createProviderService({
    env: {},
    providerFetch: async (url, init) => {
      calls.push(url);
      assert.equal(init.headers.authorization, undefined);
      if (url.endsWith("/api/tags")) return json({ models: [] });
      return json({
        data: [{ id: "new-model:free", name: "New catalog model" }],
      });
    },
  });
  await assert.rejects(
    service.askProvider("openrouter", request),
    /not configured/,
  );
  await assert.rejects(
    service.probe("openrouter", request.model),
    /not configured/,
  );
  assert.equal(calls.length, 0);
  const catalog = await service.catalog();
  assert.equal(catalog.freeModels[0].id, "new-model:free");
  const router = catalog.providers.find((p) => p.id === "openrouter");
  assert.equal(router.configured, false);
  assert.equal(router.status, "not_configured");
  assert.match(router.message, /API key required/);
});

test("free candidates use only current zero prices or catalog tags and update dynamically", async () => {
  let current = [
    { id: "zero", pricing: { prompt: "0", completion: "0.0" } },
    { id: "tagged:free" },
    { id: "tag-array", tags: ["free"] },
    { id: "paid", pricing: { prompt: "0", completion: "0.1" } },
    { id: "unknown" },
    { id: "string-tag-is-not-a-free-tag", tags: "not-free" },
    { id: "null-price", pricing: { prompt: null, completion: null } },
    { id: "blank", pricing: { prompt: "", completion: "" } },
  ];
  const service = createProviderService({
    env: {},
    providerFetch: async () => json({ data: current }),
  });
  assert.deepEqual(
    filterFreeModels(await service.models("openrouter")).map((m) => m.id),
    ["zero", "tagged:free", "tag-array"],
  );
  current = [{ id: "zero", pricing: { prompt: "1", completion: "1" } }];
  assert.deepEqual(filterFreeModels(await service.models("openrouter")), []);
});

test("compatible provider endpoint is env-only, safe and never redirects credentials", async () => {
  for (const base of [
    "http://remote.example/v1",
    "https://user:pass@example.test/v1",
    "https://example.test/v1?key=x",
    "file:///tmp/test",
    "bad",
  ]) {
    const service = createProviderService({
      env: { OPENAI_COMPATIBLE_BASE_URL: base },
      providerFetch: () => {
        throw new Error("must not fetch");
      },
    });
    await assert.rejects(
      service.askProvider("openai-compatible", request),
      /not configured/,
    );
  }
  const service = createProviderService({
    env: {
      OPENAI_COMPATIBLE_BASE_URL: "http://127.0.0.1:1234/v1/",
      OPENAI_COMPATIBLE_API_KEY: "local-key",
    },
    providerFetch: async (url, init) => {
      assert.equal(url, "http://127.0.0.1:1234/v1/chat/completions");
      assert.equal(init.headers.authorization, "Bearer local-key");
      assert.equal(init.redirect, "error");
      return json({
        choices: [{ message: { content: JSON.stringify(reply) } }],
      });
    },
  });
  assert.deepEqual(
    await service.askProvider("openai-compatible", request),
    reply,
  );
});

test("Ollama stays loopback and returns the same coordinator contract", async () => {
  const planned = {
    title: "Review",
    tasks: [{ agent: "Review", instruction: "Inspect" }],
  };
  const service = createProviderService({
    env: { OLLAMA_HOST: "https://remote.invalid" },
    providerFetch: async (url, init) => {
      assert.equal(url, "http://127.0.0.1:11434/api/chat");
      assert.equal(init.headers.authorization, undefined);
      const body = JSON.parse(init.body);
      assert.equal(body.think, false);
      assert.equal(body.options.num_ctx, 4096);
      assert.deepEqual(body.format, coordinatorSchema);
      return json({ message: { content: JSON.stringify(planned) } });
    },
  });
  assert.deepEqual(
    await service.askProvider("ollama", {
      ...request,
      schema: coordinatorSchema,
    }),
    planned,
  );
});

test("invalid structured output, oversized output and upstream secrets fail safely", async () => {
  for (const content of [
    "not json",
    JSON.stringify({ ...reply, tool: "shell" }),
    JSON.stringify({ done: true }),
  ]) {
    const service = createProviderService({
      env: { OPENROUTER_API_KEY: "secret" },
      providerFetch: async () => json({ choices: [{ message: { content } }] }),
    });
    await assert.rejects(
      service.askProvider("openrouter", request),
      /invalid structured JSON/,
    );
  }
  const oversized = createProviderService({
    env: {},
    providerFetch: async () => new Response("x".repeat(512 * 1024 + 1)),
  });
  await assert.rejects(
    oversized.askProvider("ollama", request),
    /output limit/,
  );
  const failed = createProviderService({
    env: {},
    providerFetch: async () => {
      throw new Error("authorization: key-secret");
    },
  });
  await assert.rejects(
    failed.askProvider("ollama", request),
    (e) => e.message === "Provider connection failed",
  );
  const httpFailure = createProviderService({
    env: {},
    providerFetch: async () => json({ error: "key-secret" }, 401),
  });
  await assert.rejects(
    httpFailure.askProvider("ollama", request),
    (e) => e.message === "Provider returned HTTP 401",
  );
});

test("cancellation aborts model transport and reports canceled", async () => {
  const controller = new AbortController();
  const service = createProviderService({
    env: {},
    providerFetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => reject(new Error("transport aborted")),
          { once: true },
        );
        controller.abort();
      }),
  });
  await assert.rejects(
    service.askProvider("ollama", { ...request, signal: controller.signal }),
    /orchestra canceled/,
  );
});

function memoryStore() {
  let state = { contacts: [{ id: "keep" }] };
  let queue = Promise.resolve();
  let id = 0;
  return {
    get: () => structuredClone(state),
    id: (prefix) => `${prefix}_${++id}`,
    update(fn) {
      const job = queue.then(async () => {
        const next = structuredClone(state);
        const value = await fn(next);
        state = next;
        return value;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}

async function fixture(t, env = {}, store = memoryStore()) {
  const app = express();
  app.use(express.json());
  const calls = [];
  registerProviderRoutes(app, {
    store,
    env,
    providerFetch: async (url) => {
      calls.push(url);
      return url.endsWith("/api/tags")
        ? json({ models: [{ name: "installed" }] })
        : json({ data: [{ id: "vendor/current-model" }] });
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const call = async (
    path,
    { token, body, method = body ? "POST" : "GET" } = {},
  ) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  return { call, store, calls };
}

test("worker registration, heartbeat and status require scoped authentication and redact secrets", async (t) => {
  const { call, store } = await fixture(t, {
    NEXUS_WORKER_REGISTRATION_SECRET: "bootstrap",
    OPENROUTER_API_KEY: "never-public",
  });
  const payload = {
    name: "GPU workstation",
    capabilities: { providers: ["ollama"], models: ["installed"] },
  };
  assert.equal(
    (await call("/api/providers/workers/register", { body: payload })).status,
    401,
  );
  assert.equal((await call("/api/providers/workers/status")).status, 401);
  const registered = await call("/api/providers/workers/register", {
    token: "bootstrap",
    body: payload,
  });
  assert.equal(registered.status, 201);
  const { workerToken, worker } = registered.body;
  assert.equal(worker.connected, true);
  assert.equal(worker.available, true);
  assert.equal(worker.schedulingSupported, false);
  assert.notEqual(store.get().providerWorkers[0].tokenHash, workerToken);
  assert.deepEqual(store.get().contacts, [{ id: "keep" }]);
  const heartbeatPath = `/api/providers/workers/${worker.id}/heartbeat`;
  assert.equal(
    (await call(heartbeatPath, { token: "bootstrap", body: {} })).status,
    401,
  );
  const beat = await call(heartbeatPath, {
    token: workerToken,
    body: { health: "degraded" },
  });
  assert.equal(beat.status, 200);
  assert.equal(beat.body.worker.available, false);
  assert.equal(beat.body.worker.connected, true);
  const second = await call("/api/providers/workers/register", {
    token: "bootstrap",
    body: payload,
  });
  const own = await call("/api/providers/workers/status", {
    token: workerToken,
  });
  assert.equal(own.body.workers.length, 1);
  const status = await call("/api/providers/workers/status", {
    token: "bootstrap",
  });
  assert.equal(status.body.workers.length, 2);
  for (const secret of [
    workerToken,
    second.body.workerToken,
    "bootstrap",
    "never-public",
    "tokenHash",
    "instanceId",
  ])
    assert.ok(!JSON.stringify(status.body).includes(secret));
  await store.update((s) => {
    s.providerWorkers[0].lastSeenAt = new Date(
      Date.now() - 91000,
    ).toISOString();
  });
  assert.equal(
    (await call("/api/providers/workers/status", { token: workerToken })).body
      .workers[0].connected,
    false,
  );
  assert.equal(
    (
      await call(heartbeatPath, {
        token: workerToken,
        body: { endpoint: "http://public.invalid:11434" },
      })
    ).status,
    400,
  );
});

test("one-time env secret is consumed transactionally, survives restart; sessions reconnect by heartbeat", async (t) => {
  const env = { NEXUS_WORKER_ONE_TIME_SECRET: "one-time" };
  const { call, store } = await fixture(t, env);
  const options = { token: "one-time", body: { name: "Worker" } };
  const outcomes = await Promise.all([
    call("/api/providers/workers/register", options),
    call("/api/providers/workers/register", options),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [201, 401]);
  const { worker, workerToken } = outcomes.find((r) => r.status === 201).body;
  const restarted = await fixture(t, env, store);
  assert.equal(
    (await restarted.call("/api/providers/workers/register", options)).status,
    401,
  );
  assert.equal(
    (
      await restarted.call("/api/providers/workers/status", {
        token: workerToken,
      })
    ).body.workers[0].connected,
    false,
  );
  const heartbeat = await restarted.call(
    `/api/providers/workers/${worker.id}/heartbeat`,
    { token: workerToken, body: { health: "healthy" } },
  );
  assert.equal(heartbeat.body.worker.connected, true);
});

test("provider probe does not dispatch inference or allow request-supplied credentials/endpoints", async (t) => {
  const { call, calls } = await fixture(t);
  const failed = await call("/api/providers/test", {
    body: { providerId: "openrouter", model: request.model },
  });
  assert.equal(failed.status, 503);
  assert.match(failed.body.error, /not configured/);
  assert.equal(calls.length, 0);
  assert.equal(
    (
      await call("/api/providers/test", {
        body: {
          providerId: "ollama",
          endpoint: "http://bad",
          apiKey: "secret",
        },
      })
    ).status,
    400,
  );
  const checked = await call("/api/providers/test", {
    body: { providerId: "ollama", model: "installed" },
  });
  assert.equal(checked.status, 200);
  assert.equal(checked.body.connected, true);
  assert.equal(checked.body.inferenceTested, false);
  assert.deepEqual(calls, ["http://127.0.0.1:11434/api/tags"]);
  assert.equal(
    (
      await call("/api/providers/test", {
        body: { providerId: "ollama", model: "missing" },
      })
    ).status,
    503,
  );
  const catalog = await call("/api/providers/catalog");
  assert.equal(catalog.status, 200);
  assert.match(catalog.body.pricingNotice, /not a pricing/);
  assert.equal(
    (await call("/api/providers/status")).body.providers[1].status,
    "not_configured",
  );
  assert.equal(
    (
      await call("/api/providers/workers/register", {
        token: "guess",
        body: { name: "Worker" },
      })
    ).status,
    401,
  );
});

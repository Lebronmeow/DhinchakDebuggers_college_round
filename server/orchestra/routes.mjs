import {
  createOrchestraEngine,
  DEFAULT_EMPLOYEE_MODELS,
} from "./engine.mjs";

export async function registerOrchestraRoutes(
  app,
  { store, ollamaFetch = fetch, createTools, providerService },
) {
  if (!store || typeof store.update !== "function")
    throw new Error("orchestra requires a store");
  if (typeof createTools !== "function")
    throw new Error("orchestra requires createTools");
  const engine = createOrchestraEngine({
    store,
    ollamaFetch,
    createTools,
    providerService,
  });
  await engine.interruptOnStart();
  const runs = () => engine.readRuns();
  const publicState = () => {
    const all = runs();
    const active = all.find((r) =>
      ["planning", "running", "awaiting_approval"].includes(r.status),
    );
    return {
      runs: all,
      activeRunId: active?.id || null,
      defaultEmployeeModels: DEFAULT_EMPLOYEE_MODELS,
    };
  };
  app.get("/api/orchestra", (_req, res) => res.json(publicState()));
  app.post("/api/orchestra/runs", async (req, res) => {
    const prompt =
      typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    let model =
      typeof req.body?.model === "string" ? req.body.model.trim() : "";
    let providerId =
      typeof req.body?.providerId === "string"
        ? req.body.providerId.trim()
        : "";
    if (!providerId) {
      providerId =
        providerService?.status().find((p) => p.id === "openrouter")?.configured
          ? "openrouter"
          : "ollama";
    }
    if (!model) {
      model =
        providerId === "openrouter"
          ? DEFAULT_EMPLOYEE_MODELS.Coordinator
          : "qwen";
    }
    const agentModels =
      typeof req.body?.agentModels === "object" && req.body?.agentModels !== null
        ? req.body.agentModels
        : providerId === "openrouter"
          ? DEFAULT_EMPLOYEE_MODELS
          : null;
    const agentProviders =
      typeof req.body?.agentProviders === "object" &&
      req.body?.agentProviders !== null
        ? req.body.agentProviders
        : null;
    if (!prompt || prompt.length > 4000 || !model || model.length > 200)
      return res
        .status(400)
        .json({ error: "prompt and installed model are required" });
    try {
      if (!["ollama", "openrouter", "openai-compatible"].includes(providerId))
        return res.status(400).json({ error: "Unsupported provider" });
      if (providerId === "ollama") {
        const tags = await ollamaFetch("http://127.0.0.1:11434/api/tags", {
          signal: AbortSignal.timeout(10000),
        });
        if (!tags.ok)
          throw new Error(`Ollama model registry returned HTTP ${tags.status}`);
        const listed = await tags.json();
        if (
          !listed.models?.some(
            (item) => item.name === model || item.model === model,
          )
        )
          return res
            .status(400)
            .json({ error: `Model '${model}' is not installed locally` });
      } else if (providerService) {
        const available = await providerService.models(providerId);
        if (
          model !== "openrouter/free" &&
          !available.some((m) => m.id === model || m.name === model)
        )
          return res.status(400).json({
            error: `Model '${model}' is not available from ${providerId}`,
          });
      }
      const run = await engine.create(
        prompt,
        model,
        req.socket.localPort,
        providerId,
        agentModels,
        agentProviders,
        Boolean(req.body?.autoApprove),
      );
      return res.status(202).json(run);
    } catch (error) {
      return res
        .status(503)
        .json({ error: `Provider unavailable: ${error.message}` });
    }
  });
  app.post("/api/orchestra/runs/:id/cancel", async (req, res) => {
    const run = await engine.cancel(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    return res.json(run);
  });
  app.delete("/api/orchestra/runs/:id", async (req, res) => {
    const deleted = await engine.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "run not found" });
    return res.json({ success: true, id: req.params.id });
  });
  app.post("/api/orchestra/runs/:id/resume", async (req, res) => {
    const found = runs().find((r) => r.id === req.params.id);
    if (!found) return res.status(404).json({ error: "run not found" });
    if (found.status !== "awaiting_approval")
      return res.status(409).json({ error: "run is not awaiting approval" });
    const result = await engine.resume(req.params.id, req.socket.localPort);
    if (!result)
      return res.status(409).json({ error: "run could not be resumed" });
    return res.json(result);
  });
  return engine;
}

const OLLAMA = "http://127.0.0.1:11434";
const OPENROUTER = "https://openrouter.ai/api/v1";
const LIMIT = 512 * 1024;
const IDS = ["ollama", "openrouter", "openai-compatible"];

export function redactHeaders(headers) {
  const entries =
    headers instanceof Headers
      ? [...headers.entries()]
      : Object.entries(headers || {});
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      /authorization|api[-_]?key|cookie|secret|token/i.test(key)
        ? "[REDACTED]"
        : value,
    ]),
  );
}

function safeBase(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const privateNet =
      /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})$/.test(
        url.hostname,
      );
    if (
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && (loopback || privateNet))) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function validModel(model) {
  if (
    typeof model !== "string" ||
    !model.trim() ||
    model.length > 200 ||
    /[\x00-\x1f]/.test(model)
  )
    throw new Error("A valid model ID is required");
  return model.trim();
}

async function requestJSON(
  fetcher,
  url,
  init,
  { signal, timeoutMs = 10000, maxBytes = LIMIT } = {},
) {
  if (signal?.aborted) throw new Error("orchestra canceled");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timer;
  let abortListener;
  const interrupted = new Promise((_, reject) => {
    abortListener = () =>
      reject(
        new Error(
          signal?.aborted ? "orchestra canceled" : "Provider request timed out",
        ),
      );
    controller.signal.addEventListener("abort", abortListener, { once: true });
    if (controller.signal.aborted) abortListener();
    timer = setTimeout(() => controller.abort(), timeoutMs);
  });
  const work = async () => {
    let response;
    try {
      response = await fetcher(url, {
        ...init,
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new Error("Provider connection failed");
    }
    if (!response.ok)
      throw new Error(`Provider returned HTTP ${response.status}`);
    let raw = "";
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            throw new Error("Provider response exceeded output limit");
          }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } catch (error) {
        if (error.message === "Provider response exceeded output limit")
          throw error;
        throw new Error("Provider response could not be read");
      } finally {
        reader.releaseLock();
      }
    } else {
      try {
        raw = await response.text();
      } catch {
        throw new Error("Provider response could not be read");
      }
      if (Buffer.byteLength(raw) > maxBytes)
        throw new Error("Provider response exceeded output limit");
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Provider returned invalid JSON");
    }
  };
  try {
    return await Promise.race([work(), interrupted]);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", abortListener);
    signal?.removeEventListener("abort", abort);
  }
}

export function cleanJSON(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  s = s
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<thought[\s\S]*?<\/thought>/gi, "")
    .trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    s = fence[1].trim();
  }
  const startObj = s.indexOf("{");
  const endObj = s.lastIndexOf("}");
  const startArr = s.indexOf("[");
  const endArr = s.lastIndexOf("]");
  if (
    startObj !== -1 &&
    endObj > startObj &&
    (startArr === -1 || startObj < startArr)
  ) {
    s = s.slice(startObj, endObj + 1);
  } else if (startArr !== -1 && endArr > startArr) {
    s = s.slice(startArr, endArr + 1);
  }
  return s;
}

// Validate the shared coordinator/specialist JSON-schema subset, including tool enums.
function validate(value, schema) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Provider returned invalid structured JSON");
    if (schema.required?.some((key) => !Object.hasOwn(value, key)))
      throw new Error("Provider returned invalid structured JSON");
    for (const [key, item] of Object.entries(value)) {
      if (
        schema.additionalProperties === false &&
        !Object.hasOwn(schema.properties || {}, key)
      ) {
        delete value[key];
        continue;
      }
      validate(item, schema.properties?.[key]);
    }
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      (schema.maxItems != null && value.length > schema.maxItems)
    )
      throw new Error("Provider returned invalid structured JSON");
    for (const item of value) validate(item, schema.items);
  } else if (schema.type && typeof value !== schema.type) {
    throw new Error("Provider returned invalid structured JSON");
  }
  if (schema.enum && !schema.enum.includes(value))
    throw new Error("Provider returned invalid structured JSON");
}

export function filterFreeModels(models) {
  return models.filter(
    (model) =>
      model.free === true &&
      !model.id.toLowerCase().includes("nvidia") &&
      !(typeof model.name === "string" && model.name.toLowerCase().includes("nvidia")) &&
      model.id !== "openrouter/free",
  );
}

function normalizeRemoteModel(model) {
  if (typeof model?.id !== "string" || model.id.length > 200) return null;
  const idLower = model.id.toLowerCase();
  const nameLower =
    typeof model.name === "string" ? model.name.toLowerCase() : "";
  if (
    idLower.includes("nvidia") ||
    nameLower.includes("nvidia") ||
    idLower === "openrouter/free"
  )
    return null;
  const zero = (v) =>
    (typeof v === "string" || typeof v === "number") &&
    String(v).trim() !== "" &&
    Number(v) === 0;
  const pricedZero =
    zero(model.pricing?.prompt) && zero(model.pricing?.completion);
  const taggedFree =
    model.id.endsWith(":free") ||
    (Array.isArray(model.tags) && model.tags.includes("free"));
  return {
    id: model.id,
    name: typeof model.name === "string" ? model.name.slice(0, 200) : model.id,
    free: pricedZero || taggedFree,
    freeSource: pricedZero ? "zero-priced" : taggedFree ? "catalog-tag" : null,
  };
}

export function createProviderService({
  providerFetch = fetch,
  ollamaFetch = providerFetch,
  env = process.env,
} = {}) {
  // Capture server env once. Request bodies can never select endpoints or credentials.
  const rawBases = [
    ...(env.OPENAI_COMPATIBLE_BASE_URL || "").split(","),
    ...(env.OPENAI_COMPATIBLE_BASE_URL_2 || "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const bases = rawBases.map(safeBase).filter(Boolean);
  const base = bases[0] || null;
  const modelEndpointMap = new Map();
  const cachedRemoteModels = new Map();
  if (bases.length > 0) {
    cachedRemoteModels.set("qwen3:4b", {
      id: "qwen3:4b",
      name: "qwen3:4b (Friend 3 GPU)",
      free: true,
      freeSource: "zero-priced",
    });
    if (bases[bases.length - 1]) {
      modelEndpointMap.set("qwen3:4b", bases[bases.length - 1]);
    }
  }
  const configs = {
    ollama: { base: OLLAMA, configured: true, key: "" },
    openrouter: {
      base: OPENROUTER,
      configured: Boolean(env.OPENROUTER_API_KEY?.trim()),
      key: env.OPENROUTER_API_KEY?.trim() || "",
    },
    "openai-compatible": {
      base,
      configured: Boolean(base),
      key: env.OPENAI_COMPATIBLE_API_KEY?.trim() || "",
    },
  };
  const config = (id) => {
    if (!IDS.includes(id)) throw new Error("Unknown provider ID");
    const c = configs[id];
    if (!c.configured) throw new Error(`${id} is not configured`);
    return c;
  };
  const headers = (c) => ({
    "content-type": "application/json",
    "bypass-tunnel-reminder": "true",
    ...(c.key ? { authorization: `Bearer ${c.key}` } : {}),
  });
  const status = () =>
    IDS.map((id) => ({
      id,
      configured: configs[id].configured,
      status: configs[id].configured ? "available" : "not_configured",
      connected: false,
      location: id === "ollama" ? "local" : "server-configured",
      message: configs[id].configured
        ? "Configured; connection not yet probed"
        : "Server environment configuration required",
    }));

  async function models(id, { signal } = {}) {
    // OpenRouter's public catalog needs no inference key; discovery stays useful before setup.
    const c = id === "openrouter" ? configs.openrouter : config(id);
    if (id === "openai-compatible" && bases.length > 1) {
      const results = await Promise.allSettled(
        bases.map(async (endpointBase) => {
          const modelUrl = !endpointBase.endsWith("/v1")
            ? `${endpointBase}/v1/models`
            : `${endpointBase}/models`;
          const data = await requestJSON(
            providerFetch,
            modelUrl,
            { headers: headers(c) },
            { signal, timeoutMs: 3000, maxBytes: 8 * 1024 * 1024 },
          );
          return {
            endpointBase,
            items: Array.isArray(data?.data) ? data.data : [],
          };
        }),
      );
      const allItems = [];
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value?.items)) {
          for (const item of r.value.items) {
            if (item?.id) {
              modelEndpointMap.set(item.id, r.value.endpointBase);
              cachedRemoteModels.set(item.id, item);
              allItems.push(item);
            }
          }
        }
      }
      for (const [mid, cached] of cachedRemoteModels.entries()) {
        if (!allItems.some((item) => item.id === mid)) {
          allItems.push(cached);
        }
      }
      return allItems
        .slice(0, 2000)
        .map(normalizeRemoteModel)
        .filter(Boolean);
    }
    const modelUrl =
      id === "ollama"
        ? `${c.base}/api/tags`
        : id === "openai-compatible" && !c.base.endsWith("/v1")
          ? `${c.base}/v1/models`
          : `${c.base}/models`;
    const data = await requestJSON(
      id === "ollama" ? ollamaFetch : providerFetch,
      modelUrl,
      { headers: headers(c) },
      { signal, maxBytes: 8 * 1024 * 1024 },
    );
    const items = id === "ollama" ? data?.models : data?.data;
    if (!Array.isArray(items))
      throw new Error("Provider returned an invalid model catalog");
    return items
      .slice(0, 2000)
      .map((m) =>
        id === "ollama"
          ? normalizeRemoteModel({
              id: m.name || m.model,
              name: m.name || m.model,
            })
          : normalizeRemoteModel(m),
      )
      .filter(Boolean);
  }

  async function askProvider(id, { model, system, user, schema, signal }) {
    const c = config(id);
    model = validModel(model);
    if (
      typeof system !== "string" ||
      typeof user !== "string" ||
      !schema ||
      typeof schema !== "object"
    )
      throw new Error("Structured provider request is invalid");
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    const executeAttempt = async (targetModel) => {
      const body =
        id === "ollama"
          ? {
              model: targetModel,
              stream: false,
              think: false,
              format: schema,
              options: { num_ctx: 4096, num_predict: 1400, temperature: 0.15 },
              messages,
            }
          : {
              model: targetModel,
              stream: false,
              temperature: 0.15,
              max_tokens: 1400,
              messages,
              response_format: {
                type: "json_schema",
                json_schema: { name: "orchestra_response", strict: true, schema },
              },
            };
      const candidateBases =
        id === "openai-compatible" && bases.length > 0
          ? [
              ...(modelEndpointMap.has(targetModel)
                ? [modelEndpointMap.get(targetModel)]
                : []),
              ...bases.filter((b) => b !== modelEndpointMap.get(targetModel)),
            ]
          : [c.base];

      let lastError = null;
      for (const currentBase of candidateBases) {
        try {
          const chatUrl =
            id === "ollama"
              ? `${currentBase}/api/chat`
              : id === "openai-compatible" && !currentBase.endsWith("/v1")
                ? `${currentBase}/v1/chat/completions`
                : `${currentBase}/chat/completions`;
          const data = await requestJSON(
            id === "ollama" ? ollamaFetch : providerFetch,
            chatUrl,
            {
              method: "POST",
              headers: headers(c),
              body: JSON.stringify(body),
            },
            { signal, timeoutMs: 120000 },
          );
          const content =
            id === "ollama"
              ? data?.message?.content
              : data?.choices?.[0]?.message?.content;
          if (typeof content !== "string" || !content.trim())
            throw new Error("Provider returned no message content");
          const cleaned = cleanJSON(content);
          const parsed = JSON.parse(cleaned);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.tool === "string") parsed.tool = parsed.tool.trim();
            if (parsed.done === "true") parsed.done = true;
            if (parsed.done === "false") parsed.done = false;
            if (typeof parsed.args === "string") {
              try {
                parsed.args = JSON.parse(parsed.args);
              } catch {}
            }
          }
          validate(parsed, schema);
          if (id === "openai-compatible") {
            modelEndpointMap.set(targetModel, currentBase);
          }
          return parsed;
        } catch (candidateErr) {
          if (signal?.aborted || /canceled/i.test(candidateErr.message)) {
            throw candidateErr;
          }
          lastError = candidateErr;
        }
      }
      throw lastError || new Error("Provider returned no message content");
    };

    try {
      return await executeAttempt(model);
    } catch (err) {
      if (signal?.aborted || /canceled/i.test(err.message)) {
        throw err;
      }
      if (id === "openrouter") {
        const fallbackTarget =
          model === "inclusionai/ling-3.1-flash"
            ? "dots-studio/dots-3-note-preview:free"
            : "inclusionai/ling-3.1-flash";
        if (model !== fallbackTarget) {
          try {
            return await executeAttempt(fallbackTarget);
          } catch (fallbackErr) {
            if (signal?.aborted || /canceled/i.test(fallbackErr.message)) {
              throw fallbackErr;
            }
            if (
              /no message content/i.test(fallbackErr.message) ||
              /JSON/i.test(fallbackErr.message) ||
              fallbackErr instanceof SyntaxError
            ) {
              throw new Error("Provider returned invalid structured JSON");
            }
            throw fallbackErr;
          }
        }
      }
      if (
        /no message content/i.test(err.message) ||
        /JSON/i.test(err.message) ||
        err instanceof SyntaxError
      ) {
        throw new Error("Provider returned invalid structured JSON");
      }
      throw err;
    }
  }

  async function probe(id, model) {
    config(id);
    if (model != null) model = validModel(model);
    const listed = await models(id);
    if (model && !listed.some((m) => m.id === model))
      throw new Error(
        "Selected model was not returned by the provider catalog",
      );
    return {
      providerId: id,
      configured: true,
      connected: true,
      status: "connected",
      model: model || null,
      modelCount: listed.length,
      inferenceTested: false,
      message:
        "Model catalog connection verified; inference was not dispatched",
    };
  }

  async function catalog() {
    const providers = await Promise.all(
      status().map(async (provider) => {
        if (!provider.configured && provider.id !== "openrouter")
          return { ...provider, models: [] };
        try {
          const listed = await models(provider.id);
          return {
            ...provider,
            connected: true,
            status: provider.configured ? "connected" : "not_configured",
            models: listed,
            message: provider.configured
              ? "Model catalog connected"
              : "Public catalog available; server API key required for inference",
          };
        } catch (error) {
          return {
            ...provider,
            models: [],
            connected: false,
            status: provider.configured ? "unavailable" : "not_configured",
            message: error.message,
          };
        }
      }),
    );
    return {
      providers,
      freeModels: filterFreeModels(
        providers.find((p) => p.id === "openrouter").models,
      ),
      pricingNotice:
        "Free labels reflect the current provider catalog, not a pricing, quota, or availability guarantee.",
    };
  }
  return { status, models, askProvider, probe, catalog };
}

const ENDPOINT = "http://127.0.0.1:11434/api/chat";

export async function askOllama(
  fetcher,
  { model, system, user, schema, signal },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        format: schema,
        options: { num_ctx: 4096, num_predict: 1400, temperature: 0.15 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Ollama returned HTTP ${response.status}`);
    let raw = "";
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 512 * 1024) {
          await reader.cancel();
          throw new Error("Ollama response exceeded output limit");
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } else {
      raw = await response.text();
      if (raw.length > 512 * 1024)
        throw new Error("Ollama response exceeded output limit");
    }
    const body = JSON.parse(raw);
    const content = body?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw new Error("Ollama returned no message content");
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("Ollama returned invalid structured JSON");
    }
  } catch (error) {
    if (signal?.aborted) throw new Error("orchestra canceled");
    if (error.name === "AbortError")
      throw new Error("Ollama request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const coordinatorSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    tasks: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          agent: {
            type: "string",
            enum: ["Website", "CRM", "Growth", "Events", "Billing", "Review"],
          },
          instruction: { type: "string" },
        },
        required: ["agent", "instruction"],
      },
    },
  },
  required: ["title", "tasks"],
};

export function specialistSchema(catalog) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      message: { type: "string" },
      tool: { type: "string", enum: ["", ...catalog.map((x) => x.name)] },
      args: { type: "object" },
      done: { type: "boolean" },
    },
    required: ["message", "tool", "args", "done"],
  };
}

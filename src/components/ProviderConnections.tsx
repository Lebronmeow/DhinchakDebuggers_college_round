import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  Cpu,
  KeyRound,
  Loader2,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import "./provider-connections.css";

export type ProviderConnectionsProps = {
  onClose?: () => void;
  onChanged?: () => void;
};

type Category = "coding" | "api" | "local";
type Provider = {
  id: string;
  name: string;
  mark: string;
  description: string;
  category: Category;
  endpoint?: boolean;
};
type Connection = {
  id: string;
  provider: string;
  name: string;
  status: string;
};
type Worker = { id: string; name: string; status: string; models: string[] };
type Model = {
  id: string;
  name: string;
  provider: string;
  pricing?: { prompt: string | number; completion: string | number };
  freeSource?: string;
};
type Snapshot = {
  providers: Connection[];
  workers: Worker[];
  models: Model[];
  defaultModel?: string;
};

const providers: Provider[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    mark: "✳",
    description: "Connect your installed coding agent via the backend adapter.",
    category: "coding",
  },
  {
    id: "codex",
    name: "Codex",
    mark: "C",
    description: "Use your installed Codex agent and its own authentication.",
    category: "coding",
  },
  {
    id: "custom-acp",
    name: "Custom ACP agent",
    mark: ">_",
    description: "An administrator-configured Agent Client Protocol adapter.",
    category: "coding",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    mark: "M",
    description: "Kimi models with your own Moonshot API account.",
    category: "api",
  },
  {
    id: "openai",
    name: "OpenAI",
    mark: "◎",
    description: "Connect OpenAI models using your own API key.",
    category: "api",
  },
  {
    id: "openai-compatible",
    name: "OpenAI-compatible",
    mark: "↗",
    description: "A trusted endpoint supporting the OpenAI API format.",
    category: "api",
    endpoint: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    mark: "A",
    description: "Claude models through the Anthropic API.",
    category: "api",
  },
  {
    id: "google",
    name: "Google",
    mark: "G",
    description: "Gemini models through the Google API.",
    category: "api",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    mark: "◇",
    description: "Discover models and provider-reported pricing.",
    category: "api",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    mark: "△",
    description: "Use your Azure resource and deployed model.",
    category: "api",
    endpoint: true,
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    mark: "aws",
    description: "Use the backend's AWS credential chain and region.",
    category: "api",
  },
  {
    id: "ollama",
    name: "Ollama",
    mark: "◉",
    description: "Run installed models on this machine or an outbound worker.",
    category: "local",
  },
  {
    id: "lm-studio",
    name: "LM Studio",
    mark: "LM",
    description: "Connect the loopback server on the backend machine.",
    category: "local",
  },
];
const categories: { id: Category; title: string; description: string }[] = [
  {
    id: "coding",
    title: "Coding agents",
    description: "Bring an agent that already works on your machine.",
  },
  {
    id: "api",
    title: "Bring your own API key",
    description:
      "Your account, your models. Credentials are handled by the backend.",
  },
  {
    id: "local",
    title: "Your local machine",
    description: "Use your hardware. No model downloads are started here.",
  },
];
const empty: Snapshot = { providers: [], workers: [], models: [] };
const displayLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

// Same-origin only. Never display server error bodies: they may contain credentials.
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: signal ?? AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    if ([404, 405, 501, 503].includes(response.status))
      throw new Error(
        "This connection endpoint is unavailable. Ask the backend administrator to enable it; nothing is shown as connected.",
      );
    if ([401, 403].includes(response.status))
      throw new Error(
        "Connection permission denied. Sign in or ask the backend administrator for access.",
      );
    throw new Error(
      `The backend rejected the request (HTTP ${response.status}). Check server configuration without sharing credentials.`,
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "The connection endpoint is unavailable: the backend did not return JSON.",
    );
  return response.json();
}
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
const text = (v: unknown) => (typeof v === "string" ? v : "");
function readModels(value: unknown): Model[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const m = object(entry);
    if (!text(m.id)) return [];
    const p = object(m.pricing);
    const price = (n: unknown): n is string | number =>
      typeof n === "string" || typeof n === "number";
    return [
      {
        id: text(m.id),
        name: text(m.name) || text(m.id),
        provider: text(m.provider),
        freeSource: text(m.freeSource),
        ...(price(p.prompt) && price(p.completion)
          ? { pricing: { prompt: p.prompt, completion: p.completion } }
          : {}),
      },
    ];
  });
}
function readSnapshot(value: unknown): Snapshot {
  const s = object(value);
  if (
    !Array.isArray(s.providers) ||
    !Array.isArray(s.workers) ||
    !Array.isArray(s.models)
  )
    throw new Error(
      "Provider status is unavailable: the backend returned an unsupported status format.",
    );
  return {
    providers: s.providers.flatMap((entry) => {
      const p = object(entry);
      return text(p.id) && text(p.provider)
        ? [
            {
              id: text(p.id),
              provider: text(p.provider),
              name: text(p.name) || text(p.provider),
              status: text(p.status) || "unknown",
            },
          ]
        : [];
    }),
    workers: s.workers.flatMap((entry) => {
      const w = object(entry);
      return text(w.id)
        ? [
            {
              id: text(w.id),
              name: text(w.name) || "Worker",
              status: text(w.status) || "unknown",
              models: Array.isArray(w.models)
                ? w.models.filter((m): m is string => typeof m === "string")
                : [],
            },
          ]
        : [];
    }),
    models: readModels(s.models),
    defaultModel: text(s.defaultModel),
  };
}
function zeroPrice(model: Model) {
  if (model.freeSource === "zero-priced") return true;
  const pricing = model.pricing;
  return (
    !!pricing &&
    String(pricing.prompt).trim() !== "" &&
    String(pricing.completion).trim() !== "" &&
    Number(pricing.prompt) === 0 &&
    Number(pricing.completion) === 0
  );
}

function ConnectionForm({
  provider,
  onSubmit,
  busy,
}: {
  provider: Provider;
  onSubmit: (path: string, body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const needsKey =
    provider.category === "api" &&
    !["bedrock", "openrouter"].includes(provider.id);
  return (
    <form
      ref={formRef}
      className="pc-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        const payload: Record<string, unknown> = {
          provider: provider.id,
          kind: provider.category,
        };
        for (const [key, value] of data.entries())
          if (typeof value === "string" && value.trim())
            payload[key] = value.trim();
        // Clear secrets immediately, even if the network request is rejected or times out.
        event.currentTarget
          .querySelectorAll<HTMLInputElement>('input[type="password"]')
          .forEach((input) => {
            input.value = "";
          });
        if (["openrouter", "ollama"].includes(provider.id)) {
          void onSubmit("/providers/test", { providerId: provider.id });
        } else {
          void onSubmit("/providers/connections", payload);
        }
      }}
    >
      <h3>Connect {provider.name}</h3>
      {provider.id === "openrouter" && (
        <p>
          Configure OPENROUTER_API_KEY in the backend's private .env or secret
          manager and restart the backend. This form only verifies the
          configured connection. Never paste that key into the browser or a
          workflow prompt.
        </p>
      )}
      {needsKey && (
        <label>
          API key
          <input
            name="apiKey"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-warning`}
          />
        </label>
      )}
      {provider.endpoint && (
        <label>
          Trusted API base URL
          <input
            name="baseUrl"
            type="url"
            required
            placeholder="https://your-provider.example/v1"
            autoComplete="off"
          />
        </label>
      )}
      {provider.id === "azure" && (
        <>
          <label>
            Deployment name
            <input name="deployment" required />
          </label>
          <label>
            API version
            <input
              name="apiVersion"
              required
              placeholder="Your resource's supported API version"
            />
          </label>
        </>
      )}
      {provider.id === "bedrock" && (
        <>
          <label>
            AWS region
            <input name="region" required placeholder="us-east-1" />
          </label>
          <p>
            Configure AWS credentials on the server using its credential chain.
            Do not enter AWS access keys here.
          </p>
        </>
      )}
      {provider.category === "coding" && (
        <>
          <label>
            Backend adapter ID
            <input
              name="adapterId"
              required
              placeholder={
                provider.id === "custom-acp"
                  ? "Configured ACP adapter ID"
                  : provider.id
              }
            />
          </label>
          <p>
            Install and authenticate the agent on the backend machine first. The
            server must explicitly allow this adapter; this form never executes
            arbitrary shell commands.
          </p>
        </>
      )}
      {provider.category === "local" && (
        <p>
          The backend checks its own loopback service:{" "}
          {provider.id === "ollama" ? "127.0.0.1:11434" : "127.0.0.1:1234"}. A
          browser on another machine cannot connect that machine's models this
          way. Register an outbound worker below.
        </p>
      )}
      <p id={`${id}-warning`} className="pc-warning">
        <ShieldCheck size={16} />
        {needsKey
          ? "Sent once to the same-origin backend and cleared immediately. Never saved in browser storage or shown after submit. Use a trusted local backend or HTTPS; provider usage may incur charges."
          : "Credentials stay on the backend. Connection is confirmed only by a fresh backend status check."}
      </p>
      {provider.endpoint && (
        <p>
          The server must validate and allowlist this destination before sending
          credentials. Never use an untrusted URL.
        </p>
      )}
      <button className="pc-primary" type="submit" disabled={busy}>
        {busy ? (
          <Loader2 size={15} className="pc-spin" />
        ) : (
          <KeyRound size={15} />
        )}{" "}
        Verify connection
      </button>
    </form>
  );
}

export default function ProviderConnections({
  onClose,
  onChanged,
}: ProviderConnectionsProps) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const mounted = useRef(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Provider | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [catalog, setCatalog] = useState<Model[] | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [onlyZero, setOnlyZero] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const next = readSnapshot(
        await request("/providers", "GET", undefined, signal),
      );
      if (!mounted.current || signal?.aborted) return false;
      setSnapshot(next);
      setAvailable(true);
      setError("");
      return true;
    } catch (cause) {
      if (!mounted.current || signal?.aborted) return false;
      setAvailable(false);
      setSnapshot(empty);
      setError(
        cause instanceof Error && cause.name !== "TimeoutError"
          ? cause.message
          : "Provider status could not be checked. No connection is assumed.",
      );
      return false;
    } finally {
      if (mounted.current && !signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    void refresh(controller.signal).finally(() => {
      clearTimeout(timer);
      if (mounted.current && controller.signal.aborted) {
        setLoading(false);
        setError("Provider status timed out. Check the backend and refresh.");
      }
    });
    return () => {
      mounted.current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!onClose) return;
    const before = document.activeElement as HTMLElement | null;
    root.current
      ?.querySelector<HTMLInputElement>('input[type="search"]')
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current?.();
      if (event.key !== "Tab") return;
      const controls = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [!!onClose]);

  const mutate = async (path: string, body: Record<string, unknown>) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await request(path, "POST", body);
      if (!mounted.current) return;
      if (await refresh()) {
        setMessage(
          "Backend accepted the request. Current connection and model status is shown below.",
        );
        onChanged?.();
      }
    } catch (cause) {
      if (!mounted.current) return;
      // A failed response can follow a completed write. Read state; never auto-retry it.
      await refresh();
      if (mounted.current)
        setError(
          cause instanceof Error && ["Error"].includes(cause.name)
            ? cause.message
            : "The result could not be confirmed. Refresh and inspect status before submitting again. Secret inputs have been cleared.",
        );
    } finally {
      mutationInFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const discover = async () => {
    if (catalogBusy) return;
    setCatalogBusy(true);
    setCatalogError("");
    try {
      const result = object(await request("/providers/catalog"));
      const openrouter = Array.isArray(result.providers)
        ? result.providers
            .map(object)
            .find((provider) => provider.id === "openrouter")
        : undefined;
      if (
        !openrouter ||
        !Array.isArray(openrouter.models) ||
        openrouter.connected !== true
      )
        throw new Error(
          "OpenRouter model discovery is unavailable. The backend could not verify a live catalog connection.",
        );
      if (mounted.current) setCatalog(readModels(openrouter.models));
    } catch (cause) {
      if (mounted.current) {
        setCatalog(null);
        setCatalogError(
          cause instanceof Error && cause.name === "Error"
            ? cause.message
            : "OpenRouter model discovery could not be reached.",
        );
      }
    } finally {
      if (mounted.current) setCatalogBusy(false);
    }
  };
  const matches = (value: string) =>
    value.toLowerCase().includes(query.trim().toLowerCase());
  const visibleModels = (catalog ?? []).filter(
    (model) =>
      (!onlyZero || zeroPrice(model)) &&
      `${model.name} ${model.id}`
        .toLowerCase()
        .includes(modelQuery.trim().toLowerCase()),
  );

  return (
    <div
      className={`provider-connections ${onClose ? "pc-overlay" : "pc-inline"}`}
    >
      <section
        className="pc-dialog"
        ref={root}
        role={onClose ? "dialog" : "region"}
        aria-modal={onClose ? true : undefined}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <header className="pc-header">
          <div>
            <span className="pc-eyebrow">POWER YOUR ORCHESTRA</span>
            <h2 id={`${id}-title`}>Connect a provider</h2>
            <p id={`${id}-description`}>
              Choose your agents, cloud models, or local compute.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              className="pc-icon-button"
              onClick={onClose}
              aria-label="Close provider connections"
            >
              <X size={20} />
            </button>
          )}
        </header>
        <div className="pc-body">
          <label className="pc-search">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search providers, agents, or local models…"
              aria-label="Search providers and connections"
            />
          </label>
          <div className="pc-status-bar" role="status" aria-live="polite">
            <span className="pc-status-copy">
              <span
                className={`pc-status-dot ${loading ? "is-loading" : available ? "is-ready" : "is-offline"}`}
                aria-hidden="true"
              />
              {loading
                ? "Checking backend…"
                : available
                  ? "Backend status loaded"
                  : "Connections unavailable"}
            </span>
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} /> Refresh status
            </button>
          </div>
          {error && (
            <p className="pc-alert" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="pc-notice" role="status">
              {message}
            </p>
          )}
          {categories.map((category) => {
            const list = providers.filter(
              (provider) =>
                provider.category === category.id &&
                matches(
                  `${provider.name} ${provider.description} ${category.title}`,
                ),
            );
            if (!list.length) return null;
            return (
              <section
                className="pc-section"
                key={category.id}
                aria-labelledby={`${id}-${category.id}`}
              >
                <div className="pc-section-heading">
                  {category.id === "coding" ? (
                    <Terminal size={18} />
                  ) : category.id === "api" ? (
                    <KeyRound size={18} />
                  ) : (
                    <Monitor size={18} />
                  )}
                  <div>
                    <h3 id={`${id}-${category.id}`}>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>
                </div>
                <div className="pc-grid">
                  {list.map((provider) => {
                    const connection = available
                      ? snapshot.providers.find(
                          (entry) => entry.provider === provider.id,
                        )
                      : undefined;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        className={`pc-card ${selected?.id === provider.id ? "is-selected" : ""}`}
                        aria-expanded={selected?.id === provider.id}
                        aria-controls={
                          selected?.id === provider.id
                            ? `${id}-form`
                            : undefined
                        }
                        disabled={busy}
                        onClick={() => {
                          setSelected(
                            selected?.id === provider.id ? null : provider,
                          );
                          setMessage("");
                        }}
                      >
                        <span
                          className={`pc-mark pc-mark-${provider.category}`}
                          aria-hidden="true"
                        >
                          {provider.mark}
                        </span>
                        <span className="pc-card-copy">
                          <strong>{provider.name}</strong>
                          <span>{provider.description}</span>
                          <small
                            className={
                              connection?.status === "connected"
                                ? "pc-connected"
                                : ""
                            }
                          >
                            {connection
                              ? displayLabel(connection.status)
                              : available
                                ? "Not connected"
                                : "Status unavailable"}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!providers.some((provider) =>
            matches(
              `${provider.name} ${provider.description} ${categories.find((category) => category.id === provider.category)?.title}`,
            ),
          ) && (
            <p className="pc-empty">
              No providers match “{query}”. Try another name.
            </p>
          )}
          {selected && (
            <div id={`${id}-form`} className="pc-setup">
              <div className="pc-setup-heading">
                <span>CONNECTION SETUP</span>
                <button
                  type="button"
                  className="pc-icon-button"
                  aria-label="Close connection setup"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  <X size={17} />
                </button>
              </div>
              <ConnectionForm
                key={selected.id}
                provider={selected}
                onSubmit={mutate}
                busy={busy}
              />
            </div>
          )}
          <section
            className="pc-section pc-discovery"
            aria-labelledby={`${id}-discovery`}
          >
            <div className="pc-section-heading">
              <Bot size={18} />
              <div>
                <h3 id={`${id}-discovery`}>OpenRouter model discovery</h3>
                <p>
                  Live catalog and pricing from the backend. Discovery does not
                  connect a provider.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void discover()}
                disabled={catalogBusy}
              >
                {catalogBusy ? (
                  <Loader2 size={14} className="pc-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}{" "}
                Discover models
              </button>
            </div>
            <p className="pc-muted">
              Free when provider reports zero pricing for both input and output.
              Availability, rate limits, and pricing can change; no guaranteed
              free access.
            </p>
            {catalogError && (
              <p className="pc-alert" role="alert">
                {catalogError}
              </p>
            )}
            {catalog !== null && (
              <>
                <div className="pc-model-filters">
                  <label className="pc-search">
                    <Search size={15} />
                    <input
                      type="search"
                      aria-label="Search OpenRouter models"
                      placeholder="Search discovered models"
                      value={modelQuery}
                      onChange={(event) => setModelQuery(event.target.value)}
                    />
                  </label>
                  <label className="pc-checkbox">
                    <input
                      type="checkbox"
                      checked={onlyZero}
                      onChange={(event) => setOnlyZero(event.target.checked)}
                    />{" "}
                    Provider-reported zero pricing
                  </label>
                </div>
                <ul className="pc-model-list">
                  {visibleModels.map((model) => (
                    <li key={model.id}>
                      <div>
                        <strong>{model.name}</strong>
                        <code>{model.id}</code>
                      </div>
                      <span>
                        {zeroPrice(model)
                          ? "Free when provider reports zero pricing"
                          : model.pricing
                            ? `Input ${model.pricing.prompt} · output ${model.pricing.completion} USD/token (reported)`
                            : model.freeSource === "catalog-tag"
                              ? "Provider labels this model free; zero pricing not verified"
                              : "Pricing not reported"}
                      </span>
                    </li>
                  ))}
                </ul>
                {!visibleModels.length && (
                  <p className="pc-empty">
                    No discovered models match these filters.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="pc-section" aria-labelledby={`${id}-connected`}>
            <div className="pc-section-heading">
              <Cpu size={18} />
              <div>
                <h3 id={`${id}-connected`}>Connected workers & models</h3>
                <p>Only current backend-reported connections appear here.</p>
              </div>
            </div>
            {!available ? (
              <p className="pc-empty">
                Backend unavailable. Worker and model status cannot be verified.
              </p>
            ) : (
              <>
                <ul className="pc-worker-list">
                  {snapshot.workers
                    .filter((worker) =>
                      matches(`${worker.name} ${worker.models.join(" ")}`),
                    )
                    .map((worker) => (
                      <li key={worker.id}>
                        <Monitor size={18} />
                        <div>
                          <strong>{worker.name}</strong>
                          <span>
                            {worker.models.length
                              ? worker.models.join(" · ")
                              : "No models reported"}
                          </span>
                        </div>
                        <small
                          className={
                            worker.status === "online" ? "pc-connected" : ""
                          }
                        >
                          {displayLabel(worker.status)}
                        </small>
                      </li>
                    ))}
                </ul>
                {!snapshot.workers.length && (
                  <p className="pc-empty">No workers registered.</p>
                )}
                <label className="pc-route">
                  Default orchestra model
                  <select
                    value={snapshot.defaultModel ?? ""}
                    disabled={busy || !snapshot.models.length}
                    onChange={(event) =>
                      void mutate("/providers/routing", {
                        model: event.target.value,
                      })
                    }
                  >
                    <option value="">Choose a backend-available model</option>
                    {snapshot.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                        {model.provider ? ` · ${model.provider}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {!snapshot.models.length && (
                  <p className="pc-muted">
                    No available models reported. Connect and verify a provider
                    or worker first.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="pc-worker-guide" aria-labelledby={`${id}-worker`}>
            <h3 id={`${id}-worker`}>Connect another machine safely</h3>
            <ol>
              <li>
                Install{" "}
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ollama
                </a>{" "}
                on the worker machine and explicitly install a model you want to
                use.
              </li>
              <li>
                Keep Ollama bound to <code>127.0.0.1:11434</code>. Do not expose
                the raw port, open it in your firewall, or forward it through
                your router.
              </li>
              <li>
                Obtain a scoped worker token from your backend administrator.
                Configure the approved worker client to initiate an
                authenticated outbound connection to this backend.
              </li>
              <li>
                Register the token below. Registration alone is not proof the
                worker is online; check its heartbeat and advertised models
                above.
              </li>
            </ol>
            <form
              className="pc-worker-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                const data = new FormData(event.currentTarget);
                const payload = {
                  name: String(data.get("name") ?? "").trim(),
                  token: String(data.get("token") ?? "").trim(),
                };
                event.currentTarget.querySelector<HTMLInputElement>(
                  'input[type="password"]',
                )!.value = "";
                void mutate("/workers/register", payload);
              }}
            >
              <label>
                Worker name
                <input
                  name="name"
                  required
                  maxLength={100}
                  placeholder="My GPU workstation"
                />
              </label>
              <label>
                Scoped worker token
                <input
                  name="token"
                  type="password"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={`${id}-token-note`}
                />
              </label>
              <button type="submit" className="pc-primary" disabled={busy}>
                Register outbound worker
              </button>
            </form>
            <p id={`${id}-token-note`} className="pc-muted">
              Token is submitted once and immediately cleared. Never put it in a
              prompt, URL, or public repository. If registration is unavailable,
              ask the administrator to enable authenticated worker support.
            </p>
          </section>
        </div>
        <footer className="pc-footer">
          <ShieldCheck size={16} />
          <span>
            Secrets stay server-side. Model messages are not proof of a
            connected service.
          </span>
          {onClose && (
            <button type="button" onClick={onClose}>
              Done
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

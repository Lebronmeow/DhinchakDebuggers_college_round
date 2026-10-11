import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { api } from "../api";
import type { AgentRun, RunStatus, ToolReceipt } from "../orchestra-types";
import "./orchestra-console.css";

export type OrchestraConsoleProps = {
  onChange?: () => void;
  onApprovals?: () => void;
  onAgentSelect?: (role: string) => void;
  selectedAgent?: string | null;
  compact?: boolean;
};

type OrchestraResponse = { runs: AgentRun[]; activeRunId: string | null };
type AiStatus = { available?: boolean; models?: string[]; error?: string };
type RoutedModel = {
  id: string;
  name: string;
  provider: string;
  free?: boolean;
  freeSource?: string;
  pricing?: { prompt: string | number; completion: string | number };
};
const ACTIVE: RunStatus[] = [
  "queued",
  "planning",
  "running",
  "awaiting_approval",
];
const examples = [
  "Create a landing page for a spring workshop and request publication.",
  "Review our contacts and identify qualified leads from the latest imports.",
  "Set up a webinar for next month and register the existing interested contacts.",
];

const date = (value: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
};
const displayLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
const statusLabel = (status: RunStatus) =>
  status === "awaiting_approval" ? "Awaiting approval" : displayLabel(status);
const isActive = (run?: AgentRun | null) =>
  !!run && ACTIVE.includes(run.status);

export const DEFAULT_EMPLOYEE_MODELS: Record<string, string> = {
  Coordinator: "inclusionai/ling-3.1-flash",
  Website: "liquid/lfm-2.5-2.6b:free",
  Growth: "thinkingmachines/inkling:free",
  Events: "dots-studio/dots-3-note-preview:free",
  CRM: "google/gemma-4-31b-it:free",
  Billing: "poolside/laguna-s-2.1:free",
  Review: "cohere/north-mini-code:free",
};

export function useOrchestra() {
  return {
    get: () => api<OrchestraResponse>("/orchestra"),
    start: (prompt: string, model: string) =>
      api<AgentRun>("/orchestra/runs", "POST", { prompt, model }),
  };
}

function Badge({ status }: { status: RunStatus }) {
  return (
    <span className={`oc-badge oc-status-${status}`}>
      {statusLabel(status)}
    </span>
  );
}

function Receipt({ receipt }: { receipt: ToolReceipt }) {
  return (
    <article className={`oc-receipt oc-receipt-${receipt.status}`}>
      <div className="oc-receipt-head">
        <ShieldCheck size={15} />
        <strong>{displayLabel(receipt.tool)}</strong>
        <span>{displayLabel(receipt.status)}</span>
      </div>
      <p>{receipt.message}</p>
      <div className="oc-receipt-meta">
        {receipt.recordId && <code>record:{receipt.recordId}</code>}
        {receipt.url &&
          receipt.status === "succeeded" &&
          /^(https?:\/\/|\/p\/[a-z0-9-]+)/i.test(receipt.url) && (
            <a href={receipt.url} target="_blank" rel="noreferrer">
              {receipt.tool === "create_page"
                ? "Page URL (requires publication)"
                : "Open verified result"}{" "}
              <ExternalLink size={12} />
            </a>
          )}
        {receipt.approvalId && <code>approval:{receipt.approvalId}</code>}
      </div>
      {receipt.data !== undefined && (
        <details>
          <summary>Verified output</summary>
          <pre>{JSON.stringify(receipt.data, null, 2)}</pre>
        </details>
      )}
    </article>
  );
}

function MessageThread({
  run,
  selectedAgent,
}: {
  run: AgentRun;
  selectedAgent?: string | null;
}) {
  const messages = selectedAgent
    ? run.messages.filter(
        (message) =>
          message.from === selectedAgent || message.to === selectedAgent,
      )
    : run.messages;
  return (
    <div className="oc-thread">
      {messages.length === 0 && (
        <p className="oc-muted">
          The orchestra will publish public agent messages here as it works.
        </p>
      )}
      {messages.map((message) => (
        <article
          className={`oc-message oc-message-${message.kind}`}
          key={message.id}
        >
          <div className="oc-message-route">
            <span className="oc-agent-from">
              <strong>{message.from}</strong>
              {run.agentModels?.[message.from] && (
                <span className="oc-role-model-tag">
                  {run.agentProviders?.[message.from] === "openai-compatible"
                    ? "Friend GPU · "
                    : run.agentProviders?.[message.from] === "ollama"
                      ? "Local GPU · "
                      : ""}
                  {run.agentModels[message.from].replace(":free", "")}
                </span>
              )}
            </span>
            <ArrowUpRight size={13} />
            <span className="oc-agent-to">
              <strong>{message.to}</strong>
              {run.agentModels?.[message.to] && (
                <span className="oc-role-model-tag">
                  {run.agentProviders?.[message.to] === "openai-compatible"
                    ? "Friend GPU · "
                    : run.agentProviders?.[message.to] === "ollama"
                      ? "Local GPU · "
                      : ""}
                  {run.agentModels[message.to].replace(":free", "")}
                </span>
              )}
            </span>
            <time>{date(message.createdAt)}</time>
          </div>
          <p>{message.text}</p>
          {message.kind === "message" && (
            <small>Model message · confirm claims against tool receipts</small>
          )}
          {message.kind === "delegation" && (
            <small>Delegated instruction</small>
          )}
          {message.kind === "tool" && (
            <small>Tool event · see verified receipt below</small>
          )}
        </article>
      ))}
    </div>
  );
}

export default function OrchestraConsole({
  onChange,
  onApprovals,
  onAgentSelect,
  selectedAgent,
  compact,
}: OrchestraConsoleProps) {
  const consoleId = useId().replace(/:/g, "");
  const titleId = `${consoleId}-title`;
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [routedModels, setRoutedModels] = useState<RoutedModel[]>([]);
  const [model, setModel] = useState("");
  const [providerId, setProviderId] = useState("openrouter");
  const [autoApprove, setAutoApprove] = useState(false);
  const [employeeModels, setEmployeeModels] = useState<Record<string, string>>(
    DEFAULT_EMPLOYEE_MODELS,
  );
  const [aiError, setAiError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const pollInFlight = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRun = runs.find((run) => run.id === selectedId) || runs[0];

  const refresh = useCallback(async () => {
    if (pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const state = await api<OrchestraResponse>("/orchestra");
      if (!mounted.current) return;
      const nextRuns = [...(state.runs || [])].sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
      );
      setRuns(nextRuns);
      setActiveRunId(state.activeRunId);
      setSelectedId((id) =>
        id && nextRuns.some((run) => run.id === id)
          ? id
          : nextRuns[0]?.id || null,
      );
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load orchestra runs",
        );
    } finally {
      pollInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    void Promise.all([
      api<AiStatus>("/ai/status"),
      api<{ models: RoutedModel[] }>("/providers"),
    ])
      .then(([status, catalog]) => {
        if (!mounted.current) return;
        const installed = status.models || [];
        setModels(installed);
        const discovered = (catalog.models || []).filter(
          (m) =>
            !m.id.toLowerCase().includes("nvidia") &&
            !m.name.toLowerCase().includes("nvidia") &&
            m.id !== "openrouter/free",
        );
        setRoutedModels(discovered);
        const openRouterModels = discovered.filter(
          (m) => m.provider === "openrouter",
        );
        if (installed.length) {
          setProviderId("ollama");
          setModel(installed[0]);
        } else if (openRouterModels.length) {
          setProviderId("openrouter");
          const defaultModel =
            openRouterModels.find((m) => m.id === "inclusionai/ling-3.1-flash")
              ?.id || openRouterModels[0].id;
          setModel(defaultModel);
        } else if (discovered.length) {
          setProviderId(discovered[0].provider);
          setModel(discovered[0].id);
        }
        setAiError(
          status.available === false
            ? status.error || "Local model service unavailable"
            : "",
        );
      })
      .catch(
        (cause) =>
          mounted.current &&
          setAiError(
            cause instanceof Error
              ? cause.message
              : "Unable to read model status",
          ),
      );
    return () => {
      mounted.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [refresh]);

  useEffect(() => {
    const run =
      runs.find((item) => item.id === activeRunId) ||
      runs.find((item) => item.id === selectedId);
    if (!isActive(run)) return;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(() => {
      void refresh();
    }, 1500);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [runs, selectedId, activeRunId, refresh]);

  const mutate = async (path: string, method: "POST" = "POST") => {
    if (!selectedRun || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<AgentRun>(path, method);
      if (!mounted.current) return;
      setRuns((current) => [
        updated,
        ...current.filter((run) => run.id !== updated.id),
      ]);
      setSelectedId(updated.id);
      await refresh();
      onChange?.();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The command could not be updated",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || !model || busy) return;
    setBusy(true);
    setError("");
    try {
      const agentProviders: Record<string, string> = {};
      for (const [role, modelId] of Object.entries(employeeModels)) {
        const found = routedModels.find((m) => m.id === modelId);
        if (found?.provider) {
          agentProviders[role] = found.provider;
        } else {
          agentProviders[role] = providerId;
        }
      }
      const hasCustomEmployees = Object.entries(employeeModels).some(
        ([role, m]) => m !== (DEFAULT_EMPLOYEE_MODELS[role] || model),
      );
      const request: Record<string, unknown> = {
        prompt: text,
        model,
        ...(autoApprove ? { autoApprove: true } : {}),
        ...(providerId !== "ollama" || hasCustomEmployees
          ? {
              providerId,
              agentModels: employeeModels,
              agentProviders,
            }
          : {}),
      };
      const run = await api<AgentRun>("/orchestra/runs", "POST", request);
      if (!mounted.current) return;
      setRuns((current) => [
        run,
        ...current.filter((item) => item.id !== run.id),
      ]);
      setSelectedId(run.id);
      setActiveRunId(run.id);
      await refresh();
      onChange?.();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The command could not start",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const task = selectedRun?.tasks.find(
    (item) => item.status === "running" || item.status === "pending",
  );
  const pending =
    selectedRun?.receipts.filter(
      (receipt) => receipt.status === "awaiting_approval",
    ) || [];
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [runs],
  );

  return (
    <section
      className={`orchestra-console ${compact ? "is-compact" : ""}`}
      aria-labelledby={titleId}
    >
      <header className="oc-header">
        <div>
          <span className="oc-kicker">Live orchestra</span>
          <h1 id={titleId}>Command console</h1>
          <p>Give the installed local model a real business task.</p>
        </div>
        <div className="oc-model-state">
          <Bot size={16} />
          <span>
            {models.length
              ? `${models.length} installed model${models.length === 1 ? "" : "s"}`
              : "No installed models"}
          </span>
        </div>
      </header>
      <form className="oc-command" onSubmit={submit} aria-label="New command">
        <label className="oc-model">
          Model
          <select
            value={model}
            onChange={(event) => {
              const next = event.target.value;
              setModel(next);
              const routed = routedModels.find((item) => item.id === next);
              if (routed) setProviderId(routed.provider);
            }}
            disabled={busy || (!models.length && !routedModels.length)}
          >
            <option value="">Choose model</option>
            {routedModels.length
              ? routedModels
                  .filter((item) => !item.id.toLowerCase().includes("nvidia"))
                  .map((item) => (
                    <option
                      key={`${item.provider}:${item.id}`}
                      value={item.id}
                      data-provider={item.provider}
                    >
                      {item.provider} · {item.name}
                      {item.free ? " · catalog free" : ""}
                    </option>
                  ))
              : models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
          </select>
          {routedModels.length > 0 && (
            <small className="oc-model-note">
              Provider: {providerId}. Free labels reflect the current provider
              catalog and can change.
            </small>
          )}
        </label>
        <label className="oc-prompt">
          Command
          <textarea
            rows={compact ? 2 : 3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the outcome you want the orchestra to coordinate…"
            disabled={busy}
          />
        </label>
        <div
          className="oc-employee-models"
          aria-labelledby={`${consoleId}-employee-models-title`}
        >
          <div className="oc-employee-models-head">
            <strong id={`${consoleId}-employee-models-title`}>
              Employee model assignments
            </strong>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {models.length > 0 && (
                <button
                  type="button"
                  className="oc-btn-ghost"
                  onClick={() => {
                    const localAll: Record<string, string> = {};
                    for (const role of Object.keys(DEFAULT_EMPLOYEE_MODELS)) {
                      localAll[role] = models[0];
                    }
                    setEmployeeModels(localAll);
                  }}
                >
                  Use local model for all
                </button>
              )}
              <button
                type="button"
                className="oc-btn-ghost"
                onClick={() => setEmployeeModels(DEFAULT_EMPLOYEE_MODELS)}
              >
                Reset assignments
              </button>
            </div>
          </div>
          <div className="oc-employee-grid">
            {Object.entries(employeeModels).map(([role, assignedModel]) => (
              <div key={role} className="oc-employee-card">
                <span className="oc-employee-role">{role}</span>
                <select
                  aria-label={`${role} model`}
                  value={assignedModel}
                  onChange={(e) =>
                    setEmployeeModels((prev) => ({
                      ...prev,
                      [role]: e.target.value,
                    }))
                  }
                  disabled={busy}
                >
                  {routedModels
                    .filter(
                      (m) =>
                        (m.free ||
                          m.provider === "ollama" ||
                          m.provider === "openai-compatible") &&
                        !m.id.toLowerCase().includes("nvidia"),
                    )
                    .map((m) => {
                      const prefix =
                        m.provider === "ollama"
                          ? "[Local GPU] "
                          : m.provider === "openai-compatible"
                            ? "[Friend GPU] "
                            : "";
                      return (
                        <option key={`${m.provider}-${m.id}`} value={m.id}>
                          {prefix}
                          {m.name || m.id}
                        </option>
                      );
                    })}
                  {!routedModels.some((m) => m.id === assignedModel) && (
                    <option value={assignedModel}>{assignedModel}</option>
                  )}
                </select>
              </div>
            ))}
          </div>
        </div>
        <label className="oc-auto-approve-toggle">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            disabled={busy}
          />
          <span>Auto-approve all actions</span>
        </label>
        <button
          className="oc-run"
          type="submit"
          disabled={busy || !model || !prompt.trim()}
        >
          {busy ? (
            <Loader2 className="oc-spin" size={16} />
          ) : (
            <Send size={16} />
          )}{" "}
          Run command
        </button>
        {aiError && (
          <p className="oc-error">
            <CircleAlert size={15} />
            {aiError}
          </p>
        )}
      </form>
      {!runs.length ? (
        <div className="oc-empty">
          <Terminal size={28} />
          <h2>No commands yet</h2>
          <p>
            Start with a concrete outcome. The coordinator will delegate to
            specialist agents and show only their public messages and verified
            actions.
          </p>
          <div className="oc-examples">
            {examples.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setPrompt(item)}
                disabled={busy}
              >
                {item}
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="oc-layout">
          <aside className="oc-history">
            <div className="oc-panel-title">
              Command history <span>{runs.length}</span>
            </div>
            {sortedRuns.map((run) => (
              <button
                type="button"
                key={run.id}
                className={`oc-history-item ${run.id === selectedRun?.id ? "selected" : ""}`}
                onClick={() => setSelectedId(run.id)}
              >
                <strong>{run.title || run.prompt}</strong>
                <span>
                  <Badge status={run.status} />{" "}
                  <time>{date(run.updatedAt)}</time>
                </span>
              </button>
            ))}
          </aside>
          {selectedRun && (
            <div
              className="oc-detail"
              role="region"
              aria-labelledby={`${consoleId}-detail-title`}
            >
              <div className="oc-detail-head">
                <div>
                  <span className="oc-kicker">Selected command</span>
                  <h2 id={`${consoleId}-detail-title`}>
                    {selectedRun.title || selectedRun.prompt}
                  </h2>
                  <p>{selectedRun.prompt}</p>
                </div>
                <Badge status={selectedRun.status} />
              </div>
              {error && (
                <div className="oc-error oc-error-box">
                  <CircleAlert size={16} />
                  {error}
                </div>
              )}
              <div className="oc-actions">
                {isActive(selectedRun) &&
                  selectedRun.status !== "awaiting_approval" && (
                    <button
                      type="button"
                      onClick={() =>
                        mutate(`/orchestra/runs/${selectedRun.id}/cancel`)
                      }
                      disabled={busy}
                    >
                      <Square size={14} /> Cancel
                    </button>
                  )}
                {selectedRun.status === "awaiting_approval" && (
                  <>
                    <button
                      type="button"
                      className="oc-btn-approve-all"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("/approvals/approve-all", "POST", {});
                          await mutate(
                            `/orchestra/runs/${selectedRun.id}/resume`,
                          );
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    >
                      <CheckCheck size={14} /> Approve all &amp; resume
                    </button>
                    <button type="button" onClick={() => onApprovals?.()}>
                      <ShieldCheck size={14} /> Review approvals
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mutate(`/orchestra/runs/${selectedRun.id}/resume`)
                      }
                      disabled={busy || pending.length === 0}
                    >
                      <RotateCcw size={14} /> Resume after review
                    </button>
                  </>
                )}
                {selectedRun.status === "interrupted" && (
                  <button
                    type="button"
                    onClick={() =>
                      mutate(`/orchestra/runs/${selectedRun.id}/resume`)
                    }
                    disabled={busy}
                  >
                    <Play size={14} /> Resume
                  </button>
                )}
                <span className="oc-updated">
                  <Clock3 size={13} /> Updated {date(selectedRun.updatedAt)}
                </span>
              </div>
              {task && (
                <div className="oc-current">
                  <Loader2 className="oc-spin" size={16} />
                  <div>
                    <strong>Current task · {task.agent}</strong>
                    <p>{task.instruction}</p>
                  </div>
                  {onAgentSelect && (
                    <button
                      type="button"
                      onClick={() => onAgentSelect(task.agent)}
                    >
                      Focus agent
                    </button>
                  )}
                </div>
              )}
              <section className="oc-section">
                <h3>
                  <Pause size={15} /> Public execution trace
                </h3>
                <MessageThread
                  run={selectedRun}
                  selectedAgent={selectedAgent}
                />
              </section>
              {!!selectedRun.receipts.length && (
                <section className="oc-section">
                  <h3>
                    <Check size={15} /> Verified tool receipts{" "}
                    <span>{selectedRun.receipts.length}</span>
                  </h3>
                  <div className="oc-receipts">
                    {selectedRun.receipts.map((receipt) => (
                      <Receipt key={receipt.id} receipt={receipt} />
                    ))}
                  </div>
                </section>
              )}
              {!!selectedRun.error && (
                <div className="oc-failure">
                  <X size={16} />
                  <div>
                    <strong>Execution stopped</strong>
                    <p>{selectedRun.error}</p>
                  </div>
                </div>
              )}
              {!!selectedRun.summary && (
                <div className="oc-summary">
                  <strong>Run summary</strong>
                  <p>{selectedRun.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Blocks,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Command,
  Cpu,
  Globe2,
  LayoutDashboard,
  Loader2,
  Mail,
  Menu,
  Monitor,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import PixelOffice from "./components/PixelOffice";
import Modules from "./components/Modules";
import { api } from "./api";
import type { NexusState, View } from "./types";
import "./styles.css";

const navigation: {
  id: View;
  label: string;
  icon: typeof Users;
  group: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "WORKSPACE",
  },
  { id: "office", label: "AI office", icon: Blocks, group: "WORKSPACE" },
  { id: "crm", label: "Contacts", icon: Users, group: "BUSINESS" },
  { id: "websites", label: "Website studio", icon: Globe2, group: "BUSINESS" },
  { id: "campaigns", label: "Campaigns", icon: Mail, group: "BUSINESS" },
  { id: "webinars", label: "Webinars", icon: Video, group: "BUSINESS" },
  { id: "billing", label: "Billing", icon: Wallet, group: "BUSINESS" },
  { id: "analytics", label: "Analytics", icon: BarChart3, group: "BUSINESS" },
  { id: "approvals", label: "Approvals", icon: ShieldCheck, group: "CONTROL" },
  { id: "settings", label: "Connections", icon: Settings2, group: "CONTROL" },
];
const displayStatus = (status: string) => status.replaceAll("_", " ");
const time = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
type Plan = {
  title: string;
  headline: string;
  description: string;
  emailSubject: string;
  emailBody: string;
  source?: string;
  model?: string;
};

function App() {
  const [view, setView] = useState<View>("overview");
  const [state, setState] = useState<NexusState | null>(null);
  const [error, setError] = useState("");
  const [planner, setPlanner] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = useCallback((message: string, isError = false) => {
    setToast({ message, error: isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const refresh = useCallback(async () => {
    try {
      setState(await api<NexusState>("/state"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to Nexus");
      throw e;
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    const interval = setInterval(() => void refresh().catch(() => {}), 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPlanner((p) => !p);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  const navigate = (next: View) => {
    setView(next);
    setMobile(false);
    window.scrollTo(0, 0);
  };
  const pending =
    state?.approvals.filter((a) => a.status === "pending").length ?? 0;
  return (
    <div className="app">
      {mobile && (
        <button
          className="sidebar-shade"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">
            n<span>·</span>
          </span>
          nexus<span className="brand-beta">LOCAL</span>
        </a>
        <button
          className="workspace-switch"
          onClick={() => navigate("settings")}
        >
          <span className="workspace-icon">S</span>
          <span>
            <strong>Studio workspace</strong>
            <small>Local business sandbox</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((item, index) => (
            <React.Fragment key={item.id}>
              {navigation[index - 1]?.group !== item.group && (
                <div className="nav-label">{item.group}</div>
              )}
              <button
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === "office" && <span className="nav-new">6</span>}
                {item.id === "approvals" && pending > 0 && (
                  <span className="nav-count">{pending}</span>
                )}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="online-dot" />
            <strong>Your machine. Your workspace.</strong>
            <p>Business records stay local. Connect Ollama for local AI.</p>
            <button onClick={() => navigate("settings")}>
              Manage connections <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="profile" onClick={() => navigate("settings")}>
            <span className="profile-avatar">Y</span>
            <span>
              <strong>You</strong>
              <small>Local operator · full access</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={19} />
            </button>
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="environment">
              <span className="online-dot" />
              Local sandbox
            </span>
            <button
              className="command-trigger"
              onClick={() => setPlanner(true)}
            >
              <Command size={14} />
              <span>Command your team</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button bell"
              onClick={() => navigate("approvals")}
              aria-label={`${pending} pending approvals`}
            >
              <Bell size={18} />
              {pending > 0 && <i />}
            </button>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="connection-error" role="alert">
              Could not refresh the local API. {error}{" "}
              <button onClick={() => void refresh().catch(() => {})}>
                Retry
              </button>
            </div>
          )}
          {!state ? (
            <div className="loading-state">
              <Loader2 className="spin" size={28} />
              <h2>Opening your workspace</h2>
              <p>Connecting to the local Nexus API…</p>
            </div>
          ) : (
            <>
              {view === "overview" || view === "office" ? (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">YOUR BUSINESS, IN SYNC</div>
                      <h1>
                        {view === "office"
                          ? "Meet your AI office."
                          : "A little less busywork."}
                        <span className="heading-dot">✳</span>
                      </h1>
                      <p>
                        {view === "office"
                          ? "Six specialist roles. One shared workflow. You stay in control."
                          : "Your team, your customers, and your next big idea. All in one place."}
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => setPlanner(true)}
                    >
                      <Plus size={17} />
                      New workflow
                    </button>
                  </div>
                  {view === "overview" && (
                    <div className="metrics-row">
                      <Metric
                        label="Total contacts"
                        value={state.contacts.length}
                        icon={Users}
                        detail={`${state.contacts.filter((c) => c.consent).length} opted in to marketing`}
                        color="green"
                      />
                      <Metric
                        label="Published pages"
                        value={
                          state.pages.filter((p) => p.status === "published")
                            .length
                        }
                        icon={Globe2}
                        detail={`${state.pages.filter((p) => p.status === "draft").length} drafts in your studio`}
                        color="blue"
                      />
                      <Metric
                        label="Webinar registrations"
                        value={state.webinars.reduce(
                          (n, w) => n + w.registrations.length,
                          0,
                        )}
                        icon={Video}
                        detail={`${state.webinars.length} events in your workspace`}
                        color="purple"
                      />
                      <Metric
                        label="Awaiting your approval"
                        value={pending}
                        icon={ShieldCheck}
                        detail="You make the final call"
                        color="orange"
                      />
                    </div>
                  )}
                  <div className="office-layout">
                    <div className="office-main">
                      <PixelOffice
                        workflows={state.workflows}
                        compact={view === "overview"}
                        onAgentSelect={(name) =>
                          notify(
                            `${name} selected. Agent status reflects recorded workflow steps.`,
                          )
                        }
                      />
                      <div className="office-footer">
                        <span>
                          <span className="online-dot" />6 specialist roles
                        </span>
                        <span>
                          <ShieldCheck size={14} />
                          Human-approved actions
                        </span>
                        <span>
                          <Monitor size={14} />
                          Original pixel workspace
                        </span>
                      </div>
                    </div>
                    <aside className="mission-panel">
                      <div className="mission-icon">
                        <Sparkles size={20} />
                      </div>
                      <span className="eyebrow">FROM IDEA TO ACTION</span>
                      <h2>
                        Big plans.
                        <br />
                        Small prompts.
                      </h2>
                      <p>
                        Turn a webinar idea into an event draft, a landing page,
                        and a campaign. Review before anything goes live.
                      </p>
                      <div className="mission-example">
                        “Prepare a launch webinar for our new product.”
                      </div>
                      <button onClick={() => setPlanner(true)}>
                        Plan a workflow <ArrowRight size={16} />
                      </button>
                      <small>
                        <Cpu size={13} />
                        Ollama optional · no API key needed
                      </small>
                    </aside>
                  </div>
                  <div className="dashboard-bottom">
                    <section className="section-card workflows-card">
                      <div className="section-heading">
                        <div>
                          <h2>Workflow desk</h2>
                          <span>Every step, accounted for</span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => navigate("approvals")}
                        >
                          Review queue <ArrowRight size={14} />
                        </button>
                      </div>
                      {!state.workflows.length ? (
                        <div className="workflow-empty">
                          <span>
                            <Blocks size={25} />
                          </span>
                          <div>
                            <h3>A fresh start for your next launch</h3>
                            <p>
                              Create a guided workflow or connect a local model.
                              <br />
                              Drafts first. Your approval next.
                            </p>
                          </div>
                          <button
                            className="secondary-button"
                            onClick={() => setPlanner(true)}
                          >
                            Create your first workflow{" "}
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="workflow-list">
                          {state.workflows
                            .slice()
                            .reverse()
                            .slice(0, 4)
                            .map((w) => (
                              <article key={w.id}>
                                <div className="workflow-title">
                                  <span className="workflow-symbol">
                                    <Blocks size={17} />
                                  </span>
                                  <div>
                                    <strong>{w.title}</strong>
                                    <small>
                                      {
                                        w.steps.filter(
                                          (s) => s.status === "completed",
                                        ).length
                                      }{" "}
                                      of {w.steps.length} steps complete ·{" "}
                                      {time(w.createdAt)}
                                    </small>
                                  </div>
                                  <span
                                    className={`status-pill ${w.status.includes("approval") ? "amber" : ""}`}
                                  >
                                    {displayStatus(w.status)}
                                  </span>
                                </div>
                                <div className="workflow-steps">
                                  {w.steps.map((s) => (
                                    <span
                                      key={s.id}
                                      title={s.label}
                                      className={
                                        s.status === "completed"
                                          ? "step-done"
                                          : ""
                                      }
                                    >
                                      {s.status === "completed" ? (
                                        <Check size={12} />
                                      ) : (
                                        <span className="step-dot" />
                                      )}
                                      {s.agent}
                                    </span>
                                  ))}
                                </div>
                              </article>
                            ))}
                        </div>
                      )}
                    </section>
                    <section className="section-card activity-card">
                      <div className="section-heading">
                        <div>
                          <h2>Activity</h2>
                          <span>Recorded in your workspace</span>
                        </div>
                        <Activity size={17} />
                      </div>
                      <div className="activity-list">
                        {state.activities
                          .slice()
                          .reverse()
                          .slice(0, 5)
                          .map((a) => (
                            <div className="activity-item" key={a.id}>
                              <span className="activity-dot">
                                <CheckCheck size={13} />
                              </span>
                              <div>
                                <p>{a.message}</p>
                                <small>{time(a.createdAt)}</small>
                              </div>
                            </div>
                          ))}
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <Modules
                  key={view}
                  view={view}
                  state={state}
                  refresh={refresh}
                  notify={notify}
                />
              )}
              <footer className="app-footer">
                <span>
                  <ShieldCheck size={13} /> Local prototype · fictional starter
                  data · no real payments or email sends
                </span>
                <button onClick={() => navigate("settings")}>
                  <CircleHelp size={14} />
                  Connection guide
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
      {planner && (
        <Planner
          onClose={() => setPlanner(false)}
          onCreated={async () => {
            await refresh();
            setPlanner(false);
            navigate("approvals");
          }}
          notify={notify}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <article className="metric-card">
      <div>
        <span>{label}</span>
        <span className={`metric-icon ${color}`}>
          <Icon size={17} />
        </span>
      </div>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Planner({
  onClose,
  onCreated,
  notify,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const [prompt, setPrompt] = useState(
    "Prepare a launch webinar for our new product. Draft a registration page and an invitation for opted-in leads.",
  );
  const [mode, setMode] = useState("guided");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [connection, setConnection] = useState("Checking local Ollama…");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planPrompt, setPlanPrompt] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void api<{ available: boolean; models: string[] }>("/ai/status")
      .then((result) => {
        if (!alive) return;
        setModels(result.models);
        setModel(result.models[0] || "");
        setConnection(
          result.available
            ? result.models.length
              ? "Ollama connected on your machine"
              : "Ollama connected · no model installed"
            : "Ollama is not running · guided mode available",
        );
      })
      .catch(() => {
        if (alive)
          setConnection("Could not reach Ollama · guided mode available");
      });
    const previous = document.activeElement as HTMLElement;
    dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),textarea,input,select",
          ) || []),
        ];
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      alive = false;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  const draft = async () => {
    setBusy(true);
    try {
      setPlan(await api<Plan>("/ai/plan", "POST", { prompt, model }));
      setPlanPrompt(prompt);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Local model failed", true);
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    setBusy(true);
    try {
      await api("/workflows", "POST", {
        prompt,
        ...(mode === "ollama" ? { plan } : {}),
      });
      await onCreated();
      notify("Drafts created. Review publication and campaign approvals.");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Workflow could not be created",
        true,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="planner-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target && !busy) onClose();
      }}
    >
      <div
        ref={dialog}
        className="planner-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-title"
      >
        <div className="planner-header">
          <span className="planner-logo">
            <Sparkles size={23} />
          </span>
          <div>
            <span className="eyebrow">NEXUS COMMAND DESK</span>
            <h2 id="planner-title">What are we working on?</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close planner"
          >
            <X size={20} />
          </button>
        </div>
        <div className="planner-body">
          <label className="field-label" htmlFor="business-prompt">
            Describe your launch
          </label>
          <textarea
            id="business-prompt"
            className="prompt-input"
            rows={4}
            value={prompt}
            disabled={busy}
            maxLength={2000}
            onChange={(e) => {
              setPrompt(e.target.value);
              setPlan(null);
            }}
          />
          <div className="mode-picker">
            <button
              disabled={busy}
              className={mode === "guided" ? "selected" : ""}
              onClick={() => {
                setMode("guided");
                setPlan(null);
              }}
            >
              <Blocks size={17} />
              <strong>Guided workflow</strong>
              <small>Local template · no AI call</small>
            </button>
            <button
              disabled={busy || !models.length}
              className={mode === "ollama" ? "selected" : ""}
              onClick={() => setMode("ollama")}
            >
              <Cpu size={17} />
              <strong>Local AI</strong>
              <small>Ollama · your GPU</small>
            </button>
          </div>
          <div className="ollama-status">
            <span className={`online-dot ${models.length ? "" : "offline"}`} />
            {connection}
          </div>
          {mode === "ollama" && (
            <label className="field-label">
              Installed model
              <select
                disabled={busy}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setPlan(null);
                }}
              >
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          {plan ? (
            <div className="plan-review">
              <span className="eyebrow">REVIEW MODEL-GENERATED CONTENT</span>
              <label>
                Event & page title
                <input
                  maxLength={160}
                  value={plan.title}
                  onChange={(e) => setPlan({ ...plan, title: e.target.value })}
                />
              </label>
              <label>
                Headline
                <input
                  maxLength={240}
                  value={plan.headline}
                  onChange={(e) =>
                    setPlan({ ...plan, headline: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={3000}
                  value={plan.description}
                  onChange={(e) =>
                    setPlan({ ...plan, description: e.target.value })
                  }
                />
              </label>
              <label>
                Email subject
                <input
                  maxLength={240}
                  value={plan.emailSubject}
                  onChange={(e) =>
                    setPlan({ ...plan, emailSubject: e.target.value })
                  }
                />
              </label>
              <label>
                Email body
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={plan.emailBody}
                  onChange={(e) =>
                    setPlan({ ...plan, emailBody: e.target.value })
                  }
                />
              </label>
            </div>
          ) : (
            <div className="plan-preview">
              <span className="eyebrow">YOUR WORKFLOW WILL INCLUDE</span>
              {[
                ["Events", "Create a webinar draft — date to be confirmed"],
                ["Website", "Prepare an editable registration page"],
                ["Growth", "Draft an invitation for opted-in leads"],
                ["You", "Review publication and scheduling approvals"],
              ].map(([role, step]) => (
                <div key={role}>
                  <span>
                    {role === "You" ? (
                      <ShieldCheck size={14} />
                    ) : (
                      <ArrowDownLeft size={14} />
                    )}
                  </span>
                  <strong>{role}</strong>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          )}
          <div className="planner-disclaimer">
            <ShieldCheck size={16} />
            <p>
              {mode === "guided"
                ? "Guided mode uses a fixed template, not a language model. "
                : "Local AI drafts content only. It cannot access your customer records or execute actions. "}
              No email is sent and no payment is taken. Event dates and live
              integrations still need configuration.
            </p>
          </div>
        </div>
        <div className="planner-footer">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          {mode === "ollama" && !plan ? (
            <button
              className="primary-button"
              disabled={busy || !prompt.trim() || !model}
              onClick={draft}
            >
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}{" "}
              {busy ? "Drafting locally… (up to 2 min)" : "Generate a draft"}
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={
                busy ||
                !prompt.trim() ||
                (mode === "ollama" && (!plan || planPrompt !== prompt))
              }
              onClick={create}
            >
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <Send size={16} />
              )}
              Create drafts & request approval
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

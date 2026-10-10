import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2,
  Users,
  Globe2,
  Mail,
  Video,
  Wallet,
  BarChart3,
  ShieldCheck,
  Settings2,
  Menu,
  X,
  Radio,
  RefreshCw,
  Terminal,
  ChevronRight,
  Bot,
  Sun,
  BookOpen,
  Loader2,
} from "lucide-react";
import PixelOffice from "./components/PixelOffice";
import OrchestraConsole from "./components/OrchestraConsole";
import ProviderConnections from "./components/ProviderConnections";
import Modules from "./components/Modules";
import { api } from "./api";
import type { NexusState, View } from "./types";
import type { AgentRun, OrchestraState } from "./orchestra-types";
import "./styles.css";
import "./office-shell.css";

const nav: { view: View; label: string; icon: typeof Users; tag?: string }[] = [
  { view: "analytics", label: "Dashboard", icon: BarChart3 },
  { view: "office", label: "Agent Studio", icon: Building2, tag: "AGENT" },
  { view: "crm", label: "CRM & Leads", icon: Users },
  { view: "websites", label: "Landing Sites", icon: Globe2 },
  { view: "webinars", label: "Webinars", icon: Video },
  { view: "campaigns", label: "Marketing", icon: Mail },
  { view: "billing", label: "SaaS Billing", icon: Wallet },
  { view: "approvals", label: "Audit Log", icon: ShieldCheck },
  { view: "settings", label: "Connections", icon: Settings2 },
];
const roles = ["Website", "CRM", "Growth", "Events", "Billing", "Review"];

function App() {
  const [view, setView] = useState<View>("analytics");
  const [state, setState] = useState<NexusState | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const inFlight = useRef(false);
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6500);
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [business, orchestra] = await Promise.all([
        api<NexusState>("/state"),
        api<OrchestraState>("/orchestra"),
      ]);
      setState(business);
      setRuns(orchestra.runs);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot connect to Nexus");
    } finally {
      inFlight.current = false;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  const navigate = (next: View) => {
    setView(next);
    setMobile(false);
  };
  const command = () => {
    setView("office");
    setConsoleOpen(true);
    setTimeout(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(".oc-command textarea")
          ?.focus(),
      50,
    );
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        command();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const active = runs.find((run) =>
    ["planning", "running"].includes(run.status),
  );
  const pending =
    state?.approvals.filter((a) => a.status === "pending").length || 0;
  return (
    <div className="world-shell">
      {mobile && (
        <button
          className="world-backdrop"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`world-sidebar ${mobile ? "is-open" : ""}`}>
        <button className="world-brand" onClick={() => navigate("office")}>
          <span className="world-mascot">
            <i />
            <b />
          </span>
          <span>
            <strong>Nexus World</strong>
            <small>Your AI business orchestra</small>
          </span>
        </button>
        <nav aria-label="Workspace navigation">
          {nav.map(({ view: target, label, icon: Icon, tag }) => (
            <button
              key={target}
              className={view === target ? "is-active" : ""}
              onClick={() => navigate(target)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {tag && <small className="nav-agent-tag">{tag}</small>}
              {target === "approvals" && pending > 0 && <em>{pending}</em>}
            </button>
          ))}
        </nav>
        <div className="department-status">
          <h3>DEPARTMENT STATUS</h3>
          {roles.map((role) => {
            const task = active?.tasks.find(
              (t) => t.agent === role && t.status === "running",
            );
            return (
              <button
                key={role}
                onClick={() => {
                  navigate("office");
                  setSelectedAgent(role);
                  setConsoleOpen(true);
                }}
              >
                <span className={`department-light ${task ? "working" : ""}`} />
                <span>{role}</span>
                <small>{task ? "1 working" : "ready"}</small>
              </button>
            );
          })}
        </div>
        <div className="world-local">
          <span className={active ? "working-dot" : "ready-dot"} />
          {active ? "Ollama executing" : "Local workspace"}
          <span className="gpu-label">12 GB GPU</span>
        </div>
      </aside>
      <div className="world-main">
        <header className="world-topbar">
          <div className="world-title">
            <button
              className="world-mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <Building2 size={24} />
            <h1>{nav.find((x) => x.view === view)?.label || "Office"}</h1>
            <span className="office-pack">
              <small>OFFICE PACK</small>
              <strong>NEX · Business operations</strong>
            </span>
          </div>
          <div className="world-top-actions">
            <button className="world-command-button" onClick={command}>
              <Terminal size={16} />
              Command desk
            </button>
            <button onClick={() => navigate("approvals")}>
              <ShieldCheck size={16} />
              Decisions{pending > 0 && <b>{pending}</b>}
            </button>
            <button
              onClick={() => {
                navigate("office");
                setConsoleOpen((value) => !value);
              }}
            >
              <Radio size={16} />
              {consoleOpen ? "Hide" : "Show"} live feed
            </button>
            <button
              className="icon-only"
              onClick={() => void refresh()}
              aria-label="Refresh workspace"
            >
              <RefreshCw size={16} />
            </button>
            <span className="world-live">
              <span className={active ? "working-dot" : "ready-dot"} />
              {active ? "Working" : "Connected"}
            </span>
          </div>
        </header>
        {error && (
          <div className="world-error" role="alert">
            {error} <button onClick={() => void refresh()}>Reconnect</button>
          </div>
        )}
        {!state ? (
          <div className="world-loading">
            <Loader2 className="spin" />
            Opening your local office…
          </div>
        ) : view === "office" ? (
          <main className="world-office-content">
            <div className="world-office-meta">
              <span>
                <Bot size={14} />
                <strong>Real model calls. Real business tools.</strong> Human
                review for sensitive actions.
              </span>
              <span>
                {runs.filter((r) => r.status === "completed").length} completed
                runs · {pending} decisions
              </span>
            </div>
            <PixelOffice
              workflows={state.workflows}
              runs={runs}
              onAgentSelect={(name) => {
                setSelectedAgent(name);
                setConsoleOpen(true);
              }}
            />
            <section
              className={`world-command-area ${consoleOpen ? "" : "is-collapsed"}`}
              aria-label="Live agent collaboration"
            >
              <div className="world-command-heading">
                <div>
                  <Radio size={18} />
                  <h2>Command & collaboration</h2>
                  <span>Ollama · local execution</span>
                </div>
                <button onClick={() => setSelectedAgent(null)}>
                  All agents <ChevronRight size={14} />
                </button>
              </div>
              {consoleOpen && (
                <OrchestraConsole
                  onChange={() => void refresh()}
                  onApprovals={() => navigate("approvals")}
                  selectedAgent={selectedAgent}
                  onAgentSelect={setSelectedAgent}
                />
              )}
              {!consoleOpen && (
                <button
                  className="world-show-console"
                  onClick={() => setConsoleOpen(true)}
                >
                  Open command desk to give the team a job{" "}
                  <ChevronRight size={16} />
                </button>
              )}
            </section>
            <div className="world-trust-note">
              <ShieldCheck size={15} />
              <p>
                Agents execute bounded tools and share verified outputs. No
                simulated conversations. Email requires a configured provider
                and approval; payments remain explicitly sandbox-only.
              </p>
              <button onClick={() => navigate("settings")}>
                Connections <ChevronRight size={14} />
              </button>
            </div>
          </main>
        ) : (
          <main className="world-module-content">
            {view === "settings" && (
              <ProviderConnections onChanged={() => void refresh()} />
            )}
            <Modules
              key={view}
              view={view}
              state={state}
              refresh={refresh}
              notify={notify}
              onNavigate={navigate}
            />
            <footer className="world-module-footer">
              <BookOpen size={13} />
              Single local operator · fictional starter contacts · never expose
              this server publicly without authentication.
            </footer>
          </main>
        )}
      </div>
      {toast && (
        <div
          className={`world-toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.text}
          <button aria-label="Dismiss" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

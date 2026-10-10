import { useMemo, useState, type CSSProperties } from "react";
import type { Workflow } from "../types";
import type { AgentRole, AgentRun } from "../orchestra-types";
import "./pixel-office.css";

type PixelOfficeProps = {
  workflows: Workflow[];
  runs?: AgentRun[];
  onAgentSelect?: (agent: string) => void;
  compact?: boolean;
};
type Agent = {
  name: AgentRole;
  role: string;
  x: number;
  y: number;
  shirt: string;
  skin: string;
  hair: string;
  room: string;
};
const AGENTS: Agent[] = [
  {
    name: "Coordinator",
    role: "CEO / orchestration",
    x: 195,
    y: 125,
    shirt: "#ee805e",
    skin: "#dba17c",
    hair: "#35252e",
    room: "ceo",
  },
  {
    name: "Website",
    role: "pages & publishing",
    x: 195,
    y: 365,
    shirt: "#50a0ad",
    skin: "#dda17d",
    hair: "#704431",
    room: "website",
  },
  {
    name: "CRM",
    role: "contacts & journeys",
    x: 690,
    y: 365,
    shirt: "#a37bd0",
    skin: "#b97863",
    hair: "#372732",
    room: "crm",
  },
  {
    name: "Growth",
    role: "audience & campaigns",
    x: 1185,
    y: 365,
    shirt: "#e59b51",
    skin: "#dda47d",
    hair: "#553326",
    room: "growth",
  },
  {
    name: "Events",
    role: "webinars & attendance",
    x: 195,
    y: 610,
    shirt: "#55b79d",
    skin: "#cb876c",
    hair: "#302829",
    room: "events",
  },
  {
    name: "Billing",
    role: "plans & sandbox usage",
    x: 690,
    y: 610,
    shirt: "#e27b62",
    skin: "#d59a75",
    hair: "#62402b",
    room: "billing",
  },
  {
    name: "Review",
    role: "quality & records",
    x: 1185,
    y: 610,
    shirt: "#7898d7",
    skin: "#bc806b",
    hair: "#2f2d3c",
    room: "review",
  },
];
const rooms = AGENTS.slice(1);
const truncate = (text: string, max = 55) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function Sprite({ agent, working }: { agent: Agent; working: boolean }) {
  return (
    <g className={working ? "sprite sprite--working" : "sprite"}>
      <ellipse cx="0" cy="37" rx="24" ry="7" fill="#171923" opacity=".58" />
      <rect
        x="-14"
        y="9"
        width="28"
        height="27"
        fill={agent.shirt}
        stroke="#2d2630"
        strokeWidth="3"
      />
      <rect x="-20" y="15" width="6" height="16" fill={agent.skin} />
      <rect x="14" y="15" width="6" height="16" fill={agent.skin} />
      <rect x="-12" y="34" width="9" height="13" fill="#282936" />
      <rect x="3" y="34" width="9" height="13" fill="#282936" />
      <rect
        x="-12"
        y="-14"
        width="24"
        height="24"
        fill={agent.skin}
        stroke="#2d2630"
        strokeWidth="3"
      />
      <path d="M-15-14h30v9h-5v6h-7v-7h-8v9h-10z" fill={agent.hair} />
      <rect x="-7" y="-1" width="4" height="4" fill="#302630" />
      <rect x="6" y="-1" width="4" height="4" fill="#302630" />
      <rect x="-2" y="6" width="8" height="2" fill="#9a5e58" />
      <rect x="-8" y="15" width="16" height="4" fill="#ffd58b" />
      {working && <rect x="22" y="-20" width="6" height="6" fill="#f5cf65" />}
    </g>
  );
}
function Desk({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="150"
        height="47"
        fill="#986044"
        stroke="#35282f"
        strokeWidth="5"
      />
      <rect
        x={x + 51}
        y={y - 36}
        width="48"
        height="32"
        fill="#243f52"
        stroke="#1a2832"
        strokeWidth="5"
      />
      <rect x={x + 59} y={y - 28} width="32" height="18" fill="#89c8ba" />
      <rect x={x + 14} y={y + 13} width="42" height="7" fill="#f0d18e" />
      <path
        d={`M${x + 38} ${y + 47}v14m76-14v14`}
        stroke="#35282f"
        strokeWidth="6"
      />
    </g>
  );
}
function Room({
  agent,
  index,
  working,
  message,
}: {
  agent: Agent;
  index: number;
  working: boolean;
  message?: string;
}) {
  const x = 20 + (index % 3) * 495,
    y = index < 3 ? 210 : 455;
  const tint = ["#625b4c", "#4f5d63", "#5b526d"][index % 3];
  return (
    <g>
      <rect x={x} y={y} width="470" height="220" fill={tint} />
      <path
        d={`M${x} ${y}h470v220H${x}z`}
        fill="none"
        stroke="#332936"
        strokeWidth="8"
      />
      <path d={`M${x} ${y + 9}h470`} stroke="#e5bd75" strokeWidth="9" />
      <rect
        x={x + 20}
        y={y + 18}
        width="180"
        height="28"
        fill="#efd18f"
        stroke="#47333a"
        strokeWidth="4"
      />
      <text x={x + 33} y={y + 38} className="room-label">
        {agent.name.toUpperCase()}
      </text>
      {/* noticeboard, bookshelf, window and clock */}
      <rect
        x={x + 275}
        y={y + 18}
        width="72"
        height="52"
        fill="#bd815d"
        stroke="#392b32"
        strokeWidth="4"
      />
      <rect x={x + 285} y={y + 29} width="16" height="13" fill="#e9c57e" />
      <rect x={x + 307} y={y + 29} width="29" height="13" fill="#8bb6ab" />
      <rect
        x={x + 360}
        y={y + 18}
        width="68"
        height="48"
        fill="#8caeb0"
        stroke="#3e4a51"
        strokeWidth="4"
      />
      <path
        d={`M${x + 394} ${y + 18}v48m-34-24h68`}
        stroke="#dce2cd"
        strokeWidth="3"
      />
      <rect
        x={x + 432}
        y={y + 22}
        width="22"
        height="22"
        fill="#eee3bd"
        stroke="#654849"
        strokeWidth="3"
      />
      <path d={`M${x + 443} ${y + 26}v7h6`} stroke="#67474b" strokeWidth="2" />
      <rect
        x={x + 18}
        y={y + 144}
        width="58"
        height="48"
        fill="#704d45"
        stroke="#372c33"
        strokeWidth="4"
      />
      <path
        d={`M${x + 29} ${y + 154}h36m-36 12h36m-36 12h36`}
        stroke="#e0b26f"
        strokeWidth="5"
      />
      <path
        d={`M${x + 90} ${y + 181}q-23-42-46 0m27-15q-4-27-20-35m17 34q22-27 34-22`}
        fill="none"
        stroke="#6ca26e"
        strokeWidth="7"
      />
      <Desk x={x + 100} y={y + 126} />
      <Desk x={x + 298} y={y + 126} />
      <g transform={`translate(${x + 175} ${y + 154})`}>
        <Sprite agent={agent} working={working} />
      </g>
      {message && (
        <g>
          <rect
            x={x + 125}
            y={y + 65}
            width="240"
            height="32"
            fill="#fff0c8"
            stroke="#49353a"
            strokeWidth="3"
          />
          <path
            d={`M${x + 165} ${y + 97}l-10 12 28-12`}
            fill="#fff0c8"
            stroke="#49353a"
            strokeWidth="3"
          />
          <text x={x + 138} y={y + 86} className="bubble-text">
            {truncate(message)}
          </text>
        </g>
      )}
    </g>
  );
}

export default function PixelOffice({
  workflows,
  runs = [],
  onAgentSelect,
  compact = false,
}: PixelOfficeProps) {
  const [selected, setSelected] = useState<AgentRole | null>(null);
  const newest = useMemo(
    () =>
      [...runs].sort(
        (a, b) =>
          +new Date(b.updatedAt || b.createdAt) -
          +new Date(a.updatedAt || a.createdAt),
      )[0],
    [runs],
  );
  const active =
    newest &&
    ["queued", "planning", "running", "awaiting_approval"].includes(
      newest.status,
    )
      ? newest
      : undefined;
  const state = (agent: Agent) => {
    const tasks = active?.tasks.filter((t) => t.agent === agent.name) ?? [];
    if (
      tasks.some((t) => t.status === "awaiting_approval") ||
      (active?.status === "awaiting_approval" &&
        tasks.some((t) => !["completed", "done"].includes(t.status)))
    )
      return "Awaiting approval";
    if (
      tasks.some((t) => ["running", "planning"].includes(t.status)) ||
      (agent.name === "Coordinator" && active?.status === "planning")
    )
      return "Working";
    if (tasks.some((t) => ["queued", "pending"].includes(t.status)))
      return "Queued";
    const old = workflows
      .flatMap((w) => w.steps || [])
      .filter((s) => s.agent.toLowerCase().includes(agent.name.toLowerCase()));
    if (old.some((s) => /awaiting_approval|pending/i.test(s.status)))
      return "Awaiting approval";
    return old.length || newest?.status === "completed" ? "Ready" : "Idle";
  };
  const message = (agent: Agent) =>
    [...(active?.messages ?? []), ...(newest?.messages ?? [])]
      .reverse()
      .find((m) => m.from === agent.name)?.text;
  const selectedAgent = AGENTS.find((a) => a.name === selected);
  const select = (a: AgentRole) => {
    setSelected(a);
    onAgentSelect?.(a);
  };
  return (
    <section
      className={`pixel-office ${compact ? "pixel-office--compact" : ""}`}
      aria-label="Nexus pixel office"
    >
      <header className="pixel-office__header">
        <div>
          <p className="pixel-office__eyebrow">NEXUS HQ · LIVE ORCHESTRA</p>
          <h2>The team behind your workflows</h2>
        </div>
        <div className="pixel-office__legend">
          <span>
            <i className="status-dot status-dot--working" />
            Working
          </span>
          <span>
            <i className="status-dot status-dot--ready" />
            Ready
          </span>
          <span>
            <i className="status-dot status-dot--approval" />
            Approval
          </span>
        </div>
      </header>
      <div className="pixel-office__frame">
        <div className="pixel-office__pan">
          <svg
            className="pixel-office__scene"
            viewBox="0 0 1500 900"
            role="img"
            aria-label="Pixel-art office with CEO room, six department rooms, and lounge"
          >
            <defs>
              <pattern
                id="floor"
                width="36"
                height="36"
                patternUnits="userSpaceOnUse"
              >
                <rect width="36" height="36" fill="#3d3d43" />
                <rect width="18" height="18" fill="#48464b" />
              </pattern>
              <pattern
                id="lounge-floor"
                width="36"
                height="36"
                patternUnits="userSpaceOnUse"
              >
                <rect width="36" height="36" fill="#39464b" />
                <rect width="18" height="18" fill="#435357" />
              </pattern>
            </defs>
            <rect width="1500" height="900" fill="#e9d8b7" />
            <rect
              x="14"
              y="14"
              width="1472"
              height="872"
              fill="#d0af80"
              stroke="#443238"
              strokeWidth="9"
            />
            <rect
              x="28"
              y="28"
              width="1444"
              height="147"
              fill="url(#floor)"
              stroke="#332a33"
              strokeWidth="7"
            />
            <path d="M28 36h1444" stroke="#edc477" strokeWidth="11" />
            <text x="52" y="67" className="svg-label">
              CEO COORDINATOR · WAR ROOM
            </text>
            <rect
              x="90"
              y="88"
              width="210"
              height="55"
              fill="#966045"
              stroke="#342a32"
              strokeWidth="5"
            />
            <rect
              x="154"
              y="52"
              width="70"
              height="38"
              fill="#294456"
              stroke="#1f2d35"
              strokeWidth="4"
            />
            <rect x="166" y="61" width="46" height="20" fill="#8ec8bb" />
            <rect
              x="450"
              y="72"
              width="600"
              height="71"
              fill="#a97750"
              stroke="#4a3434"
              strokeWidth="6"
            />
            <rect
              x="510"
              y="85"
              width="480"
              height="38"
              fill="#ce9c6b"
              stroke="#714a3e"
              strokeWidth="4"
            />
            {[490, 610, 730, 850, 970].map((x) => (
              <rect
                key={x}
                x={x}
                y="43"
                width="42"
                height="25"
                fill="#314453"
                stroke="#242f36"
                strokeWidth="4"
              />
            ))}
            <g transform="translate(195 105)">
              <Sprite
                agent={AGENTS[0]}
                working={state(AGENTS[0]) === "Working"}
              />
            </g>
            {message(AGENTS[0]) && (
              <text x="1075" y="110" className="svg-note">
                {truncate(message(AGENTS[0]) as string)}
              </text>
            )}
            <rect
              x="28"
              y="175"
              width="1444"
              height="35"
              fill="#f3e4c4"
              stroke="#a37b5d"
              strokeWidth="4"
            />
            <text x="52" y="198" className="hall-label">
              CENTRAL HALL · SHARED CONTEXT
            </text>
            {rooms.map((a, i) => (
              <Room
                key={a.name}
                agent={a}
                index={i}
                working={state(a) === "Working"}
                message={message(a)}
              />
            ))}
            <rect
              x="28"
              y="430"
              width="1444"
              height="25"
              fill="#f3e4c4"
              stroke="#a37b5d"
              strokeWidth="4"
            />
            <rect
              x="28"
              y="675"
              width="1444"
              height="35"
              fill="#f3e4c4"
              stroke="#a37b5d"
              strokeWidth="4"
            />
            <text x="52" y="698" className="hall-label">
              LOUNGE · RESET &amp; REVIEW
            </text>
            <rect
              x="28"
              y="710"
              width="1444"
              height="162"
              fill="url(#lounge-floor)"
              stroke="#332a33"
              strokeWidth="7"
            />
            <rect
              x="85"
              y="750"
              width="260"
              height="43"
              fill="#9a5a58"
              stroke="#392a32"
              strokeWidth="6"
            />
            <rect
              x="1110"
              y="750"
              width="260"
              height="43"
              fill="#557a78"
              stroke="#392a32"
              strokeWidth="6"
            />
            <ellipse
              cx="730"
              cy="792"
              rx="165"
              ry="37"
              fill="#87614d"
              stroke="#372d33"
              strokeWidth="5"
            />
            <rect
              x="1190"
              y="725"
              width="125"
              height="65"
              fill="#4f6f6c"
              stroke="#293a3e"
              strokeWidth="5"
            />
            <rect x="1213" y="740" width="79" height="20" fill="#e2c17a" />
            <path
              d="M505 844q-32-74-65 0m38-27q-5-49-27-57m24 54q31-46 52-35m810 65q-32-74-65 0m38-27q-5-49-27-57m24 54q31-46 52-35"
              fill="none"
              stroke="#76a46e"
              strokeWidth="10"
            />
            <text x="1330" y="747" className="svg-note">
              VEND
            </text>
          </svg>
          <div className="pixel-office__agents" aria-label="Office agents">
            {AGENTS.map((a) => {
              const s = state(a);
              return (
                <button
                  key={a.name}
                  type="button"
                  className={`agent-hotspot ${selected === a.name ? "is-selected" : ""}`}
                  style={
                    {
                      left: a.x,
                      top: a.y,
                      "--agent-color": a.shirt,
                    } as CSSProperties
                  }
                  onClick={() => select(a.name)}
                  aria-label={`Select ${a.name} agent, status ${s}`}
                >
                  <span className="agent-hotspot__marker" />
                  <span className="agent-hotspot__name">{a.name}</span>
                  <small
                    className={`agent-status agent-status--${s.toLowerCase().replace(" ", "-")}`}
                  >
                    {s}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {selectedAgent && (
        <div className="pixel-office__detail">
          <span
            className="detail-avatar"
            style={{ background: selectedAgent.shirt }}
          >
            {selectedAgent.name[0]}
          </span>
          <div>
            <strong>{selectedAgent.name}</strong>
            <span>{selectedAgent.role}</span>
            <p>
              {message(selectedAgent)
                ? truncate(message(selectedAgent) as string, 110)
                : `No public messages yet. ${state(selectedAgent)}.`}
            </p>
          </div>
          <em>{state(selectedAgent)}</em>
        </div>
      )}
      {!compact && (
        <p className="pixel-office__note">
          Live statuses come from workflow steps and orchestra messages. The
          room is quiet when no run is active.
        </p>
      )}
    </section>
  );
}

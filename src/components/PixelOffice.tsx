import { useMemo, useState, type CSSProperties } from "react";
import type { Workflow } from "../types";
import "./pixel-office.css";

type PixelOfficeProps = {
  workflows: Workflow[];
  onAgentSelect?: (agent: string) => void;
  compact?: boolean;
};

type Agent = {
  name: string;
  role: string;
  x: number;
  y: number;
  color: string;
  accent: string;
};

const AGENTS: Agent[] = [
  {
    name: "Growth",
    role: "audience & campaigns",
    x: 15,
    y: 28,
    color: "#d07b58",
    accent: "#f2bf76",
  },
  {
    name: "Website",
    role: "pages & publishing",
    x: 39,
    y: 27,
    color: "#668b77",
    accent: "#b8d49d",
  },
  {
    name: "CRM",
    role: "contacts & journeys",
    x: 64,
    y: 28,
    color: "#7188ae",
    accent: "#b9c9ed",
  },
  {
    name: "Events",
    role: "webinars & attendance",
    x: 22,
    y: 69,
    color: "#a56e9b",
    accent: "#e7afd5",
  },
  {
    name: "Billing",
    role: "plans & sandbox usage",
    x: 51,
    y: 70,
    color: "#bb8752",
    accent: "#f0ce8d",
  },
  {
    name: "Coordinator",
    role: "workflow approvals",
    x: 79,
    y: 68,
    color: "#637e75",
    accent: "#b3d2c4",
  },
];

const statusText = (agent: Agent, workflows: Workflow[]) => {
  const steps = workflows
    .flatMap((workflow) => workflow.steps || [])
    .filter((step) =>
      step.agent.toLowerCase().includes(agent.name.toLowerCase()),
    );
  if (!steps.length) return "Idle";
  if (
    steps.some((step) =>
      /^(awaiting_approval|pending|review)$/.test(step.status),
    )
  )
    return "Awaiting approval";
  if (steps.some((step) => step.status === "rejected"))
    return "Needs attention";
  return "Ready";
};

export default function PixelOffice({
  workflows,
  onAgentSelect,
  compact = false,
}: PixelOfficeProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const statuses = useMemo(
    () =>
      Object.fromEntries(
        AGENTS.map((agent) => [agent.name, statusText(agent, workflows)]),
      ),
    [workflows],
  );
  const selectedAgent = AGENTS.find((agent) => agent.name === selected);

  const selectAgent = (name: string) => {
    setSelected(name);
    onAgentSelect?.(name);
  };

  return (
    <section
      className={`pixel-office ${compact ? "pixel-office--compact" : ""}`}
      aria-label="Nexus pixel office"
    >
      <div className="pixel-office__header">
        <div>
          <p className="pixel-office__eyebrow">NEXUS HQ · LOCAL WORKSPACE</p>
          <h2>The team behind your workflows</h2>
        </div>
        <div className="pixel-office__legend" aria-label="Office status legend">
          <span>
            <i className="status-dot status-dot--ready" />
            Ready
          </span>
          <span>
            <i className="status-dot status-dot--approval" />
            Awaiting approval
          </span>
        </div>
      </div>

      <div className="pixel-office__frame">
        <svg
          className="pixel-office__scene"
          viewBox="0 0 960 480"
          role="img"
          aria-label="Top-down illustrated office with desks, plants, windows and meeting area"
        >
          <defs>
            <pattern
              id="tile"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <rect width="48" height="48" fill="#f5eddf" />
              <path
                d="M48 0H0V48"
                fill="none"
                stroke="#e5dac7"
                strokeWidth="2"
              />
            </pattern>
            <pattern
              id="rug"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
            >
              <rect width="18" height="18" fill="#dce5d5" />
              <path d="M0 9h18M9 0v18" stroke="#c1d1c1" strokeWidth="2" />
            </pattern>
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <rect
            x="8"
            y="8"
            width="944"
            height="464"
            rx="20"
            fill="url(#tile)"
            stroke="#c9bca9"
            strokeWidth="5"
          />
          <path
            d="M28 112H932M28 352H932M314 28V452M680 28V452"
            stroke="#d8cbb8"
            strokeWidth="3"
            strokeDasharray="5 9"
          />
          {/* windows and warm light */}
          <g className="office-window">
            <rect
              x="354"
              y="18"
              width="270"
              height="39"
              rx="8"
              fill="#a9c4c0"
              stroke="#758f88"
              strokeWidth="4"
            />
            <path
              d="M444 18v39M534 18v39M354 37h270"
              stroke="#d9eee1"
              strokeWidth="3"
            />
            <path
              d="M367 27h70M547 27h70"
              stroke="#f8dba3"
              strokeWidth="4"
              opacity=".8"
            />
          </g>
          <g opacity=".28" filter="url(#softGlow)">
            <circle cx="488" cy="80" r="35" fill="#f4c977" />
            <circle cx="480" cy="397" r="30" fill="#f4c977" />
          </g>
          {/* partitions */}
          <g fill="#b7c7b3" stroke="#789080" strokeWidth="4">
            <path d="M28 190h270v12H28zM28 284h270v12H28zM660 190h272v12H660zM660 284h272v12H660z" />
            <path d="M298 155h12v167h-12zM650 155h12v167h-12z" />
          </g>
          {/* rug and meeting table */}
          <ellipse
            cx="480"
            cy="252"
            rx="145"
            ry="72"
            fill="url(#rug)"
            stroke="#b2c2b0"
            strokeWidth="4"
          />
          <ellipse
            cx="480"
            cy="252"
            rx="90"
            ry="36"
            fill="#e7d8c4"
            stroke="#c5ad92"
            strokeWidth="5"
          />
          <g fill="#8c7b69">
            <circle cx="405" cy="252" r="10" />
            <circle cx="555" cy="252" r="10" />
            <circle cx="480" cy="205" r="10" />
            <circle cx="480" cy="299" r="10" />
          </g>
          {/* coffee nook */}
          <g>
            <rect
              x="704"
              y="80"
              width="170"
              height="72"
              rx="10"
              fill="#ead7bd"
              stroke="#a98262"
              strokeWidth="4"
            />
            <rect x="727" y="98" width="42" height="33" rx="5" fill="#6d5b50" />
            <path d="M778 105h45v26h-45z" fill="#c57d52" />
            <path
              d="M785 101q4-18 9 0M800 101q4-18 9 0"
              stroke="#f0c997"
              strokeWidth="3"
              fill="none"
            />
            <circle cx="848" cy="116" r="12" fill="#81a477" />
          </g>
          {/* desks, monitors, chairs */}
          {AGENTS.map((agent) => {
            const x = agent.x * 9.6;
            const y = agent.y * 4.8;
            return (
              <g key={agent.name} transform={`translate(${x - 47} ${y - 25})`}>
                <rect
                  x="0"
                  y="0"
                  width="94"
                  height="47"
                  rx="6"
                  fill="#c39e79"
                  stroke="#907258"
                  strokeWidth="4"
                />
                <rect
                  x="28"
                  y="-15"
                  width="38"
                  height="25"
                  rx="3"
                  fill="#3f5e5a"
                  stroke="#2e4542"
                  strokeWidth="4"
                />
                <rect
                  x="34"
                  y="-10"
                  width="26"
                  height="15"
                  fill={agent.accent}
                  opacity=".9"
                />
                <rect
                  x="42"
                  y="47"
                  width="12"
                  height="15"
                  rx="4"
                  fill="#88766d"
                />
                <rect
                  x="10"
                  y="10"
                  width="13"
                  height="20"
                  fill="#e7c6a2"
                  opacity=".7"
                />
              </g>
            );
          })}
          {/* plants */}
          <g fill="#709776" stroke="#52755d" strokeWidth="3">
            <path d="M73 91q-27-34-38-4q16 4 38 4M73 91q18-39 35-12q-8 13-35 12M73 91q-9-42-28-31q0 21 28 31" />
            <path d="M867 397q-27-34-38-4q16 4 38 4M867 397q18-39 35-12q-8 13-35 12M867 397q-9-42-28-31q0 21 28 31" />
          </g>
          <path
            d="M52 94h42l-5 28H57zM846 400h42l-5 28h-32z"
            fill="#c68462"
            stroke="#996149"
            strokeWidth="3"
          />
          {/* tiny wall labels */}
          <g fill="#897e72" fontSize="12" fontFamily="monospace">
            <text x="46" y="177">
              CAMPAIGN BAY
            </text>
            <text x="704" y="177">
              OPS NOOK
            </text>
            <text x="395" y="334">
              SYNC TABLE
            </text>
          </g>
        </svg>
        <div className="pixel-office__agents" aria-label="Office agents">
          {AGENTS.map((agent) => (
            <button
              type="button"
              className={`agent-hotspot ${selected === agent.name ? "is-selected" : ""}`}
              style={
                {
                  left: `${agent.x}%`,
                  top: `${agent.y}%`,
                  "--agent-color": agent.color,
                } as CSSProperties
              }
              key={agent.name}
              onClick={() => selectAgent(agent.name)}
              aria-label={`Select ${agent.name} agent, status ${statuses[agent.name]}`}
            >
              <span className="agent-hotspot__sprite">
                <b />
                <i />
              </span>
              <span className="agent-hotspot__name">{agent.name}</span>
              <small
                className={`agent-status agent-status--${statuses[agent.name] === "Awaiting approval" ? "approval" : statuses[agent.name].toLowerCase()}`}
              >
                {statuses[agent.name]}
              </small>
            </button>
          ))}
        </div>
      </div>
      {selectedAgent && (
        <div className="pixel-office__detail" role="status">
          <span
            className="detail-avatar"
            style={{ background: selectedAgent.color }}
          >
            {selectedAgent.name.slice(0, 1)}
          </span>
          <div>
            <strong>{selectedAgent.name}</strong>
            <span>{selectedAgent.role}</span>
          </div>
          <em>{statuses[selectedAgent.name]}</em>
        </div>
      )}
      {!compact && (
        <p className="pixel-office__note">
          A calm visual map of your local workspace. Statuses reflect workflow
          steps and approvals; no agents are running in the background.
        </p>
      )}
    </section>
  );
}

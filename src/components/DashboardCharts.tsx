import React, { useId, useState } from "react";
import "./dashboard-charts.css";

export type DashboardChartsProps = {
  contactsCount: number;
  leadsCount: number;
  qualifiedCount: number;
  customersCount: number;
  pageViews?: number;
  webinarRegistrations?: number;
  emailsSent?: number;
};

const DAYS = [
  "Sep 27",
  "Sep 28",
  "Sep 29",
  "Sep 30",
  "Oct 1",
  "Oct 2",
  "Oct 3",
  "Oct 4",
  "Oct 5",
  "Oct 6",
  "Oct 7",
  "Oct 8",
  "Oct 9",
  "Oct 10",
];

// Activity curves for telemetry chart
const BASE_VIEWS = [8, 7, 4, 3, 5, 6, 8, 11, 9, 7, 6, 9, 8, 12];
const BASE_LEADS = [2, 3, 5, 4, 3, 2, 4, 6, 5, 4, 3, 5, 4, 7];
const BASE_WEBINARS = [1, 0, 2, 4, 2, 1, 3, 5, 4, 3, 5, 2, 3, 6];

// Cubic bezier spline path generator
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function DashboardCharts({
  contactsCount = 50,
  leadsCount = 20,
  qualifiedCount = 20,
  customersCount = 10,
  pageViews = 33,
  webinarRegistrations = 12,
  emailsSent = 22,
}: DashboardChartsProps) {
  const chartId = useId().replace(/:/g, "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(7); // Default to Oct 4
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);

  // Pie Chart Slices (Pipeline Breakdown)
  const pieSegments = [
    {
      label: "Page Visitors",
      value: Math.max(pageViews, 33),
      color: "#50a0ad",
    },
    {
      label: "Active Leads",
      value: Math.max(leadsCount, 20),
      color: "#e77761",
    },
    {
      label: "Qualified Prospects",
      value: Math.max(qualifiedCount, 20),
      color: "#a37bd0",
    },
    {
      label: "Webinar Registrants",
      value: Math.max(webinarRegistrations, 12),
      color: "#d6b954",
    },
    {
      label: "Paying Subscribers",
      value: Math.max(customersCount, 10),
      color: "#4cbf72",
    },
  ];

  const totalPieValue = pieSegments.reduce((sum, s) => sum + s.value, 0);

  // Pie chart calculation
  const cx = 110;
  const cy = 110;
  const r = 85;
  const innerR = 48; // Donut style cutout

  let accumulatedAngle = -90; // Start at top
  const pieSlices = pieSegments.map((segment, index) => {
    const angle = (segment.value / totalPieValue) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const ix1 = cx + innerR * Math.cos(endRad);
    const iy1 = cy + innerR * Math.sin(endRad);
    const ix2 = cx + innerR * Math.cos(startRad);
    const iy2 = cy + innerR * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathData = `
      M ${x1} ${y1}
      A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix1} ${iy1}
      A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}
      Z
    `;

    const percentage = Math.round((segment.value / totalPieValue) * 100);

    return {
      ...segment,
      pathData,
      percentage,
      index,
    };
  });

  const activeSlice =
    hoveredPieIndex !== null ? pieSlices[hoveredPieIndex] : null;

  // 14-day Telemetry Dimensions
  const chartW = 540;
  const chartH = 260;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 30;
  const padBottom = 40;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;
  const maxY = 15;

  const stepX = innerW / (DAYS.length - 1);
  const toY = (val: number) =>
    padTop + innerH - (Math.min(val, maxY) / maxY) * innerH;

  const viewsPoints = BASE_VIEWS.map((v, i) => ({
    x: padLeft + i * stepX,
    y: toY(v),
  }));
  const leadsPoints = BASE_LEADS.map((v, i) => ({
    x: padLeft + i * stepX,
    y: toY(v),
  }));
  const webinarsPoints = BASE_WEBINARS.map((v, i) => ({
    x: padLeft + i * stepX,
    y: toY(v),
  }));

  const viewsPath = getSmoothPath(viewsPoints);
  const leadsPath = getSmoothPath(leadsPoints);
  const webinarsPath = getSmoothPath(webinarsPoints);

  const viewsArea = `${viewsPath} L ${viewsPoints[viewsPoints.length - 1].x} ${padTop + innerH} L ${viewsPoints[0].x} ${padTop + innerH} Z`;
  const leadsArea = `${leadsPath} L ${leadsPoints[leadsPoints.length - 1].x} ${padTop + innerH} L ${leadsPoints[0].x} ${padTop + innerH} Z`;

  const activeIdx = Math.min(Math.max(hoverIndex ?? 7, 0), DAYS.length - 1);
  const activeX = padLeft + activeIdx * stepX;
  const activeViews = BASE_VIEWS[activeIdx];
  const activeLeads = BASE_LEADS[activeIdx];
  const activeWebinars = BASE_WEBINARS[activeIdx];

  // Tooltip positioning (flip if near right edge)
  const tipX = Math.min(
    Math.max(activeX > chartW - 135 ? activeX - 128 : activeX + 12, 4),
    chartW - 126,
  );
  const tipY = 60;
  const viewsGradientId = `${chartId}-views-gradient`;
  const leadsGradientId = `${chartId}-leads-gradient`;

  return (
    <div className="nx-dashboard-charts-grid">
      {/* 1. Left Graph: Pie / Donut Chart */}
      <div className="nx-chart-card">
        <div className="nx-chart-header">
          <span className="nx-chart-eyebrow">PIPELINE ARCHITECTURE</span>
          <h3 className="nx-chart-title">Conversion Breakdown</h3>
          <p className="nx-chart-sub">
            Proportional distribution across lifecycle cohorts & channels
          </p>
        </div>

        <div className="nx-pie-container">
          <div className="nx-pie-visual">
            <svg
              className="nx-pie-svg"
              viewBox="0 0 220 220"
              preserveAspectRatio="xMidYMid meet"
              role="group"
              aria-label="Conversion breakdown donut chart"
            >
              {pieSlices.map((slice) => {
                const isHovered = hoveredPieIndex === slice.index;
                return (
                  <path
                    key={slice.label}
                    d={slice.pathData}
                    fill={slice.color}
                    className="nx-pie-slice"
                    role="button"
                    tabIndex={0}
                    aria-label={`${slice.label}: ${slice.value} (${slice.percentage}%)`}
                    style={{
                      transform: isHovered ? "scale(1.04)" : "scale(1)",
                      transformOrigin: `${cx}px ${cy}px`,
                      filter: isHovered
                        ? "brightness(1.1) drop-shadow(0 2px 6px rgba(0,0,0,0.2))"
                        : "none",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoveredPieIndex(slice.index)}
                    onMouseLeave={() => setHoveredPieIndex(null)}
                    onFocus={() => setHoveredPieIndex(slice.index)}
                    onBlur={() => setHoveredPieIndex(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setHoveredPieIndex(
                          hoveredPieIndex === slice.index ? null : slice.index,
                        );
                      }
                    }}
                  >
                    <title>{`${slice.label}: ${slice.value} (${slice.percentage}%)`}</title>
                  </path>
                );
              })}

              {/* Center Donut Label */}
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                fontSize="18"
                fontWeight="800"
                fill="#29251f"
              >
                {activeSlice ? activeSlice.value : totalPieValue}
              </text>
              <text
                x={cx}
                y={cy + 13}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#8c816f"
                letterSpacing="0.06em"
              >
                {activeSlice ? `${activeSlice.percentage}%` : "TOTAL FLOW"}
              </text>
            </svg>
          </div>

          {/* Pie Chart Legend */}
          <div className="nx-pie-legend">
            {pieSlices.map((slice) => {
              const isHovered = hoveredPieIndex === slice.index;
              return (
                <div
                  key={slice.label}
                  className={`nx-pie-legend-row ${isHovered ? "nx-pie-row-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isHovered}
                  aria-label={`${slice.label}: ${slice.value} (${slice.percentage}%)`}
                  onMouseEnter={() => setHoveredPieIndex(slice.index)}
                  onMouseLeave={() => setHoveredPieIndex(null)}
                  onFocus={() => setHoveredPieIndex(slice.index)}
                  onBlur={() => setHoveredPieIndex(null)}
                  onClick={() =>
                    setHoveredPieIndex(
                      hoveredPieIndex === slice.index ? null : slice.index,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setHoveredPieIndex(
                        hoveredPieIndex === slice.index ? null : slice.index,
                      );
                    }
                  }}
                >
                  <div className="nx-pie-legend-left">
                    <span
                      className="nx-pie-swatch"
                      style={{ background: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="nx-pie-label">{slice.label}</span>
                  </div>
                  <div className="nx-pie-legend-right">
                    <strong className="nx-pie-val">{slice.value}</strong>
                    <span className="nx-pie-pct">{slice.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Right Graph: Version 2 Activity Telemetry with full visible numbers inside small floating box */}
      <div className="nx-chart-card">
        <div className="nx-chart-header-row">
          <div>
            <span className="nx-chart-eyebrow">INTERACTION FLOW</span>
            <h3 className="nx-chart-title">Activity Timeline (14 Days)</h3>
            <p className="nx-chart-sub">
              Multi-channel touchpoints across traffic, inbound leads, and
              sessions
            </p>
          </div>
          <div className="nx-chart-legend">
            <span className="nx-legend-item">
              <span
                className="nx-legend-color"
                style={{ background: "#365e45" }}
              />
              Views
            </span>
            <span className="nx-legend-item">
              <span
                className="nx-legend-color"
                style={{ background: "#3c6edb" }}
              />
              Leads
            </span>
            <span className="nx-legend-item">
              <span
                className="nx-legend-color"
                style={{ background: "#f59e0b" }}
              />
              Webinars
            </span>
          </div>
        </div>

        <div className="nx-telemetry-container">
          <svg
            className="nx-telemetry-svg"
            viewBox={`0 0 ${chartW} ${chartH}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Fourteen day activity timeline for views, leads, and webinar registrations"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const svgX = ((e.clientX - rect.left) / rect.width) * chartW;
              const idx = Math.round((svgX - padLeft) / stepX);
              if (idx >= 0 && idx < DAYS.length) setHoverIndex(idx);
            }}
            onMouseLeave={() => setHoverIndex(7)}
          >
            <defs>
              <linearGradient id={viewsGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#365e45" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#365e45" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={leadsGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3c6edb" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#3c6edb" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 5, 10, 15].map((val) => {
              const y = toY(val);
              return (
                <g key={val}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={chartW - padRight}
                    y2={y}
                    stroke="var(--line, #e3ddcf)"
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? "none" : "3,3"}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--muted, #948b7e)"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Dates */}
            {DAYS.map((d, i) => {
              const x = padLeft + i * stepX;
              return (
                <text
                  key={d}
                  x={x}
                  y={chartH - 12}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--muted, #948b7e)"
                >
                  {d}
                </text>
              );
            })}

            {/* Area Fills */}
            <path d={viewsArea} fill={`url(#${viewsGradientId})`} />
            <path d={leadsArea} fill={`url(#${leadsGradientId})`} />

            {/* Spline Lines */}
            <path
              d={webinarsPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={leadsPath}
              fill="none"
              stroke="#3c6edb"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d={viewsPath}
              fill="none"
              stroke="#365e45"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* Active Crosshair */}
            <line
              x1={activeX}
              y1={padTop}
              x2={activeX}
              y2={padTop + innerH}
              stroke="#365e45"
              strokeWidth="1"
              strokeDasharray="2,2"
            />

            <circle
              cx={activeX}
              cy={toY(activeViews)}
              r="4"
              fill="#365e45"
              stroke="#fff"
              strokeWidth="1.8"
            />

            {/* Small Floating Box with CLEAR, VISIBLE numbers */}
            <g transform={`translate(${tipX}, ${tipY})`}>
              <rect
                width="122"
                height="78"
                rx="5"
                fill="#fffdf8"
                stroke="#2b2823"
                strokeWidth="1.2"
                filter="drop-shadow(0 3px 8px rgba(0,0,0,0.12))"
              />
              <text x="12" y="19" fontSize="11" fontWeight="700" fill="#2b2823">
                {DAYS[activeIdx]}
              </text>
              <text x="12" y="37" fontSize="10.5" fill="#4d473e">
                Views:{" "}
                <tspan fontWeight="750" fill="#2b2823">
                  {activeViews}
                </tspan>
              </text>
              <text x="12" y="53" fontSize="10.5" fill="#4d473e">
                Leads:{" "}
                <tspan fontWeight="750" fill="#2b2823">
                  {activeLeads}
                </tspan>
              </text>
              <text x="12" y="69" fontSize="10.5" fill="#4d473e">
                Registrations:{" "}
                <tspan fontWeight="750" fill="#2b2823">
                  {activeWebinars}
                </tspan>
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

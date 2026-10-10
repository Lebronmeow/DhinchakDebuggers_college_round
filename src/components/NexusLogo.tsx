export function NexusLogo({
  className = "",
  size = "medium",
}: {
  className?: string;
  size?: "small" | "medium" | "large";
}) {
  const height = size === "small" ? 16 : size === "large" ? 30 : 22;
  return (
    <svg
      className={`nexus-logo ${className}`}
      height={height}
      viewBox="0 0 210 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-label="NEXUS"
    >
      {/* N */}
      <path
        d="M 6 34 V 4 L 32 34 V 4"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* E (Three horizontal bars) */}
      <path
        d="M 44 5 H 74 M 44 19 H 74 M 44 33 H 74"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* X */}
      <path
        d="M 86 5 L 114 33 M 114 5 L 86 33"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* U */}
      <path
        d="M 126 5 V 20 C 126 29 133 34 142 34 C 151 34 158 29 158 20 V 5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* S */}
      <path
        d="M 200 11 C 196 4 172 4 172 15 C 172 26 202 22 202 31 C 202 39 178 39 172 32"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

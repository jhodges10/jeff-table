import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  "aria-hidden": true,
  fill: "none",
  height: 16,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.75,
  viewBox: "0 0 24 24",
  width: 16,
};

export function ColumnsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  );
}

export function DragIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="9" cy="7" fill="currentColor" r="1" stroke="none" />
      <circle cx="15" cy="7" fill="currentColor" r="1" stroke="none" />
      <circle cx="9" cy="12" fill="currentColor" r="1" stroke="none" />
      <circle cx="15" cy="12" fill="currentColor" r="1" stroke="none" />
      <circle cx="9" cy="17" fill="currentColor" r="1" stroke="none" />
      <circle cx="15" cy="17" fill="currentColor" r="1" stroke="none" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function SortIcon({
  direction,
  ...props
}: IconProps & { direction?: "asc" | "desc" | undefined }) {
  return (
    <svg {...baseProps} {...props} data-direction={direction ?? "none"}>
      {direction === "asc" ? <path d="m8 14 4-4 4 4" /> : null}
      {direction === "desc" ? <path d="m8 10 4 4 4-4" /> : null}
      {direction === undefined ? <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" /> : null}
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} className={["jt-spinner", props.className].filter(Boolean).join(" ")}>
      <circle cx="12" cy="12" opacity=".25" r="9" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

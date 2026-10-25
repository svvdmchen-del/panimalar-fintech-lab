import type { ReactNode } from "react";
import { pct, pctOf, signed, toneClass } from "@/lib/format";
import type { DataStatus } from "@/lib/types";

export function Panel({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-panel/90 shadow-[var(--shadow-panel)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/75">
            {title}
          </h2>
          {subtitle ? <div className="truncate text-[11px] text-muted">{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {actions}
        </div>
      </header>
      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<DataStatus, { label: string; className: string; dot: string }> = {
  live: { label: "LIVE", className: "border-up/40 bg-up/10 text-up", dot: "bg-up" },
  delayed: { label: "DELAYED", className: "border-accent/40 bg-accent/10 text-accent", dot: "bg-accent" },
  demo: { label: "DEMO", className: "border-line-strong bg-wash/5 text-muted", dot: "bg-muted" },
};

export function DataBadge({ status, source }: { status: DataStatus; source?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      title={source ? `Source: ${source}` : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] ${style.className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

export function Delta({
  change,
  changePct,
  className = "",
}: {
  change: number;
  changePct: number;
  className?: string;
}) {
  const color = toneClass(changePct);
  const arrow = changePct > 0 ? "▲" : changePct < 0 ? "▼" : "■";
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-mono tabular-nums ${color} ${className}`}>
      <span className="text-[11px] leading-none" aria-hidden>
        {arrow}
      </span>
      <span>{signed(change)}</span>
      <span className="opacity-80">({pct(changePct)})</span>
    </span>
  );
}

/** Day low/high rail with the last price marker and previous close tick. */
export function RangeBar({
  low,
  high,
  value,
  prevClose,
  showLabels = false,
}: {
  low: number;
  high: number;
  value: number;
  prevClose?: number;
  showLabels?: boolean;
}) {
  const position = pctOf(value, low, high);
  const prevPosition = prevClose ? pctOf(prevClose, low, high) : null;
  const tone = value >= (prevClose ?? low) ? "bg-up" : "bg-down";

  return (
    <div className="w-full">
      <div className="relative h-1 w-full rounded-full bg-track/60">
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone} opacity-45`} style={{ width: `${position}%` }} />
        {prevPosition !== null ? (
          <span
            className="absolute -top-1 h-3 w-px bg-ink/45"
            style={{ left: `${prevPosition}%` }}
            aria-hidden
          />
        ) : null}
        <span
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg bg-ink"
          style={{ left: `${position}%` }}
          aria-hidden
        />
      </div>
      {showLabels ? (
        <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-muted">
          <span>{low.toFixed(2)}</span>
          <span>{high.toFixed(2)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} aria-hidden />;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center px-4 py-8 text-center text-xs text-muted">
      {children}
    </div>
  );
}

export function Sparkline({
  values,
  width = 72,
  height = 22,
  positive,
}: {
  values: number[];
  width?: number;
  height?: number;
  positive: boolean;
}) {
  if (values.length < 2) return <div style={{ width, height }} aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--color-up)" : "var(--color-down)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

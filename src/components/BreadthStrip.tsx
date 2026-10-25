import type { IndexQuote } from "@/lib/types";

/** Full-width advance/decline rail for the benchmark index. */
export function BreadthStrip({ index }: { index?: IndexQuote }) {
  if (!index) return null;

  const advances = index.advances ?? 0;
  const declines = index.declines ?? 0;
  const unchanged = index.unchanged ?? 0;
  const total = advances + declines + unchanged || 1;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/60 px-3.5 py-2 text-[10px]">
      <span className="font-semibold uppercase tracking-[0.14em] text-muted">Market breadth</span>
      <span className="whitespace-nowrap text-muted/80">{index.symbol}</span>

      <div className="flex h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-track/40" aria-hidden>
        <span className="bg-up" style={{ width: `${(advances / total) * 100}%` }} />
        <span className="bg-track" style={{ width: `${(unchanged / total) * 100}%` }} />
        <span className="bg-down" style={{ width: `${(declines / total) * 100}%` }} />
      </div>

      <div className="flex items-center gap-3 font-mono tabular-nums">
        <span className="text-up">{advances} adv</span>
        <span className="text-muted/50">{unchanged} unch</span>
        <span className="text-down">{declines} dec</span>
      </div>
    </div>
  );
}

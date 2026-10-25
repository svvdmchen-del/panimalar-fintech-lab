"use client";

import { num, pct, toneClass } from "@/lib/format";
import { INDEX_CARDS } from "@/lib/symbols";
import type { IndexQuote } from "@/lib/types";
import { RangeBar, Skeleton } from "./ui";

export function IndexStrip({
  indices,
  loading,
  onSelect,
}: {
  indices: IndexQuote[];
  loading: boolean;
  onSelect: (symbol: string) => void;
}) {
  const byName = new Map(indices.map((index) => [index.symbol, index]));

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
      {INDEX_CARDS.map((card) => {
        const index = byName.get(card.symbol);
        if (!index) {
          return (
            <div key={card.symbol} className="rounded-xl border border-line bg-panel/80 p-3">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-3 h-5 w-24" />
              <Skeleton className="mt-3 h-1 w-full" />
            </div>
          );
        }

        const isVix = card.symbol === "INDIA VIX";
        const total = (index.advances ?? 0) + (index.declines ?? 0) + (index.unchanged ?? 0);

        return (
          <button
            key={card.symbol}
            type="button"
            onClick={() => onSelect(card.symbol)}
            className="group rounded-xl border border-line bg-panel/80 p-3 text-left transition-colors hover:border-line-strong hover:bg-panel2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                {card.label}
              </span>
              <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted/50">{card.hint}</span>
            </div>

            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[19px] leading-none tabular-nums text-ink">
                {num(index.last, isVix ? 2 : 2)}
              </span>
              <span className={`font-mono text-[12px] tabular-nums ${toneClass(index.changePct)}`}>
                {pct(index.changePct)}
              </span>
            </div>

            <div className="mt-2.5">
              <RangeBar low={index.low} high={index.high} value={index.last} prevClose={index.prevClose} />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
              {total > 0 ? (
                <span className="font-mono tabular-nums">
                  <span className="text-up">{index.advances ?? 0}</span>
                  <span className="mx-1 text-muted/50">/</span>
                  <span className="text-down">{index.declines ?? 0}</span>
                  <span className="ml-1 text-muted/50">adv/dec</span>
                </span>
              ) : (
                <span className="font-mono tabular-nums">
                  {index.yearLow ? `${num(index.yearLow, 0)} – ${num(index.yearHigh, 0)}` : "—"}
                </span>
              )}
              <span className="tabular-nums text-muted/60">{num(index.change, 2)}</span>
            </div>
          </button>
        );
      })}
      {loading && !indices.length ? null : null}
    </div>
  );
}

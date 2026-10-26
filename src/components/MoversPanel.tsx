"use client";

import { useState } from "react";
import { compact, price, pct, toneClass } from "@/lib/format";
import type { Mover, Movers } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";

type Tab = "gainers" | "losers" | "volume";

const TABS: { id: Tab; label: string }[] = [
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "volume", label: "Volume" },
];

export function MoversPanel({
  movers,
  loading,
  badge,
  onSelect,
}: {
  movers?: Movers;
  loading: boolean;
  badge?: React.ReactNode;
  onSelect: (symbol: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("gainers");
  const rows: Mover[] = movers?.[tab] ?? [];
  const maxPct = rows.reduce((max, row) => Math.max(max, Math.abs(row.changePct)), 0.01);

  return (
    <Panel
      title="Movers"
      popoutWidget="movers"
      subtitle="NIFTY 50 universe"
      badge={badge}
      actions={
        <div className="flex overflow-hidden rounded-md border border-line bg-panel2" role="tablist" aria-label="Movers">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={`px-2 py-1 text-[10px] transition-colors ${
                tab === option.id ? "bg-cyan/15 text-cyan" : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2"
    >
      {!rows.length && loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <Empty>No movers data.</Empty>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((row, index) => (
            <li key={`${tab}-${row.symbol}`}>
              <button
                type="button"
                onClick={() => onSelect(row.symbol)}
                className="group relative flex w-full items-center gap-2 overflow-hidden rounded-md px-1.5 py-1 text-left transition-colors hover:bg-wash/[0.04]"
              >
                <span className="w-3 shrink-0 font-mono text-[9px] text-muted/50">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-ink group-hover:text-cyan">
                      {row.symbol}
                    </span>
                    <span className={`shrink-0 font-mono text-[11px] tabular-nums ${toneClass(row.changePct)}`}>
                      {pct(row.changePct)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tabular-nums text-muted">{price(row.price)}</span>
                    <span className="font-mono text-[9px] tabular-nums text-muted/60">
                      {tab === "volume" ? compact(row.volume) : `${(row.volume / 1e6).toFixed(1)}M`}
                    </span>
                  </span>
                </span>
                <span
                  className={`absolute bottom-0 left-1.5 h-px ${row.changePct >= 0 ? "bg-up/60" : "bg-down/60"}`}
                  style={{ width: `${Math.max(4, (Math.abs(row.changePct) / maxPct) * 90)}%` }}
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

"use client";

import { useState } from "react";
import { compact, price, pct, toneClass } from "@/lib/format";
import type { Mover, Movers } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";

export type MoverTab = "gainers" | "losers" | "high52" | "low52" | "volume";

const TABS: { id: MoverTab; label: string; title: string }[] = [
  { id: "gainers", label: "Gainers", title: "Top intraday percentage advancers" },
  { id: "losers", label: "Losers", title: "Top intraday percentage decliners" },
  { id: "high52", label: "52W High", title: "Stocks trading at or within 2.5% of 52-week peak" },
  { id: "low52", label: "52W Low", title: "Stocks trading at or within 2.5% of 52-week bottom" },
  { id: "volume", label: "Volume", title: "Heavy volume trading leaders" },
];

export function MoversPanel({
  movers,
  loading,
  badge,
  universe = "NIFTY 500",
  onUniverseChange,
  onSelect,
  onDetails,
}: {
  movers?: Movers;
  loading: boolean;
  badge?: React.ReactNode;
  universe?: "NIFTY 50" | "NIFTY 500";
  onUniverseChange?: (u: "NIFTY 50" | "NIFTY 500") => void;
  onSelect: (symbol: string) => void;
  onDetails?: (symbol: string) => void;
}) {
  const [tab, setTab] = useState<MoverTab>("gainers");
  const rows: Mover[] = (movers?.[tab] as Mover[] | undefined) ?? [];
  const maxPct = rows.reduce((max, row) => Math.max(max, Math.abs(row.changePct)), 0.01);

  return (
    <Panel
      title="Market Radar & Movers"
      subtitle={
        <div className="flex items-center gap-2">
          <span>{universe} scan</span>
          {onUniverseChange ? (
            <div className="inline-flex rounded border border-line bg-panel2/80 p-0.5 text-[9px]">
              <button
                type="button"
                onClick={() => onUniverseChange("NIFTY 50")}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  universe === "NIFTY 50"
                    ? "bg-cyan/20 font-bold text-cyan shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                NIFTY 50
              </button>
              <button
                type="button"
                onClick={() => onUniverseChange("NIFTY 500")}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  universe === "NIFTY 500"
                    ? "bg-cyan/20 font-bold text-cyan shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                NIFTY 500
              </button>
            </div>
          ) : null}
        </div>
      }
      badge={badge}
      actions={
        <div
          className="flex overflow-x-auto rounded-md border border-line bg-panel2 no-scrollbar"
          role="tablist"
          aria-label="Market Movers and 52-Week Radar"
        >
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              title={option.title}
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={`px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors ${
                tab === option.id ? "bg-cyan/15 text-cyan border-b-2 border-cyan" : "text-muted hover:text-ink"
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
        <Empty>No {tab === "high52" ? "52W High" : tab === "low52" ? "52W Low" : tab} data found in {universe}.</Empty>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((row, index) => {
            const is52WHigh = tab === "high52";
            const is52WLow = tab === "low52";
            const nearHigh = typeof row.pctFromHigh === "number" && row.pctFromHigh >= -1.0;
            const nearLow = typeof row.pctFromLow === "number" && row.pctFromLow <= 1.0;

            return (
              <li key={`${tab}-${row.symbol}`}>
                <button
                  type="button"
                  onClick={() => onSelect(row.symbol)}
                  onDoubleClick={() => onDetails?.(row.symbol)}
                  className="group relative flex w-full items-center gap-2 overflow-hidden rounded-md px-1.5 py-1 text-left transition-colors hover:bg-wash/[0.04]"
                >
                  <span className="w-3 shrink-0 font-mono text-[9px] text-muted/50">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="truncate text-[11px] font-semibold text-ink group-hover:text-cyan">
                          {row.symbol}
                        </span>
                        {is52WHigh ? (
                          <span
                            className={`rounded px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider ${
                              nearHigh ? "bg-up/20 text-up border border-up/30" : "bg-cyan/15 text-cyan"
                            }`}
                          >
                            {nearHigh ? "🔥 Peak" : `${row.pctFromHigh?.toFixed(1)}%`}
                          </span>
                        ) : is52WLow ? (
                          <span
                            className={`rounded px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider ${
                              nearLow ? "bg-down/20 text-down border border-down/30" : "bg-accent/15 text-accent"
                            }`}
                          >
                            {nearLow ? "⚠️ Low" : `+${row.pctFromLow?.toFixed(1)}%`}
                          </span>
                        ) : null}
                      </span>

                      <span className={`shrink-0 font-mono text-[11px] tabular-nums ${toneClass(row.changePct)}`}>
                        {pct(row.changePct)}
                      </span>
                    </span>

                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] tabular-nums text-muted">
                        {price(row.price)}
                        {is52WHigh && row.yearHigh ? (
                          <span className="ml-1 text-[9px] text-muted/50">
                            (52W H: {price(row.yearHigh)})
                          </span>
                        ) : is52WLow && row.yearLow ? (
                          <span className="ml-1 text-[9px] text-muted/50">
                            (52W L: {price(row.yearLow)})
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-muted/60">
                        {tab === "volume"
                          ? compact(row.volume)
                          : is52WHigh && row.pctFromHigh !== undefined
                          ? `${row.pctFromHigh >= 0 ? "+" : ""}${row.pctFromHigh.toFixed(1)}% off H`
                          : is52WLow && row.pctFromLow !== undefined
                          ? `+${row.pctFromLow.toFixed(1)}% off L`
                          : `${(row.volume / 1e6).toFixed(1)}M`}
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
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

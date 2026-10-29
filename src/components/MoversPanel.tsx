"use client";

import { useMemo, useState } from "react";
import { compact, price, pct, toneClass } from "@/lib/format";
import { SYMBOL_UNIVERSE } from "@/lib/symbols";
import type { Mover, Movers, Quote } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";
import { DayRangeTrend } from "./DayRangeTrend";

type Tab = "gainers" | "losers" | "volume";
type DeskFilter = "all" | "gainers" | "losers" | "volume" | "banking" | "it" | "auto";

const TABS: { id: Tab; label: string }[] = [
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "volume", label: "Volume" },
];

const DESK_FILTERS: { key: DeskFilter; label: string }[] = [
  { key: "all", label: "All Movers" },
  { key: "gainers", label: "▲ Gainers" },
  { key: "losers", label: "▼ Losers" },
  { key: "volume", label: "⚡ High Volume" },
  { key: "banking", label: "Banking" },
  { key: "it", label: "IT" },
  { key: "auto", label: "Auto" },
];

const SECTOR_BY_SYMBOL = new Map(SYMBOL_UNIVERSE.map((item) => [item.symbol, item.sector]));

export function MoversPanel({
  movers,
  quotes = [],
  loading,
  badge,
  selected,
  onSelect,
  onDetails,
  fullView = false,
}: {
  movers?: Movers;
  quotes?: Quote[];
  loading: boolean;
  badge?: React.ReactNode;
  selected?: string;
  onSelect: (symbol: string) => void;
  onDetails?: (symbol: string) => void;
  fullView?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("gainers");
  const [deskFilter, setDeskFilter] = useState<DeskFilter>("gainers");
  const [searchQuery, setSearchQuery] = useState("");

  const quoteMap = useMemo(() => new Map(quotes.map((q) => [q.symbol, q])), [quotes]);

  // Combine universe of movers for fullView mode
  const allMoversList = useMemo(() => {
    if (!movers) return [];
    const seen = new Set<string>();
    const list: Mover[] = [];

    const addList = (sourceList: Mover[] = []) => {
      for (const m of sourceList) {
        if (!seen.has(m.symbol)) {
          seen.add(m.symbol);
          list.push(m);
        }
      }
    };

    if (deskFilter === "gainers") return movers.gainers ?? [];
    if (deskFilter === "losers") return movers.losers ?? [];
    if (deskFilter === "volume") return movers.volume ?? [];

    // "all" or sector filter: combine gainers, losers, and volume
    addList(movers.gainers);
    addList(movers.losers);
    addList(movers.volume);

    if (deskFilter === "banking") {
      return list.filter((m) => SECTOR_BY_SYMBOL.get(m.symbol) === "Banking");
    }
    if (deskFilter === "it") {
      return list.filter((m) => SECTOR_BY_SYMBOL.get(m.symbol) === "IT");
    }
    if (deskFilter === "auto") {
      return list.filter((m) => SECTOR_BY_SYMBOL.get(m.symbol) === "Auto");
    }

    return list;
  }, [movers, deskFilter]);

  const filteredDeskRows = useMemo(() => {
    if (!searchQuery.trim()) return allMoversList;
    const q = searchQuery.trim().toUpperCase();
    return allMoversList.filter(
      (m) => m.symbol.toUpperCase().includes(q) || (m.name && m.name.toUpperCase().includes(q)),
    );
  }, [allMoversList, searchQuery]);

  // --- FULL VIEW (MATCHING WATCHLIST VIEW ON UNDOCKING) ---
  if (fullView) {
    return (
      <Panel
        title="Market Movers & Radar"
        subtitle={`${filteredDeskRows.length} active movers · NIFTY universe · click to chart`}
        badge={badge}
        actions={
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movers…"
              aria-label="Filter movers"
              className="w-32 rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-ink placeholder:text-muted/60 focus:w-44 focus:outline-none focus:ring-1 focus:ring-cyan/50 sm:w-36 transition-all"
            />
          </div>
        }
        bodyClassName="overflow-x-auto p-0 flex flex-col h-full"
      >
        {/* Quick Movers & Sector Filter Tabs (Same as Watchlist) */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line/60 bg-panel2/40 px-3 py-1.5 no-scrollbar shrink-0">
          {DESK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setDeskFilter(f.key)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                deskFilter === f.key
                  ? "border border-cyan/40 bg-cyan/15 text-cyan"
                  : "border border-transparent text-muted hover:bg-wash/5 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading / Empty States */}
        {!filteredDeskRows.length && loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : !filteredDeskRows.length ? (
          <div className="p-6">
            <Empty>No market movers match the selected filter.</Empty>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-panel border-b border-line">
                <tr className="text-[10px] uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Symbol</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">LTP</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Chg %</th>
                  <th scope="col" className="hidden md:table-cell px-3 py-2 text-left font-medium">Day Range & Trend</th>
                  <th scope="col" className="hidden lg:table-cell px-3 py-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeskRows.map((mover) => {
                  const quote = quoteMap.get(mover.symbol);
                  const isSelected = selected === mover.symbol;

                  const ltp = mover.price;
                  const changePct = mover.changePct;
                  const change = mover.change || (quote ? quote.change : (ltp * changePct) / (100 + changePct));
                  const prevClose = quote?.prevClose ?? (ltp - change);
                  const open = quote?.open ?? prevClose;
                  const high = quote?.high ?? Math.max(ltp, open, prevClose);
                  const low = quote?.low ?? Math.min(ltp, open, prevClose);
                  const volume = mover.volume || quote?.volume || 0;
                  const companyName = quote?.name ?? mover.name ?? mover.symbol;

                  return (
                    <tr
                      key={mover.symbol}
                      onClick={() => onSelect(mover.symbol)}
                      className={`group cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-wash/[0.04] ${
                        isSelected ? "bg-cyan/[0.07]" : ""
                      }`}
                    >
                      {/* Symbol Column */}
                      <td className="relative px-3 py-2">
                        {isSelected ? (
                          <span className="absolute inset-y-0 left-0 w-0.5 bg-cyan" aria-hidden />
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (onDetails) onDetails(mover.symbol);
                            else onSelect(mover.symbol);
                          }}
                          className="block max-w-[10rem] truncate text-left font-semibold text-ink group-hover:text-cyan sm:max-w-[15rem]"
                          title={`Open ${mover.symbol} details`}
                        >
                          {mover.symbol}
                        </button>
                        <span className="block max-w-[10rem] truncate text-[10px] text-muted sm:max-w-[15rem]">
                          {companyName}
                        </span>
                      </td>

                      {/* LTP Column */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink font-medium">
                        {price(ltp)}
                      </td>

                      {/* Chg % Column */}
                      <td className={`px-3 py-2 text-right font-mono tabular-nums ${toneClass(changePct)}`}>
                        <span className="block font-semibold">{pct(changePct)}</span>
                        <span className="block text-[10px] opacity-75">
                          {change > 0 ? "+" : ""}
                          {change.toFixed(2)}
                        </span>
                      </td>

                      {/* Day Range & Trend Column (Stacked Sparkline + Range Numbers) */}
                      <td className="hidden w-44 px-3 py-1.5 md:table-cell">
                        <DayRangeTrend
                          symbol={mover.symbol}
                          open={open}
                          low={low}
                          high={high}
                          current={ltp}
                          prevClose={prevClose}
                        />
                      </td>

                      {/* Volume Column */}
                      <td className="hidden px-3 py-2 text-right font-mono tabular-nums text-muted lg:table-cell">
                        {compact(volume)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  // --- COMPACT VIEW (DEFAULT FOR MAIN HOME DASHBOARD) ---
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

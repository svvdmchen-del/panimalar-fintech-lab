"use client";

import { useMemo, useState } from "react";
import { compact, num, price } from "@/lib/format";
import type { OptionChain, OptionStrike } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";

export function OptionChainPanel({
  chain,
  loading,
  badge,
  underlying,
  onUnderlyingChange,
  expiry,
  onExpiryChange,
}: {
  chain?: OptionChain;
  loading: boolean;
  badge?: React.ReactNode;
  underlying: string;
  onUnderlyingChange: (symbol: string) => void;
  expiry?: string;
  onExpiryChange?: (expiry: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"table" | "greeks" | "chart">("table");
  const [strikeWindow, setStrikeWindow] = useState<number>(5);

  const availableExpiries = chain?.expiries ?? [];
  const activeExpiry = expiry || chain?.expiry || availableExpiries[0] || "";

  // Compute active strikes based on selected strikeWindow
  const allStrikes = chain?.allStrikes && chain.allStrikes.length ? chain.allStrikes : chain?.strikes ?? [];
  const rows: OptionStrike[] = useMemo(() => {
    if (!allStrikes.length) return [];
    if (strikeWindow === 0) return allStrikes; // All strikes

    const target = chain?.atmStrike ?? chain?.underlying ?? 0;
    let best = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    allStrikes.forEach((row, index) => {
      const delta = Math.abs(row.strike - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    });

    return allStrikes.slice(Math.max(0, best - strikeWindow), best + strikeWindow + 1);
  }, [allStrikes, chain?.atmStrike, chain?.underlying, strikeWindow]);

  const maxCeWindow = Math.max(1, ...rows.map((row) => row.ce.oi));
  const maxPeWindow = Math.max(1, ...rows.map((row) => row.pe.oi));
  const overallMaxOi = Math.max(maxCeWindow, maxPeWindow);

  // Sentiment interpretation based on PCR
  const pcr = chain?.pcr ?? 0;
  const sentiment =
    pcr >= 1.2
      ? { label: "Bullish", tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" }
      : pcr <= 0.8
      ? { label: "Bearish", tone: "text-rose-400 bg-rose-500/10 border-rose-500/30" }
      : { label: "Neutral", tone: "text-amber-400 bg-amber-500/10 border-amber-500/30" };

  const straddlePremium = chain?.straddlePremium ?? 0;
  const expectedMovePct = chain?.expectedMovePct ?? 0;
  const lowerBreakeven = chain?.lowerBreakeven ?? (chain ? chain.underlying - straddlePremium : 0);
  const upperBreakeven = chain?.upperBreakeven ?? (chain ? chain.underlying + straddlePremium : 0);
  const maxPain = chain?.maxPain ?? chain?.atmStrike;

  return (
    <Panel
      title="Option chain"
      popoutWidget="options"
      subtitle={chain ? `${chain.symbol} · ${activeExpiry}` : "NSE F&O"}
      badge={badge}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Expiry Selector */}
          {availableExpiries.length > 0 && onExpiryChange && (
            <select
              value={activeExpiry}
              onChange={(e) => onExpiryChange(e.target.value)}
              aria-label="Option chain expiry"
              className="rounded-md border border-line bg-panel2 px-1.5 py-1 text-[10px] text-ink focus:outline-none focus:ring-1 focus:ring-cyan/50"
            >
              {availableExpiries.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          )}

          {/* Underlying Index Selector */}
          <select
            value={underlying}
            onChange={(event) => onUnderlyingChange(event.target.value)}
            aria-label="Option chain underlying"
            className="rounded-md border border-line bg-panel2 px-1.5 py-1 text-[10px] text-ink focus:outline-none focus:ring-1 focus:ring-cyan/50"
          >
            {["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      }
      bodyClassName="p-0 flex flex-col"
    >
      {!rows.length && loading ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <Empty>Option chain unavailable right now.</Empty>
      ) : (
        <>
          {/* Subheader Controls & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-line/70 bg-panel2/50 px-3 py-1 text-[10px]">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border border-line bg-panel p-0.5 text-[9px]">
              {(["table", "greeks", "chart"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-1.5 py-0.5 font-medium uppercase tracking-wider transition-colors ${
                    viewMode === mode
                      ? "bg-accent/20 text-accent font-semibold"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {mode === "table" ? "Table" : mode === "greeks" ? "Greeks / IV" : "OI Chart"}
                </button>
              ))}
            </div>

            {/* Strike Window Selector */}
            <div className="flex items-center gap-1 text-[9px] text-muted">
              <span>Strikes:</span>
              <div className="flex items-center rounded-md border border-line bg-panel p-0.5">
                {[
                  { label: "±5", value: 5 },
                  { label: "±10", value: 10 },
                  { label: "All", value: 0 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setStrikeWindow(item.value)}
                    className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                      strikeWindow === item.value
                        ? "bg-accent/20 text-accent font-semibold"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Academic & Derivatives Insights Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-line/70 bg-panel px-3 py-1.5 text-[10px]">
            <div>
              <span className="text-[9px] text-muted block">Spot / ATM</span>
              <span className="font-mono tabular-nums text-ink font-semibold">
                {num(chain?.underlying)}
              </span>
              <span className="ml-1 text-[9px] text-muted/80">({num(chain?.atmStrike, 0)})</span>
            </div>

            <div>
              <span className="text-[9px] text-muted block">PCR Sentiment</span>
              <div className="flex items-center gap-1">
                <span className="font-mono tabular-nums text-accent font-semibold">
                  {num(chain?.pcr)}
                </span>
                <span className={`rounded border px-1 py-0.2 text-[8px] font-medium leading-tight ${sentiment.tone}`}>
                  {sentiment.label}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[9px] text-muted block">Max Pain Strike</span>
              <span className="font-mono tabular-nums text-ink font-semibold">
                {num(maxPain, 0)}
              </span>
            </div>

            <div>
              <span className="text-[9px] text-muted block">ATM Straddle (±{expectedMovePct}%)</span>
              <span className="font-mono tabular-nums text-ink" title={`Range: ${num(lowerBreakeven, 0)} - ${num(upperBreakeven, 0)}`}>
                ₹{price(straddlePremium)}
              </span>
            </div>
          </div>

          {/* Main Body: Table View */}
          {viewMode === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wider text-muted/70 bg-panel2/30">
                    <th colSpan={2} className="border-b border-line/70 px-2 py-1 text-left font-medium text-rose-400">
                      Calls (Resistance)
                    </th>
                    <th className="border-b border-line/70 px-1 py-1 text-center font-medium">Strike</th>
                    <th colSpan={2} className="border-b border-line/70 px-2 py-1 text-right font-medium text-emerald-400">
                      Puts (Support)
                    </th>
                  </tr>
                  <tr className="text-muted/60 border-b border-line/50 text-[9px]">
                    <th className="px-2 py-1 text-right font-normal">OI</th>
                    <th className="px-2 py-1 text-right font-normal">LTP</th>
                    <th className="px-1 py-1 text-center font-normal">ATM</th>
                    <th className="px-2 py-1 text-left font-normal">LTP</th>
                    <th className="px-2 py-1 text-left font-normal">OI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isAtm = row.strike === chain?.atmStrike;
                    const isMaxPainStrike = row.strike === maxPain;
                    const isItmCall = row.strike < (chain?.underlying ?? 0);
                    const isItmPut = row.strike > (chain?.underlying ?? 0);
                    const ceHot = row.ce.oi === maxCeWindow && maxCeWindow > 0;
                    const peHot = row.pe.oi === maxPeWindow && maxPeWindow > 0;

                    const ceDepth = Math.min(100, (row.ce.oi / maxCeWindow) * 100);
                    const peDepth = Math.min(100, (row.pe.oi / maxPeWindow) * 100);

                    return (
                      <tr
                        key={row.strike}
                        className={`border-b border-line/40 last:border-0 ${
                          isAtm ? "bg-accent/[0.12] ring-1 ring-inset ring-accent/30" : "hover:bg-wash/[0.04]"
                        }`}
                      >
                        {/* Call OI with Depth Bar */}
                        <td className={`relative px-2 py-1 text-right overflow-hidden ${isItmCall ? "bg-amber-400/[0.04]" : ""}`}>
                          <div
                            style={{ width: `${ceDepth}%` }}
                            className="absolute right-0 top-0 bottom-0 bg-rose-500/[0.14] pointer-events-none"
                          />
                          <div className="relative z-10 flex items-center justify-end gap-1">
                            {ceHot && (
                              <span className="rounded bg-rose-500/20 px-1 text-[7px] font-semibold text-rose-300">
                                RES
                              </span>
                            )}
                            <span className={ceHot ? "font-semibold text-accent" : "text-muted"}>
                              {compact(row.ce.oi)}
                            </span>
                            <span
                              className={`text-[8px] ${
                                row.ce.oiChange >= 0 ? "text-emerald-400/80" : "text-rose-400/80"
                              }`}
                            >
                              {row.ce.oiChange >= 0 ? "+" : ""}
                              {(row.ce.oiChange / 1000).toFixed(1)}k
                            </span>
                          </div>
                        </td>

                        {/* Call LTP */}
                        <td className={`px-2 py-1 text-right text-ink/90 ${isItmCall ? "bg-amber-400/[0.04]" : ""}`}>
                          {price(row.ce.ltp)}
                        </td>

                        {/* Strike Column */}
                        <td
                          className={`px-1 py-1 text-center font-medium ${
                            isAtm ? "font-bold text-accent" : isMaxPainStrike ? "text-cyan-400" : "text-ink/75"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{num(row.strike, 0)}</span>
                            {isMaxPainStrike && (
                              <span className="rounded bg-cyan-500/20 px-0.5 text-[7px] text-cyan-300" title="Max Pain Strike">
                                MP
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Put LTP */}
                        <td className={`px-2 py-1 text-left text-ink/90 ${isItmPut ? "bg-amber-400/[0.04]" : ""}`}>
                          {price(row.pe.ltp)}
                        </td>

                        {/* Put OI with Depth Bar */}
                        <td className={`relative px-2 py-1 text-left overflow-hidden ${isItmPut ? "bg-amber-400/[0.04]" : ""}`}>
                          <div
                            style={{ width: `${peDepth}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-emerald-500/[0.14] pointer-events-none"
                          />
                          <div className="relative z-10 flex items-center justify-start gap-1">
                            <span
                              className={`text-[8px] ${
                                row.pe.oiChange >= 0 ? "text-emerald-400/80" : "text-rose-400/80"
                              }`}
                            >
                              {row.pe.oiChange >= 0 ? "+" : ""}
                              {(row.pe.oiChange / 1000).toFixed(1)}k
                            </span>
                            <span className={peHot ? "font-semibold text-accent" : "text-muted"}>
                              {compact(row.pe.oi)}
                            </span>
                            {peHot && (
                              <span className="rounded bg-emerald-500/20 px-1 text-[7px] font-semibold text-emerald-300">
                                SUP
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* View Mode: Greeks & IV */}
          {viewMode === "greeks" && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wider text-muted/70 bg-panel2/30">
                    <th colSpan={3} className="border-b border-line/70 px-2 py-1 text-left font-medium text-rose-400">
                      Calls (IV · Delta · Theta)
                    </th>
                    <th className="border-b border-line/70 px-1 py-1 text-center font-medium">Strike</th>
                    <th colSpan={3} className="border-b border-line/70 px-2 py-1 text-right font-medium text-emerald-400">
                      Puts (Theta · Delta · IV)
                    </th>
                  </tr>
                  <tr className="text-muted/60 border-b border-line/50 text-[8px]">
                    <th className="px-1.5 py-1 text-right font-normal">IV%</th>
                    <th className="px-1.5 py-1 text-right font-normal">Delta (Δ)</th>
                    <th className="px-1.5 py-1 text-right font-normal">Theta (Θ)</th>
                    <th className="px-1 py-1 text-center font-normal">Strike</th>
                    <th className="px-1.5 py-1 text-left font-normal">Theta (Θ)</th>
                    <th className="px-1.5 py-1 text-left font-normal">Delta (Δ)</th>
                    <th className="px-1.5 py-1 text-left font-normal">IV%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isAtm = row.strike === chain?.atmStrike;
                    return (
                      <tr
                        key={row.strike}
                        className={`border-b border-line/40 last:border-0 ${
                          isAtm ? "bg-accent/[0.12] ring-1 ring-inset ring-accent/30" : "hover:bg-wash/[0.04]"
                        }`}
                      >
                        <td className="px-1.5 py-1 text-right text-muted">{row.ce.iv > 0 ? `${row.ce.iv}%` : "—"}</td>
                        <td className="px-1.5 py-1 text-right text-cyan-300">{row.ce.delta !== undefined ? row.ce.delta.toFixed(2) : "—"}</td>
                        <td className="px-1.5 py-1 text-right text-rose-300">{row.ce.theta !== undefined ? row.ce.theta.toFixed(1) : "—"}</td>
                        <td className={`px-1 py-1 text-center font-medium ${isAtm ? "font-bold text-accent" : "text-ink/80"}`}>
                          {num(row.strike, 0)}
                        </td>
                        <td className="px-1.5 py-1 text-left text-rose-300">{row.pe.theta !== undefined ? row.pe.theta.toFixed(1) : "—"}</td>
                        <td className="px-1.5 py-1 text-left text-cyan-300">{row.pe.delta !== undefined ? row.pe.delta.toFixed(2) : "—"}</td>
                        <td className="px-1.5 py-1 text-left text-muted">{row.pe.iv > 0 ? `${row.pe.iv}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* View Mode: Grouped OI Bar Chart */}
          {viewMode === "chart" && (
            <div className="p-3 space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted pb-1 border-b border-line/50">
                <span className="text-rose-400 font-medium">← Calls OI (Resistance)</span>
                <span className="font-semibold text-ink">Strike</span>
                <span className="text-emerald-400 font-medium">Puts OI (Support) →</span>
              </div>
              {rows.map((row) => {
                const isAtm = row.strike === chain?.atmStrike;
                const cePct = (row.ce.oi / overallMaxOi) * 100;
                const pePct = (row.pe.oi / overallMaxOi) * 100;

                return (
                  <div key={row.strike} className={`flex items-center gap-2 py-0.5 rounded px-1 ${isAtm ? "bg-accent/10" : ""}`}>
                    {/* Call Bar (Right to Left) */}
                    <div className="flex-1 flex items-center justify-end gap-1.5">
                      <span className="text-[9px] text-muted tabular-nums">{compact(row.ce.oi)}</span>
                      <div className="h-3 w-32 max-w-full bg-line/30 rounded-sm overflow-hidden flex justify-end">
                        <div style={{ width: `${cePct}%` }} className="h-full bg-rose-500/80 rounded-sm" />
                      </div>
                    </div>

                    {/* Strike */}
                    <div className={`w-14 text-center tabular-nums text-[10px] font-medium ${isAtm ? "font-bold text-accent" : "text-ink"}`}>
                      {num(row.strike, 0)}
                    </div>

                    {/* Put Bar (Left to Right) */}
                    <div className="flex-1 flex items-center justify-start gap-1.5">
                      <div className="h-3 w-32 max-w-full bg-line/30 rounded-sm overflow-hidden flex justify-start">
                        <div style={{ width: `${pePct}%` }} className="h-full bg-emerald-500/80 rounded-sm" />
                      </div>
                      <span className="text-[9px] text-muted tabular-nums">{compact(row.pe.oi)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Institutional Footer Summary */}
          <div className="grid grid-cols-3 gap-2 border-t border-line/70 bg-panel px-3 py-1.5 text-[9px] text-muted mt-auto">
            <span>
              CE Total OI: <span className="font-mono tabular-nums text-ink/90 font-medium">{compact(chain?.totalCeOi)}</span>
            </span>
            <span className="text-center">
              PE Total OI: <span className="font-mono tabular-nums text-ink/90 font-medium">{compact(chain?.totalPeOi)}</span>
            </span>
            <span className="text-right">
              Updated: <span className="font-mono text-ink/80">{chain?.updatedAt?.slice(11, 16) ?? "—"}</span>
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}
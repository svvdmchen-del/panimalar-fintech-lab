"use client";

import { compact, num, price } from "@/lib/format";
import type { OptionChain } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";

export function OptionChainPanel({
  chain,
  loading,
  badge,
  underlying,
  onUnderlyingChange,
}: {
  chain?: OptionChain;
  loading: boolean;
  badge?: React.ReactNode;
  underlying: string;
  onUnderlyingChange: (symbol: string) => void;
}) {
  const rows = chain?.strikes ?? [];
  const maxCeWindow = Math.max(1, ...rows.map((row) => row.ce.oi));
  const maxPeWindow = Math.max(1, ...rows.map((row) => row.pe.oi));

  return (
    <Panel
      title="Option chain"
      subtitle={chain ? `${chain.symbol} · expiry ${chain.expiry}` : "NSE F&O"}
      badge={badge}
      actions={
        <select
          value={underlying}
          onChange={(event) => onUnderlyingChange(event.target.value)}
          aria-label="Option chain underlying"
          className="rounded-md border border-line bg-panel2 px-1.5 py-1 text-[10px] text-ink focus:outline-none focus:ring-1 focus:ring-cyan/50"
        >
          {["NIFTY", "BANKNIFTY", "FINNIFTY"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      }
      bodyClassName="p-0"
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
          <div className="flex items-center justify-between border-b border-line/70 px-3 py-1.5 text-[10px] text-muted">
            <span>
              Spot <span className="font-mono tabular-nums text-ink">{num(chain?.underlying)}</span>
            </span>
            <span>
              PCR <span className="font-mono tabular-nums text-accent">{num(chain?.pcr)}</span>
            </span>
            <span>
              ATM <span className="font-mono tabular-nums text-ink">{num(chain?.atmStrike, 0)}</span>
            </span>
          </div>

          <table className="w-full border-collapse font-mono text-[10px] tabular-nums">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted/70">
                <th colSpan={2} className="border-b border-line/70 px-2 py-1 text-left font-medium text-up/80">
                  Calls
                </th>
                <th className="border-b border-line/70 px-1 py-1 font-medium">Strike</th>
                <th colSpan={2} className="border-b border-line/70 px-2 py-1 text-right font-medium text-down/80">
                  Puts
                </th>
              </tr>
              <tr className="text-muted/60">
                <th className="px-2 py-1 text-right font-normal">OI</th>
                <th className="px-2 py-1 text-right font-normal">LTP</th>
                <th className="px-1 py-1 font-normal" />
                <th className="px-2 py-1 text-left font-normal">LTP</th>
                <th className="px-2 py-1 text-left font-normal">OI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isAtm = row.strike === chain?.atmStrike;
                const ceHot = row.ce.oi === maxCeWindow;
                const peHot = row.pe.oi === maxPeWindow;
                return (
                  <tr
                    key={row.strike}
                    className={`border-b border-line/40 last:border-0 ${isAtm ? "bg-accent/[0.07]" : "hover:bg-wash/[0.03]"}`}
                  >
                    <td className="px-2 py-1 text-right">
                      <span className={ceHot ? "font-semibold text-accent" : "text-muted"}>{compact(row.ce.oi)}</span>
                      <span
                        className={`ml-1 text-[8px] ${row.ce.oiChange >= 0 ? "text-up/70" : "text-down/70"}`}
                      >
                        {row.ce.oiChange >= 0 ? "+" : ""}
                        {(row.ce.oiChange / 1000).toFixed(1)}k
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right text-ink/90">{price(row.ce.ltp)}</td>
                    <td
                      className={`px-1 py-1 text-center ${isAtm ? "font-semibold text-accent" : "text-ink/75"}`}
                    >
                      {num(row.strike, 0)}
                    </td>
                    <td className="px-2 py-1 text-left text-ink/90">{price(row.pe.ltp)}</td>
                    <td className="px-2 py-1 text-left">
                      <span className={peHot ? "font-semibold text-accent" : "text-muted"}>{compact(row.pe.oi)}</span>
                      <span
                        className={`ml-1 text-[8px] ${row.pe.oiChange >= 0 ? "text-up/70" : "text-down/70"}`}
                      >
                        {row.pe.oiChange >= 0 ? "+" : ""}
                        {(row.pe.oiChange / 1000).toFixed(1)}k
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-2 border-t border-line/70 px-3 py-1.5 text-[9px] text-muted">
            <span>
              CE OI <span className="font-mono tabular-nums text-ink/80">{compact(chain?.totalCeOi)}</span>
            </span>
            <span className="text-center">
              PE OI <span className="font-mono tabular-nums text-ink/80">{compact(chain?.totalPeOi)}</span>
            </span>
            <span className="text-right">
              Updated <span className="font-mono text-ink/80">{chain?.updatedAt?.slice(11, 16) ?? "—"}</span>
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

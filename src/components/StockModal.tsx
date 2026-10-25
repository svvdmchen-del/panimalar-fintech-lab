"use client";

import { useEffect } from "react";
import { compact, num, price, pct, toneClass } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { PriceChart } from "./PriceChart";
import { RangeBar } from "./ui";

export function StockModal({
  symbol,
  quote,
  intervalMs,
  onClose,
  inWatchlist,
  onToggleWatchlist,
}: {
  symbol: string;
  quote?: Quote;
  intervalMs: number;
  onClose: () => void;
  inWatchlist: boolean;
  onToggleWatchlist: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const stats = quote
    ? [
        { label: "Open", value: price(quote.open) },
        { label: "High", value: price(quote.high) },
        { label: "Low", value: price(quote.low) },
        { label: "Prev close", value: price(quote.prevClose) },
        { label: "Volume", value: compact(quote.volume) },
        { label: "52w high", value: quote.yearHigh ? price(quote.yearHigh) : "—" },
        { label: "52w low", value: quote.yearLow ? price(quote.yearLow) : "—" },
        { label: "P/E", value: quote.peRatio ? num(quote.peRatio, 1) : "—" },
      ]
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${symbol} details`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-3xl animate-[rise_180ms_ease-out] overflow-hidden rounded-2xl border border-line-strong bg-bg shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-ink">{symbol}</h2>
              <span className="rounded border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">
                NSE
              </span>
            </div>
            <p className="truncate text-[11px] text-muted">{quote?.name ?? "Loading quote…"}</p>
          </div>

          <div className="flex items-center gap-3">
            {quote ? (
              <div className="text-right">
                <div className="font-mono text-xl tabular-nums text-ink">{price(quote.price)}</div>
                <div className={`font-mono text-[11px] tabular-nums ${toneClass(quote.changePct)}`}>
                  {quote.change > 0 ? "+" : ""}
                  {num(quote.change)} ({pct(quote.changePct)})
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-muted hover:border-down/40 hover:text-down"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="max-h-[70vh] overflow-y-auto">
          {quote ? (
            <div className="border-b border-line/70 px-4 py-2.5">
              <RangeBar low={quote.low} high={quote.high} value={quote.price} prevClose={quote.prevClose} showLabels />
            </div>
          ) : null}

          <div className="px-2 py-2">
            <PriceChart symbol={symbol} intervalMs={intervalMs} height={280} />
          </div>

          {stats.length ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-3 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-line/60 bg-panel/60 px-2 py-1.5">
                  <dt className="text-[9px] uppercase tracking-wider text-muted/70">{stat.label}</dt>
                  <dd className="font-mono text-[11px] tabular-nums text-ink/90">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <p className="text-[9px] text-muted/60">
            Prices are indicative and may be delayed. Not investment advice.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleWatchlist}
              className={`rounded-md border px-2.5 py-1 text-[10px] transition-colors ${
                inWatchlist
                  ? "border-line bg-panel text-muted hover:border-down/40 hover:text-down"
                  : "border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/15"
              }`}
            >
              {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            </button>
            <a
              href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-line bg-panel px-2.5 py-1 text-[10px] text-muted hover:text-ink"
            >
              Open on NSE ↗
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

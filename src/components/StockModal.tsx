"use client";

import { useEffect } from "react";
import { compact, num, price, pct, toneClass, formatMarketCap } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import type { Envelope, Quote, StockFundamentals } from "@/lib/types";
import { PriceChart } from "./PriceChart";
import { RangeBar } from "./ui";

function formatRate(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  const normalized = Math.abs(val) <= 1 && val !== 0 ? val * 100 : val;
  return `${normalized.toFixed(2)}%`;
}

export function StockModal({
  symbol,
  quote: initialQuote,
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
  const fallbackQuote = usePoll<Envelope<Quote[]>>(
    !initialQuote ? `/api/market/quotes?symbols=${encodeURIComponent(symbol)}` : null,
    intervalMs,
  );

  const fundamentalsRes = usePoll<Envelope<StockFundamentals>>(
    `/api/market/fundamentals?symbol=${encodeURIComponent(symbol)}`,
    60_000,
  );

  const quote = initialQuote ?? fallbackQuote.data?.data?.[0];
  const fundamentals = fundamentalsRes.data?.data;

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
        { label: "P/E", value: quote.peRatio ? `${num(quote.peRatio, 1)}x` : "—" },
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
              {fundamentals?.marketCapCategory ? (
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                    fundamentals.marketCapCategory === "Large Cap"
                      ? "border-cyan/40 bg-cyan/10 text-cyan"
                      : fundamentals.marketCapCategory === "Mid Cap"
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-purple-400/40 bg-purple-500/10 text-purple-300"
                  }`}
                >
                  {fundamentals.marketCapCategory}
                </span>
              ) : null}
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

        <div className="max-h-[72vh] overflow-y-auto">
          {quote ? (
            <div className="border-b border-line/70 px-4 py-2.5">
              <RangeBar low={quote.low} high={quote.high} value={quote.price} prevClose={quote.prevClose} showLabels />
            </div>
          ) : null}

          <div className="px-2 py-2">
            <PriceChart symbol={symbol} intervalMs={intervalMs} height={260} />
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

          {/* Fundamental & Valuation Hub */}
          <section className="border-t border-line/70 bg-panel/40 px-4 py-3">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan" aria-hidden />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink">
                  Fundamental & Valuation Hub
                </h3>
              </div>
              {fundamentalsRes.loading && !fundamentals ? (
                <span className="text-[10px] text-muted">Loading metrics…</span>
              ) : fundamentals?.marketCap ? (
                <span className="font-mono text-[10px] text-muted">
                  Cap: {formatMarketCap(fundamentals.marketCap)}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* Card 1: Valuation */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Valuation</span>
                  <span className="text-[9px] text-muted">Multiples</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Trailing P/E</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.trailingPE
                        ? `${num(fundamentals.trailingPE, 1)}x`
                        : quote?.peRatio
                        ? `${num(quote.peRatio, 1)}x`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Forward P/E</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.forwardPE ? `${num(fundamentals.forwardPE, 1)}x` : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Price-to-Book (P/B)</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.priceToBook ? `${num(fundamentals.priceToBook, 2)}x` : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Dividend Yield</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.dividendYield !== undefined ? formatRate(fundamentals.dividendYield) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Profitability */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Profitability</span>
                  <span className="text-[9px] text-muted">Returns & Margins</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Return on Equity (ROE)</span>
                    <span className="font-mono text-[11px] tabular-nums text-up">
                      {fundamentals?.returnOnEquity !== undefined ? formatRate(fundamentals.returnOnEquity) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Operating Margin</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.operatingMargin !== undefined ? formatRate(fundamentals.operatingMargin) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Profit Margin</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.profitMargin !== undefined ? formatRate(fundamentals.profitMargin) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Trailing EPS</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.trailingEps ? `₹${num(fundamentals.trailingEps, 2)}` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Financial Health */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Financial Health</span>
                  <span className="text-[9px] text-muted">Capital Structure</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Debt-to-Equity</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.debtToEquity !== undefined
                        ? num(fundamentals.debtToEquity > 10 ? fundamentals.debtToEquity / 100 : fundamentals.debtToEquity, 2)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Market Cap</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.marketCap
                        ? formatMarketCap(fundamentals.marketCap)
                        : quote?.marketCap
                        ? formatMarketCap(quote.marketCap)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Category</span>
                    <span className="font-mono text-[11px] tabular-nums text-cyan">
                      {fundamentals?.marketCapCategory ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Beta (Volatility)</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {fundamentals?.beta !== undefined ? num(fundamentals.beta, 2) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <p className="text-[9px] text-muted/60">
            Valuation & fundamentals sourced from NSE & Yahoo Finance. Not investment advice.
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

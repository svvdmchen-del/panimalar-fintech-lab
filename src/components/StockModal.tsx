"use client";

import { useEffect, useState } from "react";
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

/**
 * Educational Explainer Micro-Tooltip for MBA FinTech Students.
 */
function MetricWithEdu({
  label,
  value,
  explanation,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  explanation: string;
  tone?: "up" | "down" | "cyan";
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-baseline justify-between">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted">{label}</span>
        <button
          type="button"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          onFocus={() => setShow(true)}
          onBlur={() => setShow(false)}
          aria-label={`Educational explainer for ${label}`}
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-semibold text-muted/60 transition-colors hover:bg-cyan/15 hover:text-cyan"
        >
          ⓘ
        </button>
      </div>

      <span
        className={`font-mono text-[11px] tabular-nums ${
          tone === "up" ? "text-up font-medium" : tone === "down" ? "text-down font-medium" : tone === "cyan" ? "text-cyan font-medium" : "text-ink"
        }`}
      >
        {value}
      </span>

      {show ? (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-64 rounded-lg border border-line-strong bg-panel2 p-2 text-[10px] leading-relaxed text-ink shadow-2xl animate-[rise_120ms_ease-out]">
          <p className="font-semibold text-cyan">{label}</p>
          <p className="mt-0.5 text-muted">{explanation}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Visual Valuation Meter (Undervalued < 16, Fair 16-28, Premium > 28).
 */
function ValuationMeter({ pe }: { pe?: number }) {
  if (!pe || pe <= 0) return null;
  const status = pe < 16 ? "Undervalued" : pe <= 28 ? "Fair Value" : "Premium / Growth";
  const percent = Math.min(100, Math.max(0, (pe / 45) * 100));

  return (
    <div className="rounded-lg border border-line/60 bg-panel2/60 p-2.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-ink">Valuation Meter</span>
        <span
          className={`font-semibold ${
            pe < 16 ? "text-up" : pe <= 28 ? "text-cyan" : "text-accent"
          }`}
        >
          {status} ({pe.toFixed(1)}x P/E)
        </span>
      </div>

      <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="absolute inset-0 flex">
          <div className="w-1/3 bg-up/40" title="Undervalued (<16x)" />
          <div className="w-1/3 bg-cyan/40" title="Fair Value (16-28x)" />
          <div className="w-1/3 bg-accent/40" title="Premium (>28x)" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-ink shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          style={{ left: `calc(${percent}% - 2px)` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[8px] uppercase tracking-wider text-muted/60">
        <span>Undervalued</span>
        <span>Fair Value</span>
        <span>Premium</span>
      </div>
    </div>
  );
}

/**
 * Visual Financial Leverage & Health Gauge (Conservative < 0.5, Moderate 0.5-1.2, Leveraged > 1.2).
 */
function HealthGauge({ de, roe }: { de?: number; roe?: number }) {
  if (de === undefined) return null;
  const normDe = de > 10 ? de / 100 : de;
  const status = normDe < 0.5 ? "Conservative" : normDe <= 1.2 ? "Moderate" : "Leveraged";
  const percent = Math.min(100, Math.max(0, (normDe / 2.0) * 100));

  return (
    <div className="rounded-lg border border-line/60 bg-panel2/60 p-2.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-ink">Capital Health & Leverage</span>
        <span
          className={`font-semibold ${
            normDe < 0.5 ? "text-up" : normDe <= 1.2 ? "text-cyan" : "text-down"
          }`}
        >
          {status} ({normDe.toFixed(2)} D/E)
        </span>
      </div>

      <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="absolute inset-0 flex">
          <div className="w-1/4 bg-up/40" title="Conservative (<0.5)" />
          <div className="w-1/2 bg-cyan/40" title="Moderate (0.5-1.2)" />
          <div className="w-1/4 bg-down/40" title="Leveraged (>1.2)" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-ink shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          style={{ left: `calc(${percent}% - 2px)` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[8px] uppercase tracking-wider text-muted/60">
        <span>Low Debt</span>
        <span>Moderate</span>
        <span>High Leverage</span>
      </div>
    </div>
  );
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
                <span className="rounded bg-panel2 px-1.5 py-0.5 text-[9px] text-muted">
                  Hover ⓘ for MBA concept explainers
                </span>
              </div>
              {fundamentalsRes.loading && !fundamentals ? (
                <span className="text-[10px] text-muted">Loading metrics…</span>
              ) : fundamentals?.marketCap ? (
                <span className="font-mono text-[10px] text-muted">
                  Cap: {formatMarketCap(fundamentals.marketCap)}
                </span>
              ) : null}
            </div>

            {/* Visual Gauges: Valuation & Solvency */}
            <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <ValuationMeter pe={fundamentals?.trailingPE ?? quote?.peRatio} />
              <HealthGauge de={fundamentals?.debtToEquity} roe={fundamentals?.returnOnEquity} />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* Card 1: Valuation */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Valuation</span>
                  <span className="text-[9px] text-muted">Multiples</span>
                </div>
                <div className="space-y-2">
                  <MetricWithEdu
                    label="Trailing P/E"
                    value={
                      fundamentals?.trailingPE
                        ? `${num(fundamentals.trailingPE, 1)}x`
                        : quote?.peRatio
                        ? `${num(quote.peRatio, 1)}x`
                        : "—"
                    }
                    explanation="Price-to-Earnings (TTM): Measures how much investors pay per ₹1 of current annual profit. Benchmark: 18x-25x for Nifty 50."
                  />
                  <MetricWithEdu
                    label="Forward P/E"
                    value={fundamentals?.forwardPE ? `${num(fundamentals.forwardPE, 1)}x` : "—"}
                    explanation="Forward P/E: Uses projected 12-month future earnings. Forward P/E lower than Trailing P/E indicates anticipated earnings growth."
                  />
                  <MetricWithEdu
                    label="Price-to-Book (P/B)"
                    value={fundamentals?.priceToBook ? `${num(fundamentals.priceToBook, 2)}x` : "—"}
                    explanation="P/B Ratio: Market price relative to accounting net worth per share. Vital for banks and capital-intensive manufacturers."
                  />
                  <MetricWithEdu
                    label="Dividend Yield"
                    value={fundamentals?.dividendYield !== undefined ? formatRate(fundamentals.dividendYield) : "—"}
                    explanation="Annual cash payout divided by share price. Provides recurring cash flow cushion against market downturns."
                  />
                </div>
              </div>

              {/* Card 2: Profitability */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Profitability</span>
                  <span className="text-[9px] text-muted">Returns & Margins</span>
                </div>
                <div className="space-y-2">
                  <MetricWithEdu
                    label="Return on Equity (ROE)"
                    value={fundamentals?.returnOnEquity !== undefined ? formatRate(fundamentals.returnOnEquity) : "—"}
                    tone="up"
                    explanation="Net Profit / Shareholders' Equity. Benchmark: ROE > 15% denotes strong economic moat and capital allocation efficiency."
                  />
                  <MetricWithEdu
                    label="Operating Margin"
                    value={fundamentals?.operatingMargin !== undefined ? formatRate(fundamentals.operatingMargin) : "—"}
                    explanation="Operating Profit / Net Revenue. Measures core business operational profitability before finance costs and tax."
                  />
                  <MetricWithEdu
                    label="Net Profit Margin"
                    value={fundamentals?.profitMargin !== undefined ? formatRate(fundamentals.profitMargin) : "—"}
                    explanation="Net Income / Revenue. The bottom-line percentage of every ₹100 in turnover retained as pure net profit."
                  />
                  <MetricWithEdu
                    label="Trailing EPS"
                    value={fundamentals?.trailingEps ? `₹${num(fundamentals.trailingEps, 2)}` : "—"}
                    explanation="Earnings Per Share over last 4 quarters. Fundamental bedrock for intrinsic Discounted Cash Flow (DCF) models."
                  />
                </div>
              </div>

              {/* Card 3: Financial Health */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Financial Health</span>
                  <span className="text-[9px] text-muted">Capital Structure</span>
                </div>
                <div className="space-y-2">
                  <MetricWithEdu
                    label="Debt-to-Equity (D/E)"
                    value={
                      fundamentals?.debtToEquity !== undefined
                        ? num(fundamentals.debtToEquity > 10 ? fundamentals.debtToEquity / 100 : fundamentals.debtToEquity, 2)
                        : "—"
                    }
                    explanation="Total Liabilities / Total Equity. D/E < 0.5 is conservative solvency; D/E > 1.5 indicates significant financial leverage."
                  />
                  <MetricWithEdu
                    label="Market Cap"
                    value={
                      fundamentals?.marketCap
                        ? formatMarketCap(fundamentals.marketCap)
                        : quote?.marketCap
                        ? formatMarketCap(quote.marketCap)
                        : "—"
                    }
                    explanation="Total equity value calculated as share price × total outstanding shares."
                  />
                  <MetricWithEdu
                    label="SEBI Category"
                    value={fundamentals?.marketCapCategory ?? "—"}
                    tone="cyan"
                    explanation="SEBI Classification: Large Cap (Top 100, >₹20k Cr), Mid Cap (101-250, ₹5k-20k Cr), Small Cap (251+, <₹5k Cr)."
                  />
                  <MetricWithEdu
                    label="Beta (Volatility)"
                    value={fundamentals?.beta !== undefined ? num(fundamentals.beta, 2) : "—"}
                    explanation="Systematic volatility vs Nifty 50. Beta = 1.0 moves with index; >1.2 is aggressive/cyclical; <0.8 is defensive."
                  />
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

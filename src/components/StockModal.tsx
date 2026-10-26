"use client";

import { useEffect, useRef, useState } from "react";
import { compact, num, price, pct, toneClass, formatMarketCap } from "@/lib/format";
import { usePoll, useSymbolSearch } from "@/lib/usePoll";
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
  onSelectSymbol,
}: {
  symbol: string;
  quote?: Quote;
  intervalMs: number;
  onClose: () => void;
  inWatchlist: boolean;
  onToggleWatchlist: () => void;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const searchResults = useSymbolSearch(searchQuery, 8);

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

  // Reset active search suggestion index when query changes
  useEffect(() => {
    setSearchActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !searchOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, searchOpen]);

  const pickSymbol = (newSymbol: string) => {
    const clean = newSymbol.trim().toUpperCase();
    setSearchQuery("");
    setSearchOpen(false);
    if (onSelectSymbol) {
      onSelectSymbol(clean);
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchOpen(true);
      if (searchResults.length > 0) {
        setSearchActiveIndex((prev) => (prev + 1) % searchResults.length);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchOpen(true);
      if (searchResults.length > 0) {
        setSearchActiveIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[searchActiveIndex]) {
        pickSymbol(searchResults[searchActiveIndex].symbol);
      } else if (searchResults.length > 0) {
        pickSymbol(searchResults[0].symbol);
      } else if (searchQuery.trim()) {
        pickSymbol(searchQuery.trim());
      }
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${symbol} details`}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm"
      />

      <div className="relative z-10 flex h-auto max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-bg shadow-2xl transition-all duration-200">
        {/* Header: Clean Stock Identity & In-Modal Search Replacement */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/70 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-wide text-ink">{symbol}</h2>
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
            <span className="hidden text-sm text-muted/50 sm:inline">·</span>
            <p className="hidden truncate text-xs text-muted sm:inline">{quote?.name ?? "Loading quote…"}</p>
          </div>

          <div className="flex items-center gap-3">
            {quote ? (
              <div className="flex items-baseline gap-2 text-right">
                <span className="font-mono text-xl font-bold tabular-nums text-ink">{price(quote.price)}</span>
                <span className={`font-mono text-xs tabular-nums ${toneClass(quote.changePct)}`}>
                  {quote.change > 0 ? "+" : ""}
                  {num(quote.change)} ({pct(quote.changePct)})
                </span>
              </div>
            ) : null}

            {/* In-Modal Instant Stock Search (Replacing Expand Button) */}
            <div className="relative w-36 sm:w-52">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 140)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search stock…"
                aria-label="Search another stock in modal"
                className="w-full rounded-md border border-line bg-panel2/90 px-2.5 py-1 text-[11px] text-ink placeholder:text-muted/60 focus:border-cyan/40 focus:outline-none focus:ring-1 focus:ring-cyan/40"
              />

              {searchOpen && searchResults.length > 0 ? (
                <ul
                  role="listbox"
                  className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-panel2 shadow-2xl"
                >
                  <div className="border-b border-line/60 px-3 py-1 text-[9px] text-muted flex items-center justify-between">
                    <span>Select to switch</span>
                    <span>↑ ↓ Enter</span>
                  </div>
                  {searchResults.map((entry, index) => {
                    const isHighlighted = index === searchActiveIndex;
                    return (
                      <li key={entry.symbol} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setSearchActiveIndex(index)}
                          onClick={() => pickSymbol(entry.symbol)}
                          className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                            isHighlighted
                              ? "bg-cyan/15 text-cyan border-l-2 border-cyan font-semibold"
                              : "text-ink hover:bg-wash/5"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span>{entry.symbol}</span>
                            <span className="ml-1.5 truncate text-[10px] text-muted">{entry.name}</span>
                          </div>
                          {entry.sector ? (
                            <span className="shrink-0 text-[8px] uppercase tracking-wider text-muted/70">
                              {entry.sector}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted hover:border-down/40 hover:text-down"
            >
              ✕
            </button>
          </div>
        </header>

        {/* 2-Column Split Desk Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-line overflow-y-auto lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Left Column: Live Chart & Technical Ribbon (Col span 7) */}
          <div className="flex flex-col space-y-3 p-4 lg:col-span-7">
            {/* Dual Range Visualizer: Intraday vs 52-Week Channel */}
            {quote ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* Day Range */}
                <div className="rounded-xl border border-line bg-panel2/70 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-cyan" />
                      Day Range
                    </span>
                    <span className="font-mono text-[9px] text-muted/80">
                      Spread: {price(quote.high - quote.low)}
                    </span>
                  </div>
                  <RangeBar low={quote.low} high={quote.high} value={quote.price} prevClose={quote.prevClose} showLabels />
                </div>

                {/* 52-Week Range */}
                <div className="rounded-xl border border-line bg-panel2/70 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-accent" />
                      52-Week Range
                    </span>
                    {quote.yearHigh && quote.yearHigh > 0 ? (
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                          quote.price >= quote.yearHigh * 0.975
                            ? "bg-up/20 text-up border border-up/30"
                            : "bg-cyan/15 text-cyan"
                        }`}
                      >
                        {quote.price >= quote.yearHigh * 0.99
                          ? "🔥 AT 52W HIGH"
                          : `${(((quote.price - quote.yearHigh) / quote.yearHigh) * 100).toFixed(1)}% off High`}
                      </span>
                    ) : null}
                  </div>
                  <RangeBar
                    low={quote.yearLow ?? quote.low}
                    high={quote.yearHigh ?? quote.high}
                    value={quote.price}
                    showLabels
                  />
                </div>
              </div>
            ) : null}

            {/* TradingView-Grade Chart without duplicate header title */}
            <div className="flex-1">
              <PriceChart
                symbol={symbol}
                intervalMs={intervalMs}
                height={320}
                hideTitle={true}
                livePrice={quote?.price}
              />
            </div>

            {/* Consolidated Session Ribbon (8 Clean Metric Tiles) */}
            {quote ? (
              <div className="grid grid-cols-4 divide-x divide-line/60 rounded-xl border border-line bg-panel2/50 p-2 text-center sm:grid-cols-8">
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">Open</div>
                  <div className="font-mono text-[11px] tabular-nums text-ink">{price(quote.open)}</div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">Day High</div>
                  <div className="font-mono text-[11px] tabular-nums text-up">{price(quote.high)}</div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">Day Low</div>
                  <div className="font-mono text-[11px] tabular-nums text-down">{price(quote.low)}</div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">Prev Close</div>
                  <div className="font-mono text-[11px] tabular-nums text-muted">{price(quote.prevClose)}</div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">Volume</div>
                  <div className="font-mono text-[11px] tabular-nums text-ink">{compact(quote.volume)}</div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">52W High</div>
                  <div className="font-mono text-[11px] tabular-nums text-up">
                    {quote.yearHigh ? price(quote.yearHigh) : "—"}
                  </div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">52W Low</div>
                  <div className="font-mono text-[11px] tabular-nums text-down">
                    {quote.yearLow ? price(quote.yearLow) : "—"}
                  </div>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted">P/E Ratio</div>
                  <div className="font-mono text-[11px] tabular-nums text-cyan">
                    {quote.peRatio
                      ? `${num(quote.peRatio, 1)}x`
                      : fundamentals?.trailingPE
                      ? `${num(fundamentals.trailingPE, 1)}x`
                      : "—"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Column: MBA Valuation & Fundamentals Hub (Col span 5) */}
          <div className="flex flex-col space-y-3.5 overflow-y-auto bg-panel/30 p-4 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-line/70 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Fundamental & Valuation Hub
                </h3>
              </div>
              {fundamentals?.marketCap ? (
                <span className="font-mono text-[10px] text-muted">
                  Cap: {formatMarketCap(fundamentals.marketCap)}
                </span>
              ) : null}
            </div>

            {/* Visual Gauges: Valuation & Solvency side by side */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <ValuationMeter pe={fundamentals?.trailingPE ?? quote?.peRatio} />
              <HealthGauge de={fundamentals?.debtToEquity} roe={fundamentals?.returnOnEquity} />
            </div>

            {/* 3 Grouped Valuation Cards with Educational Tooltips */}
            <div className="space-y-2.5">
              {/* Card 1: Valuation Multiples */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Valuation Multiples</span>
                  <span className="text-[9px] text-muted">Market Pricing</span>
                </div>
                <div className="space-y-1.5">
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

              {/* Card 2: Profitability & Returns */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Profitability & Margins</span>
                  <span className="text-[9px] text-muted">Earnings Quality</span>
                </div>
                <div className="space-y-1.5">
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

              {/* Card 3: Financial Health & Size */}
              <div className="rounded-xl border border-line bg-panel2/80 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/90">Financial Health</span>
                  <span className="text-[9px] text-muted">Capital Structure</span>
                </div>
                <div className="space-y-1.5">
                  <MetricWithEdu
                    label="Debt-to-Equity (D/E)"
                    value={
                      fundamentals?.debtToEquity !== undefined
                        ? num(fundamentals.debtToEquity > 10 ? fundamentals.debtToEquity / 100 : fundamentals.debtToEquity, 2)
                        : "—"
                    }
                    explanation="Total Liabilities / Total Equity. D/E < 0.5 is conservative solvency; D/E > 1.5 indicates high leverage risk during rate hikes."
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
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel/70 px-5 py-2.5">
          <p className="text-[9px] text-muted/70">
            Valuation & fundamentals sourced from NSE & Yahoo Finance. Built for classroom case studies, not financial advice.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleWatchlist}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                inWatchlist
                  ? "border-line bg-panel text-muted hover:border-down/40 hover:text-down"
                  : "border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/15"
              }`}
            >
              {inWatchlist ? "Remove from watchlist" : "+ Add to watchlist"}
            </button>
            <a
              href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-muted hover:text-ink"
            >
              Open on NSE ↗
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

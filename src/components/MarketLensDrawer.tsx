"use client";

import { useEffect } from "react";

export function MarketLensDrawer({
  isOpen,
  onClose,
  selectedSymbol,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol?: string;
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NSE MarketLens Research Cockpit"
      className="fixed inset-0 z-50 flex justify-end animate-[fadeIn_150ms_ease-out]"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close MarketLens Drawer"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Drawer */}
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-line-strong bg-bg shadow-2xl animate-[slideLeft_200ms_ease-out]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-line bg-panel px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/15 text-cyan text-sm font-bold">
              🔍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-ink">NSE MarketLens</h2>
                <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan">
                  Official Exchange Portal
                </span>
              </div>
              <p className="text-[10px] text-muted">
                Quantitative Equity Screener & Valuation Research
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden rounded border border-line bg-panel2 px-1.5 py-0.5 text-[9px] font-mono text-muted sm:inline-block">
              ESC
            </kbd>
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

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-[11px] leading-relaxed">
          {/* Primary Action Card */}
          <div className="rounded-xl border border-cyan/40 bg-gradient-to-r from-cyan/15 via-panel2 to-panel p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-cyan">
                  National Stock Exchange of India
                </span>
                <h3 className="text-sm font-bold text-ink mt-0.5">
                  Launch Official MarketLens Portal
                </h3>
                <p className="mt-1 text-[11px] text-muted leading-relaxed">
                  Screen over 2,000+ listed equities directly with official exchange data, custom multi-factor criteria, and institutional presets.
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <a
                href="https://marketlens.nseindia.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan px-3.5 py-1.5 text-xs font-semibold text-black shadow-md hover:bg-cyan/90 transition-transform active:scale-95"
              >
                <span>Open marketlens.nseindia.com</span>
                <span className="text-[10px]" aria-hidden>↗</span>
              </a>

              {selectedSymbol ? (
                <a
                  href={`https://marketlens.nseindia.com/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-medium text-ink hover:border-cyan/40 hover:text-cyan transition-colors"
                >
                  <span>Search {selectedSymbol} on Lens</span>
                  <span className="text-[10px]" aria-hidden>↗</span>
                </a>
              ) : null}
            </div>
          </div>

          {/* Module Deep Links */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted">
              MarketLens Core Modules
            </h4>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Module 1 */}
              <a
                href="https://marketlens.nseindia.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-line bg-panel2/60 p-3 hover:border-cyan/40 hover:bg-panel2 transition-colors text-left"
              >
                <div className="flex items-center justify-between text-ink group-hover:text-cyan font-semibold text-xs">
                  <span>Custom Screener</span>
                  <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <p className="mt-1 text-[10px] text-muted leading-normal">
                  Filter by P/E, Market Cap, Debt/Equity, ROE, and Promoter Pledges.
                </p>
              </a>

              {/* Module 2 */}
              <a
                href="https://marketlens.nseindia.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-line bg-panel2/60 p-3 hover:border-cyan/40 hover:bg-panel2 transition-colors text-left"
              >
                <div className="flex items-center justify-between text-ink group-hover:text-cyan font-semibold text-xs">
                  <span>Sector Breakdown</span>
                  <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <p className="mt-1 text-[10px] text-muted leading-normal">
                  Sector-wise P/E multiples, financial performance, and capital allocation.
                </p>
              </a>

              {/* Module 3 */}
              <a
                href="https://marketlens.nseindia.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-line bg-panel2/60 p-3 hover:border-cyan/40 hover:bg-panel2 transition-colors text-left"
              >
                <div className="flex items-center justify-between text-ink group-hover:text-cyan font-semibold text-xs">
                  <span>Corporate Actions</span>
                  <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <p className="mt-1 text-[10px] text-muted leading-normal">
                  Upcoming dividend ex-dates, splits, bonuses, and board meetings.
                </p>
              </a>

              {/* Module 4 */}
              <a
                href="https://marketlens.nseindia.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-line bg-panel2/60 p-3 hover:border-cyan/40 hover:bg-panel2 transition-colors text-left"
              >
                <div className="flex items-center justify-between text-ink group-hover:text-cyan font-semibold text-xs">
                  <span>Pre-built Strategies</span>
                  <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <p className="mt-1 text-[10px] text-muted leading-normal">
                  GARP, Quality & Safety, High Dividend Yield, and Momentum screens.
                </p>
              </a>
            </div>
          </div>

          {/* MBA FinTech Educational Cheat Sheet */}
          <div className="rounded-xl border border-line bg-panel2/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink">
                MBA Quantitative Benchmarks
              </span>
              <span className="text-[9px] text-cyan font-medium">Panimalar FinTech Curriculum</span>
            </div>

            <div className="space-y-2 text-[10px]">
              <div className="flex items-start justify-between gap-2 border-b border-line/40 pb-1.5">
                <div>
                  <span className="font-semibold text-ink">Price-to-Earnings (P/E)</span>
                  <p className="text-muted text-[9px]">Market price per ₹1 of annual earnings.</p>
                </div>
                <span className="font-mono text-cyan shrink-0 text-right">
                  18x–25x (Fair)<br />
                  &gt;30x (Premium)
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 border-b border-line/40 pb-1.5">
                <div>
                  <span className="font-semibold text-ink">Debt-to-Equity (D/E)</span>
                  <p className="text-muted text-[9px]">Financial leverage and solvency risk.</p>
                </div>
                <span className="font-mono text-up shrink-0 text-right">
                  &lt; 0.5 (Conservative)<br />
                  &gt; 1.5 (High Leverage)
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 border-b border-line/40 pb-1.5">
                <div>
                  <span className="font-semibold text-ink">Return on Equity (ROE)</span>
                  <p className="text-muted text-[9px]">Net profit generated per ₹100 of net worth.</p>
                </div>
                <span className="font-mono text-up shrink-0 text-right">
                  &gt; 15% (Institutional)
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-ink">52-Week High Proximity</span>
                  <p className="text-muted text-[9px]">Stocks within 2.5% of peak indicate breakout momentum.</p>
                </div>
                <span className="font-mono text-cyan shrink-0 text-right">
                  Near 52W High
                </span>
              </div>
            </div>
          </div>

          {/* Classroom Lab Exercise Guide */}
          <div className="rounded-xl border border-line bg-panel/60 p-3 text-muted space-y-1.5">
            <h5 className="font-semibold text-ink text-[10px] uppercase tracking-wider">
              Classroom Practical Assignment Prompt
            </h5>
            <ol className="list-decimal pl-4 space-y-1 text-[10px] leading-relaxed">
              <li>Open <strong>MarketLens</strong> using the launcher above.</li>
              <li>Filter for <strong>Nifty 500</strong> companies with <strong>ROE &gt; 15%</strong> and <strong>P/E &lt; 25x</strong>.</li>
              <li>Note the top 3 symbols and enter them into this terminal&apos;s search bar (press <kbd className="font-mono bg-panel2 px-1 rounded">/</kbd>).</li>
              <li>Analyze their intraday 1D candle trend and volume profile on the live chart.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-line bg-panel px-5 py-2.5 text-center text-[10px] text-muted/70 flex items-center justify-between">
          <span>Panimalar Engineering College · MBA FinTech Lab</span>
          <span className="font-mono text-cyan">Press &apos;L&apos; to toggle anytime</span>
        </footer>
      </aside>
    </div>
  );
}

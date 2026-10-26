"use client";

import { useEffect } from "react";

interface ShortcutItem {
  keys: string[];
  action: string;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "1. Search & Global Navigation",
    items: [
      { keys: ["/"], action: "Focus Global Stock Search" },
      { keys: ["Ctrl", "K"], action: "Alternative Search Shortcut" },
      { keys: ["↑", "↓"], action: "Navigate search dropdown & watchlist" },
      { keys: ["Enter"], action: "Open Stock Valuation Modal" },
      { keys: ["Esc"], action: "Close modal / dismiss search" },
      { keys: ["L"], action: "Toggle NSE MarketLens Research Cockpit" },
    ],
  },
  {
    title: "2. Live Feed & Classroom Controls",
    items: [
      { keys: ["Space"], action: "Freeze / Resume live ticker tape" },
      { keys: ["R"], action: "Force instant market data refresh" },
      { keys: ["[", "]"], action: "Step polling interval (10s ↔ 1m)" },
    ],
  },
  {
    title: "3. TradingView Charting",
    items: [
      { keys: ["1", "–", "5"], action: "Switch timeframe (1D, 1W, 1M, 6M, 1Y)" },
      { keys: ["C"], action: "Toggle Candlestick vs. Area Chart" },
      { keys: ["V"], action: "Toggle Intraday Volume Histogram" },
    ],
  },
  {
    title: "4. Watchlist Stepping",
    items: [
      { keys: ["↑", "↓"], action: "Step through consecutive watchlist rows" },
      { keys: ["Enter"], action: "Open valuation modal for active stock" },
      { keys: ["W"], action: "Add or remove active stock from watchlist" },
    ],
  },
  {
    title: "5. Display & Classroom Projector",
    items: [
      { keys: ["F"], action: "Toggle Fullscreen Projector Mode" },
      { keys: ["Z"], action: "Cycle UI Scale (100% ↔ 150%)" },
      { keys: ["T"], action: "Toggle Dark / Light Terminal Theme" },
      { keys: ["M"], action: "Toggle Ticker Top vs. Bottom Dock" },
      { keys: ["?"], action: "Toggle this Keyboard Shortcuts HUD" },
    ],
  },
];

export function KeyboardShortcutsHUD({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close shortcuts dialog"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)]"
      />

      <div className="relative z-10 w-full max-w-2xl animate-[rise_160ms_ease-out] overflow-hidden rounded-2xl border border-line-strong bg-bg shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan/15 text-cyan text-xs font-mono font-bold">
              ⌘
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-ink">
                Panimalar FinTech Terminal Shortcuts
              </h2>
              <p className="text-[10px] text-muted">Institutional keyboard navigation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted hover:border-down/40 hover:text-down"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[68vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SHORTCUT_CATEGORIES.map((cat) => (
              <div
                key={cat.title}
                className="rounded-xl border border-line bg-panel2/60 p-3.5"
              >
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyan">
                  {cat.title}
                </h3>
                <div className="space-y-2">
                  {cat.items.map((item) => (
                    <div
                      key={item.action}
                      className="flex items-center justify-between gap-3 text-[11px]"
                    >
                      <span className="text-muted">{item.action}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="min-w-5 rounded border border-line-strong bg-panel px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-ink shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-line bg-panel/50 px-5 py-2.5 text-[10px] text-muted">
          <span>Press <kbd className="rounded border border-line bg-panel px-1 text-ink">?</kbd> anytime to toggle this cheat sheet</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-cyan/15 px-3 py-1 font-medium text-cyan hover:bg-cyan/25"
          >
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}

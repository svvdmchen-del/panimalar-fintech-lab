"use client";

import { pct, price, toneClass } from "@/lib/format";
import type { Quote } from "@/lib/types";

/**
 * Infinite ticker strip. Two identical halves scrolling by -50% gives a
 * seamless loop; hovering pauses it so a student can actually read a symbol.
 */
export function TickerTape({ quotes, onSelect }: { quotes: Quote[]; onSelect: (symbol: string) => void }) {
  if (!quotes.length) {
    return <div className="h-9 border-y border-line bg-panel/70" aria-hidden />;
  }

  const items = quotes.length < 10 ? [...quotes, ...quotes] : quotes;
  const duration = Math.max(35, Math.round(items.length * 3.4));

  return (
    <div className="relative overflow-hidden border-y border-line bg-panel/80">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent" />

      <div
        className="flex w-max animate-marquee hover:[animation-play-state:paused]"
        style={{ animationDuration: `${duration}s` }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-stretch" aria-hidden={copy === 1}>
            {items.map((quote, index) => (
              <button
                key={`${copy}-${quote.symbol}-${index}`}
                type="button"
                onClick={() => onSelect(quote.symbol)}
                className="flex items-center gap-2 whitespace-nowrap border-r border-line/50 px-4 py-2 text-[12px] transition-colors hover:bg-wash/5"
              >
                <span className="font-semibold tracking-wide text-ink/90">{quote.symbol}</span>
                <span className="font-mono tabular-nums text-muted">{price(quote.price)}</span>
                <span className={`font-mono text-[11px] tabular-nums ${toneClass(quote.changePct)}`}>
                  {pct(quote.changePct)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

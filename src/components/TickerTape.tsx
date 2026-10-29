"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { num, pct, price, toneClass } from "@/lib/format";
import type { IndexQuote, Quote } from "@/lib/types";

interface TickerItem {
  id: string;
  symbol: string;
  label?: string;
  price: number;
  change: number;
  changePct: number;
  isMacro?: boolean;
}

/**
 * Enhanced Live Marquee Ticker Tape:
 * Supports Macro FX/Commodities/Indices, stock quotes, real-time tick flashes,
 * direct modal opening, speed controls, play/pause freeze, and top/bottom docking.
 */
export function TickerTape({
  quotes,
  indices = [],
  onSelect,
  onDetails,
  dockBottom = false,
  onToggleDock,
}: {
  quotes: Quote[];
  indices?: IndexQuote[];
  onSelect: (symbol: string) => void;
  onDetails?: (symbol: string) => void;
  dockBottom?: boolean;
  onToggleDock?: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 0.5 | 1.8>(1);
  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  // Keyboard shortcut listener to toggle pause
  useEffect(() => {
    const onTogglePause = () => setPaused((p) => !p);
    window.addEventListener("nse:ticker-toggle-pause", onTogglePause);
    return () => window.removeEventListener("nse:ticker-toggle-pause", onTogglePause);
  }, []);

  // Macro indicators to mix into the ticker
  const macroItems: TickerItem[] = useMemo(() => {
    const list: TickerItem[] = [];

    // NIFTY 50 & BANK NIFTY & VIX
    const n50 = indices.find((idx) => idx.symbol === "NIFTY 50");
    if (n50) {
      list.push({
        id: "macro-nifty50",
        symbol: "NIFTY 50",
        label: "NIFTY",
        price: n50.last,
        change: n50.change,
        changePct: n50.changePct,
        isMacro: true,
      });
    }

    const bnk = indices.find((idx) => idx.symbol === "NIFTY BANK");
    if (bnk) {
      list.push({
        id: "macro-banknifty",
        symbol: "NIFTY BANK",
        label: "BANK NIFTY",
        price: bnk.last,
        change: bnk.change,
        changePct: bnk.changePct,
        isMacro: true,
      });
    }

    // Currency & Commodities benchmarks for Indian macro context
    list.push({
      id: "macro-usdinr",
      symbol: "USD/INR",
      label: "USD/INR",
      price: 83.42,
      change: -0.04,
      changePct: -0.05,
      isMacro: true,
    });

    list.push({
      id: "macro-brent",
      symbol: "BRENT",
      label: "BRENT CRUDE",
      price: 82.65,
      change: 0.65,
      changePct: 0.79,
      isMacro: true,
    });

    const vix = indices.find((idx) => idx.symbol === "INDIA VIX");
    if (vix) {
      list.push({
        id: "macro-vix",
        symbol: "INDIA VIX",
        label: "INDIA VIX",
        price: vix.last,
        change: vix.change,
        changePct: vix.changePct,
        isMacro: true,
      });
    }

    return list;
  }, [indices]);

  const items: TickerItem[] = useMemo(() => {
    const stockItems: TickerItem[] = quotes.map((q) => ({
      id: `stock-${q.symbol}`,
      symbol: q.symbol,
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      isMacro: false,
    }));

    const combined = [...macroItems, ...stockItems];
    return combined.length < 12 ? [...combined, ...combined] : combined;
  }, [macroItems, quotes]);

  // Tick detection
  useEffect(() => {
    if (!items.length) return;
    const prev = prevPricesRef.current;
    const newFlashes: Record<string, "up" | "down"> = {};
    let hasTicks = false;

    for (const item of items) {
      const old = prev.get(item.symbol);
      if (old !== undefined && old !== item.price) {
        newFlashes[item.symbol] = item.price > old ? "up" : "down";
        hasTicks = true;
      }
      prev.set(item.symbol, item.price);
    }

    if (hasTicks) {
      setFlashes((curr) => ({ ...curr, ...newFlashes }));
      const timer = window.setTimeout(() => {
        setFlashes((curr) => {
          const next = { ...curr };
          for (const k of Object.keys(newFlashes)) {
            if (next[k] === newFlashes[k]) delete next[k];
          }
          return next;
        });
      }, 650);
      return () => window.clearTimeout(timer);
    }
  }, [items]);

  const baseDuration = Math.max(35, Math.round(items.length * 3.2));
  const effectiveDuration = baseDuration / speed;

  const handleClick = (item: TickerItem) => {
    if (item.isMacro) {
      onSelect(item.symbol);
    } else if (onDetails) {
      onDetails(item.symbol);
    } else {
      onSelect(item.symbol);
    }
  };

  const containerClasses = dockBottom
    ? "fixed bottom-0 inset-x-0 z-40 border-t border-line-strong bg-panel/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
    : "relative overflow-hidden border-y border-line bg-panel/80";

  return (
    <div className={containerClasses}>
      {/* Side gradient fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-32 z-10 w-12 bg-gradient-to-l from-bg to-transparent" />

      {/* Control Pills Widget (Dock, Play/Pause, Speed) */}
      <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1 rounded-md border border-line bg-panel2/90 px-1.5 py-0.5 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          title={paused ? "Resume ticker scrolling" : "Pause ticker for classroom presentation"}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-wash/10 hover:text-ink"
        >
          {paused ? "▶ Play" : "⏸ Freeze"}
        </button>

        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 0.5 : s === 0.5 ? 1.8 : 1))}
          title="Adjust ticker scroll speed"
          className="rounded px-1 text-[10px] font-mono text-muted hover:bg-wash/10 hover:text-cyan"
        >
          {speed === 1 ? "1x" : speed === 0.5 ? "0.5x" : "2x"}
        </button>

        {onToggleDock ? (
          <button
            type="button"
            onClick={onToggleDock}
            title={dockBottom ? "Dock ticker to top strip" : "Pin ticker to bottom dock (TV style)"}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              dockBottom ? "bg-cyan/15 font-semibold text-cyan" : "text-muted hover:text-ink"
            }`}
          >
            {dockBottom ? "⚓ Bottom" : "📌 Dock"}
          </button>
        ) : null}
      </div>

      <div
        className="flex w-max animate-marquee hover:[animation-play-state:paused]"
        style={{
          animationDuration: `${effectiveDuration}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-stretch" aria-hidden={copy === 1}>
            {items.map((item, index) => {
              const flash = flashes[item.symbol];
              const flashClass =
                flash === "up"
                  ? "bg-up/[0.18] text-up font-bold"
                  : flash === "down"
                  ? "bg-down/[0.18] text-down font-bold"
                  : "";

              const isUp = item.changePct > 0;
              const isDown = item.changePct < 0;
              const arrowGlyph = isUp ? "▲" : isDown ? "▼" : "◆";
              const badgeToneClass = isUp
                ? "bg-up/15 text-up border-up/30 hover:bg-up/25"
                : isDown
                ? "bg-down/15 text-down border-down/30 hover:bg-down/25"
                : "bg-panel2 text-muted border-line/80";

              return (
                <button
                  key={`${copy}-${item.symbol}-${index}`}
                  type="button"
                  onClick={() => handleClick(item)}
                  title={item.isMacro ? `Select ${item.symbol}` : `Open ${item.symbol} Valuation & Detail Modal`}
                  className={`group flex items-center gap-2 whitespace-nowrap border-r border-line/50 px-3.5 py-2 text-[11px] transition-colors duration-300 hover:bg-wash/5 ${flashClass}`}
                >
                  {item.isMacro ? (
                    <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan font-mono tracking-wider">
                      MACRO
                    </span>
                  ) : null}
                  <span className="font-semibold tracking-wide text-ink/90">{item.label ?? item.symbol}</span>
                  <span className="font-mono tabular-nums text-muted font-medium">
                    {item.isMacro && item.symbol === "USD/INR"
                      ? `₹${item.price.toFixed(2)}`
                      : item.isMacro && item.symbol === "BRENT"
                      ? `$${item.price.toFixed(2)}`
                      : item.isMacro && item.symbol === "INDIA VIX"
                      ? num(item.price, 2)
                      : price(item.price)}
                  </span>

                  {/* Tinted Micro-Badge Chip with Up/Down Arrow (CNBC / TV Marquee Style) */}
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums border transition-all ${badgeToneClass} ${
                      flash === "up" ? "ring-1 ring-up bg-up/30 shadow-xs" : flash === "down" ? "ring-1 ring-down bg-down/30 shadow-xs" : ""
                    }`}
                  >
                    <span className="text-[8px] leading-none shrink-0" aria-hidden>
                      {arrowGlyph}
                    </span>
                    <span>{pct(item.changePct)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

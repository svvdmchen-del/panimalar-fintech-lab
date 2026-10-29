"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { num, pct, pctOf, signed, timeIST, toneClass } from "@/lib/format";
import { INDEX_CATEGORIES, type IndexCategory, type IndexCardMeta } from "@/lib/symbols";
import type { Envelope, History, IndexQuote } from "@/lib/types";
import { RangeBar, Skeleton } from "./ui";

type CardOrder = "fixed" | "movers";

const VIX_MIN = 8;
const VIX_MAX = 32;

const VIX_ZONES = [
  { from: 8, to: 12, label: "Complacent", bar: "bg-up", text: "text-up" },
  { from: 12, to: 18, label: "Normal", bar: "bg-cyan", text: "text-cyan" },
  { from: 18, to: 25, label: "Elevated", bar: "bg-accent", text: "text-accent" },
  { from: 25, to: 32, label: "Panic", bar: "bg-down", text: "text-down" },
] as const;

function regimeFor(value: number) {
  return VIX_ZONES.find((zone) => value < zone.to) ?? VIX_ZONES[VIX_ZONES.length - 1];
}

/** Providers disagree on yield units — normalise 0.012 and 1.2 to a percentage. */
function formatYield(value?: number): string | null {
  if (value === undefined || Number.isNaN(value)) return null;
  const normalized = Math.abs(value) <= 1 && value !== 0 ? value * 100 : value;
  return `${num(normalized, 2)}%`;
}

/** Build a 100×40 area path for the hover sparkline watermark. */
function sparkGeometry(values: number[]) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 34 - ((value - min) / span) * 28;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  return { line, area: `${line} L100,40 L0,40 Z` };
}

export function IndexStrip({
  indices,
  loading,
  selected,
  live = false,
  asOf,
  onSelect,
}: {
  indices: IndexQuote[];
  loading: boolean;
  /** Currently charted symbol, highlighted on its card. */
  selected?: string;
  /** False after 15:30 — suppresses tick flashes and labels the move as a snapshot. */
  live?: boolean;
  /** Feed timestamp (epoch ms or ISO) shown in the 52-week popover when closed. */
  asOf?: number | string | null;
  onSelect: (symbol: string) => void;
}) {
  const byName = useMemo(() => new Map(indices.map((index) => [index.symbol, index])), [indices]);
  const nifty = byName.get("NIFTY 50");

  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  const [category, setCategory] = useState<IndexCategory>("core");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nse-lab.index-category") as IndexCategory | null;
      if (saved && INDEX_CATEGORIES.some((c) => c.id === saved)) {
        setCategory(saved);
      }
    } catch {
      // quota or private mode fallback
    }
  }, []);

  const chooseCategory = (next: IndexCategory) => {
    setCategory(next);
    try {
      localStorage.setItem("nse-lab.index-category", next);
    } catch {}
  };

  const [order, setOrder] = useState<CardOrder>("fixed");
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const sparkRequests = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const positionsRef = useRef<Map<string, DOMRect>>(new Map());

  // Tick flash detection for benchmark indices. State is applied from a timer so
  // React never sees a synchronous setState inside the effect body.
  useEffect(() => {
    if (!indices.length) return;
    const previous = prevPricesRef.current;
    const next: Record<string, "up" | "down"> = {};
    let hasTicks = false;

    for (const index of indices) {
      const oldPrice = previous.get(index.symbol);
      if (live && oldPrice !== undefined && oldPrice !== index.last) {
        next[index.symbol] = index.last > oldPrice ? "up" : "down";
        hasTicks = true;
      }
      previous.set(index.symbol, index.last);
    }

    if (!hasTicks) {
      if (!live) {
        const clear = window.setTimeout(() => {
          setFlashes((current) => (Object.keys(current).length ? {} : current));
        }, 0);
        return () => window.clearTimeout(clear);
      }
      return;
    }

    const show = window.setTimeout(() => {
      setFlashes((current) => ({ ...current, ...next }));
    }, 0);

    const clear = window.setTimeout(() => {
      setFlashes((current) => {
        const updated = { ...current };
        for (const symbol of Object.keys(next)) {
          if (updated[symbol] === next[symbol]) delete updated[symbol];
        }
        return updated;
      });
    }, 650);

    return () => {
      window.clearTimeout(show);
      window.clearTimeout(clear);
    };
  }, [indices, live]);

  /** Movers keeps the VIX regime card pinned last so its inverse tone stays readable. */
  const orderedCards = useMemo(() => {
    const activeMeta = INDEX_CATEGORIES.find((c) => c.id === category) ?? INDEX_CATEGORIES[0];
    const cards = [...activeMeta.cards];
    if (order === "fixed") return cards;
    const equities = cards
      .filter((card) => card.symbol !== "INDIA VIX")
      .sort((a, b) => (byName.get(b.symbol)?.changePct ?? 0) - (byName.get(a.symbol)?.changePct ?? 0));
    const vix = cards.filter((card) => card.symbol === "INDIA VIX");
    return [...equities, ...vix];
  }, [category, order, byName]);

  const chooseOrder = (next: CardOrder) => {
    if (next === order) return;
    // Capture pre-change positions so the layout effect can FLIP the cards.
    positionsRef.current = new Map();
    cardRefs.current.forEach((element, symbol) => {
      positionsRef.current.set(symbol, element.getBoundingClientRect());
    });
    setOrder(next);
  };

  useLayoutEffect(() => {
    const previous = positionsRef.current;
    if (!previous.size) return;
    positionsRef.current = new Map();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    cardRefs.current.forEach((element, symbol) => {
      const before = previous.get(symbol);
      if (!before) return;
      const after = element.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    });
  }, [order]);

  const loadSpark = (symbol: string) => {
    if (sparks[symbol] || sparkRequests.current.has(symbol)) return;
    sparkRequests.current.add(symbol);
    fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&range=1D`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: Envelope<History> | null) => {
        const candles = payload?.data?.candles ?? [];
        if (candles.length < 2) return;
        const step = Math.max(1, Math.ceil(candles.length / 48));
        const values = candles
          .filter((_, index) => index % step === 0 || index === candles.length - 1)
          .map((candle) => candle.close)
          .filter(Number.isFinite);
        if (values.length < 2) return;
        setSparks((current) => ({ ...current, [symbol]: values }));
      })
      .catch(() => {
        // The sparkline is decorative — keep failures silent.
      })
      .finally(() => {
        sparkRequests.current.delete(symbol);
      });
  };

  const selectCard = (symbol: string) => {
    onSelect(symbol);
    const chart = document.getElementById("chart");
    if (!chart) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Market indices
          </span>

          {/* Segmented Category Tabs */}
          <div
            role="tablist"
            aria-label="Index category selector"
            className="inline-flex items-center rounded-lg border border-line bg-panel2/90 p-0.5 shadow-xs"
          >
            {INDEX_CATEGORIES.map((cat) => {
              const isActive = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => chooseCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? "bg-cyan/15 text-cyan font-bold shadow-xs border border-cyan/30"
                      : "text-muted hover:text-ink hover:bg-wash/5 border border-transparent font-medium"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`rounded px-1 py-0.2 text-[8px] font-mono ${
                      isActive ? "bg-cyan/25 text-cyan" : "bg-panel text-muted/70"
                    }`}
                  >
                    {cat.cards.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="group"
          aria-label="Index card order"
          className="flex items-center rounded-md border border-line bg-panel/70 p-0.5"
        >
          {(
            [
              { id: "fixed", label: "Fixed", hint: "Exchange order" },
              { id: "movers", label: "Movers", hint: "Sort by daily change — VIX stays last" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              aria-pressed={order === option.id}
              onClick={() => chooseOrder(option.id)}
              className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
                order === option.id ? "bg-cyan/15 text-cyan" : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6"
        aria-busy={loading}
      >
        {orderedCards.map((card) => {
          const index = byName.get(card.symbol);
          if (!index) {
            return (
              <div key={card.symbol} className="rounded-xl border border-line bg-panel/80 p-3">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-3 h-5 w-24" />
                <Skeleton className="mt-3 h-1 w-full" />
              </div>
            );
          }

          const isVix = card.symbol === "INDIA VIX";
          const isSelected = selected === card.symbol;
          const flash = live ? flashes[card.symbol] : undefined;
          const flashCardClass = isSelected
            ? "border-cyan/60 bg-cyan/[0.06] ring-2 ring-cyan/50"
            : flash === "up"
              ? "border-up/50 bg-up/[0.12]"
              : flash === "down"
                ? "border-down/50 bg-down/[0.12]"
                : "border-line bg-panel/80 hover:border-line-strong hover:bg-panel2";

          const advances = index.advances ?? 0;
          const declines = index.declines ?? 0;
          const unchanged = index.unchanged ?? 0;
          const total = advances + declines + unchanged;
          const advShare = total ? advances / total : 0;
          const decShare = total ? declines / total : 0;
          const unchangedShare = total ? unchanged / total : 0;
          const breadthState =
            total === 0
              ? null
              : advShare >= 0.6
                ? "Broad advance"
                : decShare >= 0.6
                  ? "Broad decline"
                  : advShare > decShare
                    ? "Advancing"
                    : decShare > advShare
                      ? "Declining"
                      : "Mixed";
          const breadthTone =
            advShare >= 0.6 ? "text-up" : decShare >= 0.6 ? "text-down" : "text-muted";

          const regime = regimeFor(index.last);
          const riskTone =
            index.changePct > 0 ? "text-down" : index.changePct < 0 ? "text-up" : "text-muted";
          const riskLabel =
            index.changePct > 0 ? "Risk-off" : index.changePct < 0 ? "Risk-on" : "Neutral";
          const changeTone = isVix ? riskTone : toneClass(index.changePct);

          const digits = isVix ? 2 : 0;
          const gapPct = index.prevClose ? ((index.open - index.prevClose) / index.prevClose) * 100 : null;
          const rangePct = index.prevClose ? ((index.high - index.low) / index.prevClose) * 100 : null;
          const dayPosition = Math.round(pctOf(index.last, index.low, index.high));

          let derivedText = `Range ${num(rangePct, 1)}%`;
          let derivedShort = derivedText;
          let derivedTone = "text-muted";
          if (!isVix && index.symbol !== "NIFTY 50" && nifty) {
            const compared = index.changePct - nifty.changePct;
            derivedText = `${signed(compared, 2)} pp vs NIFTY`;
            derivedShort = `${signed(compared, 2)} pp`;
            derivedTone = toneClass(compared);
          } else if (gapPct !== null && Number.isFinite(gapPct)) {
            derivedText = `Gap ${pct(gapPct)}`;
            derivedShort = derivedText;
            derivedTone = toneClass(gapPct);
          }

          const cornerText = isVix ? regime.label : live ? derivedText : "Prev close";
          const cornerTone = isVix ? regime.text : live ? derivedTone : "text-muted";

          const directionGlyph = index.changePct > 0 ? "▲" : index.changePct < 0 ? "▼" : "◆";
          const directionWord =
            index.changePct > 0 ? "up" : index.changePct < 0 ? "down" : "unchanged";
          const ariaLabel = `${card.label}, ${card.hint}, at ${num(index.last, 2)}, ${directionWord} ${num(
            Math.abs(index.changePct),
            2,
          )} percent, ${signed(index.change, 2)} points.${
            isVix ? ` ${regime.label} volatility, ${riskLabel.toLowerCase()}.` : ""
          }${!live && asOf ? ` Snapshot as of ${timeIST(asOf)} IST.` : ""} Activate to open the chart.`;
          const cardTitle = `${card.label} · ${card.hint}${
            !live && asOf ? ` · as of ${timeIST(asOf)} IST` : ""
          }`;

          const geometry = sparks[card.symbol] ? sparkGeometry(sparks[card.symbol]) : null;
          const sparkColor = index.changePct >= 0 ? "var(--color-up)" : "var(--color-down)";

          const hasYearRange = index.yearHigh > index.yearLow;
          const yearPosition = hasYearRange ? pctOf(index.last, index.yearLow, index.yearHigh) : 0;
          const distanceToHigh = hasYearRange ? (index.last / index.yearHigh - 1) * 100 : null;
          const distanceAboveLow = hasYearRange ? (index.last / index.yearLow - 1) * 100 : null;
          const dividendYield = formatYield(index.dividendYield);
          const valuations = isVix
            ? []
            : [
                index.pe !== undefined && Number.isFinite(index.pe)
                  ? { label: "P/E", value: num(index.pe, 1) }
                  : null,
                index.pb !== undefined && Number.isFinite(index.pb)
                  ? { label: "P/B", value: num(index.pb, 1) }
                  : null,
                dividendYield ? { label: "Div yield", value: dividendYield } : null,
              ].filter((row): row is { label: string; value: string } => row !== null);

          return (
            <div
              key={card.symbol}
              ref={(element) => {
                if (element) cardRefs.current.set(card.symbol, element);
                else cardRefs.current.delete(card.symbol);
              }}
              className="group relative hover:z-20 focus-within:z-20"
            >
              <button
                type="button"
                onClick={() => selectCard(card.symbol)}
                onMouseEnter={() => loadSpark(card.symbol)}
                onFocus={() => loadSpark(card.symbol)}
                aria-pressed={isSelected}
                aria-label={ariaLabel}
                title={cardTitle}
                className={`@container relative flex h-full w-full flex-col overflow-hidden rounded-xl border p-3 text-left transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${flashCardClass}`}
              >
                {geometry ? (
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300 group-hover:opacity-20 group-focus-within:opacity-20"
                    style={{ color: sparkColor }}
                  >
                    <path d={geometry.area} fill="currentColor" opacity="0.35" />
                    <path
                      d={geometry.line}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : null}

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {card.label}
                    </span>
                    <div
                      className="relative shrink-0 text-[9px] font-semibold uppercase tracking-wider"
                      title={live && !isVix ? derivedText : undefined}
                    >
                      <span
                        className={`block transition-opacity duration-150 group-hover:hidden group-focus-within:hidden ${cornerTone}`}
                      >
                        {cornerText === "Prev close" ? (
                          <>
                            <span className="hidden @max-[120px]:inline">PC</span>
                            <span className="@max-[120px]:hidden">Prev close</span>
                          </>
                        ) : live && !isVix ? (
                          <>
                            <span className="@min-[160px]:hidden">{derivedShort}</span>
                            <span className="hidden @min-[160px]:inline">{derivedText}</span>
                          </>
                        ) : (
                          cornerText
                        )}
                      </span>
                      <span className="hidden group-hover:inline-flex group-focus-within:inline-flex items-center text-cyan whitespace-nowrap">
                        Open chart ↗
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-baseline justify-between gap-1 @max-[130px]:flex-col @max-[130px]:items-start @max-[130px]:gap-0.5">
                    <span
                      className={`font-mono text-[19px] leading-none tabular-nums transition-colors duration-300 @min-[130px]:@max-[150px]:text-[16px] @max-[130px]:text-[18px] ${
                        flash === "up"
                          ? "font-bold text-up"
                          : flash === "down"
                            ? "font-bold text-down"
                            : "text-ink"
                      }`}
                    >
                      {num(index.last, 2)}
                    </span>
                    <span
                      className={`flex items-baseline gap-0.5 font-mono text-[11px] tabular-nums @min-[130px]:@max-[150px]:text-[10px] @max-[130px]:text-[11px] ${changeTone}`}
                      title={
                        isVix
                          ? `India VIX ${index.changePct < 0 ? "falling" : "rising"} — ${riskLabel.toLowerCase()}`
                          : undefined
                      }
                    >
                      <span aria-hidden className="text-[9px]">
                        {directionGlyph}
                      </span>
                      {pct(index.changePct)}
                    </span>
                  </div>

                  {isVix ? (
                    <div className="mt-2.5">
                      <div
                        role="img"
                        aria-label={`Volatility regime ${regime.label}. Complacent below 12, normal 12 to 18, elevated 18 to 25, panic above 25. India VIX at ${num(index.last, 2)}.`}
                        title="Complacent <12 · Normal 12–18 · Elevated 18–25 · Panic >25"
                        className="relative h-1.5 w-full rounded-full bg-track/40"
                      >
                        <div className="absolute inset-0 flex overflow-hidden rounded-full">
                          {VIX_ZONES.map((zone) => (
                            <span
                              key={zone.label}
                              className={`h-full ${zone.bar} ${
                                zone.label === regime.label ? "opacity-90" : "opacity-25"
                              }`}
                              style={{
                                width: `${((zone.to - zone.from) / (VIX_MAX - VIX_MIN)) * 100}%`,
                              }}
                            />
                          ))}
                        </div>
                        <span
                          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg bg-ink"
                          style={{ left: `${pctOf(index.last, VIX_MIN, VIX_MAX)}%` }}
                          aria-hidden
                        />
                      </div>

                      <div className="mt-1.5">
                        <RangeBar
                          low={index.yearLow}
                          high={index.yearHigh}
                          value={index.last}
                          fill={false}
                          tone="flat"
                        />
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                        <span className={`truncate font-semibold uppercase tracking-wider ${riskTone}`}>
                          {riskLabel}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted">
                          52w {num(index.yearLow, 0)}–{num(index.yearHigh, 0)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5">
                      <div
                        role="img"
                        aria-label={`Open ${num(index.open, digits)}, high ${num(index.high, digits)}, low ${num(
                          index.low,
                          digits,
                        )}, previous close ${num(index.prevClose, digits)}, gap ${
                          gapPct === null ? "unavailable" : pct(gapPct)
                        }, ${dayPosition} percent of the day range.`}
                        className="group/range relative -mx-0.5 py-1"
                      >
                        <RangeBar
                          low={index.low}
                          high={index.high}
                          value={index.last}
                          prevClose={index.prevClose}
                          pivotAtPrevClose
                        />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[150px] -translate-x-1/2 rounded-md border border-line-strong bg-panel2 px-2 py-1 text-center font-mono text-[9px] leading-tight text-muted opacity-0 shadow-xl transition-opacity duration-150 group-hover/range:opacity-100 sm:block">
                          <div className="whitespace-nowrap">
                            O {num(index.open, digits)} · H {num(index.high, digits)}
                          </div>
                          <div className="whitespace-nowrap">
                            L {num(index.low, digits)} · PC {num(index.prevClose, digits)}
                          </div>
                          <div className="whitespace-nowrap">
                            Gap {gapPct === null ? "—" : pct(gapPct)} · {dayPosition}% range
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div
                          role="img"
                          aria-label={`${advances} advances, ${declines} declines, ${unchanged} unchanged${
                            breadthState ? `, ${breadthState.toLowerCase()}` : ""
                          }`}
                          className="flex h-0.5 flex-1 overflow-hidden rounded-full bg-track/40"
                        >
                          {advances > 0 ? (
                            <span className="h-full bg-up/80" style={{ width: `${advShare * 100}%` }} />
                          ) : null}
                          {unchanged > 0 ? (
                            <span
                              className="h-full bg-track"
                              style={{ width: `${unchangedShare * 100}%` }}
                            />
                          ) : null}
                          {declines > 0 ? (
                            <span className="h-full bg-down/80" style={{ width: `${decShare * 100}%` }} />
                          ) : null}
                        </div>
                        {breadthState ? (
                          <span
                            className={`shrink-0 text-[9px] font-medium uppercase tracking-wide ${breadthTone}`}
                          >
                            {breadthState}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                        {total > 0 ? (
                          <span className="truncate font-mono tabular-nums text-muted">
                            <span className="text-up">{advances}</span>
                            <span className="mx-0.5 text-muted">/</span>
                            <span className="text-down">{declines}</span>
                            <span className="ml-1 text-[9px] uppercase tracking-wide text-muted @max-[130px]:hidden">
                              adv/dec
                            </span>
                          </span>
                        ) : (
                          <span className="truncate font-mono tabular-nums text-muted">
                            {hasYearRange
                              ? `${num(index.yearLow, digits)} – ${num(index.yearHigh, digits)}`
                              : "—"}
                          </span>
                        )}
                        <span
                          className={`shrink-0 font-mono tabular-nums ${toneClass(index.change)}`}
                        >
                          {signed(index.change, 2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </button>

              <div className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-1.5 hidden rounded-lg border border-line-strong bg-panel2/95 p-2.5 text-left opacity-0 shadow-2xl backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:block">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted">
                  <span>52-week range</span>
                  {hasYearRange ? (
                    <span className="font-mono tabular-nums">{yearPosition.toFixed(0)}%</span>
                  ) : null}
                </div>

                {hasYearRange ? (
                  <>
                    <div className="relative mt-1 h-1 w-full rounded-full bg-track/50">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-cyan/60"
                        style={{ width: `${yearPosition}%` }}
                      />
                      <span
                        className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg bg-ink"
                        style={{ left: `${yearPosition}%` }}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-muted">
                      <span>L {num(index.yearLow, isVix ? 2 : 0)}</span>
                      <span>H {num(index.yearHigh, isVix ? 2 : 0)}</span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[9px] text-muted">
                      <span>{pct(distanceToHigh, 1)} to high</span>
                      <span>{pct(distanceAboveLow, 1)} above low</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-[9px] text-muted">52-week range unavailable</div>
                )}

                {valuations.length ? (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-line/70 pt-1.5">
                    {valuations.map((row) => (
                      <div key={row.label}>
                        <div className="text-[9px] uppercase tracking-wider text-muted">{row.label}</div>
                        <div className="font-mono text-[10px] tabular-nums text-ink">{row.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!live ? (
                  <div className="mt-1.5 border-t border-line/70 pt-1 text-[9px] text-muted">
                    Snapshot{asOf ? ` · as of ${timeIST(asOf)} IST` : ""}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

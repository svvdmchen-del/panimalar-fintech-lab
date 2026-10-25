"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { num, price, pct, timeIST, toneClass } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import { useTheme } from "@/lib/theme";
import type { ChartRange, Candle, Envelope, History } from "@/lib/types";
import { DataBadge, Empty, Skeleton } from "./ui";

const RANGES: ChartRange[] = ["1D", "1W", "1M", "6M", "1Y"];
/** Shift epoch seconds so the chart's UTC axis renders IST wall-clock time. */
const IST_SHIFT = 19_800;

/**
 * lightweight-charts paints to a canvas, so it cannot read CSS variables — the
 * colours are mirrored here and keyed by theme.
 */
const CHART_COLORS = {
  dark: {
    up: "#16d488",
    down: "#ff4d6a",
    text: "#8391a9",
    grid: "rgba(26,35,51,0.5)",
    border: "#1a2333",
    crosshair: "rgba(60,201,245,0.4)",
    labelBg: "#1a2333",
    areaTop: { up: "rgba(22,212,136,0.30)", down: "rgba(255,77,106,0.30)" },
    volume: { up: "rgba(22,212,136,0.30)", down: "rgba(255,77,106,0.30)" },
  },
  light: {
    up: "#0a8f5b",
    down: "#cf2542",
    text: "#5b6a82",
    grid: "rgba(13,21,34,0.06)",
    border: "#dde5ef",
    crosshair: "rgba(11,127,166,0.45)",
    labelBg: "#0d1522",
    areaTop: { up: "rgba(10,143,91,0.20)", down: "rgba(207,37,66,0.20)" },
    volume: { up: "rgba(10,143,91,0.22)", down: "rgba(207,37,66,0.22)" },
  },
} as const;

const RANGE_LABEL: Record<ChartRange, string> = {
  "1D": "Intraday",
  "1W": "1 week",
  "1M": "1 month",
  "6M": "6 months",
  "1Y": "1 year",
};

export function PriceChart({
  symbol,
  intervalMs,
  height = 320,
}: {
  symbol: string;
  intervalMs: number;
  height?: number;
}) {
  const [range, setRange] = useState<ChartRange>("1D");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const url = `/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${range}`;
  const { data, loading, error } = usePoll<Envelope<History>>(url, Math.max(intervalMs, 30_000));

  const candles = useMemo(() => {
    const raw = data?.data?.candles ?? [];
    if (!raw.length) return [];
    // Ensure chronological order and strictly ascending timestamps so lightweight-charts never crashes
    const sorted = [...raw].sort((a, b) => a.time - b.time);
    const deduped: Candle[] = [];
    for (const candle of sorted) {
      if (!deduped.length || candle.time > deduped[deduped.length - 1].time) {
        deduped.push(candle);
      }
    }
    return deduped;
  }, [data]);
  const isIntraday = range === "1D";
  const { theme } = useTheme();

  const stats = useMemo(() => {
    if (!candles.length) return null;
    const last = candles[candles.length - 1];
    const first = candles[0];
    const prevClose = data?.data?.prevClose ?? first.open;
    const change = last.close - prevClose;
    return {
      open: first.open,
      high: candles.reduce((max, candle) => Math.max(max, candle.high), last.high),
      low: candles.reduce((min, candle) => Math.min(min, candle.low), last.low),
      close: last.close,
      change,
      changePct: prevClose ? (change / prevClose) * 100 : 0,
      time: last.time,
    };
  }, [candles, data?.data?.prevClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length < 2) return;

    const colors = CHART_COLORS[theme];

    const chart = createChart(container, {
      width: Math.max(320, container.clientWidth),
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        fontSize: 10,
        fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: isIntraday,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 8,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshair, width: 1, style: 2, labelBackgroundColor: colors.labelBg },
        horzLine: { color: colors.crosshair, width: 1, style: 2, labelBackgroundColor: colors.labelBg },
      },
      localization: {
        locale: "en-IN",
        timeFormatter: (time: Time) =>
          typeof time === "number"
            ? new Intl.DateTimeFormat("en-IN", {
                timeZone: "UTC",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(time * 1000))
            : String(time),
      },
    });

    const toTime = (candle: Candle) => (candle.time + IST_SHIFT) as UTCTimestamp;
    const rising = candles[candles.length - 1].close >= candles[0].open;

    if (isIntraday) {
      const area = chart.addSeries(AreaSeries, {
        lineColor: rising ? colors.up : colors.down,
        lineWidth: 2,
        topColor: rising ? colors.areaTop.up : colors.areaTop.down,
        bottomColor: "rgba(0,0,0,0)",
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: { type: "price", precision: 2, minMove: 0.05 },
      });
      area.setData(candles.map((candle) => ({ time: toTime(candle), value: candle.close })));
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: colors.up,
        downColor: colors.down,
        borderVisible: false,
        wickUpColor: colors.up,
        wickDownColor: colors.down,
        priceFormat: { type: "price", precision: 2, minMove: 0.05 },
      });
      series.setData(
        candles.map((candle) => ({
          time: toTime(candle),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })),
      );
    }

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volume.setData(
      candles.map((candle) => ({
        time: toTime(candle),
        value: candle.volume,
        color: candle.close >= candle.open ? colors.volume.up : colors.volume.down,
      })),
    );
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // Inset the first/last bar so the edge tick labels are not clipped. The
    // padding is expressed in bars, so it scales with the pixel width.
    const fitRange = (width: number) => {
      const plot = Math.max(200, width - 64);
      const spacing = Math.max(2, plot / candles.length);
      const pad = Math.max(1, Math.min(30, Math.ceil(24 / spacing)));
      chart.timeScale().setVisibleLogicalRange({ from: -pad, to: candles.length - 1 + pad });
    };

    fitRange(container.clientWidth || 640);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (!width) return;
      chart.applyOptions({ width: Math.floor(width) });
      fitRange(width);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [candles, isIntraday, height, theme]);

  return (
    <section
      aria-label={`${symbol} price chart`}
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-panel/90"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="truncate text-sm font-semibold tracking-wide text-ink">{symbol}</h2>
          {stats ? (
            <>
              <span className="font-mono text-lg tabular-nums text-ink">{price(stats.close)}</span>
              <span className={`font-mono text-xs tabular-nums ${toneClass(stats.changePct)}`}>
                {stats.change > 0 ? "+" : ""}
                {num(stats.change)} ({pct(stats.changePct)})
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {data ? <DataBadge status={data.status} source={data.source} /> : null}
          <div className="flex overflow-hidden rounded-md border border-line bg-panel2" role="tablist" aria-label="Chart range">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={range === option}
                onClick={() => setRange(option)}
                className={`px-2 py-1 font-mono text-[10px] transition-colors ${
                  range === option ? "bg-cyan/15 text-cyan" : "text-muted hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      {stats ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 border-b border-line/70 px-3.5 py-2 font-mono text-[10px] tabular-nums text-muted sm:grid-cols-6">
          <Stat label="Open" value={price(stats.open)} />
          <Stat label="High" value={price(stats.high)} tone="up" />
          <Stat label="Low" value={price(stats.low)} tone="down" />
          <Stat label="Prev" value={price(data?.data?.prevClose)} />
          <Stat label={isIntraday ? "Last tick" : "Last candle"} value={timeIST(stats.time * 1000)} />
          <Stat label="Bars" value={String(candles.length)} />
        </div>
      ) : null}

      <div className="relative px-1 pb-1 pt-2">
        {!candles.length && loading ? (
          <div className="p-4">
            <Skeleton className="h-[280px] w-full" />
          </div>
        ) : !candles.length ? (
          <Empty>Chart unavailable for {symbol} ({error ?? "no candles returned"}).</Empty>
        ) : null}
        <div ref={containerRef} className="w-full" style={{ height }} />
        <span className="pointer-events-none absolute bottom-2 right-3 rounded bg-bg/70 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted/60">
          {RANGE_LABEL[range]}
        </span>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="uppercase tracking-wider text-muted/60">{label}</span>
      <span className={tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink/85"}>{value}</span>
    </div>
  );
}

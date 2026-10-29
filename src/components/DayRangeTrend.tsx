"use client";

import { useId, useMemo } from "react";
import { num, pctOf } from "@/lib/format";

interface DayRangeTrendProps {
  symbol: string;
  open: number;
  low: number;
  high: number;
  current: number;
  prevClose: number;
  className?: string;
}

/**
 * Generate a realistic 7-point intraday curve that respects open, low, high, and current
 * with natural variations per stock symbol.
 */
function generateIntradayPoints(
  open: number,
  low: number,
  high: number,
  current: number,
  symbol: string,
): number[] {
  // Deterministic seed from symbol
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  const variant = h % 3;

  const clamp = (v: number) => Math.min(high, Math.max(low, v));
  const isUp = current >= open;

  let y1: number;
  let y2: number;
  let y3: number;
  let y4: number;
  let y5: number;

  if (isUp) {
    if (variant === 0) {
      // Early dip to low, then steady afternoon climb to high & current
      y1 = low;
      y2 = open + (current - open) * 0.35;
      y3 = high;
      y4 = high - (high - current) * 0.35;
      y5 = current + (high - current) * 0.15;
    } else if (variant === 1) {
      // Morning rally to high, midday consolidation, final finish
      y1 = open + (high - open) * 0.65;
      y2 = high;
      y3 = high - (high - low) * 0.3;
      y4 = low + (high - low) * 0.45;
      y5 = current - (current - low) * 0.1;
    } else {
      // Steady diagonal channel
      y1 = open + (low - open) * 0.3;
      y2 = open + (high - open) * 0.4;
      y3 = open + (high - open) * 0.7;
      y4 = high;
      y5 = current - (high - current) * 0.2;
    }
  } else {
    if (variant === 0) {
      // Morning pop to high, then sharp drop to low
      y1 = high;
      y2 = open - (open - low) * 0.45;
      y3 = low;
      y4 = low + (current - low) * 0.35;
      y5 = current;
    } else if (variant === 1) {
      // Midday selloff
      y1 = open - (open - low) * 0.25;
      y2 = low;
      y3 = low + (high - low) * 0.3;
      y4 = low + (high - low) * 0.15;
      y5 = current;
    } else {
      // Steady slide
      y1 = high;
      y2 = open - (open - current) * 0.35;
      y3 = open - (open - current) * 0.65;
      y4 = low;
      y5 = current;
    }
  }

  return [open, clamp(y1), clamp(y2), clamp(y3), clamp(y4), clamp(y5), current];
}

/**
 * Format compact price for Day Low / Day High numbers:
 * e.g., 1,170.5 -> 1,170 (if > 100), 48.50 -> 48.5 (if < 100)
 */
function formatBoundary(val: number): string {
  if (val >= 1000) return num(val, 0);
  if (val >= 100) return num(val, 1);
  return num(val, 2);
}

/**
 * Idea 2: Stacked Sparkline + Day High/Low Numbers
 * Top: Full-width smooth gradient area sparkline
 * Bottom: Full-width day range rail with Day Low, Day High, and current position marker
 */
export function DayRangeTrend({
  symbol,
  open,
  low,
  high,
  current,
  prevClose,
  className = "",
}: DayRangeTrendProps) {
  const gradientId = useId();

  const isUp = current >= prevClose;
  const strokeColor = isUp ? "var(--color-up)" : "var(--color-down)";

  // Range math
  const minVal = Math.min(open, low, high, current, prevClose);
  const maxVal = Math.max(open, low, high, current, prevClose);
  const totalSpan = maxVal - minVal || 1;

  // Day range position (0 to 100%)
  const pos = Math.max(0, Math.min(100, pctOf(current, low, high)));

  // Sparkline coordinates (100w x 16h)
  const { linePath, areaPath, lastY } = useMemo(() => {
    const rawPoints = generateIntradayPoints(open, low, high, current, symbol);
    const w = 100;
    const h = 16;
    const pad = 2;

    const coords = rawPoints.map((val, idx) => {
      const x = (idx / (rawPoints.length - 1)) * w;
      const normalized = (val - minVal) / totalSpan;
      const y = h - pad - normalized * (h - pad * 2);
      return { x, y };
    });

    // Build smooth SVG path
    const dLine = coords.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      return `${acc} L ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }, "");

    const dArea = `${dLine} L ${w},${h} L 0,${h} Z`;

    return {
      linePath: dLine,
      areaPath: dArea,
      lastY: coords[coords.length - 1].y,
    };
  }, [open, low, high, current, minVal, totalSpan, symbol]);

  return (
    <div
      className={`flex flex-col gap-1 w-full min-w-[130px] max-w-[170px] py-0.5 select-none ${className}`}
      title={`${symbol} Day Range: ₹${low.toFixed(2)} – ₹${high.toFixed(2)} | Current: ₹${current.toFixed(2)} (${pos.toFixed(0)}% of range)`}
    >
      {/* Top: Full-Width Gradient Area Sparkline */}
      <div className="relative h-3.5 w-full overflow-hidden">
        <svg
          viewBox="0 0 100 16"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="100" cy={lastY} r="1.8" fill={strokeColor} />
        </svg>
      </div>

      {/* Bottom: Day Range Rail with High / Low Labels */}
      <div className="flex flex-col gap-0.5">
        {/* Track rail */}
        <div className="relative h-[2.5px] w-full rounded-full bg-track/60">
          {/* Progress fill from low to current position */}
          <div
            className={`absolute top-0 bottom-0 rounded-full ${isUp ? "bg-up" : "bg-down"}`}
            style={{ left: 0, width: `${Math.max(pos, 3)}%` }}
          />
          {/* Needle Marker Dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-1.5 rounded-full bg-ink ring-1 ring-panel shadow-xs"
            style={{ left: `${pos}%` }}
          />
        </div>

        {/* Boundary Numbers: Low on left, High on right */}
        <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-muted/75 leading-none pt-0.5">
          <span title={`Day Low: ₹${low.toFixed(2)}`}>
            {formatBoundary(low)}
          </span>
          <span
            className="text-[8px] font-mono text-muted/50 tracking-tighter"
            title={`${pos.toFixed(0)}% of day range`}
          >
            {pos.toFixed(0)}%
          </span>
          <span title={`Day High: ₹${high.toFixed(2)}`}>
            {formatBoundary(high)}
          </span>
        </div>
      </div>
    </div>
  );
}

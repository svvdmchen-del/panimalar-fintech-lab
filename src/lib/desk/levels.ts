/**
 * Stop / target suggestions and risk-reward maths.
 *
 * The v1 desk auto-filled target = +3% and stop = −1.5%, which made every trade
 * exactly 1:2 and printed "Optimal" before the student had made a decision.
 * These helpers only *suggest* a stop from the day's range; the target stays
 * empty until the student (or a quick-fill button) sets it.
 */

import type { Quote } from "@/lib/types";
import { round } from "./valuation";

export interface SuggestedStop {
  stop: number;
  basis: string;
}

export function suggestedStop(entry: number, side: "BUY" | "SELL", quote?: Quote): SuggestedStop {
  if (entry <= 0) return { stop: 0, basis: "Enter a price first" };

  const dayRange = quote && quote.high > quote.low ? quote.high - quote.low : 0;
  const distance = Math.max(dayRange * 0.5, entry * 0.005);
  const stop = side === "BUY" ? entry - distance : entry + distance;

  return {
    stop: round(Math.max(0, stop), 2),
    basis: dayRange > 0 ? "Half of today's range" : "0.5% of entry (no range available)",
  };
}

/** Risk-reward in the direction of the trade. `null` until both levels exist. */
export function riskReward(
  entry: number,
  target: number | undefined,
  stop: number | undefined,
): number | null {
  if (!target || !stop || entry <= 0) return null;
  const reward = Math.abs(target - entry);
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return null;
  return round(reward / risk, 2);
}

/** Target implied by a chosen R:R multiple. */
export function targetAtRatio(
  entry: number,
  stop: number,
  ratio: number,
  side: "BUY" | "SELL",
): number {
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return 0;
  const target = side === "BUY" ? entry + risk * ratio : entry - risk * ratio;
  return round(Math.max(0, target), 2);
}

export function rrTone(rr: number | null): "none" | "poor" | "ok" | "good" {
  if (rr === null) return "none";
  if (rr < 1) return "poor";
  if (rr < 2) return "ok";
  return "good";
}

export function rrLabel(rr: number | null): string {
  if (rr === null) return "—";
  return `1 : ${rr.toFixed(2)}`;
}

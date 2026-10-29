/**
 * Deterministic replay prices.
 *
 * A replay must be reproducible: two students on two machines, same preset and
 * same minute, must see the same fill. So the path is a pure function of
 * (preset, progress) with no randomness — the same V-shaped open→low→close curve
 * the replay controller already draws for NIFTY.
 *
 * Replay is cash-equity only. NSE's historical option chain is not available, and
 * inventing one would repeat the exact problem this rewrite removes: a premium
 * that is not a market price. The desk says so in the UI.
 */

import { SIMULATION_PRESETS } from "@/lib/simulationData";
import type { SimulationPreset } from "@/lib/labTypes";
import type { Quote } from "@/lib/types";

export const REPLAY_START_MINUTES = 9 * 60 + 15;
export const REPLAY_END_MINUTES = 15 * 60 + 30;
export const REPLAY_TOTAL_MINUTES = REPLAY_END_MINUTES - REPLAY_START_MINUTES;

/** 0 at 09:15, 1 at 15:30. */
export function replayFraction(progressPct: number): number {
  return Math.min(1, Math.max(0, progressPct / 100));
}

export function presetById(id: string): SimulationPreset {
  return SIMULATION_PRESETS.find((preset) => preset.id === id) ?? SIMULATION_PRESETS[0];
}

export function simTimeMs(preset: SimulationPreset, progressPct: number): number {
  const open = Date.parse(`${preset.dateStr}T09:15:00+05:30`);
  return open + replayFraction(progressPct) * REPLAY_TOTAL_MINUTES * 60_000;
}

export function simClockLabel(progressPct: number): string {
  const minutes = REPLAY_START_MINUTES + replayFraction(progressPct) * REPLAY_TOTAL_MINUTES;
  const hour = Math.floor(minutes / 60);
  const minute = Math.floor(minutes % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} IST`;
}

function curve(open: number, low: number, close: number, fraction: number): number {
  return fraction < 0.5
    ? open + (low - open) * (fraction * 2)
    : low + (close - low) * ((fraction - 0.5) * 2);
}

export function replaySpot(preset: SimulationPreset, progressPct: number): number {
  return curve(preset.niftyOpen, preset.niftyLow, preset.niftyClose, replayFraction(progressPct));
}

export function replaySymbols(preset: SimulationPreset): string[] {
  return preset.sampleQuotes.map((quote) => quote.symbol);
}

export function replayQuote(
  preset: SimulationPreset,
  symbol: string,
  progressPct: number,
): Quote | undefined {
  const clean = symbol.trim().toUpperCase();
  const fraction = replayFraction(progressPct);

  if (clean === "NIFTY") {
    const price = replaySpot(preset, progressPct);
    const change = price - preset.niftyOpen;
    return {
      symbol: "NIFTY",
      name: "NIFTY 50",
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round((change / preset.niftyOpen) * 10000) / 100,
      open: preset.niftyOpen,
      high: preset.niftyHigh,
      low: preset.niftyLow,
      prevClose: preset.niftyOpen,
      volume: 0,
    };
  }

  const sample = preset.sampleQuotes.find((quote) => quote.symbol === clean);
  if (!sample) return undefined;

  const price = curve(sample.open, sample.low, sample.close, fraction);
  const change = price - sample.open;

  return {
    symbol: sample.symbol,
    name: sample.symbol,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePct: Math.round((change / sample.open) * 10000) / 100,
    open: sample.open,
    high: sample.high,
    low: sample.low,
    prevClose: sample.open,
    volume: 0,
  };
}

/** Every price in the replay universe, for the desk's quote map. */
export function replayQuotes(preset: SimulationPreset, progressPct: number): Quote[] {
  const quotes = replaySymbols(preset)
    .map((symbol) => replayQuote(preset, symbol, progressPct))
    .filter((quote): quote is Quote => Boolean(quote));
  const nifty = replayQuote(preset, "NIFTY", progressPct);
  return nifty ? [nifty, ...quotes] : quotes;
}

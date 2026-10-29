/**
 * Instrument metadata for the Virtual Paper Trading Desk.
 *
 * Index options are the only derivatives the lab supports, because
 * `/api/market/options` (and NSE's public chain) covers the four index
 * underlyings only. Cash equities are delivery (T+1) and long-only.
 *
 * Lot sizes are the NSE values effective from the November 2024 revision. They
 * are not fetched at runtime: NSE publishes the contract master on a different
 * host, and a stale lot size only makes the simulation conservative. Re-verify
 * this table each academic year and bump LOT_SIZES_VERIFIED.
 */

export const LOT_SIZES_VERIFIED = "2024-11";

export const INDEX_UNDERLYINGS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"] as const;
export type IndexUnderlying = (typeof INDEX_UNDERLYINGS)[number];

const LOTS: Record<IndexUnderlying, number> = {
  NIFTY: 75,
  BANKNIFTY: 30,
  FINNIFTY: 65,
  MIDCPNIFTY: 120,
};

const STRIKE_STEPS: Record<IndexUnderlying, number> = {
  NIFTY: 50,
  BANKNIFTY: 100,
  FINNIFTY: 50,
  MIDCPNIFTY: 25,
};

export function isIndexUnderlying(symbol: string): symbol is IndexUnderlying {
  return (INDEX_UNDERLYINGS as readonly string[]).includes(symbol.toUpperCase());
}

export function underlyingOf(symbol: string): IndexUnderlying | null {
  const clean = symbol.trim().toUpperCase();
  return isIndexUnderlying(clean) ? clean : null;
}

export function lotSizeFor(symbol: string): number {
  const clean = symbol.trim().toUpperCase();
  return isIndexUnderlying(clean) ? LOTS[clean] : 1;
}

export function strikeStepFor(symbol: string): number {
  const clean = symbol.trim().toUpperCase();
  return isIndexUnderlying(clean) ? STRIKE_STEPS[clean] : 50;
}

/**
 * Cash equities are delivery-only. Index symbols are deliberately excluded:
 * NIFTY is not a tradable cash scrip, and allowing it was the source of a
 * nonsensical "buy 1 unit of NIFTY at ₹24,400" order.
 */
export function isEquityTradable(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return false;
  if (isIndexUnderlying(clean)) return false;
  if (clean === "INDIAVIX" || clean === "NIFTYIT" || clean === "NIFTYMIDCAP100") return false;
  return /^[A-Z0-9&.-]{1,20}$/.test(clean);
}

export function unitsForLots(symbol: string, lots: number): number {
  const size = lotSizeFor(symbol);
  return Math.max(1, Math.round(lots) * size);
}

/** Highest lot count affordable at `premium` per unit with `cash` available. */
export function maxLotsAffordable(symbol: string, premium: number, cash: number): number {
  const size = lotSizeFor(symbol);
  if (premium <= 0 || size <= 0) return 0;
  return Math.max(0, Math.floor(cash / (premium * size)));
}

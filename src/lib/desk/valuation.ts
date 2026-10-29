/**
 * Options valuation for the paper desk.
 *
 * Everything is Black-Scholes with an Indian index-option convention:
 * - risk-free 6.5%
 * - one expiry cut-off, 15:30 IST on the expiry date
 * - IV taken from the live chain, not inferred
 *
 * The old desk marked options with `entry + 0.5 × (spot − strike)`, which meant
 * an out-of-the-money option could never expire worthless. That is the single
 * most misleading thing a derivatives lab can teach, so this module is now the
 * only path from a quote to a mark.
 */

import type { OptionKind, PaperLeg, OrderSide } from "./types";

const RISK_FREE = 0.065;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function normCdf(x: number): number {
  // Abramowitz & Stegun 26.2.17, |error| < 7.5e-8 — enough for a teaching desk.
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-z * z)));
}

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * 15:30 IST on the expiry date, as epoch ms.
 *
 * NSE renders expiries as `03-Nov-2026`, while migrated records use ISO
 * `2026-11-03`. Both must parse; an unparseable date returns 0 and the caller
 * falls back to a short-dated option rather than pretending it never expires.
 */
export function expiryTimestamp(expiry: string): number {
  const clean = expiry.trim();
  let iso = clean;
  const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(clean);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    if (month) iso = `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
  }
  const parsed = Date.parse(`${iso}T15:30:00+05:30`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function yearsToExpiry(expiry: string, nowMs: number): number {
  const end = expiryTimestamp(expiry);
  if (!end) return 4 / 365; // unknown expiry: behave like a weekly, never crash
  return Math.max(0, (end - nowMs) / YEAR_MS);
}

/** True only when the expiry parses and has passed; unknown dates never expire. */
export function isExpired(expiry: string, nowMs: number): boolean {
  const end = expiryTimestamp(expiry);
  return end > 0 && nowMs >= end;
}

export function daysToExpiry(expiry: string, nowMs: number): number {
  return yearsToExpiry(expiry, nowMs) * 365;
}

export function intrinsic(kind: OptionKind, spot: number, strike: number): number {
  return kind === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

/** Black-Scholes price of one unit. Returns intrinsic at/after expiry. */
export function bsPrice(
  kind: OptionKind,
  spot: number,
  strike: number,
  years: number,
  ivPct: number,
  rate = RISK_FREE,
): number {
  const S = Math.max(0, spot);
  const K = Math.max(0, strike);
  if (years <= 0 || S <= 0 || K <= 0) return intrinsic(kind, S, K);

  const sigma = Math.max(0.01, ivPct / 100);
  const root = sigma * Math.sqrt(years);
  const d1 = (Math.log(S / K) + (rate + (sigma * sigma) / 2) * years) / root;
  const d2 = d1 - root;
  const discount = Math.exp(-rate * years);

  if (kind === "CE") return S * normCdf(d1) - K * discount * normCdf(d2);
  return K * discount * normCdf(-d2) - S * normCdf(-d1);
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

/** Per-unit Greeks. Theta is per calendar day, vega per 1 vol point. */
export function bsGreeks(
  kind: OptionKind,
  spot: number,
  strike: number,
  years: number,
  ivPct: number,
  rate = RISK_FREE,
): Greeks {
  const S = Math.max(1, spot);
  const K = Math.max(1, strike);
  if (years <= 0) {
    // At expiry delta is a step function; time value is gone.
    return {
      delta: kind === "CE" ? (S > K ? 1 : 0) : S < K ? -1 : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
    };
  }

  const sigma = Math.max(0.01, ivPct / 100);
  const root = sigma * Math.sqrt(years);
  const d1 = (Math.log(S / K) + (rate + (sigma * sigma) / 2) * years) / root;
  const d2 = d1 - root;
  const pdf = normPdf(d1);

  const gamma = pdf / (S * root);
  const vega = (S * pdf * Math.sqrt(years)) / 100;
  const decay = -(S * pdf * sigma) / (2 * Math.sqrt(years));
  const discount = Math.exp(-rate * years);

  const theta =
    kind === "CE"
      ? (decay - rate * K * discount * normCdf(d2)) / 365
      : (decay + rate * K * discount * normCdf(-d2)) / 365;

  const delta = kind === "CE" ? normCdf(d1) : normCdf(d1) - 1;

  return {
    delta: round(delta, 3),
    gamma: round(gamma, 5),
    theta: round(theta, 2),
    vega: round(vega, 2),
  };
}

export function sideSign(side: OrderSide): 1 | -1 {
  return side === "BUY" ? 1 : -1;
}

export function legUnits(leg: PaperLeg): number {
  return Math.max(1, leg.lots) * Math.max(1, leg.lotSize);
}

export function legEntryValue(leg: PaperLeg): number {
  return leg.entryPremium * legUnits(leg);
}

/**
 * Mark for one leg. `chainPremium` is the live LTP for the exact strike when the
 * chain is available; otherwise the leg is repriced with Black-Scholes.
 */
export function legMark(
  leg: PaperLeg,
  spot: number,
  nowMs: number,
  chainPremium?: number,
): number {
  if (typeof chainPremium === "number" && chainPremium > 0) return round(chainPremium, 2);
  const years = yearsToExpiry(leg.expiry, nowMs);
  return round(bsPrice(leg.instrument, spot, leg.strike, years, leg.iv || 15), 2);
}

/**
 * Net cash flow per unit at the given prices: positive when the structure is a
 * credit (cash received), negative when it is a debit (cash paid). Flipping the
 * sign here is what keeps a long call from printing as "credit received".
 */
export function netPremium(legs: PaperLeg[], priceOf: (leg: PaperLeg) => number): number {
  return round(
    -legs.reduce((sum, leg) => sum + sideSign(leg.side) * priceOf(leg), 0),
    2,
  );
}

export interface NetGreeks extends Greeks {
  /** Total rupees of premium: positive = credit received, negative = debit. */
  netPremium: number;
}

export function netGreeks(
  legs: PaperLeg[],
  spot: number,
  nowMs: number,
  priceOf?: (leg: PaperLeg) => number,
): NetGreeks {
  const units = legs.length ? legUnits(legs[0]) : 1;
  const totals: Greeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
  let premium = 0;

  for (const leg of legs) {
    const years = yearsToExpiry(leg.expiry, nowMs);
    const g = bsGreeks(leg.instrument, spot, leg.strike, years, leg.iv || 15);
    const sign = sideSign(leg.side) * units;
    totals.delta += g.delta * sign;
    totals.gamma += g.gamma * sign;
    totals.theta += g.theta * sign;
    totals.vega += g.vega * sign;
    premium -= sideSign(leg.side) * (priceOf ? priceOf(leg) : leg.entryPremium) * units;
  }

  return {
    delta: round(totals.delta, 2),
    gamma: round(totals.gamma, 4),
    theta: round(totals.theta, 2),
    vega: round(totals.vega, 2),
    netPremium: round(premium, 2),
  };
}

/** Rupee P&L of the structure at an underlying price, held to expiry. */
export function payoffAt(legs: PaperLeg[], price: number): number {
  return round(
    legs.reduce((sum, leg) => {
      const units = legUnits(leg);
      const value = intrinsic(leg.instrument, price, leg.strike);
      const pnl = sideSign(leg.side) * (value - leg.entryPremium) * units;
      return sum + pnl;
    }, 0),
    2,
  );
}

export interface PayoffPoint {
  price: number;
  pnl: number;
}

export function payoffCurve(legs: PaperLeg[], spot: number, rangePct = 0.08, steps = 48): PayoffPoint[] {
  if (!legs.length || spot <= 0) return [];
  const low = spot * (1 - rangePct);
  const high = spot * (1 + rangePct);
  const step = (high - low) / steps;
  const points: PayoffPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const price = low + step * i;
    points.push({ price: Math.round(price), pnl: payoffAt(legs, price) });
  }
  return points;
}

/** Zero-P&L underlying prices, linearly interpolated between sample points. */
export function breakevens(points: PayoffPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a.pnl === 0) {
      out.push(a.price);
      continue;
    }
    if (a.pnl * b.pnl < 0) {
      const t = a.pnl / (a.pnl - b.pnl);
      out.push(Math.round(a.price + (b.price - a.price) * t));
    }
  }
  return out.slice(0, 4);
}

export interface RiskProfile {
  maxLoss: number;
  maxProfit: number;
  /** True when a short leg is uncovered, so loss is not bounded by the curve. */
  unbounded: boolean;
}

export function riskProfile(legs: PaperLeg[], spot: number): RiskProfile {
  if (!legs.length || spot <= 0) return { maxLoss: 0, maxProfit: 0, unbounded: false };

  let worst = Number.POSITIVE_INFINITY;
  let best = Number.NEGATIVE_INFINITY;
  let worstAtEdge = false;

  for (let i = 0; i <= 200; i += 1) {
    const price = (spot * 3 * i) / 200; // 0 .. 3× spot
    const pnl = payoffAt(legs, price);
    if (pnl < worst) {
      worst = pnl;
      worstAtEdge = i === 200;
    }
    if (pnl > best) best = pnl;
  }

  return {
    maxLoss: round(Math.max(0, -worst), 2),
    maxProfit: round(best, 2),
    unbounded: worstAtEdge && worst < 0,
  };
}

/** Every short leg is covered by a long leg of the same kind, so risk is capped. */
export function isDefinedRisk(legs: PaperLeg[]): boolean {
  const shorts = legs.filter((leg) => leg.side === "SELL");
  if (!shorts.length) return true;

  return shorts.every((short) => {
    const cover = legs.find(
      (leg) =>
        leg.side === "BUY" &&
        leg.instrument === short.instrument &&
        (short.instrument === "CE" ? leg.strike <= short.strike : leg.strike >= short.strike),
    );
    return Boolean(cover);
  });
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

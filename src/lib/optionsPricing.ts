/**
 * Options Pricing, Greeks, Strategy Payoff Models & Friction Math
 * for the Panimalar MBA FinTech Laboratory.
 */

import type { InstrumentType, OrderSide } from "./labTypes";

export interface OptionGreekResult {
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  iv: number;
}

export interface OptionStrategyLeg {
  id: string;
  instrument: InstrumentType;
  side: OrderSide;
  strike: number;
  premium: number;
  quantity: number;
}

export interface FrictionBreakdown {
  brokerage: number;
  stt: number;
  exchangeTurnover: number;
  sebiTurnover: number;
  stampDuty: number;
  gst: number;
  totalFriction: number;
}

function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function cnd(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const k = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const poly = ((((a5 * k + a4) * k + a3) * k + a2) * k + a1) * k;
  const n = 1.0 - pdf(x) * poly;
  return x < 0 ? 1.0 - n : n;
}

/**
 * Calculates Black-Scholes Greeks for European/Indian index options.
 */
export function calculateBlackScholesGreeks(
  spot: number,
  strike: number,
  daysToExpiry = 4,
  ivPct = 14.5,
  riskFreeRate = 0.065,
): { call: OptionGreekResult; put: OptionGreekResult } {
  const S = Math.max(1, spot);
  const K = Math.max(1, strike);
  const T = Math.max(0.2, daysToExpiry) / 365;
  const sigma = Math.max(0.01, ivPct / 100);
  const r = riskFreeRate;

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
  const vega = (S * pdf(d1) * Math.sqrt(T)) / 100;

  const term1 = -(S * pdf(d1) * sigma) / (2 * Math.sqrt(T));
  const callTheta = (term1 - r * K * Math.exp(-r * T) * cnd(d2)) / 365;
  const putTheta = (term1 + r * K * Math.exp(-r * T) * cnd(-d2)) / 365;

  const callDelta = cnd(d1);
  const putDelta = callDelta - 1;

  return {
    call: {
      delta: Math.round(callDelta * 100) / 100,
      theta: Math.round(callTheta * 100) / 100,
      gamma: Math.round(gamma * 10000) / 10000,
      vega: Math.round(vega * 100) / 100,
      iv: ivPct,
    },
    put: {
      delta: Math.round(putDelta * 100) / 100,
      theta: Math.round(putTheta * 100) / 100,
      gamma: Math.round(gamma * 10000) / 10000,
      vega: Math.round(vega * 100) / 100,
      iv: ivPct,
    },
  };
}

/**
 * Calculates realistic Indian market transaction friction & statutory taxes:
 * - Brokerage: Flat ₹20 per order
 * - STT: 0.1% on equity delivery / 0.125% on option turnover
 * - Exchange Turnover Fee: 0.00345%
 * - SEBI Charges: 0.0001%
 * - Stamp Duty: 0.015%
 * - GST: 18% on (Brokerage + Exchange fees)
 */
export function calculateFriction(
  instrument: InstrumentType,
  turnover: number,
  isBuy: boolean,
): FrictionBreakdown {
  const brokerage = 20; // flat ₹20

  let stt = 0;
  if (instrument === "EQUITY") {
    stt = turnover * 0.001; // 0.1% on delivery
  } else {
    // Derivatives option exercise / sell turnover
    stt = isBuy ? 0 : turnover * 0.000625; // 0.0625% on option sale
  }

  const exchangeTurnover = turnover * 0.0000345;
  const sebiTurnover = turnover * 0.000001;
  const stampDuty = isBuy ? turnover * 0.00015 : 0;
  const gst = (brokerage + exchangeTurnover) * 0.18;

  const totalFriction = Math.round((brokerage + stt + exchangeTurnover + sebiTurnover + stampDuty + gst) * 100) / 100;

  return {
    brokerage,
    stt: Math.round(stt * 100) / 100,
    exchangeTurnover: Math.round(exchangeTurnover * 100) / 100,
    sebiTurnover: Math.round(sebiTurnover * 100) / 100,
    stampDuty: Math.round(stampDuty * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    totalFriction,
  };
}

/**
 * Calculates Expiry Payoff Points for multi-leg strategies to render on SVG diagram.
 */
export function calculatePayoffPoints(
  legs: OptionStrategyLeg[],
  spot: number,
  rangePct = 0.08,
  steps = 30,
): Array<{ price: number; pnl: number }> {
  const minPrice = spot * (1 - rangePct);
  const maxPrice = spot * (1 + rangePct);
  const stepSize = (maxPrice - minPrice) / steps;
  const points: Array<{ price: number; pnl: number }> = [];

  for (let p = minPrice; p <= maxPrice; p += stepSize) {
    let totalPnl = 0;

    for (const leg of legs) {
      let intrinsic = 0;
      if (leg.instrument === "CALL") {
        intrinsic = Math.max(0, p - leg.strike);
      } else if (leg.instrument === "PUT") {
        intrinsic = Math.max(0, leg.strike - p);
      } else {
        intrinsic = p;
      }

      const legPnl =
        leg.side === "BUY"
          ? (intrinsic - leg.premium) * leg.quantity
          : (leg.premium - intrinsic) * leg.quantity;

      totalPnl += legPnl;
    }

    points.push({ price: Math.round(p), pnl: Math.round(totalPnl) });
  }

  return points;
}

/**
 * Quantitative risk analytics: Sharpe Ratio, Max Drawdown & Profit Factor.
 */
export function calculateRiskMetrics(
  returns: number[],
  initialCapital = 1_000_000,
): {
  sharpeRatio: number;
  maxDrawdownPct: number;
  profitFactor: number;
} {
  if (returns.length === 0) {
    return { sharpeRatio: 0, maxDrawdownPct: 0, profitFactor: 0 };
  }

  // Profit Factor
  let grossProfit = 0;
  let grossLoss = 0;
  for (const r of returns) {
    if (r > 0) grossProfit += r;
    else grossLoss += Math.abs(r);
  }
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;

  // Max Drawdown
  let peak = initialCapital;
  let currentBalance = initialCapital;
  let maxDrawdown = 0;

  for (const r of returns) {
    currentBalance += r;
    if (currentBalance > peak) {
      peak = currentBalance;
    }
    const drawdown = peak - currentBalance;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const maxDrawdownPct = peak > 0 ? Number(((maxDrawdown / peak) * 100).toFixed(2)) : 0;

  // Sharpe Ratio (assumes daily risk-free rate)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  const sharpeRatio =
    stdDev > 0 ? Number(((mean / stdDev) * Math.sqrt(252)).toFixed(2)) : mean > 0 ? 3.0 : 0;

  return {
    sharpeRatio: Math.max(-5, Math.min(10, sharpeRatio)),
    maxDrawdownPct,
    profitFactor,
  };
}

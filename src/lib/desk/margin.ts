/**
 * Margin for the paper desk — a deliberately simplified, documented model.
 *
 * This is *not* exchange SPAN. It reproduces the behaviour students must learn:
 *   - cash equity is paid in full (delivery, no leverage)
 *   - a long option costs its premium and nothing more
 *   - a defined-risk spread blocks its maximum loss
 *   - a naked short blocks real margin, and its loss is not capped
 *
 * The naked-short block uses the common broker approximation
 *   max(12% of notional, premium + 7% of notional)
 * which is close enough to SPAN for index options while staying explainable in
 * one line on the order ticket.
 */

import { isDefinedRisk, legUnits, riskProfile, round, sideSign } from "./valuation";
import type { PaperLeg } from "./types";

export type MarginBasis = "PREMIUM" | "DEFINED_RISK" | "SPAN_LIKE";

export interface MarginRequirement {
  /** Rupees that must be blocked in addition to the premium cash flow. */
  required: number;
  basis: MarginBasis;
  /** Human-readable one-liner for the ticket. */
  detail: string;
}

export const SPAN_NOTIONAL_PCT = 0.12;
export const SPAN_EXPOSURE_PCT = 0.07;

export function equityCash(quantity: number, price: number): number {
  return round(Math.max(0, quantity) * Math.max(0, price), 2);
}

/** Net premium per unit (positive = credit received). */
export function netPremiumPerUnit(legs: PaperLeg[]): number {
  return round(
    legs.reduce((sum, leg) => sum + sideSign(leg.side) * leg.entryPremium, 0),
    2,
  );
}

export function optionsMargin(legs: PaperLeg[], spot: number): MarginRequirement {
  if (!legs.length) return { required: 0, basis: "PREMIUM", detail: "No legs" };

  const units = legUnits(legs[0]);
  const hasShort = legs.some((leg) => leg.side === "SELL");

  if (!hasShort) {
    return {
      required: 0,
      basis: "PREMIUM",
      detail: "Long premium is paid in full — maximum loss is the premium.",
    };
  }

  if (isDefinedRisk(legs)) {
    const profile = riskProfile(legs, spot);
    const credit = Math.max(0, netPremiumPerUnit(legs) * units);
    return {
      // A net debit is already paid in full by the cash flow, so only a credit
      // structure needs an additional block for its maximum loss.
      required: credit > 0 ? round(profile.maxLoss, 2) : 0,
      basis: "DEFINED_RISK",
      detail:
        credit > 0
          ? `Defined risk: ${inr(profile.maxLoss)} maximum loss, net of the ${inr(credit)} credit.`
          : "Defined risk: the net debit already covers the maximum loss.",
    };
  }

  const shortUnits = legs
    .filter((leg) => leg.side === "SELL")
    .reduce((sum, leg) => sum + legUnits(leg), 0);
  const credit = legs
    .filter((leg) => leg.side === "SELL")
    .reduce((sum, leg) => sum + leg.entryPremium * legUnits(leg), 0);

  const notional = shortUnits * Math.max(1, spot);
  const span = Math.max(SPAN_NOTIONAL_PCT * notional, credit + SPAN_EXPOSURE_PCT * notional);

  return {
    required: round(span, 2),
    basis: "SPAN_LIKE",
    detail: `Naked short: 12% of ${inr(notional)} notional (or premium + 7% exposure, whichever is higher).`,
  };
}

function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

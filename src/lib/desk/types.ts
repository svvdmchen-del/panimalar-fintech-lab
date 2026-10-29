/**
 * Desk domain model (schema v2).
 *
 * v1 stored one instrument per position, so "multi-leg" strategies were a label
 * on a single leg. v2 stores the legs that actually make up the structure; every
 * number the desk shows (premium, Greeks, payoff, margin, P&L) is derived from
 * this list.
 */

export type DeskLevel = "EQUITY" | "OPTIONS_LONG" | "OPTIONS_SPREADS" | "OPTIONS_WRITING";

export const DESK_LEVELS: DeskLevel[] = [
  "EQUITY",
  "OPTIONS_LONG",
  "OPTIONS_SPREADS",
  "OPTIONS_WRITING",
];

export const LEVEL_LABEL: Record<DeskLevel, string> = {
  EQUITY: "Cash",
  OPTIONS_LONG: "Options L1",
  OPTIONS_SPREADS: "Spreads L2",
  OPTIONS_WRITING: "Writing L3",
};

export type OptionKind = "CE" | "PE";
export type OrderSide = "BUY" | "SELL";
export type ExitReason = "MANUAL" | "TARGET" | "STOP_LOSS" | "EXPIRY";

export interface PaperLeg {
  id: string;
  instrument: OptionKind;
  side: OrderSide;
  strike: number;
  /** ISO date (YYYY-MM-DD) of the contract expiry, as returned by the chain. */
  expiry: string;
  lots: number;
  lotSize: number;
  entryPremium: number;
  /** IV percent at entry; refreshed from the chain while the leg is open. */
  iv: number;
}

export interface ReplaySession {
  mode: "REPLAY";
  presetId: string;
}

export interface LiveSession {
  mode: "LIVE";
}

export type DeskSession = LiveSession | ReplaySession;

export interface EquityPosition {
  id: string;
  kind: "EQUITY";
  symbol: string;
  name: string;
  /** The ticket only writes BUY; SELL survives solely for migrated v1 rows. */
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  target?: number;
  stop?: number;
  thesis: string;
  thesisTag?: string;
  frictionCost: number;
  entryTime: number;
  session: DeskSession;
  /** Cash spent at entry. Kept for a clean release on close. */
  blockedMargin: number;
}

export interface OptionsPosition {
  id: string;
  kind: "OPTIONS";
  symbol: string;
  name: string;
  strategyId: OptionsStrategyId;
  strategyName: string;
  legs: PaperLeg[];
  /** Net premium per unit at entry. Positive = credit received. */
  entryNetPremium: number;
  /** Premium target / stop for the structure, per unit. */
  target?: number;
  stop?: number;
  thesis: string;
  thesisTag?: string;
  frictionCost: number;
  entryTime: number;
  session: DeskSession;
  blockedMargin: number;
}

export type PaperPosition = EquityPosition | OptionsPosition;

export interface TradeLeg extends PaperLeg {
  exitPremium: number;
  /** Realised P&L for this leg in rupees. */
  legPnl: number;
}

interface TradeBase {
  id: string;
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  netPnl: number;
  pnlPct: number;
  frictionCost: number;
  thesis: string;
  thesisTag?: string;
  postMortem?: string;
  facultyScore?: number;
  entryTime: number;
  exitTime: number;
  exitReason: ExitReason;
  session: DeskSession;
}

export interface EquityTradeRecord extends TradeBase {
  kind: "EQUITY";
}

export interface OptionsTradeRecord extends TradeBase {
  kind: "OPTIONS";
  strategyId: OptionsStrategyId;
  strategyName: string;
  /** Net premium per unit at entry and exit (positive = credit). */
  entryNetPremium: number;
  exitNetPremium: number;
  legs: TradeLeg[];
}

export type PaperTradeRecord = EquityTradeRecord | OptionsTradeRecord;

export type OptionsStrategyId =
  | "SINGLE_LONG"
  | "BULL_CALL"
  | "BEAR_PUT"
  | "IRON_CONDOR"
  | "NAKED_SHORT";

export interface DeskQuizState {
  /** Best score out of 3 on the derivatives checkpoint. */
  best: number;
  passedAt?: string;
  attempts: number;
}

export interface DeskAccessState {
  schemaVersion: 2;
  /** Faculty overrides. A `true` flag force-unlocks the level. */
  overrides: Record<DeskLevel, boolean>;
  quiz: DeskQuizState;
  acknowledgedWritingRisk: boolean;
}

export interface DeskState {
  schemaVersion: 2;
  positions: PaperPosition[];
  history: PaperTradeRecord[];
  access: DeskAccessState;
  friction: boolean;
  updatedAt: number;
}

export const DEFAULT_ACCESS: DeskAccessState = {
  schemaVersion: 2,
  overrides: {
    EQUITY: true,
    OPTIONS_LONG: false,
    OPTIONS_SPREADS: false,
    OPTIONS_WRITING: false,
  },
  quiz: { best: 0, attempts: 0 },
  acknowledgedWritingRisk: false,
};

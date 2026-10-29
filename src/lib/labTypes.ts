/**
 * Domain types for Panimalar MBA FinTech Lab Interactive Modes:
 * - Part 1: Real-Time Classroom Interactive Activities
 * - Part 2: Curated Indian Market Case Studies
 * - Part 3: Paper Trading Journal, Simulation Replay & One-Click Lab Report
 */

export type InstrumentType = "EQUITY" | "CALL" | "PUT";
export type OrderSide = "BUY" | "SELL";

export type ThesisCategoryTag =
  | "Technical: Breakout / RSI"
  | "Derivatives: Max Pain / OI Wall"
  | "Microstructure: FII/DII Net Inflow"
  | "Fundamental: Valuation Gap / SOTP"
  | "Macro: RBI Policy / Crude";

export interface PaperPosition {
  id: string;
  symbol: string;
  name: string;
  instrument: InstrumentType;
  strike?: number;
  expiry?: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  targetPrice?: number;
  stopLossPrice?: number;
  thesis: string;
  thesisTag?: ThesisCategoryTag;
  strategyName?: string;
  frictionCost?: number;
  entryTime: number; // timestamp
}

export interface PaperTradeRecord {
  id: string;
  symbol: string;
  name: string;
  instrument: InstrumentType;
  strike?: number;
  expiry?: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  netPnl?: number; // after friction & taxes
  thesis: string;
  thesisTag?: ThesisCategoryTag;
  strategyName?: string;
  frictionCost?: number;
  slippageCost?: number;
  postMortem?: string;
  facultyScore?: number; // 1 to 5 stars
  entryTime: number;
  exitTime: number;
  exitReason: "MANUAL" | "TARGET" | "STOP_LOSS";
}

export interface LabActivityResponse {
  activityId: string;
  answers: Record<string, string>;
  updatedAt: number;
}

export interface CaseStudyResponse {
  caseId: string;
  answers: Record<string, string>;
  updatedAt: number;
}

export interface StudentProfile {
  studentName: string;
  rollNumber: string;
  batch: string;
  section: string;
}

/** Fired with `{ groupId }` to open the lab drawer on one activity or case. */
export const LAB_FOCUS_EVENT = "nse:lab-focus";

export interface SimulationPreset {
  id: string;
  title: string;
  dateStr: string;
  tagline: string;
  description: string;
  niftyOpen: number;
  niftyLow: number;
  niftyHigh: number;
  niftyClose: number;
  vixStart: number;
  vixPeak: number;
  fiiFlow: number; // Cr
  diiFlow: number; // Cr
  keySector: string;
  macroCatalyst: string;
  sampleQuotes: Array<{
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    changePct: number;
  }>;
}

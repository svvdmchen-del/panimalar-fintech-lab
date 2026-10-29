/**
 * Maps desk records to the flat report row shape.
 *
 * Only LIVE trades reach the graded PDF: replay sessions are a classroom
 * exercise with reconstructed prices and must never be graded as if they were
 * market outcomes.
 */

import type { ReportTradeRow } from "@/lib/report/types";
import type { PaperTradeRecord } from "./types";

export function lotsText(record: PaperTradeRecord): string | undefined {
  if (record.kind !== "OPTIONS") return undefined;
  const leg = record.legs[0];
  if (!leg) return undefined;
  return `${leg.lots} lot${leg.lots === 1 ? "" : "s"} × ${leg.lotSize}`;
}

export function toReportTradeRow(trade: PaperTradeRecord): ReportTradeRow {
  const isOptions = trade.kind === "OPTIONS";
  const expiry = isOptions ? trade.legs[0]?.expiry : undefined;

  return {
    symbol: trade.symbol,
    instrument: isOptions ? trade.strategyName : "EQUITY",
    side: trade.side,
    quantity: trade.quantity,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    entryTime: trade.entryTime,
    exitTime: trade.exitTime,
    netPnl: trade.netPnl,
    pnlPct: trade.pnlPct,
    thesis: trade.thesis,
    thesisTag: trade.thesisTag,
    postMortem: trade.postMortem,
    facultyScore: trade.facultyScore,
    lotsText: isOptions ? lotsText(trade) : undefined,
    expiry,
  };
}

/** Live trades only, newest first — the graded journal. */
export function gradedTrades(history: PaperTradeRecord[]): PaperTradeRecord[] {
  return history.filter((trade) => trade.session.mode === "LIVE");
}

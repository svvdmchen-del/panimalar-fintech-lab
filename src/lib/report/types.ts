import type { StudentProfile } from "@/lib/labTypes";

/**
 * Wire format for the server-rendered report PDF.
 *
 * The client owns the data (localStorage), so the payload is assembled in the
 * browser and POSTed to `/api/report/pdf`. Keep this shape deliberately flat and
 * boring: it is deserialised and validated by the route handler before it ever
 * reaches the document builder.
 */
export interface ReportTradeRow {
  symbol: string;
  instrument: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  netPnl: number;
  pnlPct: number;
  thesis: string;
  thesisTag?: string;
  postMortem?: string;
  facultyScore?: number;
  /** e.g. "2 lots × 75" for options; absent for cash equity. */
  lotsText?: string;
  expiry?: string;
}

export interface LabReportPayload {
  profile: StudentProfile;
  /** cardId -> questionId -> answer */
  answers: Record<string, Record<string, string>>;
  trades: ReportTradeRow[];
  /** ISO timestamp of export, rendered in IST. */
  generatedAt: string;
}

const MAX_TEXT = 4000;
const MAX_TRADES = 60;

function str(value: unknown, max = 240): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").slice(0, max);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function answers(value: unknown): Record<string, Record<string, string>> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [cardId, questions] of Object.entries(value as Record<string, unknown>)) {
    if (!questions || typeof questions !== "object") continue;
    const bucket: Record<string, string> = {};
    for (const [questionId, answer] of Object.entries(questions as Record<string, unknown>)) {
      const text = str(answer, MAX_TEXT);
      if (text.trim()) bucket[questionId] = text;
    }
    if (Object.keys(bucket).length) out[cardId] = bucket;
  }
  return out;
}

/**
 * Coerces arbitrary request JSON into a payload the document builder can trust.
 * Returns null when the body is unusable rather than throwing, so the route can
 * answer with a 400.
 */
export function parseReportPayload(input: unknown): LabReportPayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const profileRaw = (raw.profile ?? {}) as Record<string, unknown>;

  const generatedAt = new Date(str(raw.generatedAt, 40) || Date.now());
  const tradesRaw = Array.isArray(raw.trades) ? raw.trades.slice(0, MAX_TRADES) : [];

  return {
    profile: {
      studentName: str(profileRaw.studentName, 120),
      rollNumber: str(profileRaw.rollNumber, 60),
      batch: str(profileRaw.batch, 60) || "MBA 2025–2027",
      section: str(profileRaw.section, 120) || "FinTech & Investment Banking",
    },
    answers: answers(raw.answers),
    trades: tradesRaw.map((row) => {
      const trade = row as Record<string, unknown>;
      return {
        symbol: str(trade.symbol, 24).toUpperCase() || "—",
        instrument: str(trade.instrument, 12).toUpperCase() || "EQUITY",
        side: trade.side === "SELL" ? "SELL" : "BUY",
        quantity: num(trade.quantity),
        entryPrice: num(trade.entryPrice),
        exitPrice: num(trade.exitPrice),
        entryTime: num(trade.entryTime),
        exitTime: num(trade.exitTime),
        netPnl: num(trade.netPnl),
        pnlPct: num(trade.pnlPct),
        thesis: str(trade.thesis, 600),
        thesisTag: str(trade.thesisTag, 60) || undefined,
        postMortem: str(trade.postMortem, 600) || undefined,
        facultyScore: num(trade.facultyScore) || undefined,
        lotsText: str(trade.lotsText, 40) || undefined,
        expiry: str(trade.expiry, 20) || undefined,
      } satisfies ReportTradeRow;
    }),
    generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date().toISOString() : generatedAt.toISOString(),
  };
}

/** Aggregates used by the Part 3 KPI strip. */
export function tradeStats(trades: ReportTradeRow[]) {
  const net = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const wins = trades.filter((trade) => trade.netPnl > 0).length;
  const losses = trades.filter((trade) => trade.netPnl < 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const avg = trades.length ? net / trades.length : 0;
  return { net, wins, losses, winRate, avg };
}

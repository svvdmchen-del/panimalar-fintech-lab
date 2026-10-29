/**
 * Single owner of the paper-desk localStorage.
 *
 * v2 keeps positions, journal, access flags and the friction preference in one
 * document so a partial write can never leave the desk in a torn state. The v1
 * keys are migrated once, backed up, and never touched again.
 */

import { lotSizeFor } from "@/lib/instruments";
import {
  DEFAULT_ACCESS,
  type DeskAccessState,
  type DeskState,
  type EquityTradeRecord,
  type PaperLeg,
  type PaperPosition,
  type PaperTradeRecord,
} from "./types";
import { round, sideSign } from "./valuation";

export const DESK_KEY = "nse-lab.paper-store";
export const LEGACY_BACKUP_KEY = "nse-lab.paper-store.v1.backup";
export const REPLAY_PREFIX = "nse-lab.paper-replay.";
export const UPDATE_EVENT = "nse:paper-trade-update";
/** Fired by the lab drawer after every answer write so readers stay in sync. */
export const ANSWERS_EVENT = "nse:lab-answers-update";

const LEGACY_POSITIONS = "nse-lab.paper-positions";
const LEGACY_HISTORY = "nse-lab.paper-history";
const LEGACY_FRICTION = "nse-lab.paper-friction";

interface LegacyPosition {
  id?: string;
  symbol?: string;
  name?: string;
  instrument?: "EQUITY" | "CALL" | "PUT";
  strike?: number;
  expiry?: string;
  side?: "BUY" | "SELL";
  quantity?: number;
  entryPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  thesis?: string;
  thesisTag?: string;
  strategyName?: string;
  frictionCost?: number;
  entryTime?: number;
}

interface LegacyTrade extends LegacyPosition {
  exitPrice?: number;
  pnl?: number;
  pnlPct?: number;
  netPnl?: number;
  postMortem?: string;
  facultyScore?: number;
  exitTime?: number;
  exitReason?: "MANUAL" | "TARGET" | "STOP_LOSS";
}

export interface ReplayBody {
  schemaVersion: 2;
  positions: PaperPosition[];
  history: PaperTradeRecord[];
}

const DEFAULT_STATE: DeskState = {
  schemaVersion: 2,
  positions: [],
  history: [],
  access: DEFAULT_ACCESS,
  friction: true,
  updatedAt: 0,
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode: the desk still works from React state.
  }
}

function isAccess(value: unknown): value is DeskAccessState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DeskAccessState>;
  return candidate.schemaVersion === 2 && Boolean(candidate.overrides) && Boolean(candidate.quiz);
}

export function loadDeskState(): DeskState {
  const stored = readJson<DeskState>(DESK_KEY);
  if (stored && stored.schemaVersion === 2) {
    return {
      ...DEFAULT_STATE,
      ...stored,
      access: isAccess(stored.access) ? stored.access : DEFAULT_ACCESS,
    };
  }
  return migrateLegacy();
}

export function persistDeskState(state: DeskState): void {
  const next: DeskState = { ...state, schemaVersion: 2, updatedAt: Date.now() };
  writeJson(DESK_KEY, next);
  if (canUseStorage()) {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

export function loadReplay(presetId: string): ReplayBody {
  const stored = readJson<ReplayBody>(`${REPLAY_PREFIX}${presetId}`);
  if (stored && stored.schemaVersion === 2) return stored;
  return { schemaVersion: 2, positions: [], history: [] };
}

export function persistReplay(presetId: string, body: ReplayBody): void {
  writeJson(`${REPLAY_PREFIX}${presetId}`, { ...body, schemaVersion: 2 });
}

export function resetDesk(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(DESK_KEY);
  // v1 source keys must go too: `loadDeskState()` re-migrates them, which would
  // resurrect every position and trade the reset just cleared.
  for (const key of [LEGACY_POSITIONS, LEGACY_HISTORY, LEGACY_FRICTION]) {
    window.localStorage.removeItem(key);
  }
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    if (key.startsWith(REPLAY_PREFIX)) window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

/** Answers live in the lab drawer's key; the access check only reads them. */
export function readLabAnswers(): Record<string, Record<string, string>> {
  return readJson<Record<string, Record<string, string>>>("nse-lab.case-answers") ?? {};
}

/* ------------------------------------------------------------ migration v1 */

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

/** v1 stored either an ISO date or an NSE label; both migrate to ISO. */
function legacyExpiry(expiry?: string): string {
  const clean = expiry?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(clean);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    if (month) return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
  }
  // No usable date at all: four days out keeps the old row priceable so the
  // student can square it off (it can only be closed, never added to).
  const date = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function migrateLegPosition(raw: LegacyPosition): PaperPosition {
  const symbol = (raw.symbol ?? "UNKNOWN").toUpperCase();
  const entryTime = Number(raw.entryTime) || Date.now();
  const thesis = raw.thesis ?? "";
  const frictionCost = Number(raw.frictionCost) || 0;
  const side = raw.side === "SELL" ? "SELL" : "BUY";

  if (raw.instrument === "EQUITY") {
    return {
      id: raw.id ?? `pos-${entryTime}`,
      kind: "EQUITY",
      symbol,
      name: raw.name ?? symbol,
      side,
      quantity: Math.max(1, Math.round(Number(raw.quantity) || 1)),
      entryPrice: Number(raw.entryPrice) || 0,
      target: Number(raw.targetPrice) || undefined,
      stop: Number(raw.stopLossPrice) || undefined,
      thesis,
      thesisTag: raw.thesisTag,
      frictionCost,
      entryTime,
      session: { mode: "LIVE" },
      blockedMargin: 0,
    };
  }

  const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
  const lotSize = lotSizeFor(symbol);
  const lots = Math.max(1, Math.round(quantity / lotSize));
  const entryPremium = Number(raw.entryPrice) || 0;
  const leg: PaperLeg = {
    id: `${raw.id ?? entryTime}-leg-1`,
    instrument: raw.instrument === "PUT" ? "PE" : "CE",
    side,
    strike: Number(raw.strike) || entryPremium,
    expiry: legacyExpiry(raw.expiry),
    lots,
    lotSize,
    entryPremium,
    iv: 15,
  };

  return {
    id: raw.id ?? `pos-${entryTime}`,
    kind: "OPTIONS",
    symbol,
    name: raw.name ?? symbol,
    strategyId: "SINGLE_LONG",
    strategyName: raw.strategyName ?? "Legacy single leg",
    legs: [leg],
    entryNetPremium: round(sideSign(side) * entryPremium, 2),
    target: Number(raw.targetPrice) || undefined,
    stop: Number(raw.stopLossPrice) || undefined,
    thesis,
    thesisTag: raw.thesisTag,
    frictionCost,
    entryTime,
    session: { mode: "LIVE" },
    // v1 blocked no real margin for shorts; converting it now would wipe the
    // student's available balance. Open legacy positions can only be closed.
    blockedMargin: 0,
  };
}

function migrateLegTrade(raw: LegacyTrade): PaperTradeRecord {
  const symbol = (raw.symbol ?? "UNKNOWN").toUpperCase();
  const entryTime = Number(raw.entryTime) || Date.now();
  const exitTime = Number(raw.exitTime) || entryTime;
  const pnl = Number(raw.pnl) || 0;
  const netPnl = Number(raw.netPnl ?? raw.pnl) || 0;
  const side = raw.side === "SELL" ? "SELL" : "BUY";
  const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
  const exitReason = raw.exitReason ?? "MANUAL";
  const base: Omit<EquityTradeRecord, "kind"> = {
    id: raw.id ?? `trd-${exitTime}`,
    symbol,
    name: raw.name ?? symbol,
    side,
    quantity,
    entryPrice: Number(raw.entryPrice) || 0,
    exitPrice: Number(raw.exitPrice) || 0,
    grossPnl: pnl,
    netPnl,
    pnlPct: Number(raw.pnlPct) || 0,
    frictionCost: Math.max(0, pnl - netPnl),
    thesis: raw.thesis ?? "",
    thesisTag: raw.thesisTag,
    postMortem: raw.postMortem,
    facultyScore: typeof raw.facultyScore === "number" ? raw.facultyScore : undefined,
    entryTime,
    exitTime,
    exitReason,
    session: { mode: "LIVE" as const },
  };

  if (raw.instrument === "EQUITY") {
    return { ...base, kind: "EQUITY" };
  }

  const lotSize = lotSizeFor(symbol);
  const lots = Math.max(1, Math.round(quantity / lotSize));
  const entryPremium = Number(raw.entryPrice) || 0;
  const exitPremium = Number(raw.exitPrice) || 0;

  return {
    ...base,
    kind: "OPTIONS",
    strategyId: "SINGLE_LONG",
    strategyName: raw.strategyName ?? "Legacy single leg",
    entryNetPremium: round(sideSign(side) * entryPremium, 2),
    exitNetPremium: round(sideSign(side) * exitPremium, 2),
    legs: [
      {
        id: `${raw.id ?? exitTime}-leg-1`,
        instrument: raw.instrument === "PUT" ? "PE" : "CE",
        side,
        strike: Number(raw.strike) || entryPremium,
        expiry: legacyExpiry(raw.expiry),
        lots,
        lotSize,
        entryPremium,
        exitPremium,
        legPnl: pnl,
        iv: 15,
      },
    ],
  };
}

function migrateLegacy(): DeskState {
  const positions = readJson<LegacyPosition[]>(LEGACY_POSITIONS) ?? [];
  const history = readJson<LegacyTrade[]>(LEGACY_HISTORY) ?? [];
  const frictionRaw = readJson<boolean | string>(LEGACY_FRICTION);

  if (!positions.length && !history.length) {
    writeJson(DESK_KEY, DEFAULT_STATE);
    return DEFAULT_STATE;
  }

  // Back up before writing anything, so a bad migration is recoverable.
  writeJson(LEGACY_BACKUP_KEY, { positions, history, friction: frictionRaw, migratedAt: Date.now() });

  const migrated: DeskState = {
    schemaVersion: 2,
    positions: positions.map(migrateLegPosition),
    history: history.map(migrateLegTrade),
    access: DEFAULT_ACCESS,
    // v1 wrote the flag as a boolean or the string "false"; missing means on.
    friction: !(frictionRaw === false || frictionRaw === "false"),
    updatedAt: Date.now(),
  };

  writeJson(DESK_KEY, migrated);
  return migrated;
}

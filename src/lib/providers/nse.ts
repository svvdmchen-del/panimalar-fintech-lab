import type { FiiDiiRow, IndexQuote, MarketSession, Mover, OptionChain, OptionLeg, OptionStrike, SectorPerf } from "@/lib/types";
import { SECTOR_INDICES, displayName } from "@/lib/symbols";

/**
 * Direct NSE India provider.
 *
 * These are the public JSON endpoints the nseindia.com site itself calls. They
 * work without an API key, but NSE aggressively blocks data-centre IPs and
 * changes paths without notice, so every call site must be treated as
 * best-effort and have a fallback.
 */
const BASE = "https://www.nseindia.com";

const HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  referer: `${BASE}/`,
  "x-requested-with": "XMLHttpRequest",
};

async function nseJson<T>(route: string, timeoutMs = 9000): Promise<T> {
  const response = await fetch(`${BASE}${route}`, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`NSE ${route} -> HTTP ${response.status}`);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`NSE ${route} returned non-JSON payload`);
  }
}

function toNum(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface RawIndex {
  indexSymbol?: string;
  index?: string;
  last?: number;
  variation?: number;
  percentChange?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  yearHigh?: number;
  yearLow?: number;
  advances?: string | number;
  declines?: string | number;
  unchanged?: string | number;
  pe?: string | number;
  pb?: string | number;
  dy?: string | number;
}

function mapIndex(raw: RawIndex): IndexQuote {
  return {
    symbol: raw.indexSymbol ?? raw.index ?? "",
    name: raw.index ?? raw.indexSymbol ?? "",
    last: toNum(raw.last),
    change: toNum(raw.variation),
    changePct: toNum(raw.percentChange),
    open: toNum(raw.open),
    high: toNum(raw.high),
    low: toNum(raw.low),
    prevClose: toNum(raw.previousClose),
    yearHigh: toNum(raw.yearHigh),
    yearLow: toNum(raw.yearLow),
    advances: raw.advances === undefined ? undefined : toNum(raw.advances),
    declines: raw.declines === undefined ? undefined : toNum(raw.declines),
    unchanged: raw.unchanged === undefined ? undefined : toNum(raw.unchanged),
    pe: raw.pe ? toNum(raw.pe) : undefined,
    pb: raw.pb ? toNum(raw.pb) : undefined,
    dividendYield: raw.dy ? toNum(raw.dy) : undefined,
  };
}

export async function fetchAllIndices(): Promise<IndexQuote[]> {
  const payload = await nseJson<{ data?: RawIndex[] }>("/api/allIndices");
  const rows = payload.data ?? [];
  if (!rows.length) throw new Error("NSE allIndices returned no rows");
  return rows.map(mapIndex);
}

export function pickIndices(all: IndexQuote[], symbols: readonly string[]): IndexQuote[] {
  const byName = new Map(all.map((entry) => [entry.symbol, entry]));
  const picked: IndexQuote[] = [];
  for (const symbol of symbols) {
    const found = byName.get(symbol);
    if (found) picked.push(found);
  }
  if (!picked.length) throw new Error(`NSE did not return any of: ${symbols.join(", ")}`);
  return picked;
}

export function toSectors(all: IndexQuote[]): SectorPerf[] {
  const byName = new Map(all.map((entry) => [entry.symbol, entry]));
  const sectors: SectorPerf[] = [];
  for (const meta of SECTOR_INDICES) {
    const index = byName.get(meta.name);
    if (!index) continue;
    sectors.push({
      name: meta.name,
      short: meta.short,
      last: index.last,
      change: index.change,
      changePct: index.changePct,
      advances: index.advances ?? 0,
      declines: index.declines ?? 0,
    });
  }
  if (!sectors.length) throw new Error("NSE did not return any sectoral indices");
  return sectors.sort((a, b) => b.changePct - a.changePct);
}

export async function fetchSectors(): Promise<SectorPerf[]> {
  return toSectors(await fetchAllIndices());
}

export async function fetchMarketStatus(): Promise<MarketSession[]> {
  const payload = await nseJson<{
    marketState?: {
      market?: string;
      marketStatus?: string;
      marketStatusMessage?: string;
      tradeDate?: string;
      index?: string;
      last?: number | string;
      percentChange?: number | string;
      change?: number | string;
    }[];
  }>("/api/marketStatus");

  const rows = payload.marketState;
  if (!rows?.length) throw new Error("NSE marketStatus returned no rows");

  return rows
    .filter((row) => Boolean(row.marketStatus))
    .map((row) => ({
      market: row.market ?? "Market",
      status: row.marketStatus ?? "Unknown",
      message: row.marketStatusMessage ?? "",
      tradeDate: row.tradeDate ?? "",
      index: row.index || undefined,
      last: row.last === "" || row.last === undefined ? undefined : toNum(row.last),
      changePct:
        row.percentChange === "" || row.percentChange === undefined
          ? undefined
          : toNum(row.percentChange),
    }));
}

export async function fetchFiiDii(): Promise<FiiDiiRow[]> {
  const rows = await nseJson<{ date?: string; category?: string; buyValue?: string; sellValue?: string; netValue?: string }[]>(
    "/api/fiidiiTradeReact",
  );
  if (!Array.isArray(rows) || !rows.length) throw new Error("NSE FII/DII endpoint returned no rows");

  const byDate = new Map<string, FiiDiiRow>();
  for (const row of rows) {
    const date = (row.date ?? "").trim();
    if (!date) continue;
    const entry =
      byDate.get(date) ?? { date, fii: { buy: 0, sell: 0, net: 0 }, dii: { buy: 0, sell: 0, net: 0 } };
    const leg = { buy: toNum(row.buyValue), sell: toNum(row.sellValue), net: toNum(row.netValue) };
    if (/^FII|FPI/i.test(row.category ?? "")) entry.fii = leg;
    else if (/^DII/i.test(row.category ?? "")) entry.dii = leg;
    byDate.set(date, entry);
  }

  const parsed = [...byDate.values()].sort((a, b) => toTime(b.date) - toTime(a.date));
  if (!parsed.length) throw new Error("NSE FII/DII payload could not be parsed");
  return parsed.slice(0, 8);
}

function toTime(nseDate: string): number {
  // NSE uses DD-MMM-YYYY, e.g. 23-Oct-2026.
  const parsed = Date.parse(nseDate);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface RawVariation {
  symbol?: string;
  ltp?: number;
  prev_price?: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  trade_quantity?: number;
  turnover?: number;
}

interface VariationsPayload {
  NIFTY?: { data?: RawVariation[] };
}

function mapVariation(raw: RawVariation): Mover | null {
  const symbol = raw.symbol?.trim();
  const price = toNum(raw.ltp);
  const prevClose = toNum(raw.prev_price);
  if (!symbol || !price || !prevClose) return null;
  const change = price - prevClose;
  return {
    symbol,
    name: displayName(symbol),
    price,
    change,
    changePct: (change / prevClose) * 100,
    volume: toNum(raw.trade_quantity),
  };
}

export async function fetchMovers(count = 8): Promise<{ gainers: Mover[]; losers: Mover[]; volume: Mover[] }> {
  const [gainersPayload, losersPayload] = await Promise.all([
    nseJson<VariationsPayload>("/api/live-analysis-variations?index=gainers"),
    nseJson<VariationsPayload>("/api/live-analysis-variations?index=loosers"),
  ]);

  const gainers = (gainersPayload.NIFTY?.data ?? [])
    .map(mapVariation)
    .filter((row): row is Mover => row !== null)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, count);

  const losers = (losersPayload.NIFTY?.data ?? [])
    .map(mapVariation)
    .filter((row): row is Mover => row !== null)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, count);

  if (!gainers.length && !losers.length) throw new Error("NSE movers endpoints returned no data");

  const universe = [...gainers, ...losers];
  const volume = [...universe].sort((a, b) => b.volume - a.volume).slice(0, count);

  return { gainers, losers, volume };
}

export const NSE_ATTRIBUTION = "NSE India (nseindia.com public endpoints)";

function normaliseLeg(leg: {
  lastPrice?: number;
  openInterest?: number;
  changeinOpenInterest?: number;
  totalTradedVolume?: number;
  impliedVolatility?: number;
} | undefined): OptionLeg {
  return {
    ltp: toNum(leg?.lastPrice),
    oi: toNum(leg?.openInterest),
    oiChange: toNum(leg?.changeinOpenInterest),
    volume: toNum(leg?.totalTradedVolume),
    iv: toNum(leg?.impliedVolatility),
  };
}

const OPTION_INDEX_SET = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]);

export async function fetchOptionChain(symbol = "NIFTY", window = 5): Promise<OptionChain> {
  const cleanSym = symbol.toUpperCase().trim();
  const type = OPTION_INDEX_SET.has(cleanSym) ? "Indices" : "Equity";

  const info = await nseJson<{ expiryDates?: string[] }>(
    `/api/option-chain-contract-info?symbol=${encodeURIComponent(cleanSym)}`,
  );
  const expiries = info.expiryDates ?? [];
  if (!expiries.length) throw new Error(`NSE contract-info returned no expiries for ${cleanSym}`);
  const expiry = expiries[0];

  const payload = await nseJson<{
    records?: {
      underlyingValue?: number;
      timestamp?: string;
      data?: {
        strikePrice?: number;
        CE?: {
          lastPrice?: number;
          openInterest?: number;
          changeinOpenInterest?: number;
          totalTradedVolume?: number;
          impliedVolatility?: number;
        };
        PE?: {
          lastPrice?: number;
          openInterest?: number;
          changeinOpenInterest?: number;
          totalTradedVolume?: number;
          impliedVolatility?: number;
        };
      }[];
    };
  }>(
    `/api/option-chain-v3?type=${type}&symbol=${encodeURIComponent(cleanSym)}&expiry=${encodeURIComponent(expiry)}`,
  );

  const records = payload.records ?? {};
  const rows = records.data ?? [];
  if (!rows.length) throw new Error(`NSE option-chain-v3 returned no strikes for ${cleanSym}`);

  const underlying = toNum(records.underlyingValue);
  const allStrikes: OptionStrike[] = rows
    .filter((row) => Number.isFinite(row.strikePrice))
    .map((row) => ({
      strike: toNum(row.strikePrice),
      ce: normaliseLeg(row.CE),
      pe: normaliseLeg(row.PE),
    }))
    .sort((a, b) => a.strike - b.strike);

  if (!allStrikes.length) throw new Error(`No valid strikes parsed for ${cleanSym}`);

  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  allStrikes.forEach((row, index) => {
    const delta = Math.abs(row.strike - underlying);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = index;
    }
  });

  const atmStrike = allStrikes[best]?.strike ?? underlying;
  const strikes = allStrikes.slice(Math.max(0, best - window), best + window + 1);

  const totalCeOi = allStrikes.reduce((sum, row) => sum + row.ce.oi, 0);
  const totalPeOi = allStrikes.reduce((sum, row) => sum + row.pe.oi, 0);
  const maxCeOi = allStrikes.reduce((max, row) => Math.max(max, row.ce.oi), 0);
  const maxPeOi = allStrikes.reduce((max, row) => Math.max(max, row.pe.oi), 0);

  let updatedAtIso = new Date().toISOString();
  if (records.timestamp) {
    const parsed = Date.parse(records.timestamp);
    if (Number.isFinite(parsed)) updatedAtIso = new Date(parsed).toISOString();
  }

  return {
    symbol: cleanSym,
    underlying,
    expiry,
    expiries: expiries.slice(0, 12),
    strikes,
    atmStrike,
    pcr: totalCeOi ? totalPeOi / totalCeOi : 0,
    maxCeOi,
    maxPeOi,
    totalCeOi,
    totalPeOi,
    updatedAt: updatedAtIso,
  };
}

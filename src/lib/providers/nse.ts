import type { FiiDiiRow, IndexQuote, MarketSession, Mover, Movers, SectorPerf } from "@/lib/types";
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

export async function fetchMovers(
  count = 8,
  universe: "NIFTY 50" | "NIFTY 500" = "NIFTY 500",
): Promise<Movers> {
  const [gainersPayload, losersPayload, high52Payload, low52Payload] = await Promise.allSettled([
    nseJson<VariationsPayload>(`/api/live-analysis-variations?index=gainers`),
    nseJson<VariationsPayload>(`/api/live-analysis-variations?index=loosers`),
    nseJson<{ data?: RawVariation[] }>(`/api/live-analysis-52week-high-low?index=high`),
    nseJson<{ data?: RawVariation[] }>(`/api/live-analysis-52week-high-low?index=low`),
  ]);

  const gainers = (
    gainersPayload.status === "fulfilled" ? gainersPayload.value.NIFTY?.data ?? [] : []
  )
    .map(mapVariation)
    .filter((row): row is Mover => row !== null)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, count);

  const losers = (
    losersPayload.status === "fulfilled" ? losersPayload.value.NIFTY?.data ?? [] : []
  )
    .map(mapVariation)
    .filter((row): row is Mover => row !== null)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, count);

  const high52 = (
    high52Payload.status === "fulfilled" ? high52Payload.value.data ?? [] : []
  )
    .map(mapVariation)
    .filter((row): row is Mover => row !== null)
    .slice(0, count);

  const low52 = (
    low52Payload.status === "fulfilled" ? low52Payload.value.data ?? [] : []
  )
    .map(mapVariation)
    .filter((row): row is Mover => row !== null)
    .slice(0, count);

  if (!gainers.length && !losers.length) throw new Error("NSE movers endpoints returned no data");

  const combined = [...gainers, ...losers];
  const volume = [...combined].sort((a, b) => b.volume - a.volume).slice(0, count);

  return { gainers, losers, volume, high52, low52, universe };
}

export const NSE_ATTRIBUTION = "NSE India (nseindia.com public endpoints)";

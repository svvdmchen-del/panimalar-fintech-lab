import { mcpClient, MCP_ENABLED } from "@/lib/mcp/client";
import { displayName } from "@/lib/symbols";
import type {
  Candle,
  ChartRange,
  IndexQuote,
  MarketSession,
  Mover,
  OptionChain,
  OptionLeg,
  OptionStrike,
  Quote,
  MarketCapCategory,
  StockFundamentals,
} from "@/lib/types";

/**
 * NSE India MCP provider.
 *
 * The dashboard treats the MCP server as a normal upstream: it is asked for a
 * tool call, the JSON payload comes back, and it is normalised into the same
 * domain types the direct-NSE provider returns.
 */
function client() {
  if (!MCP_ENABLED) throw new Error("MCP provider disabled (NSE_MCP_DISABLED=1)");
  return mcpClient();
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanSymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
}

interface RawQuote {
  symbol?: string;
  name?: string;
  price?: number;
  lastPrice?: number;
  change?: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
  weekHigh52?: number;
  weekLow52?: number;
}

function normaliseQuote(raw: RawQuote, requested: string): Quote {
  const symbol = cleanSymbol(raw.symbol ?? requested);
  const price = num(raw.price ?? raw.lastPrice);
  const prevClose = num(raw.previousClose, price);
  const change = num(raw.change, price - prevClose);
  return {
    symbol,
    name: displayName(symbol, raw.name),
    price,
    change,
    changePct: num(raw.changePct, prevClose ? (change / prevClose) * 100 : 0),
    open: num(raw.open, price),
    high: num(raw.high, price),
    low: num(raw.low, price),
    prevClose,
    volume: num(raw.volume),
    yearHigh: raw.weekHigh52 ? num(raw.weekHigh52) : undefined,
    yearLow: raw.weekLow52 ? num(raw.weekLow52) : undefined,
    marketCap: raw.marketCap ? num(raw.marketCap) : undefined,
    peRatio: raw.peRatio ? num(raw.peRatio) : undefined,
  };
}

export async function mcpQuote(symbol: string): Promise<Quote> {
  const raw = await client().callTool<RawQuote>("get_quote", { symbol });
  return normaliseQuote(raw, symbol);
}

/** Quotes fan out in parallel; a single bad symbol must not sink the panel. */
export async function mcpQuotes(symbols: string[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => normaliseQuote(
      await client().callTool<RawQuote>("get_quote", { symbol }),
      symbol,
    )),
  );
  const quotes = settled
    .filter((result): result is PromiseFulfilledResult<Quote> => result.status === "fulfilled")
    .map((result) => result.value);

  if (!quotes.length) {
    const firstError = settled.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(`MCP quotes failed: ${firstError?.reason instanceof Error ? firstError.reason.message : "no data"}`);
  }
  return quotes;
}

interface RawIndex {
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
  pe?: string | number;
  pb?: string | number;
  dividendYield?: string | number;
}

export async function mcpIndex(name: string): Promise<IndexQuote> {
  const raw = await client().callTool<RawIndex>("get_index", { index: name });
  return {
    symbol: raw.index ?? name,
    name: raw.index ?? name,
    last: num(raw.last),
    change: num(raw.variation),
    changePct: num(raw.percentChange),
    open: num(raw.open),
    high: num(raw.high),
    low: num(raw.low),
    prevClose: num(raw.previousClose),
    yearHigh: num(raw.yearHigh),
    yearLow: num(raw.yearLow),
    advances: raw.advances === undefined ? undefined : num(raw.advances),
    declines: raw.declines === undefined ? undefined : num(raw.declines),
    pe: raw.pe ? num(raw.pe) : undefined,
    pb: raw.pb ? num(raw.pb) : undefined,
    dividendYield: raw.dividendYield ? num(raw.dividendYield) : undefined,
  };
}

export async function mcpIndices(names: readonly string[]): Promise<IndexQuote[]> {
  const settled = await Promise.allSettled(names.map((name) => mcpIndex(name)));
  const rows = settled
    .filter((result): result is PromiseFulfilledResult<IndexQuote> => result.status === "fulfilled")
    .map((result) => result.value);
  if (!rows.length) throw new Error("MCP index lookups all failed");
  return rows;
}

interface RawMover {
  symbol?: string;
  name?: string;
  price?: number;
  change?: number;
  changePct?: number;
  volume?: number;
}

export async function mcpMovers(count = 8): Promise<{ gainers: Mover[]; losers: Mover[]; volume: Mover[] }> {
  const [gainersRaw, losersRaw] = await Promise.all([
    client().callTool<{ data?: RawMover[] }>("get_gainers_losers", { type: "gainers", count }),
    client().callTool<{ data?: RawMover[] }>("get_gainers_losers", { type: "losers", count }),
  ]);

  const map = (rows: RawMover[] | undefined): Mover[] =>
    (rows ?? []).map((row) => ({
      symbol: cleanSymbol(row.symbol ?? ""),
      name: displayName(cleanSymbol(row.symbol ?? ""), row.name),
      price: num(row.price),
      change: num(row.change),
      changePct: num(row.changePct),
      volume: num(row.volume),
    }));

  const gainers = map(gainersRaw.data);
  const losers = map(losersRaw.data);
  if (!gainers.length && !losers.length) throw new Error("MCP movers returned no rows");

  const volume = [...gainers, ...losers].sort((a, b) => b.volume - a.volume).slice(0, count);
  return { gainers, losers, volume };
}

interface RawStatus {
  market?: string;
  marketStatus?: string;
  marketStatusMessage?: string;
  tradeDate?: string;
  index?: string;
  last?: number | string;
  percentChange?: number | string;
}

export async function mcpMarketStatus(): Promise<MarketSession[]> {
  const rows = await client().callTool<RawStatus[]>("get_market_status", {});
  if (!Array.isArray(rows)) throw new Error("MCP market status returned an unexpected payload");
  return rows
    .filter((row) => Boolean(row.marketStatus))
    .map((row) => ({
      market: row.market ?? "Market",
      status: row.marketStatus ?? "Unknown",
      message: row.marketStatusMessage ?? "",
      tradeDate: row.tradeDate ?? "",
      index: row.index || undefined,
      last: row.last === "" || row.last === undefined ? undefined : num(row.last),
      changePct:
        row.percentChange === "" || row.percentChange === undefined ? undefined : num(row.percentChange),
    }));
}

const RANGE_DAYS: Record<ChartRange, number> = { "1D": 1, "1W": 10, "1M": 45, "6M": 200, "1Y": 380 };

function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

interface RawHistory {
  symbol?: string;
  data?: { date?: string; open?: number; high?: number; low?: number; close?: number; volume?: number }[];
}

export async function mcpHistory(
  symbol: string,
  range: ChartRange,
): Promise<{ candles: Candle[]; prevClose: number }> {
  if (range === "1D") throw new Error("MCP history has no intraday interval; 1D is served by the intraday feed");

  const raw = await client().callTool<RawHistory>("get_historical", {
    symbol,
    from: isoDaysAgo(RANGE_DAYS[range]),
    to: new Date().toISOString().slice(0, 10),
    interval: "1d",
  });

  const candles: Candle[] = (raw.data ?? [])
    .map((row) => {
      const time = Math.floor(Date.parse(`${row.date}T00:00:00Z`) / 1000);
      return {
        time,
        open: num(row.open),
        high: num(row.high),
        low: num(row.low),
        close: num(row.close),
        volume: num(row.volume),
      };
    })
    .filter((candle) => Number.isFinite(candle.time) && candle.close > 0)
    .sort((a, b) => a.time - b.time);

  if (candles.length < 2) throw new Error(`MCP history returned only ${candles.length} candles for ${symbol}`);

  return { candles, prevClose: candles[candles.length - 2].close };
}

interface RawOptionLeg {
  lastPrice?: number;
  openInterest?: number;
  changeinOpenInterest?: number;
  totalTradedVolume?: number;
  impliedVolatility?: number;
}

interface RawOptionRow {
  strikePrice?: number;
  CE?: RawOptionLeg;
  PE?: RawOptionLeg;
}

interface RawOptionChain {
  symbol?: string;
  underlyingValue?: number;
  atmStrike?: number;
  expiry?: string;
  availableExpiries?: string[];
  data?: RawOptionRow[];
  timestamp?: string;
}

function normaliseLeg(leg: RawOptionLeg | undefined): OptionLeg {
  return {
    ltp: num(leg?.lastPrice),
    oi: num(leg?.openInterest),
    oiChange: num(leg?.changeinOpenInterest),
    volume: num(leg?.totalTradedVolume),
    iv: num(leg?.impliedVolatility),
  };
}

export async function mcpOptionChain(symbol = "NIFTY", window = 5): Promise<OptionChain> {
  const raw = await client().callTool<RawOptionChain>("get_options_chain", {
    symbol,
    strike_range: 500,
  });

  const rows = raw.data ?? [];
  if (!rows.length) throw new Error(`MCP option chain returned no strikes for ${symbol}`);

  const allStrikes: OptionStrike[] = rows
    .filter((row) => Number.isFinite(row.strikePrice))
    .map((row) => ({
      strike: num(row.strikePrice),
      ce: normaliseLeg(row.CE),
      pe: normaliseLeg(row.PE),
    }))
    .sort((a, b) => a.strike - b.strike);

  const atmStrike = num(raw.atmStrike, nearestStrike(allStrikes, num(raw.underlyingValue)));
  const atmIndex = allStrikes.findIndex((row) => row.strike === atmStrike);
  const centre = atmIndex >= 0 ? atmIndex : nearestStrikeIndex(allStrikes, atmStrike);
  const strikes = allStrikes.slice(Math.max(0, centre - window), centre + window + 1);

  const totalCeOi = allStrikes.reduce((sum, row) => sum + row.ce.oi, 0);
  const totalPeOi = allStrikes.reduce((sum, row) => sum + row.pe.oi, 0);
  const maxCeOi = allStrikes.reduce((max, row) => Math.max(max, row.ce.oi), 0);
  const maxPeOi = allStrikes.reduce((max, row) => Math.max(max, row.pe.oi), 0);

  return {
    symbol: raw.symbol ?? symbol,
    underlying: num(raw.underlyingValue),
    expiry: raw.expiry ?? "",
    expiries: raw.availableExpiries ?? [],
    strikes,
    atmStrike,
    pcr: totalCeOi ? totalPeOi / totalCeOi : 0,
    maxCeOi,
    maxPeOi,
    totalCeOi,
    totalPeOi,
    updatedAt: raw.timestamp ?? new Date().toISOString(),
  };
}

function nearestStrikeIndex(strikes: OptionStrike[], target: number): number {
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  strikes.forEach((row, index) => {
    const delta = Math.abs(row.strike - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = index;
    }
  });
  return best;
}

function nearestStrike(strikes: OptionStrike[], target: number): number {
  const index = nearestStrikeIndex(strikes, target);
  return strikes[index]?.strike ?? 0;
}

export const MCP_SERVER_NAME = "india-stock-mcp";

export async function mcpFundamentals(symbol: string): Promise<StockFundamentals> {
  const raw = await client().callTool<any>("get_fundamentals", { symbol });
  const fin = raw?.financialData;
  const stats = raw?.keyStats;
  const detail = raw?.summaryDetail;
  const mcap = num(detail?.marketCap ?? fin?.totalCash);

  const category: MarketCapCategory =
    mcap >= 200_000_000_000 ? "Large Cap" : mcap >= 50_000_000_000 ? "Mid Cap" : "Small Cap";

  return {
    symbol: cleanSymbol(symbol),
    trailingPE: detail?.trailingPE ? num(detail.trailingPE) : undefined,
    forwardPE: detail?.forwardPE ? num(detail.forwardPE) : undefined,
    priceToBook: stats?.priceToBook ? num(stats.priceToBook) : undefined,
    dividendYield: detail?.dividendYield ? num(detail.dividendYield) : undefined,
    returnOnEquity: fin?.returnOnEquity ? num(fin.returnOnEquity) : undefined,
    operatingMargin: fin?.operatingMargins ? num(fin.operatingMargins) : undefined,
    profitMargin: fin?.profitMargins ? num(fin.profitMargins) : undefined,
    debtToEquity: fin?.debtToEquity ? num(fin.debtToEquity) : undefined,
    marketCap: mcap,
    marketCapCategory: category,
    trailingEps: stats?.trailingEps ? num(stats.trailingEps) : undefined,
    bookValue: stats?.bookValue ? num(stats.bookValue) : undefined,
    beta: stats?.beta ? num(stats.beta) : undefined,
  };
}


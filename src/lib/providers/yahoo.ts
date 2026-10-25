import { displayName, YAHOO_INDEX_MAP } from "@/lib/symbols";
import type { Candle, ChartRange, Quote } from "@/lib/types";

/**
 * Yahoo Finance fallback provider.
 *
 * Delayed by roughly 15 minutes for NSE symbols, but reliable and key-free.
 * It keeps the dashboard alive when NSE throttles us and when the MCP server
 * cannot start, and it is the only source for intraday (1D) candles.
 */
const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
};

interface YahooChartResult {
  meta?: {
    currency?: string;
    symbol?: string;
    longName?: string;
    shortName?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: {
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }[];
  };
}

interface YahooChartResponse {
  chart?: { result?: YahooChartResult[]; error?: { description?: string } | null };
}

function yahooSymbol(symbol: string): string {
  if (symbol.startsWith("^")) return symbol;
  return YAHOO_INDEX_MAP[symbol] ?? `${symbol.toUpperCase()}.NS`;
}

async function chart(
  symbol: string,
  range: string,
  interval: string,
  timeoutMs = 9000,
): Promise<YahooChartResult> {
  const url = `${CHART_BASE}/${encodeURIComponent(yahooSymbol(symbol))}?range=${range}&interval=${interval}&includePrePost=false`;
  const response = await fetch(url, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Yahoo ${symbol} -> HTTP ${response.status}`);

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo ${symbol}: ${payload.chart?.error?.description ?? "empty response"}`);
  }
  return result;
}

function toCandles(result: YahooChartResult): Candle[] {
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp ?? [];
  if (!quote || !timestamps.length) return [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = quote.close?.[i];
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    if (typeof close !== "number" || typeof open !== "number") continue;
    if (typeof high !== "number" || typeof low !== "number") continue;
    candles.push({
      time: timestamps[i],
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  return candles;
}

export async function yahooQuote(symbol: string): Promise<Quote> {
  const result = await chart(symbol, "1d", "5m");
  const candles = toCandles(result);
  const meta = result.meta ?? {};
  const price = meta.regularMarketPrice ?? candles.at(-1)?.close ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prevClose;

  if (!price) throw new Error(`Yahoo ${symbol}: no price available`);

  return {
    symbol: symbol.toUpperCase(),
    name: displayName(symbol.toUpperCase(), meta.longName ?? meta.shortName),
    price,
    change,
    changePct: prevClose ? (change / prevClose) * 100 : 0,
    open: candles[0]?.open ?? price,
    high: meta.regularMarketDayHigh ?? candles.reduce((max, c) => Math.max(max, c.high), price),
    low: meta.regularMarketDayLow ?? candles.reduce((min, c) => Math.min(min, c.low), price),
    prevClose,
    volume: meta.regularMarketVolume ?? candles.reduce((sum, c) => sum + c.volume, 0),
    yearHigh: meta.fiftyTwoWeekHigh,
    yearLow: meta.fiftyTwoWeekLow,
  };
}

export async function yahooQuotes(symbols: string[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(symbols.map((symbol) => yahooQuote(symbol)));
  const quotes = settled
    .filter((result): result is PromiseFulfilledResult<Quote> => result.status === "fulfilled")
    .map((result) => result.value);
  if (!quotes.length) throw new Error("Yahoo Finance quote lookups all failed");
  return quotes;
}

const DAILY_RANGE: Record<Exclude<ChartRange, "1D">, { range: string; interval: string }> = {
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
};

export async function yahooHistory(
  symbol: string,
  range: ChartRange,
): Promise<{ candles: Candle[]; prevClose: number }> {
  const config = range === "1D" ? { range: "1d", interval: "5m" } : DAILY_RANGE[range];
  const result = await chart(symbol, config.range, config.interval);
  const candles = toCandles(result);
  if (candles.length < 2) throw new Error(`Yahoo ${symbol}: only ${candles.length} candles for ${range}`);

  const prevClose = result.meta?.chartPreviousClose ?? candles.at(-2)!.close;
  return { candles, prevClose };
}

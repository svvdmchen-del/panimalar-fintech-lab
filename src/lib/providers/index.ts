import type {
  ChartRange,
  DataStatus,
  Envelope,
  FiiDiiRow,
  History,
  IndexQuote,
  MarketSession,
  Movers,
  NewsItem,
  OptionChain,
  Quote,
  SectorPerf,
  StockFundamentals,
} from "@/lib/types";
import { INDEX_CARDS, SECTOR_INDICES } from "@/lib/symbols";
import { MOCK_NEWS, MOCK_SOURCE, mockFiiDii, mockFundamentals, mockHistory, mockIndices, mockMovers, mockOptions, mockQuotes, mockSectors, mockStatus } from "./mock";
import { fetchSectors, fetchFiiDii, fetchAllIndices, fetchMarketStatus, fetchMovers, pickIndices, toSectors, NSE_ATTRIBUTION } from "./nse";
import { MCP_SERVER_NAME, mcpFundamentals, mcpHistory, mcpIndices, mcpMarketStatus, mcpMovers, mcpOptionChain, mcpQuotes } from "./mcp";
import { fetchNews } from "./news";
import { yahooFundamentals, yahooHistory, yahooQuotes } from "./yahoo";

/**
 * Provider orchestration.
 *
 * Every capability has an ordered list of sources. The first one that answers
 * wins; the last one is always the offline demo feed so a route can never
 * return an error page to the classroom projector.
 */
interface Attempt<T> {
  source: string;
  status: DataStatus;
  run: () => Promise<T>;
}

export const SOURCES = {
  nse: NSE_ATTRIBUTION,
  mcp: `NSE via MCP (${MCP_SERVER_NAME})`,
  yahoo: "Yahoo Finance (delayed ~15m)",
  news: "Economic Times RSS",
  demo: MOCK_SOURCE,
};

async function resolveMany<T>(attempts: Attempt<T>[], label: string): Promise<Envelope<T>> {
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const data = await attempt.run();
      return {
        data,
        status: attempt.status,
        source: attempt.source,
        asOf: new Date().toISOString(),
        warning: errors.length ? `${label}: ${errors.join("; ")}` : undefined,
      };
    } catch (error) {
      errors.push(`${attempt.source} failed (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  // Unreachable while the demo attempt is last, but keeps TypeScript honest.
  throw new Error(`${label} has no usable provider: ${errors.join("; ")}`);
}

export function getIndices(symbols: readonly string[] = INDEX_CARDS.map((card) => card.symbol)) {
  return resolveMany<IndexQuote[]>(
    [
      {
        source: SOURCES.nse,
        status: "live",
        run: async () => pickIndices(await fetchAllIndices(), symbols),
      },
      { source: SOURCES.mcp, status: "delayed", run: () => mcpIndices(symbols) },
      { source: SOURCES.demo, status: "demo", run: async () => mockIndices(symbols) },
    ],
    "Indices",
  );
}

export function getSectors() {
  return resolveMany<SectorPerf[]>(
    [
      { source: SOURCES.nse, status: "live", run: () => fetchSectors() },
      {
        source: SOURCES.mcp,
        status: "delayed",
        run: async () => toSectors(await mcpIndices(SECTOR_INDICES.map((sector) => sector.name))),
      },
      { source: SOURCES.demo, status: "demo", run: async () => mockSectors() },
    ],
    "Sector performance",
  );
}

export function getQuotes(symbols: string[]) {
  return resolveMany<Quote[]>(
    [
      // MCP first: this is the requested data path, and it fans out in parallel.
      { source: SOURCES.mcp, status: "delayed", run: () => mcpQuotes(symbols) },
      { source: SOURCES.yahoo, status: "delayed", run: () => yahooQuotes(symbols) },
      { source: SOURCES.demo, status: "demo", run: async () => mockQuotes(symbols) },
    ],
    "Quotes",
  );
}

export function getMovers(count = 8) {
  return resolveMany<Movers>(
    [
      { source: SOURCES.nse, status: "live", run: () => fetchMovers(count) },
      { source: SOURCES.mcp, status: "delayed", run: () => mcpMovers(count) },
      { source: SOURCES.demo, status: "demo", run: async () => mockMovers(count) },
    ],
    "Movers",
  );
}

export function getFiiDii() {
  return resolveMany<FiiDiiRow[]>(
    [
      { source: SOURCES.nse, status: "live", run: () => fetchFiiDii() },
      { source: SOURCES.demo, status: "demo", run: async () => mockFiiDii() },
    ],
    "FII/DII flows",
  );
}

export function getMarketStatus() {
  return resolveMany<MarketSession[]>(
    [
      { source: SOURCES.nse, status: "live", run: () => fetchMarketStatus() },
      { source: SOURCES.mcp, status: "delayed", run: () => mcpMarketStatus() },
      { source: SOURCES.demo, status: "demo", run: async () => mockStatus() },
    ],
    "Market status",
  );
}

export function getOptionChain(symbol = "NIFTY") {
  return resolveMany<OptionChain>(
    [
      { source: SOURCES.mcp, status: "live", run: () => mcpOptionChain(symbol) },
      { source: SOURCES.demo, status: "demo", run: async () => mockOptions(symbol) },
    ],
    "Option chain",
  );
}

export function getHistory(symbol: string, range: ChartRange) {
  const attempts: Attempt<{ candles: History["candles"]; prevClose: number }>[] =
    range === "1D"
      ? [
          { source: SOURCES.yahoo, status: "delayed", run: () => yahooHistory(symbol, "1D") },
          { source: SOURCES.demo, status: "demo", run: async () => mockHistory(symbol, "1D") },
        ]
      : [
          { source: SOURCES.mcp, status: "delayed", run: () => mcpHistory(symbol, range) },
          { source: SOURCES.yahoo, status: "delayed", run: () => yahooHistory(symbol, range) },
          { source: SOURCES.demo, status: "demo", run: async () => mockHistory(symbol, range) },
        ];

  return resolveMany<History>(
    attempts.map((attempt) => ({
      ...attempt,
      run: async () => ({ symbol, range, ...(await attempt.run()) }),
    })),
    `${symbol} history`,
  );
}

export function getNews(limit = 8) {
  return resolveMany<NewsItem[]>(
    [
      { source: SOURCES.news, status: "live", run: () => fetchNews(limit) },
      { source: SOURCES.demo, status: "demo", run: async () => MOCK_NEWS.slice(0, limit) },
    ],
    "News",
  );
}

export function getFundamentals(symbol: string) {
  const code = symbol.trim().toUpperCase();
  return resolveMany<StockFundamentals>(
    [
      { source: SOURCES.mcp, status: "delayed", run: () => mcpFundamentals(code) },
      { source: SOURCES.yahoo, status: "delayed", run: () => yahooFundamentals(code) },
      { source: SOURCES.demo, status: "demo", run: async () => mockFundamentals(code) },
    ],
    `${code} fundamentals`,
  );
}


/**
 * Shared domain types for the Panimalar MBA Fintech Lab Terminal.
 *
 * Every API endpoint returns an `Envelope<T>` so the UI can always tell the
 * difference between a live NSE feed, a delayed third-party feed and the
 * offline demo dataset.
 */
export type DataStatus = "live" | "delayed" | "demo";

export interface Envelope<T> {
  data: T;
  status: DataStatus;
  /** Human readable name of the provider that produced the payload. */
  source: string;
  /** ISO timestamp of when the server assembled the payload. */
  asOf: string;
  /** Populated when a provider failed and a fallback was used. */
  warning?: string;
}

export interface IndexQuote {
  symbol: string;
  name: string;
  last: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  yearHigh: number;
  yearLow: number;
  advances?: number;
  declines?: number;
  unchanged?: number;
  pe?: number;
  pb?: number;
  dividendYield?: number;
}

export type MarketCapCategory = "Large Cap" | "Mid Cap" | "Small Cap";

export interface StockFundamentals {
  symbol: string;
  // Valuation
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  // Profitability
  returnOnEquity?: number;
  operatingMargin?: number;
  profitMargin?: number;
  // Financial Health
  debtToEquity?: number;
  marketCap?: number;
  marketCapCategory: MarketCapCategory;
  // Additional Metrics
  trailingEps?: number;
  bookValue?: number;
  beta?: number;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  peRatio?: number;
}

export interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  yearHigh?: number;
  yearLow?: number;
  pctFromHigh?: number;
  pctFromLow?: number;
}

export interface Movers {
  gainers: Mover[];
  losers: Mover[];
  volume: Mover[];
  high52?: Mover[];
  low52?: Mover[];
  universe?: "NIFTY 50" | "NIFTY 500";
}

export interface SectorPerf {
  /** NSE index identifier, e.g. "NIFTY BANK". */
  name: string;
  /** Short label used on the heat-map tile. */
  short: string;
  last: number;
  change: number;
  changePct: number;
  advances: number;
  declines: number;
}

export interface FlowLeg {
  buy: number;
  sell: number;
  net: number;
}

export interface FiiDiiRow {
  date: string;
  fii: FlowLeg;
  dii: FlowLeg;
}

export interface OptionLeg {
  ltp: number;
  oi: number;
  oiChange: number;
  volume: number;
  iv: number;
}

export interface OptionStrike {
  strike: number;
  ce: OptionLeg;
  pe: OptionLeg;
}

export interface OptionChain {
  symbol: string;
  underlying: number;
  expiry: string;
  expiries: string[];
  strikes: OptionStrike[];
  atmStrike: number;
  pcr: number;
  maxCeOi: number;
  maxPeOi: number;
  totalCeOi: number;
  totalPeOi: number;
  updatedAt: string;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

export interface Candle {
  /** Unix epoch seconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartRange = "1D" | "1W" | "1M" | "6M" | "1Y";

export interface History {
  symbol: string;
  range: ChartRange;
  candles: Candle[];
  prevClose: number;
}

export interface MarketSession {
  market: string;
  status: string;
  message: string;
  tradeDate: string;
  index?: string;
  last?: number;
  changePct?: number;
}

export interface HealthReport {
  node: string;
  providers: { indices: string; quotes: string; options: string };
  mcp: {
    connected: boolean;
    tools: string[];
    server: string;
    error?: string;
  };
  checks: { name: string; ok: boolean; detail: string; ms: number }[];
}

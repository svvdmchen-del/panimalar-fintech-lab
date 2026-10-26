import { DEFAULT_WATCHLIST, INDEX_CARDS, NIFTY50_SYMBOLS, NIFTY500_SYMBOLS, SECTOR_INDICES, displayName } from "@/lib/symbols";
import type {
  Candle,
  ChartRange,
  FiiDiiRow,
  IndexQuote,
  MarketSession,
  Mover,
  Movers,
  NewsItem,
  OptionChain,
  OptionStrike,
  Quote,
  SectorPerf,
  MarketCapCategory,
  StockFundamentals,
} from "@/lib/types";

/**
 * Deterministic demo feed.
 *
 * A classroom projector should never show an empty dashboard, so if NSE, the
 * MCP server and Yahoo are all unreachable we render plausible, stable,
 * clearly-labelled simulated data instead. Values are seeded by symbol + day,
 * so every student in the lab sees the same numbers and a refresh does not
 * reshuffle the whole screen.
 */
const DAY = 86_400_000;

const BASE_PRICES: Record<string, number> = {
  RELIANCE: 1190,
  TCS: 3180,
  HDFCBANK: 1725,
  INFY: 1480,
  ICICIBANK: 1290,
  SBIN: 812,
  BHARTIARTL: 1685,
  ITC: 412,
  LT: 3620,
  MARUTI: 12850,
  TATAMOTORS: 742,
  TMCV: 396,
  TMPV: 265,
  SUNPHARMA: 1690,
  HINDUNILVR: 2380,
  KOTAKBANK: 1780,
  AXISBANK: 1140,
  BAJFINANCE: 945,
  "M&M": 2980,
  TATASTEEL: 168,
  INFOSYS: 1480,
};

const INDEX_BASE: Record<string, number> = {
  "NIFTY 50": 22600,
  "NIFTY BANK": 54287,
  "NIFTY IT": 36120,
  "NIFTY MIDCAP 100": 52840,
  "NIFTY NEXT 50": 62380,
  "INDIA VIX": 12.4,
  "NIFTY AUTO": 24150,
  "NIFTY FMCG": 58200,
  "NIFTY PHARMA": 21840,
  "NIFTY METAL": 9480,
  "NIFTY REALTY": 1082,
  "NIFTY ENERGY": 38640,
  "NIFTY PSU BANK": 7120,
  "NIFTY FIN SERVICE": 26340,
  "NIFTY MEDIA": 1920,
  "NIFTY INFRA": 8940,
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function dayBucket(): number {
  return Math.floor(Date.now() / DAY);
}

function basePrice(symbol: string): number {
  if (BASE_PRICES[symbol]) return BASE_PRICES[symbol];
  const rnd = mulberry32(hash(symbol));
  return round2(120 + rnd() * 3600);
}

function drift(symbol: string): number {
  // Slow sine wave so values move a little between refreshes.
  return Math.sin(Date.now() / 240_000 + (hash(symbol) % 628) / 100) * 0.08;
}

export function mockQuote(symbol: string): Quote {
  const code = symbol.toUpperCase();
  const rnd = mulberry32(hash(`${code}-${dayBucket()}`));
  const prevClose = basePrice(code);
  const changePct = round2((rnd() - 0.48) * 3.4 + drift(code));
  const price = round2(prevClose * (1 + changePct / 100));
  const swing = Math.max(prevClose * 0.004, Math.abs(price - prevClose) * 0.6);
  const high = round2(Math.max(price, prevClose) + swing * rnd());
  const low = round2(Math.min(price, prevClose) - swing * rnd());

  return {
    symbol: code,
    name: displayName(code),
    price,
    change: round2(price - prevClose),
    changePct,
    open: round2(prevClose + (price - prevClose) * 0.35),
    high,
    low,
    prevClose,
    volume: Math.round(150_000 + rnd() * 18_000_000),
    yearHigh: round2(prevClose * (1.18 + rnd() * 0.25)),
    yearLow: round2(prevClose * (0.62 + rnd() * 0.2)),
    marketCap: Math.round(prevClose * (4e8 + rnd() * 2e9)),
    peRatio: round2(12 + rnd() * 38),
  };
}

export function mockQuotes(symbols: string[]): Quote[] {
  return symbols.map(mockQuote);
}

export function mockIndex(name: string): IndexQuote {
  const rnd = mulberry32(hash(`${name}-${dayBucket()}`));
  const prevClose = INDEX_BASE[name] ?? 10000;
  const changePct = round2((rnd() - 0.52) * 2.6 + drift(name));
  const last = round2(prevClose * (1 + changePct / 100));
  const high = round2(Math.max(last, prevClose) * (1 + rnd() * 0.006));
  const low = round2(Math.min(last, prevClose) * (1 - rnd() * 0.006));
  const total = Math.round(40 + rnd() * 10);

  return {
    symbol: name,
    name,
    last,
    change: round2(last - prevClose),
    changePct,
    open: round2(prevClose * (1 + (rnd() - 0.5) * 0.003)),
    high,
    low,
    prevClose,
    yearHigh: round2(prevClose * (1.14 + rnd() * 0.2)),
    yearLow: round2(prevClose * (0.7 + rnd() * 0.15)),
    advances: Math.round(total * (0.25 + rnd() * 0.5)),
    declines: total - Math.round(total * (0.25 + rnd() * 0.5)),
    unchanged: 0,
    pe: round2(18 + rnd() * 6),
    pb: round2(2.4 + rnd() * 2),
    dividendYield: round2(0.8 + rnd() * 1.4),
  };
}

export function mockIndices(symbols: readonly string[] = INDEX_CARDS.map((c) => c.symbol)): IndexQuote[] {
  return symbols.map(mockIndex);
}

export function mockSectors(): SectorPerf[] {
  return SECTOR_INDICES.map((meta) => {
    const index = mockIndex(meta.name);
    return {
      name: meta.name,
      short: meta.short,
      last: index.last,
      change: index.change,
      changePct: index.changePct,
      advances: index.advances ?? 0,
      declines: index.declines ?? 0,
    };
  }).sort((a, b) => b.changePct - a.changePct);
}

export function mockMovers(count = 8, universe: "NIFTY 50" | "NIFTY 500" = "NIFTY 500"): Movers {
  const symbols = universe === "NIFTY 50" ? NIFTY50_SYMBOLS : NIFTY500_SYMBOLS;
  const quotes = symbols.map(mockQuote);
  const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
  
  const toMover = (quote: Quote): Mover => {
    const yHigh = quote.yearHigh ?? quote.high;
    const yLow = quote.yearLow ?? quote.low;
    const pctFromHigh = yHigh > 0 ? ((quote.price - yHigh) / yHigh) * 100 : 0;
    const pctFromLow = yLow > 0 ? ((quote.price - yLow) / yLow) * 100 : 0;
    return {
      symbol: quote.symbol,
      name: quote.name,
      price: quote.price,
      change: quote.change,
      changePct: quote.changePct,
      volume: quote.volume,
      yearHigh: yHigh,
      yearLow: yLow,
      pctFromHigh: round2(pctFromHigh),
      pctFromLow: round2(pctFromLow),
    };
  };

  const allMovers = quotes.map(toMover);

  // 52W High: stocks closest to their 52-week peak (pctFromHigh closest to 0 or positive)
  const high52 = [...allMovers]
    .sort((a, b) => (b.pctFromHigh ?? -100) - (a.pctFromHigh ?? -100))
    .slice(0, count);

  // 52W Low: stocks closest to their 52-week trough (pctFromLow closest to 0 or negative)
  const low52 = [...allMovers]
    .sort((a, b) => (a.pctFromLow ?? 100) - (b.pctFromLow ?? 100))
    .slice(0, count);

  return {
    gainers: sorted.slice(0, count).map(toMover),
    losers: [...sorted].reverse().slice(0, count).map(toMover),
    volume: [...quotes].sort((a, b) => b.volume - a.volume).slice(0, count).map(toMover),
    high52,
    low52,
    universe,
  };
}

export function mockStatus(): MarketSession[] {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000);
  const stamp = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(ist);
  const nifty = mockIndex("NIFTY 50");

  return [
    {
      market: "Capital Market",
      status: "Close",
      message: "Simulated session (demo data)",
      tradeDate: `${stamp} 15:30`,
      index: "NIFTY 50",
      last: nifty.last,
      changePct: nifty.changePct,
    },
    {
      market: "Currency",
      status: "Close",
      message: "Simulated session (demo data)",
      tradeDate: stamp,
    },
    {
      market: "Commodity",
      status: "Close",
      message: "Simulated session (demo data)",
      tradeDate: stamp,
    },
  ];
}

export function mockFiiDii(): FiiDiiRow[] {
  const rows: FiiDiiRow[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const date = new Date(Date.now() - i * DAY);
    const rnd = mulberry32(hash(`flow-${date.toISOString().slice(0, 10)}`));
    const label = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
    const fiiBuy = 12_000 + rnd() * 8_000;
    const fiiSell = 12_000 + rnd() * 8_000;
    const diiBuy = 9_000 + rnd() * 6_000;
    const diiSell = 9_000 + rnd() * 6_000;
    rows.push({
      date: label,
      fii: { buy: round2(fiiBuy), sell: round2(fiiSell), net: round2(fiiBuy - fiiSell) },
      dii: { buy: round2(diiBuy), sell: round2(diiSell), net: round2(diiBuy - diiSell) },
    });
  }
  return rows;
}

export function mockOptions(symbol = "NIFTY"): OptionChain {
  const underlying = symbol === "BANKNIFTY" ? 54287 : 22600;
  const step = symbol === "BANKNIFTY" ? 100 : 50;
  const atm = Math.round(underlying / step) * step;
  const rnd = mulberry32(hash(`oi-${symbol}-${dayBucket()}`));
  const strikes: OptionStrike[] = [];

  for (let offset = -5; offset <= 5; offset += 1) {
    const strike = atm + offset * step;
    const distance = Math.abs(offset);
    const ceOi = Math.round((40 + rnd() * 120) * 1000 * Math.max(0.15, 1 - distance / 7));
    const peOi = Math.round((45 + rnd() * 130) * 1000 * Math.max(0.15, 1 - distance / 7));
    const ceLtp = Math.max(2.5, (underlying - strike) * -1 + 120 - distance * 18 + rnd() * 25);
    const peLtp = Math.max(2.5, (strike - underlying) + 120 - distance * 18 + rnd() * 25);

    strikes.push({
      strike,
      ce: {
        ltp: round2(ceLtp),
        oi: ceOi,
        oiChange: Math.round((rnd() - 0.45) * ceOi * 0.25),
        volume: Math.round(ceOi * (0.3 + rnd())),
        iv: round2(11 + distance * 0.9 + rnd() * 3),
      },
      pe: {
        ltp: round2(peLtp),
        oi: peOi,
        oiChange: Math.round((rnd() - 0.45) * peOi * 0.25),
        volume: Math.round(peOi * (0.3 + rnd())),
        iv: round2(11 + distance * 0.9 + rnd() * 3),
      },
    });
  }

  const totalCeOi = strikes.reduce((sum, row) => sum + row.ce.oi, 0);
  const totalPeOi = strikes.reduce((sum, row) => sum + row.pe.oi, 0);

  return {
    symbol,
    underlying,
    expiry: nextThursday(),
    expiries: [nextThursday()],
    strikes,
    atmStrike: atm,
    pcr: totalCeOi ? round2(totalPeOi / totalCeOi) : 0,
    maxCeOi: Math.max(...strikes.map((row) => row.ce.oi)),
    maxPeOi: Math.max(...strikes.map((row) => row.pe.oi)),
    totalCeOi,
    totalPeOi,
    updatedAt: new Date().toISOString(),
  };
}

function nextThursday(): string {
  const date = new Date();
  date.setDate(date.getDate() + ((4 - date.getDay() + 7) % 7 || 7));
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(date)
    .replace(/ /g, "-");
}

export const MOCK_NEWS: NewsItem[] = [
  {
    title: "NIFTY ends lower as banks drag; broader market outperforms",
    link: "https://www.nseindia.com/",
    source: "Demo feed",
    publishedAt: new Date(Date.now() - 35 * 60_000).toISOString(),
  },
  {
    title: "FIIs turn net sellers in cash market for a second session",
    link: "https://www.nseindia.com/",
    source: "Demo feed",
    publishedAt: new Date(Date.now() - 95 * 60_000).toISOString(),
  },
  {
    title: "IT index gains on rupee weakness; mid-tier names lead",
    link: "https://www.nseindia.com/",
    source: "Demo feed",
    publishedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  {
    title: "Auto pack in focus ahead of monthly sales data",
    link: "https://www.nseindia.com/",
    source: "Demo feed",
    publishedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  {
    title: "India VIX cools to a three-week low as volatility fades",
    link: "https://www.nseindia.com/",
    source: "Demo feed",
    publishedAt: new Date(Date.now() - 7 * 3_600_000).toISOString(),
  },
  {
    title: "Weekly F&O expiry: NIFTY options open interest shifts higher",
    link: "https://www.nseindia.com/",
    source: "Demo feed",
    publishedAt: new Date(Date.now() - 9 * 3_600_000).toISOString(),
  },
];

function lastTradingDay(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000);
  const day = ist.getDay();
  const back = day === 0 ? 2 : day === 6 ? 1 : 0;
  ist.setDate(ist.getDate() - back);
  ist.setHours(3, 45, 0, 0); // 09:15 IST expressed in UTC
  return ist;
}

export function mockHistory(symbol: string, range: ChartRange): { candles: Candle[]; prevClose: number } {
  const quote = mockQuote(symbol);
  const candles: Candle[] = [];

  if (range === "1D") {
    const start = lastTradingDay().getTime() / 1000;
    const rnd = mulberry32(hash(`intraday-${symbol}-${dayBucket()}`));
    let price = quote.open;
    for (let i = 0; i < 75; i += 1) {
      const open = price;
      const swing = price * 0.0011;
      const close = open + (rnd() - 0.5) * swing * 2 + (quote.price - quote.open) / 75;
      const high = Math.max(open, close) + rnd() * swing;
      const low = Math.min(open, close) - rnd() * swing;
      candles.push({
        time: Math.round(start + i * 300),
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume: Math.round(80_000 + rnd() * 400_000),
      });
      price = close;
    }
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      last.close = quote.price;
      last.high = Math.max(last.high, quote.price);
      last.low = Math.min(last.low, quote.price);
    }
    return { candles, prevClose: quote.prevClose };
  }

  const sessions = range === "1W" ? 6 : range === "1M" ? 22 : range === "6M" ? 130 : 250;
  const rnd = mulberry32(hash(`daily-${symbol}-${dayBucket()}`));
  let price = quote.prevClose * (range === "1Y" ? 0.82 : range === "6M" ? 0.92 : 0.97);
  const start = lastTradingDay().getTime() / 1000 - sessions * 86_400;

  for (let i = 0; i < sessions; i += 1) {
    const open = price;
    const close = open * (1 + (rnd() - 0.49) * 0.022);
    const high = Math.max(open, close) * (1 + rnd() * 0.008);
    const low = Math.min(open, close) * (1 - rnd() * 0.008);
    candles.push({
      time: Math.round(start + i * 86_400),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round(1_000_000 + rnd() * 9_000_000),
    });
    price = close;
  }

  candles.push({
    time: Math.round(lastTradingDay().getTime() / 1000),
    open: quote.open,
    high: quote.high,
    low: quote.low,
    close: quote.price,
    volume: quote.volume,
  });

  return { candles, prevClose: quote.prevClose };
}

export const MOCK_SOURCE = "Simulated feed (offline demo)";

export function mockFundamentals(symbol: string): StockFundamentals {
  const code = symbol.toUpperCase();
  const rnd = mulberry32(hash(`fund-${code}`));
  const base = basePrice(code);
  const mcap = Math.round(base * (6e8 + rnd() * 4e9));
  const category: MarketCapCategory =
    mcap >= 200_000_000_000 ? "Large Cap" : mcap >= 50_000_000_000 ? "Mid Cap" : "Small Cap";

  const trailingPE = round2(12 + rnd() * 32);
  const forwardPE = round2(trailingPE * (0.85 + rnd() * 0.2));
  const priceToBook = round2(1.2 + rnd() * 6.5);
  const dividendYield = round2((0.2 + rnd() * 2.8) / 100);
  const returnOnEquity = round2((8 + rnd() * 24) / 100);
  const operatingMargin = round2((10 + rnd() * 22) / 100);
  const profitMargin = round2(operatingMargin * (0.5 + rnd() * 0.35));
  const debtToEquity = round2(10 + rnd() * 75);

  return {
    symbol: code,
    trailingPE,
    forwardPE,
    priceToBook,
    dividendYield,
    returnOnEquity,
    operatingMargin,
    profitMargin,
    debtToEquity,
    marketCap: mcap,
    marketCapCategory: category,
    trailingEps: round2(base / trailingPE),
    bookValue: round2(base / priceToBook),
    beta: round2(0.6 + rnd() * 0.8),
  };
}


import type { SectorPerf } from "./types";

/** Index cards shown across the top of the dashboard. */
export const INDEX_CARDS = [
  { symbol: "NIFTY 50", label: "NIFTY 50", hint: "Benchmark" },
  { symbol: "NIFTY BANK", label: "BANK NIFTY", hint: "Banking" },
  { symbol: "NIFTY IT", label: "NIFTY IT", hint: "Technology" },
  { symbol: "NIFTY MIDCAP 100", label: "MIDCAP 100", hint: "Mid caps" },
  { symbol: "NIFTY NEXT 50", label: "NEXT 50", hint: "Large caps" },
  { symbol: "INDIA VIX", label: "INDIA VIX", hint: "Volatility" },
] as const;

/** Sectoral indices used to build the heat-map. */
export const SECTOR_INDICES: { name: string; short: string }[] = [
  { name: "NIFTY BANK", short: "BANK" },
  { name: "NIFTY IT", short: "IT" },
  { name: "NIFTY AUTO", short: "AUTO" },
  { name: "NIFTY FMCG", short: "FMCG" },
  { name: "NIFTY PHARMA", short: "PHARMA" },
  { name: "NIFTY METAL", short: "METAL" },
  { name: "NIFTY REALTY", short: "REALTY" },
  { name: "NIFTY ENERGY", short: "ENERGY" },
  { name: "NIFTY PSU BANK", short: "PSU BANK" },
  { name: "NIFTY FIN SERVICE", short: "FIN SRV" },
  { name: "NIFTY MEDIA", short: "MEDIA" },
  { name: "NIFTY INFRA", short: "INFRA" },
];

/** Default watchlist for a fresh browser session. */
export const DEFAULT_WATCHLIST = [
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "INFY",
  "ICICIBANK",
  "SBIN",
  "BHARTIARTL",
  "ITC",
  "LT",
  "MARUTI",
  "TMCV",
  "SUNPHARMA",
];

/**
 * Tradable universe used for the symbol search box and for resolving display
 * names when a feed does not return one. Roughly the NIFTY 50 plus a few
 * liquid mid-caps — edit freely, nothing else depends on the exact list.
 */
export const SYMBOL_UNIVERSE: { symbol: string; name: string; sector: string }[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Oil & Gas" },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials" },
  { symbol: "INFY", name: "Infosys", sector: "IT" },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Financials" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "ITC", name: "ITC", sector: "FMCG" },
  { symbol: "LT", name: "Larsen & Toubro", sector: "Capital Goods" },
  { symbol: "MARUTI", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "TMCV", name: "Tata Motors (CV)", sector: "Auto" },
  { symbol: "TMPV", name: "Tata Motors (PV)", sector: "Auto" },
  { symbol: "SUNPHARMA", name: "Sun Pharma", sector: "Pharma" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Financials" },
  { symbol: "AXISBANK", name: "Axis Bank", sector: "Financials" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", sector: "Financials" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", sector: "Financials" },
  { symbol: "M&M", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", sector: "Cement" },
  { symbol: "TITAN", name: "Titan Company", sector: "Consumer" },
  { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Consumer" },
  { symbol: "NTPC", name: "NTPC", sector: "Power" },
  { symbol: "POWERGRID", name: "Power Grid Corp", sector: "Power" },
  { symbol: "TATASTEEL", name: "Tata Steel", sector: "Metals" },
  { symbol: "JSWSTEEL", name: "JSW Steel", sector: "Metals" },
  { symbol: "WIPRO", name: "Wipro", sector: "IT" },
  { symbol: "HCLTECH", name: "HCL Technologies", sector: "IT" },
  { symbol: "TECHM", name: "Tech Mahindra", sector: "IT" },
  { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Conglomerate" },
  { symbol: "ADANIPORTS", name: "Adani Ports", sector: "Infrastructure" },
  { symbol: "GRASIM", name: "Grasim Industries", sector: "Cement" },
  { symbol: "NESTLEIND", name: "Nestle India", sector: "FMCG" },
  { symbol: "BRITANNIA", name: "Britannia Industries", sector: "FMCG" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products", sector: "FMCG" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp", sector: "Oil & Gas" },
  { symbol: "COALINDIA", name: "Coal India", sector: "Mining" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Labs", sector: "Pharma" },
  { symbol: "CIPLA", name: "Cipla", sector: "Pharma" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories", sector: "Pharma" },
  { symbol: "EICHERMOT", name: "Eicher Motors", sector: "Auto" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", sector: "Auto" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto", sector: "Auto" },
  { symbol: "SBILIFE", name: "SBI Life Insurance", sector: "Insurance" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance", sector: "Insurance" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", sector: "Financials" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", sector: "Healthcare" },
  { symbol: "BEL", name: "Bharat Electronics", sector: "Defence" },
  { symbol: "TRENT", name: "Trent", sector: "Retail" },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance", sector: "Financials" },
  { symbol: "SUZLON", name: "Suzlon Energy", sector: "Green Energy" },
  { symbol: "IRCTC", name: "IRCTC", sector: "Railway & Travel" },
  { symbol: "YESBANK", name: "Yes Bank", sector: "Financials" },
  { symbol: "PAYTM", name: "Paytm (One97)", sector: "Fintech" },
  { symbol: "HAL", name: "Hindustan Aeronautics", sector: "Defence" },
  { symbol: "BSE", name: "BSE India", sector: "Financials" },
  { symbol: "IRFC", name: "Indian Railway Finance", sector: "Financials" },
  { symbol: "RVNL", name: "Rail Vikas Nigam", sector: "Infrastructure" },
  { symbol: "IREDA", name: "IREDA", sector: "Green Energy" },
  { symbol: "NHPC", name: "NHPC", sector: "Power" },
  { symbol: "PNB", name: "Punjab National Bank", sector: "Financials" },
  { symbol: "BANKBARODA", name: "Bank of Baroda", sector: "Financials" },
  { symbol: "CANBK", name: "Canara Bank", sector: "Financials" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank", sector: "Financials" },
  { symbol: "UNIONBANK", name: "Union Bank of India", sector: "Financials" },
  { symbol: "FEDERALBNK", name: "Federal Bank", sector: "Financials" },
  { symbol: "ADANIPOWER", name: "Adani Power", sector: "Power" },
  { symbol: "ADANIGREEN", name: "Adani Green Energy", sector: "Green Energy" },
  { symbol: "MAZDOCK", name: "Mazagon Dock", sector: "Defence" },
  { symbol: "COCHINSHIP", name: "Cochin Shipyard", sector: "Defence" },
  { symbol: "BHEL", name: "Bharat Heavy Electricals", sector: "Capital Goods" },
  { symbol: "SAIL", name: "Steel Authority of India", sector: "Metals" },
  { symbol: "NMDC", name: "NMDC", sector: "Mining" },
  { symbol: "HINDALCO", name: "Hindalco Industries", sector: "Metals" },
  { symbol: "IOC", name: "Indian Oil Corp", sector: "Oil & Gas" },
  { symbol: "BPCL", name: "Bharat Petroleum", sector: "Oil & Gas" },
  { symbol: "HINDPETRO", name: "Hindustan Petroleum", sector: "Oil & Gas" },
  { symbol: "GAIL", name: "GAIL India", sector: "Utilities" },
  { symbol: "TATAPOWER", name: "Tata Power", sector: "Power" },
  { symbol: "MOTHERSON", name: "Samvardhana Motherson", sector: "Auto Ancillary" },
  { symbol: "BOSCHLTD", name: "Bosch", sector: "Auto Ancillary" },
  { symbol: "MRF", name: "MRF Tyres", sector: "Auto Ancillary" },
  { symbol: "POLYCAB", name: "Polycab India", sector: "Industrials" },
  { symbol: "PERSISTENT", name: "Persistent Systems", sector: "IT" },
  { symbol: "COFORGE", name: "Coforge", sector: "IT" },
  { symbol: "LTIM", name: "LTIMindtree", sector: "IT" },
  { symbol: "KPITTECH", name: "KPIT Technologies", sector: "IT" },
  { symbol: "OFSS", name: "Oracle Financial Services", sector: "IT" },
  { symbol: "NAUKRI", name: "Info Edge", sector: "Internet" },
  { symbol: "NYKAA", name: "FSN E-Commerce", sector: "Consumer Tech" },
  { symbol: "DELHIVERY", name: "Delhivery", sector: "Logistics" },
  { symbol: "POLICYBZR", name: "PB Fintech", sector: "Fintech" },
  { symbol: "AUROPHARMA", name: "Aurobindo Pharma", sector: "Pharma" },
  { symbol: "LUPIN", name: "Lupin", sector: "Pharma" },
  { symbol: "TORNTPHARM", name: "Torrent Pharma", sector: "Pharma" },
  { symbol: "ALKEM", name: "Alkem Labs", sector: "Pharma" },
  { symbol: "MANAPPURAM", name: "Manappuram Finance", sector: "Financials" },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance", sector: "Financials" },
  { symbol: "CHOLAFIN", name: "Cholamandalam Inv", sector: "Financials" },
  { symbol: "HAVELLS", name: "Havells India", sector: "Consumer Electricals" },
  { symbol: "VOLTAS", name: "Voltas", sector: "Consumer Electricals" },
  { symbol: "COLPAL", name: "Colgate-Palmolive", sector: "FMCG" },
  { symbol: "DABUR", name: "Dabur India", sector: "FMCG" },
  { symbol: "MARICO", name: "Marico", sector: "FMCG" },
  { symbol: "IDEA", name: "Vodafone Idea", sector: "Telecom" },
  { symbol: "INDHOTEL", name: "Indian Hotels", sector: "Hospitality" },
  { symbol: "ETERNAL", name: "Eternal (Zomato)", sector: "Consumer Tech" },
  { symbol: "JIOFIN", name: "Jio Financial Services", sector: "Financials" },
  { symbol: "INDIGO", name: "InterGlobe Aviation", sector: "Aviation" },
  { symbol: "DMART", name: "Avenue Supermarts", sector: "Retail" },
  { symbol: "PIDILITIND", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "SIEMENS", name: "Siemens India", sector: "Capital Goods" },
  { symbol: "DLF", name: "DLF", sector: "Realty" },
  { symbol: "GODREJCP", name: "Godrej Consumer", sector: "FMCG" },
  { symbol: "VEDL", name: "Vedanta", sector: "Metals" },
  { symbol: "ZOMATO", name: "Zomato", sector: "Consumer Tech" },
];

const NAME_MAP = new Map(SYMBOL_UNIVERSE.map((s) => [s.symbol, s.name]));

export function displayName(symbol: string, fallback?: string): string {
  return NAME_MAP.get(symbol) ?? prettifyName(fallback) ?? symbol;
}

function prettifyName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/\s*(LIMITED|LTD\.?|CORP\.?|CORPORATION|INDIA)$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned ? toTitleCase(cleaned) : undefined;
}

function toTitleCase(value: string): string {
  if (value === value.toUpperCase()) {
    return value
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(It|Ps)\b/g, (m) => m.toUpperCase());
  }
  return value;
}

export function searchUniverse(query: string, limit = 8) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return SYMBOL_UNIVERSE.filter(
    (s) => s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q),
  ).slice(0, limit);
}

/** Yahoo Finance tickers used by the fallback provider. */
export const YAHOO_INDEX_MAP: Record<string, string> = {
  "NIFTY 50": "^NSEI",
  "NIFTY BANK": "^NSEBANK",
  "INDIA VIX": "^INDIAVIX",
};

export function sectorFrom(indexName: string): SectorPerf | null {
  const meta = SECTOR_INDICES.find((s) => s.name === indexName);
  if (!meta) return null;
  return {
    name: meta.name,
    short: meta.short,
    last: 0,
    change: 0,
    changePct: 0,
    advances: 0,
    declines: 0,
  };
}

export const NIFTY50_SYMBOLS = SYMBOL_UNIVERSE.slice(0, 50).map((s) => s.symbol);

import type { NextRequest } from "next/server";
import { searchUniverse } from "@/lib/symbols";
import { cached } from "@/lib/cache";

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
};

interface SearchResult {
  symbol: string;
  name: string;
  sector: string;
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!query) {
    return Response.json({ data: [] }, { headers: { "cache-control": "no-store" } });
  }

  const payload = await cached(`search:${query.toUpperCase()}`, 30_000, async () => {
    // 1. Instant match from local universe
    const local = searchUniverse(query, 8);
    const seen = new Set(local.map((item) => item.symbol.toUpperCase()));
    const results: SearchResult[] = [...local];

    // 2. Query Yahoo Finance Search API for any Indian equities across NSE/BSE
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
      const res = await fetch(url, {
        headers: HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const json = await res.json();
        const quotes: Array<{
          symbol?: string;
          exchange?: string;
          shortname?: string;
          longname?: string;
          sector?: string;
          sectorDisp?: string;
        }> = json.quotes ?? [];

        for (const item of quotes) {
          const rawSymbol = String(item.symbol ?? "").toUpperCase();
          const isNSE = rawSymbol.endsWith(".NS") || item.exchange === "NSI";
          const isBSE = rawSymbol.endsWith(".BO") || item.exchange === "BSE";
          if (!isNSE && !isBSE) continue;

          const cleanSymbol = rawSymbol.replace(/\.(NS|BO)$/, "").trim();
          if (!cleanSymbol || seen.has(cleanSymbol)) continue;
          seen.add(cleanSymbol);

          results.push({
            symbol: cleanSymbol,
            name: item.longname ?? item.shortname ?? cleanSymbol,
            sector: item.sectorDisp ?? item.sector ?? (isNSE ? "NSE" : "BSE"),
          });
        }
      }
    } catch {
      // Local matches still succeed if Yahoo search is offline or throttled
    }

    // 3. If user typed an exact symbol not yet in results, offer it as a valid ticker option
    const cleanQuery = query.toUpperCase();
    if (/^[A-Z0-9&-]{1,20}$/.test(cleanQuery) && !seen.has(cleanQuery)) {
      results.push({
        symbol: cleanQuery,
        name: `View quote & chart for ${cleanQuery}`,
        sector: "NSE",
      });
    }

    return results.slice(0, 8);
  });

  return Response.json({ data: payload }, { headers: { "cache-control": "no-store" } });
}

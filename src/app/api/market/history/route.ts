import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getHistory } from "@/lib/providers";
import type { ChartRange } from "@/lib/types";

const TTL = 60_000;
const RANGES: ChartRange[] = ["1D", "1W", "1M", "6M", "1Y"];
// Accepts equities (RELIANCE, M&M) and index names (NIFTY 50, NIFTY BANK).
const SYMBOL_PATTERN = /^[A-Z0-9 &-]{1,24}$/;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbol = (params.get("symbol") ?? "NIFTY 50").trim().toUpperCase();
  const rangeParam = (params.get("range") ?? "1D").trim().toUpperCase();
  const range = RANGES.includes(rangeParam as ChartRange) ? (rangeParam as ChartRange) : "1D";

  if (!SYMBOL_PATTERN.test(symbol)) {
    return Response.json(
      { data: null, status: "demo", source: "none", asOf: new Date().toISOString(), error: "Invalid symbol" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const payload = await cached(`history:${symbol}:${range}`, TTL, () => getHistory(symbol, range));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

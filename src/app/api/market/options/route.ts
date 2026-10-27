import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getOptionChain } from "@/lib/providers";

const TTL = 45_000;
const UNDERLYINGS = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]);

export async function GET(request: NextRequest) {
  const requested = (request.nextUrl.searchParams.get("symbol") ?? "NIFTY").toUpperCase();
  const symbol = UNDERLYINGS.has(requested) ? requested : "NIFTY";
  const expiry = request.nextUrl.searchParams.get("expiry") || undefined;

  const cacheKey = expiry ? `options:${symbol}:${expiry}` : `options:${symbol}`;
  const payload = await cached(cacheKey, TTL, () => getOptionChain(symbol, expiry));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

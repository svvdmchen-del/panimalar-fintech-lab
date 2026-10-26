import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getFundamentals } from "@/lib/providers";

const TTL = 5 * 60_000;
const SYMBOL_PATTERN = /^[A-Z0-9&-]{1,24}$/;

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "RELIANCE").trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    return Response.json(
      { data: null, status: "demo", source: "none", asOf: new Date().toISOString(), error: "Invalid symbol" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const payload = await cached(`fundamentals:${symbol}`, TTL, () => getFundamentals(symbol));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

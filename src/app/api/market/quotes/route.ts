import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getQuotes } from "@/lib/providers";
import { DEFAULT_WATCHLIST } from "@/lib/symbols";

const TTL = 15_000;
const SYMBOL_PATTERN = /^[A-Z0-9&-]{1,20}$/;

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("symbols");
  const symbols = [
    ...new Set(
      (requested ? requested.split(",") : DEFAULT_WATCHLIST)
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => SYMBOL_PATTERN.test(symbol)),
    ),
  ].slice(0, 24);

  if (!symbols.length) {
    return Response.json(
      { data: [], status: "demo", source: "none", asOf: new Date().toISOString(), error: "No valid symbols" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const payload = await cached(`quotes:${symbols.join(",")}`, TTL, () => getQuotes(symbols));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

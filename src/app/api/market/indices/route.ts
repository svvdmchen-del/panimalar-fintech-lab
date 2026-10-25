import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getIndices } from "@/lib/providers";
import { INDEX_CARDS } from "@/lib/symbols";

const TTL = 15_000;

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("symbols");
  const symbols = requested
    ? requested
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase().slice(0, 40))
        .filter(Boolean)
        .slice(0, 12)
    : INDEX_CARDS.map((card) => card.symbol);

  const payload = await cached(`indices:${symbols.join("|")}`, TTL, () => getIndices(symbols));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

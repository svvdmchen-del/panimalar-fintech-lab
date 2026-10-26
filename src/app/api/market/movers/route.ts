import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getMovers } from "@/lib/providers";

const TTL = 30_000;

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("count") ?? 8);
  const count = Number.isFinite(raw) ? Math.min(12, Math.max(3, Math.round(raw))) : 8;
  const rawUniverse = request.nextUrl.searchParams.get("universe");
  const universe: "NIFTY 50" | "NIFTY 500" =
    rawUniverse === "NIFTY 50" || rawUniverse === "NIFTY50" ? "NIFTY 50" : "NIFTY 500";

  const payload = await cached(`movers:${universe}:${count}`, TTL, () => getMovers(count, universe));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

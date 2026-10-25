import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getMovers } from "@/lib/providers";

const TTL = 30_000;

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("count") ?? 8);
  const count = Number.isFinite(raw) ? Math.min(12, Math.max(3, Math.round(raw))) : 8;

  const payload = await cached(`movers:${count}`, TTL, () => getMovers(count));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

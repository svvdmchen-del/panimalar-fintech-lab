import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getNews } from "@/lib/providers";

const TTL = 5 * 60_000;

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(raw) ? Math.min(12, Math.max(3, Math.round(raw))) : 8;

  const payload = await cached(`news:${limit}`, TTL, () => getNews(limit));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

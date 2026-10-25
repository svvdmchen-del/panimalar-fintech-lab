import { cached } from "@/lib/cache";
import { getMarketStatus } from "@/lib/providers";

const TTL = 30_000;

export async function GET() {
  const payload = await cached("market-status", TTL, () => getMarketStatus());
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

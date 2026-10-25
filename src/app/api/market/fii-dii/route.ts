import { cached } from "@/lib/cache";
import { getFiiDii } from "@/lib/providers";

const TTL = 5 * 60_000;

export async function GET() {
  const payload = await cached("fii-dii", TTL, () => getFiiDii());
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

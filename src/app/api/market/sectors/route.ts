import { cached } from "@/lib/cache";
import { getSectors } from "@/lib/providers";

const TTL = 30_000;

export async function GET() {
  // Uncached network access inside `getSectors()` keeps this handler dynamic;
  // with `cacheComponents` enabled we deliberately do not declare `dynamic`.
  const payload = await cached("sectors", TTL, () => getSectors());
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

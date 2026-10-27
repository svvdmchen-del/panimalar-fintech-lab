import { cached } from "@/lib/cache";
import { mcpClient } from "@/lib/mcp/client";
import { fetchAllIndices } from "@/lib/providers/nse";
import { fetchNews } from "@/lib/providers/news";
import { yahooQuote } from "@/lib/providers/yahoo";
import type { HealthReport } from "@/lib/types";

const TTL = 30_000;

async function probe(name: string, run: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await run();
    return { name, ok: true, detail, ms: Date.now() - started };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}

export async function GET() {
  const report = await cached<HealthReport>("health", TTL, async () => {
    const checks = await Promise.all([
      probe("NSE direct endpoints", async () => {
        const indices = await fetchAllIndices();
        return `${indices.length} indices`;
      }),
      probe("MCP server", async () => {
        const tools = await mcpClient().listTools();
        return `${tools.length} tools available`;
      }),
      probe("Yahoo Finance", async () => {
        const quote = await yahooQuote("RELIANCE");
        return `RELIANCE ₹${quote.price.toFixed(2)}`;
      }),
      probe("Market news RSS", async () => {
        const news = await fetchNews(3);
        return `${news.length} headlines`;
      }),
    ]);

    const mcp = mcpClient().peek();

    return {
      node: process.version,
      providers: {
        indices: "NSE direct -> MCP -> demo",
        quotes: "MCP -> Yahoo -> demo",
        options: "NSE direct -> MCP -> demo",
      },
      mcp: {
        connected: checks.find((check) => check.name === "MCP server")?.ok ?? false,
        tools: mcp.tools,
        server: mcp.server,
        error: mcp.error,
      },
      checks,
    };
  });

  return Response.json(report, { headers: { "cache-control": "no-store" } });
}

import type { NewsItem } from "@/lib/types";

/**
 * Market news from public RSS feeds. No API key, no scraping HTML — just the
 * publisher's own syndication feed, which is the polite way to do this.
 */
const FEEDS = [
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", source: "Economic Times" },
  { url: "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms", source: "ET Stocks" },
];

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/rss+xml, application/xml, text/xml, */*",
};

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return "";
  return decode(
    match[1]
      // A literal "]]>" inside CDATA is split across two sections.
      .replace(/\]\]\]\]><!\[CDATA\[>/g, "]]>")
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/<[^>]+>/g, " ")
      .trim(),
  );
}

function decode(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  const response = await fetch(url, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`${source} RSS -> HTTP ${response.status}`);

  const xml = await response.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const items: NewsItem[] = [];

  for (const block of blocks.slice(0, 15)) {
    const title = tag(block, "title");
    const link = tag(block, "link");
    if (!title || !link) continue;
    const published = tag(block, "pubDate");
    const parsed = published ? Date.parse(published) : Number.NaN;
    items.push({
      title,
      link,
      source,
      publishedAt: new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString(),
    });
  }

  return items;
}

export async function fetchNews(limit = 8): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed.url, feed.source)));
  const items = settled
    .filter((result): result is PromiseFulfilledResult<NewsItem[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (!items.length) throw new Error("All news feeds failed");

  const seen = new Set<string>();
  return items
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

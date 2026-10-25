"use client";

import { ago } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";

export function NewsFeed({
  items,
  loading,
  badge,
}: {
  items: NewsItem[];
  loading: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Panel title="Market news" subtitle="Latest headlines" badge={badge} bodyClassName="overflow-y-auto">
      {!items.length && loading ? (
        <div className="space-y-3 p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !items.length ? (
        <Empty>No headlines available.</Empty>
      ) : (
        <ul className="divide-y divide-line/60">
          {items.map((item, index) => (
            <li key={`${item.link}-${index}`}>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className="group block px-3.5 py-2 transition-colors hover:bg-wash/[0.03]"
              >
                <p className="line-clamp-2 text-[11px] leading-snug text-ink/90 group-hover:text-cyan">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[9px] text-muted/70">
                  <span className="uppercase tracking-wider">{item.source}</span>
                  <span aria-hidden>·</span>
                  <span>{ago(item.publishedAt)}</span>
                  <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                    ↗
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { dateIST, timeIST, weekdayIST } from "@/lib/format";
import { sessionLabel } from "@/lib/marketHours";
import type { DataStatus, MarketSession } from "@/lib/types";
import { useNow, useSymbolSearch } from "@/lib/usePoll";
import { ThemeToggle } from "./ThemeToggle";
import { ZoomToggle } from "./ZoomToggle";
import { DataBadge } from "./ui";

const INTERVALS = [
  { value: 10_000, label: "10s" },
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
  { value: 60_000, label: "1m" },
];

export function TopBar({
  dataStatus,
  sources,
  marketOpen,
  session,
  intervalMs,
  onIntervalChange,
  onRefresh,
  onSelect,
  onDetails,
  updatedAt,
}: {
  dataStatus: DataStatus;
  sources: string[];
  marketOpen: boolean;
  session?: MarketSession;
  intervalMs: number;
  onIntervalChange: (interval: number) => void;
  onRefresh: () => void;
  onSelect: (symbol: string) => void;
  onDetails: (symbol: string) => void;
  updatedAt?: number;
}) {
  const now = useNow(1000);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const results = useSymbolSearch(query, 8);

  const pick = (symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    onSelect(clean);
    onDetails(clean);
    setQuery("");
    setOpen(false);
  };

  const statusTone = marketOpen
    ? "border-up/40 bg-up/10 text-up"
    : "border-line-strong bg-wash/5 text-muted";
  const statusText = marketOpen ? "MARKET OPEN" : "MARKET CLOSED";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Image
            src="/panimalar-crest.png"
            alt="Panimalar Engineering College crest"
            width={80}
            height={80}
            priority
            className="size-10 shrink-0 rounded-full"
          />
          <div className="leading-tight">
            <h1 className="text-[12px] font-semibold tracking-[0.12em] text-ink">
              PANIMALAR MBA FINTECH LAB TERMINAL
            </h1>
            <p className="text-[10px] text-muted">Classroom market dashboard</p>
          </div>
        </div>

        <div className="relative order-last w-full sm:order-none sm:ml-2 sm:w-64">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 140)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (results.length > 0) {
                  pick(results[0].symbol);
                } else if (query.trim()) {
                  pick(query.trim());
                }
              }
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder="Search any NSE stock (e.g. Suzlon, IRCTC)…"
            aria-label="Search for an NSE stock"
            className="w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-[11px] text-ink placeholder:text-muted/60 focus:border-cyan/40 focus:outline-none focus:ring-1 focus:ring-cyan/40"
          />
          {open && results.length > 0 ? (
            <ul
              role="listbox"
              className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[90vw] overflow-hidden rounded-lg border border-line bg-panel2 shadow-2xl"
            >
              {results.map((entry) => (
                <li key={entry.symbol} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(entry.symbol)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-[11px] hover:bg-wash/5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-ink">{entry.symbol}</span>
                      <span className="ml-2 truncate text-[10px] text-muted">{entry.name}</span>
                    </div>
                    {entry.sector ? (
                      <span className="shrink-0 rounded border border-line/60 bg-panel px-1 py-0.5 text-[8px] uppercase tracking-wider text-muted/80">
                        {entry.sector}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            title={session ? `${session.market} · ${session.tradeDate} · ${session.message}` : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] ${statusTone}`}
          >
            <span
              className={`size-1.5 rounded-full ${marketOpen ? "animate-pulse-soft bg-up" : "bg-muted"}`}
              aria-hidden
            />
            {statusText}
          </span>

          <span className="hidden items-baseline gap-1.5 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] tabular-nums md:flex">
            <span className="text-muted">{now ? weekdayIST(now) : "—"}</span>
            <span className="text-ink">{now ? timeIST(now, true) : "--:--:--"}</span>
            <span className="text-[9px] text-muted/60">IST</span>
          </span>

          <span className="hidden text-[10px] text-muted xl:inline">{now ? dateIST(now) : ""}</span>

          <span title={sources.length ? sources.join("\n") : undefined}>
            <DataBadge status={dataStatus} />
          </span>

          <select
            value={intervalMs}
            onChange={(event) => onIntervalChange(Number(event.target.value))}
            aria-label="Refresh interval"
            className="rounded-md border border-line bg-panel px-1.5 py-1 font-mono text-[10px] text-muted focus:outline-none focus:ring-1 focus:ring-cyan/40"
          >
            {INTERVALS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              onRefresh();
              setJustRefreshed(true);
              window.setTimeout(() => setJustRefreshed(false), 700);
            }}
            title={updatedAt ? `Last update ${timeIST(updatedAt, true)} IST` : "Refresh now"}
            aria-label="Refresh data now"
            className="rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            <span className={justRefreshed ? "inline-block animate-spin" : "inline-block"} aria-hidden>
              ↻
            </span>
          </button>

          <ZoomToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 pb-1.5 text-[9px] uppercase tracking-[0.12em] text-muted/50">
        <span>{now ? sessionLabel(now) : "Session"}</span>
        <span aria-hidden>·</span>
        <span>NSE cash 09:15–15:30 IST</span>
        {updatedAt ? (
          <>
            <span aria-hidden>·</span>
            <span className="normal-case tracking-normal">updated {timeIST(updatedAt, true)}</span>
          </>
        ) : null}
      </div>
    </header>
  );
}

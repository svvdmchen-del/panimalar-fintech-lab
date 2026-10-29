"use client";

import { useEffect, useRef, useState } from "react";
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
  onOpenShortcuts,
  onOpenMarketLens,
  onOpenLabMode,
  onOpenPaperTrade,
  onOpenExport,
  simulationActive,
  onToggleSimulation,
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
  onOpenShortcuts?: () => void;
  onOpenMarketLens?: () => void;
  onOpenLabMode?: () => void;
  onOpenPaperTrade?: () => void;
  onOpenExport?: () => void;
  simulationActive?: boolean;
  onToggleSimulation?: () => void;
  updatedAt?: number;
}) {
  const now = useNow(1000);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const results = useSymbolSearch(query, 8);

  // Reset active index when search results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Global '/' or 'Ctrl+K' hotkey to focus search bar
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const target = document.activeElement;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if ((e.key === "/" && !isInput) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  const pick = (symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    onSelect(clean);
    onDetails(clean);
    setQuery("");
    setOpen(false);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (results[activeIndex]) {
        pick(results[activeIndex].symbol);
      } else if (results.length > 0) {
        pick(results[0].symbol);
      } else if (query.trim()) {
        pick(query.trim());
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const statusTone = marketOpen
    ? "border-up/40 bg-up/10 text-up"
    : "border-line-strong bg-wash/5 text-muted";
  const statusText = marketOpen ? "MARKET OPEN" : "MARKET CLOSED";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-md shadow-sm">
      {/* TIER 1: Navigation & Cockpit Command Deck */}
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-4 py-2">
        {/* Left: Institutional Branding (Dominant & Spacious) */}
        <div className="flex items-center gap-3 shrink-0 min-w-max">
          <div className="relative">
            <Image
              src="/panimalar-crest.png"
              alt="Panimalar Engineering College crest"
              width={80}
              height={80}
              priority
              className="size-10 shrink-0 rounded-full ring-1 ring-line/80 shadow-sm"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-bg ${
                marketOpen ? "bg-up animate-pulse" : "bg-muted"
              }`}
              title={marketOpen ? "Live Exchange Feed Active" : "Exchange Offline"}
            />
          </div>

          <div className="leading-snug">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-widest text-ink uppercase">
                PANIMALAR ENGINEERING COLLEGE
              </span>
              <span className="rounded-md bg-cyan/15 px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider text-cyan border border-cyan/35 shadow-xs">
                MBA FINTECH LAB
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted/90 tracking-tight hidden sm:block">
              Department of MBA · Live Terminal
            </p>
          </div>
        </div>

        {/* Center: Command Bar Search (Compact & Proportional) */}
        <div className="relative w-52 lg:w-64 mx-2 hidden md:block">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-muted/70 text-xs pointer-events-none" aria-hidden>
              🔍
            </span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 160)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search NSE stock or index (or press Ctrl+K)…"
              aria-label="Search for an NSE stock"
              className="w-full rounded-lg border border-line bg-panel/80 pl-8 pr-14 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-cyan/50 focus:bg-panel focus:outline-none focus:ring-1 focus:ring-cyan/40 transition-all shadow-inner"
            />
            <kbd
              title="Press Ctrl+K or / anywhere to focus search"
              className="pointer-events-none absolute right-2 rounded border border-line bg-panel2 px-1.5 py-0.5 text-[9px] font-mono text-muted/80 shadow-xs"
            >
              Ctrl+K
            </kbd>
          </div>

          {open && results.length > 0 ? (
            <ul
              role="listbox"
              className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-panel2/95 backdrop-blur-md shadow-2xl animate-[fadeIn_100ms_ease-out]"
            >
              <div className="border-b border-line/60 px-3 py-1.5 text-[9px] text-muted flex items-center justify-between">
                <span>Navigate with ↑ ↓ and press Enter</span>
                <span className="font-mono">{results.length} matches</span>
              </div>
              {results.map((entry, index) => {
                const isHighlighted = index === activeIndex;
                return (
                  <li key={entry.symbol} role="presentation">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(entry.symbol)}
                      className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                        isHighlighted
                          ? "bg-cyan/15 text-cyan border-l-2 border-cyan"
                          : "text-ink hover:bg-wash/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold">{entry.symbol}</span>
                        <span className="ml-2 truncate text-[10px] text-muted">{entry.name}</span>
                      </div>
                      {entry.sector ? (
                        <span className="shrink-0 rounded border border-line/60 bg-panel px-1.5 py-0.2 text-[8px] uppercase tracking-wider text-muted/80">
                          {entry.sector}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* Right: Cohesive Segmented "Lab Desks" Pill + Compact Utility Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 1. Cohesive "Lab Desks" Segmented Control */}
          <div className="inline-flex items-center rounded-lg border border-line bg-panel2 p-0.5 shadow-sm divide-x divide-line/60">
            {onOpenLabMode ? (
              <button
                type="button"
                onClick={onOpenLabMode}
                title="MBA FinTech Lab Activities & Case Studies (Hotkey: E)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-cyan hover:bg-cyan/15 hover:text-cyan transition-all rounded-l-md"
              >
                <span className="text-[12px]" aria-hidden>🎓</span>
                <span className="hidden sm:inline">Lab Mode</span>
                <span className="rounded bg-cyan/20 px-1 py-0.2 text-[8px] font-mono text-cyan/90">E</span>
              </button>
            ) : null}

            {onOpenPaperTrade ? (
              <button
                type="button"
                onClick={onOpenPaperTrade}
                title="Virtual Paper Trading Desk (Hotkey: P)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-up hover:bg-up/15 hover:text-up transition-all"
              >
                <span className="text-[12px]" aria-hidden>📝</span>
                <span className="hidden sm:inline">Paper Trade</span>
                <span className="rounded bg-up/20 px-1 py-0.2 text-[8px] font-mono text-up/90">P</span>
              </button>
            ) : null}

            {onToggleSimulation ? (
              <button
                type="button"
                onClick={onToggleSimulation}
                title="Historical Event Replay (June 4th, Budget, COVID)"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  simulationActive
                    ? "bg-accent text-white animate-pulse"
                    : "text-accent hover:bg-accent/15"
                }`}
              >
                <span className="text-[12px]" aria-hidden>⏪</span>
                <span className="hidden sm:inline">{simulationActive ? "Simulating" : "Replay"}</span>
              </button>
            ) : null}

            {onOpenMarketLens ? (
              <button
                type="button"
                onClick={onOpenMarketLens}
                title="NSE MarketLens Valuation Screener (Hotkey: L)"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-ink/90 hover:bg-panel hover:text-cyan transition-all"
              >
                <span className="text-[12px]" aria-hidden>🔍</span>
                <span>MarketLens</span>
                <span className="rounded bg-panel px-1 py-0.2 text-[8px] font-mono text-muted">L</span>
              </button>
            ) : null}

            {onOpenExport ? (
              <button
                type="button"
                onClick={onOpenExport}
                title="Export Assessment Report (Hotkey: X)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-muted hover:bg-panel hover:text-ink transition-all rounded-r-md"
              >
                <span className="text-[12px]" aria-hidden>📥</span>
                <span className="hidden sm:inline">Report</span>
                <span className="rounded bg-panel px-1 py-0.2 text-[8px] font-mono text-muted">X</span>
              </button>
            ) : null}
          </div>

          {/* 2. Compact Utility Menu: Combined Refresh/Interval & System Controls */}
          <div className="flex items-center gap-1.5">
            {/* Combined Refresh & Interval Dropdown Pill */}
            <div className="flex items-center rounded-lg border border-line bg-panel overflow-hidden text-[11px] shadow-xs">
              <button
                type="button"
                onClick={() => {
                  onRefresh();
                  setJustRefreshed(true);
                  window.setTimeout(() => setJustRefreshed(false), 700);
                }}
                title={updatedAt ? `Last update ${timeIST(updatedAt, true)} IST (or press R)` : "Refresh now (R)"}
                aria-label="Refresh data now"
                className="px-2 py-1 text-muted hover:text-cyan transition-colors"
              >
                <span className={justRefreshed ? "inline-block animate-spin" : "inline-block"} aria-hidden>
                  ↻
                </span>
              </button>

              <select
                value={intervalMs}
                onChange={(event) => onIntervalChange(Number(event.target.value))}
                aria-label="Refresh interval"
                className="border-l border-line bg-panel2/60 px-1 py-1 font-mono text-[10px] text-muted focus:outline-none focus:text-ink"
              >
                {INTERVALS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* View Cluster */}
            <ZoomToggle />
            <ThemeToggle />

            {/* Shortcuts Cheat Sheet */}
            {onOpenShortcuts ? (
              <button
                type="button"
                onClick={onOpenShortcuts}
                title="Keyboard shortcuts HUD (press ?)"
                aria-label="Open keyboard shortcuts cheat sheet"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-panel text-xs font-mono text-muted transition-colors hover:border-cyan/40 hover:text-cyan shadow-xs"
              >
                ?
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* TIER 2: Telemetry Strip & Session Ribbon (Clean 3-Column Split) */}
      <div className="border-t border-line/60 bg-panel/60 px-4 py-1 text-[10px]">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 font-mono">
          {/* Left: Market Session Status */}
          <div className="flex items-center gap-2">
            <span
              title={session ? `${session.market} · ${session.tradeDate} · ${session.message}` : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.2 text-[9px] font-bold tracking-[0.12em] ${statusTone}`}
            >
              <span
                className={`size-1.5 rounded-full ${marketOpen ? "animate-pulse bg-up" : "bg-muted"}`}
                aria-hidden
              />
              {statusText}
            </span>
            <span className="text-muted/60 hidden sm:inline" aria-hidden>·</span>
            <span className="text-muted truncate hidden sm:inline">
              {now ? sessionLabel(now) : "Capital Market"} · NSE cash 09:15–15:30 IST
            </span>
          </div>

          {/* Center: Wall-Clock IST Time */}
          <div className="flex items-center gap-1.5 text-xs tabular-nums font-semibold">
            <span className="text-muted font-normal">{now ? weekdayIST(now) : "—"}</span>
            <span className="text-ink">{now ? timeIST(now, true) : "--:--:--"}</span>
            <span className="text-[9px] text-muted/60">IST</span>
            <span className="text-muted/40 hidden md:inline" aria-hidden>·</span>
            <span className="text-muted text-[10px] hidden md:inline">{now ? dateIST(now) : ""}</span>
          </div>

          {/* Right: Data Health & Update Time */}
          <div className="flex items-center gap-2.5">
            <span title={sources.length ? sources.join("\n") : undefined}>
              <DataBadge status={dataStatus} />
            </span>
            {updatedAt ? (
              <span className="text-muted/70 text-[10px] hidden sm:inline">
                updated <strong className="text-ink">{timeIST(updatedAt, true)}</strong>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

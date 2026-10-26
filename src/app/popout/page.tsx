"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { PriceChart } from "@/components/PriceChart";
import { Watchlist } from "@/components/Watchlist";
import { MoversPanel } from "@/components/MoversPanel";
import { OptionChainPanel } from "@/components/OptionChainPanel";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { FiiDiiPanel } from "@/components/FiiDiiPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { StockModal } from "@/components/StockModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ZoomToggle } from "@/components/ZoomToggle";
import { DataBadge } from "@/components/ui";
import { usePoll, useStoredList, useSymbolSearch } from "@/lib/usePoll";
import { DEFAULT_WATCHLIST } from "@/lib/symbols";
import { postBroadcast, subscribeBroadcast } from "@/lib/broadcast";
import type {
  DataStatus,
  Envelope,
  FiiDiiRow,
  Movers,
  NewsItem,
  OptionChain,
  Quote,
  SectorPerf,
} from "@/lib/types";

function PopoutContent() {
  const searchParams = useSearchParams();
  const widget = searchParams.get("widget") ?? "chart";

  const [watchlist, setWatchlist] = useStoredList("nse-lab.watchlist", DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState("RELIANCE");
  const [intervalMs, setIntervalMs] = useState(15_000);
  const [refreshToken, setRefreshToken] = useState(0);
  const [optionUnderlying, setOptionUnderlying] = useState("NIFTY");
  const [detail, setDetail] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowHeight, setWindowHeight] = useState(650);

  // Measure window height for full-screen chart sizing
  useEffect(() => {
    const updateSize = () => {
      setWindowHeight(window.innerHeight);
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    document.addEventListener("fullscreenchange", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      document.removeEventListener("fullscreenchange", updateSize);
    };
  }, []);

  // Listen to BroadcastChannel events from Monitor 1 or other windows
  useEffect(() => {
    return subscribeBroadcast((event) => {
      if (event.type === "SELECT_SYMBOL") {
        setSelected(event.symbol);
      } else if (event.type === "INTERVAL_CHANGE") {
        setIntervalMs(event.intervalMs);
      } else if (event.type === "REFRESH") {
        setRefreshToken((r) => r + 1);
      }
    });
  }, []);

  // When symbol is changed inside this popout window, broadcast back to Monitor 1
  const handleSelectSymbol = (symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    setSelected(clean);
    postBroadcast({ type: "SELECT_SYMBOL", symbol: clean });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  // Queries
  const quotesUrl = useMemo(
    () => `/api/market/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`,
    [watchlist],
  );

  const quotes = usePoll<Envelope<Quote[]>>(quotesUrl, intervalMs, refreshToken);
  const movers = usePoll<Envelope<Movers>>("/api/market/movers?count=12", Math.max(intervalMs, 30_000), refreshToken);
  const sectors = usePoll<Envelope<SectorPerf[]>>("/api/market/sectors", Math.max(intervalMs, 30_000), refreshToken);
  const flows = usePoll<Envelope<FiiDiiRow[]>>("/api/market/fii-dii", 300_000, refreshToken);
  const options = usePoll<Envelope<OptionChain>>(
    `/api/market/options?symbol=${optionUnderlying}`,
    60_000,
    refreshToken,
  );
  const news = usePoll<Envelope<NewsItem[]>>("/api/market/news?limit=12", 300_000, refreshToken);

  const quoteList = useMemo(() => quotes.data?.data ?? [], [quotes.data]);
  const detailQuote = detail ? quoteList.find((q) => q.symbol === detail) : undefined;

  const widgetTitles: Record<string, string> = {
    chart: "Price Chart & Technical Desk",
    watchlist: "Watchlist Desk",
    movers: "Market Movers & Radar",
    options: "Option Chain & Derivatives Matrix",
    sectors: "Sector Performance Heatmap",
    flows: "FII / DII Institutional Flows",
    news: "Live Financial News Wire",
  };

  const activeTitle = widgetTitles[widget] ?? "Terminal Widget";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-ink">
      {/* Sleek Popout Header Bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel/95 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Image
            src="/panimalar-crest.png"
            alt="Panimalar Crest"
            width={32}
            height={32}
            className="size-7 shrink-0 rounded-full"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide text-ink">
                {activeTitle}
              </h1>
              <span className="rounded bg-cyan/15 px-1.5 py-0.2 text-[9px] font-bold text-cyan">
                MONITOR 2
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-muted">
              <span className="size-1.5 rounded-full bg-up animate-pulse" />
              <span className="font-semibold text-up">LIVE SYNC ACTIVE</span>
              <span>· Target:</span>
              <span className="font-mono font-bold text-ink">{selected}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Symbol Switcher in Header */}
          <div className="hidden items-center gap-1.5 rounded-md border border-line bg-panel2/80 px-2 py-0.5 text-xs sm:flex">
            <span className="text-[10px] text-muted uppercase">Symbol:</span>
            <span className="font-mono font-bold text-cyan">{selected}</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (F11)"
            className="flex h-7 items-center gap-1 rounded-md border border-line bg-panel px-2 text-[10px] text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            <span>{isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen"}</span>
          </button>

          <ZoomToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Full-Size Body */}
      <main className="flex-1 overflow-auto p-3">
        {widget === "chart" && (
          <div className="h-full w-full">
            <PriceChart
              symbol={selected}
              intervalMs={intervalMs}
              height={Math.max(400, windowHeight - 165)}
              hidePopout={true}
              livePrice={quoteList.find((q) => q.symbol === selected)?.price}
            />
          </div>
        )}

        {widget === "watchlist" && (
          <div className="h-full w-full">
            <Watchlist
              quotes={quoteList}
              loading={quotes.loading}
              selected={selected}
              onSelect={handleSelectSymbol}
              onDetails={setDetail}
              watchlist={watchlist}
              onWatchlistChange={setWatchlist}
              badge={quotes.data ? <DataBadge status={quotes.data.status} source={quotes.data.source} /> : null}
            />
          </div>
        )}

        {widget === "movers" && (
          <div className="max-w-3xl mx-auto">
            <MoversPanel
              movers={movers.data?.data}
              loading={movers.loading}
              onSelect={handleSelectSymbol}
              badge={movers.data ? <DataBadge status={movers.data.status} source={movers.data.source} /> : null}
            />
          </div>
        )}

        {widget === "options" && (
          <div className="h-full w-full">
            <OptionChainPanel
              chain={options.data?.data}
              loading={options.loading}
              underlying={optionUnderlying}
              onUnderlyingChange={setOptionUnderlying}
              badge={options.data ? <DataBadge status={options.data.status} source={options.data.source} /> : null}
            />
          </div>
        )}

        {widget === "sectors" && (
          <div className="max-w-4xl mx-auto">
            <SectorHeatmap
              sectors={sectors.data?.data ?? []}
              loading={sectors.loading}
              badge={sectors.data ? <DataBadge status={sectors.data.status} source={sectors.data.source} /> : null}
            />
          </div>
        )}

        {widget === "flows" && (
          <div className="max-w-2xl mx-auto">
            <FiiDiiPanel
              rows={flows.data?.data ?? []}
              loading={flows.loading}
              badge={flows.data ? <DataBadge status={flows.data.status} source={flows.data.source} /> : null}
            />
          </div>
        )}

        {widget === "news" && (
          <div className="max-w-3xl mx-auto">
            <NewsFeed
              items={news.data?.data ?? []}
              loading={news.loading}
              badge={news.data ? <DataBadge status={news.data.status} source={news.data.source} /> : null}
            />
          </div>
        )}
      </main>

      {/* Stock Modal for Popout Window */}
      {detail ? (
        <StockModal
          symbol={detail}
          quote={detailQuote}
          intervalMs={intervalMs}
          onClose={() => setDetail(null)}
          onSelectSymbol={(sym) => {
            handleSelectSymbol(sym);
            setDetail(sym);
          }}
          inWatchlist={watchlist.includes(detail)}
          onToggleWatchlist={() => {
            if (watchlist.includes(detail)) {
              setWatchlist(watchlist.filter((s) => s !== detail));
            } else {
              setWatchlist([...watchlist, detail]);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export default function PopoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-bg text-muted font-mono text-xs">
          Loading Pop-Out Display...
        </div>
      }
    >
      <PopoutContent />
    </Suspense>
  );
}

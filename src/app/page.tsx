"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BreadthStrip } from "@/components/BreadthStrip";
import { FiiDiiPanel } from "@/components/FiiDiiPanel";
import { IndexStrip } from "@/components/IndexStrip";
import { KeyboardShortcutsHUD } from "@/components/KeyboardShortcutsHUD";
import { MarketLensDrawer } from "@/components/MarketLensDrawer";
import { LabModeDrawer } from "@/components/LabModeDrawer";
import { PaperTradingDrawer } from "@/components/PaperTradingDrawer";
import { SimulationController } from "@/components/SimulationController";
import { LabReportModal } from "@/components/LabReportModal";
import { postBroadcast, subscribeBroadcast } from "@/lib/broadcast";
import { MoversPanel } from "@/components/MoversPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { OptionChainPanel } from "@/components/OptionChainPanel";
import { PriceChart } from "@/components/PriceChart";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { SiteFooter } from "@/components/SiteFooter";
import { StockModal } from "@/components/StockModal";
import { TickerTape } from "@/components/TickerTape";
import { TopBar } from "@/components/TopBar";
import { Watchlist } from "@/components/Watchlist";
import { DataBadge } from "@/components/ui";
import { isMarketOpen } from "@/lib/marketHours";
import { DEFAULT_WATCHLIST } from "@/lib/symbols";
import { applyTheme } from "@/lib/theme";
import type {
  DataStatus,
  Envelope,
  FiiDiiRow,
  IndexQuote,
  MarketSession,
  Movers,
  NewsItem,
  OptionChain,
  Quote,
  SectorPerf,
} from "@/lib/types";
import type { SimulationPreset } from "@/lib/labTypes";
import { useNow, usePoll, useStoredList } from "@/lib/usePoll";

export default function Page() {
  const [watchlist, setWatchlist] = useStoredList("nse-lab.watchlist", DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState("RELIANCE");
  const [intervalMs, setIntervalMs] = useState(15_000);
  const [refreshToken, setRefreshToken] = useState(0);
  const [optionUnderlying, setOptionUnderlying] = useState("NIFTY");
  const [optionExpiry, setOptionExpiry] = useState<string>("");
  const [detail, setDetail] = useState<string | null>(null);
  const [dockBottomTicker, setDockBottomTicker] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [marketLensOpen, setMarketLensOpen] = useState(false);
  const [labModeOpen, setLabModeOpen] = useState(false);
  const [paperTradeOpen, setPaperTradeOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationPresetId, setSimulationPresetId] = useState("election-2024");
  // Last replay tick, mirrored out of SimulationController so the paper desk can
  // price fills on the simulated clock instead of wall time.
  const [simulationTick, setSimulationTick] = useState<{
    preset: SimulationPreset;
    progressPct: number;
  } | null>(null);

  const handleSimulateTick = useCallback((preset: SimulationPreset, progressPct: number) => {
    setSimulationTick((previous) =>
      previous && previous.preset === preset && Math.abs(previous.progressPct - progressPct) < 0.0001
        ? previous
        : { preset, progressPct },
    );
  }, []);

  const now = useNow(30_000);
  const marketOpen = now ? isMarketOpen(now) : false;

  const quotesUrl = useMemo(
    () => `/api/market/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`,
    [watchlist],
  );

  const quotes = usePoll<Envelope<Quote[]>>(quotesUrl, intervalMs, refreshToken);
  const indices = usePoll<Envelope<IndexQuote[]>>("/api/market/indices", intervalMs, refreshToken);
  const movers = usePoll<Envelope<Movers>>("/api/market/movers?count=12", Math.max(intervalMs, 30_000), refreshToken);
  const sectors = usePoll<Envelope<SectorPerf[]>>("/api/market/sectors", Math.max(intervalMs, 30_000), refreshToken);
  const flows = usePoll<Envelope<FiiDiiRow[]>>("/api/market/fii-dii", 300_000, refreshToken);
  const status = usePoll<Envelope<MarketSession[]>>("/api/market/status", 60_000, refreshToken);
  const options = usePoll<Envelope<OptionChain>>(
    `/api/market/options?symbol=${optionUnderlying}${optionExpiry ? `&expiry=${encodeURIComponent(optionExpiry)}` : ""}`,
    60_000,
    refreshToken,
  );
  const news = usePoll<Envelope<NewsItem[]>>("/api/market/news?limit=7", 300_000, refreshToken);

  const quoteList = useMemo(() => quotes.data?.data ?? [], [quotes.data]);
  const indexList = indices.data?.data ?? [];
  const nifty50 = indexList.find((index) => index.symbol === "NIFTY 50");
  const session = status.data?.data?.find((row) => row.market === "Capital Market") ?? status.data?.data?.[0];

  /** Ticker = watchlist quotes plus today's biggest movers, de-duplicated. */
  const tape = useMemo(() => {
    const seen = new Set<string>();
    const list: Quote[] = [];

    for (const quote of quoteList) {
      if (seen.has(quote.symbol)) continue;
      seen.add(quote.symbol);
      list.push(quote);
    }

    for (const mover of [...(movers.data?.data.gainers ?? []), ...(movers.data?.data.losers ?? [])]) {
      if (seen.has(mover.symbol)) continue;
      seen.add(mover.symbol);
      list.push({
        symbol: mover.symbol,
        name: mover.name,
        price: mover.price,
        change: mover.change,
        changePct: mover.changePct,
        open: mover.price,
        high: mover.price,
        low: mover.price,
        prevClose: mover.price - mover.change,
        volume: mover.volume,
      });
    }

    return list.slice(0, 26);
  }, [quoteList, movers.data]);

  const sources = useMemo(
    () =>
      [
        quotes.data?.source,
        indices.data?.source,
        movers.data?.source,
        sectors.data?.source,
        flows.data?.source,
        status.data?.source,
        options.data?.source,
        news.data?.source,
      ].filter((source): source is string => Boolean(source)),
    [quotes.data, indices.data, movers.data, sectors.data, flows.data, status.data, options.data, news.data],
  );

  /** Badge reflects the core market feeds, not the slow-moving side panels. */
  const dataStatus: DataStatus = useMemo(() => {
    const core = [quotes.data?.status, indices.data?.status, movers.data?.status];
    if (core.includes("demo")) return "demo";
    if (core.includes("delayed")) return "delayed";
    return "live";
  }, [quotes.data, indices.data, movers.data]);

  const lastUpdated = quotes.updatedAt ?? indices.updatedAt;

  const toggleWatchlist = useCallback(
    (symbol: string) => {
      setWatchlist((current) => {
        if (current.includes(symbol)) {
          return current.length > 1 ? current.filter((entry) => entry !== symbol) : current;
        }
        return [...current, symbol];
      });
    },
    [setWatchlist],
  );

  // Global Keyboard Shortcuts System
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      // '?' toggles the shortcut cheat sheet modal from anywhere
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }

      if (isTyping) return;

      // 1. Live Feed & Classroom Controls
      if (e.code === "Space") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nse:ticker-toggle-pause"));
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRefreshToken((t) => t + 1);
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        const intervals = [10_000, 15_000, 30_000, 60_000];
        const curIdx = intervals.indexOf(intervalMs);
        const prev = intervals[Math.max(0, curIdx - 1)];
        setIntervalMs(prev);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        const intervals = [10_000, 15_000, 30_000, 60_000];
        const curIdx = intervals.indexOf(intervalMs);
        const next = intervals[Math.min(intervals.length - 1, curIdx + 1)];
        setIntervalMs(next);
        return;
      }

      // 2. Watchlist Stepping
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (watchlist.length > 0) {
          const idx = watchlist.indexOf(selected);
          const next = watchlist[(idx + 1) % watchlist.length];
          setSelected(next);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (watchlist.length > 0) {
          const idx = watchlist.indexOf(selected);
          const prev = watchlist[(idx - 1 + watchlist.length) % watchlist.length];
          setSelected(prev);
        }
        return;
      }
      if (e.key === "Enter" && !detail) {
        e.preventDefault();
        setDetail(selected);
        return;
      }
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        toggleWatchlist(selected);
        return;
      }

      // 3. TradingView Charting Controls
      if (["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, string> = { "1": "1D", "2": "1W", "3": "1M", "4": "6M", "5": "1Y" };
        window.dispatchEvent(new CustomEvent("nse:chart-range", { detail: map[e.key] }));
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nse:chart-toggle-type"));
        return;
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nse:chart-toggle-vol"));
        return;
      }

      // 4. Display, Classroom Projector & UI Scale
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nse:cycle-zoom"));
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        const current = document.documentElement.dataset.theme;
        applyTheme(current === "light" ? "dark" : "light");
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setMarketLensOpen((open) => !open);
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setLabModeOpen((open) => !open);
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPaperTradeOpen((open) => !open);
        return;
      }
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        setReportModalOpen((open) => !open);
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setDockBottomTicker((d) => !d);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [watchlist, selected, detail, intervalMs, toggleWatchlist]);

  const handleSelectSymbol = (symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    setSelected(clean);
    postBroadcast({ type: "SELECT_SYMBOL", symbol: clean });
  };

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

  const detailQuote = detail ? quoteList.find((quote) => quote.symbol === detail) : undefined;

  return (
    <div className="min-h-screen pb-6">
      <TopBar
        dataStatus={dataStatus}
        sources={sources}
        marketOpen={marketOpen}
        session={session}
        intervalMs={intervalMs}
        onIntervalChange={setIntervalMs}
        onRefresh={() => setRefreshToken((value) => value + 1)}
        onSelect={handleSelectSymbol}
        onDetails={setDetail}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenMarketLens={() => setMarketLensOpen(true)}
        onOpenLabMode={() => setLabModeOpen(true)}
        onOpenPaperTrade={() => setPaperTradeOpen(true)}
        onOpenExport={() => setReportModalOpen(true)}
        simulationActive={simulationActive}
        onToggleSimulation={() => setSimulationActive((s) => !s)}
        updatedAt={lastUpdated}
      />

      <TickerTape
        quotes={tape}
        indices={indexList}
        onSelect={handleSelectSymbol}
        onDetails={setDetail}
        dockBottom={dockBottomTicker}
        onToggleDock={() => setDockBottomTicker((d) => !d)}
      />

      <main className={`mx-auto max-w-[1680px] space-y-2.5 px-4 py-3 ${dockBottomTicker ? "pb-16" : ""}`}>
        {dataStatus === "demo" ? (
          <div className="rounded-lg border border-accent/30 bg-accent/[0.08] px-3 py-1.5 text-[11px] text-accent">
            Live NSE feeds are unreachable right now — the built-in simulated dataset is shown so the lab
            demo keeps running. Check <span className="font-mono">/api/health</span> for details.
          </div>
        ) : null}

        <IndexStrip indices={indexList} loading={indices.loading} onSelect={handleSelectSymbol} />

        <BreadthStrip index={nifty50} />

        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-12">
          <div id="watchlist" className="min-w-0 xl:col-span-8">
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

          <div id="movers" className="min-w-0 xl:col-span-4">
            <MoversPanel
              movers={movers.data?.data}
              loading={movers.loading}
              onSelect={handleSelectSymbol}
              badge={movers.data ? <DataBadge status={movers.data.status} source={movers.data.source} /> : null}
            />
          </div>

          <div id="chart" className="min-w-0 xl:col-span-8">
            <PriceChart
              symbol={selected}
              intervalMs={intervalMs}
              livePrice={quoteList.find((q) => q.symbol === selected)?.price}
            />
          </div>

          <div id="fii-dii" className="min-w-0 xl:col-span-4 xl:self-start">
            <FiiDiiPanel
              rows={flows.data?.data ?? []}
              loading={flows.loading}
              badge={flows.data ? <DataBadge status={flows.data.status} source={flows.data.source} /> : null}
            />
          </div>

          <div id="sectors" className="min-w-0 xl:col-span-5">
            <SectorHeatmap
              sectors={sectors.data?.data ?? []}
              loading={sectors.loading}
              badge={sectors.data ? <DataBadge status={sectors.data.status} source={sectors.data.source} /> : null}
            />
          </div>

          <div id="options" className="min-w-0 xl:col-span-4">
            <OptionChainPanel
              chain={options.data?.data}
              loading={options.loading}
              underlying={optionUnderlying}
              onUnderlyingChange={(sym) => {
                setOptionUnderlying(sym);
                setOptionExpiry("");
              }}
              expiry={optionExpiry}
              onExpiryChange={setOptionExpiry}
              badge={options.data ? <DataBadge status={options.data.status} source={options.data.source} /> : null}
            />
          </div>

          <div id="news" className="min-w-0 xl:col-span-3">
            <NewsFeed
              items={news.data?.data ?? []}
              loading={news.loading}
              badge={news.data ? <DataBadge status={news.data.status} source={news.data.source} /> : null}
            />
          </div>
        </div>

        <SiteFooter
          lastUpdated={lastUpdated}
          watchlistCount={watchlist.length}
          replay={simulationActive ? simulationTick : null}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenLab={() => setLabModeOpen(true)}
          onOpenPaperDesk={() => setPaperTradeOpen(true)}
          onOpenReport={() => setReportModalOpen(true)}
        />
      </main>

      {detail ? (
        <StockModal
          symbol={detail}
          quote={detailQuote}
          intervalMs={intervalMs}
          onClose={() => setDetail(null)}
          onSelectSymbol={(sym) => {
            setSelected(sym);
            setDetail(sym);
          }}
          inWatchlist={watchlist.includes(detail)}
          onToggleWatchlist={() => toggleWatchlist(detail)}
        />
      ) : null}

      <KeyboardShortcutsHUD open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <MarketLensDrawer isOpen={marketLensOpen} onClose={() => setMarketLensOpen(false)} selectedSymbol={selected} />

      <LabModeDrawer
        isOpen={labModeOpen}
        onClose={() => setLabModeOpen(false)}
        onOpenPaperTrade={() => setPaperTradeOpen(true)}
        onOpenReport={() => setReportModalOpen(true)}
        onLaunchSimulation={(presetId) => {
          if (presetId) setSimulationPresetId(presetId);
          setSimulationActive(true);
        }}
      />

      <PaperTradingDrawer
        isOpen={paperTradeOpen}
        onClose={() => setPaperTradeOpen(false)}
        activeSymbol={selected}
        activeQuote={detailQuote || quoteList.find((q) => q.symbol === selected)}
        quotes={quoteList}
        feedStatus={simulationActive ? "demo" : dataStatus}
        replay={simulationActive ? simulationTick : null}
      />

      <LabReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        activeSymbol={selected}
      />

      <SimulationController
        isActive={simulationActive}
        initialPresetId={simulationPresetId}
        onClose={() => setSimulationActive(false)}
        onSimulateTick={handleSimulateTick}
      />
    </div>
  );
}

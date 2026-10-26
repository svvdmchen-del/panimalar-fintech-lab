"use client";

import { useMemo, useState } from "react";
import { compact, price, pct, toneClass } from "@/lib/format";
import { useSymbolSearch } from "@/lib/usePoll";
import type { Quote } from "@/lib/types";
import { Empty, Panel, RangeBar, Skeleton } from "./ui";

type SortKey = "symbol" | "price" | "changePct" | "volume";

const HEADERS: { id: string; label: string; align: string; visible: string; sortKey?: SortKey }[] = [
  { id: "symbol", label: "Symbol", align: "text-left", visible: "", sortKey: "symbol" },
  { id: "ltp", label: "LTP", align: "text-right", visible: "", sortKey: "price" },
  { id: "chg", label: "Chg %", align: "text-right", visible: "", sortKey: "changePct" },
  { id: "range", label: "Day range", align: "text-left", visible: "hidden md:table-cell" },
  { id: "volume", label: "Volume", align: "text-right", visible: "hidden lg:table-cell", sortKey: "volume" },
];

interface Row {
  symbol: string;
  quote?: Quote;
}

export function Watchlist({
  quotes,
  loading,
  selected,
  onSelect,
  onDetails,
  watchlist,
  onWatchlistChange,
  badge,
}: {
  quotes: Quote[];
  loading: boolean;
  selected: string;
  onSelect: (symbol: string) => void;
  onDetails: (symbol: string) => void;
  watchlist: string[];
  onWatchlistChange: (next: string[]) => void;
  badge?: React.ReactNode;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "changePct",
    direction: "desc",
  });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  /** Requested symbols drive the table, so a delisted ticker shows up as a gap instead of vanishing. */
  const rows = useMemo<Row[]>(() => {
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    const list: Row[] = watchlist.map((symbol) => ({ symbol, quote: bySymbol.get(symbol) }));

    list.sort((a, b) => {
      const direction = sort.direction === "asc" ? 1 : -1;
      if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol) * direction;
      if (!a.quote && !b.quote) return a.symbol.localeCompare(b.symbol);
      if (!a.quote) return 1;
      if (!b.quote) return -1;
      return ((a.quote[sort.key] ?? 0) - (b.quote[sort.key] ?? 0)) * direction;
    });

    return list;
  }, [quotes, watchlist, sort]);

  const missing = rows.filter((row) => !row.quote).length;

  const searchResults = useSymbolSearch(query, 8);
  const suggestions = useMemo(
    () => searchResults.filter((entry) => !watchlist.includes(entry.symbol)),
    [searchResults, watchlist],
  );

  const addSymbol = (symbol: string) => {
    const code = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9&-]{1,20}$/.test(code) || watchlist.includes(code)) {
      setQuery("");
      setOpen(false);
      return;
    }
    onWatchlistChange([...watchlist, code]);
    setQuery("");
    setOpen(false);
    onSelect(code);
  };

  const removeSymbol = (symbol: string) => {
    if (watchlist.length <= 1) return;
    onWatchlistChange(watchlist.filter((entry) => entry !== symbol));
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "symbol" ? "asc" : "desc" },
    );
  };

  return (
    <Panel
      title="Watchlist"
      subtitle={
        <>
          {watchlist.length} symbols · click a row to chart it
          {loading && !quotes.length ? (
            <span className="text-muted"> · loading quotes…</span>
          ) : missing > 0 ? (
            <span className="text-accent"> · {missing} without a quote</span>
          ) : null}
        </>
      }
      badge={badge}
      actions={
        <div className="relative">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (suggestions.length) addSymbol(suggestions[0].symbol);
              else if (query) addSymbol(query);
            }}
          >
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              placeholder="Add symbol…"
              aria-label="Add symbol to watchlist"
              className="w-28 rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-ink placeholder:text-muted/60 focus:w-36 focus:outline-none focus:ring-1 focus:ring-cyan/50 sm:w-32"
            />
          </form>

          {open && suggestions.length > 0 ? (
            <ul
              className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-panel2 shadow-2xl"
              role="listbox"
            >
              {suggestions.map((entry) => (
                <li key={entry.symbol}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addSymbol(entry.symbol)}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[11px] hover:bg-wash/5"
                  >
                    <span className="font-semibold text-ink">{entry.symbol}</span>
                    <span className="truncate text-[10px] text-muted">
                      {entry.name} · {entry.sector}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      }
      bodyClassName="overflow-x-auto"
    >
      {!rows.length ? (
        <Empty>Add a symbol to begin.</Empty>
      ) : !quotes.length && loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-muted">
              {HEADERS.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`px-3 py-2 font-medium ${header.align} ${header.visible}`}
                >
                  {header.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(header.sortKey as SortKey)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {header.label}
                      {sort.key === header.sortKey ? (
                        <span aria-hidden className="text-cyan">
                          {sort.direction === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    header.label
                  )}
                </th>
              ))}
              <th scope="col" className="w-8 px-1" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ symbol, quote }) => {
              const isSelected = selected === symbol;

              if (!quote) {
                return (
                  <tr key={symbol} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="block font-semibold text-muted">{symbol}</span>
                      <span className="block text-[10px] text-muted/60">no quote available</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-muted/60">—</td>
                    <td className="px-3 py-1.5 text-right font-mono text-muted/60">—</td>
                    <td className="hidden px-3 py-2 text-[10px] text-muted/50 md:table-cell">
                      Symbol may be renamed or delisted
                    </td>
                    <td className="hidden px-3 py-1.5 text-right font-mono text-muted/60 lg:table-cell">—</td>
                    <td className="group px-1 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeSymbol(symbol)}
                        aria-label={`Remove ${symbol} from watchlist`}
                        className="rounded p-1 text-muted/40 transition-colors hover:bg-down/10 hover:text-down"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={symbol}
                  onClick={() => onSelect(symbol)}
                  className={`group cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-wash/[0.035] ${
                    isSelected ? "bg-cyan/[0.06]" : ""
                  }`}
                >
                  <td className="relative px-3 py-1.5">
                    {isSelected ? (
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-cyan" aria-hidden />
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDetails(symbol);
                      }}
                      className="block max-w-[9.5rem] truncate text-left font-semibold text-ink hover:text-cyan sm:max-w-[13rem]"
                      title={`Open ${symbol} details`}
                    >
                      {symbol}
                    </button>
                    <span className="block max-w-[9.5rem] truncate text-[10px] text-muted sm:max-w-[13rem]">
                      {quote.name}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink">{price(quote.price)}</td>
                  <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${toneClass(quote.changePct)}`}>
                    <span className="block">{pct(quote.changePct)}</span>
                    <span className="block text-[10px] opacity-70">
                      {quote.change > 0 ? "+" : ""}
                      {quote.change.toFixed(2)}
                    </span>
                  </td>
                  <td className="hidden w-36 px-3 py-2 md:table-cell">
                    <RangeBar low={quote.low} high={quote.high} value={quote.price} prevClose={quote.prevClose} />
                  </td>
                  <td className="hidden px-3 py-1.5 text-right font-mono tabular-nums text-muted lg:table-cell">
                    {compact(quote.volume)}
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeSymbol(symbol);
                      }}
                      aria-label={`Remove ${symbol} from watchlist`}
                      className="rounded p-1 text-muted/0 transition-colors hover:bg-down/10 hover:text-down group-hover:text-muted focus:text-muted"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

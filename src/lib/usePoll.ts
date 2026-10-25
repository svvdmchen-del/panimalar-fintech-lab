"use client";

import { useCallback, useEffect, useState } from "react";

export interface PollState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  updatedAt?: number;
}

/**
 * Polling fetch with a self-rescheduling timer.
 *
 * The interval slows to once a minute while the tab is hidden, so a projector
 * left on a dashboard overnight does not hammer NSE.
 */
export function usePoll<T>(url: string | null, intervalMs: number, refreshToken = 0) {
  const [state, setState] = useState<PollState<T>>({ loading: Boolean(url) });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(load, delay);
    };

    async function load() {
      if (document.hidden) {
        schedule(Math.max(intervalMs, 60_000));
        return;
      }
      try {
        const response = await fetch(url as string, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as T;
        if (cancelled) return;
        setState({ data: payload, loading: false, updatedAt: Date.now() });
      } catch (error) {
        if (cancelled || (error as Error).name === "AbortError") return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        if (!cancelled) schedule(intervalMs);
      }
    }

    setState((previous) => ({ ...previous, loading: previous.data === undefined }));
    void load();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs, refreshToken, nonce]);

  return { ...state, refresh };
}

/** A ticking clock for the header, without re-rendering the whole tree. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    // Deferred so the first tick happens after mount (never during SSR/hydration).
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}

/** Local-storage backed symbol list (watchlist). */
export function useStoredList(key: string, fallback: string[]) {
  const [value, setValue] = useState<string[]>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred so hydration happens after the first paint, which also keeps the
    // server-rendered markup and the client's initial state in agreement.
    const hydrate = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
            if (clean.length) setValue(clean.slice(0, 24));
          }
        }
      } catch {
        // Corrupt storage should never break the dashboard.
      }
      setReady(true);
    }, 0);

    return () => clearTimeout(hydrate);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be disabled in a locked-down lab image.
    }
  }, [key, value, ready]);

  return [value, setValue, ready] as const;
}

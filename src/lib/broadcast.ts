"use client";

/**
 * Real-time inter-window synchronization across multiple monitors.
 * Uses the native browser BroadcastChannel API for zero-lag (<1ms) state sync.
 */

export type BroadcastEvent =
  | { type: "SELECT_SYMBOL"; symbol: string }
  | { type: "INTERVAL_CHANGE"; intervalMs: number }
  | { type: "REFRESH" }
  | { type: "THEME_CHANGE"; theme: "dark" | "light" };

const CHANNEL_NAME = "panimalar_fintech_multimonitor_channel";

export function postBroadcast(event: BroadcastEvent) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  } catch (err) {
    console.error("BroadcastChannel post error:", err);
  }
}

export function subscribeBroadcast(callback: (event: BroadcastEvent) => void): () => void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return () => {};
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e) => {
      if (e.data && typeof e.data === "object" && "type" in e.data) {
        callback(e.data as BroadcastEvent);
      }
    };
    return () => {
      channel.close();
    };
  } catch (err) {
    console.error("BroadcastChannel subscribe error:", err);
    return () => {};
  }
}

/**
 * Open any widget in an independent pop-out window sized and positioned for secondary monitors.
 */
export function openPopout(widgetId: string, title?: string) {
  if (typeof window === "undefined") return;
  const isLarge = widgetId === "chart" || widgetId === "options" || widgetId === "watchlist";
  const width = isLarge ? 1100 : 720;
  const height = isLarge ? 700 : 620;

  // Position relative to current screen
  const screenLeft = window.screenLeft ?? window.screenX ?? 0;
  const screenTop = window.screenTop ?? window.screenY ?? 0;
  const left = screenLeft + 60;
  const top = screenTop + 60;

  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const url = `/popout?widget=${encodeURIComponent(widgetId)}`;
  const win = window.open(url, `nse_popout_${widgetId}`, features);
  if (win) {
    win.focus();
  }
}

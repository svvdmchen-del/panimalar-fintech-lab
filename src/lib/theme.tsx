"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "nse-lab.theme";
const EVENT = "nse-lab:theme";

/**
 * Theme lives on <html data-theme> so the CSS tokens (and the pre-paint script in
 * layout.tsx) are the single source of truth — no React state to hydrate.
 */
function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be disabled in a locked-down lab image.
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#eef2f8" : "#05070b");

  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  const toggle = useCallback(() => applyTheme(readTheme() === "light" ? "dark" : "light"), []);

  return { theme, toggle } as const;
}

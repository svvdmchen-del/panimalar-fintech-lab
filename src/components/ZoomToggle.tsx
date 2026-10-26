"use client";

import { useEffect, useState } from "react";

const ZOOM_LEVELS = ["100%", "115%", "125%", "150%"] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

const STORAGE_KEY = "nse-lab.zoom";

export function ZoomToggle() {
  const [zoom, setZoom] = useState<ZoomLevel>("125%");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ZoomLevel | null;
      if (saved && ZOOM_LEVELS.includes(saved)) {
        setZoom(saved);
        document.documentElement.style.zoom = String(parseFloat(saved) / 100);
      } else {
        document.documentElement.style.zoom = "1.25";
      }
    } catch {
      document.documentElement.style.zoom = "1.25";
    }
  }, []);

  const cycleZoom = () => {
    setZoom((curr) => {
      const nextIndex = (ZOOM_LEVELS.indexOf(curr) + 1) % ZOOM_LEVELS.length;
      const nextZoom = ZOOM_LEVELS[nextIndex];
      const numericZoom = parseFloat(nextZoom) / 100;
      document.documentElement.style.zoom = String(numericZoom);
      try {
        localStorage.setItem(STORAGE_KEY, nextZoom);
      } catch {}
      return nextZoom;
    });
  };

  useEffect(() => {
    const onCycle = () => cycleZoom();
    window.addEventListener("nse:cycle-zoom", onCycle);
    return () => window.removeEventListener("nse:cycle-zoom", onCycle);
  }, []);

  return (
    <button
      type="button"
      onClick={cycleZoom}
      title={`Current UI scale: ${zoom}. Click to cycle (100%, 115%, 125%, 150%)`}
      aria-label="Adjust UI display scale"
      className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[10px] text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
    >
      <span className="text-[10px]" aria-hidden>
        🔍
      </span>
      <span>{zoom}</span>
    </button>
  );
}

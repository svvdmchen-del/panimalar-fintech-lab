"use client";

import { useEffect, useState, useMemo } from "react";
import { SIMULATION_PRESETS } from "@/lib/simulationData";
import type { SimulationPreset } from "@/lib/labTypes";

// Minutes from 09:15 to 15:30 = 375 minutes
const START_MINUTES = 9 * 60 + 15; // 555
const END_MINUTES = 15 * 60 + 30; // 930
const TOTAL_MINUTES = END_MINUTES - START_MINUTES; // 375

export function SimulationController({
  isActive,
  initialPresetId = "election-2024",
  onClose,
  onSimulateTick,
}: {
  isActive: boolean;
  initialPresetId?: string;
  onClose: () => void;
  onSimulateTick?: (preset: SimulationPreset, progressPct: number, simTimeStr: string) => void;
}) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPresetId);
  const [currentMinute, setCurrentMinute] = useState<number>(START_MINUTES);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(5); // 1x, 5x, 10x, 30x
  const [showStats, setShowStats] = useState<boolean>(true);

  // Sync initial preset
  useEffect(() => {
    if (initialPresetId) {
      setSelectedPresetId(initialPresetId);
      setCurrentMinute(START_MINUTES);
      setIsPlaying(true);
    }
  }, [initialPresetId]);

  const preset = useMemo(
    () => SIMULATION_PRESETS.find((p) => p.id === selectedPresetId) || SIMULATION_PRESETS[0],
    [selectedPresetId],
  );

  // Playback timer
  useEffect(() => {
    if (!isActive || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentMinute((prev) => {
        if (prev >= END_MINUTES) {
          setIsPlaying(false);
          return END_MINUTES;
        }
        return Math.min(END_MINUTES, prev + 1);
      });
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isActive, isPlaying, speed]);

  // Current formatted time (HH:MM IST)
  const currentHour = Math.floor(currentMinute / 60);
  const currentMin = currentMinute % 60;
  const simTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")} IST`;
  const progressPct = ((currentMinute - START_MINUTES) / TOTAL_MINUTES) * 100;

  // Calculate simulated intraday Nifty price based on session curve
  const simulatedNiftyPrice = useMemo(() => {
    const fraction = progressPct / 100;
    // Morning volatility dip towards low at midday, partial recovery towards close
    if (fraction < 0.5) {
      // 09:15 to 12:22
      return preset.niftyOpen + (preset.niftyLow - preset.niftyOpen) * (fraction * 2);
    } else {
      // 12:22 to 15:30
      return preset.niftyLow + (preset.niftyClose - preset.niftyLow) * ((fraction - 0.5) * 2);
    }
  }, [progressPct, preset]);

  // Trigger tick callback
  useEffect(() => {
    if (isActive && onSimulateTick) {
      onSimulateTick(preset, progressPct, simTimeStr);
    }
  }, [isActive, preset, progressPct, simTimeStr, onSimulateTick]);

  if (!isActive) return null;

  return (
    <div
      role="region"
      aria-label="Historical Event Playback Controller"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-accent/40 bg-panel/95 backdrop-blur-md shadow-2xl animate-[slideUp_200ms_ease-out]"
    >
      <div className="mx-auto max-w-[1680px] px-4 py-2.5">
        {/* Top Mini Header: Preset selector & Macro catalyst */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 items-center gap-1.5 rounded-full border border-accent/50 bg-accent/20 px-2 text-[10px] font-bold uppercase tracking-wider text-accent animate-pulse-soft">
              <span className="size-1.5 rounded-full bg-accent" />
              REPLAY ARCHIVE ACTIVE
            </span>

            <select
              value={selectedPresetId}
              onChange={(e) => {
                setSelectedPresetId(e.target.value);
                setCurrentMinute(START_MINUTES);
                setIsPlaying(true);
              }}
              className="rounded-md border border-line bg-panel2 px-2.5 py-1 font-semibold text-xs text-ink focus:border-accent focus:outline-none"
            >
              {SIMULATION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowStats((s) => !s)}
              className="rounded border border-line bg-panel2/60 px-2 py-0.5 text-[10px] text-muted hover:text-ink"
            >
              {showStats ? "Hide Snapshot" : "Show Snapshot"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden font-mono text-[11px] sm:flex items-center gap-2">
              <span className="text-muted">Simulated NIFTY:</span>
              <span className="font-bold text-ink">
                ₹{simulatedNiftyPrice.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </span>
              <span
                className={`font-semibold ${
                  simulatedNiftyPrice >= preset.niftyOpen ? "text-up" : "text-down"
                }`}
              >
                ({(((simulatedNiftyPrice - preset.niftyOpen) / preset.niftyOpen) * 100).toFixed(2)}%)
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent/20 transition-colors"
            >
              Return to Live Feed ✕
            </button>
          </div>
        </div>

        {/* Extended Flash Stats Drawer */}
        {showStats ? (
          <div className="grid grid-cols-2 gap-2 border-y border-line/60 bg-panel2/40 py-2 sm:grid-cols-5 font-mono text-center mb-2">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted block">
                Session Range
              </span>
              <span className="text-xs font-semibold text-ink">
                L: {preset.niftyLow} — H: {preset.niftyHigh}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted block">
                India VIX Peak
              </span>
              <span className="text-xs font-bold text-accent">{preset.vixPeak}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted block">
                FII Net Flow
              </span>
              <span
                className={`text-xs font-bold ${
                  preset.fiiFlow >= 0 ? "text-up" : "text-down"
                }`}
              >
                {preset.fiiFlow >= 0 ? "+" : ""}
                {preset.fiiFlow.toLocaleString("en-IN")} Cr
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted block">
                DII Net Flow
              </span>
              <span
                className={`text-xs font-bold ${
                  preset.diiFlow >= 0 ? "text-up" : "text-down"
                }`}
              >
                {preset.diiFlow >= 0 ? "+" : ""}
                {preset.diiFlow.toLocaleString("en-IN")} Cr
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[9px] uppercase tracking-wider text-muted block">
                Catalyst Sector
              </span>
              <span className="text-xs font-semibold text-cyan truncate block px-1">
                {preset.keySector}
              </span>
            </div>
          </div>
        ) : null}

        {/* Timeline Scrubber & Playback Controls Bar */}
        <div className="flex items-center gap-3">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-sm transition-all ${
              isPlaying ? "bg-accent hover:bg-accent/80" : "bg-up hover:bg-up/80"
            }`}
            title={isPlaying ? "Pause playback" : "Resume playback"}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>

          {/* Jump to Start / End */}
          <button
            type="button"
            onClick={() => setCurrentMinute(START_MINUTES)}
            className="rounded border border-line bg-panel2 px-2 py-1 text-xs text-muted hover:text-ink"
            title="Rewind to 09:15 Opening Bell"
          >
            09:15
          </button>

          {/* Scrubber Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-ink w-16 text-right">
              {simTimeStr}
            </span>
            <input
              type="range"
              min={START_MINUTES}
              max={END_MINUTES}
              value={currentMinute}
              onChange={(e) => {
                setCurrentMinute(Number(e.target.value));
              }}
              className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="font-mono text-[10px] text-muted">15:30</span>
          </div>

          {/* Speed Multiplier */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <span className="text-[10px] text-muted hidden md:inline">Speed:</span>
            {[1, 5, 10, 30].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-all ${
                  speed === s
                    ? "bg-cyan text-black"
                    : "border border-line bg-panel2 text-muted hover:text-ink"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

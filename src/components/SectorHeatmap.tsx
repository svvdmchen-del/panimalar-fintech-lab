"use client";

import { num, pct } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import type { SectorPerf } from "@/lib/types";
import { Panel, Skeleton } from "./ui";

function tileBackground(changePct: number, theme: "dark" | "light"): string {
  const clamped = Math.max(-3.5, Math.min(3.5, changePct));
  const weight = Math.abs(clamped) / 3.5;
  // Light mode needs much less alpha: the same tint on white looks neon.
  const intensity =
    theme === "light" ? Math.min(0.46, 0.1 + weight * 0.38) : Math.min(0.62, 0.1 + weight * 0.55);
  const base = theme === "light" ? (clamped >= 0 ? "10, 143, 91" : "207, 37, 66") : clamped >= 0 ? "22, 212, 136" : "255, 77, 106";
  return `rgba(${base}, ${intensity})`;
}

export function SectorHeatmap({
  sectors,
  loading,
  badge,
}: {
  sectors: SectorPerf[];
  loading: boolean;
  badge?: React.ReactNode;
}) {
  const advancing = sectors.filter((sector) => sector.changePct > 0).length;
  const { theme } = useTheme();

  return (
    <Panel
      title="Sector heat-map"
      subtitle={
        sectors.length
          ? `${advancing} of ${sectors.length} sectors up`
          : "Sectoral indices"
      }
      badge={badge}
      bodyClassName="p-2.5"
    >
      {!sectors.length && loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {sectors.map((sector) => (
              <div
                key={sector.name}
                title={`${sector.name}: ${num(sector.last)} (${pct(sector.changePct)})`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-line/60 p-2 transition-transform duration-150 hover:z-10 hover:scale-[1.03]"
                style={{ backgroundColor: tileBackground(sector.changePct, theme) }}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink/85">
                    {sector.short}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink/60">
                    {num(sector.last, 0)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-ink">
                  {pct(sector.changePct)}
                </div>
                <div className="mt-1.5 flex h-0.5 overflow-hidden rounded-full bg-black/25">
                  <span
                    className="bg-up/80"
                    style={{
                      width: `${(sector.advances / Math.max(1, sector.advances + sector.declines)) * 100}%`,
                    }}
                  />
                  <span className="flex-1 bg-down/80" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between px-0.5 text-[9px] uppercase tracking-wider text-muted/60">
            <span>−3%</span>
            <div className="mx-2 h-1 flex-1 rounded-full bg-gradient-to-r from-down/70 via-line-strong to-up/70" />
            <span>+3%</span>
          </div>
        </>
      )}
    </Panel>
  );
}

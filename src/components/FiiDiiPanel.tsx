"use client";

import { num, signed, toneClass } from "@/lib/format";
import type { FiiDiiRow, FlowLeg } from "@/lib/types";
import { Empty, Panel, Skeleton } from "./ui";

function NetBar({ value, max }: { value: number; max: number }) {
  const width = Math.min(50, (Math.abs(value) / max) * 50);
  const positive = value >= 0;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-track/35" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-track" />
      <span
        className={`absolute inset-y-0 ${positive ? "left-1/2 rounded-r-full bg-up/80" : "right-1/2 rounded-l-full bg-down/80"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function BuySellBar({ leg }: { leg: FlowLeg }) {
  const total = leg.buy + leg.sell || 1;
  return (
    <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-track/30" aria-hidden>
      <span className="bg-cyan/60" style={{ width: `${(leg.buy / total) * 100}%` }} />
      <span className="flex-1 bg-down/25" />
    </div>
  );
}

function CategoryRow({ label, leg }: { label: string; leg: FlowLeg }) {
  return (
    <div className="rounded-lg border border-line/60 bg-panel2/40 px-2.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className={`font-mono text-[12px] tabular-nums ${toneClass(leg.net)}`}>
          {signed(leg.net, 0)} Cr
        </span>
      </div>
      <BuySellBar leg={leg} />
      <div className="mt-1 flex items-baseline justify-between font-mono text-[9px] tabular-nums text-muted/80">
        <span>Buy {num(leg.buy, 0)}</span>
        <span>Sell {num(leg.sell, 0)}</span>
      </div>
    </div>
  );
}

export function FiiDiiPanel({
  rows,
  loading,
  badge,
}: {
  rows: FiiDiiRow[];
  loading: boolean;
  badge?: React.ReactNode;
}) {
  const latest = rows[0];
  const recent = rows.slice(0, 5);
  const max = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.fii.net), Math.abs(row.dii.net)]));

  return (
    <Panel title="FII / DII flows" popoutWidget="flows" subtitle="₹ crore, cash market" badge={badge} bodyClassName="p-2.5">
      {!rows.length && loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <Empty>Institutional flow data unavailable.</Empty>
      ) : (
        <>
          <div className="flex h-full flex-col">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-line/70 bg-panel2/60 px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted">FII net · latest</div>
                <div className={`font-mono text-base tabular-nums ${toneClass(latest.fii.net)}`}>
                  {signed(latest.fii.net, 0)} Cr
                </div>
              </div>
              <div className="rounded-lg border border-line/70 bg-panel2/60 px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted">DII net · latest</div>
                <div className={`font-mono text-base tabular-nums ${toneClass(latest.dii.net)}`}>
                  {signed(latest.dii.net, 0)} Cr
                </div>
              </div>
            </div>

            {rows.length === 1 ? (
              <div className="mt-2 flex flex-1 flex-col">
                <div className="flex items-baseline justify-between px-0.5 text-[9px] uppercase tracking-wider text-muted/70">
                  <span>Session detail</span>
                  <span className="font-mono normal-case tracking-normal">{latest.date}</span>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  <CategoryRow label="FII / FPI" leg={latest.fii} />
                  <CategoryRow label="DII" leg={latest.dii} />
                </div>
                <p className="mt-auto px-0.5 pt-2 text-[9px] leading-snug text-muted/50">
                  NSE publishes the latest session only. Values are provisional.
                </p>
              </div>
            ) : (
              <div className="mt-2.5 space-y-1.5">
                {recent.map((row) => (
                  <div key={row.date} className="rounded-md px-1 py-1 transition-colors hover:bg-wash/[0.03]">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="font-mono text-[10px] text-muted">{row.date}</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted/50">
                        net {signed(row.fii.net + row.dii.net, 0)} Cr
                      </span>
                    </div>
                    <div className="grid grid-cols-[2.1rem_1fr_3.4rem] items-center gap-1.5">
                      <span className="text-[9px] font-semibold tracking-wider text-muted">FII</span>
                      <NetBar value={row.fii.net} max={max} />
                      <span className={`text-right font-mono text-[10px] tabular-nums ${toneClass(row.fii.net)}`}>
                        {num(row.fii.net, 0)}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-[2.1rem_1fr_3.4rem] items-center gap-1.5">
                      <span className="text-[9px] font-semibold tracking-wider text-muted">DII</span>
                      <NetBar value={row.dii.net} max={max} />
                      <span className={`text-right font-mono text-[10px] tabular-nums ${toneClass(row.dii.net)}`}>
                        {num(row.dii.net, 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CASE_STUDIES, LAB_ACTIVITIES } from "@/lib/caseStudiesData";
import { simClockLabel } from "@/lib/desk/replay";
import { gradedTrades } from "@/lib/desk/report";
import {
  ANSWERS_EVENT,
  loadDeskState,
  readLabAnswers,
  resetDesk,
  UPDATE_EVENT,
} from "@/lib/desk/store";
import type { DeskState } from "@/lib/desk/types";
import { formatDuration, ms, timeIST, weekdayIST } from "@/lib/format";
import type { SimulationPreset } from "@/lib/labTypes";
import { isMarketOpen, sessionLabel } from "@/lib/marketHours";
import type { HealthReport } from "@/lib/types";
import { useNow, usePoll } from "@/lib/usePoll";

interface SiteFooterProps {
  /** Last successful print, used while the exchange is closed. */
  lastUpdated?: number;
  watchlistCount: number;
  replay: { preset: SimulationPreset; progressPct: number } | null;
  onOpenShortcuts: () => void;
  onOpenLab: () => void;
  onOpenPaperDesk: () => void;
  onOpenReport: () => void;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const SOURCE_LABEL: Record<string, string> = {
  "NSE direct endpoints": "NSE",
  "MCP server": "MCP",
  "Yahoo Finance": "Yahoo",
  "Market news RSS": "News",
};

const SECTION_LABEL =
  "text-[9px] font-bold uppercase tracking-[0.14em] text-muted";

interface SessionBoundary {
  at: number;
  kind: "open" | "close";
}

/** Next 09:15 open or 15:30 close, computed in IST without a date library. */
function nextBoundary(date: Date): SessionBoundary {
  const wall = new Date(date.getTime() + IST_OFFSET_MS);
  const day = wall.getUTCDay();
  const minutes = wall.getUTCHours() * 60 + wall.getUTCMinutes();
  const at = (addDays: number, hour: number, minute: number) =>
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + addDays, hour, minute) -
    IST_OFFSET_MS;

  if (day === 6) return { at: at(2, 9, 15), kind: "open" };
  if (day === 0) return { at: at(1, 9, 15), kind: "open" };
  if (minutes < 9 * 60 + 15) return { at: at(0, 9, 15), kind: "open" };
  if (minutes <= 15 * 60 + 30) return { at: at(0, 15, 30), kind: "close" };
  return { at: at(day === 5 ? 3 : 1, 9, 15), kind: "open" };
}

function countdownText(remainingMs: number): string {
  if (remainingMs <= 0) return "0s";
  const hours = Math.floor(remainingMs / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return formatDuration(remainingMs);
}

function answered(value?: string): boolean {
  return Boolean(value && value.trim());
}

function ReadinessTile({
  label,
  value,
  fraction,
  done,
  hint,
}: {
  label: string;
  value: string;
  fraction: number;
  done: boolean;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel/60 px-2.5 py-1.5" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-muted">{label}</span>
        <span className={`shrink-0 font-mono text-[10px] ${done ? "text-up" : "text-ink"}`}>{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-track/60">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${done ? "bg-up" : "bg-cyan"}`}
          style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SiteFooter({
  lastUpdated,
  watchlistCount,
  replay,
  onOpenShortcuts,
  onOpenLab,
  onOpenPaperDesk,
  onOpenReport,
}: SiteFooterProps) {
  const now = useNow(1000);
  const health = usePoll<HealthReport>("/api/health", 120_000);
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(() => {
    setDesk(loadDeskState());
    setAnswers(readLabAnswers());
  }, []);

  // The desk and the lab drawer both write to localStorage; a custom event
  // covers same-tab writes, `storage` covers a second tab on the projector.
  useEffect(() => {
    const onUpdate = () => refresh();
    // Deferred so the first read happens after mount (never during hydration).
    const first = setTimeout(onUpdate, 0);
    window.addEventListener(UPDATE_EVENT, onUpdate);
    window.addEventListener(ANSWERS_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      clearTimeout(first);
      window.removeEventListener(UPDATE_EVENT, onUpdate);
      window.removeEventListener(ANSWERS_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [refresh]);

  const activityTotal = LAB_ACTIVITIES.reduce((sum, activity) => sum + activity.questions.length, 0);
  const activityAnswered = LAB_ACTIVITIES.reduce(
    (sum, activity) =>
      sum + activity.questions.filter((question) => answered(answers[activity.id]?.[question.id])).length,
    0,
  );
  const activityDone = LAB_ACTIVITIES.filter((activity) =>
    activity.questions.every((question) => answered(answers[activity.id]?.[question.id])),
  ).length;

  const caseTotal = CASE_STUDIES.reduce((sum, study) => sum + study.guidedQuestions.length, 0);
  const caseAnswered = CASE_STUDIES.reduce(
    (sum, study) =>
      sum + study.guidedQuestions.filter((question) => answered(answers[study.id]?.[question.id])).length,
    0,
  );
  const caseDone = CASE_STUDIES.filter((study) =>
    study.guidedQuestions.every((question) => answered(answers[study.id]?.[question.id])),
  ).length;

  const trades = desk ? gradedTrades(desk.history) : [];
  const openPositions = desk?.positions.length ?? 0;

  const gates = [
    {
      key: "activities",
      label: "Part 1 · Activities",
      value: `${activityDone}/${LAB_ACTIVITIES.length}`,
      fraction: activityTotal ? activityAnswered / activityTotal : 0,
      done: activityDone === LAB_ACTIVITIES.length,
      hint: `${activityAnswered} of ${activityTotal} activity answers saved`,
    },
    {
      key: "cases",
      label: "Part 2 · Case studies",
      value: `${caseDone}/${CASE_STUDIES.length}`,
      fraction: caseTotal ? caseAnswered / caseTotal : 0,
      done: caseDone === CASE_STUDIES.length,
      hint: `${caseAnswered} of ${caseTotal} case-study answers saved`,
    },
    {
      key: "journal",
      label: "Part 3 · Graded journal",
      value: trades.length ? `${trades.length} live` : "0",
      fraction: trades.length ? 1 : 0,
      done: trades.length > 0,
      hint: `${trades.length} closed LIVE paper trade${trades.length === 1 ? "" : "s"} — replay fills excluded`,
    },
  ];
  const gatesMet = gates.filter((gate) => gate.done).length;
  const overallPct = Math.round(
    (gates.reduce((sum, gate) => sum + Math.min(1, gate.fraction), 0) / gates.length) * 100,
  );

  const missingAnswers = activityTotal - activityAnswered + (caseTotal - caseAnswered);
  const pending: string[] = [];
  if (missingAnswers > 0) pending.push(`${missingAnswers} answer${missingAnswers === 1 ? "" : "s"}`);
  if (!trades.length) pending.push("one graded trade");

  let context: string;
  if (!desk) {
    context = "Reading this browser's saved lab session…";
  } else if (replay) {
    context = `Replay · ${replay.preset.title} at ${simClockLabel(replay.progressPct)} — replay fills stay in their own ledger and never enter the graded PDF.`;
  } else if (gatesMet === gates.length) {
    context = "All three submission gates met — open Report to review, sign and download the graded PDF.";
  } else if (gatesMet === 0) {
    context = "Fresh session — answer a lab activity or place a paper trade to start the submission trail.";
  } else {
    context = `Still pending: ${pending.join(" and ")} before this session is submission-ready.`;
  }

  const marketLive = now ? isMarketOpen(now) : false;
  const boundary = now ? nextBoundary(now) : null;
  const untilBoundary = boundary && now ? Math.max(0, boundary.at - now.getTime()) : 0;
  const session = now ? sessionLabel(now) : "Session";

  const clockDot = marketLive
    ? "bg-up animate-pulse"
    : session === "Auction" || session === "Pre-open"
      ? "bg-accent"
      : "bg-muted";

  const checks = health.data?.checks ?? [];
  const failingChecks = checks.filter((check) => !check.ok).length;
  const nothingToReset = !desk || (openPositions === 0 && trades.length === 0);

  return (
    <footer className="mt-6 overflow-hidden rounded-xl border border-line bg-panel2/70 pb-8 text-xs shadow-xs backdrop-blur-sm">
      {/* Tier 1 — institutional identity and live session clock */}
      <div className="flex flex-col gap-3 border-b border-line/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <Image
            src="/panimalar-crest.png"
            alt="Panimalar Engineering College Crest"
            width={64}
            height={64}
            className="size-8 shrink-0 rounded-full object-contain ring-1 ring-line/80 shadow-xs"
          />
          <div className="leading-tight">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black tracking-wider text-ink uppercase">
                Panimalar Engineering College
              </span>
              <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan uppercase tracking-wider font-mono">
                MBA FinTech Lab
              </span>
            </div>
            <div className="text-[11px] text-muted pt-0.5">
              Curated &amp; Directed by <span className="font-semibold text-ink">Dr. S. Satheeshkumar</span> · Department of Management Studies
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-ink"
            title={
              lastUpdated
                ? `NSE cash session 09:15–15:30 IST · last print ${timeIST(lastUpdated, true)} IST`
                : "NSE cash session 09:15–15:30 IST"
            }
          >
            <span className={`size-1.5 rounded-full ${clockDot}`} aria-hidden />
            <span className="tabular-nums">{now ? timeIST(now, true) : "--:--:--"}</span>
            <span className="text-[10px] text-muted">IST</span>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <span className="text-muted">{session}</span>
          </span>

          {boundary ? (
            <span
              className="rounded-md border border-line bg-panel px-2.5 py-1 text-muted"
              title={
                boundary.kind === "close"
                  ? "NSE cash market closes at 15:30 IST"
                  : `NSE cash market opens ${weekdayIST(boundary.at)} at ${timeIST(boundary.at)} IST`
              }
            >
              {boundary.kind === "close" ? "Closes in" : `Opens ${weekdayIST(boundary.at)} ·`}{" "}
              <span className="tabular-nums text-ink">{countdownText(untilBoundary)}</span>
            </span>
          ) : null}

          <span
            className="rounded-md border border-line bg-panel px-2.5 py-1 text-muted"
            title="Active instruments on the monitored watchlist"
          >
            {watchlistCount} watched
          </span>
        </div>
      </div>

      {/* Tier 2 — submission readiness */}
      <div className="border-b border-line/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={SECTION_LABEL}>Submission readiness</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                gatesMet === gates.length
                  ? "border-up/40 bg-up/10 text-up"
                  : gatesMet > 0
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line bg-panel text-muted"
              }`}
            >
              <span
                className={`size-1 rounded-full ${
                  gatesMet === gates.length ? "bg-up" : gatesMet > 0 ? "bg-accent" : "bg-muted"
                }`}
                aria-hidden
              />
              {gatesMet}/{gates.length} gates met
            </span>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted">{overallPct}% complete</span>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {gates.map((gate) => (
            <ReadinessTile
              key={gate.key}
              label={gate.label}
              value={gate.value}
              fraction={gate.fraction}
              done={gate.done}
              hint={gate.hint}
            />
          ))}
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-muted">{context}</p>
      </div>

      {/* Tier 3 — local session summary and source health */}
      <div className="grid gap-3 border-b border-line/60 px-4 py-3 sm:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={SECTION_LABEL}>This browser session</span>
            {replay ? (
              <span
                className="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent"
                title={`Replay preset: ${replay.preset.title} (${replay.preset.dateStr})`}
              >
                Replay ledger
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-muted">
            <span>
              <strong className="font-semibold text-ink">{openPositions}</strong> open
            </span>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <span>
              <strong className="font-semibold text-ink">{trades.length}</strong> closed graded
            </span>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <span title="Positions, journal and replay ledgers live in this browser only">
              saved locally
            </span>
          </div>

          {confirmReset ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              <span className="text-down">
                Clear {openPositions} open and {trades.length} graded? Answers and student details stay.
              </span>
              <button
                type="button"
                onClick={() => {
                  resetDesk();
                  setConfirmReset(false);
                }}
                className="rounded border border-down/50 bg-down/10 px-2 py-0.5 font-semibold text-down transition-colors hover:bg-down/20"
              >
                Clear desk
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded border border-line px-2 py-0.5 text-muted transition-colors hover:text-ink"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={nothingToReset}
              title={
                nothingToReset
                  ? "Nothing to clear in this browser yet"
                  : "Clear open positions, the trade journal and replay ledgers from this browser"
              }
              className="mt-2 rounded border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-down/50 hover:text-down disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
            >
              Reset local desk
            </button>
          )}
        </div>

        <div className="sm:border-l sm:border-line/60 sm:pl-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={SECTION_LABEL}>Source health</span>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-muted transition-colors hover:text-cyan"
              title="Open the raw API health report"
            >
              details ↗
            </a>
          </div>

          {checks.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
              {checks.map((check) => (
                <a
                  key={check.name}
                  href="/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
                  title={`${check.name}: ${check.ok ? "healthy" : "failing"} · ${check.detail} · ${ms(check.ms)}`}
                  aria-label={`${check.name} ${check.ok ? "healthy" : "failing"}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${check.ok ? "bg-up" : "bg-down"}`}
                    aria-hidden
                  />
                  {SOURCE_LABEL[check.name] ?? check.name}
                </a>
              ))}
              <span className="text-muted/70">
                {failingChecks ? `${failingChecks} failing` : "all responding"}
                {health.updatedAt ? ` · ${timeIST(health.updatedAt, true)}` : ""}
              </span>
            </div>
          ) : health.error ? (
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 block text-[10px] text-down hover:underline"
            >
              Health probe unreachable — open details ↗
            </a>
          ) : (
            <span className="mt-1.5 block text-[10px] text-muted">Probing NSE, MCP, Yahoo and news…</span>
          )}
        </div>
      </div>

      {/* Tier 4 — disclosure, utilities and legal */}
      <div className="px-4 pt-3">
        <details className="group rounded-lg border border-line bg-panel/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-[10px] text-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-wider text-ink/80">
              Academic sandbox
            </span>
            <span>Not SEBI registered · disclosure</span>
            <span
              className="ml-auto text-[10px] text-muted transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <p className="border-t border-line/60 px-3 py-2 text-[10px] leading-relaxed text-muted">
            <strong className="font-semibold text-ink/80">Academic sandbox:</strong> live endpoints and
            paper execution are strictly designed for MBA classroom demonstration and quantitative
            research. Not registered with SEBI as an investment adviser or research analyst. Sources:
            NSE India public endpoints, MCP server (<span className="font-mono">india-stock-mcp</span>),
            Yahoo Finance and public market-news RSS.
          </p>
        </details>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <nav
            aria-label="Desk utilities"
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted"
          >
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="text-ink/75 underline decoration-line/80 underline-offset-2 transition-colors hover:text-cyan"
              title="Keyboard shortcuts cheat sheet"
            >
              Shortcuts (?)
            </button>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={onOpenLab}
              className="text-ink/75 transition-colors hover:text-cyan"
              title="Open Classroom Interactive Challenges"
            >
              Lab Challenges (E)
            </button>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={onOpenPaperDesk}
              className="text-ink/75 transition-colors hover:text-cyan"
              title="Open Virtual Paper Trading Desk"
            >
              Paper Desk (P)
            </button>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={onOpenReport}
              className="font-medium text-cyan transition-colors hover:text-cyan/80"
              title="Download / submit the lab assignment report"
            >
              Report (X)
            </button>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <span className="text-muted/60">© 2025–2027 Panimalar</span>
          </nav>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="self-start rounded border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-cyan hover:text-cyan sm:self-auto"
            title="Back to the top of the dashboard"
          >
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CASE_STUDIES, LAB_ACTIVITIES } from "@/lib/caseStudiesData";
import { presetById, simClockLabel } from "@/lib/desk/replay";
import { gradedTrades } from "@/lib/desk/report";
import {
  ANSWERS_EVENT,
  listReplayLedgers,
  loadDeskState,
  readLabAnswers,
  resetDesk,
  UPDATE_EVENT,
  type ReplayLedgerSummary,
} from "@/lib/desk/store";
import type { DeskState } from "@/lib/desk/types";
import { formatDuration, integer, ms, signed, timeIST, weekdayIST } from "@/lib/format";
import type { SimulationPreset, StudentProfile } from "@/lib/labTypes";
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
  onOpenLabAt: (groupId: string) => void;
  onOpenPaperDesk: () => void;
  onOpenReport: () => void;
}

type FooterPanel = "readiness" | "session" | "sources";

const PANEL_ID: Record<FooterPanel, string> = {
  readiness: "footer-panel-readiness",
  session: "footer-panel-session",
  sources: "footer-panel-sources",
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const SECTION_LABEL = "text-[9px] font-bold uppercase tracking-[0.14em] text-muted";
const PROFILE_KEY = "nse-lab.student-profile";

function pillClass(active: boolean): string {
  return `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors ${
    active
      ? "border-cyan/60 bg-cyan/10 text-cyan"
      : "border-line bg-panel text-muted hover:border-cyan/50 hover:text-ink"
  }`;
}

const PRIMARY_BUTTON =
  "rounded-md border border-cyan/50 bg-cyan/10 px-2.5 py-1 text-[10px] font-semibold text-cyan transition-colors hover:bg-cyan/20";
const GHOST_BUTTON =
  "rounded-md border border-line px-2.5 py-1 text-[10px] text-muted transition-colors hover:border-cyan/50 hover:text-cyan";

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

/**
 * Submission readiness reads at a glance: green once a session is exam-ready,
 * amber while it is work in progress, red when barely started.
 */
function readinessTone(pct: number) {
  if (pct >= 80) return { text: "text-up", bar: "bg-up" };
  if (pct >= 30) return { text: "text-accent", bar: "bg-accent" };
  if (pct > 0) return { text: "text-down", bar: "bg-down" };
  return { text: "text-muted", bar: "bg-track" };
}

function readProfile(): StudentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as StudentProfile) : null;
  } catch {
    return null;
  }
}

/** Approximate footprint of everything this origin stores, in KB. */
function storageFootprintKb(): number {
  if (typeof window === "undefined") return 0;
  let characters = 0;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      characters += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    return 0;
  }
  return (characters * 2) / 1024;
}

function ReadinessGroup({
  title,
  questions,
  answers,
  onOpen,
}: {
  title: string;
  questions: Array<{ id: string; label: string }>;
  answers?: Record<string, string>;
  onOpen: () => void;
}) {
  const done = questions.filter((question) => answered(answers?.[question.id])).length;
  const missing = questions.filter((question) => !answered(answers?.[question.id]));
  const complete = done === questions.length;

  return (
    <details className="min-w-0 border-b border-line/40 py-1 last:border-0">
      <summary className="flex w-full min-w-0 cursor-pointer list-none items-center justify-between gap-2 text-[10px] transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink/80">
          <span
            className={`size-1.5 shrink-0 rounded-full ${complete ? "bg-up" : done ? "bg-accent" : "bg-track"}`}
            aria-hidden
          />
          <span className="min-w-0 truncate">{title}</span>
        </span>
        <span className={`shrink-0 font-mono ${complete ? "text-up" : "text-muted"}`}>
          {done}/{questions.length}
        </span>
      </summary>
      <div className="pb-1.5 pl-3">
        {missing.length ? (
          <ul className="list-disc space-y-0.5 pl-3 text-[10px] leading-relaxed text-muted">
            {missing.map((question) => (
              <li key={question.id}>{question.label}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-up">All answers saved.</p>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="mt-1 text-[10px] text-cyan transition-colors hover:underline"
        >
          Open in Lab →
        </button>
      </div>
    </details>
  );
}

export function SiteFooter({
  lastUpdated,
  watchlistCount,
  replay,
  onOpenShortcuts,
  onOpenLab,
  onOpenLabAt,
  onOpenPaperDesk,
  onOpenReport,
}: SiteFooterProps) {
  const now = useNow(1000);
  const health = usePoll<HealthReport>("/api/health", 120_000);
  const [panel, setPanel] = useState<FooterPanel | null>(null);
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [ledgers, setLedgers] = useState<ReplayLedgerSummary[]>([]);
  const [storageKb, setStorageKb] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(() => {
    setDesk(loadDeskState());
    setAnswers(readLabAnswers());
    setProfile(readProfile());
    setLedgers(listReplayLedgers());
    setStorageKb(storageFootprintKb());
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

  const togglePanel = (next: FooterPanel) => {
    setConfirmReset(false);
    setPanel((current) => (current === next ? null : next));
  };

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
  const blockedMargin = desk?.positions.reduce((sum, position) => sum + position.blockedMargin, 0) ?? 0;
  const debriefed = trades.filter((trade) => trade.postMortem?.trim()).length;
  const wins = trades.filter((trade) => trade.netPnl > 0).length;
  const losses = trades.filter((trade) => trade.netPnl < 0).length;
  const netPnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const replayTrades = ledgers.reduce((sum, ledger) => sum + ledger.trades, 0);

  const gates = [
    {
      key: "activities",
      fraction: activityTotal ? activityAnswered / activityTotal : 0,
      done: activityDone === LAB_ACTIVITIES.length,
    },
    {
      key: "cases",
      fraction: caseTotal ? caseAnswered / caseTotal : 0,
      done: caseDone === CASE_STUDIES.length,
    },
    {
      key: "journal",
      fraction: trades.length ? 1 : 0,
      done: trades.length > 0,
    },
  ];
  const gatesMet = gates.filter((gate) => gate.done).length;
  const overallPct = Math.round(
    (gates.reduce((sum, gate) => sum + Math.min(1, gate.fraction), 0) / gates.length) * 100,
  );
  const readiness = readinessTone(overallPct);

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
  } else if (overallPct === 0) {
    context = "Fresh session — answer a lab activity or place a paper trade to start the submission trail.";
  } else {
    context = `Still pending: ${pending.join(" and ")} before this session is submission-ready.`;
  }

  const nextActivity = LAB_ACTIVITIES.find((activity) =>
    activity.questions.some((question) => !answered(answers[activity.id]?.[question.id])),
  );
  const nextCase = CASE_STUDIES.find((study) =>
    study.guidedQuestions.some((question) => !answered(answers[study.id]?.[question.id])),
  );

  let nextLabel: string;
  let nextAction: () => void;
  if (gatesMet === gates.length) {
    nextLabel = "Open report";
    nextAction = onOpenReport;
  } else if (nextActivity) {
    const left = activityTotal - activityAnswered;
    nextLabel = `Continue Part 1 · ${left} left`;
    nextAction = () => onOpenLabAt(nextActivity.id);
  } else if (nextCase) {
    const left = caseTotal - caseAnswered;
    nextLabel = `Continue Part 2 · ${left} left`;
    nextAction = () => onOpenLabAt(nextCase.id);
  } else {
    nextLabel = "Place a graded trade";
    nextAction = onOpenPaperDesk;
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
  const mcpServer = health.data?.mcp.server ?? "";
  const mcpLabel =
    mcpServer.match(/node_modules[\\/]([^\\/]+)/)?.[1] ?? (mcpServer || "india-stock-mcp");
  const nothingToReset = !desk || (openPositions === 0 && trades.length === 0);
  const storageText = storageKb >= 10 ? `${Math.round(storageKb)} KB` : `${storageKb.toFixed(1)} KB`;
  const replayTitle = ledgers
    .map((ledger) => `${presetById(ledger.presetId).title}: ${ledger.trades} closed`)
    .join("\n");
  const candidateSet = Boolean(profile?.studentName?.trim() && profile?.rollNumber?.trim());

  return (
    <footer
      className={`mt-6 overflow-hidden rounded-xl border border-line bg-panel2/70 text-xs shadow-xs backdrop-blur-sm ${
        replay ? "pb-52" : ""
      }`}
    >
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
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black tracking-wider text-ink uppercase">
                Panimalar Engineering College
              </span>
              <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan uppercase tracking-wider font-mono">
                MBA FinTech Lab
              </span>
            </div>
            <div className="text-[11px] text-muted pt-0.5">
              Curated &amp; Designed by <span className="font-semibold text-ink">Dr. S. Satheeshkumar</span> · Department of Business Administration
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

      {/* Tier 2 — disclosure (always expanded) */}
      <div className="border-b border-line/60 px-4 py-3">
        <div className="rounded-lg border border-line bg-panel/50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-wider text-ink/80">
              Academic sandbox
            </span>
            <span>Not SEBI registered · disclosure</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            <strong className="font-semibold text-ink/80">Academic sandbox:</strong> live endpoints and
            paper execution are strictly designed for MBA classroom demonstration and quantitative
            research. Not registered with SEBI as an investment adviser or research analyst. Sources:
            NSE India public endpoints, MCP server (<span className="font-mono">india-stock-mcp</span>),
            Yahoo Finance and public market-news RSS.
          </p>
        </div>
      </div>

      {/* Tier 3 — status pills and their detail panels */}
      <div className="px-4 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <button
              type="button"
              onClick={() => togglePanel("readiness")}
              aria-expanded={panel === "readiness"}
              aria-controls={PANEL_ID.readiness}
              className={pillClass(panel === "readiness")}
              title={`${gatesMet}/${gates.length} gates met · ${overallPct}% complete · click for the readiness ledger`}
            >
              <span className="flex h-2 items-end gap-0.5" aria-hidden>
                {gates.map((gate) => (
                  <span
                    key={gate.key}
                    className={`h-full w-1 rounded-sm ${
                      gate.fraction > 0 ? readiness.bar : "bg-track"
                    }`}
                  />
                ))}
              </span>
              <span>Readiness</span>
              <span className={`font-semibold ${readiness.text}`}>{overallPct}%</span>
            </button>

            <button
              type="button"
              onClick={() => togglePanel("session")}
              aria-expanded={panel === "session"}
              aria-controls={PANEL_ID.session}
              className={pillClass(panel === "session")}
              title={`${openPositions} open · ${trades.length} closed graded · saved in this browser`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  replay
                    ? "animate-pulse bg-accent"
                    : openPositions || trades.length
                      ? "bg-up"
                      : "bg-track"
                }`}
                aria-hidden
              />
              <span>Session</span>
              <span className="font-semibold text-ink">
                {!desk
                  ? "…"
                  : replay
                    ? "Replay"
                    : openPositions
                      ? `${openPositions} open`
                      : trades.length
                        ? `${trades.length} closed`
                        : "idle"}
              </span>
              {desk && !replay && openPositions && trades.length ? (
                <span className="text-muted/70">· {trades.length} closed</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => togglePanel("sources")}
              aria-expanded={panel === "sources"}
              aria-controls={PANEL_ID.sources}
              className={pillClass(panel === "sources")}
              title={
                checks.length
                  ? `${checks.length - failingChecks}/${checks.length} sources responding · click for diagnostics`
                  : "Click for source diagnostics"
              }
            >
              {checks.length ? (
                <span className="flex items-center gap-0.5" aria-hidden>
                  {checks.map((check) => (
                    <span
                      key={check.name}
                      className={`size-1 rounded-full ${check.ok ? "bg-up" : "bg-down"}`}
                    />
                  ))}
                </span>
              ) : (
                <span
                  className={`size-1.5 rounded-full ${health.error ? "bg-down" : "bg-track"}`}
                  aria-hidden
                />
              )}
              <span>Sources</span>
              <span className={`font-semibold ${failingChecks ? "text-down" : "text-ink"}`}>
                {checks.length
                  ? `${checks.length - failingChecks}/${checks.length}`
                  : health.error
                    ? "offline"
                    : "…"}
              </span>
            </button>
          </div>

          <span className="hidden h-4 w-px shrink-0 bg-line lg:block" aria-hidden />
          <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-muted">{context}</p>
        </div>

        {panel === "readiness" ? (
          <section
            id={PANEL_ID.readiness}
            role="region"
            aria-label="Submission readiness detail"
            className="mt-2.5 rounded-lg border border-line bg-panel/60 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={SECTION_LABEL}>Readiness ledger</span>
              <span className="text-[10px] text-muted">
                {activityAnswered + caseAnswered}/{activityTotal + caseTotal} answers · {trades.length}{" "}
                graded trade{trades.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold text-ink/80">
                  Part 1 · Classroom activities
                </div>
                {LAB_ACTIVITIES.map((activity) => (
                  <ReadinessGroup
                    key={activity.id}
                    title={activity.title}
                    questions={activity.questions.map((question) => ({
                      id: question.id,
                      label: question.label,
                    }))}
                    answers={answers[activity.id]}
                    onOpen={() => {
                      setPanel(null);
                      onOpenLabAt(activity.id);
                    }}
                  />
                ))}
              </div>

              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold text-ink/80">
                  Part 2 · Curated case studies
                </div>
                {CASE_STUDIES.map((study) => (
                  <ReadinessGroup
                    key={study.id}
                    title={study.title}
                    questions={study.guidedQuestions.map((question) => ({
                      id: question.id,
                      label: question.question,
                    }))}
                    answers={answers[study.id]}
                    onOpen={() => {
                      setPanel(null);
                      onOpenLabAt(study.id);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-panel2/40 px-2.5 py-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Part 3 · Graded journal</span>
                  <span className={`font-mono ${trades.length ? "text-up" : "text-muted"}`}>
                    {trades.length} live
                  </span>
                </div>
                <div className="mt-0.5 text-muted/80">
                  {debriefed}/{trades.length} debriefed · L2 unlocks at 3
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    onOpenPaperDesk();
                  }}
                  className="mt-1 text-cyan transition-colors hover:underline"
                >
                  Open journal →
                </button>
              </div>

              <div className="rounded-md border border-line bg-panel2/40 px-2.5 py-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Candidate details</span>
                  <span className={candidateSet ? "text-up" : "text-muted"}>
                    {candidateSet ? "set" : "pending"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-muted/80">
                  {profile?.studentName?.trim()
                    ? `${profile.studentName}${profile.rollNumber ? ` · ${profile.rollNumber}` : " · roll pending"}`
                    : "Name and roll number are added in the report"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    onOpenReport();
                  }}
                  className="mt-1 text-cyan transition-colors hover:underline"
                >
                  {candidateSet ? "Edit in report" : "Add in report"} →
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPanel(null);
                  nextAction();
                }}
                className={PRIMARY_BUTTON}
              >
                {nextLabel} →
              </button>
              {gatesMet !== gates.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    onOpenReport();
                  }}
                  className={GHOST_BUTTON}
                >
                  Preview report
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {panel === "session" ? (
          <section
            id={PANEL_ID.session}
            role="region"
            aria-label="Local session detail"
            className="mt-2.5 rounded-lg border border-line bg-panel/60 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={SECTION_LABEL}>Session ledger</span>
              <span className="text-[10px] text-muted">
                {replay ? (
                  <span className="mr-2 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                    Replay · {replay.preset.title}
                  </span>
                ) : null}
                Saved in this browser only
              </span>
            </div>

            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold text-ink/80">
                  Open positions · {openPositions}
                </div>
                {desk?.positions.length ? (
                  <ul className="space-y-1">
                    {desk.positions.map((position) => (
                      <li key={position.id} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="truncate text-ink/80">
                          {position.symbol}{" "}
                          <span className="text-muted">
                            ·{" "}
                            {position.kind === "OPTIONS"
                              ? `${position.strategyName} · ${position.legs.length} leg${position.legs.length === 1 ? "" : "s"}`
                              : `${position.quantity} qty`}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-muted">
                          ₹{integer(position.blockedMargin)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-muted">No open positions.</p>
                )}
                <div className="mt-1 border-t border-line/40 pt-1 text-[10px] text-muted">
                  Blocked margin <span className="font-mono text-ink">₹{integer(blockedMargin)}</span>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold text-ink/80">Graded journal</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div>
                    <div className="text-muted">Closed</div>
                    <div className="font-mono text-ink">{trades.length}</div>
                  </div>
                  <div>
                    <div className="text-muted">Wins / losses</div>
                    <div className="font-mono text-ink">
                      {wins} / {losses}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">Net P&amp;L</div>
                    <div
                      className={`font-mono ${
                        netPnl > 0 ? "text-up" : netPnl < 0 ? "text-down" : "text-ink"
                      }`}
                    >
                      ₹{signed(netPnl, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">Debriefed</div>
                    <div className="font-mono text-ink">
                      {debriefed}/{trades.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-1.5 border-t border-line/40 pt-2 text-[10px] text-muted sm:grid-cols-2">
              <div title={replayTitle || undefined}>
                Replay archives:{" "}
                <span className="text-ink/80">
                  {ledgers.length
                    ? `${ledgers.length} · ${replayTrades} trade${replayTrades === 1 ? "" : "s"}`
                    : "none"}
                </span>{" "}
                · excluded from grading
              </div>
              <div className="sm:text-right">
                Storage <span className="font-mono text-ink/80">~{storageText}</span> · last write{" "}
                <span className="font-mono text-ink/80">
                  {desk?.updatedAt ? timeIST(desk.updatedAt, true) : "—"}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPanel(null);
                  onOpenPaperDesk();
                }}
                className={PRIMARY_BUTTON}
              >
                Open paper desk →
              </button>

              {confirmReset ? (
                <span className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="text-down">
                    Clear {openPositions} open and {trades.length} graded? Answers stay.
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
                </span>
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
                  className="rounded border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-down/50 hover:text-down disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
                >
                  Reset local desk
                </button>
              )}
            </div>
          </section>
        ) : null}

        {panel === "sources" ? (
          <section
            id={PANEL_ID.sources}
            role="region"
            aria-label="Source health diagnostics"
            className="mt-2.5 rounded-lg border border-line bg-panel/60 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={SECTION_LABEL}>Source diagnostics</span>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={health.refresh}
                  className="rounded border border-line px-2 py-0.5 text-muted transition-colors hover:border-cyan/50 hover:text-cyan"
                >
                  Re-probe now
                </button>
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted transition-colors hover:text-cyan"
                >
                  Raw JSON ↗
                </a>
              </div>
            </div>

            {health.data ? (
              <>
                <div className="mt-2 divide-y divide-line/40">
                  {checks.map((check) => (
                    <div
                      key={check.name}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-[10px]"
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${check.ok ? "bg-up" : "bg-down"}`}
                        aria-hidden
                      />
                      <span className="w-40 shrink-0 text-ink/80">{check.name}</span>
                      <span className="min-w-0 flex-1 truncate text-muted" title={check.detail}>
                        {check.detail}
                      </span>
                      <span className="shrink-0 font-mono text-muted/70">{ms(check.ms)}</span>
                      <span
                        className={`w-6 shrink-0 text-right font-mono ${check.ok ? "text-up" : "text-down"}`}
                      >
                        {check.ok ? "ok" : "fail"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid gap-2 border-t border-line/40 pt-2 text-[10px] sm:grid-cols-2">
                  <div>
                    <div className="text-muted">Fallback chains</div>
                    <div className="mt-0.5 space-y-0.5 text-ink/70">
                      <div>Indices · {health.data.providers.indices}</div>
                      <div>Quotes · {health.data.providers.quotes}</div>
                      <div>Options · {health.data.providers.options}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted">MCP</div>
                    <div className="mt-0.5 text-ink/70">
                      <span title={mcpServer || undefined}>{mcpLabel}</span> ·{" "}
                      {health.data.mcp.tools.length} tools ·{" "}
                      <span className={health.data.mcp.connected ? "text-up" : "text-down"}>
                        {health.data.mcp.connected ? "connected" : "not connected"}
                      </span>
                    </div>
                    {health.data.mcp.error ? (
                      <div className="mt-0.5 text-down">{health.data.mcp.error}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1.5 text-[9px] text-muted/70">
                  Probes cached 30 s · last checked{" "}
                  {health.updatedAt ? timeIST(health.updatedAt, true) : "—"}
                </div>
              </>
            ) : health.error ? (
              <p className="mt-2 text-[10px] text-down">
                Health probe unreachable: {health.error}.{" "}
                <a href="/api/health" target="_blank" rel="noreferrer" className="underline">
                  Open raw report ↗
                </a>
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-muted">Probing NSE, MCP, Yahoo and news…</p>
            )}
          </section>
        ) : null}
      </div>

      {/* Base strip — utilities, copyright and the return-to-top control */}
      <div className="border-t border-line/60 bg-bg/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted">
          <span className="order-2 whitespace-nowrap text-muted sm:order-1">© 2025–2027 Panimalar</span>

          <nav
            aria-label="Desk utilities"
            className="order-1 flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted sm:order-2 sm:w-auto sm:flex-1 sm:justify-center"
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
          </nav>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="order-3 ml-auto rounded border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-cyan hover:text-cyan"
            title="Back to the top of the dashboard"
          >
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  );
}

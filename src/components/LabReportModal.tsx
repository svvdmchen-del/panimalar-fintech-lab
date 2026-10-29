"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASE_STUDIES, LAB_ACTIVITIES } from "@/lib/caseStudiesData";
import type { StudentProfile } from "@/lib/labTypes";
import { gradedTrades, toReportTradeRow } from "@/lib/desk/report";
import { loadDeskState } from "@/lib/desk/store";
import type { PaperTradeRecord } from "@/lib/desk/types";
import { buildReportHtml, reportPageCount } from "@/lib/report/document";
import type { LabReportPayload } from "@/lib/report/types";

/* A4 at 96dpi: 210mm × 297mm. Used only to size the on-screen preview. */
const PAGE_PX_WIDTH = 793.7;
const PAGE_PX_HEIGHT = 1120.2;
const PAGE_GAP_PX = 22.7;
const PAGE_PAD_PX = 22.7;

const DEFAULT_PROFILE: StudentProfile = {
  studentName: "",
  rollNumber: "",
  batch: "MBA 2025–2027",
  section: "FinTech & Investment Banking",
};

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readProfile(): StudentProfile {
  return { ...DEFAULT_PROFILE, ...readJson<Partial<StudentProfile>>("nse-lab.student-profile", {}) };
}

function readAnswers(): Record<string, Record<string, string>> {
  return readJson<Record<string, Record<string, string>>>("nse-lab.case-answers", {});
}

function readHistory(): PaperTradeRecord[] {
  // The graded journal is the live ledger only: replay sessions use the
  // historical archive and must never be graded as market outcomes.
  return gradedTrades(loadDeskState().history);
}

export function LabReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol?: string;
}) {
  // Only mount the dialog body while it is open: state initialisers read the
  // student's work straight from localStorage, so every open is a fresh snapshot
  // without a setState-in-effect round trip.
  if (!isOpen) return null;
  return <ReportDialog onClose={onClose} />;
}

function ReportDialog({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<StudentProfile>(readProfile);
  const [answers] = useState<Record<string, Record<string, string>>>(readAnswers);
  const [history] = useState<PaperTradeRecord[]>(readHistory);
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [issuedAt] = useState(() => new Date().toISOString());

  // Close on Escape.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const updateProfile = useCallback((field: keyof StudentProfile, value: string) => {
    setProfile((previous) => {
      const next = { ...previous, [field]: value };
      try {
        localStorage.setItem("nse-lab.student-profile", JSON.stringify(next));
      } catch {
        // Storage quota — the export still works from state.
      }
      return next;
    });
  }, []);

  const payload: LabReportPayload = useMemo(
    () => ({ profile, answers, trades: history.map(toReportTradeRow), generatedAt: issuedAt }),
    [profile, answers, history, issuedAt],
  );

  const pageCount = reportPageCount(payload);
  const html = useMemo(
    () => buildReportHtml(payload, { crestSrc: "/panimalar-crest.png", mode: "preview" }),
    [payload],
  );
  const previewHtml = useDebounced(html, 300);
  // The preview paginates long answers itself and reports the real page count.
  const [reported, setReported] = useState<{ html: string; pages: number } | null>(null);
  const renderedPages = reported && reported.html === previewHtml ? reported.pages : pageCount;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; pages?: number } | null;
      if (data?.type !== "nse-report-pages" || typeof data.pages !== "number") return;
      setReported({ html: previewHtml, pages: data.pages });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewHtml]);

  const activityDone = LAB_ACTIVITIES.filter((activity) =>
    activity.questions.every((question) => answers[activity.id]?.[question.id]?.trim()),
  ).length;
  const caseDone = CASE_STUDIES.filter((study) =>
    study.guidedQuestions.every((question) => answers[study.id]?.[question.id]?.trim()),
  ).length;

  const handleDownload = useCallback(async () => {
    setStatus("working");
    setError(null);
    try {
      const response = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `PDF service returned ${response.status}`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const name =
        match?.[1] ??
        `Panimalar_FinTech_Lab_Assignment_${(profile.rollNumber || "Student").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);

      setStatus("done");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch (cause) {
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "Could not generate the PDF.");
    }
  }, [payload, profile.rollNumber]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Lab assignment report"
    >
      <button
        type="button"
        aria-label="Close report"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-md"
      />

      <div className="relative z-10 flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        {/* Action bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-panel2/98 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-sm font-bold text-ink">Lab Assignment Report</span>
            <span className="rounded bg-cyan/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-cyan">
              {renderedPages}-page A4 · server rendered
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={status === "working"}
              className="flex items-center gap-2 rounded-lg bg-cyan px-4 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-cyan/90 active:scale-95 disabled:cursor-progress disabled:opacity-70"
              title="Generate and download the official A4 PDF"
            >
              {status === "working" ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
              ) : (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              <span>
                {status === "working" ? "Rendering PDF…" : status === "done" ? "Downloaded" : "Download PDF"}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-down/40 hover:text-down"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-down/30 bg-down/10 px-5 py-2 text-xs text-down">
            {error} — check that Chromium is installed, or set CHROMIUM_EXECUTABLE_PATH.
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[290px_1fr]">
          {/* Candidate details — the only editable data on this screen */}
          <aside className="min-h-0 space-y-4 overflow-y-auto border-line p-5 lg:border-r">
            <section className="space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
                Candidate details
              </h2>
              {(
                [
                  ["studentName", "Student name", "Enter full name"],
                  ["rollNumber", "Roll / reg number", "e.g. 211425631001"],
                  ["batch", "Class / batch", "MBA 2025–2027"],
                  ["section", "Specialization desk", "FinTech & Investment Banking"],
                ] as const
              ).map(([field, label, placeholder]) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {label}
                  </span>
                  <input
                    type="text"
                    value={profile[field]}
                    placeholder={placeholder}
                    onChange={(event) => updateProfile(field, event.target.value)}
                    className="w-full rounded-md border border-line bg-panel2/60 px-2.5 py-1.5 text-xs font-semibold text-ink outline-none transition-colors focus:border-cyan"
                  />
                </label>
              ))}
            </section>

            <section className="space-y-2 rounded-lg border border-line bg-panel2/40 p-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
                Submission snapshot
              </h2>
              <Row label="Activities" value={`${activityDone} / ${LAB_ACTIVITIES.length}`} />
              <Row label="Case studies" value={`${caseDone} / ${CASE_STUDIES.length}`} />
              <Row label="Paper trades" value={String(history.length)} />
              <Row label="Report ID" value={profile.rollNumber || "Unassigned"} />
            </section>

            <p className="text-[11px] leading-relaxed text-muted">
              The PDF is rendered server-side in Chromium at true A4 with page numbers, running headers and
              hand-fillable answer rules for anything left blank. What you see on the right is the exported
              document.
            </p>
          </aside>

          {/* Live preview of the exact exported document */}
          <div className="flex min-h-0 flex-col p-4">
            <ReportPreview html={previewHtml} pages={renderedPages} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="truncate font-bold text-ink">{value}</span>
    </div>
  );
}

function ReportPreview({ html, pages }: { html: string; pages: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const width = host.clientWidth - 2;
      if (width > 0) setScale(Math.min(1, width / PAGE_PX_WIDTH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const documentHeight = PAGE_PAD_PX * 2 + pages * (PAGE_PX_HEIGHT + PAGE_GAP_PX);

  return (
    <div
      ref={hostRef}
      className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-[#e8edf4]"
    >
      <div
        style={{ width: PAGE_PX_WIDTH * scale, height: documentHeight * scale, margin: "0 auto" }}
      >
        <iframe
          title="Report preview"
          srcDoc={html}
          style={{
            width: PAGE_PX_WIDTH,
            height: documentHeight,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

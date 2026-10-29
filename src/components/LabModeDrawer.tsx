"use client";

import { useEffect, useState, useMemo } from "react";
import { LAB_ACTIVITIES, CASE_STUDIES } from "@/lib/caseStudiesData";
import { ANSWERS_EVENT } from "@/lib/desk/store";

export function LabModeDrawer({
  isOpen,
  onClose,
  onOpenPaperTrade,
  onOpenReport,
  onLaunchSimulation,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenPaperTrade?: () => void;
  onOpenReport?: () => void;
  onLaunchSimulation?: (presetId?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"activities" | "cases">("activities");
  const [selectedActivityId, setSelectedActivityId] = useState<string>("max-pain-challenge");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("case-election-2024");
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  
  // Interactive Straddle Calculator state
  const [calcSpot, setCalcSpot] = useState<number>(24400);
  const [calcCall, setCalcCall] = useState<number>(68);
  const [calcPut, setCalcPut] = useState<number>(54);

  // 3-Minute Pitch Timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(180);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Load answers from localStorage
  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem("nse-lab.case-answers");
        if (saved) {
          setAnswers(JSON.parse(saved));
        }
      } catch {
        // Ignore JSON errors
      }
    };
    // Deferred so the first read happens after mount (never during hydration).
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, []);

  // Save answers to localStorage
  const handleAnswerChange = (groupId: string, questionId: string, value: string) => {
    const updated = {
      ...answers,
      [groupId]: {
        ...(answers[groupId] || {}),
        [questionId]: value,
      },
    };
    setAnswers(updated);
    try {
      localStorage.setItem("nse-lab.case-answers", JSON.stringify(updated));
      // Notify the footer readiness strip; dispatched after the state update so
      // no component is asked to render while this one is rendering.
      window.dispatchEvent(new CustomEvent(ANSWERS_EVENT));
    } catch {
      // storage quota fallback
    }
  };

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Jump to widget on the main page
  const focusWidget = (widgetId: string) => {
    onClose();
    setTimeout(() => {
      const el = document.getElementById(widgetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-cyan", "ring-offset-2", "transition-all");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-cyan", "ring-offset-2");
        }, 2000);
      }
    }, 200);
  };

  // Calculator outputs
  const totalPremium = calcCall + calcPut;
  const lowerBreakeven = calcSpot - totalPremium;
  const upperBreakeven = calcSpot + totalPremium;
  const impliedMovePct = calcSpot > 0 ? (totalPremium / calcSpot) * 100 : 0;

  // Selected items
  const activeActivity = useMemo(
    () => LAB_ACTIVITIES.find((a) => a.id === selectedActivityId) || LAB_ACTIVITIES[0],
    [selectedActivityId],
  );

  const activeCase = useMemo(
    () => CASE_STUDIES.find((c) => c.id === selectedCaseId) || CASE_STUDIES[0],
    [selectedCaseId],
  );

  // Progress counts
  const completedActivitiesCount = LAB_ACTIVITIES.filter((act) => {
    const group = answers[act.id] || {};
    return act.questions.every((q) => group[q.id]?.trim());
  }).length;

  const completedCasesCount = CASE_STUDIES.filter((cs) => {
    const group = answers[cs.id] || {};
    return cs.guidedQuestions.every((q) => group[q.id]?.trim());
  }).length;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MBA FinTech Lab Classroom Simulation & Case Studies"
      className="fixed inset-0 z-50 flex justify-end animate-[fadeIn_150ms_ease-out]"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close Lab Mode Drawer"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Drawer */}
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-line-strong bg-bg shadow-2xl animate-[slideLeft_200ms_ease-out]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-line bg-panel px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/15 text-lg font-bold text-cyan shadow-sm">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-ink">MBA FinTech Lab Simulation</h2>
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                  Interactive Classroom
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Derivatives Desk · Microstructure Forensics · Sector Relays & Historical Replays
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenReport ? (
              <button
                type="button"
                onClick={onOpenReport}
                className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20"
                title="Generate and print institutional lab report"
              >
                📥 Report
              </button>
            ) : null}
            <kbd className="hidden rounded border border-line bg-panel2 px-1.5 py-0.5 text-[9px] font-mono text-muted sm:inline-block">
              ESC
            </kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted hover:border-down/40 hover:text-down"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Quick Launch & Desk Relay Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel2/70 px-5 py-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted">Lab Progress:</span>
            <span className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px] text-cyan">
              Activities: {completedActivitiesCount}/{LAB_ACTIVITIES.length}
            </span>
            <span className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px] text-accent">
              Cases: {completedCasesCount}/{CASE_STUDIES.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenPaperTrade ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPaperTrade();
                }}
                className="flex items-center gap-1 rounded border border-line bg-panel px-2 py-0.5 text-[10px] font-medium text-ink hover:border-cyan/40 hover:text-cyan"
              >
                <span>📝 Virtual Journal</span>
              </button>
            ) : null}
            {onLaunchSimulation ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLaunchSimulation("election-2024");
                }}
                className="flex items-center gap-1 rounded border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/25"
              >
                <span>⏪ Event Replay</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-line bg-panel px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("activities")}
            className={`relative pb-2.5 text-xs font-semibold tracking-wide transition-colors ${
              activeTab === "activities" ? "text-cyan" : "text-muted hover:text-ink"
            }`}
          >
            Part 1: Real-Time Classroom Activities (15–45 Mins)
            {activeTab === "activities" ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cases")}
            className={`relative ml-6 pb-2.5 text-xs font-semibold tracking-wide transition-colors ${
              activeTab === "cases" ? "text-accent" : "text-muted hover:text-ink"
            }`}
          >
            Part 2: Curated Indian Market Case Studies
            {activeTab === "cases" ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            ) : null}
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {activeTab === "activities" ? (
            <>
              {/* Activity Selector Pills */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {LAB_ACTIVITIES.map((act) => {
                  const isSelected = act.id === selectedActivityId;
                  const isComplete = act.questions.every(
                    (q) => answers[act.id]?.[q.id]?.trim(),
                  );
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setSelectedActivityId(act.id)}
                      className={`flex flex-col text-left rounded-lg border p-2.5 transition-all ${
                        isSelected
                          ? "border-cyan bg-cyan/10 shadow-sm"
                          : "border-line bg-panel/60 hover:border-line-strong hover:bg-panel"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {act.desk}
                        </span>
                        {isComplete ? (
                          <span className="text-[10px] text-up font-bold">✓ Done</span>
                        ) : (
                          <span className="text-[9px] text-muted">{act.duration}</span>
                        )}
                      </div>
                      <span className="mt-1 text-xs font-semibold text-ink line-clamp-1">
                        {act.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Activity Details */}
              <div className="rounded-xl border border-line bg-panel p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-cyan/15 px-2 py-0.5 text-[9px] font-bold text-cyan uppercase tracking-wider">
                        {activeActivity.desk}
                      </span>
                      <span className="text-[10px] text-muted">Duration: {activeActivity.duration}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-ink">{activeActivity.title}</h3>
                    <p className="mt-0.5 text-xs text-muted leading-relaxed">
                      {activeActivity.objective}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => focusWidget(activeActivity.targetWidgetId)}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition-colors"
                  >
                    <span>🎯 Focus {activeActivity.targetWidgetName}</span>
                    <span>→</span>
                  </button>
                </div>

                {/* Instructions */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink/80">
                    Team Action Protocol
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted">
                    {activeActivity.instructions.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-panel2 font-mono text-[9px] font-bold text-cyan">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Built-in Interactive Tool for Activity 1 (Straddle Calculator) */}
                {activeActivity.id === "max-pain-challenge" ? (
                  <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan flex items-center gap-1.5">
                        <span>🧮</span> Interactive ATM Straddle Breakeven Calculator
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        Formula: [S - Premium, S + Premium]
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-muted block mb-1">
                          NIFTY Spot / Strike (S)
                        </label>
                        <input
                          type="number"
                          value={calcSpot}
                          onChange={(e) => setCalcSpot(Number(e.target.value))}
                          className="w-full rounded border border-line bg-panel px-2 py-1 font-mono text-xs text-ink focus:border-cyan"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted block mb-1">
                          ATM Call (CE LTP)
                        </label>
                        <input
                          type="number"
                          value={calcCall}
                          onChange={(e) => setCalcCall(Number(e.target.value))}
                          className="w-full rounded border border-line bg-panel px-2 py-1 font-mono text-xs text-ink focus:border-cyan"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted block mb-1">
                          ATM Put (PE LTP)
                        </label>
                        <input
                          type="number"
                          value={calcPut}
                          onChange={(e) => setCalcPut(Number(e.target.value))}
                          className="w-full rounded border border-line bg-panel px-2 py-1 font-mono text-xs text-ink focus:border-cyan"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded border border-cyan/20 bg-panel p-2 font-mono text-center">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-muted block">
                          Combined Premium
                        </span>
                        <span className="text-xs font-bold text-cyan">₹{totalPremium.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-muted block">
                          Pin Breakeven Range
                        </span>
                        <span className="text-xs font-bold text-ink">
                          [{lowerBreakeven.toFixed(0)} — {upperBreakeven.toFixed(0)}]
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-muted block">
                          Expected Move
                        </span>
                        <span className="text-xs font-bold text-accent">
                          ±{impliedMovePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Built-in Interactive Tool for Activity 3 (3-Minute Pitch Timer) */}
                {activeActivity.id === "sector-rotation-relay" ? (
                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-accent flex items-center gap-1.5">
                        <span>⏱</span> Live Rapid Pitch Relay Timer (3 Mins per Team)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTimerRunning((r) => !r)}
                          className={`rounded px-2.5 py-0.5 text-xs font-bold text-white transition-colors ${
                            timerRunning ? "bg-down hover:bg-down/80" : "bg-up hover:bg-up/80"
                          }`}
                        >
                          {timerRunning ? "Pause" : "Start 3m Pitch"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTimerRunning(false);
                            setTimerSeconds(180);
                          }}
                          className="rounded border border-line bg-panel px-2 py-0.5 text-xs text-muted hover:text-ink"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-around rounded border border-accent/20 bg-panel p-3">
                      <div className="text-center">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">
                          Remaining Time
                        </span>
                        <span
                          className={`font-mono text-2xl font-bold ${
                            timerSeconds < 30 ? "animate-pulse text-down" : "text-ink"
                          }`}
                        >
                          {Math.floor(timerSeconds / 60)}:
                          {(timerSeconds % 60).toString().padStart(2, "0")}
                        </span>
                      </div>

                      <div className="text-center border-l border-line pl-6">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">
                          Assigned Teams
                        </span>
                        <div className="flex gap-1.5 mt-1">
                          {["Banking", "IT", "Auto", "Pharma"].map((sector) => (
                            <span
                              key={sector}
                              className="rounded border border-line bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-ink"
                            >
                              {sector}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Guided Questions / Student Work Inputs */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink/80">
                      Team Findings & Thesis Submission
                    </h4>
                    <span className="text-[10px] text-muted italic">Autosaved to lab journal</span>
                  </div>

                  {activeActivity.questions.map((q) => {
                    const currentVal = answers[activeActivity.id]?.[q.id] || "";
                    return (
                      <div key={q.id} className="space-y-1">
                        <label className="text-xs font-semibold text-ink flex items-center justify-between">
                          <span>{q.label}</span>
                          {currentVal.trim() ? (
                            <span className="text-[10px] font-mono text-up">Saved ✓</span>
                          ) : (
                            <span className="text-[10px] font-mono text-muted">Required</span>
                          )}
                        </label>
                        <p className="text-[11px] text-muted">{q.prompt}</p>
                        <textarea
                          rows={2}
                          value={currentVal}
                          onChange={(e) =>
                            handleAnswerChange(activeActivity.id, q.id, e.target.value)
                          }
                          placeholder={q.placeholder}
                          className="w-full rounded-md border border-line bg-panel2/60 px-3 py-2 text-xs text-ink placeholder:text-muted/50 focus:border-cyan focus:bg-panel focus:outline-none"
                        />
                        <p className="text-[10px] text-cyan/80">💡 Hint: {q.hint}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Case Studies Selector Cards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CASE_STUDIES.map((cs) => {
                  const isSelected = cs.id === selectedCaseId;
                  const isComplete = cs.guidedQuestions.every(
                    (q) => answers[cs.id]?.[q.id]?.trim(),
                  );
                  return (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() => setSelectedCaseId(cs.id)}
                      className={`flex flex-col text-left rounded-lg border p-3 transition-all ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-sm"
                          : "border-line bg-panel/60 hover:border-line-strong hover:bg-panel"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-accent rounded bg-accent/15 px-1.5 py-0.2">
                          {cs.badge}
                        </span>
                        {isComplete ? (
                          <span className="text-[10px] text-up font-bold">✓ Completed</span>
                        ) : (
                          <span className="text-[9px] text-muted">Case Study</span>
                        )}
                      </div>
                      <span className="mt-1.5 text-xs font-bold text-ink line-clamp-1">
                        {cs.title}
                      </span>
                      <p className="mt-1 text-[10px] text-muted line-clamp-2">
                        {cs.scenario}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Active Case Study Detail */}
              <div className="rounded-xl border border-line bg-panel p-4 space-y-4">
                <div className="border-b border-line pb-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent uppercase tracking-wider">
                      {activeCase.badge}
                    </span>
                    <div className="flex items-center gap-1">
                      {activeCase.id === "case-election-2024" && onLaunchSimulation ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onLaunchSimulation("election-2024");
                          }}
                          className="flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent/20"
                        >
                          <span>⏪ Replay June 4th Market Tape</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-ink">{activeCase.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {activeCase.keyConcepts.map((kc, i) => (
                      <span
                        key={i}
                        className="rounded border border-line bg-panel2 px-1.5 py-0.5 text-[9px] font-mono text-muted"
                      >
                        {kc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Scenario & Student Task */}
                <div className="space-y-2">
                  <div className="rounded-lg border border-line bg-panel2/40 p-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink/80">
                      Market Context & Scenario
                    </h4>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      {activeCase.scenario}
                    </p>
                  </div>

                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-accent">
                      Assigned Student Task
                    </h4>
                    <p className="mt-1 text-xs text-ink/90 leading-relaxed font-medium">
                      {activeCase.studentTask}
                    </p>
                  </div>
                </div>

                {/* Guided Case Questions */}
                <div className="space-y-3.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink/80">
                      Analytical Exercise & Case Questions
                    </h4>
                    <span className="text-[10px] text-muted italic">Persisted for grading</span>
                  </div>

                  {activeCase.guidedQuestions.map((q, idx) => {
                    const currentVal = answers[activeCase.id]?.[q.id] || "";
                    return (
                      <div key={q.id} className="space-y-1.5 rounded-lg border border-line/60 bg-panel2/30 p-3">
                        <label className="text-xs font-semibold text-ink flex items-start justify-between gap-2">
                          <span>{q.question}</span>
                          {currentVal.trim() ? (
                            <span className="shrink-0 text-[10px] font-mono text-up">Saved ✓</span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-mono text-muted">Question {idx + 1}</span>
                          )}
                        </label>
                        <textarea
                          rows={3}
                          value={currentVal}
                          onChange={(e) =>
                            handleAnswerChange(activeCase.id, q.id, e.target.value)
                          }
                          placeholder={q.placeholder}
                          className="w-full rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink placeholder:text-muted/50 focus:border-accent focus:outline-none font-mono"
                        />
                        <div className="rounded border border-accent/20 bg-accent/5 px-2.5 py-1 text-[10px] text-accent/90">
                          🎯 Key Academic Takeaway: {q.learningTakeaway}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="flex items-center justify-between border-t border-line bg-panel px-5 py-3">
          <div className="text-[11px] text-muted">
            Panimalar Engineering College · Department of Management Studies (MBA)
          </div>

          <div className="flex items-center gap-2">
            {onOpenReport ? (
              <button
                type="button"
                onClick={onOpenReport}
                className="rounded-lg border border-cyan/40 bg-cyan/15 px-3 py-1.5 text-xs font-bold text-cyan hover:bg-cyan/25"
              >
                📥 Export Lab Report
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:border-line-strong"
            >
              Close
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

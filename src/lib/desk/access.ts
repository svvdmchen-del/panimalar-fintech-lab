/**
 * Staged unlock for the paper desk.
 *
 * Level 0 (cash) is always available. Options are earned, not assumed:
 *
 *   L1  long CE/PE     ← Max Pain activity submitted AND (faculty override OR checkpoint 3/3)
 *   L2  defined spreads← L1 + three closed long-option trades with a post-mortem
 *                         (or a faculty override)
 *   L3  naked writing  ← L2 + explicit risk acknowledgment
 *                         (or a faculty override)
 *
 * `resolveAccess()` is pure so the same rule can be shown in the desk, tested,
 * and (later) enforced by the report or a server route.
 */

import { LAB_ACTIVITIES } from "@/lib/caseStudiesData";
import type { DeskAccessState, DeskLevel, PaperTradeRecord } from "./types";

export const MAX_PAIN_ACTIVITY_ID = "max-pain-challenge";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** Three questions, all answerable from the Part 1 Max Pain activity. */
export const CHECKPOINT_QUESTIONS: QuizQuestion[] = [
  {
    id: "lot-size",
    prompt: "NIFTY's lot size is 75. How many units does a 2-lot order represent?",
    options: ["75", "150", "300"],
    answer: 1,
    explanation: "Lots are not shares: 2 lots × 75 units = 150 units.",
  },
  {
    id: "max-loss",
    prompt: "You buy one call option and it expires out of the money. What is your loss?",
    options: ["Unlimited", "The premium you paid", "The strike value"],
    answer: 1,
    explanation: "A long option's loss is capped at the premium; that is why buyers 'own' an option.",
  },
  {
    id: "short-margin",
    prompt: "A naked short call blocks margin because…",
    options: [
      "The exchange wants a deposit against uncapped upside risk",
      "The premium is refunded at expiry",
      "Short selling is free in India",
    ],
    answer: 0,
    explanation: "Short options carry margin; a naked call's loss grows as the index rises.",
  },
];

export function scoreCheckpoint(answers: Array<number | null>): number {
  return answers.reduce<number>((score, answer, index) => {
    const question = CHECKPOINT_QUESTIONS[index];
    return question && answer === question.answer ? score + 1 : score;
  }, 0);
}

function maxPainSubmitted(answers: Record<string, Record<string, string>>): boolean {
  const activity = LAB_ACTIVITIES.find((item) => item.id === MAX_PAIN_ACTIVITY_ID);
  if (!activity) return false;
  const group = answers[MAX_PAIN_ACTIVITY_ID] ?? {};
  return activity.questions.every((question) => Boolean(group[question.id]?.trim()));
}

function closedLongOptions(history: PaperTradeRecord[]): number {
  return history.filter(
    (trade) =>
      trade.kind === "OPTIONS" &&
      trade.strategyId === "SINGLE_LONG" &&
      trade.legs.some((leg) => leg.side === "BUY") &&
      // Auto target/stop/expiry notes are written by the desk, not the student;
      // they cannot count as a debriefed trade.
      Boolean(trade.postMortem?.trim()) &&
      !trade.postMortem!.startsWith("Automated"),
  ).length;
}

export interface AccessCheck {
  id: DeskLevel;
  label: string;
  unlocked: boolean;
  /** Requirement rows shown in the lock panel. */
  requirements: Array<{ label: string; met: boolean; detail?: string }>;
}

export interface ResolvedAccess {
  /** Highest level the student may trade. */
  current: DeskLevel;
  unlocked: Record<DeskLevel, boolean>;
  checks: Record<DeskLevel, AccessCheck>;
  progress: {
    maxPainSubmitted: boolean;
    checkpointBest: number;
    closedLongOptions: number;
    acknowledgedWritingRisk: boolean;
  };
}

export function resolveAccess(
  answers: Record<string, Record<string, string>>,
  history: PaperTradeRecord[],
  access: DeskAccessState,
): ResolvedAccess {
  const submitted = maxPainSubmitted(answers);
  const checkpoint = access.quiz.best;
  const longsClosed = closedLongOptions(history);

  const l1 = submitted && (access.overrides.OPTIONS_LONG || checkpoint >= CHECKPOINT_QUESTIONS.length);
  const l2 = l1 && (access.overrides.OPTIONS_SPREADS || longsClosed >= 3);
  // Naked writing is available to every student who has options at all, as long
  // as they tick the risk acknowledgment. It does not wait for L2.
  const l3 = l1 && (access.overrides.OPTIONS_WRITING || access.acknowledgedWritingRisk);

  const unlocked: Record<DeskLevel, boolean> = {
    EQUITY: true,
    OPTIONS_LONG: l1,
    OPTIONS_SPREADS: l2,
    OPTIONS_WRITING: l3,
  };

  // Writing does not move the default tab: it is a capability the student opts
  // into on the ticket, so the desk still opens on the highest structured level.
  const current: DeskLevel = l2 ? "OPTIONS_SPREADS" : l1 ? "OPTIONS_LONG" : "EQUITY";
  const checks: Record<DeskLevel, AccessCheck> = {
    EQUITY: {
      id: "EQUITY",
      label: "Cash equities",
      unlocked: true,
      requirements: [{ label: "Always available", met: true }],
    },
    OPTIONS_LONG: {
      id: "OPTIONS_LONG",
      label: "Options L1 — long only",
      unlocked: l1,
      requirements: [
        {
          label: "Part 1 · Expiry Day Max Pain submitted",
          met: submitted,
          detail: "All three answers saved in the lab drawer.",
        },
        {
          label: "Checkpoint 3/3 or faculty override",
          met: checkpoint >= CHECKPOINT_QUESTIONS.length || access.overrides.OPTIONS_LONG,
          detail: `Best score ${checkpoint}/${CHECKPOINT_QUESTIONS.length}`,
        },
      ],
    },
    OPTIONS_SPREADS: {
      id: "OPTIONS_SPREADS",
      label: "Spreads L2 — defined risk",
      unlocked: l2,
      requirements: [
        { label: "Options L1 unlocked", met: l1 },
        {
          label: "Three closed long-option trades with a post-mortem",
          met: longsClosed >= 3 || access.overrides.OPTIONS_SPREADS,
          detail: `${Math.min(longsClosed, 3)}/3 debriefed`,
        },
      ],
    },
    OPTIONS_WRITING: {
      id: "OPTIONS_WRITING",
      label: "Writing L3 — naked shorts",
      unlocked: l3,
      requirements: [
        { label: "Options L1 unlocked", met: l1 },
        {
          label: "Risk acknowledgment accepted on the ticket",
          met: access.acknowledgedWritingRisk || access.overrides.OPTIONS_WRITING,
        },
      ],
    },
  };

  return {
    current,
    unlocked,
    checks,
    progress: {
      maxPainSubmitted: submitted,
      checkpointBest: checkpoint,
      closedLongOptions: longsClosed,
      acknowledgedWritingRisk: access.acknowledgedWritingRisk,
    },
  };
}

export function canTrade(level: DeskLevel, resolved: ResolvedAccess): boolean {
  return resolved.unlocked[level];
}

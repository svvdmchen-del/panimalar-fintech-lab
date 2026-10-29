"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Envelope, OptionChain, Quote } from "@/lib/types";
import type { SimulationPreset } from "@/lib/labTypes";
import { formatDuration, timeIST } from "@/lib/format";
import { useNow, usePoll } from "@/lib/usePoll";
import { calculateFriction, calculateRiskMetrics } from "@/lib/optionsPricing";
import {
  INDEX_UNDERLYINGS,
  isEquityTradable,
  isIndexUnderlying,
  lotSizeFor,
  strikeStepFor,
  unitsForLots,
} from "@/lib/instruments";
import { CHECKPOINT_QUESTIONS, resolveAccess, scoreCheckpoint } from "@/lib/desk/access";
import { equityCash, optionsMargin, SPAN_NOTIONAL_PCT } from "@/lib/desk/margin";
import { replayQuotes, simClockLabel, simTimeMs } from "@/lib/desk/replay";
import {
  DEFAULT_ACCESS,
  DESK_LEVELS,
  LEVEL_LABEL,
  type DeskLevel,
  type DeskState,
  type EquityPosition,
  type OptionsPosition,
  type OptionsStrategyId,
  type OptionKind,
  type PaperLeg,
  type PaperPosition,
  type PaperTradeRecord,
  type TradeLeg,
} from "@/lib/desk/types";
import {
  bsPrice,
  breakevens,
  isExpired,
  intrinsic,
  legUnits,
  netGreeks,
  netPremium,
  payoffCurve,
  riskProfile,
  round,
  sideSign,
  yearsToExpiry,
} from "@/lib/desk/valuation";
import { riskReward, rrLabel, rrTone, suggestedStop, targetAtRatio } from "@/lib/desk/levels";
import { loadDeskState, loadReplay, persistDeskState, persistReplay, readLabAnswers, resetDesk } from "@/lib/desk/store";

const INITIAL_CAPITAL = 1_000_000;
const EQUITY_SLIPPAGE = 0.0005;
const OPTION_SLIPPAGE = 0.0025;

const THESIS_TAGS = [
  "Technical: Breakout / RSI",
  "Derivatives: Max Pain / OI Wall",
  "Microstructure: FII/DII Net Inflow",
  "Fundamental: Valuation Gap / SOTP",
  "Macro: RBI Policy / Crude",
] as const;

type ReplayInput = { preset: SimulationPreset; progressPct: number } | null;

const STRATEGY_LABEL: Record<OptionsStrategyId, string> = {
  SINGLE_LONG: "Single long (buy CE/PE)",
  BULL_CALL: "Bull call spread",
  BEAR_PUT: "Bear put spread",
  IRON_CONDOR: "Iron condor",
  NAKED_SHORT: "Naked short (write)",
};

const STRATEGY_LEVEL: Record<OptionsStrategyId, DeskLevel> = {
  SINGLE_LONG: "OPTIONS_LONG",
  BULL_CALL: "OPTIONS_SPREADS",
  BEAR_PUT: "OPTIONS_SPREADS",
  IRON_CONDOR: "OPTIONS_SPREADS",
  NAKED_SHORT: "OPTIONS_WRITING",
};

function inr(value: number, digits = 0): string {
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function signedInr(value: number, digits = 0): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${inr(Math.abs(value), digits)}`;
}

export function PaperTradingDrawer({
  isOpen,
  onClose,
  activeSymbol,
  activeQuote,
  quotes = [],
  feedStatus = "live",
  replay = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol?: string;
  activeQuote?: Quote;
  quotes?: Quote[];
  feedStatus?: "live" | "delayed" | "demo";
  replay?: ReplayInput;
}) {
  const replayActive = Boolean(replay);
  const preset = replay?.preset;

  const [desk, setDesk] = useState<DeskState | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [level, setLevel] = useState<DeskLevel>("EQUITY");
  // The selected tab only overrides the default once the student clicks one.
  const [levelTouched, setLevelTouched] = useState(false);

  const [strategy, setStrategy] = useState<OptionsStrategyId>("SINGLE_LONG");
  const [underlying, setUnderlying] = useState<string>("NIFTY");
  const [optionKind, setOptionKind] = useState<OptionKind>("CE");
  const [expiry, setExpiry] = useState<string>("");
  const [strike, setStrike] = useState<number | null>(null);
  const [lots, setLots] = useState<number>(1);
  const [wingSteps, setWingSteps] = useState<number>(2);

  const [equitySymbol, setEquitySymbol] = useState<string>("RELIANCE");
  const [quantity, setQuantity] = useState<number>(10);
  const [target, setTarget] = useState<number>(0);
  const [stop, setStop] = useState<number>(0);

  const [thesis, setThesis] = useState<string>("");
  const [thesisTag, setThesisTag] = useState<string>(THESIS_TAGS[0]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [quizAnswers, setQuizAnswers] = useState<Array<number | null>>([null, null, null]);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [facultyOpen, setFacultyOpen] = useState(false);
  const [closing, setClosing] = useState<{
    position: PricedPosition;
    reason: "MANUAL" | "TARGET" | "STOP_LOSS";
  } | null>(null);
  const [postMortem, setPostMortem] = useState("");

  const now = useNow(1000);
  const closingRef = useRef<Set<string>>(new Set());

  /* ------------------------------------------------------------- loading */

  // The desk lives in localStorage, an external store, so it is read when the
  // drawer opens rather than during render.
  /* eslint-disable react-hooks/set-state-in-effect -- external store read */
  useEffect(() => {
    if (!isOpen) return;
    setLevelTouched(false);
    if (preset) {
      const body = loadReplay(preset.id);
      setDesk({
        schemaVersion: 2,
        positions: body.positions,
        history: body.history,
        access: DEFAULT_ACCESS,
        friction: true,
        updatedAt: 0,
      });
    } else {
      setDesk(loadDeskState());
    }
    setAnswers(readLabAnswers());
    setError(null);
    setNotice(null);
  }, [isOpen, preset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const positions = useMemo(() => desk?.positions ?? [], [desk]);
  const history = useMemo(() => desk?.history ?? [], [desk]);
  const access = desk?.access ?? DEFAULT_ACCESS;
  const frictionOn = desk?.friction ?? true;

  const resolved = useMemo(
    () => resolveAccess(replayActive ? {} : answers, replayActive ? [] : history, access),
    [answers, history, access, replayActive],
  );

  // The selected tab only overrides the default once the student clicks one.
  const activeLevel: DeskLevel = replayActive ? "EQUITY" : levelTouched ? level : resolved.current;
  const ticketMode = activeLevel === "EQUITY" ? "EQUITY" : "OPTIONS";

  const persist = useCallback(
    (next: DeskState) => {
      setDesk(next);
      if (preset) {
        persistReplay(preset.id, { schemaVersion: 2, positions: next.positions, history: next.history });
      } else {
        persistDeskState(next);
      }
    },
    [preset],
  );

  const updateAccess = useCallback(
    (patch: Partial<DeskState["access"]>) => {
      if (!desk) return;
      persist({ ...desk, access: { ...desk.access, ...patch } });
    },
    [desk, persist],
  );

  /* --------------------------------------------------------------- quotes */

  const polledSymbols = useMemo(() => {
    const set = new Set<string>();
    if (!replayActive) {
      const focused = ticketMode === "EQUITY" ? equitySymbol : underlying;
      if (focused) set.add(focused.trim().toUpperCase());
    }
    for (const position of positions) set.add(position.symbol.toUpperCase());
    if (activeSymbol) set.add(activeSymbol.toUpperCase());
    return Array.from(set).filter(Boolean).slice(0, 30);
  }, [replayActive, ticketMode, equitySymbol, underlying, positions, activeSymbol]);

  const quoteUrl = !replayActive && polledSymbols.length
    ? `/api/market/quotes?symbols=${encodeURIComponent(polledSymbols.join(","))}`
    : null;
  const quotePoll = usePoll<Envelope<Quote[]>>(quoteUrl, 10_000);

  const quoteMap = useMemo(() => {
    const map = new Map<string, Quote>();
    if (replayActive && preset && replay) {
      for (const quote of replayQuotes(preset, replay.progressPct)) {
        map.set(quote.symbol.toUpperCase(), quote);
      }
      return map;
    }
    for (const quote of quotes) map.set(quote.symbol.toUpperCase(), quote);
    if (activeQuote) map.set(activeQuote.symbol.toUpperCase(), activeQuote);
    for (const quote of quotePoll.data?.data ?? []) map.set(quote.symbol.toUpperCase(), quote);
    return map;
  }, [replayActive, preset, replay, quotes, activeQuote, quotePoll.data]);

  const nowMs = replayActive && preset && replay
    ? simTimeMs(preset, replay.progressPct)
    : now?.getTime() ?? 0;

  /* ---------------------------------------------------------------- chain */

  const chainUrl =
    !replayActive && ticketMode === "OPTIONS" && isIndexUnderlying(underlying)
      ? `/api/market/options?symbol=${underlying}${expiry ? `&expiry=${encodeURIComponent(expiry)}` : ""}`
      : null;
  const chainPoll = usePoll<Envelope<OptionChain>>(chainUrl, 30_000);
  const chain = chainPoll.data?.data;

  // Choosing a new underlying or series resets the dependent strike pick. This
  // is state synchronisation with the chain selector, not derivable state.
  /* eslint-disable react-hooks/set-state-in-effect -- chain selector reset */
  useEffect(() => {
    // A new underlying invalidates the chosen series.
    setStrike(null);
    setExpiry("");
  }, [underlying]);

  useEffect(() => {
    setStrike(null);
  }, [expiry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const spot = quoteMap.get(underlying.toUpperCase())?.price ?? chain?.underlying ?? 0;
  const step = strikeStepFor(underlying);
  const atmStrike = chain?.atmStrike ?? (spot > 0 ? Math.round(spot / step) * step : 0);
  const effectiveStrike = strike ?? atmStrike;
  const effectiveExpiry = expiry || chain?.expiry || "";
  const strikes = chain?.strikes ?? [];

  const chainRowFor = useCallback(
    (kind: OptionKind, strikePrice: number) => {
      const row =
        strikes.find((item) => item.strike === strikePrice) ??
        chain?.allStrikes?.find((item) => item.strike === strikePrice);
      if (!row) return null;
      const ltp = kind === "CE" ? row.ce.ltp : row.pe.ltp;
      return ltp && ltp > 0 ? round(ltp, 2) : null;
    },
    [strikes, chain?.allStrikes],
  );

  const ivFor = useCallback(
    (kind: OptionKind, strikePrice: number): number => {
      const row =
        strikes.find((item) => item.strike === strikePrice) ??
        chain?.allStrikes?.find((item) => item.strike === strikePrice);
      const iv = row ? (kind === "CE" ? row.ce.iv : row.pe.iv) : 0;
      return iv && iv > 0 ? iv : 15;
    },
    [strikes, chain?.allStrikes],
  );

  // Preview price. The ticket still refuses to submit unless every leg has a
  // real chain LTP — the Black-Scholes value is shown for context only.
  const premiumFor = useCallback(
    (kind: OptionKind, strikePrice: number): number => {
      const quoted = chainRowFor(kind, strikePrice);
      if (quoted !== null) return quoted;
      const years = effectiveExpiry ? yearsToExpiry(effectiveExpiry, nowMs) : 4 / 365;
      return round(bsPrice(kind, spot, strikePrice, years, ivFor(kind, strikePrice)), 2);
    },
    [chainRowFor, effectiveExpiry, nowMs, spot, ivFor],
  );

  /* ---------------------------------------------------------------- legs */

  const buildLegs = useMemo((): PaperLeg[] => {
    if (!isIndexUnderlying(underlying) || !spot || !effectiveExpiry || !effectiveStrike) return [];
    const base = effectiveStrike;
    const wing = step * wingSteps;
    const lotSize = lotSizeFor(underlying);

    const make = (instrument: OptionKind, side: "BUY" | "SELL", strikePrice: number, index: number): PaperLeg => ({
      id: `leg-${index}-${instrument}-${strikePrice}-${side}`,
      instrument,
      side,
      strike: strikePrice,
      expiry: effectiveExpiry,
      lots: Math.max(1, lots),
      lotSize,
      entryPremium: premiumFor(instrument, strikePrice),
      iv: ivFor(instrument, strikePrice),
    });

    switch (strategy) {
      case "BULL_CALL":
        return [make("CE", "BUY", base, 0), make("CE", "SELL", base + wing, 1)];
      case "BEAR_PUT":
        return [make("PE", "BUY", base, 0), make("PE", "SELL", base - wing, 1)];
      case "IRON_CONDOR":
        return [
          make("PE", "SELL", base - wing, 0),
          make("PE", "BUY", base - wing * 2, 1),
          make("CE", "SELL", base + wing, 2),
          make("CE", "BUY", base + wing * 2, 3),
        ];
      case "NAKED_SHORT":
        return [make(optionKind, "SELL", base, 0)];
      case "SINGLE_LONG":
      default:
        return [make(optionKind, "BUY", base, 0)];
    }
    // premiumFor/ivFor are derived from chain + spot + expiry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [underlying, spot, effectiveExpiry, effectiveStrike, step, wingSteps, strategy, optionKind, lots, premiumFor, ivFor]);

  // A leg without a chain quote cannot be filled: the lab will not invent a
  // premium, so the submit button stays disabled and the ticket says why.
  const unpricedLegs = buildLegs.filter((leg) => chainRowFor(leg.instrument, leg.strike) === null);

  const netPremiumEntry = netPremium(buildLegs, (leg) => leg.entryPremium);
  const optionUnits = buildLegs.length ? legUnits(buildLegs[0]) : 0;
  const netCash = round(netPremiumEntry * optionUnits, 2);
  const margin = useMemo(() => optionsMargin(buildLegs, spot), [buildLegs, spot]);
  const profile = useMemo(() => riskProfile(buildLegs, spot), [buildLegs, spot]);
  const payoff = useMemo(() => payoffCurve(buildLegs, spot), [buildLegs, spot]);
  const bePoints = useMemo(() => breakevens(payoff), [payoff]);
  const greeks = useMemo(() => netGreeks(buildLegs, spot, nowMs), [buildLegs, spot, nowMs]);

  const optionEntryRef = netPremiumEntry;
  const tradeSide = optionEntryRef >= 0 ? "SELL" : "BUY";
  const optionRR = riskReward(Math.abs(optionEntryRef), target || undefined, stop || undefined);

  const equityQuote = quoteMap.get(equitySymbol.trim().toUpperCase());
  const equityLivePrice = equityQuote?.price && equityQuote.price > 0 ? equityQuote.price : 0;
  const equityRR = riskReward(equityLivePrice, target || undefined, stop || undefined);
  const equityNeeded = equityCash(quantity, equityLivePrice);

  /* ----------------------------------------------------------- live marks */

  const pricedPositions = useMemo((): PricedPosition[] => {
    return positions.map((position) => {
      if (position.kind === "EQUITY") {
        const quote = quoteMap.get(position.symbol.toUpperCase());
        const currentPrice = quote?.price && quote.price > 0 ? quote.price : position.entryPrice;
        const diff = position.side === "BUY" ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
        const grossPnl = round(diff * position.quantity, 2);
        return {
          position,
          currentPrice,
          currentNet: currentPrice,
          marks: new Map(),
          settlePrice: currentPrice,
          grossPnl,
          pnlPct: position.entryPrice > 0 ? round((diff / position.entryPrice) * 100, 2) : 0,
          holdingMs: Math.max(0, nowMs - position.entryTime),
        };
      }

      const marks = new Map<string, number>();
      let grossPnl = 0;
      let notional = 0;

      // Marks come from the chain only when the ticket is showing the same
      // underlying *and* expiry; otherwise Black-Scholes with the entry IV is
      // the honest fallback (a different chain must not lend its premiums).
      const sameSeries = position.symbol.toUpperCase() === underlying.toUpperCase();
      const legSpot = spotFor(position.symbol);

      for (const leg of position.legs) {
        const chainPremium =
          sameSeries && leg.expiry === effectiveExpiry
            ? chainRowFor(leg.instrument, leg.strike)
            : null;
        const years = yearsToExpiry(leg.expiry, nowMs);
        const expired = isExpired(leg.expiry, nowMs);
        const mark = expired
          ? legSpot === null
            ? leg.entryPremium
            : intrinsic(leg.instrument, legSpot, leg.strike)
          : chainPremium !== null
            ? chainPremium
            : round(bsPrice(leg.instrument, legSpot ?? leg.strike, leg.strike, years, leg.iv || 15), 2);

        marks.set(leg.id, mark);
        const legUnitsValue = legUnits(leg);
        grossPnl += (mark - leg.entryPremium) * legUnitsValue * sideSign(leg.side);
        notional += Math.abs(leg.entryPremium) * legUnitsValue;
      }

      const currentNet = netPremium(position.legs, (leg) => marks.get(leg.id) ?? leg.entryPremium);

      return {
        position,
        marks,
        currentNet,
        currentPrice: currentNet,
        settlePrice: legSpot,
        grossPnl: round(grossPnl, 2),
        pnlPct: notional > 0 ? round((grossPnl / notional) * 100, 2) : 0,
        holdingMs: Math.max(0, nowMs - position.entryTime),
      };
    });

    function spotFor(symbol: string): number | null {
      const quote = quoteMap.get(symbol.toUpperCase());
      return quote?.price && quote.price > 0 ? quote.price : null;
    }
  }, [positions, quoteMap, nowMs, underlying, effectiveExpiry, chainRowFor]);

  const pricedById = useMemo(
    () => new Map(pricedPositions.map((item) => [item.position.id, item])),
    [pricedPositions],
  );

  /* ------------------------------------------------------------- accounts */

  const realizedPnl = round(history.reduce((sum, trade) => sum + trade.netPnl, 0), 2);
  const openCashFlow = round(
    positions.reduce((sum, position) => {
      if (position.kind === "EQUITY") {
        return sum + sideSign(position.side) * position.entryPrice * position.quantity * -1;
      }
      return sum + position.entryNetPremium * (position.legs[0] ? legUnits(position.legs[0]) : 0);
    }, 0),
    2,
  );
  const blocked = round(positions.reduce((sum, position) => sum + position.blockedMargin, 0), 2);
  const cash = round(INITIAL_CAPITAL + realizedPnl + openCashFlow, 2);
  const available = round(cash - blocked, 2);
  const unrealized = round(pricedPositions.reduce((sum, item) => sum + item.grossPnl, 0), 2);
  const winCount = history.filter((trade) => trade.netPnl > 0).length;
  const winRate = history.length ? (winCount / history.length) * 100 : 0;
  const returns = useMemo(() => history.map((trade) => trade.netPnl), [history]);
  const risk = useMemo(() => calculateRiskMetrics(returns, INITIAL_CAPITAL), [returns]);

  /* ---------------------------------------------------- auto exits & expiry */

  const closePosition = useCallback(
    (priced: PricedPosition, reason: PaperTradeRecord["exitReason"], reflection: string, exitTimeMs: number) => {
      const position = priced.position;
      if (!desk || !desk.positions.some((item) => item.id === position.id)) return;
      const exitPremiumFor = (leg: PaperLeg) => {
        if (reason === "EXPIRY") {
          // Settlement needs a real underlying print; the caller only requests
          // EXPIRY when `settlePrice` is present.
          const lastSpot = priced.settlePrice ?? leg.strike;
          return round(intrinsic(leg.instrument, lastSpot, leg.strike), 2);
        }
        return priced.marks.get(leg.id) ?? leg.entryPremium;
      };

      let record: PaperTradeRecord;

      if (position.kind === "EQUITY") {
        const exitPrice = priced.currentPrice;
        const grossPnl = round(
          (exitPrice - position.entryPrice) * position.quantity * sideSign(position.side),
          2,
        );
        const exitFriction = frictionOn
          ? calculateFriction("EQUITY", exitPrice * position.quantity, position.side === "BUY").totalFriction
          : 0;
        record = {
          id: `trd-${exitTimeMs}-${position.id}`,
          kind: "EQUITY",
          symbol: position.symbol,
          name: position.name,
          side: position.side,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          exitPrice,
          grossPnl,
          netPnl: round(grossPnl - position.frictionCost - exitFriction, 2),
          pnlPct: position.entryPrice > 0 ? round((grossPnl / (position.entryPrice * position.quantity)) * 100, 2) : 0,
          frictionCost: round(position.frictionCost + exitFriction, 2),
          thesis: position.thesis,
          thesisTag: position.thesisTag,
          postMortem: reflection.trim() || undefined,
          facultyScore: undefined,
          entryTime: position.entryTime,
          exitTime: exitTimeMs,
          exitReason: reason,
          session: position.session,
        };
      } else {
        const tradeLegs: TradeLeg[] = position.legs.map((leg) => {
          const exitPremium = exitPremiumFor(leg);
          const legPnl = round((exitPremium - leg.entryPremium) * legUnits(leg) * sideSign(leg.side), 2);
          return { ...leg, exitPremium, legPnl };
        });
        const grossPnl = round(tradeLegs.reduce((sum, leg) => sum + leg.legPnl, 0), 2);
        const exitFriction = frictionOn
          ? tradeLegs.reduce(
              (sum, leg) =>
                sum +
                calculateFriction(
                  leg.instrument === "CE" ? "CALL" : "PUT",
                  leg.exitPremium * legUnits(leg),
                  leg.side === "BUY",
                ).totalFriction,
              0,
            )
          : 0;
        const exitNet = netPremium(position.legs, (leg) => tradeLegs.find((item) => item.id === leg.id)?.exitPremium ?? leg.entryPremium);
        const notional = position.legs.reduce((sum, leg) => sum + Math.abs(leg.entryPremium) * legUnits(leg), 0);
        const unitsValue = position.legs[0] ? legUnits(position.legs[0]) : 1;

        record = {
          id: `trd-${exitTimeMs}-${position.id}`,
          kind: "OPTIONS",
          symbol: position.symbol,
          name: position.name,
          side: position.entryNetPremium >= 0 ? "SELL" : "BUY",
          quantity: unitsValue,
          entryPrice: round(Math.abs(position.entryNetPremium), 2),
          exitPrice: round(Math.abs(exitNet), 2),
          grossPnl,
          netPnl: round(grossPnl - position.frictionCost - exitFriction, 2),
          pnlPct: notional > 0 ? round((grossPnl / notional) * 100, 2) : 0,
          frictionCost: round(position.frictionCost + exitFriction, 2),
          strategyId: position.strategyId,
          strategyName: position.strategyName,
          entryNetPremium: round(position.entryNetPremium, 2),
          exitNetPremium: round(exitNet, 2),
          legs: tradeLegs,
          thesis: position.thesis,
          thesisTag: position.thesisTag,
          postMortem: reflection.trim() || undefined,
          facultyScore: undefined,
          entryTime: position.entryTime,
          exitTime: exitTimeMs,
          exitReason: reason,
          session: position.session,
        };
      }

      if (!desk) return;
      persist({
        ...desk,
        positions: desk.positions.filter((item) => item.id !== position.id),
        history: [record, ...desk.history],
      });
    },
    [desk, frictionOn, persist],
  );

  // Rule execution is an external side effect reacting to fresh marks; the
  // setState happens inside closePosition, not in the render path.
  /* eslint-disable react-hooks/set-state-in-effect -- automated exits */
  useEffect(() => {
    if (!desk) return;
    for (const priced of pricedPositions) {
      const position = priced.position;
      if (closingRef.current.has(position.id)) continue;

      let reason: PaperTradeRecord["exitReason"] | null = null;

      if (position.kind === "EQUITY") {
        const long = position.side === "BUY";
        if (position.target && (long ? priced.currentPrice >= position.target : priced.currentPrice <= position.target)) {
          reason = "TARGET";
        } else if (position.stop && (long ? priced.currentPrice <= position.stop : priced.currentPrice >= position.stop)) {
          reason = "STOP_LOSS";
        }
      } else {
        const expired = position.legs.every((leg) => isExpired(leg.expiry, nowMs));
        if (expired && priced.settlePrice !== null) {
          reason = "EXPIRY";
        } else if (expired) {
          // No underlying print yet: hold and settle on the next tick rather
          // than guessing a spot price.
          continue;
        } else if (position.target && premiumCrossed(position.entryNetPremium, position.target, priced.currentNet)) {
          reason = "TARGET";
        } else if (position.stop && premiumCrossed(position.entryNetPremium, position.stop, priced.currentNet)) {
          reason = "STOP_LOSS";
        }
      }

      if (!reason) continue;
      closingRef.current.add(position.id);
      const note =
        reason === "EXPIRY"
          ? "Automated settlement: the contract expired. The position was closed at intrinsic value."
          : reason === "TARGET"
            ? "Automated rule execution: profit target touched."
            : "Automated rule execution: stop-loss executed.";
      closePosition(priced, reason, note, nowMs);
    }
  }, [pricedPositions, nowMs, desk, closePosition]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* -------------------------------------------------------------- orders */

  const applySlippage = (price: number, side: "BUY" | "SELL", mode: "EQUITY" | "OPTIONS") => {
    if (!frictionOn) return price;
    const rate = mode === "OPTIONS" ? OPTION_SLIPPAGE : EQUITY_SLIPPAGE;
    return round(side === "BUY" ? price * (1 + rate) : price * (1 - rate), 2);
  };

  const handlePlaceEquity = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!desk) return;

    const symbol = equitySymbol.trim().toUpperCase();
    if (!isEquityTradable(symbol)) {
      setError("Cash desk trades NSE equities only. Index symbols are available through options.");
      return;
    }
    if (!thesis.trim() || thesis.trim().length < 10) {
      setError("Mandatory lab policy: write at least a one-line thesis explaining the trade.");
      return;
    }
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      setError("Quantity must be a whole number of shares.");
      return;
    }
    const price = equityQuote?.price && equityQuote.price > 0 ? equityQuote.price : 0;
    if (price <= 0) {
      setError("No live price for this symbol. Pick a listed NSE equity.");
      return;
    }
    const orderValue = equityCash(quantity, price);
    if (orderValue > available) {
      setError(
        `Insufficient cash. Required ${inr(orderValue)}, available ${inr(available)}. Cash equity is delivery — no leverage.`,
      );
      return;
    }

    const executed = applySlippage(price, "BUY", "EQUITY");
    const turnover = executed * quantity;
    const entryFriction = frictionOn ? calculateFriction("EQUITY", turnover, true).totalFriction : 0;

    const position: EquityPosition = {
      id: `pos-${nowMs}-${desk.positions.length}`,
      kind: "EQUITY",
      symbol,
      name: equityQuote?.name ?? symbol,
      side: "BUY",
      quantity,
      entryPrice: executed,
      target: target > 0 ? target : undefined,
      stop: stop > 0 ? stop : undefined,
      thesis: thesis.trim(),
      thesisTag,
      frictionCost: entryFriction,
      entryTime: nowMs,
      session: replayActive && preset ? { mode: "REPLAY", presetId: preset.id } : { mode: "LIVE" },
      blockedMargin: 0,
    };

    persist({ ...desk, positions: [position, ...desk.positions] });
    setThesis("");
    setNotice(`Filled BUY ${quantity} ${symbol} @ ${inr(executed, 2)}.`);
  };

  const handlePlaceOptions = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!desk) return;

    if (replayActive) {
      setError("Options are live-feed only. The replay desk trades cash equities.");
      return;
    }
    const requiredLevel: DeskLevel = strategy === "NAKED_SHORT" ? "OPTIONS_LONG" : STRATEGY_LEVEL[strategy];
    if (!resolved.unlocked[requiredLevel]) {
      setError("This strategy is locked. Complete the requirements or use a faculty override.");
      return;
    }
    if (strategy === "NAKED_SHORT" && !access.acknowledgedWritingRisk) {
      setError("Accept the naked-short risk acknowledgment before writing options.");
      return;
    }
    if (!chain) {
      setError("Option chain unavailable. The desk will not invent a premium — try again when the chain loads.");
      return;
    }
    if (!buildLegs.length) {
      setError("Choose an underlying, expiry and strike first.");
      return;
    }
    if (!thesis.trim() || thesis.trim().length < 10) {
      setError("Mandatory lab policy: write at least a one-line thesis explaining the trade.");
      return;
    }
    if (lots < 1 || !Number.isInteger(lots)) {
      setError("Lots must be a whole number, at least 1.");
      return;
    }
    if (buildLegs.some((leg) => isExpired(leg.expiry, nowMs))) {
      setError("That series has already expired. Pick the next expiry.");
      return;
    }
    if (unpricedLegs.length) {
      setError(
        `No chain quote for ${unpricedLegs
          .map((leg) => `${leg.strike} ${leg.instrument}`)
          .join(", ")}. Move the strike or narrow the wing — the desk will not fill at a guessed premium.`,
      );
      return;
    }

    const executedLegs = buildLegs.map((leg) => ({
      ...leg,
      entryPremium: applySlippage(leg.entryPremium, leg.side, "OPTIONS"),
    }));
    const executedUnits = legUnits(executedLegs[0]);
    const executedNet = netPremium(executedLegs, (leg) => leg.entryPremium);
    const executedNetCash = round(executedNet * executedUnits, 2);
    const executedMargin = optionsMargin(executedLegs, spot);
    const needed = round(Math.max(0, -executedNetCash) + executedMargin.required, 2);

    if (needed > available) {
      setError(
        `Insufficient margin. Required ${inr(needed)} (${executedMargin.basis === "SPAN_LIKE" ? "naked-short block" : "premium + blocked risk"}), available ${inr(available)}.`,
      );
      return;
    }

    const entryFriction = frictionOn
      ? executedLegs.reduce(
          (sum, leg) =>
            sum +
            calculateFriction(
              leg.instrument === "CE" ? "CALL" : "PUT",
              leg.entryPremium * legUnits(leg),
              leg.side === "BUY",
            ).totalFriction,
          0,
        )
      : 0;

    const position: OptionsPosition = {
      id: `pos-${nowMs}-${desk.positions.length}`,
      kind: "OPTIONS",
      symbol: underlying,
      name: underlying,
      strategyId: strategy,
      strategyName: STRATEGY_LABEL[strategy],
      legs: executedLegs,
      entryNetPremium: executedNet,
      target: target || undefined,
      stop: stop || undefined,
      thesis: thesis.trim(),
      thesisTag,
      frictionCost: entryFriction,
      entryTime: nowMs,
      session: { mode: "LIVE" },
      blockedMargin: executedMargin.required,
    };

    persist({ ...desk, positions: [position, ...desk.positions] });
    setThesis("");
    setNotice(
      `Filled ${STRATEGY_LABEL[strategy]} — ${executedLegs.length} leg${executedLegs.length === 1 ? "" : "s"}, ${lots} lot${lots === 1 ? "" : "s"} (${executedUnits} units).`,
    );
  };

  /* --------------------------------------------------------------- quiz */

  const submitQuiz = () => {
    const score = scoreCheckpoint(quizAnswers);
    setQuizRevealed(true);
    updateAccess({
      quiz: {
        best: Math.max(access.quiz.best, score),
        attempts: access.quiz.attempts + 1,
        passedAt: score === CHECKPOINT_QUESTIONS.length ? new Date().toISOString() : access.quiz.passedAt,
      },
    });
  };

  /* --------------------------------------------------------------- close */

  const requestClose = (priced: PricedPosition, reason: "MANUAL" | "TARGET" | "STOP_LOSS") => {
    setPostMortem("");
    setClosing({ position: priced, reason });
  };

  const confirmClose = () => {
    if (!closing) return;
    closePosition(closing.position, closing.reason, postMortem, nowMs);
    setClosing(null);
    setPostMortem("");
  };

  const exportCsv = () => {
    const header = [
      "id",
      "session",
      "kind",
      "symbol",
      "strategy",
      "legs",
      "side",
      "units",
      "entry",
      "exit",
      "gross_pnl",
      "friction",
      "net_pnl",
      "pnl_pct",
      "exit_reason",
      "entry_time",
      "exit_time",
      "thesis",
      "post_mortem",
      "faculty_score",
    ];
    const rows = history.map((trade) => [
      trade.id,
      trade.session.mode,
      trade.kind,
      trade.symbol,
      trade.kind === "OPTIONS" ? trade.strategyName : "Equity cash",
      trade.kind === "OPTIONS"
        ? trade.legs.map((leg) => `${leg.side} ${leg.strike} ${leg.instrument}`).join(" | ")
        : "",
      trade.side,
      trade.quantity,
      trade.entryPrice,
      trade.exitPrice,
      trade.grossPnl,
      trade.frictionCost,
      trade.netPnl,
      trade.pnlPct,
      trade.exitReason,
      new Date(trade.entryTime).toISOString(),
      new Date(trade.exitTime).toISOString(),
      trade.thesis,
      trade.postMortem ?? "",
      trade.facultyScore ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `paper-trades-${preset?.id ?? "live"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------------------------------------------------------- view */

  if (!isOpen) return null;

  const levelCheck = resolved.checks[activeLevel];
  const levelLocked = !resolved.unlocked[activeLevel];
  const nextRequirement = levelCheck.requirements.find((item) => !item.met);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Virtual Paper Trading Desk"
      className="fixed inset-0 z-50 flex justify-end animate-[fadeIn_150ms_ease-out]"
    >
      <button
        type="button"
        aria-label="Close Paper Trading Desk"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm"
      />

      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-line-strong bg-bg shadow-2xl animate-[slideLeft_200ms_ease-out]">
        <header className="flex items-center justify-between border-b border-line bg-panel px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-up/40 bg-up/15 text-lg font-bold text-up">
              📝
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide text-ink">Virtual Paper Trading Desk</h2>
                <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan">
                  {LEVEL_LABEL[resolved.current]}
                </span>
                <FeedBadge replay={replayActive} status={feedStatus} />
              </div>
              <p className="text-[11px] text-muted">
                Cash delivery · index options with chain pricing · margin, lots and expiry enforced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-1.5 rounded-md border border-line bg-panel2 px-2 py-1 text-[10px] text-muted sm:flex">
              <input
                type="checkbox"
                checked={frictionOn}
                onChange={(event) => desk && persist({ ...desk, friction: event.target.checked })}
                className="rounded accent-cyan"
              />
              <span>Friction</span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (!preset) {
                  if (window.confirm("Reset the live desk and every replay ledger?")) {
                    resetDesk();
                    setDesk(loadDeskState());
                  }
                  return;
                }
                if (window.confirm(`Reset the replay ledger for "${preset.title}"?`)) {
                  persistReplay(preset.id, { schemaVersion: 2, positions: [], history: [] });
                  setDesk({
                    schemaVersion: 2,
                    positions: [],
                    history: [],
                    access: DEFAULT_ACCESS,
                    friction: true,
                    updatedAt: 0,
                  });
                }
              }}
              className="rounded border border-line bg-panel2 px-2 py-1 text-[10px] text-muted transition-colors hover:text-down"
            >
              Reset
            </button>
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

        {replayActive && preset ? (
          <div className="border-b border-accent/40 bg-accent/10 px-5 py-1.5 text-[11px] text-accent">
            ⏪ Replay · {preset.title} · {simClockLabel(replay?.progressPct ?? 0)} — cash equities only.
            Replay trades are kept in a separate ledger and are not part of the graded report.
          </div>
        ) : null}

        <div className="border-b border-line bg-panel2/60 p-3">
          <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs sm:grid-cols-6">
            <Stat label="Free margin" value={inr(available)} tone={available >= 0 ? "ink" : "down"} />
            <Stat label="Blocked" value={inr(blocked)} />
            <Stat label="Unrealised" value={signedInr(unrealized)} tone={unrealized >= 0 ? "up" : "down"} />
            <Stat label="Realised" value={signedInr(realizedPnl)} tone={realizedPnl >= 0 ? "up" : "down"} />
            <Stat label="Win rate" value={`${winRate.toFixed(0)}%`} tone="cyan" />
            <Stat label="Max drawdown" value={`−${risk.maxDrawdownPct}%`} tone="down" />
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Level selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {DESK_LEVELS.map((item) => {
              const unlocked = resolved.unlocked[item];
              const active = activeLevel === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setLevelTouched(true);
                    setLevel(item);
                  }}
                  className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                    active
                      ? "border-cyan bg-cyan/15 text-cyan"
                      : unlocked
                        ? "border-line bg-panel2 text-muted hover:text-ink"
                        : "border-line/60 bg-panel2/40 text-muted/50"
                  }`}
                  disabled={replayActive && item !== "EQUITY"}
                  title={
                    replayActive && item !== "EQUITY"
                      ? "Replay is cash-equity only"
                      : unlocked
                        ? LEVEL_LABEL[item]
                        : `${LEVEL_LABEL[item]} — locked`
                  }
                >
                  {!unlocked ? <span aria-hidden>🔒</span> : null}
                  {LEVEL_LABEL[item]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setFacultyOpen((open) => !open)}
              className="ml-auto rounded border border-line bg-panel px-2 py-1 text-[10px] text-muted hover:text-ink"
            >
              Faculty overrides
            </button>
          </div>

          {facultyOpen ? (
            <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-[11px]">
              <div className="font-bold text-accent">Faculty overrides (plain toggle)</div>
              <p className="text-muted">
                These bypass the progression gates on this machine. They do not change the
                report; a trade still needs a thesis and a debrief.
              </p>
              <div className="flex flex-wrap gap-3">
                {(["OPTIONS_LONG", "OPTIONS_SPREADS", "OPTIONS_WRITING"] as DeskLevel[]).map((item) => (
                  <label key={item} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={access.overrides[item]}
                      onChange={(event) =>
                        updateAccess({ overrides: { ...access.overrides, [item]: event.target.checked } })
                      }
                      className="rounded accent-accent"
                    />
                    {LEVEL_LABEL[item]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {replayActive ? (
            <div className="rounded-lg border border-line bg-panel px-4 py-3 text-[11px] text-muted">
              Replay desks are cash-only: historical option chains are not available, and the
              desk will not fabricate a premium. Switch back to the live feed to trade options.
            </div>
          ) : null}

          {levelLocked ? (
            <LockPanel
              check={levelCheck}
              nextRequirement={nextRequirement}
              access={access}
              onSelectLevel={(next) => {
                setLevelTouched(true);
                setLevel(next);
              }}
              quizAnswers={quizAnswers}
              setQuizAnswers={setQuizAnswers}
              revealed={quizRevealed}
              onSubmitQuiz={submitQuiz}
            />
          ) : ticketMode === "EQUITY" ? (
            <form onSubmit={handlePlaceEquity} className="space-y-3.5 rounded-xl border border-line bg-panel p-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Cash delivery ticket</span>
                <span className="font-mono text-[10px] text-muted">T+1 · full notional · long only</span>
              </div>

              {error ? <ErrorNote text={error} /> : null}
              {notice ? <NoticeNote text={notice} /> : null}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Symbol">
                  <input
                    value={equitySymbol}
                    onChange={(event) => setEquitySymbol(event.target.value.toUpperCase())}
                    placeholder="RELIANCE"
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs uppercase text-ink focus:border-cyan"
                  />
                </Field>
                <Field label="Live price">
                  <div className="flex h-[30px] items-center justify-between rounded border border-line bg-panel2 px-2.5 font-mono text-xs">
                    <span className="text-ink">{equityQuote ? inr(equityQuote.price, 2) : "—"}</span>
                    <span className={equityQuote && equityQuote.changePct >= 0 ? "text-up" : "text-down"}>
                      {equityQuote ? `${equityQuote.changePct >= 0 ? "+" : ""}${equityQuote.changePct.toFixed(2)}%` : ""}
                    </span>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Shares">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Math.round(Number(event.target.value) || 1)))}
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-ink focus:border-cyan"
                  />
                </Field>
                <Field label="Target (₹)">
                  <input
                    type="number"
                    step="0.05"
                    value={target || ""}
                    onChange={(event) => setTarget(Number(event.target.value))}
                    placeholder="not set"
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-up focus:border-up"
                  />
                </Field>
                <Field label="Stop (₹)">
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="0.05"
                      value={stop || ""}
                      onChange={(event) => setStop(Number(event.target.value))}
                      placeholder="not set"
                      className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-down focus:border-down"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = suggestedStop(equityLivePrice, "BUY", equityQuote);
                        setStop(suggested.stop);
                      }}
                      className="shrink-0 rounded border border-line bg-panel2 px-1.5 text-[9px] text-muted hover:text-ink"
                      title="Suggest a stop from today's range"
                    >
                      auto
                    </button>
                  </div>
                </Field>
                <Field label="Risk : reward">
                  <RrBadge rr={equityRR} />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span className="font-bold uppercase">Set target at</span>
                {[1, 1.5, 2, 3].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    disabled={!stop}
                    onClick={() => setTarget(targetAtRatio(equityLivePrice, stop, ratio, "BUY"))}
                    className="rounded border border-line bg-panel2 px-2 py-0.5 disabled:opacity-40"
                  >
                    1:{ratio}
                  </button>
                ))}
                <span className="ml-auto font-mono">
                  Order value <strong className="text-ink">{inr(equityNeeded)}</strong>
                </span>
              </div>

              <ThesisField
                thesis={thesis}
                setThesis={setThesis}
                tag={thesisTag}
                setTag={setThesisTag}
                tags={THESIS_TAGS}
              />

              <button
                type="submit"
                className="w-full rounded-lg bg-up px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-up/90"
              >
                Place cash BUY →
              </button>
            </form>
          ) : (
            <form onSubmit={handlePlaceOptions} className="space-y-3 rounded-xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Options ticket</span>
                <span className="font-mono text-[10px] text-muted">
                  Chain IV · Black-Scholes mark · premium from NSE
                </span>
              </div>

              {error ? <ErrorNote text={error} /> : null}
              {notice ? <NoticeNote text={notice} /> : null}

              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STRATEGY_LABEL) as OptionsStrategyId[]).map((item) => {
                  const allowed =
                    item === "NAKED_SHORT"
                      ? // Selectable with options unlocked; the ticket itself requires
                        // the risk acknowledgment before an order can be submitted.
                        resolved.unlocked.OPTIONS_LONG
                      : resolved.unlocked[STRATEGY_LEVEL[item]];
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={!allowed}
                      onClick={() => setStrategy(item)}
                      className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                        strategy === item
                          ? "bg-cyan text-black"
                          : allowed
                            ? "border border-line bg-panel2 text-muted hover:text-ink"
                            : "border border-line/50 bg-panel2/30 text-muted/40"
                      }`}
                      title={allowed ? STRATEGY_LABEL[item] : "Locked — see the level requirements"}
                    >
                      {STRATEGY_LABEL[item]}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Underlying">
                  <select
                    value={underlying}
                    onChange={(event) => setUnderlying(event.target.value)}
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-ink"
                  >
                    {INDEX_UNDERLYINGS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Expiry">
                  <select
                    value={effectiveExpiry}
                    onChange={(event) => setExpiry(event.target.value)}
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-ink"
                    disabled={!chain}
                  >
                    {(chain?.expiries?.length ? chain.expiries : effectiveExpiry ? [effectiveExpiry] : []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    {!chain ? <option value="">chain unavailable</option> : null}
                  </select>
                </Field>
                <Field label="Strike (ATM ±)">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setStrike(Math.max(step, effectiveStrike - step))}
                      className="rounded border border-line bg-panel2 px-1.5 py-1 text-[10px] text-muted"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step={step}
                      value={effectiveStrike || ""}
                      onChange={(event) => setStrike(Number(event.target.value))}
                      className="w-full rounded border border-line bg-panel2 px-2 py-1.5 text-center font-mono text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => setStrike(effectiveStrike + step)}
                      className="rounded border border-line bg-panel2 px-1.5 py-1 text-[10px] text-muted"
                    >
                      +
                    </button>
                  </div>
                </Field>
                <Field label="Lots">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={lots}
                      onChange={(event) => setLots(Math.max(1, Math.round(Number(event.target.value) || 1)))}
                      className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-ink"
                    />
                    <span className="shrink-0 text-[9px] font-mono text-muted">
                      ×{lotSizeFor(underlying)} = {unitsForLots(underlying, lots)}
                    </span>
                  </div>
                </Field>
              </div>

              {strategy === "NAKED_SHORT" || (strategy === "SINGLE_LONG" && optionKind === "PE") ? (
                <div className="flex gap-1.5">
                  {(["CE", "PE"] as OptionKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setOptionKind(kind)}
                      className={`rounded px-3 py-1 text-[10px] font-bold ${
                        optionKind === kind ? "bg-cyan text-black" : "border border-line bg-panel2 text-muted"
                      }`}
                    >
                      {kind === "CE" ? "Call (CE)" : "Put (PE)"}
                    </button>
                  ))}
                </div>
              ) : null}

              {strategy === "BULL_CALL" || strategy === "BEAR_PUT" || strategy === "IRON_CONDOR" ? (
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                  <span className="uppercase">Wing width</span>
                  <select
                    value={wingSteps}
                    onChange={(event) => setWingSteps(Number(event.target.value))}
                    className="rounded border border-line bg-panel2 px-2 py-1 text-ink"
                  >
                    {[1, 2, 3, 4].map((item) => (
                      <option key={item} value={item}>
                        {item * step} pts
                      </option>
                    ))}
                  </select>
                  <span className="ml-auto">
                    ATM {atmStrike} · {spot ? `spot ${inr(spot, 2)}` : "no quote"}
                  </span>
                </div>
              ) : null}

              {!chain && chainPoll.loading ? (
                <div className="rounded border border-line bg-panel2/40 px-3 py-2 text-[11px] text-muted">
                  Loading option chain…
                </div>
              ) : null}
              {!chain && !chainPoll.loading ? (
                <div className="rounded border border-down/40 bg-down/10 px-3 py-2 text-[11px] text-down">
                  Option chain unavailable ({chainPoll.error ?? "no data"}). Options are disabled rather than
                  priced from a guess.
                </div>
              ) : null}

              <LegTable legs={buildLegs} marks={null} />

              {unpricedLegs.length ? (
                <div className="rounded border border-down/40 bg-down/10 px-3 py-2 text-[11px] text-down">
                  No chain quote for{" "}
                  {unpricedLegs.map((leg) => `${leg.strike} ${leg.instrument}`).join(", ")}. The premiums above
                  are Black-Scholes previews for context only — this structure cannot be filled.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Net premium" value={`${netPremiumEntry >= 0 ? "credit " : "debit "}${inr(Math.abs(netPremiumEntry), 2)}`} />
                <MiniStat
                  label="Margin blocked"
                  value={inr(margin.required)}
                  hint={margin.detail}
                />
                <MiniStat
                  label="Max loss"
                  value={profile.unbounded ? "Unlimited" : inr(profile.maxLoss)}
                  tone={profile.unbounded ? "down" : "ink"}
                />
                <MiniStat
                  label="Breakeven"
                  value={bePoints.length ? bePoints.join(" / ") : "—"}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 rounded-lg border border-line bg-panel2/50 p-2 text-center font-mono">
                <GreekCell label="Δ delta" value={greeks.delta.toFixed(2)} />
                <GreekCell label="Γ gamma" value={greeks.gamma.toFixed(4)} />
                <GreekCell label="Θ / day" value={greeks.theta.toFixed(2)} tone="down" />
                <GreekCell label="ν / vol" value={greeks.vega.toFixed(2)} tone="cyan" />
              </div>

              {payoff.length ? <PayoffChart points={payoff} breakevens={bePoints} spot={spot} /> : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Target net premium">
                  <input
                    type="number"
                    step="0.05"
                    value={target || ""}
                    onChange={(event) => setTarget(Number(event.target.value))}
                    placeholder="not set"
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-up"
                  />
                </Field>
                <Field label="Stop net premium">
                  <input
                    type="number"
                    step="0.05"
                    value={stop || ""}
                    onChange={(event) => setStop(Number(event.target.value))}
                    placeholder="not set"
                    className="w-full rounded border border-line bg-panel2 px-2.5 py-1.5 font-mono text-xs text-down"
                  />
                </Field>
                <Field label="Risk : reward">
                  <RrBadge rr={optionRR} />
                </Field>
                <Field label="Order cash flow">
                  <div className="font-mono text-xs">
                    <span className="text-ink">{netCash >= 0 ? `+${inr(netCash)}` : inr(netCash)}</span>
                    <span className="block text-[9px] text-muted">
                      {netCash >= 0 ? "credit received" : "debit paid"} · {optionUnits} units
                    </span>
                  </div>
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span className="font-bold uppercase">Quick levels</span>
                <button
                  type="button"
                  onClick={() => {
                    const base = optionEntryRef;
                    const riskUnit = Math.max(1, Math.abs(base) * 0.5);
                    const stopLevel = tradeSide === "BUY" ? base - riskUnit : base + riskUnit;
                    setStop(round(stopLevel, 2));
                    setTarget(targetAtRatio(base, stopLevel, 2, tradeSide));
                  }}
                  className="rounded border border-line bg-panel2 px-2 py-0.5"
                >
                  50% stop · 1:2 target
                </button>
                <span className="ml-auto font-mono">
                  Margin basis: <strong className="text-ink">{margin.basis.replace("_", " ")}</strong>
                </span>
              </div>

              {strategy === "NAKED_SHORT" ? (
                <div className="space-y-2 rounded-lg border border-down/40 bg-down/10 p-2.5 text-[11px]">
                  <div className="font-bold text-down">Naked short: loss is not capped</div>
                  <p className="text-muted">
                    You are collecting {inr(Math.abs(netCash))} of premium against a block of{" "}
                    {inr(margin.required)} ({SPAN_NOTIONAL_PCT * 100}% of notional or premium + 7% exposure).
                    A short call loses as the index rises; a short put loses as it falls.
                  </p>
                  <label className="flex items-start gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={access.acknowledgedWritingRisk}
                      onChange={(event) => updateAccess({ acknowledgedWritingRisk: event.target.checked })}
                      className="mt-0.5 rounded accent-down"
                    />
                    <span>I understand the margin block and the uncapped loss on a naked short.</span>
                  </label>
                </div>
              ) : null}

              <ThesisField
                thesis={thesis}
                setThesis={setThesis}
                tag={thesisTag}
                setTag={setThesisTag}
                tags={THESIS_TAGS}
              />

              <button
                type="submit"
                disabled={!chain || unpricedLegs.length > 0}
                title={
                  unpricedLegs.length
                    ? "One or more strikes have no chain quote"
                    : "Place the order at the live chain premium"
                }
                className={`w-full rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-40 ${
                  tradeSide === "SELL" ? "bg-down hover:bg-down/90" : "bg-up hover:bg-up/90"
                }`}
              >
                Place {STRATEGY_LABEL[strategy]} →
              </button>
            </form>
          )}

          {/* Positions */}
          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line bg-panel2/40 px-4 py-2.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
                <span>📊</span> Open positions ({positions.length})
              </h3>
              <span className="font-mono text-[10px] text-muted">
                Guardrails: {frictionOn ? "on" : "off"} · auto target / stop / expiry
              </span>
            </div>

            {positions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted">
                No open positions. Place a trade above to start.
              </div>
            ) : (
              <div className="divide-y divide-line/60">
                {pricedPositions.map((priced) => (
                  <PositionRow
                    key={priced.position.id}
                    priced={priced}
                    nowMs={nowMs}
                    onClose={() => requestClose(priced, "MANUAL")}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Journal */}
          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line bg-panel2/40 px-4 py-2.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
                <span>📜</span> Closed journal ({history.length})
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted">
                  Sharpe {risk.sharpeRatio} · PF {risk.profitFactor}
                </span>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="rounded border border-line bg-panel px-2 py-0.5 text-[10px] text-muted hover:text-cyan"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">No closed trades yet.</div>
            ) : (
              <div className="divide-y divide-line/60">
                {history.slice(0, 12).map((trade) => (
                  <JournalRow
                    key={trade.id}
                    trade={trade}
                    onScore={(score) =>
                      desk &&
                      persist({
                        ...desk,
                        history: desk.history.map((item) =>
                          item.id === trade.id ? { ...item, facultyScore: score } : item,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-line bg-panel px-5 py-3 text-xs">
          <div className="text-[11px] text-muted">
            Virtual capital {inr(INITIAL_CAPITAL)} · margin is a simplified SPAN-style model, not an exchange figure
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 font-medium text-ink hover:border-line-strong"
          >
            Close
          </button>
        </footer>

        {closing ? (
          <DebriefModal
            priced={closing.position}
            reason={closing.reason}
            text={postMortem}
            setText={setPostMortem}
            onCancel={() => setClosing(null)}
            onConfirm={confirmClose}
          />
        ) : null}
      </aside>
    </div>
  );
}

/* --------------------------------------------------------------- helpers */

interface PricedPosition {
  position: PaperPosition;
  marks: Map<string, number>;
  currentNet: number;
  currentPrice: number;
  /** Underlying price used to settle at expiry; null while no quote exists. */
  settlePrice: number | null;
  grossPnl: number;
  pnlPct: number;
  holdingMs: number;
}

function premiumCrossed(entryNet: number, level: number, currentNet: number): boolean {
  const upwards = level > entryNet;
  return upwards ? currentNet >= level : currentNet <= level;
}

function Stat({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "up" | "down" | "cyan" }) {
  const colour = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "cyan" ? "text-cyan" : "text-ink";
  return (
    <div className="rounded border border-line bg-panel p-1.5">
      <span className="block text-[9px] uppercase tracking-wider text-muted">{label}</span>
      <span className={`font-bold ${colour}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}

function MiniStat({ label, value, hint, tone = "ink" }: { label: string; value: string; hint?: string; tone?: "ink" | "down" }) {
  return (
    <div className="rounded border border-line bg-panel2/40 p-2" title={hint}>
      <span className="block text-[9px] uppercase tracking-wider text-muted">{label}</span>
      <span className={`font-mono text-[11px] font-bold ${tone === "down" ? "text-down" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function GreekCell({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "down" | "cyan" }) {
  const colour = tone === "down" ? "text-down" : tone === "cyan" ? "text-cyan" : "text-ink";
  return (
    <div>
      <span className="block text-[9px] text-muted">{label}</span>
      <span className={`text-xs font-bold ${colour}`}>{value}</span>
    </div>
  );
}

function RrBadge({ rr }: { rr: number | null }) {
  const tone = rrTone(rr);
  const style =
    tone === "good"
      ? "border-up/40 bg-up/15 text-up"
      : tone === "ok"
        ? "border-accent/40 bg-accent/15 text-accent"
        : tone === "poor"
          ? "border-down/40 bg-down/15 text-down"
          : "border-line bg-panel2 text-muted";
  return (
    <div className={`flex h-[30px] items-center justify-center rounded border px-2 font-mono text-[11px] font-bold ${style}`}>
      {rrLabel(rr)}
      {tone === "poor" ? " · below 1" : tone === "good" ? " · ≥2" : ""}
    </div>
  );
}

function ErrorNote({ text }: { text: string }) {
  return <div className="rounded border border-down/40 bg-down/10 px-3 py-1.5 text-xs text-down">⚠️ {text}</div>;
}

function NoticeNote({ text }: { text: string }) {
  return <div className="rounded border border-up/40 bg-up/10 px-3 py-1.5 text-xs text-up">✓ {text}</div>;
}

function FeedBadge({ replay, status }: { replay: boolean; status: "live" | "delayed" | "demo" }) {
  const label = replay ? "REPLAY" : status === "live" ? "LIVE" : status === "delayed" ? "DELAYED" : "DEMO";
  const style = replay
    ? "border-accent/40 bg-accent/10 text-accent"
    : status === "live"
      ? "border-cyan/40 bg-cyan/10 text-cyan"
      : "border-line bg-panel2 text-muted";
  return (
    <span className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function ThesisField({
  thesis,
  setThesis,
  tag,
  setTag,
  tags,
}: {
  thesis: string;
  setThesis: (value: string) => void;
  tag: string;
  setTag: (value: string) => void;
  tags: readonly string[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTag(item)}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              tag === item
                ? "border border-accent/50 bg-accent/20 font-bold text-accent"
                : "border border-line bg-panel2 text-muted hover:text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={thesis}
        onChange={(event) => setThesis(event.target.value)}
        placeholder="Trade thesis and invalidation — required, minimum 10 characters."
        className="w-full rounded-md border border-line bg-panel2/70 px-3 py-2 text-xs text-ink placeholder:text-muted/50 focus:border-cyan focus:outline-none"
      />
    </div>
  );
}

function LockPanel({
  check,
  nextRequirement,
  access,
  onSelectLevel,
  quizAnswers,
  setQuizAnswers,
  revealed,
  onSubmitQuiz,
}: {
  check: ReturnType<typeof resolveAccess>["checks"][DeskLevel];
  nextRequirement?: { label: string; met: boolean; detail?: string };
  access: DeskState["access"];
  onSelectLevel: (level: DeskLevel) => void;
  quizAnswers: Array<number | null>;
  setQuizAnswers: (answers: Array<number | null>) => void;
  revealed: boolean;
  onSubmitQuiz: () => void;
}) {
  const passed = access.quiz.best >= CHECKPOINT_QUESTIONS.length;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div>
          <div className="text-xs font-bold text-ink">🔒 {check.label} is locked</div>
          <div className="text-[11px] text-muted">
            {nextRequirement ? `Next: ${nextRequirement.label}` : "Complete the steps below."}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectLevel("EQUITY")}
          className="rounded border border-line bg-panel2 px-2 py-1 text-[10px] text-muted hover:text-ink"
        >
          Use cash desk
        </button>
      </div>

      <ul className="space-y-1.5 text-[11px]">
        {check.requirements.map((requirement) => (
          <li key={requirement.label} className="flex items-start gap-2">
            <span className={requirement.met ? "text-up" : "text-muted"}>{requirement.met ? "✓" : "○"}</span>
            <span>
              <span className={requirement.met ? "text-ink" : "text-muted"}>{requirement.label}</span>
              {requirement.detail ? <span className="block text-[10px] text-muted">{requirement.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {check.id === "OPTIONS_LONG" && !passed ? (
        <div className="space-y-2 rounded-lg border border-cyan/20 bg-cyan/5 p-3">
          <div className="text-[11px] font-bold text-cyan">Derivatives checkpoint</div>
          {CHECKPOINT_QUESTIONS.map((question, index) => (
            <div key={question.id} className="space-y-1">
              <div className="text-[11px] text-ink">
                {index + 1}. {question.prompt}
              </div>
              <div className="flex flex-wrap gap-1">
                {question.options.map((option, optionIndex) => {
                  const chosen = quizAnswers[index] === optionIndex;
                  const correct = revealed && optionIndex === question.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        const next = [...quizAnswers];
                        next[index] = optionIndex;
                        setQuizAnswers(next);
                      }}
                      className={`rounded border px-2 py-0.5 text-[10px] ${
                        correct
                          ? "border-up/50 bg-up/15 text-up"
                          : chosen
                            ? "border-cyan/50 bg-cyan/15 text-cyan"
                            : "border-line bg-panel2 text-muted"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {revealed ? <div className="text-[10px] text-muted">{question.explanation}</div> : null}
            </div>
          ))}
          <button
            type="button"
            onClick={onSubmitQuiz}
            disabled={quizAnswers.some((answer) => answer === null)}
            className="w-full rounded bg-cyan px-3 py-1.5 text-[11px] font-bold text-black disabled:opacity-40"
          >
            Submit checkpoint ({quizAnswers.filter((answer) => answer !== null).length}/
            {CHECKPOINT_QUESTIONS.length})
          </button>
          {revealed ? (
            <div className="text-[10px] text-muted">
              Best score so far: {access.quiz.best}/{CHECKPOINT_QUESTIONS.length}. Three correct unlocks
              long options.
            </div>
          ) : null}
        </div>
      ) : null}

      {check.id === "OPTIONS_SPREADS" ? (
        <p className="text-[11px] text-muted">
          Close three long-option trades and write a post-mortem for each. Spreads are earned by
          process, not by profit.
        </p>
      ) : null}

      {check.id === "OPTIONS_WRITING" ? (
        <p className="text-[11px] text-muted">
          Writing is available as soon as options are unlocked. Tick the naked-short
          risk acknowledgment on the ticket to enable it; the loss is not capped.
        </p>
      ) : null}
    </div>
  );
}

function LegTable({ legs, marks }: { legs: PaperLeg[]; marks: Map<string, number> | null }) {
  if (!legs.length) return null;
  return (
    <div className="overflow-hidden rounded border border-line">
      <table className="w-full font-mono text-[10px]">
        <thead className="bg-panel2/60 text-[9px] uppercase text-muted">
          <tr>
            <th className="px-2 py-1 text-left">Leg</th>
            <th className="px-2 py-1 text-right">Strike</th>
            <th className="px-2 py-1 text-center">Side</th>
            <th className="px-2 py-1 text-right">Premium</th>
            <th className="px-2 py-1 text-right">IV</th>
            {marks ? <th className="px-2 py-1 text-right">Mark</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {legs.map((leg) => (
            <tr key={leg.id}>
              <td className="px-2 py-1 text-ink">
                {leg.instrument === "CE" ? "Call" : "Put"} {leg.expiry}
              </td>
              <td className="px-2 py-1 text-right text-ink">{leg.strike}</td>
              <td className={`px-2 py-1 text-center font-bold ${leg.side === "BUY" ? "text-up" : "text-down"}`}>
                {leg.side}
              </td>
              <td className="px-2 py-1 text-right text-ink">{inr(leg.entryPremium, 2)}</td>
              <td className="px-2 py-1 text-right text-muted">{leg.iv.toFixed(1)}%</td>
              {marks ? <td className="px-2 py-1 text-right text-ink">{inr(marks.get(leg.id) ?? leg.entryPremium, 2)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionRow({ priced, nowMs, onClose }: { priced: PricedPosition; nowMs: number; onClose: () => void }) {
  const { position } = priced;
  const profit = priced.grossPnl >= 0;
  const isOptions = position.kind === "OPTIONS";

  return (
    <div className="p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-ink">{position.symbol}</span>
          {isOptions ? (
            <span className="rounded bg-panel2 px-1.5 py-0.2 text-[9px] font-mono text-muted">
              {position.strategyName}
            </span>
          ) : (
            <span className="rounded bg-panel2 px-1.5 py-0.2 text-[9px] font-mono text-muted">CASH · BUY</span>
          )}
          <span className="rounded bg-panel2 px-1.5 py-0.2 font-mono text-[9px] text-muted">
            {isOptions
              ? `${position.legs[0]?.lots ?? 1} lot${(position.legs[0]?.lots ?? 1) === 1 ? "" : "s"} × ${position.legs[0]?.lotSize ?? 1}`
              : `${position.quantity} shares`}
          </span>
          {position.session.mode === "REPLAY" ? (
            <span className="rounded bg-accent/15 px-1.5 py-0.2 text-[9px] font-bold text-accent">REPLAY</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold ${profit ? "text-up" : "text-down"}`}>
            {signedInr(priced.grossPnl)} ({profit ? "+" : ""}
            {priced.pnlPct.toFixed(2)}%)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-line bg-panel px-2 py-0.5 text-[10px] text-muted hover:border-down/40 hover:text-down"
          >
            Square off
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-4">
        <div>
          <span className="block text-[9px] uppercase text-muted">Entry</span>
          <span className="text-ink">
            {inr(isOptions ? Math.abs(position.entryNetPremium) : position.entryPrice, 2)}
          </span>
          <span className="block text-[9px] text-muted">{timeIST(position.entryTime, true)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase text-muted">{isOptions ? "Net premium" : "Mark"}</span>
          <span className="text-ink">{inr(priced.currentNet, 2)}</span>
          <span className="block text-[9px] text-muted">blocked {inr(position.blockedMargin)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase text-muted">Holding</span>
          <span className="text-cyan">{formatDuration(Math.max(0, nowMs - position.entryTime))}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase text-muted">Target / stop</span>
          <span className="text-ink">
            {position.target ? inr(position.target, 2) : "—"} / {position.stop ? inr(position.stop, 2) : "—"}
          </span>
        </div>
      </div>

      {isOptions ? <LegTable legs={position.legs} marks={priced.marks} /> : null}
    </div>
  );
}

function JournalRow({ trade, onScore }: { trade: PaperTradeRecord; onScore: (score: number) => void }) {
  const profit = trade.netPnl >= 0;
  return (
    <div className="space-y-1.5 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-ink">{trade.symbol}</span>
          <span className="rounded bg-panel2 px-1.5 py-0.2 font-mono text-[9px] text-muted">
            {trade.kind === "OPTIONS" ? trade.strategyName : "CASH"}
          </span>
          <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${trade.side === "BUY" ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
            {trade.side}
          </span>
          <span className="rounded bg-accent/15 px-1.5 py-0.2 text-[9px] text-accent">{trade.thesisTag ?? "General"}</span>
          {trade.session.mode === "REPLAY" ? (
            <span className="rounded bg-accent/15 px-1.5 py-0.2 text-[9px] font-bold text-accent">REPLAY</span>
          ) : null}
        </div>
        <span className={`font-mono font-bold ${profit ? "text-up" : "text-down"}`}>
          {signedInr(trade.netPnl)} ({profit ? "+" : ""}
          {trade.pnlPct.toFixed(2)}%)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded border border-line/60 bg-panel2/40 p-2 font-mono text-[10px] sm:grid-cols-4">
        <div>
          <span className="block text-[9px] uppercase text-muted">Entry</span>
          <span className="text-ink">{inr(trade.entryPrice, 2)}</span>
          <span className="block text-[9px] text-muted">{timeIST(trade.entryTime, true)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase text-muted">Exit</span>
          <span className="text-ink">{inr(trade.exitPrice, 2)}</span>
          <span className="block text-[9px] text-muted">{timeIST(trade.exitTime, true)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase text-muted">Duration</span>
          <span className="text-cyan">{formatDuration(trade.exitTime - trade.entryTime)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase text-muted">Exit / friction</span>
          <span className="text-ink">{trade.exitReason.replace("_", " ").toLowerCase()}</span>
          <span className="block text-[9px] text-down">{inr(trade.frictionCost, 2)} costs</span>
        </div>
      </div>

      <div className="rounded border-l-2 border-cyan bg-panel2/60 px-2.5 py-1 text-[11px] italic text-ink/80">
        Thesis: &quot;{trade.thesis}&quot;
      </div>
      {trade.postMortem ? (
        <div className="rounded border-l-2 border-accent bg-accent/5 px-2.5 py-1 text-[11px] italic text-accent/90">
          Debrief: &quot;{trade.postMortem}&quot;
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-line/50 pt-1 font-mono text-[10px]">
        <span className="text-muted">
          Faculty process score:{" "}
          <strong className={trade.facultyScore ? "text-accent" : "text-muted"}>
            {trade.facultyScore ? `${trade.facultyScore}/5` : "Ungraded"}
          </strong>
        </span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => onScore(score)}
              aria-label={`Score ${score}`}
              className={`text-xs ${trade.facultyScore && trade.facultyScore >= score ? "text-accent" : "text-muted/30"}`}
            >
              ★
            </button>
          ))}
          {trade.facultyScore ? (
            <button
              type="button"
              onClick={() => onScore(0)}
              className="ml-1 rounded border border-line px-1 text-[9px] text-muted"
            >
              clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PayoffChart({
  points,
  breakevens: bePoints,
  spot,
}: {
  points: Array<{ price: number; pnl: number }>;
  breakevens: number[];
  spot: number;
}) {
  const width = 100;
  const height = 34;
  const prices = points.map((point) => point.price);
  const pnls = points.map((point) => point.pnl);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const maxAbs = Math.max(1, ...pnls.map((value) => Math.abs(value)));
  const x = (price: number) => ((price - minPrice) / Math.max(1, maxPrice - minPrice)) * width;
  const y = (pnl: number) => height / 2 - (pnl / maxAbs) * (height / 2 - 2);

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.price).toFixed(2)},${y(point.pnl).toFixed(2)}`).join(" ");

  return (
    <div className="rounded-lg border border-line/70 bg-panel2/30 p-2">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted">
        <span className="font-bold text-ink">Expiry payoff</span>
        <span>spot {inr(spot)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none" role="img" aria-label="Expiry payoff curve">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth={0.2} className="text-line-strong" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={0.6} className="text-cyan" />
        {bePoints.map((value) => (
          <line
            key={value}
            x1={x(value)}
            y1={0}
            x2={x(value)}
            y2={height}
            stroke="currentColor"
            strokeWidth={0.2}
            strokeDasharray="1 1"
            className="text-accent"
          />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[9px] text-muted">
        <span>{inr(minPrice)}</span>
        <span>{bePoints.length ? `BE ${bePoints.join(" / ")}` : "no breakeven in range"}</span>
        <span>{inr(maxPrice)}</span>
      </div>
    </div>
  );
}

function DebriefModal({
  priced,
  reason,
  text,
  setText,
  onCancel,
  onConfirm,
}: {
  priced: PricedPosition;
  reason: "MANUAL" | "TARGET" | "STOP_LOSS";
  text: string;
  setText: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-line bg-panel p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
            <span>🎓</span> Post-trade debrief
          </h4>
          <span className="font-mono text-[10px] text-cyan">{priced.position.symbol}</span>
        </div>
        <p className="text-[11px] text-muted">
          {reason === "STOP_LOSS"
            ? "The stop fired. What did the setup get wrong, and was the stop where your thesis broke?"
            : "What did the market do after your exit, and would you take this trade again?"}
        </p>
        <textarea
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Required for the graded journal — minimum 15 characters."
          className="w-full rounded border border-line bg-panel2 px-3 py-2 text-xs text-ink focus:border-cyan focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-line px-3 py-1.5 text-xs text-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={text.trim().length < 15}
            className="rounded bg-cyan px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
          >
            Close & journal
          </button>
        </div>
      </div>
    </div>
  );
}

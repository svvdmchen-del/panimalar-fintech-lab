export interface LabActivityDef {
  id: string;
  title: string;
  desk: string;
  duration: string;
  objective: string;
  targetWidgetId: string;
  targetWidgetName: string;
  instructions: string[];
  formula?: {
    label: string;
    expression: string;
    explanation: string;
  };
  questions: Array<{
    id: string;
    label: string;
    prompt: string;
    placeholder: string;
    hint: string;
  }>;
}

export interface CaseStudyDef {
  id: string;
  title: string;
  badge: string;
  keyConcepts: string[];
  widgetsUsed: string[];
  scenario: string;
  studentTask: string;
  guidedQuestions: Array<{
    id: string;
    question: string;
    placeholder: string;
    learningTakeaway: string;
  }>;
}

export const LAB_ACTIVITIES: LabActivityDef[] = [
  {
    id: "max-pain-challenge",
    title: "1. The Expiry Day Max Pain Challenge",
    desk: "Derivatives Desk",
    duration: "15–20 Mins",
    objective: "Understand option writing dynamics, pin risk, and open interest concentration.",
    targetWidgetId: "options",
    targetWidgetName: "Option Chain",
    instructions: [
      "Open the undocked or inline Option Chain on Monitor 2 or this screen.",
      "Identify the current Max Pain Strike where institutional option sellers face minimal aggregate loss.",
      "Spot the Call Resistance Wall (highest CE OI) and Put Support Wall (highest PE OI).",
      "Calculate the ATM Straddle Breakeven Range [Spot - StraddlePremium, Spot + StraddlePremium].",
      "Draft your team's 2-line thesis predicting where NIFTY will pin at 3:30 PM closing bell.",
    ],
    formula: {
      label: "ATM Straddle Breakeven Range",
      expression: "[ S - Premium,  S + Premium ]",
      explanation: "Where S = ATM Strike price, and Premium = ATM Call LTP + ATM Put LTP.",
    },
    questions: [
      {
        id: "identified_levels",
        label: "Key Expiry Boundary Levels",
        prompt: "Enter the Max Pain Strike, Call Resistance Wall (RES), and Put Support Wall (SUP):",
        placeholder: "e.g. Max Pain: 24,400 | Call Wall: 24,500 (1.2 Cr OI) | Put Wall: 24,300 (98L OI)",
        hint: "Look at the orange/cyan badges in the Option Chain header and the longest OI bars.",
      },
      {
        id: "straddle_breakeven",
        label: "ATM Straddle Breakeven Calculation",
        prompt: "Calculate the ATM Straddle combined premium and the expected expiry pin range:",
        placeholder: "e.g. ATM Strike: 24,400 | CE: ₹68 + PE: ₹54 = ₹122 | Range: [24,278 to 24,522]",
        hint: "Add ATM CE LTP + ATM PE LTP. Breakeven Lower = ATM - Sum, Upper = ATM + Sum.",
      },
      {
        id: "pin_thesis",
        label: "2-Line Expiry Pin Thesis",
        prompt: "Where will NIFTY pin at 3:30 PM, and why?",
        placeholder: "Write 2 concise lines explaining writer concentration, gamma exposure, and institutional positioning...",
        hint: "Consider whether call writers are adding more open interest at the resistance strike.",
      },
    ],
  },
  {
    id: "fii-dii-forensics",
    title: "2. Institutional Flow Forensics: FII vs DII Tug-of-War",
    desk: "Institutional Flows Desk",
    duration: "20–30 Mins",
    objective: "Decode domestic retail/DII resilience vs foreign institutional capital flight.",
    targetWidgetId: "fii-dii",
    targetWidgetName: "FII / DII Institutional Flows",
    instructions: [
      "Open the FII / DII Institutional Flows panel alongside the Market Breadth Strip.",
      "Review the last 5 trading sessions of net institutional buying and selling.",
      "Analyze the divergence: Is NIFTY advancing despite heavy foreign outflows?",
      "Cross-reference with the Sector Heatmap to verify where domestic mutual funds are deploying capital.",
      "Formulate your team's forensic conclusion.",
    ],
    questions: [
      {
        id: "five_session_trend",
        label: "5-Session Net Flow Trend Summary",
        prompt: "Summarize cumulative FII vs DII net flow over the past 5 sessions:",
        placeholder: "e.g. FII Net: -₹14,500 Cr (persistent selling) | DII Net: +₹16,200 Cr (systematic SIP absorption)",
        hint: "Check the bar chart in the FII / DII panel for green vs red distribution.",
      },
      {
        id: "challenge_resolution",
        label: "The Forensic Challenge Question",
        prompt: "Challenge: 'If FIIs sold ₹4,000 Cr yesterday but NIFTY closed green, who absorbed the float, and what sector absorbed the bulk of DII inflows?'",
        placeholder: "Explain the absorption mechanism (Retail SIP inflows into domestic AMCs) and identify which sectors gained...",
        hint: "Look at banking, capital goods, and domestic cyclical sectors on the Sector Heatmap.",
      },
      {
        id: "defensive_cyclical_matrix",
        label: "Defensive vs Cyclical Allocation Verdict",
        prompt: "Are institutions rotating into Defensives (IT, Pharma, FMCG) or Cyclicals (PSU Banks, Metals, Auto)?",
        placeholder: "State the allocation trend and cite data evidence from the Sector Heatmap...",
        hint: "Check the % returns in the Sector Heatmap tiles.",
      },
    ],
  },
  {
    id: "sector-rotation-relay",
    title: "3. The 30-Minute Rapid Pitch: Sector Rotation Relay",
    desk: "Equity Research Desk",
    duration: "30 Mins",
    objective: "Asset allocation based on macroeconomic catalysts (RBI policy, crude price, bond yields).",
    targetWidgetId: "sectors",
    targetWidgetName: "Sector Heatmap",
    instructions: [
      "Divide the classroom into 4 sector analyst teams (Banking, IT, Auto, Pharma).",
      "Use the Sector Heatmap and Movers Desk to monitor intraday relative strength.",
      "Each team takes 3 minutes to pitch why capital is rotating into or out of their assigned sector today.",
      "Submit pitch theses and record class voting score for optimal intraday portfolio weighting.",
    ],
    questions: [
      {
        id: "assigned_sector",
        label: "Assigned Sector & Macro Catalyst",
        prompt: "Sector Name & Primary Macro Catalyst (e.g. Brent Crude, RBI Repo, US 10Y Yield, Earnings):",
        placeholder: "e.g. Sector: NIFTY IT | Catalyst: US Fed rate cut expectations & USD-INR depreciation",
        hint: "Identify the top economic driver impacting margins or capital cost.",
      },
      {
        id: "rotation_verdict",
        label: "Inflow vs Outflow Rationale (3-Minute Pitch)",
        prompt: "Present your 3-minute pitch rationale: Why should capital rotate into (Overweight) or out of (Underweight) this sector?",
        placeholder: "Summarize valuation multiple, earnings visibility, and intraday volume accumulation...",
        hint: "Use Movers desk data to back your point with top constituent performance.",
      },
      {
        id: "top_picks",
        label: "Top 2 Alpha Stock Picks from Assigned Sector",
        prompt: "List 2 specific stocks with target entry rationale:",
        placeholder: "e.g. 1) INFY (LTP ₹1,850, Target ₹1,980) | 2) TCS (LTP ₹4,150, Target ₹4,400)",
        hint: "Select stocks currently appearing in the watchlist or gainers board.",
      },
    ],
  },
];

export const CASE_STUDIES: CaseStudyDef[] = [
  {
    id: "case-election-2024",
    title: "Case 1: The June 4, 2024 Election Volatility Shock",
    badge: "Derivatives & Volatility",
    keyConcepts: [
      "India VIX Spike to 31.7",
      "Implied Move Collapse (Vol Crush)",
      "Delta vs Vega Dynamics",
      "Margin Liquidation Cascades",
    ],
    widgetsUsed: ["Option Chain (IV, Delta, Theta)", "Price Chart", "Movers Desk"],
    scenario:
      "Prior to major political or economic events, ATM straddle premiums expand dramatically as Implied Volatility (IV) surges. On June 3, 2024, India VIX traded above 24% and spiked to 31.7% on June 4 morning. As soon as the election outcome trend stabilized in the afternoon, IV collapsed by over 50% ('vol crush').",
    studentTask:
      "Using the terminal's ATM Straddle & Expected Move metric, analyze why naked option buyers lost substantial premium even when they were directionally correct, because IV collapsed faster than delta gains.",
    guidedQuestions: [
      {
        id: "q1_expected_move",
        question: "1. Calculate the Break-even Move required for an ATM Straddle Buyer:",
        placeholder: "Formula: Expected Move % = (ATM Straddle Price / Spot Price) * 100. If Spot is 23,200 and Straddle is 1,100 pts, what is the required breakeven move?",
        learningTakeaway: "Buyers needed an unprecedented ±4.74% move just to cover the massive volatility risk premium.",
      },
      {
        id: "q2_vol_crush",
        question: "2. Why did Out-of-the-Money (OTM) Put buyers lose money after the morning crash?",
        placeholder: "Explain the interaction between Vega (IV sensitivity) and Delta gains once IV plunged from 31% to 16%...",
        learningTakeaway: "When IV falls by 15 points, option prices drop by Vega * 15, erasing delta profits on far OTM options.",
      },
      {
        id: "q3_risk_mitigation",
        question: "3. What option strategy should institutional desks trade to protect against Vol Crush?",
        placeholder: "Evaluate Defined-Risk Spreads (Bear Put Spread, Calendar Spread, Iron Condor) vs Naked Options...",
        learningTakeaway: "Credit spreads and vertical debit spreads insulate portfolios against pure Vega collapse by selling expensive IV.",
      },
    ],
  },
  {
    id: "case-psu-banks",
    title: "Case 2: PSU Bank Re-rating vs Private Banking Decoupling",
    badge: "Equity Valuation & Credit Cycles",
    keyConcepts: [
      "P/E & P/B Multiple Expansion",
      "Asset Quality Turnaround (GNPA < 2%)",
      "FII vs DII Ownership Decoupling",
      "Return on Assets (RoA) Expansion",
    ],
    widgetsUsed: ["Fundamental Drawer", "Sector Heatmap", "Watchlist"],
    scenario:
      "Between 2020 and 2024, Indian State-Owned Banks (PSU Banks led by SBI, Bank of Baroda, Canara Bank) experienced an unprecedented re-rating, outperforming Private Banking peers. Gross NPAs plummeted from double digits to under 2.5%, driving Return on Assets (RoA) from negative to >1.0%.",
    studentTask:
      "Compare the valuation multiples (P/E, P/B, RoE) of SBI vs HDFC Bank using the Stock Valuation Modal and formulate an investment thesis on whether the re-rating cycle is structural or cyclical.",
    guidedQuestions: [
      {
        id: "q1_multiples_comp",
        question: "1. Compare Valuation Multiples (P/E and P/B) between PSU Bank (SBIN) and Private Bank (HDFCBANK):",
        placeholder: "Enter SBIN P/E and P/B vs HDFCBANK P/E and P/B from the terminal fundamental drawer...",
        learningTakeaway: "SBIN trades at ~1.2-1.5x P/B while HDFC Bank historically traded at 3.0-3.5x P/B, demonstrating the valuation gap.",
      },
      {
        id: "q2_driver_analysis",
        question: "2. What fundamental balance sheet factors drove the PSU turnaround?",
        placeholder: "Analyze resolution of legacy corporate stressed assets, provision coverage ratios (PCR > 75%), and credit growth...",
        learningTakeaway: "Clean balance sheets allowed credit costs to drop to near zero, boosting net interest margins directly to net profit.",
      },
      {
        id: "q3_fii_positioning",
        question: "3. How did foreign institutional ownership shifts impact the performance divergence?",
        placeholder: "Examine FII weight reallocation from heavy private bank exposure into cyclical industrial PSU themes...",
        learningTakeaway: "FII overweight unwinding in heavy private names allowed DII SIP liquidity to drive alpha in undervalued PSUs.",
      },
    ],
  },
  {
    id: "case-tatamotors-demerger",
    title: "Case 3: Tata Motors Demerger & SOTP Value Creation",
    badge: "Corporate Restructuring & SOTP",
    keyConcepts: [
      "Sum-of-the-Parts (SOTP) Valuation",
      "Commercial Vehicles (CV) vs Passenger Vehicles (PV/EV)",
      "Margin Spread & Capital Allocation",
      "Conglomerate Discount Unlocking",
    ],
    widgetsUsed: ["Movers Desk", "Price Chart", "Fundamental Modal"],
    scenario:
      "Tata Motors announced a landmark corporate demerger into two separately listed legal entities: 1) Commercial Vehicles (CV) business, and 2) Passenger Vehicles (PV) business including EV and Jaguar Land Rover (JLR). Historically, cyclical CV downturns suppressed the valuation multiple of the high-growth EV/JLR business.",
    studentTask:
      "Perform a Sum-of-the-Parts (SOTP) valuation breakdown. Estimate appropriate EV/EBITDA multiples for each separate entity and determine if the demerger unlocks shareholder value.",
    guidedQuestions: [
      {
        id: "q1_sotp_multiples",
        question: "1. Assign EV/EBITDA multiples to the CV Business vs the PV/EV Business:",
        placeholder: "CV Business Multiple: ___x EBITDA (Cyclical capital goods) | PV/EV + JLR Multiple: ___x EBITDA...",
        learningTakeaway: "CV typically trades at 8-10x EV/EBITDA, while pure-play EV/passenger franchises command 16-22x multiples.",
      },
      {
        id: "q2_conglomerate_discount",
        question: "2. Quantify the Conglomerate Discount removed by the demerger:",
        placeholder: "Explain why single-focus investors (e.g., pure EV funds vs infrastructure CV investors) bid higher for standalone entities...",
        learningTakeaway: "Standalone listing eliminates cross-subsidization of capital expenditure and lets institutional mandates enter.",
      },
      {
        id: "q3_debt_allocation",
        question: "3. How should net automotive debt be distributed between the two entities?",
        placeholder: "Analyze cash flow generation of domestic PV/EV vs JLR international free cash flows...",
        learningTakeaway: "JLR's net cash turnaround enabled the domestic businesses to emerge virtually debt-free.",
      },
    ],
  },
  {
    id: "case-fo-ban-squeeze",
    title: "Case 4: F&O Ban & Gamma Squeeze in Midcaps",
    badge: "Market Microstructure & Risk",
    keyConcepts: [
      "Market-Wide Position Limits (MWPL > 95%)",
      "Prohibition of Fresh Derivative Positions",
      "Short-Covering Stampedes",
      "Dealer Dynamic Hedging & Gamma Traps",
    ],
    widgetsUsed: ["Option Chain (OI Change)", "Volume Movers Desk"],
    scenario:
      "When aggregate open interest across exchange contracts exceeds 95% of the Market-Wide Position Limit (MWPL), the stock enters the F&O Ban Period. Traders cannot open new derivative positions; only squaring off existing open positions is permitted. Penalties are levied for violations.",
    studentTask:
      "Analyze the mechanics of a short squeeze in an F&O ban stock. When short sellers are forced to cover their positions but cannot sell new call options, explain how market makers hedging long gamma exacerbate rapid upward price spikes.",
    guidedQuestions: [
      {
        id: "q1_ban_mechanics",
        question: "1. Explain the regulatory objective and mechanics of the NSE MWPL 95% Ban Rule:",
        placeholder: "Detail why the exchange enforces MWPL to prevent excessive speculative leverage relative to free-float market cap...",
        learningTakeaway: "MWPL protects against catastrophic default by capping systemic leverage at 20% of free float.",
      },
      {
        id: "q2_squeeze_dynamics",
        question: "2. Why does a stock in F&O ban often experience a violent upside rally instead of falling?",
        placeholder: "Explain why trapped short sellers can only buy back shares in cash/futures while bears cannot add new resistance...",
        learningTakeaway: "One-sided closing orders create pure buying pressure without the ability for institutional bears to supply fresh contracts.",
      },
      {
        id: "q3_risk_rules",
        question: "3. What risk rules must a quantitative FinTech desk institute when a stock approaches 90% MWPL?",
        placeholder: "Formulate stop loss, margin buffer, and square-off protocol prior to ban threshold entry...",
        learningTakeaway: "Prudent risk desks mandate automated roll-overs or unwinding at 85-90% MWPL to avoid regulatory margin lock-in.",
      },
    ],
  },
];

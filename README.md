# Panimalar MBA Fintech Lab Terminal

A classroom dashboard for **NSE India** market data. Built for a college lab / projector: dense, dark, readable
from the back of the room, and it never shows a blank screen — if the live feeds are unreachable it falls back to a
clearly-labelled simulated dataset.

Real data is pulled through an **NSE India MCP server** (`india-stock-mcp`) plus NSE's own public JSON endpoints,
with Yahoo Finance and RSS as secondary sources.

---

## What is on the dashboard

| Panel | What it shows | Source |
| --- | --- | --- |
| **Ticker tape** | Scrolling strip of watchlist + movers with LTP and % change | MCP quotes |
| **Index cards** | NIFTY 50, BANK NIFTY, NIFTY IT, MIDCAP 100, NEXT 50, INDIA VIX with day range and advance/decline | NSE |
| **Market breadth** | Advance / unchanged / decline rail for NIFTY 50 | NSE |
| **Watchlist** | Editable, sortable table: LTP, change, day range, volume. Persists per browser | MCP → Yahoo |
| **Price chart** | Intraday area chart (1D) and candlesticks (1W/1M/6M/1Y) with volume | Yahoo (1D) / MCP (rest) |
| **Movers** | Top gainers, losers and volume toppers from the NIFTY 50 universe | NSE |
| **FII / DII flows** | Institutional buy/sell/net in ₹ crore | NSE |
| **Sector heat-map** | 12 sectoral indices, colour-scaled by % change | NSE |
| **Option chain** | NIFTY / BANKNIFTY ATM ± 5 strikes: OI, OI change, LTP, IV, PCR | MCP |
| **Market news** | Latest headlines | Economic Times RSS |
| **Stock detail modal** | Click a symbol name in the watchlist for stats + chart + NSE link | mixed |

Every panel carries a badge: **LIVE** (NSE direct), **DELAYED** (Yahoo/MCP), or **DEMO** (offline simulation).

---

## Architecture

```
Browser (React 19 client components, polling)
   │  fetch /api/market/*
   ▼
Next.js 16 route handlers  ──►  in-memory TTL cache + request coalescing
   │
   ├─► nse.ts    ──► nseindia.com public JSON endpoints        (live)
   ├─► mcp.ts    ──► MCP client ──stdio JSON-RPC──► india-stock-mcp
   ├─► yahoo.ts  ──► query1.finance.yahoo.com                  (delayed ~15m)
   ├─► news.ts   ──► Economic Times RSS
   └─► mock.ts   ──► deterministic simulated feed             (demo)
```

Each capability (`indices`, `quotes`, `movers`, `options`, `history`, …) has an **ordered fallback chain**.
The first provider that answers wins, and the last one is always the demo feed, so a route can never fail the page.

The MCP client is a ~200-line, dependency-free implementation of the MCP stdio transport
(`src/lib/mcp/client.ts`): `initialize` → `notifications/initialized` → `tools/list` → `tools/call`.
It keeps one child process alive as a `globalThis` singleton, so hot reloads do not leak processes.

---

## Quick start

```bash
npm install          # also installs the india-stock-mcp server
npm run dev          # http://localhost:3000
```

Production / lab server:

```bash
npm run build
npm run start        # binds 0.0.0.0:3000, reachable from lab PCs at http://<host-ip>:3000
```

Node.js 22+ is required (the MCP server and Next.js 16 both need it).

### Health check

`GET /api/health` returns per-provider status, timings, and the MCP server's tool list.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NSE_MCP_SERVER` | `node_modules/india-stock-mcp/dist/index.js` | Override the MCP server entry point |
| `NSE_MCP_DISABLED` | unset | Set to `1` to skip the MCP provider entirely (quotes then use Yahoo) |
| `CHROMIUM_EXECUTABLE_PATH` | auto-detected | Chrome/Chromium binary used to render the lab-report PDF |

No API keys are required. Nothing is sent anywhere except to the upstream data sources.

### Report PDF export

The "Report" button renders the lab assignment through `POST /api/report/pdf`, which prints the same HTML the
on-screen preview uses with headless Chromium (`playwright-core`) — no browser print dialog, no browser headers or
footers. The response is a real A4 PDF with a running header and "Page X of Y" on every sheet; long written answers
flow onto continuation sheets instead of being clipped. If Chromium cannot be found the route fails with a message
naming `CHROMIUM_EXECUTABLE_PATH`, which the dialog shows to the user.

In production, point `CHROMIUM_EXECUTABLE_PATH` at a known-good binary:

```bash
CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"   # Windows
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium                                          # Debian/Ubuntu
```

Without it the renderer tries, in order, `playwright-core`'s bundled download
(`npx playwright-core install chromium`), then the OS-installed Chrome/Edge.

---

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/market/indices?symbols=` | Index quotes |
| `GET /api/market/sectors` | Sectoral index performance |
| `GET /api/market/quotes?symbols=RELIANCE,TCS` | Equity quotes |
| `GET /api/market/movers?count=8` | Gainers / losers / volume toppers |
| `GET /api/market/fii-dii` | Latest FII & DII cash-market flows |
| `GET /api/market/status` | NSE market session state |
| `GET /api/market/options?symbol=NIFTY` | Trimmed option chain |
| `GET /api/market/history?symbol=RELIANCE&range=1M` | OHLCV candles (`1D`/`1W`/`1M`/`6M`/`1Y`) |
| `GET /api/market/news?limit=8` | Headlines |
| `GET /api/health` | Provider + MCP diagnostics |

All market endpoints return an envelope:

```json
{ "data": [], "status": "live|delayed|demo", "source": "…", "asOf": "…", "warning": "optional" }
```

---

## Using it in the lab

- **Refresh interval** is selectable in the header (10s / 15s / 30s / 1m). Default 15s.
  Server-side caching means 40 students refreshing at once still produces roughly one upstream request per TTL.
- **Hidden tabs slow down automatically** to one request per minute, so an always-on projector is safe.
- **Caching**: indices 15s, quotes 15s, movers/sectors/status 30s, option chain 45s, history 60s,
  FII-DII and news 5 minutes.
- **Offline mode**: stop the network and reload — every panel switches to DEMO with a banner explaining why.
- **Watchlist** lives in `localStorage` (`nse-lab.watchlist`), so each student can keep their own.
- **Themes**: dark (default, best for a dim projector) and light, switched from the sun/moon button in the header.
  The choice is remembered per machine in `localStorage` (`nse-lab.theme`) and applied before first paint, so a
  light-mode reload never flashes dark. Both palettes live in `src/app/globals.css`; the chart mirrors them in
  `CHART_COLORS` (`src/components/PriceChart.tsx`) because a canvas cannot read CSS variables.
- **Projector tips**: the layout is optimised for 1600–1920px wide; use the browser's full-screen mode (F11).
- **Teaching hooks**: `src/lib/symbols.ts` holds the symbol universe; `src/lib/providers/mock.ts` is the
  deterministic simulator students can modify for "what-if" exercises.

---

## Known limitations

- **NSE has no official public API.** Some NSE paths (`quote-equity`, `option-chain-indices`, historical OHLC)
  return `403`/`404` from many networks; that is why quotes, history and the option chain go through the MCP server,
  which falls back to Yahoo for prices. The dashboard labels every payload with the source it actually used.
- **Yahoo quotes are delayed by roughly 15 minutes** — fine for teaching, not for trading.
- **Ticker names change.** NSE reconstitutes indices and companies rename/delist (e.g. `TATAMOTORS` after the 2026
  demerger → `TMCV` / `TMPV`). Unknown symbols render as a "no quote available" row instead of disappearing;
  edit the watchlist or `symbols.ts` to fix.
- **FII/DII**: NSE publishes only the latest session through the public endpoint, so the panel shows a single
  session detail view when only one day is available.
- **Rate limits.** Be a good citizen: do not drop the interval to 1s or run many instances behind one IP.

## Legal / attribution

Data belongs to NSE India, Yahoo Finance and the respective publishers. This project is for **educational,
non-commercial classroom use** and is not investment advice. Do not redistribute or resell the data; check NSE's
terms of use before exposing this dashboard outside your institution.

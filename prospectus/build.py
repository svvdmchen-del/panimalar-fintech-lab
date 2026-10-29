"""Build the Panimalar MBA Fintech Lab prospectus PDF.

Generates the inline SVG illustrations, injects them into template.html,
prints the result with headless Chrome and verifies the page count.
"""

from __future__ import annotations

import math
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CHROME = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

INK = "#0A1526"
MUTED = "#65758C"
LINE = "#DCE6F1"
UP = "#0E9F6E"
DOWN = "#D64550"
TEAL = "#0B7285"
CYAN = "#0891B2"
AMBER = "#B45309"


def fmt(n: float, digits: int = 0) -> str:
    return f"{n:,.{digits}f}"


# --------------------------------------------------------------------------- #
# sparkline
# --------------------------------------------------------------------------- #
def spark(points: list[float], color: str = UP, w: int = 150, h: int = 38,
          fill: bool = True, sw: float = 1.4, dark: bool = False) -> str:
    lo, hi = min(points), max(points)
    pad = (hi - lo) * 0.12 or 1
    lo, hi = lo - pad, hi + pad
    n = len(points)

    def x(i: int) -> float:
        return 1 + i * (w - 2) / (n - 1)

    def y(v: float) -> float:
        return h - 2 - (v - lo) * (h - 4) / (hi - lo)

    line = " ".join(f"{x(i):.2f},{y(v):.2f}" for i, v in enumerate(points))
    area = f"M1,{h-1} L" + " L".join(
        f"{x(i):.2f},{y(v):.2f}" for i, v in enumerate(points)
    ) + f" L{w-1},{h-1} Z"
    gid = f"sg{abs(hash(tuple(points))) % 100000}"
    grad = ""
    if fill:
        grad = (
            f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{color}" stop-opacity="{0.22 if dark else 0.16}"/>'
            f'<stop offset="1" stop-color="{color}" stop-opacity="0"/>'
            f"</linearGradient></defs>"
            f'<path d="{area}" fill="url(#{gid})"/>'
        )
    return (
        f'<svg class="spark" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">'
        f"{grad}"
        f'<polyline points="{line}" fill="none" stroke="{color}" stroke-width="{sw}" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        f'<circle cx="{x(n-1):.2f}" cy="{y(points[-1]):.2f}" r="1.7" fill="{color}"/>'
        f"</svg>"
    )


# --------------------------------------------------------------------------- #
# candlestick chart with volume + moving average
# --------------------------------------------------------------------------- #
def candles(w: int = 620, h: int = 320, dark: bool = False, n: int = 42,
            axes: bool = True, labels: bool = True) -> str:
    rnd = random.Random(27)
    bars = []
    o = 1441.0
    for i in range(n):
        if i < 7:
            drift = -0.0008
        elif 12 <= i <= 16:
            drift = -0.0014
        else:
            drift = 0.0013
        ch = rnd.gauss(drift, 0.0042)
        if i == 27:
            ch += 0.011
        c = o * (1 + ch)
        hi = max(o, c) * (1 + abs(rnd.gauss(0, 0.0018)))
        lo = min(o, c) * (1 - abs(rnd.gauss(0, 0.0018)))
        vol = rnd.uniform(0.5, 1.0)
        if i == 27:
            vol = 2.5
        bars.append((o, hi, lo, c, vol))
        o = c

    ml = 6 if not axes else 8
    mr = 6 if not axes else 50
    mt = 8
    mb = 6
    vol_h = 40 if axes else 0
    price_h = h - mt - mb - vol_h - (4 if axes else 0)

    top = max(b[1] for b in bars)
    bot = min(b[2] for b in bars)
    pad = (top - bot) * 0.08
    top, bot = top + pad, bot - pad
    step = max(5, round((top - bot) / 4 / 5) * 5)
    ticks = [bot + (top - bot) * k / 4 for k in range(5)]

    def py(p: float) -> float:
        return mt + (top - p) * price_h / (top - bot)

    def px(i: int) -> float:
        return ml + (i + 0.5) * (w - ml - mr) / n

    grid = "" if not axes else "".join(
        f'<line x1="{ml}" y1="{py(v):.1f}" x2="{w-mr}" y2="{py(v):.1f}" '
        f'stroke="{"rgba(255,255,255,.10)" if dark else LINE}" stroke-width=".6"/>'
        f'<text x="{w-3}" y="{py(v)+2.4:.1f}" text-anchor="end" font-family="Consolas,monospace" '
        f'font-size="7" fill="{"rgba(255,255,255,.45)" if dark else MUTED}">{fmt(v)}</text>'
        for v in ticks
    )

    bw = max(2.0, (w - ml - mr) / n * 0.56)
    body = []
    for i, (oo, hh, ll, cc, vv) in enumerate(bars):
        col = UP if cc >= oo else DOWN
        body.append(
            f'<line x1="{px(i):.1f}" y1="{py(hh):.1f}" x2="{px(i):.1f}" y2="{py(ll):.1f}" '
            f'stroke="{col}" stroke-width=".8"/>'
            f'<rect x="{px(i)-bw/2:.1f}" y="{min(py(oo), py(cc)):.1f}" width="{bw:.1f}" '
            f'height="{max(abs(py(oo)-py(cc)), 1.1):.1f}" fill="{col}" rx=".4"/>'
        )

    vol = ""
    if axes and vol_h:
        vmax = max(b[4] for b in bars)
        base = h - mb
        vol = "".join(
            f'<rect x="{px(i)-bw/2:.1f}" y="{base - bars[i][4]/vmax*(vol_h-6):.1f}" width="{bw:.1f}" '
            f'height="{bars[i][4]/vmax*(vol_h-6):.1f}" fill="{UP if bars[i][3]>=bars[i][0] else DOWN}" '
            f'opacity="{0.55 if dark else 0.40}"/>'
            for i in range(n)
        )

    # 5-period moving average
    ma_pts = []
    for i in range(n):
        window = [b[3] for b in bars[max(0, i - 4):i + 1]]
        ma_pts.append((px(i), py(sum(window) / len(window))))
    ma = '<polyline points="' + " ".join(f"{a:.1f},{b:.1f}" for a, b in ma_pts) + \
         f'" fill="none" stroke="{AMBER}" stroke-width="1.2" opacity=".85"/>'

    # annotations: support line + breakout marker
    support = round((bot + (top - bot) * 0.22) / 10) * 10
    note = ""
    if axes:
        note = (
            f'<line x1="{ml}" y1="{py(support):.1f}" x2="{w-mr}" y2="{py(support):.1f}" '
            f'stroke="{DOWN}" stroke-width=".7" stroke-dasharray="3 3" opacity=".55"/>'
            f'<text x="{ml+3}" y="{py(support)-3:.1f}" font-family="Segoe UI,sans-serif" '
            f'font-size="6.6" fill="{"rgba(255,255,255,.55)" if dark else MUTED}">support</text>'
        )
        if labels:
            bx, by = px(27), py(bars[27][1])
            note += (
                f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="2.4" fill="{UP}"/>'
                f'<line x1="{bx:.1f}" y1="{by-3:.1f}" x2="{bx+22:.1f}" y2="{by-16:.1f}" '
                f'stroke="{"rgba(255,255,255,.4)" if dark else MUTED}" stroke-width=".6"/>'
                f'<text x="{bx+24:.1f}" y="{by-17:.1f}" font-family="Segoe UI,sans-serif" '
                f'font-size="6.4" fill="{"rgba(255,255,255,.7)" if dark else MUTED}">volume 2.5x</text>'
            )

    return (
        f'<svg class="chart-svg" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">'
        f"{grid}{vol}{note}{''.join(body)}{ma}</svg>"
    )


# --------------------------------------------------------------------------- #
# FII / DII grouped bars
# --------------------------------------------------------------------------- #
def flows(w: int = 300, h: int = 262) -> str:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    fii = [-2148.6, -860.2, 421.4, -1519.8, 310.2]
    dii = [1932.4, 640.8, -212.6, 1181.2, 542.0]
    lo, hi = -2500, 2500
    ml, mr, mt, mb = 38, 8, 24, 30
    plot_h = h - mt - mb
    zero = mt + (hi / (hi - lo)) * plot_h

    def y(v: float) -> float:
        return mt + (hi - v) * plot_h / (hi - lo)

    grid = "".join(
        f'<line x1="{ml}" y1="{y(v):.1f}" x2="{w-mr}" y2="{y(v):.1f}" stroke="{LINE}" stroke-width=".7"/>'
        f'<text x="{ml-4}" y="{y(v)+3:.1f}" text-anchor="end" font-family="Consolas,monospace" '
        f'font-size="8.4" fill="{MUTED}">{int(v):,}</text>'
        for v in (-2000, 0, 2000)
    )
    bw = 13
    bars = []
    cx_list = []
    for i, d in enumerate(days):
        cx = ml + 20 + i * (w - ml - mr - 38) / 4
        cx_list.append(cx)
        for j, (v, col) in enumerate(((fii[i], DOWN), (dii[i], UP))):
            x = cx - bw - 1 + j * (bw + 3)
            yy = min(y(v), zero)
            hh = abs(y(v) - zero)
            bars.append(
                f'<rect x="{x:.1f}" y="{yy:.1f}" width="{bw}" height="{hh:.1f}" fill="{col}" opacity=".82" rx=".8"/>'
            )
        bars.append(
            f'<text x="{cx:.1f}" y="{h-8}" text-anchor="middle" font-family="Segoe UI,sans-serif" '
            f'font-size="9.2" fill="{MUTED}">{d}</text>'
        )

    net = [a + b for a, b in zip(fii, dii)]
    pts = " ".join(f"{cx_list[i]:.1f},{y(net[i]):.1f}" for i in range(5))
    netline = (
        f'<polyline points="{pts}" fill="none" stroke="{CYAN}" stroke-width="1.5" stroke-dasharray="3 2" opacity=".9"/>'
        + "".join(f'<circle cx="{cx_list[i]:.1f}" cy="{y(net[i]):.1f}" r="2.1" fill="{CYAN}"/>' for i in range(5))
    )

    last = cx_list[-1]
    labels = (
        f'<text x="{last-8:.1f}" y="{y(fii[-1])-4:.1f}" text-anchor="middle" font-family="Consolas,monospace" '
        f'font-size="7.6" fill="{DOWN}">-{fmt(abs(fii[-1]),0)}</text>'
        f'<text x="{last+12:.1f}" y="{y(dii[-1])-4:.1f}" text-anchor="middle" font-family="Consolas,monospace" '
        f'font-size="7.6" fill="{UP}">+{fmt(dii[-1],0)}</text>'
    )
    legend = (
        f'<circle cx="{ml+4}" cy="11" r="3" fill="{DOWN}"/>'
        f'<text x="{ml+10}" y="13.8" font-family="Segoe UI,sans-serif" font-size="9" fill="{MUTED}">FII</text>'
        f'<circle cx="{ml+42}" cy="11" r="2.8" fill="{UP}"/>'
        f'<text x="{ml+48}" y="13.8" font-family="Segoe UI,sans-serif" font-size="9" fill="{MUTED}">DII</text>'
        f'<line x1="{ml+78}" y1="11" x2="{ml+88}" y2="11" stroke="{CYAN}" stroke-width="1.4" stroke-dasharray="3 2"/>'
        f'<text x="{ml+92}" y="13.8" font-family="Segoe UI,sans-serif" font-size="9" fill="{MUTED}">net</text>'
    )
    return (
        f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">'
        f"{grid}{''.join(bars)}{netline}{labels}{legend}</svg>"
    )


# --------------------------------------------------------------------------- #
# PCR gauge
# --------------------------------------------------------------------------- #
def pcr(value: float = 1.18, w: int = 230, h: int = 166) -> str:
    cx, cy, r = w / 2, h - 44, 64
    lo, hi = 0.6, 1.4

    def ang(v: float) -> float:
        return math.pi - (v - lo) / (hi - lo) * math.pi

    def pt(v: float, rr: float = r) -> tuple[float, float]:
        a = ang(v)
        return cx + rr * math.cos(a), cy - rr * math.sin(a)

    def arc(a: float, b: float, color: str, width: float = 12) -> str:
        x1, y1 = pt(a)
        x2, y2 = pt(b)
        return (
            f'<path d="M{x1:.1f},{y1:.1f} A{r},{r} 0 0 1 {x2:.1f},{y2:.1f}" '
            f'fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="butt"/>'
        )

    segs = (
        arc(0.6, 0.9, UP) + arc(0.9, 1.1, "#B9C5D4") + arc(1.1, 1.4, DOWN)
    )
    nx, ny = pt(value, r - 12)
    needle = (
        f'<line x1="{cx}" y1="{cy}" x2="{nx:.1f}" y2="{ny:.1f}" stroke="{INK}" stroke-width="2.4" '
        f'stroke-linecap="round"/><circle cx="{cx}" cy="{cy}" r="4.2" fill="{INK}"/>'
    )
    ticks = "".join(
        f'<text x="{pt(v, r+16)[0]:.1f}" y="{pt(v, r+16)[1]+3:.1f}" text-anchor="middle" '
        f'font-family="Consolas,monospace" font-size="6.6" fill="{MUTED}">{v:.1f}</text>'
        for v in (0.6, 0.9, 1.1, 1.4)
    )
    return (
        f'<svg viewBox="0 0 {w} {h}" aria-hidden="true">'
        f"{segs}{needle}{ticks}"
        f'<text x="{cx}" y="{cy+22}" text-anchor="middle" font-family="Consolas,monospace" '
        f'font-size="21" font-weight="700" fill="{INK}">{value:.2f}</text>'
        f'<text x="{cx}" y="{cy+34}" text-anchor="middle" font-family="Segoe UI,sans-serif" '
        f'font-size="5.8" letter-spacing="1.3" fill="{MUTED}">PUT-CALL RATIO</text>'
        f"</svg>"
    )


# --------------------------------------------------------------------------- #
# portfolio donut
# --------------------------------------------------------------------------- #
def donut(items: list[tuple[str, float, str]], w: int = 168, h: int = 168,
          center_top: str = "", center_sub: str = "") -> str:
    cx, cy, r, sw = w / 2, h / 2, 60, 20
    circ = 2 * math.pi * r
    total = sum(v for _, v, _ in items)
    offset = 0.0
    arcs = []
    for label, value, color in items:
        frac = value / total
        arcs.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-dasharray="{frac*circ:.2f} {circ:.2f}" stroke-dashoffset="{-offset*circ:.2f}" '
            f'transform="rotate(-90 {cx} {cy})"/>'
        )
        offset += frac
    return (
        f'<svg viewBox="0 0 {w} {h}" aria-hidden="true">'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{LINE}" stroke-width="{sw}"/>'
        f"{''.join(arcs)}"
        f'<text x="{cx}" y="{cy+2}" text-anchor="middle" font-family="Segoe UI,sans-serif" '
        f'font-size="8" fill="{MUTED}">{center_top}</text>'
        f'<text x="{cx}" y="{cy+14}" text-anchor="middle" font-family="Consolas,monospace" '
        f'font-size="11" font-weight="700" fill="{INK}">{center_sub}</text>'
        f"</svg>"
    )


# --------------------------------------------------------------------------- #
# protective put payoff
# --------------------------------------------------------------------------- #
def payoff(w: int = 200, h: int = 140) -> str:
    ml, mr, mt, mb = 24, 8, 20, 20
    strike, spot, prem = 26500, 26482, 180
    lo, hi = 24000, 29000
    ylo, yhi = -1500, 2500

    def x(s: float) -> float:
        return ml + (s - lo) * (w - ml - mr) / (hi - lo)

    def y(v: float) -> float:
        return mt + (yhi - v) * (h - mt - mb) / (yhi - ylo)

    def path(fn) -> str:
        pts = []
        for k in range(61):
            s = lo + (hi - lo) * k / 60
            pts.append(f"{x(s):.1f},{y(fn(s)):.1f}")
        return "M" + " L".join(pts)

    unhedged = lambda s: s - spot
    hedged = lambda s: (s - spot) + max(strike - s, 0) - prem

    grid = (
        f'<line x1="{ml}" y1="{y(0):.1f}" x2="{w-mr}" y2="{y(0):.1f}" stroke="{LINE}" stroke-width=".9"/>'
        f'<line x1="{x(strike):.1f}" y1="{mt}" x2="{x(strike):.1f}" y2="{h-mb}" stroke="{TEAL}" '
        f'stroke-width=".8" stroke-dasharray="3 3" opacity=".55"/>'
        f'<text x="{x(strike)-3:.1f}" y="{mt+8}" text-anchor="end" font-family="Consolas,monospace" font-size="6.6" '
        f'fill="{TEAL}">K 26,500</text>'
        f'<text x="{ml-3}" y="{y(0)+2.6:.1f}" text-anchor="end" font-family="Consolas,monospace" '
        f'font-size="6.6" fill="{MUTED}">0</text>'
        f'<text x="{ml-3}" y="{y(2000)+2.6:.1f}" text-anchor="end" font-family="Consolas,monospace" '
        f'font-size="6.6" fill="{MUTED}">+2k</text>'
        f'<text x="{ml-3}" y="{y(-1000)+2.6:.1f}" text-anchor="end" font-family="Consolas,monospace" '
        f'font-size="6.6" fill="{MUTED}">-1k</text>'
        f'<text x="{(ml + w - mr)/2:.1f}" y="{h-5}" text-anchor="middle" font-family="Segoe UI,sans-serif" '
        f'font-size="6.4" fill="{MUTED}">NIFTY at expiry</text>'
    )
    lines = (
        f'<path d="{path(unhedged)}" fill="none" stroke="{MUTED}" stroke-width="1.1" stroke-dasharray="4 2"/>'
        f'<path d="{path(hedged)}" fill="none" stroke="{TEAL}" stroke-width="1.8"/>'
    )
    leg = (
        f'<line x1="{ml}" y1="8" x2="{ml+12}" y2="8" stroke="{MUTED}" stroke-width="1" stroke-dasharray="3 2"/>'
        f'<text x="{ml+15}" y="10.4" font-family="Segoe UI,sans-serif" font-size="6.2" fill="{MUTED}">unhedged</text>'
        f'<line x1="{ml+62}" y1="8" x2="{ml+74}" y2="8" stroke="{TEAL}" stroke-width="1.7"/>'
        f'<text x="{ml+77}" y="10.4" font-family="Segoe UI,sans-serif" font-size="6.2" fill="{TEAL}">hedged</text>'
    )
    shade = (
        f'<path d="{path(hedged)} L{x(hi):.1f},{y(0):.1f} Z" fill="{TEAL}" opacity=".05"/>'
        f'<circle cx="{x(spot):.1f}" cy="{y(0):.1f}" r="2" fill="{INK}"/>'
    )
    return (
        f'<svg viewBox="0 0 {w} {h}" aria-hidden="true">'
        f"{grid}{lines}{shade}{leg}</svg>"
    )


# --------------------------------------------------------------------------- #
# sector rotation quadrant
# --------------------------------------------------------------------------- #
def rotation(w: int = 330, h: int = 210) -> str:
    cx, cy = w / 2, h / 2 + 4
    dots = [
        ("BANK", 0.55, 0.45, UP), ("IT", -0.62, -0.55, DOWN), ("AUTO", 0.68, 0.28, UP),
        ("FMCG", -0.35, -0.18, DOWN), ("METAL", 0.38, 0.72, UP), ("PHARMA", -0.60, 0.10, DOWN),
        ("REALTY", 0.80, 0.05, UP), ("ENERGY", 0.18, 0.38, UP), ("PSU BK", 0.48, 0.62, UP),
        ("MEDIA", -0.22, -0.66, DOWN),
    ]

    def px(v: float) -> float:
        return cx + v * (w / 2 - 18)

    def py(v: float) -> float:
        return cy - v * (h / 2 - 24)

    quad = (
        f'<rect x="{cx}" y="{cy}" width="{w/2-14}" height="{h/2-20}" fill="{UP}" opacity=".045"/>'
        f'<rect x="14" y="14" width="{w/2-14}" height="{h/2-10}" fill="{DOWN}" opacity=".04"/>'
    )
    axes = (
        f'<line x1="14" y1="{cy}" x2="{w-10}" y2="{cy}" stroke="{LINE}" stroke-width=".8"/>'
        f'<line x1="{cx}" y1="12" x2="{cx}" y2="{h-18}" stroke="{LINE}" stroke-width=".8"/>'
        f'<text x="{w-12}" y="{cy-4}" text-anchor="end" font-family="Segoe UI,sans-serif" font-size="6.2" '
        f'fill="{MUTED}">relative strength \u2192</text>'
        f'<text x="{cx+4}" y="17" font-family="Segoe UI,sans-serif" font-size="6.2" fill="{MUTED}">'
        f"\u2191 earnings momentum</text>"
        f'<text x="{cx+5}" y="{cy+9}" font-family="Segoe UI,sans-serif" font-size="5.8" fill="{MUTED}" '
        f'opacity=".85">leaders</text>'
        f'<text x="{cx-5}" y="{cy+9}" text-anchor="end" font-family="Segoe UI,sans-serif" font-size="5.8" '
        f'fill="{MUTED}" opacity=".85">value</text>'
        f'<text x="{cx+5}" y="{cy-5}" font-family="Segoe UI,sans-serif" font-size="5.8" fill="{MUTED}" '
        f'opacity=".85">momentum</text>'
    )
    marks = "".join(
        f'<circle cx="{px(x):.1f}" cy="{py(y):.1f}" r="2.6" fill="{col}" opacity=".85"/>'
        f'<text x="{px(x)+4:.1f}" y="{py(y)+2.2:.1f}" font-family="Segoe UI,sans-serif" font-size="5.6" '
        f'fill="{INK}" opacity=".8">{label}</text>'
        for label, x, y, col in dots
    )
    return f'<svg viewBox="0 0 {w} {h}" aria-hidden="true">{quad}{axes}{marks}</svg>'


# --------------------------------------------------------------------------- #
# assemble
# --------------------------------------------------------------------------- #
def build() -> None:
    template = (ROOT / "template.html").read_text(encoding="utf-8")

    rnd = random.Random(42)
    series = {}
    for key, start, drift, vol in [
        ("NIFTY", 26400, 0.0009, 0.0035),
        ("BANK", 58800, 0.0011, 0.0042),
        ("IT", 40050, -0.0006, 0.0038),
        ("MID", 61700, 0.0014, 0.0048),
        ("NEXT", 74000, 0.0006, 0.0039),
        ("VIX", 13.4, -0.0040, 0.0100),
    ]:
        pts, value = [], start
        for _ in range(40):
            value *= 1 + rnd.gauss(drift, vol)
            pts.append(value)
        series[key] = pts

    colors = {"NIFTY": UP, "BANK": UP, "IT": DOWN, "MID": UP, "NEXT": UP, "VIX": DOWN}
    for key, pts in series.items():
        template = template.replace(f"@@SPARK_{key}@@", spark(pts, colors[key], w=190, h=44))

    template = template.replace("@@CANDLES@@", candles(620, 262))
    template = template.replace("@@CANDLES_DARK@@", candles(340, 132, dark=True, n=34, axes=False))
    template = template.replace("@@FLOWS@@", flows())
    template = template.replace("@@PCR@@", pcr())
    template = template.replace(
        "@@PORTFOLIO@@",
        donut([("Financials", 24, TEAL), ("IT", 18, CYAN), ("Auto", 14, UP),
               ("FMCG", 14, AMBER), ("Energy", 12, "#7C8FA6"), ("Pharma", 10, "#9B5DE5"),
               ("Cash", 8, "#C9D4E2")], center_top="8 stocks", center_sub="\u20b910L"),
    )
    template = template.replace(
        "@@ASSESS@@",
        donut([("Journal", 20, TEAL), ("Assignments", 30, CYAN), ("Capstone", 30, UP), ("Viva", 20, AMBER)],
              center_top="total", center_sub="100%"),
    )
    template = template.replace("@@PAYOFF@@", payoff())
    template = template.replace("@@ROTATION@@", rotation())

    out_html = ROOT / "prospectus.html"
    out_html.write_text(template, encoding="utf-8")

    pdf = ROOT / "Panimalar-MBA-Fintech-Lab-Prospectus-2026.pdf"
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--no-pdf-header-footer", "--virtual-time-budget=4000",
        f"--print-to-pdf={pdf}", out_html.as_uri(),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        sys.exit(f"chrome failed with {result.returncode}")

    import fitz

    doc = fitz.open(pdf)
    doc.set_metadata({
        "title": "Panimalar MBA Fintech Lab Terminal \u2014 Prospectus 2026\u201327",
        "author": "Department of Management Studies, Panimalar Engineering College",
        "subject": "Live NSE market intelligence for the MBA FinTech lab: modules, use cases, curriculum and operations.",
        "keywords": "NSE, fintech, MBA, market data, derivatives, portfolio, curriculum",
        "creator": "Panimalar MBA Fintech Lab",
    })
    doc.saveIncr()

    print(f"PDF: {pdf}")
    print(f"pages: {doc.page_count}  size: {doc[0].rect.width:.0f} x {doc[0].rect.height:.0f} pt")
    for i, page in enumerate(doc, 1):
        txt = page.get_text().strip().replace("\n", " ")
        print(f"  p{i:02d}  {txt[:78]}")
    doc.close()


if __name__ == "__main__":
    build()

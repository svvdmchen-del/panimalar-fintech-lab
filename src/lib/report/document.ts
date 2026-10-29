import { CASE_STUDIES, LAB_ACTIVITIES } from "@/lib/caseStudiesData";
import { formatDuration, timeIST } from "@/lib/format";
import type { LabReportPayload, ReportTradeRow } from "./types";
import { tradeStats } from "./types";

/**
 * Deterministic, dependency-free HTML for the official lab report.
 *
 * This module is isomorphic on purpose: the browser imports it to render the
 * live preview inside an <iframe srcDoc>, and the PDF route imports it to hand
 * the exact same markup to Chromium. One renderer, so the preview can never
 * drift from the exported document.
 */

export interface ReportDocOptions {
  /** Data URI (server) or absolute path (browser preview) for the college crest. */
  crestSrc: string;
  /** `pdf` keeps pages flush; `preview` draws page cards with a shadow. */
  mode?: "pdf" | "preview";
}

/* ------------------------------------------------------------------ utils */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const inrFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value: number): string {
  return `₹${inrFormat.format(Math.abs(value))}`;
}

/** Zero is neutral, never green — a flat trade is not a win. */
function pnlClass(value: number): string {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "flat";
}

function signedMoney(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${money(value)}`;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${time} IST`;
}

function documentId(payload: LabReportPayload): string {
  const roll = payload.profile.rollNumber.replace(/[^a-zA-Z0-9-]/g, "");
  return `PAN-FTL/2025-27/${roll || "UNASSIGNED"}`;
}

/** Blank answer areas get a sensible amount of handwriting room. */
function ruleCount(label: string): number {
  const probe = label.toLowerCase();
  if (/(thesis|rationale|verdict|justify|reason|impact|explain|compare|quantify|assign|pitch|distribution)/.test(probe)) {
    return 3;
  }
  return 2;
}

/* -------------------------------------------------------------------- css */

const STYLE = `
:root{
  --navy:#14304f; --navy-soft:#2b5476; --ink:#111827; --muted:#475569;
  --soft:#64748b; --line:#cbd5e1; --hair:#e2e8f0; --wash:#f5f7fa; --rule:#94a3b8;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:#fff; color:var(--ink);
  font-family:"Segoe UI",Inter,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
  font-size:9.3pt; line-height:1.42;
  font-variant-numeric:tabular-nums;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
body.is-preview{background:#e8edf4;padding:6mm 0}
.sheet{
  position:relative; width:210mm; height:296.4mm; padding:12mm 14mm 17mm;
  background:#fff; overflow:hidden;
}
body.is-preview .sheet{margin:0 auto 6mm; box-shadow:0 1mm 4mm rgba(15,23,42,.18)}
@media print{
  @page{size:A4;margin:0}
  .sheet{break-after:page;page-break-after:always}
  .sheet:last-of-type{break-after:auto;page-break-after:auto}
}
.sheet-body{display:flex;flex-direction:column;height:100%;transform-origin:top left}
/* Children must keep their natural height; otherwise flex shrinking hides
   overflow inside the cards and defeats the auto-fit measurement. */
.sheet-body > *{flex:0 0 auto}

/* ------------------------------------------------------------- masthead */
.masthead{flex:0 0 auto}
.masthead-main{display:flex;align-items:center;gap:4mm;padding-bottom:3mm;border-bottom:1.4pt solid var(--navy)}
.crest{width:15.5mm;height:15.5mm;object-fit:contain;flex:0 0 auto}
.masthead-text{flex:1 1 auto;min-width:0}
.college{font-size:15pt;font-weight:700;letter-spacing:-.01em;line-height:1.1;color:var(--navy);text-transform:uppercase}
.dept{margin-top:1.2mm;font-size:7.6pt;font-weight:600;letter-spacing:.055em;color:var(--muted);text-transform:uppercase}
.masthead-meta{flex:0 0 auto;text-align:right;font-size:6.6pt;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);line-height:1.5}
.masthead-meta b{display:block;font-size:7.4pt;color:var(--ink);letter-spacing:.02em;text-transform:none}
.masthead-title{
  display:flex;align-items:center;justify-content:center;gap:2.4mm;
  background:var(--wash);padding:2.2mm 0;margin-bottom:4mm;
  font-size:8.4pt;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--navy);
}
.masthead-title .sep{color:var(--rule);font-weight:400}
.masthead-title .session{font-weight:600;letter-spacing:.06em;color:var(--muted)}

/* -------------------------------------------------------------- profile */
.profile{display:grid;grid-template-columns:1.5fr 1fr .95fr 1.25fr;border:0.6pt solid var(--line);margin-bottom:1mm}
.field{padding:2mm 2.4mm 1.8mm;border-right:0.6pt solid var(--line);min-width:0}
.field:last-child{border-right:0}
.field .k{display:block;font-size:6.4pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-bottom:1.3mm}
.field .v{display:block;font-size:9.4pt;font-weight:700;color:var(--ink);min-height:4.6mm;border-bottom:0.5pt dotted var(--rule);padding-bottom:.6mm;overflow-wrap:anywhere}

/* ----------------------------------------------------------------- part */
.part{display:flex;align-items:center;gap:2.6mm;border-bottom:1pt solid var(--navy);padding-bottom:1.5mm;margin:4mm 0 2.4mm}
.part-num{flex:0 0 auto;width:6.4mm;height:6.4mm;display:flex;align-items:center;justify-content:center;background:var(--navy);color:#fff;font-size:8.4pt;font-weight:700;line-height:1}
.part h2{margin:0;font-size:9.8pt;font-weight:700;letter-spacing:.055em;text-transform:uppercase}
.part-meta{margin-left:auto;font-size:6.8pt;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--soft);white-space:nowrap}

/* ------------------------------------------------------------ card / qa */
.card{border:0.6pt solid var(--line);padding:2.1mm 3mm .1mm;margin-bottom:2.1mm;break-inside:avoid}
.card-head{display:flex;align-items:center;gap:1.8mm;border-bottom:0.4pt solid var(--hair);padding-bottom:1.2mm;margin-bottom:1.5mm}
.card-head h3{margin:0;flex:1 1 auto;font-size:9.1pt;font-weight:700;letter-spacing:-.005em;color:var(--ink)}
.chip{flex:0 0 auto;font-size:6.4pt;font-weight:700;letter-spacing:.075em;text-transform:uppercase;padding:.7mm 1.7mm;border:0.5pt solid var(--line);color:var(--muted);white-space:nowrap}
.chip.is-submitted{border-color:var(--navy);color:var(--navy)}
.chip.is-pending{border-style:dashed;border-color:var(--rule);color:var(--soft)}
.q{margin-bottom:1mm;break-inside:avoid}
.q-label{display:block;font-size:8pt;font-weight:600;color:#334155;margin-bottom:.7mm}
.a-rules i{display:block;height:4.4mm;border-bottom:0.6pt dotted #8fa0b5}
.a-rules i:last-child{border-bottom-color:#8fa0b5}
.a-text{border-left:1.4pt solid var(--navy-soft);background:var(--wash);padding:1.3mm 2.2mm;font-size:8.8pt;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.a-empty{font-size:7pt;font-style:italic;color:var(--rule)}

/* ------------------------------------------------------------- part 3 */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-bottom:2.6mm}
.kpi{border:0.6pt solid var(--line);padding:1.9mm 2.3mm}
.kpi .k{display:block;font-size:6.3pt;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--soft)}
.kpi .v{display:block;margin-top:.8mm;font-size:12pt;font-weight:700;color:var(--navy);line-height:1.15}
.kpi .v.pos{color:#0b6b3a}
.kpi .v.neg{color:#a11b1b}
.kpi .v.flat{color:#334155}
.perf{display:flex;height:2.2mm;border:0.5pt solid var(--line);margin-bottom:3mm;background:#fff}
.perf span{display:block;height:100%}
.perf .win{background:var(--navy)}
.perf .loss{background:#c3cfdd}
.perf .flat{background:#8fa0b5}
.perf-legend{display:flex;align-items:center;gap:5mm;margin:-1.8mm 0 3.2mm;font-size:6.4pt;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--soft)}
.perf-legend span{display:flex;align-items:center}
.perf-legend .sw{display:inline-block;width:2.4mm;height:2.4mm;margin-right:1.4mm}
.perf-legend .sw.win{background:var(--navy)}
.perf-legend .sw.loss{background:#c3cfdd}
.perf-legend .sw.flat{background:#8fa0b5}
.perf-legend .perf-note{margin-left:auto;text-transform:none;letter-spacing:.02em;font-weight:400;color:var(--rule)}
/* The ledger grows into whatever vertical space the sheet has left, so the
   evaluation block below it never floats across a gap. Grow only — never shrink,
   which would hide overflow from the auto-fit measurement. */
.ledger{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.6pt;flex:1 0 auto}
.ledger th{background:#eef2f7;border:0.5pt solid var(--line);padding:1.5mm 1.3mm;font-size:6.4pt;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#334155;text-align:left;vertical-align:middle}
.ledger td{border:0.5pt solid var(--line);padding:1.4mm 1.3mm;vertical-align:top;line-height:1.35;overflow-wrap:anywhere}
.ledger tr{break-inside:avoid}
.ledger tr.filler td{height:9mm;background:#fcfdfe}
.ledger .num{text-align:right}
.ledger .ctr{text-align:center}
.ledger .sym{font-weight:700;font-size:8pt}
.ledger .sub{display:block;margin-top:.5mm;font-size:6.3pt;color:var(--soft);letter-spacing:.03em}
.ledger .tag{display:block;margin-top:.5mm;font-size:6.2pt;color:var(--navy-soft);font-weight:600}
.ledger .pos{color:#0b6b3a;font-weight:700}
.ledger .neg{color:#a11b1b;font-weight:700}
.ledger .flat{color:#334155;font-weight:700}
.ledger .star{color:#334155;font-size:7pt;letter-spacing:.04em}
.empty-note{border:0.6pt dashed var(--line);padding:4mm;text-align:center;font-size:8pt;color:var(--soft)}

/* ---------------------------------------------------------- evaluation */
.checklist{margin-top:4mm;break-inside:avoid}
.section-label{font-size:6.8pt;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--soft);margin-bottom:2mm}
.check-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.6mm 6mm}
.check{display:flex;align-items:center;gap:2.2mm;font-size:8pt;color:#334155}
.check .box{flex:0 0 auto;width:3.6mm;height:3.6mm;border:0.6pt solid var(--rule);display:flex;align-items:center;justify-content:center;font-size:7pt;font-weight:700;color:var(--navy);line-height:1}
.check.is-done .box{background:var(--navy);border-color:var(--navy);color:#fff}
.check.is-done{color:var(--ink);font-weight:600}
.declaration{margin-top:5mm;padding:3mm 0 0;border-top:0.5pt solid var(--hair);break-inside:avoid}
.declaration p{margin:0;font-size:7.8pt;line-height:1.55;color:var(--muted);max-width:150mm}
.evaluator{margin-top:auto;padding-top:5mm;break-inside:avoid}
.eval-title{display:flex;align-items:center;gap:2.4mm;font-size:7.2pt;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--soft);margin-bottom:2.4mm}
.eval-title::before,.eval-title::after{content:"";height:0.5pt;background:var(--line);flex:1 1 auto}
.marks{width:100%;border-collapse:collapse;font-size:7.6pt;margin-bottom:2.6mm}
.marks th,.marks td{border:0.5pt solid var(--line);padding:1.3mm 1.6mm;text-align:left}
.marks th{background:#eef2f7;font-size:6.4pt;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#334155}
.marks .box{width:16mm;text-align:center;color:var(--rule)}
.marks .total{font-weight:700;background:var(--wash)}
.remarks{margin-bottom:3.4mm}
.remarks .k{display:block;font-size:6.4pt;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--soft);margin-bottom:1mm}
.remarks i{display:block;height:4.6mm;border-bottom:0.6pt dotted #8fa0b5}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:10mm}
.sig{padding-top:8mm}
.sig-line{height:8mm;border-bottom:0.6pt solid var(--ink)}
.sig-cap{font-size:7.6pt;font-weight:600;color:#334155;margin-top:1.4mm}
.sig-sub{font-size:6.8pt;color:var(--soft);margin-top:.8mm}
.seal{display:flex;align-items:flex-end;justify-content:space-between;gap:4mm}
.seal .box-lg{width:24mm;height:12mm;border:0.6pt solid var(--line)}

/* ------------------------------------------------------------- running */
.running{display:flex;align-items:baseline;gap:3mm;font-size:6.6pt;font-weight:600;letter-spacing:.075em;text-transform:uppercase;color:var(--soft);border-bottom:0.5pt solid var(--hair);padding-bottom:1.3mm;margin-bottom:2.6mm}
.running .mid{margin:0 auto;color:var(--ink);letter-spacing:.03em;text-transform:none;font-size:7.2pt}
.sheet-footer{position:absolute;left:14mm;right:14mm;bottom:7mm;display:flex;align-items:center;gap:3mm;border-top:0.5pt solid var(--line);padding-top:2mm;font-size:6.4pt;letter-spacing:.05em;color:var(--soft)}
.sheet-footer .mid{margin:0 auto}
.sheet-footer .right{font-weight:700;color:#334155;letter-spacing:.06em}
`;

/**
 * Pagination for long written answers.
 *
 * The report is a fixed set of A4 sheets so every page can carry a real
 * "Page X of Y" footer. A candidate who writes a paragraph per question would
 * otherwise have their text clipped by the sheet's `overflow:hidden`, so this
 * inline script moves whole question cards onto continuation sheets and splits
 * an oversized card at question boundaries. It runs in the browser preview and
 * is triggered explicitly by the PDF renderer (`window.__reportPaginate`).
 *
 * Part 3 tables stay on one sheet by design; those are scaled instead.
 */
const PAGINATOR = `
(function () {
  'use strict';

  function overflowing(body) {
    return !!body && body.scrollHeight > body.clientHeight + 1;
  }

  function makeSheet(after, part) {
    var sheet = document.createElement('section');
    sheet.className = 'sheet';
    sheet.setAttribute('data-part', part || '1');

    var body = document.createElement('div');
    body.className = 'sheet-body';

    var running = document.querySelector('.running');
    if (running) {
      var clone = running.cloneNode(true);
      var label = clone.lastElementChild;
      if (label) label.textContent = 'Part ' + (part || '1') + ' — continued';
      body.appendChild(clone);
    }

    var footer = document.querySelector('.sheet-footer');
    if (footer) sheet.appendChild(footer.cloneNode(true));

    // Ledger continuations need the section title for context.
    if ((part || '1') === '3') {
      var origin = after.querySelector('.part');
      if (origin) {
        var heading = origin.cloneNode(true);
        var title = heading.querySelector('h2');
        if (title && title.textContent.indexOf('(continued)') === -1) {
          title.textContent = title.textContent + ' (continued)';
        }
        var meta = heading.querySelector('.part-meta');
        if (meta) meta.textContent = 'Ledger continued';
        body.appendChild(heading);
      }
    }

    sheet.insertBefore(body, sheet.firstChild);
    after.parentNode.insertBefore(sheet, after.nextSibling);
    return sheet;
  }

  function fits(body, element) {
    var bodyBox = body.getBoundingClientRect();
    var box = element.getBoundingClientRect();
    return box.bottom - bodyBox.top <= body.clientHeight + 1;
  }

  function firstCut(body, items) {
    for (var i = 0; i < items.length; i++) {
      if (!fits(body, items[i])) return i;
    }
    return -1;
  }

  function continuation(card) {
    var shell = card.cloneNode(false);
    var head = card.querySelector('.card-head');
    if (head) {
      var clone = head.cloneNode(true);
      var title = clone.querySelector('h3');
      if (title && title.textContent.indexOf('(continued)') === -1) {
        title.textContent = title.textContent + ' (continued)';
      }
      shell.appendChild(clone);
    }
    return shell;
  }

  // Keeps as many questions on this sheet as fit, then carries the rest to a
  // continuation card on the next sheet. Returns that sheet, or null when the
  // card cannot be split any further.
  function splitCard(card, sheet, part) {
    var body = sheet.querySelector('.sheet-body');
    var questions = Array.prototype.slice.call(card.children).filter(function (node) {
      return node.classList.contains('q');
    });
    if (questions.length < 2) return null;

    var cut = firstCut(body, questions);
    if (cut <= 0) return null;

    var next = makeSheet(sheet, part);
    var nextBody = next.querySelector('.sheet-body');
    var shell = continuation(card);
    nextBody.appendChild(shell);
    for (var j = cut; j < questions.length; j++) shell.appendChild(questions[j]);

    // Everything after the card belongs after the split-off questions, so it
    // has to travel to the same sheet in document order.
    var following = [];
    for (var node = card.nextElementSibling; node; node = node.nextElementSibling) {
      following.push(node);
    }
    for (var k = 0; k < following.length; k++) nextBody.appendChild(following[k]);

    return next;
  }

  function reflowQuestions(start, part) {
    var sheet = start;
    var guard = 0;

    while (sheet && guard++ < 40) {
      var body = sheet.querySelector('.sheet-body');
      if (!overflowing(body)) break;

      var items = Array.prototype.slice.call(body.children);
      var cut = firstCut(body, items);
      if (cut < 0) break;

      var item = items[cut];
      if (!item.classList.contains('card')) break; // tables and forms are scaled instead

      // Split when no card would remain above the cut, otherwise the page would
      // be left holding nothing but its running header.
      var keptCards = items.slice(0, cut).filter(function (node) {
        return node.classList.contains('card');
      }).length;

      if (keptCards === 0) {
        var carried = splitCard(item, sheet, part);
        if (!carried) break;
        sheet = carried;
        continue;
      }

      var next = makeSheet(sheet, part);
      var nextBody = next.querySelector('.sheet-body');
      for (var k = cut; k < items.length; k++) nextBody.appendChild(items[k]);
      sheet = next;
    }
  }

  // Ledgers split by table rows; the checklist and evaluation block travel with
  // the trailing rows so the signatures stay at the end of the report.
  function reflowLedger(start) {
    var sheet = start;
    var guard = 0;

    while (sheet && guard++ < 30) {
      var body = sheet.querySelector('.sheet-body');
      if (!overflowing(body)) break;

      // Decorative filler rows must never force a page break; drop them first.
      var filler = body.querySelector('.ledger tr.filler');
      if (filler) {
        filler.parentNode.removeChild(filler);
        continue;
      }

      var items = Array.prototype.slice.call(body.children);
      var cut = firstCut(body, items);
      if (cut < 0) break;

      // The evaluation form is one unit: never strand the signatures alone by
      // moving the checklist and declaration with them.
      if (items[cut].classList.contains('evaluator')) {
        for (var b = cut - 1; b >= 0; b--) {
          if (items[b].classList.contains('checklist')) {
            cut = b;
            break;
          }
        }
      }

      var item = items[cut];
      var next = makeSheet(sheet, '3');
      var nextBody = next.querySelector('.sheet-body');

      if (item.tagName === 'TABLE' && item.tBodies.length) {
        var rows = Array.prototype.slice.call(item.tBodies[0].rows);
        var rowCut = firstCut(body, rows);
        if (rowCut < 0) rowCut = rows.length;

        if (rowCut === 0) {
          nextBody.appendChild(item);
        } else {
          var clone = item.cloneNode(false);
          var colgroup = item.querySelector('colgroup');
          if (colgroup) clone.appendChild(colgroup.cloneNode(true));
          var thead = item.querySelector('thead');
          if (thead) clone.appendChild(thead.cloneNode(true));
          var tbody = document.createElement('tbody');
          for (var r = rowCut; r < rows.length; r++) tbody.appendChild(rows[r]);
          clone.appendChild(tbody);
          nextBody.appendChild(clone);
        }

        for (var s = cut + 1; s < items.length; s++) nextBody.appendChild(items[s]);
      } else {
        for (var t = cut; t < items.length; t++) nextBody.appendChild(items[t]);
      }

      // A form-only continuation page is not a ledger page; drop the cloned
      // "ledger continued" heading so it does not promise a table.
      if (!nextBody.querySelector('table.ledger')) {
        var strayHeading = nextBody.querySelector('.part');
        if (strayHeading) strayHeading.parentNode.removeChild(strayHeading);
      }

      sheet = next;
    }
  }

  function paginate() {
    if (window.__reportPaginated) return;
    window.__reportPaginated = true;

    var sheets = Array.prototype.slice.call(document.querySelectorAll('.sheet'));
    for (var i = 0; i < sheets.length; i++) {
      var part = sheets[i].getAttribute('data-part') || '1';
      if (part === '3') {
        reflowLedger(sheets[i]);
      } else {
        reflowQuestions(sheets[i], part);
      }
    }

    var finalSheets = document.querySelectorAll('.sheet');
    var total = finalSheets.length;
    for (var j = 0; j < total; j++) {
      var current = finalSheets[j];
      current.setAttribute('data-page', String(j + 1));
      var page = current.querySelector('.sheet-footer .right');
      if (page) page.textContent = 'Page ' + (j + 1) + ' of ' + total;
    }
  }

  window.__reportPaginate = paginate;

  function announce() {
    try {
      window.parent.postMessage(
        { type: 'nse-report-pages', pages: document.querySelectorAll('.sheet').length },
        '*',
      );
    } catch (error) {}
  }

  if (document.body.classList.contains('is-preview')) {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      paginate();
      announce();
    });
  }
})();
`;

/* --------------------------------------------------------------- pieces */

function runningHeader(payload: LabReportPayload, right: string): string {
  const name = payload.profile.studentName || "Student name not provided";
  const roll = payload.profile.rollNumber ? ` · ${payload.profile.rollNumber}` : "";
  return `<div class="running">
    <span>Panimalar Engineering College</span>
    <span class="mid">${esc(name)}${esc(roll)}</span>
    <span>${esc(right)}</span>
  </div>`;
}

function footer(payload: LabReportPayload, page: number, total: number): string {
  return `<div class="sheet-footer">
    <span>Panimalar Engineering College · FinTech &amp; Analytics Laboratory</span>
    <span class="mid">${esc(documentId(payload))}</span>
    <span class="right">Page ${page} of ${total}</span>
  </div>`;
}

function masthead(payload: LabReportPayload, crestSrc: string): string {
  return `<header class="masthead">
    <div class="masthead-main">
      <img class="crest" src="${crestSrc}" alt="Panimalar Engineering College crest" />
      <div class="masthead-text">
        <div class="college">Panimalar Engineering College</div>
        <div class="dept">Department of Management Studies (MBA) · FinTech &amp; Analytics Laboratory</div>
      </div>
      <div class="masthead-meta">
        <span>Report ID</span><b>${esc(documentId(payload))}</b>
        <span>Issued</span><b>${esc(dateLabel(payload.generatedAt))} · ${esc(timeLabel(payload.generatedAt))}</b>
      </div>
    </div>
    <div class="masthead-title">
      <span>Official Terminal Capstone Report</span>
      <span class="sep">•</span>
      <span class="session">Academic Session 2025–2027</span>
    </div>
  </header>`;
}

function profileGrid(payload: LabReportPayload): string {
  const cells = [
    ["Student name", payload.profile.studentName],
    ["Roll / Reg number", payload.profile.rollNumber],
    ["Class / batch", payload.profile.batch],
    ["Specialization desk", payload.profile.section],
  ];
  return `<section class="profile">${cells
    .map(
      ([label, value]) =>
        `<div class="field"><span class="k">${esc(label)}</span><span class="v">${esc(value) || "&nbsp;"}</span></div>`,
    )
    .join("")}</section>`;
}

function partHeader(index: number, title: string, meta: string): string {
  return `<div class="part">
    <span class="part-num">${index}</span>
    <h2>${esc(title)}</h2>
    <span class="part-meta">${esc(meta)}</span>
  </div>`;
}

function answerBlock(answer: string | undefined, label: string): string {
  if (answer && answer.trim()) {
    return `<div class="a-text">${esc(answer.trim())}</div>`;
  }
  const lines = ruleCount(label);
  return `<div class="a-rules">${"<i></i>".repeat(lines)}</div>`;
}

function card(
  id: string,
  title: string,
  chip: string,
  questions: Array<{ id: string; label: string; placeholder: string }>,
  answers: Record<string, string> | undefined,
): string {
  const answered = questions.filter((question) => answers?.[question.id]?.trim()).length;
  const state = answered === questions.length ? "is-submitted" : "is-pending";
  const stateLabel = answered === questions.length ? "Submitted" : answered === 0 ? "Pending" : `${answered}/${questions.length} answered`;
  return `<article class="card">
    <div class="card-head">
      <h3>${esc(title)}</h3>
      <span class="chip">${esc(chip)}</span>
      <span class="chip ${state}">${esc(stateLabel)}</span>
    </div>
    ${questions
      .map(
        (question) => `<div class="q">
          <span class="q-label">${esc(question.label)}</span>
          ${answerBlock(answers?.[question.id], question.label)}
        </div>`,
      )
      .join("")}
  </article>`;
}

/* --------------------------------------------------------------- part 3 */

function kpiStrip(trades: ReportTradeRow[]): string {
  const stats = tradeStats(trades);
  const pnlTone = stats.net > 0 ? "pos" : stats.net < 0 ? "neg" : "flat";
  return `<div class="kpis">
    <div class="kpi"><span class="k">Trades executed</span><span class="v">${trades.length}</span></div>
    <div class="kpi"><span class="k">Win rate</span><span class="v">${stats.winRate.toFixed(0)}%</span></div>
    <div class="kpi"><span class="k">Net P&amp;L</span><span class="v ${pnlTone}">${stats.net === 0 ? money(0) : signedMoney(stats.net)}</span></div>
    <div class="kpi"><span class="k">Average per trade</span><span class="v ${pnlTone}">${stats.avg === 0 ? money(0) : signedMoney(stats.avg)}</span></div>
  </div>`;
}

function perfBar(trades: ReportTradeRow[]): string {
  if (!trades.length) return "";
  const stats = tradeStats(trades);
  const total = trades.length;
  const winWidth = (stats.wins / total) * 100;
  const lossWidth = (stats.losses / total) * 100;
  const flatWidth = Math.max(0, 100 - winWidth - lossWidth);
  const flat = total - stats.wins - stats.losses;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return `<div class="perf" role="presentation">
    <span class="win" style="width:${winWidth.toFixed(2)}%"></span>
    <span class="flat" style="width:${flatWidth.toFixed(2)}%"></span>
    <span class="loss" style="width:${lossWidth.toFixed(2)}%"></span>
  </div>
  <div class="perf-legend">
    <span><i class="sw win"></i>${plural(stats.wins, "win")}</span>
    <span><i class="sw flat"></i>${plural(flat, "flat")}</span>
    <span><i class="sw loss"></i>${plural(stats.losses, "loss")}</span>
    <span class="perf-note">Closed-trade outcome mix</span>
  </div>`;
}

function ledger(trades: ReportTradeRow[], padTo = 0): string {
  if (!trades.length && padTo === 0) {
    return `<div class="empty-note">No paper trades were executed in this session. The ledger is open for entry.</div>`;
  }
  const rows = trades
    .map((trade) => {
      const duration = formatDuration(trade.exitTime - trade.entryTime);
      const score = typeof trade.facultyScore === "number" ? trade.facultyScore : null;
      const stars = score ? "★".repeat(Math.min(5, Math.max(1, Math.round(score)))) : "";
      return `<tr>
        <td><span class="sym">${esc(trade.symbol)}</span>${
          trade.thesisTag ? `<span class="tag">${esc(trade.thesisTag)}</span>` : ""
        }${trade.expiry ? `<span class="sub">Expiry ${esc(trade.expiry)}</span>` : ""}</td>
        <td class="ctr"><strong>${esc(trade.side)}</strong><span class="sub">${esc(trade.instrument)}</span>${
          trade.lotsText ? `<span class="sub">${esc(trade.lotsText)}</span>` : ""
        }</td>
        <td class="num">${trade.quantity}</td>
        <td class="num">${money(trade.entryPrice)}<span class="sub">${esc(timeIST(trade.entryTime, true))}</span></td>
        <td class="num">${money(trade.exitPrice)}<span class="sub">${esc(timeIST(trade.exitTime, true))}</span></td>
        <td class="ctr">${esc(duration)}</td>
        <td class="num ${pnlClass(trade.netPnl)}">${signedMoney(trade.netPnl)}<span class="sub">(${trade.pnlPct.toFixed(2)}%)</span></td>
        <td>${
          score
            ? `<span class="star">${stars} ${score}/5</span>`
            : `<span class="star">Unrated</span>`
        }${trade.thesis ? `<div><strong>Thesis:</strong> ${esc(trade.thesis)}</div>` : ""}${
          trade.postMortem ? `<div><strong>Post-mortem:</strong> ${esc(trade.postMortem)}</div>` : ""
        }</td>
      </tr>`;
    })
    .join("");

  // Keep a handful of ruled rows at the foot of the ledger so a short journal
  // still reads as an open register rather than a truncated table.
  const fillerCount = Math.max(0, padTo - trades.length);
  const filler = Array.from({ length: fillerCount })
    .map(() => `<tr class="filler">${"<td>&nbsp;</td>".repeat(8)}</tr>`)
    .join("");

  return `<table class="ledger">
    <colgroup>
      <col style="width:12%" /><col style="width:9%" /><col style="width:6%" />
      <col style="width:13%" /><col style="width:13%" /><col style="width:8%" />
      <col style="width:12%" /><col style="width:27%" />
    </colgroup>
    <thead>
      <tr>
        <th>Symbol &amp; tag</th>
        <th class="ctr">Side / type</th>
        <th class="num">Qty</th>
        <th class="num">Entry &amp; time</th>
        <th class="num">Exit &amp; time</th>
        <th class="ctr">Duration</th>
        <th class="num">Net P&amp;L</th>
        <th>Faculty rationale &amp; reflection</th>
      </tr>
    </thead>
    <tbody>${rows}${filler}</tbody>
  </table>`;
}

function checklist(payload: LabReportPayload): string {
  const activityDone = LAB_ACTIVITIES.filter((activity) =>
    activity.questions.every((question) => payload.answers[activity.id]?.[question.id]?.trim()),
  ).length;
  const caseDone = CASE_STUDIES.filter((study) =>
    study.guidedQuestions.every((question) => payload.answers[study.id]?.[question.id]?.trim()),
  ).length;
  const identityDone = Boolean(payload.profile.studentName.trim() && payload.profile.rollNumber.trim());

  const rows: Array<[string, boolean]> = [
    [`Part 1 — ${activityDone}/${LAB_ACTIVITIES.length} classroom activities answered`, activityDone === LAB_ACTIVITIES.length],
    [`Part 2 — ${caseDone}/${CASE_STUDIES.length} case studies answered`, caseDone === CASE_STUDIES.length],
    [`Part 3 — ${payload.trades.length} paper trade${payload.trades.length === 1 ? "" : "s"} recorded`, payload.trades.length > 0],
    ["Candidate details completed", identityDone],
    ["Report signed by student", false],
    ["Evaluated by laboratory faculty", false],
  ];

  return `<section class="checklist">
    <div class="section-label">Submission checklist</div>
    <div class="check-grid">
      ${rows
        .map(
          ([label, done]) =>
            `<div class="check ${done ? "is-done" : ""}"><span class="box">${done ? "✓" : ""}</span><span>${esc(label)}</span></div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function declaration(): string {
  return `<div class="declaration">
    <p>The candidate confirms that every answer, calculation and paper-trade entry in this report was produced
    during the scheduled FinTech &amp; Analytics laboratory sessions, and that all market data referenced was
    drawn from the laboratory terminal on the session date shown above.</p>
  </div>`;
}

function evaluator(): string {
  return `<section class="evaluator">
    <div class="eval-title">Evaluation &amp; verification</div>
    <table class="marks">
      <thead>
        <tr><th>Component</th><th class="box">Max</th><th class="box">Awarded</th><th>Remarks</th></tr>
      </thead>
      <tbody>
        <tr><td>Part 1 — Real-time classroom activities</td><td class="box">30</td><td class="box"></td><td></td></tr>
        <tr><td>Part 2 — Curated Indian market case studies</td><td class="box">40</td><td class="box"></td><td></td></tr>
        <tr><td>Part 3 — Virtual trade journal audit</td><td class="box">30</td><td class="box"></td><td></td></tr>
        <tr class="total"><td>Total</td><td class="box">100</td><td class="box"></td><td></td></tr>
      </tbody>
    </table>
    <div class="remarks">
      <span class="k">Evaluator remarks</span>
      <i></i><i></i>
    </div>
    <div class="signatures">
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-cap">Student signature</div>
        <div class="sig-sub">Date: ____ / ____ / ____________</div>
      </div>
      <div class="sig">
        <div class="seal">
          <div>
            <div class="sig-line" style="width:60mm"></div>
            <div class="sig-cap">FinTech Lab faculty / evaluator</div>
            <div class="sig-sub">Date: ____ / ____ / ____________</div>
          </div>
          <div>
            <div class="sig-sub">Seal</div>
            <div class="box-lg"></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* ----------------------------------------------------------------- build */

export function buildReportHtml(payload: LabReportPayload, options: ReportDocOptions): string {
  const { crestSrc, mode = "pdf" } = options;
  const bodies: string[] = [];

  const activityCount = LAB_ACTIVITIES.length;
  const activityAnswered = LAB_ACTIVITIES.filter((activity) =>
    activity.questions.every((question) => payload.answers[activity.id]?.[question.id]?.trim()),
  ).length;

  /* ---- page 1: masthead, candidate details, Part 1 */
  bodies.push(`
    ${masthead(payload, crestSrc)}
    ${profileGrid(payload)}
    ${partHeader(1, "Part 1 — Real-time classroom activities", `${activityAnswered}/${activityCount} activities submitted`)}
    ${LAB_ACTIVITIES.map((activity) =>
      card(activity.id, activity.title, activity.desk, activity.questions, payload.answers[activity.id]),
    ).join("")}
  `);

  /* ---- page 2: Part 2 */
  const caseAnswered = CASE_STUDIES.filter((study) =>
    study.guidedQuestions.every((question) => payload.answers[study.id]?.[question.id]?.trim()),
  ).length;

  bodies.push(`
    ${runningHeader(payload, "Part 2 — Curated case studies")}
    ${partHeader(2, "Part 2 — Curated Indian market case studies", `${caseAnswered}/${CASE_STUDIES.length} cases submitted`)}
    ${CASE_STUDIES.map((study) =>
      card(
        study.id,
        study.title,
        study.badge,
        study.guidedQuestions.map((question) => ({
          id: question.id,
          label: question.question,
          placeholder: question.placeholder,
        })),
        payload.answers[study.id],
      ),
    ).join("")}
  `);

  /* ---- page 3: the whole Part 3 ledger. The paginator splits rows onto
     continuation sheets, so no arbitrary chunk size can leave a near-empty page. */
  bodies.push(`
    ${runningHeader(payload, "Part 3 — Trade journal audit")}
    ${partHeader(3, "Part 3 — Virtual trade journal performance audit", `${payload.trades.length} trade${payload.trades.length === 1 ? "" : "s"} recorded`)}
    ${kpiStrip(payload.trades)}
    ${perfBar(payload.trades)}
    ${ledger(payload.trades, 6)}
    ${checklist(payload)}
    ${declaration()}
    ${evaluator()}
  `);

  const total = bodies.length;
  const sheets = bodies
    .map(
      (body, index) => `<section class="sheet" data-page="${index + 1}" data-part="${index === 0 ? 1 : index === 1 ? 2 : 3}">
        <div class="sheet-body">${body}</div>
        ${footer(payload, index + 1, total)}
      </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(documentId(payload))} — Lab Assignment Report</title>
<style>${STYLE}</style>
</head>
<body class="${mode === "preview" ? "is-preview" : ""}">
${sheets}
<script>${PAGINATOR}</script>
</body>
</html>`;
}

export function reportPageCount(payload: LabReportPayload): number {
  // Rough estimate only: the preview reports the paginated count back to the UI.
  return 2 + Math.max(1, Math.ceil(payload.trades.length / 8));
}

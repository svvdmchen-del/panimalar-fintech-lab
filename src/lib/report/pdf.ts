import fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";

/**
 * Chromium-backed PDF renderer.
 *
 * A real browser engine is the only way to get true A4 pagination, CSS page
 * breaks, `position: absolute` footers and correct ₹ / Devanagari shaping
 * without shipping font binaries. The browser is launched once per server
 * process and reused; each request only opens an isolated context.
 */

let browserPromise: Promise<Browser> | null = null;

const CREST = path.join(process.cwd(), "public", "panimalar-crest.png");

/** Resolves a Chromium binary from env, Playwright's cache, or a system install. */
function resolveExecutable(): string | undefined {
  const explicit = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  try {
    const bundled = chromium.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // Not installed under Playwright's registry — fall through.
  }

  const registryRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (existsSync(/* turbopackIgnore: true */ registryRoot)) {
    // The browser cache lives outside the project. Tell Turbopack not to trace
    // it, otherwise the whole source tree is bundled into the PDF route.
    const revisions = readdirSync(/*turbopackIgnore: true*/ registryRoot)
      .filter((entry) => entry.startsWith("chromium-"))
      .sort((a, b) => Number(b.split("-")[1] ?? 0) - Number(a.split("-")[1] ?? 0));
    for (const revision of revisions) {
      for (const relative of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux/chrome"]) {
        const candidate = path.join(/* turbopackIgnore: true */ registryRoot, revision, relative);
        if (existsSync(/*turbopackIgnore: true*/ candidate)) return candidate;
      }
    }
  }

  const systemCandidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];

  return systemCandidates.find((candidate) => existsSync(candidate));
}

async function launch(): Promise<Browser> {
  const executablePath = resolveExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

/**
 * Shrinks any sheet whose content overflows its A4 page.
 *
 * `transform: scale` is used rather than `zoom` because Chromium does not apply
 * inline `zoom` when printing to PDF. The layout box is widened by 1/scale first
 * so the scaled result still spans the full text column edge-to-edge. Blank
 * forms fit at 1.00; this only engages for unusually long free-text answers.
 */
const MIN_SCALE = 0.7;

interface FitResult {
  /** At least one sheet had to be scaled down. */
  scaled: boolean;
  /** At least one sheet needed more shrink than `MIN_SCALE` allows. */
  overflowed: boolean;
}

async function fitSheets(page: Page): Promise<FitResult> {
  return page.evaluate((minScale) => {
    let scaled = false;
    let overflowed = false;

    for (const sheet of Array.from(document.querySelectorAll<HTMLElement>(".sheet"))) {
      const body = sheet.querySelector<HTMLElement>(".sheet-body");
      if (!body) continue;

      body.style.transform = "";
      body.style.width = "";
      body.style.height = "";

      const available = body.clientHeight;
      const needed = body.scrollHeight;
      if (needed <= available + 1) continue;

      const required = available / needed;
      if (required < minScale) overflowed = true;
      const scale = Math.max(minScale, required);

      body.style.width = `${(100 / scale).toFixed(3)}%`;
      body.style.height = `${(100 / scale).toFixed(3)}%`;
      body.style.transform = `scale(${scale})`;
      scaled = true;
    }

    return { scaled, overflowed };
  }, MIN_SCALE);
}

export interface RenderResult {
  pdf: Uint8Array;
  pages: number;
  /** True when a sheet was scaled down to fit its page. */
  scaled: boolean;
  /** True when a sheet still overflows at the minimum allowed scale. */
  overflowed: boolean;
}

export async function renderReportPdf(html: string): Promise<RenderResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1240, height: 1754 } });
  const page = await context.newPage();

  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      await document.fonts?.ready;
    });
    // Long answers flow onto continuation sheets; the paginator renumbers the
    // footers, so it must run before the sheets are measured/scaled.
    await page.evaluate(() => {
      const host = window as unknown as { __reportPaginate?: () => void };
      host.__reportPaginate?.();
    });
    const { scaled, overflowed } = await fitSheets(page);

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const pages = await page.evaluate(() => document.querySelectorAll(".sheet").length);

    return { pdf: new Uint8Array(pdf), pages, scaled, overflowed };
  } finally {
    await context.close();
  }
}

let crestCache: string | null = null;

/** Inlines the college crest so Chromium never needs a network round-trip. */
export async function crestDataUri(): Promise<string> {
  if (crestCache) return crestCache;
  try {
    const buffer = await fs.readFile(CREST);
    crestCache = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    // A missing crest must never break an export; the layout simply omits it.
    crestCache = "";
  }
  return crestCache;
}

import { buildReportHtml } from "@/lib/report/document";
import { crestDataUri, renderReportPdf } from "@/lib/report/pdf";
import { parseReportPayload } from "@/lib/report/types";

/**
 * Server-side PDF export.
 *
 * The browser POSTs the current report payload (the source of truth lives in
 * localStorage), the route renders the exact same document markup that powers
 * the in-app preview, and Chromium prints it to a real paginated A4 PDF.
 */

function fileName(roll: string): string {
  const clean = roll.replace(/[^a-zA-Z0-9_-]/g, "_") || "Student";
  return `Panimalar_FinTech_Lab_Assignment_${clean}.pdf`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const payload = parseReportPayload(body);
  if (!payload) {
    return Response.json({ error: "Report payload is missing or malformed." }, { status: 400 });
  }

  try {
    const html = buildReportHtml(payload, { crestSrc: await crestDataUri(), mode: "pdf" });
    const { pdf, overflowed } = await renderReportPdf(html);

    if (overflowed) {
      // Not fatal: the sheet is printed at the minimum scale and may clip. Logged
      // so wildly long answers surface during development.
      console.warn("[report-pdf] a sheet still overflows at the minimum scale");
    }

    const name = fileName(payload.profile.rollNumber);
    // Node's Response accepts a Uint8Array at runtime; the DOM lib type is narrower.
    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(pdf.byteLength),
        "content-disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[report-pdf] render failed", error);
    return Response.json(
      {
        error:
          "PDF generation failed. Ensure a Chromium build is available (set CHROMIUM_EXECUTABLE_PATH if needed).",
      },
      { status: 500 },
    );
  }
}

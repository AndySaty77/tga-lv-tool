import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { hasFeature } from "@/lib/billing/plans";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildPdfReport, type BuildPdfReportOptions } from "@/lib/pdf/buildPdfReport";
import { renderPdfHtml } from "@/lib/pdf/renderPdfHtml";
import { htmlToPdfBuffer } from "@/lib/pdf/pdfEngine";
import { sanitizeFilename } from "@/lib/pdf/sanitizeFilename";

export const runtime = "nodejs";
export const maxDuration = 30;
const PDF_EXPORT_RATE_LIMIT_PER_10_MIN = 10;
const PDF_EXPORT_RATE_WINDOW_MS = 10 * 60 * 1000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, serviceKey || anonKey);
}

function errJson(stage: string, message: string, status: number) {
  return NextResponse.json(
    { error: true, stage, message },
    { status }
  );
}

/** Nur explizites `true` im JSON-Body – Standard: interne Team-Notizen nicht ins PDF. */
function readPdfBuildOptions(body: object): BuildPdfReportOptions {
  const flag = (body as { includeInternalTeamNotes?: unknown }).includeInternalTeamNotes;
  return { includeInternalTeamNotes: flag === true };
}

/**
 * POST /api/export/pdf
 *
 * Erwartet JSON-Body:
 * - Entweder: { analysisId: string, includeInternalTeamNotes?: boolean } – lädt die Analyse aus der DB (Auth erforderlich)
 * - Oder: Analysedaten direkt (z. B. result_json, …) optional mit `includeInternalTeamNotes: true` für interne Notizen im PDF
 *
 * Antwort: application/pdf mit Content-Disposition, Dateiname z. B. analysebericht-[projektname]-[datum].pdf
 */
export async function POST(request: NextRequest) {
  let payload: unknown = null;

  console.error("[PDF export] PDF export started");

  try {
    const user = await getUser().catch(() => null);
    if (!user) {
      return NextResponse.json(
        { error: true, stage: "auth", message: "Nicht angemeldet" },
        { status: 401 }
      );
    }
    const plan = await getUserPlan();
    if (!hasFeature(plan, "pdfExport")) {
      return NextResponse.json(
        { error: true, stage: "plan", message: "PDF-Export ist nur im Pro-Plan verfügbar." },
        { status: 403 }
      );
    }
    const rl = checkRateLimit(
      `pdf-export:${user.id}`,
      PDF_EXPORT_RATE_LIMIT_PER_10_MIN,
      PDF_EXPORT_RATE_WINDOW_MS
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: true, stage: "rate_limit", message: "Zu viele Anfragen. Bitte kurz warten." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error("[PDF export] parse-request failed", parseErr instanceof Error ? parseErr.message : String(parseErr));
      return errJson("parse-request", "Request-Body ist kein gültiges JSON.", 400);
    }

    if (body == null || typeof body !== "object") {
      console.error("[PDF export] parse-request: body null or not object");
      return errJson("parse-request", "Payload fehlt oder ist ungültig. Senden Sie Analysedaten oder analysisId.", 400);
    }

    const analysisId =
      typeof (body as { analysisId?: unknown }).analysisId === "string"
        ? (body as { analysisId: string }).analysisId.trim()
        : "";

    if (analysisId) {
      const supabase = getSupabase();
      if (!supabase) {
        return errJson("load-analysis", "Supabase nicht konfiguriert", 503);
      }
      const { data, error } = await supabase
        .from("analyse_runs")
        .select("id, created_at, project_name, file_name, score, status, management_summary, result_json, user_id")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        const isRls = error.message?.includes("row-level security");
        const msg = isRls
          ? "Lesen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
          : "Datenbankfehler beim Laden der Analyse.";
        console.error("[PDF export] load-analysis DB error", error.message);
        return errJson("load-analysis", msg, 500);
      }
      if (!data) {
        console.error("[PDF export] load-analysis: no row found for analysisId");
        return NextResponse.json({ error: true, stage: "load-analysis", message: "Analyse nicht gefunden oder kein Zugriff." }, { status: 404 });
      }
      payload = data;
    } else {
      payload = body;
    }

    const pdfOpts = readPdfBuildOptions(body as object);

    let report: ReturnType<typeof buildPdfReport>;
    try {
      report = buildPdfReport(payload, pdfOpts);
      console.error("[PDF export] build-report ok");
    } catch (buildErr) {
      const msg = buildErr instanceof Error ? buildErr.message : String(buildErr);
      console.error("[PDF export] build-report failed", msg);
      return errJson("build-report", msg, 500);
    }

    let html: string;
    try {
      html = renderPdfHtml(report);
      console.error("[PDF export] render-html ok, length:", html.length);
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
      console.error("[PDF export] render-html failed", msg);
      return errJson("render-html", msg, 500);
    }

    console.error("[PDF export] starting PDF engine (Chromium/Puppeteer)");
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await htmlToPdfBuffer({ html, footer: true });
      console.error("[PDF export] generate-pdf ok, size:", pdfBuffer.length);
    } catch (pdfErr) {
      const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      console.error("[PDF export] generate-pdf failed", msg);
      return errJson("generate-pdf", msg, 500);
    }

    const projectName = report.meta?.projectName ?? report.meta?.sourceFileName ?? "";
    const datePart = (report.meta?.analyzedAt ?? new Date().toLocaleDateString("de-DE")).replace(/\./g, "-");
    const safeProject = projectName ? sanitizeFilename(projectName) : "";
    const safeDate = sanitizeFilename(datePart);
    const filename = safeProject ? `analysebericht-${safeProject}-${safeDate}.pdf` : `analysebericht-${safeDate}.pdf`;

    const pdfBytes = new Uint8Array(pdfBuffer);
    console.error("[PDF export] send-response ok");
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PDF export] unexpected catch", message);
    return errJson("send-response", message, 500);
  }
}

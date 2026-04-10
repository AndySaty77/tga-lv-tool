import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  deleteAllTriggerFires,
  deleteTriggerFiresByAnalysis,
  fetchTriggerFiresGlobalStats,
  getTriggerFiresAdminClient,
} from "@/lib/triggerFiresAdmin";
import { isUuidString } from "@/lib/triggerFiresLog";

const RESET_CONFIRM = "RESET";

/**
 * GET: Statistik für globalen Reset (nur Admin, Service Role).
 */
export async function GET() {
  const user = await getUser().catch(() => null);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getTriggerFiresAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
  }

  try {
    const stats = await fetchTriggerFiresGlobalStats(supabase);
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type PostBody =
  | { action: "delete_by_analysis"; analysisId: string }
  | { action: "reset_all"; confirm: string };

/**
 * POST: trigger_fires löschen (analysebezogen oder global). Nur Admin.
 */
export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getTriggerFiresAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.action !== "string") {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  try {
    if (body.action === "delete_by_analysis") {
      const analysisId = typeof body.analysisId === "string" ? body.analysisId.trim() : "";
      if (!isUuidString(analysisId)) {
        return NextResponse.json({ error: "Ungültige analysis_id" }, { status: 400 });
      }
      const result = await deleteTriggerFiresByAnalysis(supabase, analysisId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "reset_all") {
      if (body.confirm !== RESET_CONFIRM) {
        return NextResponse.json(
          { error: `Bestätigung erforderlich: exakt „${RESET_CONFIRM}“ eingeben` },
          { status: 400 }
        );
      }
      const result = await deleteAllTriggerFires(supabase);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unbekannte action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

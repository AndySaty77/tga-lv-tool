import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { normalizeEditableTitleInput } from "@/lib/analysisDisplayTitle";
import { mergeManualProjectDataPatch } from "@/lib/manualProjectData";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("analyse_runs")
    .select("id, created_at, project_name, file_name, score, status, management_summary, result_json, user_id, is_favorite")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Lesen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

/**
 * Teilaktualisierung: optional `result_json` (Merge oberster Ebene) und/oder `project_name` über `projectName`.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  }

  let body: { resultJsonMerge?: Record<string, unknown>; projectName?: string | null; isFavorite?: boolean };
  try {
    body = (await req.json()) as {
      resultJsonMerge?: Record<string, unknown>;
      projectName?: string | null;
      isFavorite?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const hasMerge =
    body.resultJsonMerge != null && typeof body.resultJsonMerge === "object" && !Array.isArray(body.resultJsonMerge);
  const hasTitle = body.projectName !== undefined;
  const hasFavorite = typeof body.isFavorite === "boolean";

  if (!hasMerge && !hasTitle && !hasFavorite) {
    return NextResponse.json({ error: "resultJsonMerge, projectName und/oder isFavorite erforderlich" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("analyse_runs")
    .select("id, result_json, file_name, project_name")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    const isRls = fetchErr.message?.includes("row-level security");
    const msg = isRls
      ? "Lesen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : fetchErr.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (hasMerge) {
    const prev =
      existing.result_json != null && typeof existing.result_json === "object" && !Array.isArray(existing.result_json)
        ? (existing.result_json as Record<string, unknown>)
        : {};
    const incoming = body.resultJsonMerge! as Record<string, unknown>;
    const { manualProjectData: manualPatch, ...restIncoming } = incoming;
    const merged: Record<string, unknown> = { ...prev, ...restIncoming };
    if (manualPatch != null && typeof manualPatch === "object" && !Array.isArray(manualPatch)) {
      merged.manualProjectData = mergeManualProjectDataPatch(prev.manualProjectData, manualPatch);
    }
    updates.result_json = merged;
  }

  if (hasTitle) {
    updates.project_name = normalizeEditableTitleInput(body.projectName, existing.file_name);
  }

  if (hasFavorite) {
    updates.is_favorite = body.isFavorite;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("analyse_runs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, created_at, project_name, file_name, score, status, management_summary, result_json, is_favorite")
    .maybeSingle();

  if (updateErr) {
    const isRls = updateErr.message?.includes("row-level security");
    const msg = isRls
      ? "Update durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : updateErr.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Analyse nicht gefunden oder kein Zugriff" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: updated });
}

/**
 * Löscht eine Analyse (echte Zeilenlöschung in analyse_runs).
 * Nur der eigene Datensatz (user_id) wird gelöscht. Es gibt keinen separaten
 * File-Storage – alle zugehörigen Daten liegen in dieser Zeile (result_json etc.).
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  }

  const { data: deleted, error } = await supabase
    .from("analyse_runs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Löschen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!deleted?.length) {
    return NextResponse.json({ error: "Analyse nicht gefunden oder kein Zugriff" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}


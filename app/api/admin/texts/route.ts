import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_TEXTS_CONFIG, type TextsConfig } from "../../../../lib/textsConfig";

const TEXTS_CONFIG_KEY = "default";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

/** Tiefes Merge: base + existing + updates (updates überschreibt). */
function deepMerge<T extends Record<string, unknown>>(base: T, ...sources: (Partial<T> | null | undefined)[]): T {
  const out = { ...base } as T;
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const k of Object.keys(src) as (keyof T)[]) {
      const v = src[k];
      if (v === undefined) continue;
      const baseVal = out[k];
      if (typeof v === "object" && v !== null && !Array.isArray(v) && typeof baseVal === "object" && baseVal !== null && !Array.isArray(baseVal)) {
        (out as Record<string, unknown>)[k as string] = deepMerge(
          baseVal as Record<string, unknown>,
          v as Record<string, unknown>
        );
      } else {
        (out as Record<string, unknown>)[k as string] = v;
      }
    }
  }
  return out;
}

/**
 * Liefert die zentrale Text-Konfiguration.
 * Quelle: DB (Tabelle texts_config, key "default") mit Fallback auf lib/textsConfig.
 */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ config: DEFAULT_TEXTS_CONFIG, source: "default" });
  }
  const { data, error } = await supabase
    .from("texts_config")
    .select("value")
    .eq("key", TEXTS_CONFIG_KEY)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.value) {
    return NextResponse.json({ config: DEFAULT_TEXTS_CONFIG, source: "default" });
  }

  const merged = deepMerge(
    DEFAULT_TEXTS_CONFIG as unknown as Record<string, unknown>,
    data.value as Record<string, unknown>
  ) as TextsConfig;
  return NextResponse.json({ config: merged, source: "database" });
}

/**
 * Speichert die Text-Konfiguration (Teil- oder Vollupdate).
 * Body wird mit bestehender Config zusammengeführt.
 */
export async function PUT(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase nicht konfiguriert" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body muss ein Objekt sein" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("texts_config")
    .select("value")
    .eq("key", TEXTS_CONFIG_KEY)
    .eq("is_active", true)
    .maybeSingle();

  const current = (existing as { value?: Record<string, unknown> } | null)?.value ?? {};
  const merged = deepMerge(
    DEFAULT_TEXTS_CONFIG as unknown as Record<string, unknown>,
    current,
    body as Record<string, unknown>
  );

  const { error: upsertError } = await supabase.from("texts_config").upsert(
    { key: TEXTS_CONFIG_KEY, is_active: true, value: merged },
    { onConflict: "key" }
  );

  if (upsertError) {
    const isRls = upsertError.message?.includes("row-level security");
    const msg = isRls
      ? "Speichern durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für texts_config anlegen. Siehe docs/Scoring-Admin-RLS.md (analog für texts_config)."
      : upsertError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    config: deepMerge(DEFAULT_TEXTS_CONFIG as unknown as Record<string, unknown>, merged) as TextsConfig,
    source: "database",
  });
}

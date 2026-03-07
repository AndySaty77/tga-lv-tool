import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  AMPEL_THRESHOLDS,
  CATEGORY_KEYS_5,
  CLAIM_LEVELS,
  FALLBACK_SCORING_CONFIG,
  NACHTRAG_SCHWELLEN,
  NACHTRAG_WEICHWOERTER,
  PROJECT_TYPE_FACTORS,
  type CategoryKey5,
} from "../../../../lib/scoringConfig";

export type ScoringConfigResponse = {
  version: number;
  catMax: Record<CategoryKey5, number>;
  lvSize: { baseDivisor: number; maxBoost: number };
  easing: { type: "sqrt" | "linear" };
  total: { method: "mean" };
  ampelThresholds: { redMin: number; yellowMin: number };
  claimLevels: string[];
  nachtragSchwellen: { minFindings: number; highSeverityMin: number; basePenalty: number; penaltyMax: number };
  nachtragWeichwoerter: string[];
  projectTypeFactors: Record<string, number>;
};

const FALLBACK_FULL: ScoringConfigResponse = {
  ...FALLBACK_SCORING_CONFIG,
  ampelThresholds: { ...AMPEL_THRESHOLDS },
  claimLevels: [...CLAIM_LEVELS],
  nachtragSchwellen: { ...NACHTRAG_SCHWELLEN },
  nachtragWeichwoerter: [...NACHTRAG_WEICHWOERTER],
  projectTypeFactors: { ...PROJECT_TYPE_FACTORS },
};

function mergeConfig(v: any): ScoringConfigResponse {
  const base = FALLBACK_SCORING_CONFIG as ScoringConfigResponse;
  const cfg: ScoringConfigResponse = {
    version: Number(v?.version ?? base.version),
    catMax: (v?.catMax ? { ...base.catMax, ...v.catMax } : base.catMax) as Record<CategoryKey5, number>,
    lvSize: v?.lvSize ? { ...base.lvSize, ...v.lvSize } : base.lvSize,
    easing: v?.easing ? { ...base.easing, ...v.easing } : base.easing,
    total: v?.total ? { ...base.total, ...v.total } : base.total,
    ampelThresholds: v?.ampelThresholds ? { ...AMPEL_THRESHOLDS, ...v.ampelThresholds } : { ...AMPEL_THRESHOLDS },
    claimLevels: Array.isArray(v?.claimLevels) && v.claimLevels.length ? v.claimLevels : [...CLAIM_LEVELS],
    nachtragSchwellen: v?.nachtragSchwellen ? { ...NACHTRAG_SCHWELLEN, ...v.nachtragSchwellen } : { ...NACHTRAG_SCHWELLEN },
    nachtragWeichwoerter: Array.isArray(v?.nachtragWeichwoerter) ? v.nachtragWeichwoerter : [...NACHTRAG_WEICHWOERTER],
    projectTypeFactors: v?.projectTypeFactors && typeof v.projectTypeFactors === "object" ? v.projectTypeFactors : { ...PROJECT_TYPE_FACTORS },
  };
  for (const k of CATEGORY_KEYS_5) {
    if (!Number.isFinite(Number(cfg.catMax?.[k]))) (cfg.catMax as Record<string, number>)[k] = FALLBACK_SCORING_CONFIG.catMax[k];
  }
  if (!Number.isFinite(cfg.lvSize.baseDivisor) || cfg.lvSize.baseDivisor <= 0) cfg.lvSize.baseDivisor = FALLBACK_SCORING_CONFIG.lvSize.baseDivisor;
  if (!Number.isFinite(cfg.lvSize.maxBoost) || cfg.lvSize.maxBoost < 0) cfg.lvSize.maxBoost = FALLBACK_SCORING_CONFIG.lvSize.maxBoost;
  if (cfg.easing?.type !== "sqrt" && cfg.easing?.type !== "linear") cfg.easing = FALLBACK_SCORING_CONFIG.easing as { type: "sqrt" | "linear" };
  if (cfg.ampelThresholds.redMin < 0 || cfg.ampelThresholds.redMin > 100) cfg.ampelThresholds.redMin = AMPEL_THRESHOLDS.redMin;
  if (cfg.ampelThresholds.yellowMin < 0 || cfg.ampelThresholds.yellowMin > 100) cfg.ampelThresholds.yellowMin = AMPEL_THRESHOLDS.yellowMin;
  return cfg;
}

/** Supabase-Client für scoring_config: Service Role umgeht RLS (nur Server-seite). */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  // Service Role erlaubt Lesen/Schreiben trotz RLS (empfohlen für Admin-APIs).
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

/**
 * Liest die aktuelle Scoring-Config aus der DB (key "default", is_active true).
 * Enthält alle Bereiche inkl. Ampel, Claim, Nachtrag, Projekttyp.
 */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ config: FALLBACK_FULL, source: "fallback" });
  }
  const { data, error } = await supabase
    .from("scoring_config")
    .select("value")
    .eq("key", "default")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.value) {
    return NextResponse.json({ config: mergeConfig(null), source: "fallback" });
  }

  const cfg = mergeConfig(data.value as any);
  return NextResponse.json({ config: cfg, source: "database" });
}

function validateBody(body: any): { ok: true; value: any } | { ok: false; error: string } {
  const v = body && typeof body === "object" ? body : {};
  const out: any = {};

  if (v.version !== undefined) {
    const n = Number(v.version);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "version ungültig" };
    out.version = Math.round(n);
  }
  if (v.catMax && typeof v.catMax === "object") {
    out.catMax = {};
    for (const k of CATEGORY_KEYS_5) {
      const n = Number(v.catMax[k]);
      if (Number.isFinite(n) && n >= 1 && n <= 200) out.catMax[k] = Math.round(n);
    }
  }
  if (v.lvSize && typeof v.lvSize === "object") {
    const bd = Number(v.lvSize.baseDivisor);
    const mb = Number(v.lvSize.maxBoost);
    if (Number.isFinite(bd) && bd > 0) out.lvSize = { ...out.lvSize, baseDivisor: Math.round(bd) };
    if (Number.isFinite(mb) && mb >= 0 && mb <= 2) out.lvSize = { ...(out.lvSize || {}), maxBoost: mb };
  }
  if (v.easing?.type === "sqrt" || v.easing?.type === "linear") out.easing = { type: v.easing.type };
  if (v.ampelThresholds && typeof v.ampelThresholds === "object") {
    const r = Number(v.ampelThresholds.redMin);
    const y = Number(v.ampelThresholds.yellowMin);
    if (Number.isFinite(r) && r >= 0 && r <= 100) out.ampelThresholds = { ...(out.ampelThresholds || {}), redMin: Math.round(r) };
    if (Number.isFinite(y) && y >= 0 && y <= 100) out.ampelThresholds = { ...(out.ampelThresholds || {}), yellowMin: Math.round(y) };
  }
  if (Array.isArray(v.claimLevels)) {
    const arr = v.claimLevels.filter((x: any) => typeof x === "string" && x.trim().length > 0);
    if (arr.length) out.claimLevels = arr.map((x: string) => x.trim());
  }
  if (v.nachtragSchwellen && typeof v.nachtragSchwellen === "object") {
    const ns: any = {};
    ["minFindings", "highSeverityMin", "basePenalty", "penaltyMax"].forEach((key) => {
      const n = Number(v.nachtragSchwellen[key]);
      if (Number.isFinite(n) && n >= 0) ns[key] = Math.round(n);
    });
    if (Object.keys(ns).length) out.nachtragSchwellen = ns;
  }
  if (Array.isArray(v.nachtragWeichwoerter)) {
    const arr = v.nachtragWeichwoerter.filter((x: any) => typeof x === "string" && x.trim().length > 0);
    out.nachtragWeichwoerter = arr.map((x: string) => x.trim().toLowerCase());
  }
  if (v.projectTypeFactors && typeof v.projectTypeFactors === "object") {
    const rec: Record<string, number> = {};
    for (const [k, val] of Object.entries(v.projectTypeFactors)) {
      if (typeof k === "string" && typeof val === "number" && Number.isFinite(val)) rec[k] = val;
    }
    out.projectTypeFactors = rec;
  }
  return { ok: true, value: out };
}

/**
 * Speichert die Scoring-Config in der DB (key "default").
 * Body kann Teilbereiche enthalten; wird mit bestehender Config zusammengeführt.
 */
export async function PUT(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const validated = validateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("scoring_config")
    .select("value")
    .eq("key", "default")
    .eq("is_active", true)
    .maybeSingle();

  const current = (existing as any)?.value ?? {};
  const merged = { ...current, ...validated.value };
  if (validated.value.lvSize && typeof merged.lvSize === "object") merged.lvSize = { ...current.lvSize, ...validated.value.lvSize };
  if (validated.value.ampelThresholds && typeof merged.ampelThresholds === "object") merged.ampelThresholds = { ...current.ampelThresholds, ...validated.value.ampelThresholds };
  if (validated.value.nachtragSchwellen && typeof merged.nachtragSchwellen === "object") merged.nachtragSchwellen = { ...current.nachtragSchwellen, ...validated.value.nachtragSchwellen };
  if (validated.value.projectTypeFactors && typeof merged.projectTypeFactors === "object") merged.projectTypeFactors = { ...current.projectTypeFactors, ...validated.value.projectTypeFactors };

  const { error } = await supabase.from("scoring_config").upsert(
    { key: "default", is_active: true, value: merged },
    { onConflict: "key" }
  );

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Speichern durch RLS blockiert. Bitte SUPABASE_SERVICE_ROLE_KEY in .env.local setzen (nur Server, nicht NEXT_PUBLIC_) oder in Supabase eine RLS-Policy für scoring_config anlegen. Siehe docs/Scoring-Admin-RLS.md."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: mergeConfig(merged) });
}

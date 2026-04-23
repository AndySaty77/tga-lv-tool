"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { CLAIM_LEVELS } from "@/lib/scoringConfig";

type DisciplineKey = "sanitaer" | "heizung" | "lueftung" | "msr" | "elektro" | "kaelte";

type TriggerRow = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  trigger_type: string;
  keywords?: string[] | null;
  regex?: string | null;
  norms?: string[] | null;
  project_types?: string[] | null;
  weight: number;
  claim_level: string;
  risk_interpretation?: string | null;
  user_hint?: string | null;
  question_template?: string | null;
  offer_text_template?: string | null;
  is_active: boolean;
  disciplines?: string[] | null;
  created_at?: string | null;
  match_scope?: string | null;
  context_required?: string[] | null;
  exclude_keywords?: string[] | null;
  review_status?: string | null;
  internal_note?: string | null;
  family_cluster?: string | null;
  last_reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type TestResult = {
  ok: boolean;
  hit?: boolean;
  count?: number;
  findings?: Array<{
    id: string;
    category: string;
    title: string;
    severity: string;
    penalty: number;
    detail?: string;
  }>;
  error?: string;
};

type QualityLevel = "ok" | "warn" | "bad";

type QuickSegment =
  | "all"
  | "active"
  | "inactive"
  | "no_user_hint"
  | "review_open"
  | "critical"
  | "no_family"
  | "status_problematic"
  | "status_approved";

const REVIEW_STATUSES = [
  "draft",
  "in_progress",
  "checked_content",
  "checked_output",
  "approved",
  "problematic",
] as const;

type ReviewStatusKey = (typeof REVIEW_STATUSES)[number];

const REVIEW_STATUS_LABEL: Record<ReviewStatusKey, string> = {
  draft: "Entwurf",
  in_progress: "In Überarbeitung",
  checked_content: "Fachlich geprüft",
  checked_output: "Ausgabe geprüft",
  approved: "Freigegeben",
  problematic: "Problematisch",
};

/** Statuswechsel hierhin setzen automatisch „Zuletzt geprüft am“ (und ggf. reviewed_by). */
const STATUSES_STAMP_REVIEW = new Set<ReviewStatusKey>(["checked_content", "checked_output", "approved"]);

const LEGACY_REVIEW_STATUS_MAP: Record<string, ReviewStatusKey> = {
  entwurf: "draft",
  review_offen: "in_progress",
  freigegeben: "approved",
  archiviert: "approved",
};

const REVIEW_LABEL_TO_KEY: Record<string, ReviewStatusKey> = Object.fromEntries(
  (Object.entries(REVIEW_STATUS_LABEL) as [ReviewStatusKey, string][]).map(([k, label]) => [label.toLowerCase(), k])
) as Record<string, ReviewStatusKey>;

function normalizeReviewStatus(raw: string | null | undefined): ReviewStatusKey {
  const trimmed = (raw ?? "").trim();
  const v = trimmed.toLowerCase();
  if ((REVIEW_STATUSES as readonly string[]).includes(v)) return v as ReviewStatusKey;
  if (LEGACY_REVIEW_STATUS_MAP[v]) return LEGACY_REVIEW_STATUS_MAP[v];
  const fromLabel = REVIEW_LABEL_TO_KEY[trimmed.toLowerCase()];
  if (fromLabel) return fromLabel;
  return "draft";
}

function reviewStatusBadgeStyle(st: ReviewStatusKey): { bg: string; color: string } {
  switch (st) {
    case "draft":
      return { bg: "#eceff1", color: "#37474f" };
    case "in_progress":
      return { bg: "#e3f2fd", color: "#1565c0" };
    case "checked_content":
      return { bg: "#e0f2f1", color: "#00695c" };
    case "checked_output":
      return { bg: "#ede7f6", color: "#4527a0" };
    case "approved":
      return { bg: "#e8f5e9", color: "#2e7d32" };
    case "problematic":
      return { bg: "#ffebee", color: "#c62828" };
    default:
      return { bg: "#eceff1", color: "#37474f" };
  }
}

function fmtReviewTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

const split = (v?: string) =>
  (v || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

function stripPrefix(id: string) {
  return id.replace(/^DB_/, "").replace(/^SYS_/, "");
}

function severityDot(sev: string) {
  if (sev === "high") return "\uD83D\uDD34";
  if (sev === "medium") return "\uD83D\uDFE0";
  if (sev === "low") return "\uD83D\uDFE1";
  return "\u26AA";
}


function validateRegex(re: string | null | undefined) {
  if (!re || !re.trim()) return { ok: true, msg: "" };
  try {
    // eslint-disable-next-line no-new
    new RegExp(re, "gi");
    return { ok: true, msg: "Regex ok" };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? "Regex ungültig" };
  }
}

function fmtKB(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const ALLOWED_CATEGORY_KEYS = new Set([
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
]);

const CATEGORY_LABEL: Record<string, string> = {
  vertrags_lv_risiken: "Vertrags-/LV-Risiken",
  mengen_massenermittlung: "Mengen & Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen & Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
};

const CATEGORY_LABEL_TO_KEY: Record<string, string> = {
  "Vertrags-/LV-Risiko": "vertrags_lv_risiken",
  "Vertrags-/LV-Risiken": "vertrags_lv_risiken",
  "Vertrags- / LV-Risiken": "vertrags_lv_risiken",
  "Mengen & Massenermittlung": "mengen_massenermittlung",
  "Technische Vollständigkeit": "technische_vollstaendigkeit",
  "Schnittstellen & Nebenleistungen": "schnittstellen_nebenleistungen",
  "Schnittstellen und Nebenleistungen": "schnittstellen_nebenleistungen",
  Kalkulationsunsicherheit: "kalkulationsunsicherheit",
};

function normalizeCategory(raw: any): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (ALLOWED_CATEGORY_KEYS.has(v)) return v;
  return CATEGORY_LABEL_TO_KEY[v] ?? "";
}

const ALLOWED_DISCIPLINES: DisciplineKey[] = ["sanitaer", "heizung", "lueftung", "msr", "elektro", "kaelte"];
const DISC_LABEL: Record<DisciplineKey, string> = {
  sanitaer: "Sanitär",
  heizung: "Heizung",
  lueftung: "Lüftung",
  msr: "MSR/GA",
  elektro: "Elektro",
  kaelte: "Kälte",
};

function normalizeDisciplineList(raw: any): DisciplineKey[] {
  const vals = split(String(raw ?? ""));
  const cleaned = vals.map((x) =>
    x
      .toLowerCase()
      .trim()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
  );
  return cleaned.filter((x) => (ALLOWED_DISCIPLINES as string[]).includes(x)) as DisciplineKey[];
}

function disciplinesLabel(list?: string[] | null) {
  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return "—";
  return arr.map((x) => (DISC_LABEL as any)[x] ?? x).join(", ");
}

function arrToStr(a: string[] | null | undefined): string {
  if (!a || !a.length) return "";
  return a.join("; ");
}

function wordCount(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

/** UI-only Qualitätssignal (keine DB-Logik). */
function triggerQualityHeuristic(r: TriggerRow): QualityLevel {
  if (!r.name?.trim() || !r.disciplines?.length || !r.category) return "bad";
  const hint = (r.user_hint ?? "").trim();
  const qt = (r.question_template ?? "").trim();
  const ot = (r.offer_text_template ?? "").trim();
  if (!hint || !qt || !ot) return "warn";
  if (wordCount(hint) < 8 || hint.length < 40) return "warn";
  if (/^(ja|nein|ok|test|tbd|todo|n\/a)\b/i.test(hint)) return "warn";
  return "ok";
}

function heuristicReviewOpen(r: TriggerRow): boolean {
  return (
    !(r.user_hint ?? "").trim() || !(r.question_template ?? "").trim() || !(r.offer_text_template ?? "").trim()
  );
}

function segmentMatches(r: TriggerRow, seg: QuickSegment): boolean {
  if (seg === "all") return true;
  if (seg === "active") return r.is_active;
  if (seg === "inactive") return !r.is_active;
  if (seg === "no_user_hint") return !(r.user_hint ?? "").trim();
  if (seg === "review_open") return heuristicReviewOpen(r);
  if (seg === "critical") return r.weight >= 8 || r.claim_level === "Hoch";
  if (seg === "no_family") return !(r.family_cluster ?? "").trim();
  if (seg === "status_problematic") return normalizeReviewStatus(r.review_status) === "problematic";
  if (seg === "status_approved") return normalizeReviewStatus(r.review_status) === "approved";
  return true;
}

function duplicateNameHint(rows: TriggerRow[], r: TriggerRow): string | null {
  return duplicateNameHintByName(rows, r.name, r.id);
}

function duplicateNameHintByName(rows: TriggerRow[], name: string, excludeId?: string | null): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  const n = rows.filter(
    (x) => x.id !== excludeId && x.name.trim().toLowerCase().replace(/\s+/g, " ") === key
  ).length;
  if (n > 0) return `Gleicher Name wie ${n} weiterem Eintrag – Dubletten prüfen.`;
  return null;
}

function qualitySwatch(level: QualityLevel): { bg: string; label: string; title: string } {
  if (level === "bad") return { bg: "#fde8e8", label: "Rot", title: "Pflichtfelder unvollständig" };
  if (level === "warn") return { bg: "#fff8e6", label: "Gelb", title: "Ausgabe-/Pflegefelder ausbaufähig" };
  return { bg: "#e8f7ec", label: "Grün", title: "Kernfelder und typische Ausgaben befüllt" };
}

type PruefstatusToolbarFilter = "all" | "heuristic_open" | ReviewStatusKey;

function passesPruefstatusToolbar(r: TriggerRow, f: PruefstatusToolbarFilter): boolean {
  if (f === "all") return true;
  if (f === "heuristic_open") return heuristicReviewOpen(r);
  return normalizeReviewStatus(r.review_status) === f;
}

const TRIGGER_SELECT =
  "id,name,description,category,trigger_type,keywords,regex,norms,project_types,weight,claim_level,risk_interpretation,user_hint,question_template,offer_text_template,is_active,disciplines,created_at,match_scope,context_required,exclude_keywords,review_status,internal_note,family_cluster,last_reviewed_at,reviewed_by";

const LEGACY_GOV_STORAGE_KEY = "tga-admin-trigger-governance-v1";

export default function TriggersPage() {
  const [rows, setRows] = useState<TriggerRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<"" | DisciplineKey>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [activeToolbar, setActiveToolbar] = useState<"all" | "active" | "inactive">("all");
  const [pruefstatusFilter, setPruefstatusFilter] = useState<PruefstatusToolbarFilter>("all");
  const [quickSegment, setQuickSegment] = useState<QuickSegment>("all");

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_GOV_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  type FormState = {
    name: string;
    description: string;
    category: string;
    trigger_type: string;
    keywords: string;
    regex: string;
    norms: string;
    project_types: string;
    weight: number;
    claim_level: string;
    risk_interpretation: string;
    user_hint: string;
    question_template: string;
    offer_text_template: string;
    is_active: boolean;
    disciplines: string;
    match_scope: string;
    context_required: string;
    exclude_keywords: string;
    review_status: ReviewStatusKey;
    internal_note: string;
    family_cluster: string;
  };

  const [formData, setFormData] = useState<FormState | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const openEdit = () => {
    if (!selected) return;
    setFormData({
      name: selected.name,
      description: selected.description ?? "",
      category: selected.category,
      trigger_type: selected.trigger_type ?? "",
      keywords: arrToStr(selected.keywords),
      regex: selected.regex ?? "",
      norms: arrToStr(selected.norms),
      project_types: arrToStr(selected.project_types),
      weight: selected.weight,
      claim_level: selected.claim_level ?? "",
      risk_interpretation: selected.risk_interpretation ?? "",
      user_hint: selected.user_hint ?? "",
      question_template: selected.question_template ?? "",
      offer_text_template: selected.offer_text_template ?? "",
      is_active: selected.is_active,
      disciplines: arrToStr(selected.disciplines),
      match_scope: (selected.match_scope ?? "").trim(),
      context_required: arrToStr(selected.context_required),
      exclude_keywords: arrToStr(selected.exclude_keywords),
      review_status: normalizeReviewStatus(selected.review_status),
      internal_note: selected.internal_note ?? "",
      family_cluster: selected.family_cluster ?? "",
    });
    setEditingId(selected.id);
    setCreateNew(false);
  };

  const openCreate = () => {
    setFormData({
      name: "",
      description: "",
      category: "vertrags_lv_risiken",
      trigger_type: "",
      keywords: "",
      regex: "",
      norms: "",
      project_types: "",
      weight: 5,
      claim_level: "Mittel",
      risk_interpretation: "",
      user_hint: "",
      question_template: "",
      offer_text_template: "",
      is_active: true,
      disciplines: "",
      match_scope: "",
      context_required: "",
      exclude_keywords: "",
      review_status: "draft",
      internal_note: "",
      family_cluster: "",
    });
    setEditingId(null);
    setCreateNew(true);
    setSelectedId(null);
  };

  const closeForm = () => {
    setFormData(null);
    setEditingId(null);
    setCreateNew(false);
  };

  const handleSaveForm = async () => {
    if (!formData) return;
    if (!formData.name.trim()) {
      setMsg("Trigger-Name ist Pflicht.");
      return;
    }
    const categoryKey = normalizeCategory(formData.category);
    if (!categoryKey || !ALLOWED_CATEGORY_KEYS.has(categoryKey)) {
      setMsg("Ungültige Risikokategorie.");
      return;
    }
    const disciplines = normalizeDisciplineList(formData.disciplines);
    if (!disciplines.length) {
      setMsg("Mindestens ein Gewerk nötig (z.B. sanitaer; heizung).");
      return;
    }
    if (!CLAIM_LEVELS.includes(formData.claim_level as any)) {
      setMsg(`Claim-Level: ${CLAIM_LEVELS.join(", ")}.`);
      return;
    }
    const w = Number(formData.weight);
    if (!(w >= 1 && w <= 10)) {
      setMsg("Gewichtung 1–10.");
      return;
    }
    if (formData.regex.trim()) {
      const st = validateRegex(formData.regex.trim());
      if (!st.ok) {
        setMsg("Regex ungültig: " + st.msg);
        return;
      }
    }
    setFormSaving(true);
    setMsg("");
    try {
      const ms = (formData.match_scope ?? "").trim();
      const prevRow = editingId ? rows.find((x) => x.id === editingId) : null;
      const newReviewStatus = normalizeReviewStatus(formData.review_status);
      const prevReviewStatus = prevRow ? normalizeReviewStatus(prevRow.review_status) : null;

      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: categoryKey,
        trigger_type: formData.trigger_type.trim() || "",
        keywords: split(formData.keywords).length ? split(formData.keywords) : null,
        regex: formData.regex.trim() || null,
        norms: split(formData.norms).length ? split(formData.norms) : null,
        project_types: split(formData.project_types).length ? split(formData.project_types) : null,
        weight: w,
        claim_level: formData.claim_level,
        risk_interpretation: formData.risk_interpretation.trim() || null,
        user_hint: formData.user_hint.trim() || null,
        question_template: formData.question_template.trim() || null,
        offer_text_template: formData.offer_text_template.trim() || null,
        is_active: formData.is_active,
        disciplines,
        match_scope: ms || null,
        context_required: split(formData.context_required).length ? split(formData.context_required) : null,
        exclude_keywords: split(formData.exclude_keywords).length ? split(formData.exclude_keywords) : null,
        review_status: newReviewStatus,
        internal_note: formData.internal_note.trim() || null,
        family_cluster: formData.family_cluster.trim() || null,
      };

      const shouldStamp =
        STATUSES_STAMP_REVIEW.has(newReviewStatus) && newReviewStatus !== prevReviewStatus;
      if (shouldStamp) {
        payload.last_reviewed_at = new Date().toISOString();
      }

      await saveTrigger(payload as any, editingId ?? undefined);
      setMsg(editingId ? "Trigger aktualisiert." : "Trigger angelegt.");
      await load();
      closeForm();
    } catch (e: any) {
      setMsg("Fehler: " + (e?.message ?? String(e)));
    } finally {
      setFormSaving(false);
    }
  };

  const [testText, setTestText] = useState<string>(
    "Der Bestand ist aufzunehmen und in die Integration zu überführen.\nAnpassung an die bestehende Anlage erforderlich."
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/triggers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMsg("DB Fehler: " + (data?.error ?? `HTTP ${res.status}`));
        return;
      }
      const list = (data?.rows as TriggerRow[]) || [];
      setRows(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e: any) {
      setMsg("DB Fehler: " + (e?.message ?? "Unbekannt"));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const regexState = useMemo(() => validateRegex(selected?.regex), [selected?.regex]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const blob = `${r.name} ${r.description ?? ""} ${r.trigger_type} ${(r.keywords ?? []).join(" ")}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (disciplineFilter) {
        if (!r.disciplines?.includes(disciplineFilter)) return false;
      }
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (activeToolbar === "active" && !r.is_active) return false;
      if (activeToolbar === "inactive" && r.is_active) return false;
      if (!passesPruefstatusToolbar(r, pruefstatusFilter)) return false;
      if (!segmentMatches(r, quickSegment)) return false;
      return true;
    });
  }, [rows, searchQuery, disciplineFilter, categoryFilter, activeToolbar, pruefstatusFilter, quickSegment]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredRows.some((r) => r.id === selectedId)) {
      setSelectedId(filteredRows[0]?.id ?? null);
    }
  }, [filteredRows, selectedId]);

  async function onImport(file: File) {
    setMsg("Import läuft...");
    const text = await file.text();

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors?.length) {
      setMsg("CSV Fehler: " + parsed.errors[0].message);
      return;
    }

    const headerSet = new Set(((parsed.meta as any)?.fields as string[] | undefined) ?? []);

    const data = (parsed.data as any[])
      .map((r) => {
        const categoryKey = normalizeCategory(r["Risikokategorie"]);
        const disciplines = normalizeDisciplineList(r["Gewerk"]);
        const userHintRaw =
          r["Prüfhinweis (user_hint)"] ?? r["user_hint"] ?? r["User-Hinweis"] ?? r["Prüfhinweis"] ?? "";
        const matchScopeRaw = (r["Match-Scope"] ?? r["match_scope"] ?? "").toString().trim();
        const ctxRaw = (r["Kontext erforderlich"] ?? r["context_required"] ?? "").toString();
        const exRaw = (r["Ausschluss-Keywords"] ?? r["exclude_keywords"] ?? "").toString();
        const base: Record<string, unknown> = {
          name: (r["Trigger-Name"] || "").trim(),
          description: (r["Beschreibung"] || "").trim(),
          category: categoryKey,
          trigger_type: (r["Trigger-Art"] || "").trim(),
          norms: split(r["Norm"]),
          keywords: split(r["Keywords"]),
          project_types: split(r["Projekttyp"]),
          weight: Number(r["Gewichtung"] || 0),
          claim_level: (r["Claim-Level"] || "").trim(),
          risk_interpretation: (r["Risiko-Interpretation"] || "").trim(),
          question_template: (r["Rückfrage-Generator"] || "").trim(),
          offer_text_template: (r["Angebotstext-Baustein"] || "").trim(),
          user_hint: String(userHintRaw || "").trim() || null,
          is_active: String(r["is_active"] ?? "true").toLowerCase() !== "false",
          regex: (r["Regex"] || "").trim() || null,
          disciplines,
          match_scope: matchScopeRaw || null,
          context_required: split(ctxRaw).length ? split(ctxRaw) : null,
          exclude_keywords: split(exRaw).length ? split(exRaw) : null,
        };
        if (headerSet.has("Prüfstatus (review_status)") || headerSet.has("review_status")) {
          base.review_status = normalizeReviewStatus(
            String(r["Prüfstatus (review_status)"] ?? r["review_status"] ?? "")
          );
        }
        if (headerSet.has("Interne Notiz für Admins") || headerSet.has("internal_note")) {
          base.internal_note = String(r["Interne Notiz für Admins"] ?? r["internal_note"] ?? "").trim() || null;
        }
        if (headerSet.has("Themenfamilie") || headerSet.has("family_cluster")) {
          base.family_cluster = String(r["Themenfamilie"] ?? r["family_cluster"] ?? "").trim() || null;
        }
        return base;
      })
      .filter((x) => x.name);

    for (const r of data as any[]) {
      if (!r.name) return setMsg(`Fehlender Trigger-Name in CSV`);

      if (!r.category)
        return setMsg(`Ungültige Risikokategorie bei: ${r.name} (nur 5 Keys/Labels erlaubt)`);
      if (!ALLOWED_CATEGORY_KEYS.has(r.category))
        return setMsg(`Ungültige Risikokategorie-Key bei: ${r.name} -> ${r.category}`);

      if (!r.trigger_type) return setMsg(`Fehlende Trigger-Art bei: ${r.name}`);
      if (!(r.weight >= 1 && r.weight <= 10)) return setMsg(`Gewichtung 1–10 bei: ${r.name}`);
      if (!CLAIM_LEVELS.includes(r.claim_level as any))
        return setMsg(`Claim-Level (${CLAIM_LEVELS.join("/")}) bei: ${r.name}`);

      if (!Array.isArray(r.disciplines) || r.disciplines.length === 0)
        return setMsg(`Fehlendes Gewerk (Spalte "Gewerk") bei: ${r.name} (z.B. sanitaer)`);

      for (const d of r.disciplines) {
        if (!(ALLOWED_DISCIPLINES as string[]).includes(d))
          return setMsg(`Ungültiges Gewerk "${d}" bei: ${r.name} (erlaubt: ${ALLOWED_DISCIPLINES.join(", ")})`);
      }

      if (r.regex) {
        const st = validateRegex(r.regex);
        if (!st.ok) return setMsg(`Regex ungültig bei: ${r.name} -> ${st.msg}`);
      }
    }

    const res = await fetch("/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_many", data }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg("DB Upsert Fehler: " + (out?.error ?? `HTTP ${res.status}`));

    setMsg(`Import ok: ${(data as any[]).length} Trigger`);
    await load();
  }

  async function onExport() {
    setMsg("Export läuft...");

    const exportRows = (rows as any[]).map((r) => ({
      "Trigger-Name": r.name ?? "",
      Beschreibung: r.description ?? "",
      Risikokategorie: r.category ?? "",
      Risikokategorie_Label: CATEGORY_LABEL[r.category] ?? "",
      Norm: (r.norms ?? []).join(";"),
      "Trigger-Art": r.trigger_type ?? "",
      Keywords: (r.keywords ?? []).join(";"),
      Regex: r.regex ?? "",
      Projekttyp: (r.project_types ?? []).join(";"),
      Gewichtung: r.weight ?? "",
      "Claim-Level": r.claim_level ?? "",
      "Risiko-Interpretation": r.risk_interpretation ?? "",
      "Prüfhinweis (user_hint)": r.user_hint ?? "",
      "Rückfrage-Generator": r.question_template ?? "",
      "Angebotstext-Baustein": r.offer_text_template ?? "",
      is_active: r.is_active ?? true,
      Gewerk: Array.isArray(r.disciplines) ? r.disciplines.join(";") : "",
      "Match-Scope": r.match_scope ?? "",
      "Kontext erforderlich": Array.isArray(r.context_required) ? r.context_required.join(";") : "",
      "Ausschluss-Keywords": Array.isArray(r.exclude_keywords) ? r.exclude_keywords.join(";") : "",
      "Prüfstatus (review_status)": normalizeReviewStatus(r.review_status),
      "Interne Notiz für Admins": r.internal_note ?? "",
      Themenfamilie: r.family_cluster ?? "",
      "Zuletzt geprüft am": r.last_reviewed_at ?? "",
      "Zuletzt geprüft von": r.reviewed_by ?? "",
    }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "triggers_export.csv";
    a.click();
    URL.revokeObjectURL(url);

    setMsg(`Export ok: ${exportRows.length} Trigger`);
  }

  async function saveTrigger(
    payload: {
      name: string;
      description?: string | null;
      category: string;
      trigger_type: string;
      keywords?: string[] | null;
      regex?: string | null;
      norms?: string[] | null;
      project_types?: string[] | null;
      weight: number;
      claim_level: string;
      risk_interpretation?: string | null;
      user_hint?: string | null;
      question_template?: string | null;
      offer_text_template?: string | null;
      is_active: boolean;
      disciplines?: string[] | null;
      match_scope?: string | null;
      context_required?: string[] | null;
      exclude_keywords?: string[] | null;
      review_status?: string;
      internal_note?: string | null;
      family_cluster?: string | null;
      last_reviewed_at?: string | null;
      reviewed_by?: string | null;
    },
    existingId?: string | null
  ) {
    if (existingId) {
      const res = await fetch("/api/admin/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_one", payload, existingId }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error ?? `HTTP ${res.status}`);
      return;
    }
    const res = await fetch("/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_one", payload }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.error ?? `HTTP ${res.status}`);
  }

  async function testSelectedTrigger() {
    if (!selected) return;
    const fromForm = !!(formData && editingId === selected.id);

    setTestLoading(true);
    setTestResult(null);

    const regexVal = fromForm ? formData!.regex : selected.regex;
    if (regexVal) {
      const st = validateRegex(regexVal);
      if (!st.ok) {
        setTestLoading(false);
        setTestResult({ ok: false, error: `Regex ungültig: ${st.msg}` });
        return;
      }
    }

    const keywords = fromForm ? split(formData!.keywords) : selected.keywords ?? null;
    const norms = fromForm ? split(formData!.norms) : selected.norms ?? null;
    const project_types = fromForm ? split(formData!.project_types) : selected.project_types ?? null;
    const user_hint = fromForm ? formData!.user_hint.trim() || null : selected.user_hint ?? null;
    const question_template = fromForm ? formData!.question_template.trim() || null : selected.question_template ?? null;
    const offer_text_template = fromForm
      ? formData!.offer_text_template.trim() || null
      : selected.offer_text_template ?? null;
    const match_scope = fromForm ? (formData!.match_scope ?? "").trim() || null : selected.match_scope ?? null;
    const context_required = fromForm
      ? split(formData!.context_required).length
        ? split(formData!.context_required)
        : null
      : selected.context_required ?? null;
    const exclude_keywords = fromForm
      ? split(formData!.exclude_keywords).length
        ? split(formData!.exclude_keywords)
        : null
      : selected.exclude_keywords ?? null;

    const triggerForApi: any = {
      id: selected.id,
      name: fromForm ? formData!.name : selected.name,
      description: fromForm ? formData!.description.trim() || null : selected.description ?? null,
      category: fromForm ? normalizeCategory(formData!.category) || selected.category : selected.category,
      trigger_type: fromForm ? formData!.trigger_type.trim() || null : selected.trigger_type ?? null,
      keywords: keywords?.length ? keywords : null,
      regex: fromForm ? formData!.regex.trim() || null : selected.regex ?? null,
      norms: norms?.length ? norms : null,
      project_types: project_types?.length ? project_types : null,
      weight: fromForm ? formData!.weight : selected.weight,
      claim_level: fromForm ? formData!.claim_level : selected.claim_level ?? null,
      risk_interpretation: fromForm
        ? formData!.risk_interpretation.trim() || null
        : selected.risk_interpretation ?? null,
      user_hint,
      question_template,
      offer_text_template,
      is_active: fromForm ? formData!.is_active : selected.is_active,
      disciplines: fromForm ? normalizeDisciplineList(formData!.disciplines) : selected.disciplines ?? null,
      match_scope,
      context_required,
      exclude_keywords,
    };

    try {
      const res = await fetch("/api/test-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lvText: testText,
          trigger: triggerForApi,
        }),
      });

      const data = (await res.json()) as TestResult;
      if (!res.ok) setTestResult({ ok: false, error: (data as any)?.error || `HTTP ${res.status}` });
      else setTestResult(data);
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message ?? "Test fehlgeschlagen" });
    } finally {
      setTestLoading(false);
    }
  }

  const previewSource = useMemo(() => {
    if (formData && (editingId === selected?.id || (createNew && !selected))) {
      return {
        name: formData.name,
        description: formData.description,
        user_hint: formData.user_hint,
        question_template: formData.question_template,
        offer_text_template: formData.offer_text_template,
        disciplines: formData.disciplines,
        category: formData.category,
        weight: formData.weight,
        claim_level: formData.claim_level,
        is_active: formData.is_active,
      };
    }
    if (selected) {
      return {
        name: selected.name,
        description: selected.description ?? "",
        user_hint: selected.user_hint ?? "",
        question_template: selected.question_template ?? "",
        offer_text_template: selected.offer_text_template ?? "",
        disciplines: arrToStr(selected.disciplines),
        category: selected.category,
        weight: selected.weight,
        claim_level: selected.claim_level,
        is_active: selected.is_active,
      };
    }
    return null;
  }, [formData, editingId, selected, createNew]);

  const sectionBox: React.CSSProperties = {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e8e8e8",
    background: "#fcfcfc",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 900,
    color: "#222",
    marginBottom: 10,
    letterSpacing: 0.2,
  };

  const segmentDefs: { key: QuickSegment; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "active", label: "Aktiv" },
    { key: "inactive", label: "Inaktiv" },
    { key: "no_user_hint", label: "Ohne user_hint" },
    { key: "review_open", label: "Pflege offen" },
    { key: "no_family", label: "Ohne Themenfamilie" },
    { key: "status_problematic", label: "Problematisch" },
    { key: "status_approved", label: "Freigegeben" },
    { key: "critical", label: "Kritisch" },
  ];

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <style>{`
        .tgat-three { display: flex; flex-wrap: wrap; gap: 16px; align-items: stretch; }
        .tgat-col-list { flex: 1 1 260px; min-width: 240px; max-width: 100%; }
        .tgat-col-detail { flex: 2 1 380px; min-width: 280px; }
        .tgat-col-preview { flex: 1 1 300px; min-width: 280px; }
        @media (min-width: 1200px) {
          .tgat-three { flex-wrap: nowrap; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Trigger-Pflege</h1>
          <div style={{ color: "#666", marginTop: 6, maxWidth: 720 }}>
            Redaktionelle Pflege, Governance-Hinweise und Vorschau – ohne Produktions-Fire-Historie (siehe{" "}
            <Link href="/admin/triggers/insights" style={{ color: "#111" }}>
              Insights
            </Link>
            ).
          </div>
        </div>
        <Link href="/admin" style={{ color: "#111", textDecoration: "underline" }}>
          Zurück zum Admin
        </Link>
      </div>

      {/* Steuerleiste */}
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            type="search"
            placeholder="Suche (Name, Beschreibung, Art, Keywords…)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: "1 1 220px", minWidth: 180, padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          />

          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value as "" | DisciplineKey)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", minWidth: 140 }}
          >
            <option value="">Alle Gewerke</option>
            {ALLOWED_DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {DISC_LABEL[d]}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", minWidth: 160 }}
          >
            <option value="">Alle Kategorien</option>
            {Array.from(ALLOWED_CATEGORY_KEYS).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABEL[k] ?? k}
              </option>
            ))}
          </select>

          <select
            value={activeToolbar}
            onChange={(e) => setActiveToolbar(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            <option value="all">Aktiv: alle</option>
            <option value="active">Nur aktiv</option>
            <option value="inactive">Nur inaktiv</option>
          </select>

          <select
            value={pruefstatusFilter}
            onChange={(e) => setPruefstatusFilter(e.target.value as PruefstatusToolbarFilter)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", maxWidth: 300 }}
            title="Filter nach gespeichertem Prüfstatus in der Datenbank"
          >
            <option value="all">Prüfstatus: alle</option>
            <option value="heuristic_open">Pflege offen (heuristisch)</option>
            {REVIEW_STATUSES.map((k) => (
              <option key={k} value={k}>
                Prüfstatus: {REVIEW_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            CSV importieren
            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <button
            onClick={onExport}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            CSV exportieren
          </button>

          <button
            onClick={load}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Aktualisieren
          </button>

          <button
            onClick={openCreate}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #0a7a2f",
              background: "#fff",
              color: "#0a7a2f",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Neuer Trigger
          </button>

          <div style={{ marginLeft: "auto", color: "#666", fontWeight: 700, fontSize: 13 }}>
            {filteredRows.length} / {rows.length} Trigger sichtbar
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#777" }}>
          CSV-Pflichtspalte: <strong>Gewerk</strong> (sanitaer; heizung; …). Prüfstatus und Pflegefelder werden in Supabase
          gespeichert; ältere CSV ohne diese Spalten ändern bestehende Prüfdaten beim Import nicht.
        </div>

        {msg && (
          <div style={{ color: "#111", fontWeight: 700, fontSize: 14 }}>
            {msg}
          </div>
        )}
      </div>

      {/* Drei Spalten */}
      <div className="tgat-three" style={{ marginTop: 16 }}>
        {/* Liste */}
        <div className="tgat-col-list" style={{ border: "1px solid #e5e5e5", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 12, background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
            <div style={{ fontWeight: 900, color: "#111" }}>Trigger-Liste</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {segmentDefs.map((s) => {
                const on = quickSegment === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setQuickSegment(s.key)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: on ? "1px solid #111" : "1px solid #ddd",
                      background: on ? "#111" : "#fff",
                      color: on ? "#fff" : "#333",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ overflow: "auto", maxHeight: "min(70vh, 640px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {["Qual.", "Prüf.", "Name", "Gewerk", "Kategorie", "Gew.", "Claim", "Aktiv"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: 8,
                        borderBottom: "1px solid #e5e5e5",
                        color: "#444",
                        fontWeight: 900,
                        position: "sticky",
                        top: 0,
                        background: "#f5f5f5",
                        zIndex: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const active = r.id === selectedId;
                  const q = triggerQualityHeuristic(r);
                  const sw = qualitySwatch(q);
                  const pr = normalizeReviewStatus(r.review_status);
                  const pb = reviewStatusBadgeStyle(pr);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setSelectedId(r.id);
                        closeForm();
                      }}
                      style={{
                        cursor: "pointer",
                        background: active ? "#eef6ff" : "#fff",
                        borderBottom: "1px solid #f0f0f0",
                        boxShadow: active ? "inset 3px 0 0 #1769d8" : "none",
                        transition: "background 120ms",
                      }}
                      title="Auswählen"
                    >
                      <td style={{ padding: 8 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: q === "bad" ? "#d32f2f" : q === "warn" ? "#f9a825" : "#2e7d32",
                            verticalAlign: "middle",
                          }}
                          title={`Pflegequalität: ${sw.title}`}
                        />
                      </td>
                      <td style={{ padding: 8, maxWidth: 112 }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "3px 7px",
                            borderRadius: 999,
                            background: pb.bg,
                            color: pb.color,
                            whiteSpace: "nowrap",
                            maxWidth: 108,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={REVIEW_STATUS_LABEL[pr]}
                        >
                          {REVIEW_STATUS_LABEL[pr]}
                        </span>
                      </td>
                      <td style={{ padding: 8, fontWeight: 800, maxWidth: 160 }}>{r.name}</td>
                      <td style={{ padding: 8, color: "#444" }}>{disciplinesLabel(r.disciplines)}</td>
                      <td style={{ padding: 8, color: "#444" }}>{CATEGORY_LABEL[r.category] ?? r.category}</td>
                      <td style={{ padding: 8, fontWeight: 800 }}>{r.weight}</td>
                      <td style={{ padding: 8 }}>{r.claim_level}</td>
                      <td style={{ padding: 8 }}>{r.is_active ? "Ja" : "Nein"}</td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 14, color: "#777" }}>
                      Keine Trigger für die aktuelle Filterkombination.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail */}
        <div className="tgat-col-detail" style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 12 }}>Detail &amp; Bearbeitung</div>

          {formData ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button
                  onClick={handleSaveForm}
                  disabled={formSaving}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: "1px solid #0a7a2f",
                    background: formSaving ? "#ccc" : "#0a7a2f",
                    color: "#fff",
                    cursor: formSaving ? "default" : "pointer",
                    fontWeight: 800,
                  }}
                >
                  {formSaving ? "Speichern…" : "Speichern"}
                </button>
                <button
                  onClick={closeForm}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Abbrechen
                </button>
              </div>

              {/* A Basis */}
              <div style={sectionBox}>
                <div style={sectionTitle}>A) Basis</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Trigger-Name *
                    </label>
                    <input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Gewerk * (interne Keys, mit ;)
                    </label>
                    <input
                      value={formData.disciplines}
                      onChange={(e) => setFormData({ ...formData, disciplines: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      placeholder="sanitaer; heizung"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Risikokategorie *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                    >
                      {Array.from(ALLOWED_CATEGORY_KEYS).map((k) => (
                        <option key={k} value={k}>
                          {CATEGORY_LABEL[k] ?? k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Trigger-Art                    </label>
                    <input
                      value={formData.trigger_type}
                      onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      placeholder="z.B. keyword"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Gewichtung (1–10) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) || 5 })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Claim-Level *
                    </label>
                    <select
                      value={formData.claim_level}
                      onChange={(e) => setFormData({ ...formData, claim_level: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                    >
                      {CLAIM_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Trigger ist aktiv</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* B Match */}
              <div style={sectionBox}>
                <div style={sectionTitle}>B) Match-Logik</div>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Keywords (; getrennt)
                    </label>
                    <input
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Regex (optional)
                    </label>
                    <input
                      value={formData.regex}
                      onChange={(e) => setFormData({ ...formData, regex: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontFamily: "ui-monospace, monospace" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                        Normen (;)
                      </label>
                      <input
                        value={formData.norms}
                        onChange={(e) => setFormData({ ...formData, norms: e.target.value })}
                        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                        Projekttyp (;)
                      </label>
                      <input
                        value={formData.project_types}
                        onChange={(e) => setFormData({ ...formData, project_types: e.target.value })}
                        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                        Match-Scope                      </label>
                      <select
                        value={formData.match_scope || ""}
                        onChange={(e) => setFormData({ ...formData, match_scope: e.target.value })}
                        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      >
                        <option value="">Standard (voller Text / Kategorie-Logik)</option>
                        <option value="vortext_only">Nur Vorbemerkung/Vortext (vortext_only)</option>
                      </select>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                        Hinweis: Der Schnelltest unten nutzt nur den eingegebenen LV-Text ohne separaten Vortext-Split.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                        Kontext erforderlich (;)
                      </label>
                      <input
                        value={formData.context_required}
                        onChange={(e) => setFormData({ ...formData, context_required: e.target.value })}
                        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                        placeholder="Begriffe im Trefferfenster"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                        Ausschluss-Keywords (;)
                      </label>
                      <input
                        value={formData.exclude_keywords}
                        onChange={(e) => setFormData({ ...formData, exclude_keywords: e.target.value })}
                        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* C User output */}
              <div style={{ ...sectionBox, borderColor: "#cfe8fc", background: "#f6fbff" }}>
                <div style={sectionTitle}>C) Nutzer-Ausgabe &amp; Texte</div>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Interne Kurzbeschreibung
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#0d47a1", marginBottom: 4 }}>
                      Prüfhinweis für die Analyse-UI (user_hint)
                    </label>
                    <textarea
                      value={formData.user_hint}
                      onChange={(e) => setFormData({ ...formData, user_hint: e.target.value })}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 8,
                        border: "2px solid #1769d8",
                        resize: "vertical",
                        background: "#fff",
                      }}
                      placeholder="Kurzer, konkreter Hinweis für Leser:innen der Auswertung (nicht der LV-Fließtext)."
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Risiko-Interpretation
                    </label>
                    <textarea
                      value={formData.risk_interpretation}
                      onChange={(e) => setFormData({ ...formData, risk_interpretation: e.target.value })}
                      rows={2}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Rückfrage-Generator (Vorlage)
                    </label>
                    <textarea
                      value={formData.question_template}
                      onChange={(e) => setFormData({ ...formData, question_template: e.target.value })}
                      rows={2}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                      Angebotstext-Baustein
                    </label>
                    <textarea
                      value={formData.offer_text_template}
                      onChange={(e) => setFormData({ ...formData, offer_text_template: e.target.value })}
                      rows={2}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>

              {/* D Prüfung & Pflege */}
              <div style={{ ...sectionBox, borderColor: "#e0e0e0", background: "#fafafa" }}>
                <div style={sectionTitle}>D) Prüfung &amp; Pflege</div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                  <strong>Prüfstatus</strong> ist der manuelle Bearbeitungs- und Freigabestatus des Triggers (wird in der
                  Datenbank gespeichert). <strong>Pflegequalität</strong> ist eine automatische Einschätzung der
                  Vollständigkeit einiger Felder – kein Freigabenachweis und unabhängig vom Prüfstatus.
                </p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#333", marginBottom: 4 }}>
                      Prüfstatus
                    </label>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                      Wo steht die inhaltliche Bearbeitung? Wird zusammen mit den übrigen Feldern gespeichert.
                    </div>
                    <select
                      value={formData.review_status}
                      onChange={(e) =>
                        setFormData({ ...formData, review_status: e.target.value as ReviewStatusKey })
                      }
                      style={{ width: "100%", maxWidth: 400, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                    >
                      {REVIEW_STATUSES.map((k) => (
                        <option key={k} value={k}>
                          {REVIEW_STATUS_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                      Wenn Sie auf „Fachlich geprüft“, „Ausgabe geprüft“ oder „Freigegeben“ <strong>wechseln</strong>,
                      setzt das System automatisch „Zuletzt geprüft am“. „Zuletzt geprüft von“ wird nur ergänzt, wenn Sie
                      angemeldet sind und E-Mail oder Name aus dem Konto ermittelt werden kann.
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#333", marginBottom: 4 }}>
                      Themenfamilie
                    </label>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                      Freies Schlagwort zur inhaltlichen Gruppierung (z. B. Bestand, Schnittstelle) – nur für Admins.
                    </div>
                    <input
                      value={formData.family_cluster}
                      onChange={(e) => setFormData({ ...formData, family_cluster: e.target.value })}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                      placeholder="z. B. Bestand / Schnittstelle …"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#333", marginBottom: 4 }}>
                      Interne Notiz für Admins
                    </label>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                      Für Abstimmung im Team – erscheint nicht in der Analyse für Endkund:innen.
                    </div>
                    <textarea
                      value={formData.internal_note}
                      onChange={(e) => setFormData({ ...formData, internal_note: e.target.value })}
                      rows={3}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", resize: "vertical" }}
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 12,
                      padding: 12,
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #e5e5e5",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>Zuletzt geprüft am</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {editingId
                          ? fmtReviewTimestamp(rows.find((x) => x.id === editingId)?.last_reviewed_at)
                          : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>Wird bei Prüfschritten automatisch gesetzt.</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>Zuletzt geprüft von</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {editingId ? rows.find((x) => x.id === editingId)?.reviewed_by?.trim() || "—" : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>Nur wenn beim Speichern ein Login erkannt wird.</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>Pflegequalität (heuristisch)</div>
                      <div style={{ fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        {(() => {
                          const er = editingId ? rows.find((x) => x.id === editingId) : null;
                          if (!er) return <span>—</span>;
                          const qq = triggerQualityHeuristic(er);
                          return (
                            <>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: qq === "bad" ? "#d32f2f" : qq === "warn" ? "#f9a825" : "#2e7d32",
                                }}
                              />
                              {qualitySwatch(qq).title}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  {duplicateNameHintByName(rows, formData.name, editingId ?? undefined) && (
                    <div style={{ padding: 10, borderRadius: 8, background: "#fff8e6", border: "1px solid #f0c14b", fontSize: 13 }}>
                      <strong>Dubletten-Hinweis (heuristisch):</strong>{" "}
                      {duplicateNameHintByName(rows, formData.name, editingId ?? undefined)}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : selected ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button
                  onClick={openEdit}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Bearbeiten
                </button>
                <Link
                  href={`/admin/triggers/insights/${selected.id}`}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 800,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  Insights zu diesem Trigger
                </Link>
              </div>
              <div style={sectionBox}>
                <div style={sectionTitle}>Überblick</div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <div>
                    <strong>{selected.name}</strong>
                  </div>
                  <div style={{ color: "#555", marginTop: 6 }}>
                    {disciplinesLabel(selected.disciplines)} · {CATEGORY_LABEL[selected.category] ?? selected.category} ·
                    Gewicht {selected.weight} · Claim {selected.claim_level} · {selected.is_active ? "aktiv" : "inaktiv"}
                  </div>
                  {selected.description ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: "#777", fontWeight: 800 }}>Interne Kurzbeschreibung</div>
                      <div>{selected.description}</div>
                    </div>
                  ) : null}
                  {(selected.user_hint ?? "").trim() ? (
                    <div style={{ marginTop: 10, padding: 10, background: "#e8f2ff", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "#0d47a1", fontWeight: 800 }}>user_hint</div>
                      <div>{selected.user_hint}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, color: "#b06000", fontSize: 13 }}>Noch kein user_hint hinterlegt.</div>
                  )}
                </div>
              </div>
              <div style={{ ...sectionBox, background: "#fafafa" }}>
                <div style={sectionTitle}>Prüfung &amp; Pflege</div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                  <strong>Prüfstatus</strong> = manueller Bearbeitungs- und Freigabestatus.
                  <strong> Pflegequalität</strong> = automatische Vollständigkeits-Einschätzung, kein Freigabestatus.
                </p>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>Prüfstatus</span>
                    <div style={{ marginTop: 4 }}>
                      {(() => {
                        const pr = normalizeReviewStatus(selected.review_status);
                        const pb = reviewStatusBadgeStyle(pr);
                        return (
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: pb.bg,
                              color: pb.color,
                            }}
                          >
                            {REVIEW_STATUS_LABEL[pr]}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>Themenfamilie</span>
                    <div style={{ marginTop: 4 }}>{(selected.family_cluster ?? "").trim() || "—"}</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>Interne Notiz für Admins</span>
                    <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                      {(selected.internal_note ?? "").trim() || "—"}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>Zuletzt geprüft am</span>
                      <div style={{ marginTop: 4 }}>{fmtReviewTimestamp(selected.last_reviewed_at)}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>Zuletzt geprüft von</span>
                      <div style={{ marginTop: 4 }}>{selected.reviewed_by?.trim() || "—"}</div>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>Pflegequalität (heuristisch)</span>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      {(() => {
                        const qq = triggerQualityHeuristic(selected);
                        return (
                          <>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: qq === "bad" ? "#d32f2f" : qq === "warn" ? "#f9a825" : "#2e7d32",
                              }}
                            />
                            {qualitySwatch(qq).title}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {duplicateNameHint(rows, selected) && (
                    <div style={{ marginTop: 12, color: "#8a5b00", fontSize: 13 }}>{duplicateNameHint(rows, selected)}</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: "#777" }}>Liste links: Trigger wählen oder „Neuer Trigger“.</div>
          )}
        </div>

        {/* Preview & Test */}
        <div
          className="tgat-col-preview"
          style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Vorschau &amp; Test</div>
          <div style={{ color: "#666", fontSize: 12, marginBottom: 12 }}>
            Kompakte Textvorschau für die Auswahl. Keine Fire-Historie – dafür Insights.
          </div>

          {!selected && !createNew ? (
            <div style={{ color: "#777" }}>Kein Trigger gewählt.</div>
          ) : previewSource ? (
            <>
              <div style={{ padding: 12, borderRadius: 12, background: "#fafafa", border: "1px solid #eee", marginBottom: 12 }}>
                <div style={{ fontWeight: 900 }}>{previewSource.name || "(ohne Namen)"}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
                  {disciplinesLabel(normalizeDisciplineList(previewSource.disciplines))} ·{" "}
                  {CATEGORY_LABEL[previewSource.category] ?? previewSource.category} · Gew. {previewSource.weight} · Claim{" "}
                  {previewSource.claim_level} · {previewSource.is_active ? "aktiv" : "inaktiv"}
                </div>
                {previewSource.description?.trim() ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: "#777", fontWeight: 800 }}>Beschreibung</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{previewSource.description}</div>
                  </div>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#0d47a1", fontWeight: 800 }}>user_hint (Vorschau)</div>
                  <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {(previewSource.user_hint ?? "").trim() || "—"}
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#777", fontWeight: 800 }}>Rückfrage (Vorschau)</div>
                  <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {(previewSource.question_template ?? "").trim() || "—"}
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#777", fontWeight: 800 }}>Angebotsklärung (Vorschau)</div>
                  <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {(previewSource.offer_text_template ?? "").trim() || "—"}
                  </div>
                </div>
              </div>

              {selected && (
                <>
                  <div style={{ fontSize: 12, color: "#777", fontWeight: 800, marginBottom: 6 }}>Test-LV-Text</div>
                  <textarea
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    rows={6}
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      padding: 10,
                      resize: "vertical",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                    }}
                  />
                  <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>Größe: {fmtKB(new Blob([testText]).size)}</div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={testSelectedTrigger}
                      disabled={testLoading || !testText.trim()}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #111",
                        background: testLoading ? "#eee" : "#111",
                        color: testLoading ? "#111" : "#fff",
                        cursor: testLoading ? "default" : "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {testLoading ? "Teste…" : "Gegen LV-Text testen"}
                    </button>
                    <button
                      onClick={() => setTestResult(null)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      Test zurücksetzen
                    </button>
                  </div>

                  {testResult && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                      {!testResult.ok ? (
                        <div style={{ color: "#b00020", fontWeight: 900 }}>Fehler: {testResult.error}</div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 15,
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: testResult.hit ? "#e8f7ec" : "#fde8e8",
                              color: "#111",
                              marginBottom: 10,
                            }}
                          >
                            {testResult.hit ? "Ergebnis: feuert (Treffer)" : "Ergebnis: feuert nicht"}
                            <span style={{ color: "#666", fontWeight: 700, fontSize: 13, marginLeft: 8 }}>
                              ({testResult.count ?? 0} Finding(s))
                            </span>
                          </div>

                          {(testResult.findings ?? []).map((f) => (
                            <div key={f.id} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e5e5" }}>
                              <div style={{ fontWeight: 900 }}>
                                {severityDot(f.severity)} {f.title}
                              </div>
                              <div style={{ color: "#666", marginTop: 4, fontWeight: 700, fontSize: 12 }}>
                                Kategorie: {CATEGORY_LABEL[f.category] ?? f.category} · Penalty: {f.penalty} · id:{" "}
                                {stripPrefix(f.id)}
                              </div>
                              {f.detail && (
                                <div style={{ marginTop: 6, color: "#111", fontSize: 12, lineHeight: 1.45 }}>
                                  <span style={{ fontWeight: 800 }}>Treffergrund / Evidence:</span> {f.detail}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {selected.regex ? (
                    <div style={{ marginTop: 12, fontSize: 12 }}>
                      <span style={{ fontWeight: 800 }}>Regex-Check (gespeichert):</span>{" "}
                      <span style={{ color: regexState.ok ? "#0a7a2f" : "#b00020" }}>{regexState.msg || "—"}</span>
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

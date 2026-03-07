"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";
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
  question_template?: string | null;
  offer_text_template?: string | null;
  is_active: boolean;
  disciplines?: string[] | null;
  created_at?: string | null;
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

const split = (v?: string) =>
  (v || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

function stripPrefix(id: string) {
  return id.replace(/^DB_/, "").replace(/^SYS_/, "");
}

function severityDot(sev: string) {
  if (sev === "high") return "🔴";
  if (sev === "medium") return "🟠";
  if (sev === "low") return "🟡";
  return "⚪️";
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

/**
 * ✅ Kategorie-Standard:
 * - DB speichert NUR Keys (snake_case)
 * - UI zeigt Labels
 * - Import akzeptiert Keys ODER Labels und normalisiert auf Keys
 */
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

  "Kalkulationsunsicherheit": "kalkulationsunsicherheit",
};

function normalizeCategory(raw: any): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (ALLOWED_CATEGORY_KEYS.has(v)) return v;
  return CATEGORY_LABEL_TO_KEY[v] ?? "";
}

/**
 * ✅ Gewerk/Disziplinen
 * - DB speichert text[] in triggers.disciplines
 * - Import akzeptiert "Gewerk" als "sanitaer;heizung"
 */
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
  // tolerant: lower-case, trim, ä->ae etc. (minimal)
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

export default function TriggersPage() {
  const [rows, setRows] = useState<TriggerRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);

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
    question_template: string;
    offer_text_template: string;
    is_active: boolean;
    disciplines: string;
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
      question_template: selected.question_template ?? "",
      offer_text_template: selected.offer_text_template ?? "",
      is_active: selected.is_active,
      disciplines: arrToStr(selected.disciplines),
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
      question_template: "",
      offer_text_template: "",
      is_active: true,
      disciplines: "",
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
      const payload = {
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
        question_template: formData.question_template.trim() || null,
        offer_text_template: formData.offer_text_template.trim() || null,
        is_active: formData.is_active,
        disciplines,
      };
      await saveTrigger(payload, editingId ?? undefined);
      setMsg(editingId ? "Trigger aktualisiert." : "Trigger angelegt.");
      await load();
      closeForm();
      if (!editingId && rows.length === 0) setSelectedId(null);
    } catch (e: any) {
      setMsg("Fehler: " + (e?.message ?? String(e)));
    } finally {
      setFormSaving(false);
    }
  };

  // Test Panel
  const [testText, setTestText] = useState<string>(
    "Der Bestand ist aufzunehmen und in die Integration zu überführen.\nAnpassung an die bestehende Anlage erforderlich."
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("triggers")
      .select(
        "id,name,description,category,trigger_type,keywords,regex,norms,project_types,weight,claim_level,risk_interpretation,question_template,offer_text_template,is_active,disciplines,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) setMsg("DB Fehler: " + error.message);
    else {
      const list = (data as TriggerRow[]) || [];
      setRows(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const regexState = useMemo(() => validateRegex(selected?.regex), [selected?.regex]);

  async function onImport(file: File) {
    setMsg("Import läuft...");
    const text = await file.text();

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors?.length) {
      setMsg("CSV Fehler: " + parsed.errors[0].message);
      return;
    }

    const data = (parsed.data as any[])
      .map((r) => {
        const categoryKey = normalizeCategory(r["Risikokategorie"]);
        const disciplines = normalizeDisciplineList(r["Gewerk"]); // ✅ neu
        return {
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
          is_active: String(r["is_active"] ?? "true").toLowerCase() !== "false",
          regex: (r["Regex"] || "").trim() || null,

          // ✅ neu: wird in triggers.disciplines (text[]) gespeichert
          disciplines,
        };
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

      // ✅ Gewerk ist jetzt Pflicht (sonst feuert später wieder alles)
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

    // ✅ keine doppelten Trigger-Namen
    const { error } = await supabase.from("triggers").upsert(data as any[], { onConflict: "name" });
    if (error) return setMsg("DB Upsert Fehler: " + error.message);

    setMsg(`Import ok: ${(data as any[]).length} Trigger`);
    await load();
  }

  async function onExport() {
    setMsg("Export läuft...");

    const { data, error } = await supabase.from("triggers").select("*").order("created_at", { ascending: false });

    if (error) return setMsg("DB Export Fehler: " + error.message);

    const exportRows = (data as any[]).map((r) => ({
      "Trigger-Name": r.name ?? "",
      "Beschreibung": r.description ?? "",
      "Risikokategorie": r.category ?? "",
      "Risikokategorie_Label": CATEGORY_LABEL[r.category] ?? "",
      "Norm": (r.norms ?? []).join(";"),
      "Trigger-Art": r.trigger_type ?? "",
      "Keywords": (r.keywords ?? []).join(";"),
      "Regex": r.regex ?? "",
      "Projekttyp": (r.project_types ?? []).join(";"),
      "Gewichtung": r.weight ?? "",
      "Claim-Level": r.claim_level ?? "",
      "Risiko-Interpretation": r.risk_interpretation ?? "",
      "Rückfrage-Generator": r.question_template ?? "",
      "Angebotstext-Baustein": r.offer_text_template ?? "",
      "is_active": r.is_active ?? true,

      // ✅ neu
      "Gewerk": Array.isArray(r.disciplines) ? r.disciplines.join(";") : "",
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
      question_template?: string | null;
      offer_text_template?: string | null;
      is_active: boolean;
      disciplines?: string[] | null;
    },
    existingId?: string | null
  ) {
    if (existingId) {
      const { error } = await supabase.from("triggers").update(payload).eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("triggers").insert(payload);
      if (error) throw new Error(error.message);
    }
  }

  async function testSelectedTrigger() {
    if (!selected) return;

    setTestLoading(true);
    setTestResult(null);

    if (selected.regex) {
      const st = validateRegex(selected.regex);
      if (!st.ok) {
        setTestLoading(false);
        setTestResult({ ok: false, error: `Regex ungültig: ${st.msg}` });
        return;
      }
    }

    const triggerForApi: any = {
      id: selected.id,
      name: selected.name,
      description: selected.description ?? null,
      category: selected.category,
      trigger_type: selected.trigger_type ?? null,
      keywords: selected.keywords ?? null,
      regex: selected.regex ?? null,
      norms: null,
      weight: selected.weight,
      claim_level: selected.claim_level ?? null,
      risk_interpretation: selected.risk_interpretation ?? null,
      question_template: null,
      offer_text_template: null,
      is_active: selected.is_active,

      // ✅ neu: an API geben (optional; /api/test-trigger ignoriert es aktuell vermutlich)
      disciplines: selected.disciplines ?? null,
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

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Trigger Admin</h1>
          <div style={{ color: "#666", marginTop: 6 }}>Import/Export + Trigger-Tests direkt gegen LV-Text.</div>
          <div style={{ color: "#666", marginTop: 6, fontWeight: 700 }}>
            Pflicht-Spalte CSV: <span style={{ color: "#111" }}>"Gewerk"</span> (sanitaer/heizung/lueftung/msr/elektro/kaelte)
          </div>
        </div>
        <a href="/admin" style={{ color: "#111", textDecoration: "underline" }}>
          Zurück zum Admin
        </a>
      </div>

      {/* Toolbar Card */}
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          background: "#fafafa",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
            Refresh
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

          {selected && !formData && (
            <button
              onClick={openEdit}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Bearbeiten
            </button>
          )}
        </div>

        <div style={{ color: "#666", fontWeight: 700 }}>
          Trigger: {rows.length} • Auswahl: {selected ? selected.name : "-"}
        </div>

        {msg && (
          <div style={{ width: "100%", marginTop: 8, color: "#111", fontWeight: 700 }}>
            {msg}
          </div>
        )}
      </div>

      {/* Bearbeiten / Neuer Trigger Formular */}
      {formData && (
        <div
          style={{
            marginTop: 16,
            padding: 20,
            border: "1px solid #e5e5e5",
            borderRadius: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>
            {editingId ? "Trigger bearbeiten" : "Neuer Trigger"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Trigger-Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                placeholder="z.B. Unklare Bestandsaufnahme"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Risikokategorie *</label>
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Trigger-Art</label>
              <input
                value={formData.trigger_type}
                onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                placeholder="z.B. keyword"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Gewerk * (z.B. sanitaer; heizung)</label>
              <input
                value={formData.disciplines}
                onChange={(e) => setFormData({ ...formData, disciplines: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                placeholder="sanitaer; heizung"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Gewichtung (1–10) *</label>
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Claim-Level *</label>
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Beschreibung</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                placeholder="Optionale Beschreibung"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Keywords (mit ; trennen)</label>
              <input
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                placeholder="bestand; anpassung; integration"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Regex</label>
              <input
                value={formData.regex}
                onChange={(e) => setFormData({ ...formData, regex: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontFamily: "ui-monospace, monospace" }}
                placeholder="Optional, z.B. \b(aufnahme|übernahme)\b"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Risiko-Interpretation</label>
              <input
                value={formData.risk_interpretation}
                onChange={(e) => setFormData({ ...formData, risk_interpretation: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Normen (; getrennt)</label>
              <input
                value={formData.norms}
                onChange={(e) => setFormData({ ...formData, norms: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Projekttyp (; getrennt)</label>
              <input
                value={formData.project_types}
                onChange={(e) => setFormData({ ...formData, project_types: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Rückfrage-Generator</label>
              <input
                value={formData.question_template}
                onChange={(e) => setFormData({ ...formData, question_template: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 4 }}>Angebotstext-Baustein</label>
              <input
                value={formData.offer_text_template}
                onChange={(e) => setFormData({ ...formData, offer_text_template: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Aktiv</span>
              </label>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
        </div>
      )}

      {/* Main grid */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Table Card */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
            <div style={{ fontWeight: 900, color: "#111" }}>Trigger-Liste</div>
            <div style={{ color: "#666", marginTop: 4 }}>Tipp: Zeile anklicken, dann rechts testen.</div>
          </div>

          <div style={{ overflow: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {["Name", "Gewerk", "Kategorie", "Art", "Gew.", "Claim", "Aktiv"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderBottom: "1px solid #e5e5e5",
                        color: "#444",
                        fontWeight: 900,
                        position: "sticky",
                        top: 0,
                        background: "#f5f5f5",
                        zIndex: 1,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{
                        cursor: "pointer",
                        background: active ? "#efefef" : "#fff",
                        borderBottom: "1px solid #f0f0f0",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={(e) => {
                        if (active) return;
                        (e.currentTarget as HTMLTableRowElement).style.background = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        if (active) return;
                        (e.currentTarget as HTMLTableRowElement).style.background = "#fff";
                      }}
                      title="Klicken zum Auswählen"
                    >
                      <td style={{ padding: 10, fontWeight: 900 }}>
                        {r.name}
                        {active && (
                          <span
                            style={{
                              marginLeft: 10,
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "#111",
                              color: "#fff",
                              fontWeight: 900,
                            }}
                          >
                            SELECTED
                          </span>
                        )}
                      </td>

                      <td style={{ padding: 10 }}>{disciplinesLabel(r.disciplines)}</td>
                      <td style={{ padding: 10 }}>{CATEGORY_LABEL[r.category] ?? r.category}</td>
                      <td style={{ padding: 10 }}>{r.trigger_type}</td>
                      <td style={{ padding: 10, fontWeight: 800 }}>{r.weight}</td>
                      <td style={{ padding: 10 }}>{r.claim_level}</td>
                      <td style={{ padding: 10 }}>{r.is_active ? "Ja" : "Nein"}</td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 14, color: "#777" }}>
                      Noch keine Trigger – CSV importieren.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Test Card */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Trigger Test</div>
          <div style={{ color: "#666", marginTop: 6 }}>Testet nur den ausgewählten Trigger (kein System-Check).</div>

          {!selected ? (
            <div style={{ marginTop: 12, color: "#666" }}>Links einen Trigger auswählen.</div>
          ) : (
            <>
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: "#fafafa",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 900 }}>{selected.name}</div>
                <div style={{ marginTop: 6, color: "#666", fontWeight: 700 }}>
                  {disciplinesLabel(selected.disciplines)} • {CATEGORY_LABEL[selected.category] ?? selected.category} • Gewicht{" "}
                  {selected.weight} • Claim {selected.claim_level} • {selected.is_active ? "Aktiv" : "Inaktiv"}
                </div>

                {selected.description ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Beschreibung</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111" }}>{selected.description}</div>
                  </div>
                ) : null}

                {selected.keywords?.length ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Keywords</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111" }}>{(selected.keywords ?? []).join(", ")}</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>Keine Keywords hinterlegt.</div>
                )}

                {selected.risk_interpretation ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Risiko-Interpretation</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111" }}>{selected.risk_interpretation}</div>
                  </div>
                ) : null}

                {(selected.norms ?? []).length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Normen</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111" }}>{(selected.norms ?? []).join(", ")}</div>
                  </div>
                ) : null}

                {(selected.project_types ?? []).length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Projekttyp</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111" }}>{(selected.project_types ?? []).join(", ")}</div>
                  </div>
                ) : null}

                {selected.question_template ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Rückfrage-Generator</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111", wordBreak: "break-word" }}>{selected.question_template}</div>
                  </div>
                ) : null}

                {selected.offer_text_template ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Angebotstext-Baustein</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111", wordBreak: "break-word" }}>{selected.offer_text_template}</div>
                  </div>
                ) : null}

                {selected.regex ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Regex</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111", wordBreak: "break-word" }}>
                      {selected.regex}
                    </div>
                    {regexState.msg && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: regexState.ok ? "#0a7a2f" : "#b00020",
                          fontWeight: 900,
                        }}
                      >
                        {regexState.msg}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#777", fontWeight: 900, marginBottom: 6 }}>Test-LV-Text</div>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={8}
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
                <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>Länge: {fmtKB(new Blob([testText]).size)}</div>
              </div>

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
                  {testLoading ? "Teste..." : "Trigger testen"}
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
                  Clear
                </button>
              </div>

              {testResult && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                  {!testResult.ok ? (
                    <div style={{ color: "#b00020", fontWeight: 900 }}>Fehler: {testResult.error}</div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 900, color: "#111" }}>
                        Ergebnis:{" "}
                        {testResult.hit ? <span style={{ color: "#0a7a2f" }}>TREFFER ✅</span> : <span style={{ color: "#b00020" }}>kein Treffer ❌</span>}{" "}
                        <span style={{ color: "#666", fontWeight: 700 }}>(Findings: {testResult.count ?? 0})</span>
                      </div>

                      {(testResult.findings ?? []).map((f) => (
                        <div key={f.id} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e5e5" }}>
                          <div style={{ fontWeight: 900 }}>
                            {severityDot(f.severity)} {f.title}
                          </div>
                          <div style={{ color: "#666", marginTop: 4, fontWeight: 700, fontSize: 12 }}>
                            Kategorie: {CATEGORY_LABEL[f.category] ?? f.category} • Penalty: {f.penalty} • id: {stripPrefix(f.id)}
                          </div>
                          {f.detail && <div style={{ marginTop: 6, color: "#111", fontSize: 12 }}>{f.detail}</div>}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

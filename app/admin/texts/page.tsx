"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TextsConfig } from "@/lib/textsConfig";

/** Prüft zentrale Pflichtfelder (leer = nur Leerzeichen). */
function validateConfig(config: TextsConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const empty = (s: unknown) => (typeof s !== "string" || !s.trim());

  const tabKeys = ["uebersicht", "risiken", "nachtragspotenzial", "rueckfragen", "angebotsklarstellungen", "transparenz"];
  tabKeys.forEach((k) => {
    if (empty(config.customerUI.tabLabels[k])) errors.push(`Tab-Label „${k}“ darf nicht leer sein.`);
  });
  ["complexity", "totalRisk", "claimPotential", "riskAmpelCategories"].forEach((k) => {
    if (empty(config.customerUI.kpiLabels[k])) errors.push(`KPI-Label „${k}“ darf nicht leer sein.`);
  });
  ["projektdaten", "rueckfragenBlock", "angebotsBlock", "scoreErklaerung"].forEach((k) => {
    if (empty(config.customerUI.sectionHeaders[k])) errors.push(`Bereichsüberschrift „${k}“ darf nicht leer sein.`);
  });
  ["rueckfragenGenerieren", "annahmenGenerieren", "nachtragspotenzialErmitteln"].forEach((k) => {
    if (empty(config.customerUI.buttonLabels[k])) errors.push(`Button-Text „${k}“ darf nicht leer sein.`);
  });
  Object.entries(config.internal.categoryLabels).forEach(([k, v]) => {
    if (empty(v)) errors.push(`Kategorie-Label „${k}“ darf nicht leer sein.`);
  });
  ["high", "medium", "low"].forEach((k) => {
    if (empty(config.internal.severityLabels[k as keyof typeof config.internal.severityLabels]))
      errors.push(`Schweregrad „${k}“ darf nicht leer sein.`);
  });

  return { valid: errors.length === 0, errors };
}

/** Sammelt Suchtext pro Abschnitt (für Filter). */
function getSectionSearchText(config: TextsConfig): Record<string, string> {
  const ui = config.customerUI;
  const ex = config.explanation;
  const r = config.rueckfragen;
  const a = config.angebotsklarstellungen;
  const internal = config.internal;
  return {
    "section-ui": [
      Object.values(ui.tabLabels),
      Object.values(ui.kpiLabels),
      Object.values(ui.sectionHeaders),
      Object.values(ui.buttonLabels),
      ui.tabDescriptionUebersicht,
      ui.ampelLegend,
      Object.values(ui.ampel || {}),
      Object.values(ui.emptyStates || {}),
      Object.values(ex),
    ]
      .flat()
      .filter(Boolean)
      .join(" "),
    "section-begriffe": [...Object.values(internal.categoryLabels), ...Object.values(internal.severityLabels), ...Object.values(internal.keyFactLabels)].join(" "),
    "section-rueckfragen": [r.emptyState, r.generateButton, r.generateButtonLoading, ...Object.values(r.groupLabels)].join(" "),
    "section-angebot": [a.emptyState, a.generateButton, a.generateButtonLoading, a.loadingMessage, ...Object.values(a.groupLabels)].join(" "),
    "section-internal": "Interne Texte Admin",
  };
}

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 20,
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  background: "#fafafa",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#555",
  fontWeight: 700,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: "vertical",
};

const previewBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  border: "1px dashed #bbb",
  background: "#fff",
  fontSize: 13,
};

/** Vorschau: wie Kundenbegriffe (Tabs, KPIs, Ampel, Kategorien) in der Analyse wirken. */
function PreviewCustomerTerms({ config }: { config: TextsConfig }) {
  const ui = config.customerUI;
  const internal = config.internal;
  return (
    <div style={previewBoxStyle}>
      <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
        Vorschau: Kundenbegriffe (wie auf /analyse)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 10 }}>
        {["uebersicht", "risiken", "nachtragspotenzial", "rueckfragen", "angebotsklarstellungen"].map((id) => (
          <span key={id} style={{ padding: "6px 10px", background: "#f0f0f0", borderRadius: 6, fontWeight: 600 }}>
            {ui.tabLabels[id] ?? id}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{ui.kpiLabels.complexity}</div>
          <div style={{ fontWeight: 700 }}>42 <span style={{ fontSize: 12, color: "#9ca3af" }}>/ 100</span></div>
        </div>
        <div style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{ui.kpiLabels.totalRisk}</div>
          <div style={{ fontWeight: 700, color: "#a36b00" }}>🟡 {ui.ampel?.yellow ?? "Gelb"}</div>
        </div>
        <div style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{ui.kpiLabels.claimPotential}</div>
          <div style={{ fontWeight: 700 }}>{internal.severityLabels.medium}</div>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, color: "#666", marginBottom: 4 }}>{ui.sectionHeaders.projektdaten}</div>
        <div style={{ fontSize: 12, color: "#888" }}>{ui.sectionHeaders.projektdatenSub}</div>
      </div>
      <div style={{ fontSize: 12, color: "#666" }}>{ui.ampelLegend}</div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(internal.categoryLabels).slice(0, 3).map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 500, minWidth: 140 }}>{label}</span>
            <div style={{ flex: 1, height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: "60%", height: "100%", background: "#0a7a2f", borderRadius: 4 }} />
            </div>
            <span style={{ fontWeight: 700, color: "#0a7a2f" }}>🟢</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vorschau: Tab-Erklärtexte wie in der Analyse. */
function PreviewTabExplanations({ config }: { config: TextsConfig }) {
  const ui = config.customerUI;
  const ex = config.explanation;
  return (
    <div style={previewBoxStyle}>
      <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
        Vorschau: Tab-Erklärtexte (wie auf /analyse)
      </div>
      {[
        { tab: ui.tabLabels.risiken, text: ex.risiken },
        { tab: ui.tabLabels.nachtragspotenzial, text: ex.nachtragspotenzial },
        { tab: ui.tabLabels.transparenz, text: ex.transparenz },
      ].map(({ tab, text }, i) => (
        <div key={i} style={{ marginBottom: 12, padding: 12, background: "#f0f4f8", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <strong>{tab}</strong> — {text.slice(0, 120)}{text.length > 120 ? "…" : ""}
        </div>
      ))}
      <div style={{ padding: 12, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, marginTop: 8 }}>
        <div style={{ fontWeight: 700, color: "#666", marginBottom: 6 }}>{ui.sectionHeaders.scoreErklaerung}</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#333" }}>{config.explanation.scoreCalculation.slice(0, 200)}…</p>
      </div>
    </div>
  );
}

/** Vorschau: Rückfragen-Bereich (Header, Leerzustand, Button, Gruppen). */
function PreviewRueckfragen({ config }: { config: TextsConfig }) {
  const ui = config.customerUI;
  const r = config.rueckfragen;
  return (
    <div style={previewBoxStyle}>
      <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
        Vorschau: Rückfragen-Bereich (wie auf /analyse)
      </div>
      <div style={{ fontWeight: 700, color: "#666", marginBottom: 10 }}>{ui.sectionHeaders.rueckfragenBlock}</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#555", lineHeight: 1.5 }}>{r.emptyState}</p>
      <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #0a7a2f", background: "#0a7a2f", color: "#fff", fontWeight: 700, cursor: "default", fontSize: 13 }}>
        {r.generateButton}
      </button>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(r.groupLabels).map(([key, label]) => (
          <div key={key} style={{ padding: 8, background: "#f9f9f9", borderRadius: 6, border: "1px solid #eee" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#888" }}>Beispielfrage …</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vorschau: Angebotsklarstellungen-Bereich. */
function PreviewAngebotsklarstellungen({ config }: { config: TextsConfig }) {
  const ui = config.customerUI;
  const a = config.angebotsklarstellungen;
  return (
    <div style={previewBoxStyle}>
      <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
        Vorschau: Angebotsklarstellungen-Bereich (wie auf /analyse)
      </div>
      <div style={{ fontWeight: 700, color: "#666", marginBottom: 10 }}>{ui.sectionHeaders.angebotsBlock}</div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#555", lineHeight: 1.5 }}>{a.emptyState}</p>
      <button type="button" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #0a7a2f", background: "#0a7a2f", color: "#fff", fontWeight: 700, cursor: "default", fontSize: 13 }}>
        {a.generateButton}
      </button>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(a.groupLabels).map(([key, label]) => (
          <div key={key} style={{ padding: 8, background: "#f9f9f9", borderRadius: 6, border: "1px solid #eee" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#888" }}>Beispielannahme …</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  showCharCount = false,
  charCountHint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  showCharCount?: boolean;
  charCountHint?: string;
}) {
  const v = value ?? "";
  const isEmpty = !v.trim();
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: "#b00020", marginLeft: 4 }}>*</span>}
      </label>
      {multiline ? (
        <textarea
          value={v}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...textareaStyle, borderColor: required && isEmpty ? "#b00020" : undefined }}
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={v}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, borderColor: required && isEmpty ? "#b00020" : undefined }}
        />
      )}
      {required && isEmpty && (
        <div style={{ fontSize: 11, color: "#b00020", marginTop: 4 }}>Pflichtfeld – bitte ausfüllen.</div>
      )}
      {showCharCount && (
        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          {v.length} Zeichen{charCountHint ? ` · ${charCountHint}` : ""}
        </div>
      )}
    </div>
  );
}

function RecordFields({
  record,
  onChange,
  labels,
  requiredKeys,
}: {
  record: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  labels?: Record<string, string>;
  requiredKeys?: string[];
}) {
  const entries = Object.entries(record);
  const reqSet = useMemo(() => new Set(requiredKeys ?? []), [requiredKeys]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {entries.map(([k, v]) => {
        const isEmpty = !(v ?? "").trim();
        const isRequired = reqSet.has(k);
        return (
          <div key={k} style={{ marginBottom: 4 }}>
            <label style={labelStyle}>
              {labels?.[k] ?? k}
              {isRequired && <span style={{ color: "#b00020", marginLeft: 4 }}>*</span>}
            </label>
            <input
              type="text"
              value={v ?? ""}
              onChange={(e) => onChange({ ...record, [k]: e.target.value })}
              style={{ ...inputStyle, borderColor: isRequired && isEmpty ? "#b00020" : undefined }}
            />
            {isRequired && isEmpty && (
              <div style={{ fontSize: 11, color: "#b00020", marginTop: 4 }}>Pflichtfeld – bitte ausfüllen.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminTextsPage() {
  const [config, setConfig] = useState<TextsConfig | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/texts");
      const d = await r.json();
      setConfig(d.config ?? null);
      setSource(d.source ?? null);
    } catch {
      setConfig(null);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(<K extends keyof TextsConfig>(key: K, value: TextsConfig[K]) => {
    setConfig((c) => (c ? { ...c, [key]: value } : null));
  }, []);

  const updateNested = useCallback(
    <K extends keyof TextsConfig>(key: K, subKey: string, value: string) => {
      setConfig((c) => {
        if (!c) return null;
        const prev = c[key] as Record<string, string>;
        if (!prev || typeof prev !== "object") return c;
        return { ...c, [key]: { ...prev, [subKey]: value } };
      });
    },
    []
  );

  const updateRecord = useCallback(
    <K extends keyof TextsConfig>(key: K, next: Record<string, string>) => {
      setConfig((c) => (c ? { ...c, [key]: next } : null));
    },
    []
  );

  const validation = useMemo(() => (config ? validateConfig(config) : { valid: true, errors: [] as string[] }), [config]);

  const handleSave = async () => {
    if (!config) return;
    const { valid, errors } = validateConfig(config);
    if (!valid) {
      setMessage({ type: "error", text: "Pflichtfelder fehlen oder sind leer: " + errors.slice(0, 5).join(" ") + (errors.length > 5 ? " …" : "") });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessage({ type: "error", text: data?.error ?? "Speichern fehlgeschlagen" });
        return;
      }
      setMessage({ type: "ok", text: "Gespeichert." });
      if (data.config) setConfig(data.config);
      if (data.source) setSource(data.source);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error)?.message ?? "Netzwerkfehler" });
    } finally {
      setSaving(false);
    }
  };

  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const sectionSearchText = useMemo(() => (config ? getSectionSearchText(config) : {}), [config]);
  const sectionIds = ["section-ui", "section-begriffe", "section-rueckfragen", "section-angebot", "section-internal"];
  const sectionVisible = useCallback(
    (id: string) => {
      if (sectionFilter) {
        const n = sectionIds.indexOf(id);
        if (n === -1) return true;
        if (sectionFilter !== String(n + 1)) return false;
      }
      if (!searchQuery.trim()) return true;
      const text = sectionSearchText[id] ?? "";
      return text.toLowerCase().includes(searchQuery.trim().toLowerCase());
    },
    [sectionFilter, searchQuery, sectionSearchText]
  );

  if (loading && !config) {
    return (
      <div style={{ padding: 28, fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#666" }}>Lade Texte…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 28,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        maxWidth: 900,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Texte</h1>
          <p style={{ color: "#666", marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
            Zentrale Pflege von Labels und Erklärungstexten für die Analyse-Oberfläche und interne Bereiche.
          </p>
          {source && (
            <p style={{ fontSize: 12, color: "#666", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
              Quelle: <strong>{source === "database" ? "Datenbank (texts_config)" : "Default (lib/textsConfig.ts)"}</strong>.
              {source === "database"
                ? " Speicherung: dauerhaft in der Datenbank."
                : " Speicherung: Tabelle texts_config in Supabase anlegen (key „default“, value JSON), dann wird hier persistiert. Siehe docs/Texts-Admin-Persistenz.md."}
            </p>
          )}
        </div>
        <a href="/admin" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zurück zum Admin
        </a>
      </header>

      {!validation.valid && config && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fff3e0", border: "1px solid #ffb74d", color: "#e65100", fontSize: 13 }}>
          <strong>Hinweis:</strong> Einige Pflichtfelder sind leer. Bitte zentrale Labels und Kundenüberschriften ausfüllen, bevor Sie speichern.
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: message.type === "ok" ? "#e8f5e9" : "#ffebee",
            color: message.type === "ok" ? "#1b5e20" : "#b71c1c",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      {config && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Abschnitt:</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
          >
            <option value="">Alle anzeigen</option>
            <option value="1">1. Kundenoberfläche</option>
            <option value="2">2. Kundenfreundliche Begriffe</option>
            <option value="3">3. Rückfragen</option>
            <option value="4">4. Angebotsklarstellungen</option>
            <option value="5">5. Interne Texte</option>
          </select>
          <input
            type="search"
            placeholder="Suchen in Labels und Inhalten…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, minWidth: 220 }}
          />
          {(sectionFilter || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => { setSectionFilter(""); setSearchQuery(""); }}
              style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {!config ? (
        <p style={{ marginTop: 24, color: "#b00020" }}>Konfiguration konnte nicht geladen werden.</p>
      ) : (
        <>
          {/* 1. Kundenoberfläche */}
          <section id="section-ui" style={{ ...sectionStyle, display: sectionVisible("section-ui") ? undefined : "none" }} aria-labelledby="head-section-ui">
            <h2 id="head-section-ui" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              1. Kundenoberfläche
            </h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Seitenüberschriften, Tab-Namen, KPI- und Bereichsbezeichnungen, Buttons, Ampel und Erklärtexte für /analyse.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Tab-Namen</div>
                <RecordFields
                  record={config.customerUI.tabLabels}
                  onChange={(next) => update("customerUI", { ...config.customerUI, tabLabels: next })}
                  requiredKeys={["uebersicht", "risiken", "nachtragspotenzial", "rueckfragen", "angebotsklarstellungen", "transparenz"]}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>KPI-Labels</div>
                <RecordFields
                  record={config.customerUI.kpiLabels}
                  onChange={(next) => update("customerUI", { ...config.customerUI, kpiLabels: next })}
                  requiredKeys={["complexity", "totalRisk", "claimPotential", "riskAmpelCategories"]}
                />
              </div>
            </div>
            <Field
              label="Tab-Beschreibung Übersicht"
              value={config.customerUI.tabDescriptionUebersicht}
              onChange={(v) => update("customerUI", { ...config.customerUI, tabDescriptionUebersicht: v })}
            />
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Bereichsüberschriften (sectionHeaders)</div>
              <RecordFields
                record={config.customerUI.sectionHeaders}
                onChange={(next) => update("customerUI", { ...config.customerUI, sectionHeaders: next })}
                requiredKeys={["projektdaten", "rueckfragenBlock", "angebotsBlock", "scoreErklaerung"]}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Button-Texte</div>
              <RecordFields
                record={config.customerUI.buttonLabels}
                onChange={(next) => update("customerUI", { ...config.customerUI, buttonLabels: next })}
                requiredKeys={["rueckfragenGenerieren", "annahmenGenerieren", "nachtragspotenzialErmitteln"]}
              />
            </div>
            {config.customerUI.ampel && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Ampel (Grün/Gelb/Rot)</div>
                <RecordFields
                  record={config.customerUI.ampel as unknown as Record<string, string>}
                  onChange={(next) => update("customerUI", { ...config.customerUI, ampel: next as TextsConfig["customerUI"]["ampel"] })}
                />
                <Field
                  label="Ampel-Legende"
                  value={config.customerUI.ampelLegend}
                  onChange={(v) => update("customerUI", { ...config.customerUI, ampelLegend: v })}
                />
              </div>
            )}
            {config.customerUI.emptyStates && Object.keys(config.customerUI.emptyStates).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Leerzustände (emptyStates)</div>
                <RecordFields
                  record={config.customerUI.emptyStates}
                  onChange={(next) => update("customerUI", { ...config.customerUI, emptyStates: next })}
                />
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Erklärtexte (Tabs)</div>
              <Field label="Risiken (Tab)" value={config.explanation.risiken} onChange={(v) => updateNested("explanation", "risiken", v)} multiline showCharCount charCountHint="längerer Fließtext" />
              <Field label="Nachtragspotenzial (Tab)" value={config.explanation.nachtragspotenzial} onChange={(v) => updateNested("explanation", "nachtragspotenzial", v)} multiline showCharCount charCountHint="längerer Fließtext" />
              <Field label="Rückfragen (Tab)" value={config.explanation.rueckfragen} onChange={(v) => updateNested("explanation", "rueckfragen", v)} multiline showCharCount />
              <Field label="Angebotsklarstellungen (Tab)" value={config.explanation.angebotsklarstellungen} onChange={(v) => updateNested("explanation", "angebotsklarstellungen", v)} multiline showCharCount />
              <Field label="Transparenz (Tab)" value={config.explanation.transparenz} onChange={(v) => updateNested("explanation", "transparenz", v)} multiline showCharCount />
              <Field label="Score-Berechnung (Erklärung)" value={config.explanation.scoreCalculation} onChange={(v) => updateNested("explanation", "scoreCalculation", v)} multiline showCharCount charCountHint="längerer Fließtext" />
            </div>
            <PreviewCustomerTerms config={config} />
            <PreviewTabExplanations config={config} />
          </section>

          {/* 2. Kundenfreundliche Begriffe */}
          <section id="section-begriffe" style={{ ...sectionStyle, display: sectionVisible("section-begriffe") ? undefined : "none" }} aria-labelledby="head-section-begriffe">
            <h2 id="head-section-begriffe" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              2. Kundenfreundliche Begriffe
            </h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Verständliche Bezeichnungen für Kategorien, Schweregrade und Projektdaten (z. B. technische Keys → Anzeige für Nutzer).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Kategorie-Labels</div>
                <RecordFields
                  record={config.internal.categoryLabels}
                  onChange={(next) => update("internal", { ...config.internal, categoryLabels: next })}
                  requiredKeys={Object.keys(config.internal.categoryLabels)}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Schweregrad (high/medium/low)</div>
                <RecordFields
                  record={config.internal.severityLabels}
                  onChange={(next) => update("internal", { ...config.internal, severityLabels: next })}
                  requiredKeys={["high", "medium", "low"]}
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Projektdaten / KeyFacts</div>
              <RecordFields
                record={config.internal.keyFactLabels}
                onChange={(next) => update("internal", { ...config.internal, keyFactLabels: next })}
              />
            </div>
            <div style={previewBoxStyle}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
                Vorschau: Kundenbegriffe (Kategorien & Schweregrade)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {Object.entries(config.internal.categoryLabels).map(([k, label]) => (
                  <span key={k} style={{ padding: "4px 8px", background: "#e8f5e9", borderRadius: 6, fontSize: 12 }}>{label}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Schweregrade:</span>
                <span style={{ color: "#b00020" }}>{config.internal.severityLabels.high}</span>
                <span style={{ color: "#a36b00" }}>{config.internal.severityLabels.medium}</span>
                <span style={{ color: "#0a7a2f" }}>{config.internal.severityLabels.low}</span>
              </div>
            </div>
          </section>

          {/* 3. Rückfragen */}
          <section id="section-rueckfragen" style={{ ...sectionStyle, display: sectionVisible("section-rueckfragen") ? undefined : "none" }} aria-labelledby="head-section-rueckfragen">
            <h2 id="head-section-rueckfragen" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              3. Rückfragen
            </h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Standardtexte und Templates für den Rückfragen-Bereich (leere Ansicht, Buttons, Gruppenbezeichnungen).
            </p>
            <Field label="Leerzustand (Hinweis)" value={config.rueckfragen.emptyState} onChange={(v) => updateNested("rueckfragen", "emptyState", v)} multiline showCharCount />
            <Field label="Button: Rückfragen generieren" value={config.rueckfragen.generateButton} onChange={(v) => updateNested("rueckfragen", "generateButton", v)} required />
            <Field label="Button (Ladezustand)" value={config.rueckfragen.generateButtonLoading} onChange={(v) => updateNested("rueckfragen", "generateButtonLoading", v)} />
            <Field label="Debug-Titel (intern)" value={config.rueckfragen.debugTitle} onChange={(v) => updateNested("rueckfragen", "debugTitle", v)} />
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Gruppen-Labels</div>
              <RecordFields
                record={config.rueckfragen.groupLabels}
                onChange={(next) => update("rueckfragen", { ...config.rueckfragen, groupLabels: next })}
              />
            </div>
            <PreviewRueckfragen config={config} />
          </section>

          {/* 4. Angebotsklarstellungen */}
          <section id="section-angebot" style={{ ...sectionStyle, display: sectionVisible("section-angebot") ? undefined : "none" }} aria-labelledby="head-section-angebot">
            <h2 id="head-section-angebot" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              4. Angebotsklarstellungen
            </h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Standardbausteine und Templates für Angebotsannahmen / Klarstellungen.
            </p>
            <Field label="Leerzustand (Hinweis)" value={config.angebotsklarstellungen.emptyState} onChange={(v) => updateNested("angebotsklarstellungen", "emptyState", v)} multiline showCharCount />
            <Field label="Button: Annahmen generieren" value={config.angebotsklarstellungen.generateButton} onChange={(v) => updateNested("angebotsklarstellungen", "generateButton", v)} required />
            <Field label="Button (Ladezustand)" value={config.angebotsklarstellungen.generateButtonLoading} onChange={(v) => updateNested("angebotsklarstellungen", "generateButtonLoading", v)} />
            <Field label="Ladehinweis (KI)" value={config.angebotsklarstellungen.loadingMessage} onChange={(v) => updateNested("angebotsklarstellungen", "loadingMessage", v)} />
            <Field label="Debug-Titel (intern)" value={config.angebotsklarstellungen.debugTitle} onChange={(v) => updateNested("angebotsklarstellungen", "debugTitle", v)} />
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Gruppen-Labels</div>
              <RecordFields
                record={config.angebotsklarstellungen.groupLabels}
                onChange={(next) => update("angebotsklarstellungen", { ...config.angebotsklarstellungen, groupLabels: next })}
              />
            </div>
            <PreviewAngebotsklarstellungen config={config} />
          </section>

          {/* 5. Interne Texte */}
          <section id="section-internal" style={{ ...sectionStyle, display: sectionVisible("section-internal") ? undefined : "none" }} aria-labelledby="head-section-internal">
            <h2 id="head-section-internal" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              5. Interne Texte
            </h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Admin-Bezeichnungen und Hilfetexte. Die Bezeichnungen für Kategorien, Schweregrade und KeyFacts (Bereich 2) werden auch in der Analyse angezeigt. Rein interne Texte (z. B. Trigger-Seite, Scoring-Seite, Debug) liegen derzeit noch im Code und können später hier ergänzt werden.
            </p>
            <p style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>
              Keine weiteren internen Textfelder in der Config – Bereich 2 (Kundenfreundliche Begriffe) enthält die zentral gepflegten Labels für Analyse und Auswertung.
            </p>
          </section>

          {/* Speichern */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !validation.valid}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid #0a7a2f",
                background: saving || !validation.valid ? "#ccc" : "#0a7a2f",
                color: "#fff",
                fontWeight: 800,
                cursor: saving || !validation.valid ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {saving ? "Speichern…" : validation.valid ? "Speichern" : "Speichern (Pflichtfelder fehlen)"}
            </button>
            <button type="button" onClick={load} disabled={loading} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}>
              Erneut laden
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
        <a href="/analyse" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zur Analyse-Seite
        </a>
      </div>
    </div>
  );
}

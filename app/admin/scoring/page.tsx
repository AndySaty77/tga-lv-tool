"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScoringConfigResponse } from "@/app/api/admin/scoring-config/route";
import { CATEGORY_KEYS_5 } from "@/lib/scoringConfig";
import type { CategoryKey5 } from "@/lib/scoringConfig";

const CATEGORY_LABEL: Record<CategoryKey5, string> = {
  vertrags_lv_risiken: "Vertrags-/LV-Risiken",
  mengen_massenermittlung: "Mengen & Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen & Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
};

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
  fontWeight: 700,
  color: "#444",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 200,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
  marginTop: 6,
  marginBottom: 0,
  lineHeight: 1.55,
  maxWidth: "100%",
};

export default function AdminScoringPage() {
  const [config, setConfig] = useState<ScoringConfigResponse | null>(null);
  const [configSource, setConfigSource] = useState<"database" | "fallback" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/scoring-config");
      const d = await r.json();
      setConfig(d.config ?? null);
      setConfigSource(d.source ?? null);
    } catch {
      setConfig(null);
      setConfigSource(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(<K extends keyof ScoringConfigResponse>(key: K, value: ScoringConfigResponse[K]) => {
    setConfig((c) => (c ? { ...c, [key]: value } : null));
  }, []);

  const updateNested = useCallback(
    <K extends keyof ScoringConfigResponse>(key: K, subKey: string, value: number) => {
      setConfig((c) => {
        if (!c) return null;
        const prev = c[key] as Record<string, unknown>;
        if (!prev || typeof prev !== "object") return c;
        return { ...c, [key]: { ...prev, [subKey]: value } };
      });
    },
    []
  );

  const updateCatMax = useCallback((k: CategoryKey5, value: number) => {
    setConfig((c) => (c ? { ...c, catMax: { ...c.catMax, [k]: value } } : null));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessage({ type: "error", text: data?.error ?? "Speichern fehlgeschlagen" });
        return;
      }
      setMessage({ type: "ok", text: "Gespeichert. Werte werden bei der nächsten Analyse verwendet." });
      if (data.config) setConfig(data.config);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error)?.message ?? "Netzwerkfehler" });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div style={{ padding: 28, fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#666" }}>Lade Konfiguration…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 28,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        maxWidth: 820,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Scoring</h1>
          <p style={{ color: "#666", marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
            Interne Konfiguration der Bewertungslogik. Nur für Admins – keine Kundenoberfläche.
          </p>
          {configSource && (
            <p style={{ fontSize: 12, color: "#666", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
              Quelle: {configSource === "database" ? "Datenbank (scoring_config)" : "Fallback (Code)"}.{" "}
              <strong>Speicherung:</strong> dauerhaft in der Datenbank (Tabelle scoring_config, key „default“). Zum Speichern <code style={{ background: "#eee", padding: "1px 4px", borderRadius: 4 }}>SUPABASE_SERVICE_ROLE_KEY</code> in .env.local setzen, sonst blockiert RLS – siehe docs/Scoring-Admin-RLS.md. Kategorie- und Komplexitäts-Werte werden von der Bewertung aus der Config geladen; Ampel- und Nachtrag-Schwellen ggf. erst nach Anbindung in der Laufzeitlogik.
            </p>
          )}
        </div>
        <a href="/admin" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zurück zum Admin
        </a>
      </header>

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

      {!config ? (
        <p style={{ marginTop: 24, color: "#b00020" }}>Konfiguration konnte nicht geladen werden.</p>
      ) : (
        <>
          {/* 1. Ampel-Schwellen */}
          <section style={sectionStyle} aria-labelledby="section-ampel">
            <h2 id="section-ampel" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              1. Ampel-Schwellen
            </h2>
            <p style={helpStyle}>
              <strong>Was es macht:</strong> Der Gesamt-Score einer LV-Bewertung liegt zwischen 0 und 100. Die Ampel zeigt in der Analyse-UI, ob das Risiko als Grün, Gelb oder Rot eingestuft wird.<br />
              <strong>So wirkt es:</strong> Liegt der Score <em>unter</em> „Gelb ab“ → Grün (geringes Risiko). Ab „Gelb ab“ bis unter „Rot ab“ → Gelb (mittleres Risiko). Ab „Rot ab“ → Rot (hohes Risiko). Höhere Schwellen = strenger (mehr gilt noch als Grün/Gelb).
            </p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Gelb ab Score (yellowMin)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.ampelThresholds?.yellowMin ?? 40}
                  onChange={(e) => updateNested("ampelThresholds", "yellowMin", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Rot ab Score (redMin)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.ampelThresholds?.redMin ?? 70}
                  onChange={(e) => updateNested("ampelThresholds", "redMin", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* 2. Claim- / Nachtragsschwellen */}
          <section style={sectionStyle} aria-labelledby="section-claim">
            <h2 id="section-claim" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              2. Claim- / Nachtragsschwellen
            </h2>
            <p style={helpStyle}>
              <strong>Claim-Level:</strong> Erlaubte Stufen für die Bewertung von Triggern (z. B. „Niedrig“, „Mittel“, „Hoch“). Bei jedem Trigger können Sie genau eine dieser Stufen als „Claim-Level“ auswählen; nur Begriffe, die hier eingetragen sind, werden akzeptiert. Kommagetrennt eingeben, exakte Schreibweise verwenden (z. B. „Niedrig, Mittel, Hoch“).
            </p>
            <p style={{ ...helpStyle, marginTop: 10 }}>
              <strong>Nachtrag-Check „Weiche Formulierungen“:</strong> Das System zählt, wie oft die eingetragenen Weichwörter (z. B. „bauseits“, „nach Aufwand“, „optional“) im LV-Text vorkommen. Daraus entsteht höchstens ein Finding in der Kategorie „Nachtrag“. Die vier Schwellen steuern, wann es erscheint und wie stark es ins Scoring eingeht:
            </p>
            <ul style={{ fontSize: 12, color: "#555", marginTop: 4, marginBottom: 0, paddingLeft: 20, lineHeight: 1.5 }}>
              <li><strong>minFindings:</strong> Ab wie vielen Treffern überhaupt ein Hinweis erzeugt wird. Unter diesem Wert erscheint kein Finding (z. B. 3 = erst ab 3 Vorkommen).</li>
              <li><strong>highSeverityMin:</strong> Ab dieser Trefferzahl gilt der Hinweis als „hohe“ Schwere (stärkere Einordnung/Formulierung). Darunter: „mittlere“ Schwere.</li>
              <li><strong>basePenalty:</strong> Grundwert für die Strafpunkte in der Kategorie Nachtrag. Die tatsächlichen Punkte = basePenalty × Faktor (Faktor steigt mit der Trefferzahl, ist auf 1–2 begrenzt).</li>
              <li><strong>penaltyMax:</strong> Obergrenze der Strafpunkte für diesen einen Hinweis. Auch bei vielen Treffern werden nie mehr als penaltyMax Punkte abgezogen.</li>
            </ul>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Claim-Level (kommagetrennt)</label>
              <input
                type="text"
                value={(config.claimLevels ?? []).join(", ")}
                onChange={(e) => update("claimLevels", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                style={{ ...inputStyle, maxWidth: 400 }}
                placeholder="Niedrig, Mittel, Hoch"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginTop: 14 }}>
              <div>
                <label style={labelStyle}>minFindings (ab wie vielen Treffern erscheint der Hinweis)</label>
                <input
                  type="number"
                  min={0}
                  value={config.nachtragSchwellen?.minFindings ?? 3}
                  onChange={(e) => updateNested("nachtragSchwellen", "minFindings", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>highSeverityMin (ab wann „hohe“ Schwere)</label>
                <input
                  type="number"
                  min={0}
                  value={config.nachtragSchwellen?.highSeverityMin ?? 6}
                  onChange={(e) => updateNested("nachtragSchwellen", "highSeverityMin", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>basePenalty (Grund-Strafpunkte)</label>
                <input
                  type="number"
                  min={0}
                  value={config.nachtragSchwellen?.basePenalty ?? 6}
                  onChange={(e) => updateNested("nachtragSchwellen", "basePenalty", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>penaltyMax (max. Strafpunkte für diesen Hinweis)</label>
                <input
                  type="number"
                  min={0}
                  value={config.nachtragSchwellen?.penaltyMax ?? 12}
                  onChange={(e) => updateNested("nachtragSchwellen", "penaltyMax", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Nachtrag-Weichwörter (kommagetrennt)</label>
              <input
                type="text"
                value={(config.nachtragWeichwoerter ?? []).join(", ")}
                onChange={(e) =>
                  update(
                    "nachtragWeichwoerter",
                    e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
                  )
                }
                style={{ ...inputStyle, maxWidth: 400 }}
                placeholder="bauseits, nach aufwand, optional, …"
              />
            </div>
          </section>

          {/* 3. Komplexitäts-Schwellen */}
          <section style={sectionStyle} aria-labelledby="section-complexity">
            <h2 id="section-complexity" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              3. Komplexitäts-Schwellen
            </h2>
            <p style={helpStyle}>
              <strong>Was es macht:</strong> Längere Leistungsverzeichnisse werden als komplexer eingestuft; ein Größenfaktor fließt in die Bewertung ein, damit die Bewertung sich an die LV-Länge anpassen kann (ohne dass große LVs pauschal schlechter dastehen).
            </p>
            <p style={helpStyle}>
              <strong>Die beiden Werte:</strong> <em>baseDivisor</em> steuert, ab welcher Textmenge der Effekt greift – je höher der Wert, desto mehr Zeichen sind nötig, bis der Faktor spürbar steigt (z. B. 2000 ≈ bei rund 10.000 Zeichen leichter Anstieg). <em>maxBoost</em> (0–2) ist die Obergrenze des Zuschlags (z. B. 0,6 = bis zu 60 % Zuschlag). Formel: 1 + min(maxBoost, log10(1 + Zeichenanzahl / baseDivisor)). Werte werden von der Score-API aus der Config geladen.
            </p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
              <div>
                <label style={labelStyle}>baseDivisor (ab welcher Textmenge der Faktor greift)</label>
                <input
                  type="number"
                  min={100}
                  value={config.lvSize?.baseDivisor ?? 2000}
                  onChange={(e) => updateNested("lvSize", "baseDivisor", Number(e.target.value) || 2000)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>maxBoost (0–2, Obergrenze des Zuschlags)</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.lvSize?.maxBoost ?? 0.6}
                  onChange={(e) => updateNested("lvSize", "maxBoost", Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* 4. Kategorien / Gewichtungslogik */}
          <section style={sectionStyle} aria-labelledby="section-categories">
            <h2 id="section-categories" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              4. Kategorie-Gewichtungen (catMax)
            </h2>
            <p style={helpStyle}>
              <strong>Was es macht:</strong> Die Bewertung läuft über fünf Kategorien (z. B. Vertrags-/LV-Risiken, Mengen &amp; Massenermittlung). Pro Kategorie gibt es eine Obergrenze an Punkten (catMax).<br />
              <strong>So wirkt es:</strong> Die API berechnet pro Kategorie einen Wert bis zu diesem Maximum (Abzüge durch Findings). <em>Easing</em> (sqrt/linear) beeinflusst, wie die Rohwerte auf die Skala normiert werden. Der angezeigte Gesamt-Score ist das <em>Mittel</em> der fünf Kategorien (0–100). Höhere catMax-Werte geben einer Kategorie mehr Gewicht. Diese Einstellungen werden von der Score-API aus der Config geladen.
            </p>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Easing</label>
              <select
                value={config.easing?.type ?? "sqrt"}
                onChange={(e) => update("easing", { type: e.target.value as "sqrt" | "linear" })}
                style={inputStyle}
              >
                <option value="sqrt">sqrt</option>
                <option value="linear">linear</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {CATEGORY_KEYS_5.map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ ...labelStyle, marginBottom: 0, minWidth: 220 }}>{CATEGORY_LABEL[k]}</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={config.catMax?.[k] ?? 60}
                    onChange={(e) => updateCatMax(k, Number(e.target.value) || 0)}
                    style={{ ...inputStyle, maxWidth: 80 }}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 5. Projekttyp-Faktoren */}
          <section style={sectionStyle} aria-labelledby="section-project">
            <h2 id="section-project" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
              5. Projekttyp-Faktoren
            </h2>
            <p style={helpStyle}>
              <strong>Zweck:</strong> Pro Projekttyp (z. B. „neubau“, „sanierung“, „instandsetzung“) kann ein Zahlenfaktor hinterlegt werden. Gedacht ist z. B. als Multiplikator auf den Gesamt-Score oder auf Kategorien: 1.0 = neutral, 1.2 = 20 % stärker gewichten, 0.8 = 20 % abschwächen. So ließen sich unterschiedliche Risikostandards je Projektart abbilden.
            </p>
            <p style={helpStyle}>
              <strong>Format:</strong> JSON-Objekt. Jeder Schlüssel = Bezeichner des Projekttyps (klein, ohne Leerzeichen), jeder Wert = Dezimalzahl (z. B. 1.0, 1.2, 0.9). Beispiel: <code style={{ background: "#eee", padding: "1px 4px", borderRadius: 4 }}>{`{ "neubau": 1.0, "sanierung": 1.2 }`}</code>
            </p>
            <p style={helpStyle}>
              <strong>Hinweis:</strong> Die Werte werden in der Datenbank gespeichert. In der aktuellen Bewertungslogik werden sie noch <em>nicht</em> verwendet (kein Einfluss auf Score oder Ampel). Sobald die Anwendung um eine Auswertung „Projekttyp“ ergänzt wird, können diese Faktoren dort genutzt werden.
            </p>
            <div style={{ marginTop: 12 }}>
              <textarea
                value={JSON.stringify(config.projectTypeFactors ?? {}, null, 2)}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    update("projectTypeFactors", {});
                    return;
                  }
                  try {
                    const o = JSON.parse(raw);
                    if (typeof o === "object" && o !== null) {
                      const rec: Record<string, number> = {};
                      for (const [k, v] of Object.entries(o)) {
                        if (typeof k === "string" && typeof v === "number" && Number.isFinite(v)) rec[k] = v;
                      }
                      update("projectTypeFactors", rec);
                    }
                  } catch {
                    // invalid JSON while typing – keep previous state
                  }
                }}
                rows={4}
                style={{
                  width: "100%",
                  maxWidth: 400,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                }}
                placeholder='{ "neubau": 1.0, "sanierung": 1.2 }'
              />
            </div>
          </section>

          {/* Speichern */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid #0a7a2f",
                background: saving ? "#ccc" : "#0a7a2f",
                color: "#fff",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {saving ? "Speichern…" : "Speichern"}
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

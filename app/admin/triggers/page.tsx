"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";

type TriggerRow = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  trigger_type: string;
  keywords?: string[] | null; // text[]
  regex?: string | null;
  weight: number;
  claim_level: string;
  risk_interpretation?: string | null;
  is_active: boolean;
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

export default function TriggersPage() {
  const [rows, setRows] = useState<TriggerRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        "id,name,description,category,trigger_type,keywords,regex,weight,claim_level,risk_interpretation,is_active,created_at"
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
      .map((r) => ({
        name: (r["Trigger-Name"] || "").trim(),
        description: (r["Beschreibung"] || "").trim(),
        category: (r["Risikokategorie"] || "").trim(),
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
      }))
      .filter((x) => x.name);

    for (const r of data) {
      if (!r.category) return setMsg(`Fehlende Risikokategorie bei: ${r.name}`);
      if (!r.trigger_type) return setMsg(`Fehlende Trigger-Art bei: ${r.name}`);
      if (!(r.weight >= 1 && r.weight <= 10)) return setMsg(`Gewichtung 1–10 bei: ${r.name}`);
      if (!["Niedrig", "Mittel", "Hoch"].includes(r.claim_level))
        return setMsg(`Claim-Level (Niedrig/Mittel/Hoch) bei: ${r.name}`);
      if (r.regex) {
        const st = validateRegex(r.regex);
        if (!st.ok) return setMsg(`Regex ungültig bei: ${r.name} -> ${st.msg}`);
      }
    }

    const { error } = await supabase.from("triggers").upsert(data, { onConflict: "name,category" });
    if (error) return setMsg("DB Upsert Fehler: " + error.message);

    setMsg(`Import ok: ${data.length} Trigger`);
    await load();
  }

  async function onExport() {
    setMsg("Export läuft...");

    const { data, error } = await supabase
      .from("triggers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return setMsg("DB Export Fehler: " + error.message);

    const exportRows = (data as any[]).map((r) => ({
      "Trigger-Name": r.name ?? "",
      "Beschreibung": r.description ?? "",
      "Risikokategorie": r.category ?? "",
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
      if (!res.ok) setTestResult({ ok: false, error: data?.error || `HTTP ${res.status}` });
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
          <div style={{ color: "#666", marginTop: 6 }}>
            Import/Export + Trigger-Tests direkt gegen LV-Text.
          </div>
        </div>
        <a href="/admin/score" style={{ color: "#111", textDecoration: "underline" }}>
          Zurück zum Score
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

      {/* Main grid */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Table Card */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
            <div style={{ fontWeight: 900, color: "#111" }}>Trigger-Liste</div>
            <div style={{ color: "#666", marginTop: 4 }}>
              Tipp: Zeile anklicken, dann rechts testen.
            </div>
          </div>

          <div style={{ overflow: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {["Name", "Kategorie", "Art", "Gew.", "Claim", "Aktiv"].map((h) => (
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
                      <td style={{ padding: 10 }}>{r.category}</td>
                      <td style={{ padding: 10 }}>{r.trigger_type}</td>
                      <td style={{ padding: 10, fontWeight: 800 }}>{r.weight}</td>
                      <td style={{ padding: 10 }}>{r.claim_level}</td>
                      <td style={{ padding: 10 }}>{r.is_active ? "Ja" : "Nein"}</td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: "#777" }}>
                      Noch keine Trigger – CSV importieren.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Test Card */}
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 14,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111" }}>Trigger Test</div>
          <div style={{ color: "#666", marginTop: 6 }}>
            Testet nur den ausgewählten Trigger (kein System-Check).
          </div>

          {!selected ? (
            <div style={{ marginTop: 12, color: "#666" }}>Links einen Trigger auswählen.</div>
          ) : (
            <>
              {/* Selected meta */}
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
                  {selected.category} • Gewicht {selected.weight} • Claim {selected.claim_level} •{" "}
                  {selected.is_active ? "Aktiv" : "Inaktiv"}
                </div>

                {selected.keywords?.length ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Keywords</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111" }}>
                      {selected.keywords.join(", ")}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
                    Keine Keywords hinterlegt.
                  </div>
                )}

                {selected.regex ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#777", fontWeight: 900 }}>Regex</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#111", wordBreak: "break-word" }}>
                      {selected.regex}
                    </div>
                    {regexState.msg && (
                      <div style={{ marginTop: 4, fontSize: 12, color: regexState.ok ? "#0a7a2f" : "#b00020", fontWeight: 900 }}>
                        {regexState.msg}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Textarea */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#777", fontWeight: 900, marginBottom: 6 }}>
                  Test-LV-Text
                </div>
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
                <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                  Länge: {fmtKB(new Blob([testText]).size)}
                </div>
              </div>

              {/* Buttons */}
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

              {/* Result */}
              {testResult && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: "#fafafa",
                  }}
                >
                  {!testResult.ok ? (
                    <div style={{ color: "#b00020", fontWeight: 900 }}>
                      Fehler: {testResult.error}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 900, color: "#111" }}>
                        Ergebnis:{" "}
                        {testResult.hit ? (
                          <span style={{ color: "#0a7a2f" }}>TREFFER ✅</span>
                        ) : (
                          <span style={{ color: "#b00020" }}>kein Treffer ❌</span>
                        )}{" "}
                        <span style={{ color: "#666", fontWeight: 700 }}>
                          (Findings: {testResult.count ?? 0})
                        </span>
                      </div>

                      {(testResult.findings ?? []).map((f) => (
                        <div
                          key={f.id}
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid #e5e5e5",
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>
                            {severityDot(f.severity)} {f.title}
                          </div>
                          <div style={{ color: "#666", marginTop: 4, fontWeight: 700, fontSize: 12 }}>
                            Kategorie: {f.category} • Penalty: {f.penalty} • id: {stripPrefix(f.id)}
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

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

export default function TriggersPage() {
  const [rows, setRows] = useState<TriggerRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Test Panel
  const [testText, setTestText] = useState<string>("Der Schornstein ist ...\nAbgasanlage fehlt ...");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("triggers")
      .select("id,name,description,category,trigger_type,keywords,regex,weight,claim_level,risk_interpretation,is_active,created_at")
      .order("created_at", { ascending: false });

    if (error) setMsg("DB Fehler: " + error.message);
    else {
      const list = (data as TriggerRow[]) || [];
      setRows(list);
      // default: ersten auswählen
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
        keywords: split(r["Keywords"]), // CSV liefert ; getrennt -> wir speichern als text[]
        project_types: split(r["Projekttyp"]),
        weight: Number(r["Gewichtung"] || 0),
        claim_level: (r["Claim-Level"] || "").trim(),
        risk_interpretation: (r["Risiko-Interpretation"] || "").trim(),
        question_template: (r["Rückfrage-Generator"] || "").trim(),
        offer_text_template: (r["Angebotstext-Baustein"] || "").trim(),
        is_active: String(r["is_active"] ?? "true").toLowerCase() !== "false",
        // optional: regex Feld aus CSV, falls vorhanden
        regex: (r["Regex"] || "").trim() || null,
      }))
      .filter((x) => x.name);

    // Minimal-Validierung
    for (const r of data) {
      if (!r.category) return setMsg(`Fehlende Risikokategorie bei: ${r.name}`);
      if (!r.trigger_type) return setMsg(`Fehlende Trigger-Art bei: ${r.name}`);
      if (!(r.weight >= 1 && r.weight <= 10)) return setMsg(`Gewichtung 1–10 bei: ${r.name}`);
      if (!["Niedrig", "Mittel", "Hoch"].includes(r.claim_level))
        return setMsg(`Claim-Level (Niedrig/Mittel/Hoch) bei: ${r.name}`);
      // Regex Validierung (nur falls gesetzt)
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

    // Regex-Fehler sofort zeigen (nicht erst server)
    if (selected.regex) {
      const st = validateRegex(selected.regex);
      if (!st.ok) {
        setTestLoading(false);
        setTestResult({ ok: false, error: `Regex ungültig: ${st.msg}` });
        return;
      }
    }

    // Trigger so schicken, wie analyzeLvText es erwartet
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
      if (!res.ok) {
        setTestResult({ ok: false, error: data?.error || `HTTP ${res.status}` });
      } else {
        setTestResult(data);
      }
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message ?? "Test fehlgeschlagen" });
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Trigger Admin</h1>

        <label className="px-3 py-2 border rounded cursor-pointer">
          CSV importieren
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.currentTarget.value = "";
            }}
          />
        </label>

        <button className="px-3 py-2 border rounded" onClick={onExport}>
          CSV exportieren
        </button>

        <button className="px-3 py-2 border rounded" onClick={load}>
          Refresh
        </button>
      </div>

      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Table */}
        <div className="lg:col-span-2 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Kategorie", "Art", "Gew.", "Claim", "Aktiv"].map((h) => (
                  <th key={h} className="text-left p-2 border-b">
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
                    className={`border-b cursor-pointer ${active ? "bg-gray-100" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                    title="Klicken zum Testen"
                  >
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2">{r.category}</td>
                    <td className="p-2">{r.trigger_type}</td>
                    <td className="p-2">{r.weight}</td>
                    <td className="p-2">{r.claim_level}</td>
                    <td className="p-2">{r.is_active ? "Ja" : "Nein"}</td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-gray-500">
                    Noch keine Trigger – CSV importieren.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RIGHT: Test Panel */}
        <div className="border rounded p-3">
          <div className="font-bold">Trigger Test</div>

          {!selected ? (
            <div className="text-sm text-gray-500 mt-2">Wähle links einen Trigger aus.</div>
          ) : (
            <>
              <div className="mt-2 text-sm">
                <div className="font-semibold">{selected.name}</div>
                <div className="text-gray-600">{selected.category} • Gewicht {selected.weight} • Claim {selected.claim_level}</div>
                {selected.keywords?.length ? (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500">Keywords</div>
                    <div className="text-xs">{selected.keywords.join(", ")}</div>
                  </div>
                ) : null}
                {selected.regex ? (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500">Regex</div>
                    <div className="text-xs break-all">{selected.regex}</div>
                    <div className={`text-xs mt-1 ${regexState.ok ? "text-green-700" : "text-red-700"}`}>
                      {regexState.msg}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Test-LV-Text</div>
                <textarea
                  className="w-full border rounded p-2 text-xs"
                  rows={8}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  className="px-3 py-2 border rounded font-semibold"
                  onClick={testSelectedTrigger}
                  disabled={testLoading || !testText.trim()}
                >
                  {testLoading ? "Teste..." : "Trigger testen"}
                </button>

                <button
                  className="px-3 py-2 border rounded"
                  onClick={() => setTestResult(null)}
                >
                  Clear
                </button>
              </div>

              {/* Result */}
              {testResult && (
                <div className="mt-3 border rounded p-2 text-sm">
                  {!testResult.ok ? (
                    <div className="text-red-700 font-semibold">Fehler: {testResult.error}</div>
                  ) : (
                    <>
                      <div className="font-semibold">
                        Ergebnis: {testResult.hit ? "TREFFER ✅" : "kein Treffer ❌"}{" "}
                        <span className="text-gray-600">(Findings: {testResult.count ?? 0})</span>
                      </div>

                      {(testResult.findings ?? []).map((f) => (
                        <div key={f.id} className="mt-2 border-t pt-2">
                          <div className="font-semibold">
                            {severityDot(f.severity)} {f.title}
                          </div>
                          <div className="text-gray-600">
                            Kategorie: {f.category} • Penalty: {f.penalty} • id: {stripPrefix(f.id)}
                          </div>
                          {f.detail && <div className="text-gray-800 mt-1">{f.detail}</div>}
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
    </main>
  );
}

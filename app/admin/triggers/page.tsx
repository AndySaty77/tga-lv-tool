"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";

type TriggerRow = {
  id: string;
  name: string;
  category: string;
  trigger_type: string;
  weight: number;
  claim_level: string;
  is_active: boolean;
};

const split = (v?: string) =>
  (v || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

export default function TriggersPage() {
  const [rows, setRows] = useState<TriggerRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  async function load() {
    const { data, error } = await supabase
      .from("triggers")
      .select("id,name,category,trigger_type,weight,claim_level,is_active")
      .order("created_at", { ascending: false });

    if (error) setMsg("DB Fehler: " + error.message);
    else setRows((data as TriggerRow[]) || []);
  }

  useEffect(() => {
    load();
  }, []);

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
      }))
      .filter((x) => x.name);

    // Minimal-Validierung
    for (const r of data) {
      if (!r.category) return setMsg(`Fehlende Risikokategorie bei: ${r.name}`);
      if (!r.trigger_type) return setMsg(`Fehlende Trigger-Art bei: ${r.name}`);
      if (!(r.weight >= 1 && r.weight <= 10))
        return setMsg(`Gewichtung 1–10 bei: ${r.name}`);
      if (!["Niedrig", "Mittel", "Hoch"].includes(r.claim_level))
        return setMsg(`Claim-Level (Niedrig/Mittel/Hoch) bei: ${r.name}`);
    }

    // Upsert = Update statt Duplikate (setzt UNIQUE Index auf (name, category) voraus)
    const { error } = await supabase
      .from("triggers")
      .upsert(data, { onConflict: "name,category" });

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

  return (
    <main className="p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Trigger (MVP)</h1>

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
      </div>

      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <div className="mt-4 overflow-auto border rounded">
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
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.category}</td>
                <td className="p-2">{r.trigger_type}</td>
                <td className="p-2">{r.weight}</td>
                <td className="p-2">{r.claim_level}</td>
                <td className="p-2">{r.is_active ? "Ja" : "Nein"}</td>
              </tr>
            ))}

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
    </main>
  );
}

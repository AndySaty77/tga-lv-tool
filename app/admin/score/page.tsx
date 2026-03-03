"use client";

import { useState } from "react";

type ScoreResult = {
  total: number;
  level: string;
  perCategory: Record<string, number>;
  findingsSorted: {
    id: string;
    category: string;
    title: string;
    detail?: string;
    severity: string;
    penalty: number;
  }[];
};

export default function ScorePage() {
  const [lvText, setLvText] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lvText }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  const levelColor =
    result?.level === "hochriskant"
      ? "red"
      : result?.level === "mittel"
      ? "orange"
      : result?.level === "solide"
      ? "green"
      : "blue";

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>TGA LV Score Analyse</h1>

      <textarea
        rows={10}
        style={{ width: "100%", marginTop: 20 }}
        placeholder="LV Text hier einfügen..."
        value={lvText}
        onChange={(e) => setLvText(e.target.value)}
      />

      <button
        onClick={analyze}
        style={{ marginTop: 20, padding: "10px 20px" }}
      >
        {loading ? "Analysiere..." : "Analysieren"}
      </button>

      {result && (
        <div style={{ marginTop: 40 }}>
          <h2>
            Gesamt Score: {result.total} / 100 –{" "}
            <span style={{ color: levelColor }}>{result.level}</span>
          </h2>

          <h3>Kategorien</h3>
          <ul>
            {Object.entries(result.perCategory).map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>

          <h3>Findings</h3>
          <ul>
            {result.findingsSorted.map((f) => (
              <li key={f.id}>
                <strong>{f.title}</strong> ({f.severity}, -{f.penalty})
                {f.detail && <div>{f.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import React from "react";
import { appTheme as T } from "./appTheme";

/** Mockdaten – später durch echte Aggregation ersetzen */
const MOCK_STATS = {
  analysenGesamt: 42,
  durchschnittScore: 63,
  letzteAnalyse: "vor 2 Stunden",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.card,
        padding: T.space.lg,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function DashboardStats() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: T.space.md,
        marginBottom: T.space.xl,
      }}
    >
      <StatCard label="Analysen gesamt" value={MOCK_STATS.analysenGesamt} />
      <StatCard label="Durchschnittlicher Score" value={MOCK_STATS.durchschnittScore} sub="von 100" />
      <StatCard label="Letzte Analyse" value={MOCK_STATS.letzteAnalyse} />
    </div>
  );
}

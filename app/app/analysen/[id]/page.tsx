import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Analyse ${id} – TGA LV Tool`,
    description: "Ergebnisansicht der LV-Analyse.",
  };
}

/** Platzhalter-Inhalt; später echte Analysedaten (Score, Summary, Risiken, Rückfragen, Nachtragspotenzial) anbinden */
export default async function AppAnalysenDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <>
      <div style={{ marginBottom: T.space.lg, display: "flex", alignItems: "center", gap: T.space.md, flexWrap: "wrap" }}>
        <Link
          href="/app/analysen"
          style={{ fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: "none" }}
        >
          ← Analysen
        </Link>
        <span style={{ color: T.faint }}>/</span>
        <span style={{ fontSize: 13, color: T.text }}>Analyse {id}</span>
      </div>

      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Ergebnisansicht
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted }}>
          Platzhalter für Anbindung an echte Analysedaten. Management Summary, Score und Detailblöcke werden später aus der Analyse-Engine/API geladen.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: T.space.lg }}>
        {/* Score-Anzeige */}
        <section
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.card,
            padding: T.space.lg,
          }}
        >
          <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Score
          </h2>
          <div style={{ display: "flex", alignItems: "baseline", gap: T.space.lg, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>Gesamt</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.text }}>—</div>
              <div style={{ fontSize: 12, color: T.muted }}>von 100 (Platzhalter)</div>
            </div>
            <div style={{ width: 1, height: 40, background: T.border }} />
            <div>
              <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>Kritische Trigger</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>—</div>
            </div>
          </div>
        </section>

        {/* Management Summary Card */}
        <section
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.card,
            padding: T.space.lg,
          }}
        >
          <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Management Summary
          </h2>
          <div
            style={{
              padding: T.space.md,
              background: "rgba(255,255,255,0.03)",
              borderRadius: T.radiusSm,
              borderLeft: `3px solid ${T.accent}`,
              fontSize: 14,
              lineHeight: 1.65,
              color: T.muted,
            }}
          >
            Platzhalter. Hier wird später die Executive Summary aus der Nachtragsanalyse bzw. der Analyse-Engine angezeigt.
          </div>
        </section>

        {/* Platzhalter Risiken */}
        <section
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.card,
            padding: T.space.lg,
          }}
        >
          <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Risiken
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
            Platzhalter. Später: Risiko-Kategorien und Findings aus der Analyse anbinden.
          </p>
        </section>

        {/* Platzhalter Rückfragen */}
        <section
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.card,
            padding: T.space.lg,
          }}
        >
          <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Rückfragen
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
            Platzhalter. Später: gruppierte Rückfragen aus der Analyse anbinden.
          </p>
        </section>

        {/* Platzhalter Nachtragspotenzial */}
        <section
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.card,
            padding: T.space.lg,
          }}
        >
          <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Nachtragspotenzial
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
            Platzhalter. Später: Opportunities, Cluster und Claim-Potenzial aus der Nachtragsanalyse anbinden.
          </p>
        </section>
      </div>

      <div style={{ marginTop: T.space.xl }}>
        <Link
          href="/analyse"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.accent,
            textDecoration: "none",
          }}
        >
          Neue Analyse unter /analyse starten →
        </Link>
      </div>
    </>
  );
}

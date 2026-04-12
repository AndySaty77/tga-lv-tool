"use client";

import React from "react";

/** Technischer Analyse-Status (analyse_runs.status) – nur Anzeige, keine Backend-Logik. */
export type StatusVariant = "Abgeschlossen" | "In Bearbeitung" | "Fehlgeschlagen";

const variantStyles: Record<
  StatusVariant,
  { bg: string; text: string; border: string }
> = {
  Abgeschlossen: {
    bg: "rgba(74,222,128,0.15)",
    text: "rgba(74,222,128,0.95)",
    border: "rgba(74,222,128,0.35)",
  },
  "In Bearbeitung": {
    bg: "rgba(126,184,212,0.15)",
    text: "rgba(126,184,212,0.95)",
    border: "rgba(126,184,212,0.35)",
  },
  Fehlgeschlagen: {
    bg: "rgba(248,113,113,0.15)",
    text: "rgba(248,113,113,0.95)",
    border: "rgba(248,113,113,0.35)",
  },
};

/** Mappt Rohwerte aus der DB/API auf einheitliche deutsche Anzeige (technischer Analyse-Status). */
export function mapTechnicalAnalyseStatus(raw: string | null | undefined): StatusVariant {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "Abgeschlossen";

  if (
    s === "abgeschlossen" ||
    s === "completed" ||
    s === "done" ||
    s === "success" ||
    s === "ok" ||
    s === "complete"
  ) {
    return "Abgeschlossen";
  }
  if (
    s === "fehlgeschlagen" ||
    s === "failed" ||
    s === "error" ||
    s === "fehler" ||
    s === "failure"
  ) {
    return "Fehlgeschlagen";
  }
  if (
    s === "in bearbeitung" ||
    s === "in_bearbeitung" ||
    s === "in analyse" ||
    s === "in_analyse" ||
    s === "running" ||
    s === "processing" ||
    s === "pending" ||
    s === "in_progress" ||
    s === "queued" ||
    s === "working" ||
    s === "started"
  ) {
    return "In Bearbeitung";
  }

  return "Abgeschlossen";
}

/** Status-Badge: technischer Analysezustand (grün / blau / rot). */
export function StatusBadge({
  status,
  style,
}: {
  status: string;
  style?: React.CSSProperties;
}) {
  const label = mapTechnicalAnalyseStatus(status);
  const s = variantStyles[label];

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

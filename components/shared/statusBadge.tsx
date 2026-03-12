"use client";

import React from "react";

export type StatusVariant = "Abgeschlossen" | "In Analyse" | "Fehler";

const variantStyles: Record<
  StatusVariant,
  { bg: string; text: string; border: string }
> = {
  Abgeschlossen: {
    bg: "rgba(74,222,128,0.15)",
    text: "rgba(74,222,128,0.95)",
    border: "rgba(74,222,128,0.35)",
  },
  "In Analyse": {
    bg: "rgba(56,189,248,0.15)",
    text: "rgba(56,189,248,0.95)",
    border: "rgba(56,189,248,0.35)",
  },
  Fehler: {
    bg: "rgba(248,113,113,0.15)",
    text: "rgba(248,113,113,0.95)",
    border: "rgba(248,113,113,0.35)",
  },
};

/** Status-Badge für Tabellen: Abgeschlossen (grün), In Analyse (blau), Fehler (rot). */
export function StatusBadge({
  status,
  style,
}: {
  status: string;
  style?: React.CSSProperties;
}) {
  const variant = status in variantStyles ? variantStyles[status as StatusVariant] : variantStyles["Abgeschlossen"];
  const s = variant;

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
      {status}
    </span>
  );
}

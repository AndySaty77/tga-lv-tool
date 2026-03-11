"use client";

import React from "react";
import { statusColors, colors, radius, spacing } from "@/lib/ui/theme";

export type ScoreLevel = "low" | "niedrig" | "medium" | "mittel" | "high" | "hoch" | "sehr_hoch";

const levelColorMap: Record<ScoreLevel, string> = {
  low: statusColors.low,
  niedrig: statusColors.niedrig,
  medium: statusColors.medium,
  mittel: statusColors.mittel,
  high: statusColors.high,
  hoch: statusColors.hoch,
  sehr_hoch: statusColors.sehr_hoch,
};

/**
 * Ermittelt Score-Level aus numerischem Wert (0–100).
 * 0–39 niedrig, 40–69 mittel, 70+ hoch.
 */
export function scoreLevelFromNumber(score: number): ScoreLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

type ScoreBadgeProps = {
  /** Anzeigewert (z. B. 72 oder "72") */
  value: number | string;
  /** Optional: Level für Farbe; sonst wird bei number aus value abgeleitet */
  level?: ScoreLevel;
  /** Optional: Max (z. B. 100) für Anzeige "72 / 100" */
  max?: number;
  /** Kleinerer Badge */
  small?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Badge für Risiko- oder Kennzahlen-Score mit farblicher Einordnung.
 * Nur Präsentation.
 */
export function ScoreBadge({
  value,
  level,
  max,
  small = false,
  className = "",
  style = {},
}: ScoreBadgeProps) {
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  const resolvedLevel = level ?? (typeof num === "number" && !Number.isNaN(num) ? scoreLevelFromNumber(num) : "medium");
  const color = levelColorMap[resolvedLevel] ?? colors.textMuted;
  const display = max != null ? `${value} / ${max}` : String(value);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "2px 8px" : "4px 10px",
        borderRadius: radius.md,
        fontSize: small ? "0.75rem" : "0.8125rem",
        fontWeight: 700,
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
        transition: "opacity 0.15s ease, transform 0.1s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.95";
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {display}
    </span>
  );
}

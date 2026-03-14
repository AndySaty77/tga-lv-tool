"use client";

import React from "react";
import { colors, spacing, radius, shadows, typography } from "@/lib/ui/theme";

export type MetricVariant = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "neutral";

const valueColorMap: Record<MetricVariant, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  neutral: colors.text,
};

type MetricCardProps = {
  /** Titel über der Kennzahl (z. B. "Nachtragspotenzial") */
  title: string;
  /** Große Kennzahl (z. B. 72) */
  value: React.ReactNode;
  /** Optional: Einheit oder Zusatz (z. B. "von 100 Punkten") */
  subtitle?: string;
  /** Farbe der Kennzahl */
  variant?: MetricVariant;
  /** Optionale kleine Statistikzeilen unter der Kennzahl */
  stats?: Array<{ label: string; value: string | number }>;
  /** Optional: Icon (z. B. Emoji oder SVG) – wird farbig dargestellt */
  icon?: React.ReactNode;
  /** Inhalt vertikal und horizontal zentrieren (z. B. für KPI-Übersicht) */
  center?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Karte für große Kennzahlen mit farbiger Zahl und optionalem Icon.
 * Nur Präsentation.
 */
export function MetricCard({
  title,
  value,
  subtitle,
  variant = "primary",
  stats,
  icon,
  center = false,
  className = "",
  style = {},
}: MetricCardProps) {
  const valueColor = valueColorMap[variant];
  const containerAlign = center
    ? { display: "flex" as const, flexDirection: "column" as const, alignItems: "center" as const, textAlign: "center" as const }
    : {};

  return (
    <div
      className={className}
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.md,
        padding: spacing[4],
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
        ...containerAlign,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = shadows.lg;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = shadows.md;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ ...typography.bodySm, color: colors.textMuted, marginBottom: spacing[2] }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: center ? "center" : undefined, gap: spacing[2], flexWrap: "wrap" }}>
        {icon && (
          <span style={{ fontSize: "1.5rem", lineHeight: 1 }} aria-hidden>
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: valueColor,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
      </div>
      {subtitle && (
        <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: spacing[1] }}>
          {subtitle}
        </div>
      )}
      {stats && stats.length > 0 && (
        <div
          style={{
            marginTop: spacing[3],
            paddingTop: spacing[2],
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            flexDirection: "column",
            gap: spacing[1],
            fontSize: "0.8125rem",
            color: colors.textMuted,
          }}
        >
          {stats.map((s, i) => (
            <div key={i}>
              {s.label}: <strong style={{ color: colors.text }}>{s.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

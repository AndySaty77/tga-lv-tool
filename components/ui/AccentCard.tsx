"use client";

import React from "react";
import { colors, spacing, radius, shadows, accentBorder } from "@/lib/ui/theme";

export type AccentCardVariant = "primary" | "secondary" | "accent" | "success" | "warning" | "danger";

const variantColorMap: Record<AccentCardVariant, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

type AccentCardProps = {
  children: React.ReactNode;
  /** Titel der Karte (z. B. "Management Summary", "Nachtragspotenzial") */
  title?: React.ReactNode;
  /** Farbe der linken Akzentlinie */
  variant?: AccentCardVariant;
  /** Dickere Akzentlinie */
  thick?: boolean;
  /** Padding (default 20px) */
  padding?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Karte mit farbigem Rand links – z. B. für Management Summary, Nachtragspotenzial, Top Risiken.
 * Nur Präsentation.
 */
export function AccentCard({
  children,
  title,
  variant = "primary",
  thick = false,
  padding = spacing[5],
  className = "",
  style = {},
}: AccentCardProps) {
  const accentColor = variantColorMap[variant];
  const borderWidth = thick ? accentBorder.widthThick : accentBorder.width;

  return (
    <div
      className={className}
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.md,
        padding,
        borderLeft: `${borderWidth} solid ${accentColor}`,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = shadows.lg;
        e.currentTarget.style.borderColor = colors.borderLight;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = shadows.md;
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {title != null && (
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: accentColor,
            marginBottom: spacing[3],
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

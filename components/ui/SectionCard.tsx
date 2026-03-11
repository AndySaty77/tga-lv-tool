"use client";

import React from "react";
import { colors, spacing, radius, shadows, accentBorder } from "@/lib/ui/theme";

export type AccentVariant = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "none";

const accentColorMap: Record<Exclude<AccentVariant, "none">, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

type SectionCardProps = {
  children: React.ReactNode;
  /** Optionale farbige Akzentlinie links */
  accent?: AccentVariant;
  /** Dickere Akzentlinie */
  accentThick?: boolean;
  /** Padding (default 20px) */
  padding?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Moderne Karte mit leichtem Schatten, optional farbiger Akzentlinie links.
 * Nur Präsentation.
 */
export function SectionCard({
  children,
  accent = "none",
  accentThick = false,
  padding = spacing[5],
  className = "",
  style = {},
}: SectionCardProps) {
  const hasAccent = accent !== "none";
  const borderWidth = accentThick ? accentBorder.widthThick : accentBorder.width;
  const accentColor = hasAccent ? accentColorMap[accent] : "transparent";

  return (
    <div
      className={className}
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.md,
        padding,
        borderLeft: hasAccent ? `${borderWidth} solid ${accentColor}` : undefined,
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
      {children}
    </div>
  );
}

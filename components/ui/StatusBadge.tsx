"use client";

import React from "react";
import { colors, radius, spacing } from "@/lib/ui/theme";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const variantStyles: Record<
  StatusBadgeVariant,
  { bg: string; color: string; border?: string }
> = {
  success: { bg: colors.successMuted, color: colors.success },
  warning: { bg: colors.warningMuted, color: colors.warning },
  danger: { bg: colors.dangerMuted, color: colors.danger },
  info: { bg: colors.accentMuted, color: colors.accent },
  neutral: { bg: colors.border, color: colors.textMuted },
};

type StatusBadgeProps = {
  children: React.ReactNode;
  variant?: StatusBadgeVariant;
  /** Kleinerer Badge */
  small?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Badge für Status (success, warning, danger, info, neutral).
 * Nur Präsentation.
 */
export function StatusBadge({
  children,
  variant = "neutral",
  small = false,
  className = "",
  style = {},
}: StatusBadgeProps) {
  const s = variantStyles[variant];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "2px 6px" : "4px 10px",
        borderRadius: radius.full,
        fontSize: small ? "0.6875rem" : "0.75rem",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        border: s.border ? `1px solid ${s.border}` : undefined,
        transition: "opacity 0.15s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      {children}
    </span>
  );
}

"use client";

import React from "react";
import { colors, spacing, radius } from "@/lib/ui/theme";

export type InsightItem = {
  /** Text der Zeile */
  label: React.ReactNode;
  /** Optional: Badge oder Wert rechts */
  value?: React.ReactNode;
  /** Optional: Farbe für Icon/Bullet (primary, success, warning, danger, accent) */
  variant?: "primary" | "success" | "warning" | "danger" | "accent" | "neutral";
};

const bulletColorMap: Record<NonNullable<InsightItem["variant"]>, string> = {
  primary: colors.primary,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  accent: colors.accent,
  neutral: colors.textMuted,
};

type InsightListProps = {
  items: InsightItem[];
  /** Titel über der Liste (optional) */
  title?: React.ReactNode;
  /** Kompaktere Zeilen */
  compact?: boolean;
  /** Mit farbigen Bullets (default true) */
  coloredBullets?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Liste für Management-Insights: farbige Bullets, optionale Werte.
 * Nur Präsentation.
 */
export function InsightList({
  items,
  title,
  compact = false,
  coloredBullets = true,
  className = "",
  style = {},
}: InsightListProps) {
  return (
    <div className={className} style={{ ...style }}>
      {title != null && (
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: colors.text,
            marginBottom: spacing[2],
          }}
        >
          {title}
        </div>
      )}
      <ul
        style={{
          margin: 0,
          paddingLeft: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: compact ? spacing[1] : spacing[2],
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          color: colors.textMuted,
        }}
      >
        {items.map((item, i) => {
          const variant = item.variant ?? "neutral";
          const bulletColor = coloredBullets ? bulletColorMap[variant] : colors.textMuted;

          return (
            <li
              key={i}
              style={{
                listStyle: "disc",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: spacing[2],
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: colors.text }}>{item.label}</span>
              {item.value != null && (
                <span style={{ color: bulletColor, fontWeight: 600 }}>{item.value}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

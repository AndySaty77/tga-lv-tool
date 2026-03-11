/**
 * Einheitliches Seiten-Design für Analyse, Rückfragen, Angebotsklarstellungen, Admin.
 * Basiert auf theme – gleiche Karten, Badges, Typografie, Spacing.
 * Nutzt helle Oberflächen für Lesbarkeit (Karten, Tabellen).
 */

import { colors, spacing, radius, shadows } from "./theme";

/** Für Seiten mit hellem Hintergrund (z. B. /analyse, /admin/score) */
export const PAGE_DESIGN = {
  primary: colors.primary,
  primaryHover: colors.primaryHover,
  secondary: colors.secondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
  cardBorder: "#e2e8f0",
  cardBorderLight: "#f1f5f9",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  spacingSection: spacing[8],
  spacingCard: spacing[6],
  radiusButton: 10,
  radiusToggle: 8,
  cardRadius: radius.lg,
  cardRadiusLg: radius.xl,
  cardShadow: shadows.sm,
  cardShadowHover: shadows.md,
  badgeRadius: radius.md,
  headerPaddingV: 28,
  headerPaddingH: 40,
  tableHeaderBg: colors.primaryMuted,
  tableBorder: colors.border,
  filterBg: "#f1f5f9",
  debugBg: "#f8fafc",
  debugBorder: "#e2e8f0",
  debugText: "#64748b",
  /** Typografie – einheitliche Schriftgrößen */
  fontSizeSectionTitle: 14,
  fontSizeCardTitle: 14,
  fontSizeBody: 13,
  fontSizeCaption: 12,
  fontSizeSmall: 11,
  fontWeightSection: 700,
  fontWeightCardTitle: 600,
  fontWeightBody: 500,
} as const;

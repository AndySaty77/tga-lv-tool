/**
 * Zentrale Design-Tokens für die App (LV-Scope).
 * Navy + Coral, ruhiges B2B-SaaS. Nur UI – keine Business-Logik.
 */

/** LV-Scope-Basis: Navy wie Landing, etwas abgedunkelt für App */
const navy = {
  bg: "#0a0e1a",
  surface: "#0f1420",
  card: "#131a28",
  cardElevated: "#151d2e",
};
/** Coral aus LV-Scope-Logo – Akzent sparsam */
const coral = "#e07c5e";
const coralHover = "#c96d50";
const coralMuted = "rgba(224, 124, 94, 0.18)";

export const colors = {
  /** Brand / primäre Aktionen (LV-Scope Coral) */
  primary: coral,
  primaryHover: coralHover,
  primaryMuted: coralMuted,

  /** Sekundär: abgetöntes Coral für Highlights */
  secondary: "#d4a090",
  secondaryHover: "#c4907e",
  secondaryMuted: "rgba(212, 160, 144, 0.15)",

  /** Insights / Info (dezent, kein Neon) */
  accent: "#7eb8d4",
  accentHover: "#6ba3be",
  accentMuted: "rgba(126, 184, 212, 0.15)",

  /** Status (Hex für Badge-Suffixe wie color20) */
  success: "#4ade80",
  successMuted: "rgba(74, 222, 128, 0.15)",
  warning: "#fbbf24",
  warningMuted: "rgba(251, 191, 36, 0.15)",
  danger: "#f87171",
  dangerMuted: "rgba(248, 113, 113, 0.15)",

  /** Oberflächen */
  background: navy.bg,
  card: navy.cardElevated,
  border: "rgba(255,255,255,0.08)",
  borderLight: "rgba(255,255,255,0.12)",

  /** Text */
  text: "rgba(255,255,255,0.94)",
  textMuted: "rgba(255,255,255,0.62)",
  textSubtle: "rgba(255,255,255,0.42)",
} as const;

/** Statusfarben für Risiko / Claim / Scores */
export const statusColors = {
  low: colors.success,
  medium: colors.warning,
  high: colors.danger,
  sehr_hoch: colors.danger,
  hoch: colors.danger,
  mittel: colors.warning,
  niedrig: colors.success,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.accent,
} as const;

export const typography = {
  fontSans: "var(--font-app-inter), ui-sans-serif, system-ui, sans-serif",
  fontMono: "var(--font-geist-mono), ui-monospace, monospace",
  heading1: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" },
  heading2: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
  heading3: { fontSize: "1.25rem", fontWeight: 600 },
  heading4: { fontSize: "1.125rem", fontWeight: 600 },
  bodyLg: { fontSize: "1rem", lineHeight: 1.6 },
  body: { fontSize: "0.875rem", lineHeight: 1.5 },
  bodySm: { fontSize: "0.8125rem", lineHeight: 1.45 },
  caption: { fontSize: "0.75rem", lineHeight: 1.4 },
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
} as const;

export const radius = {
  none: "0",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "14px",
  full: "9999px",
} as const;

/** Dezente Schatten, kein starker Glow */
export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.2)",
  md: "0 2px 8px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15)",
  lg: "0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
  glowPrimary: "0 0 12px rgba(224, 124, 94, 0.15)",
  glowSecondary: "0 0 12px rgba(212, 160, 144, 0.12)",
  glowAccent: "0 0 12px rgba(126, 184, 212, 0.12)",
} as const;

export const accentBorder = {
  width: "4px",
  widthThick: "6px",
} as const;

export const theme = {
  colors,
  statusColors,
  typography,
  spacing,
  radius,
  shadows,
  accentBorder,
} as const;

export default theme;

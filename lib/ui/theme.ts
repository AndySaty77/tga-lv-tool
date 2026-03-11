/**
 * Zentrale Design-Tokens für die App.
 * Nur UI – keine Business-Logik.
 * Nutzung: Import in Komponenten oder Referenz in CSS via var(--token).
 */

export const colors = {
  /** Brand / primäre Aktionen */
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  primaryMuted: "rgba(37, 99, 235, 0.15)",

  /** Highlights / sekundär */
  secondary: "#7C3AED",
  secondaryHover: "#6D28D9",
  secondaryMuted: "rgba(124, 58, 237, 0.15)",

  /** Insights / Informationen */
  accent: "#06B6D4",
  accentHover: "#0891B2",
  accentMuted: "rgba(6, 182, 212, 0.15)",

  /** Status */
  success: "#22C55E",
  successMuted: "rgba(34, 197, 94, 0.15)",
  warning: "#F59E0B",
  warningMuted: "rgba(245, 158, 11, 0.15)",
  danger: "#EF4444",
  dangerMuted: "rgba(239, 68, 68, 0.15)",

  /** Oberflächen */
  background: "#0F172A",
  card: "#111827",
  border: "#1F2937",
  borderLight: "#374151",

  /** Text */
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  textSubtle: "#64748B",
} as const;

/** Statusfarben für Risiko / Claim / Scores (konsistent mit colors) */
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
  fontSans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  fontMono: "var(--font-geist-mono), ui-monospace, monospace",
  /** Headings */
  heading1: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" },
  heading2: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
  heading3: { fontSize: "1.25rem", fontWeight: 600 },
  heading4: { fontSize: "1.125rem", fontWeight: 600 },
  /** Body */
  bodyLg: { fontSize: "1rem", lineHeight: 1.6 },
  body: { fontSize: "0.875rem", lineHeight: 1.5 },
  bodySm: { fontSize: "0.8125rem", lineHeight: 1.45 },
  caption: { fontSize: "0.75rem", lineHeight: 1.4 },
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",   // 4px
  2: "0.5rem",    // 8px
  3: "0.75rem",   // 12px
  4: "1rem",      // 16px
  5: "1.25rem",   // 20px
  6: "1.5rem",    // 24px
  8: "2rem",      // 32px
  10: "2.5rem",   // 40px
  12: "3rem",     // 48px
  16: "4rem",     // 64px
} as const;

export const radius = {
  none: "0",
  sm: "0.375rem",   // 6px
  md: "0.5rem",    // 8px
  lg: "0.75rem",   // 12px
  xl: "1rem",      // 16px
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  glowPrimary: "0 0 20px rgba(37, 99, 235, 0.25)",
  glowSecondary: "0 0 20px rgba(124, 58, 237, 0.25)",
  glowAccent: "0 0 20px rgba(6, 182, 212, 0.25)",
} as const;

/** Akzentlinie (z. B. linke Border bei Karten) – Breiten */
export const accentBorder = {
  width: "4px",
  widthThick: "6px",
} as const;

/** Theme-Objekt für einfachen Zugriff (z. B. theme.colors.primary) */
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

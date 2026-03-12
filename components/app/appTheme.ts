/**
 * Design-System für den geschützten App-Bereich (/app).
 * Dark SaaS: ruhig, professionell, B2B. Keine verspielte AI-Optik, keine übertriebenen Verläufe/Neon.
 */
export const appTheme = {
  /** Hintergrund Hauptbereich */
  bg: "#0c1222",
  /** Hintergrund Sidebar (etwas dunkler als Content) */
  sidebarBg: "#0a0e18",
  /** Hintergrund Panels / Cards-Container */
  surface: "#111827",
  /** Karten, Cards */
  card: "#151d2e",
  /** Border (dezent) */
  border: "rgba(255,255,255,0.08)",
  /** Border bei Hover/Focus */
  borderHover: "rgba(255,255,255,0.12)",
  /** Primärtext */
  text: "rgba(255,255,255,0.92)",
  /** Sekundärtext */
  muted: "rgba(255,255,255,0.65)",
  /** Tertiär / Labels */
  faint: "rgba(255,255,255,0.45)",
  /** Akzent sparsam: primäre Aktionen (ein Farbton, kein Neon) */
  accent: "#38bdf8",
  /** Akzent gedämpft für Badges/Scores */
  accentMuted: "rgba(56,189,248,0.25)",
  /** Erfolg / niedriges Risiko */
  success: "rgba(74,222,128,0.9)",
  /** Warnung / mittleres Risiko */
  warning: "rgba(251,191,36,0.9)",
  /** Gefahr / hohes Risiko */
  danger: "rgba(248,113,113,0.9)",
  /** Abstände konsistent */
  space: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },
  /** Radius Karten */
  radius: 12,
  radiusSm: 8,
};

/**
 * Design-System für den geschützten App-Bereich (/app).
 * LV-Scope: Navy + Coral, ruhig, professionell, B2B. Nüchterner als Landing.
 */
const navy = {
  bg: "#0a0e1a",
  sidebar: "#080c14",
  surface: "#0f1420",
  card: "#131a28",
};
const coral = "#e07c5e";
const coralMuted = "rgba(224, 124, 94, 0.18)";

export const appTheme = {
  bg: navy.bg,
  sidebarBg: navy.sidebar,
  surface: navy.surface,
  card: navy.card,

  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.12)",

  text: "rgba(255,255,255,0.94)",
  muted: "rgba(255,255,255,0.62)",
  faint: "rgba(255,255,255,0.42)",

  /** LV-Scope Coral – primäre Aktionen, Akzente */
  accent: coral,
  accentMuted: coralMuted,

  success: "rgba(74,222,128,0.9)",
  warning: "rgba(251,191,36,0.9)",
  danger: "rgba(248,113,113,0.9)",

  space: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },

  radius: 12,
  radiusSm: 8,
} as const;

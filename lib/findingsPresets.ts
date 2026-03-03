import { Finding } from "./scoring";

export const PRESET_FINDINGS = {
  DIN_1988_FEHLT: (detail?: string): Finding => ({
    id: "DIN_1988_FEHLT",
    category: "normen",
    title: "DIN 1988 nicht genannt (Trinkwasserinstallation)",
    detail,
    severity: "high",
    penalty: 6,
  }),
  DRUCKPRUEFUNG_UNKLAR: (detail?: string): Finding => ({
    id: "DRUCKPRUEFUNG_UNKLAR",
    category: "vollstaendigkeit",
    title: "Druckprüfung/Protokoll nicht eindeutig beschrieben",
    detail,
    severity: "high",
    penalty: 7,
  }),
  VORTEXT_ABRECHNUNG_FEHLT: (detail?: string): Finding => ({
    id: "VORTEXT_ABRECHNUNG_FEHLT",
    category: "vortext",
    title: "Vortext: Abrechnungs-/Ausführungsregeln fehlen oder sind schwammig",
    detail,
    severity: "medium",
    penalty: 4,
  }),
} as const;

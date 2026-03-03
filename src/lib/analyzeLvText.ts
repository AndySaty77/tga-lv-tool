import { PRESET_FINDINGS } from "./findingsPresets";
import { Finding } from "./scoring";

const hasAny = (text: string, patterns: Array<string | RegExp>) => {
  const t = text.toLowerCase();
  return patterns.some((p) => (p instanceof RegExp ? p.test(text) : t.includes(p.toLowerCase())));
};

export function analyzeLvText(lvTextRaw: string): Finding[] {
  const text = lvTextRaw ?? "";
  const findings: Finding[] = [];

  // Normen-Checks (MVP: simple)
  const hasDIN1988 = hasAny(text, ["din 1988", "din1988"]);
  const hasEN806 = hasAny(text, ["din en 806", "en 806"]);
  const hasEN1717 = hasAny(text, ["din en 1717", "en 1717"]);

  if (!hasDIN1988) findings.push(PRESET_FINDINGS.DIN_1988_FEHLT());
  // Beispiel: wenn im Trinkwasser-Kontext EN1717 fehlt -> Finding (später abhängig vom Gewerk)
  if (!hasEN1717) findings.push({
    id: "DIN_EN_1717_FEHLT",
    category: "normen",
    title: "DIN EN 1717 nicht genannt (Trinkwasserschutz)",
    severity: "high",
    penalty: 5,
  });

  // Vollständigkeit: Druckprüfung / Spülung
  const hasDruckpruefung = hasAny(text, ["druckprüfung", "druckprobe", /druck\s*prüf/i]);
  const hasSpuelung = hasAny(text, ["spül", "spuel", "spülprotokoll", "spuelprotokoll"]);

  if (!hasDruckpruefung) findings.push(PRESET_FINDINGS.DRUCKPRUEFUNG_UNKLAR());
  if (!hasSpuelung) findings.push({
    id: "SPUELUNG_FEHLT",
    category: "vollstaendigkeit",
    title: "Spülung/Spülprotokoll nicht eindeutig beschrieben",
    severity: "high",
    penalty: 6,
  });

  // Vortext: “bauseits/nach Aufwand/optional” als Nachtrags-Booster
  const nachtragWorte = ["bauseits", "nach aufwand", "optional", "bedarfsweise", "pauschal"];
  const countNachtrag = nachtragWorte.reduce((acc, w) => acc + (text.toLowerCase().split(w).length - 1), 0);

  if (countNachtrag >= 6) {
    findings.push({
      id: "VIELE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title: "Viele weiche Formulierungen (bauseits/optional/nach Aufwand) → hohes Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag}`,
      severity: "high",
      penalty: 10,
    });
  } else if (countNachtrag >= 3) {
    findings.push({
      id: "EINIGE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title: "Mehrere weiche Formulierungen → Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag}`,
      severity: "medium",
      penalty: 6,
    });
  }

  return findings;
}

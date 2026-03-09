/**
 * Textaufbereitung für Remark- und LblTx-Inhalte (ohne Strukturlogik zu ändern).
 * - Doppelte/dreifache Leerzeilen reduzieren
 * - Fehlendes Leerzeichen nach Doppelpunkt ergänzen (z. B. "Bauherr:Gisinger" → "Bauherr: Gisinger")
 * - Zusammengeklebte Überschriften trennen (z. B. "NACHUNTERNEHMERStand: 11/2022" → "NACHUNTERNEHMER\nStand: 11/2022")
 * - Typische Encoding-Fehler bereinigen (z. B. "100,00 ?/Std." → "100,00 €/Std.")
 */

/**
 * Reduziert 3+ aufeinanderfolgende Zeilenumbrüche auf maximal 2 (ein Absatzabstand).
 */
function normalizeParagraphBreaks(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n");
}

/**
 * Fügt fehlendes Leerzeichen nach Doppelpunkt ein, wenn direkt ein Buchstabe folgt
 * (z. B. "Bauherr:Gisinger" → "Bauherr: Gisinger"). Lässt Uhrzeiten wie "12:30" unverändert.
 */
function ensureSpaceAfterColon(s: string): string {
  return s.replace(/:(?=[A-Za-z\u00C0-\u024F])/g, ": ");
}

/**
 * Trennt offensichtlich zusammengeklebte Überschriften:
 * z. B. "NACHUNTERNEHMERStand: 11/2022" → "NACHUNTERNEHMER\nStand: 11/2022"
 * Erkennt Muster: Wortzeichen gefolgt von "Stand:", "Datum:", "Stand ", "Datum " ohne vorherigen Zeilenumbruch/Space.
 */
function splitGluedHeadings(s: string): string {
  let t = s;
  // Nach Großbuchstaben-Wort direkt "Stand:" oder "Datum:" ohne Leerzeichen davor → Zeilenumbruch einfügen
  t = t.replace(/([A-Za-z\u00C0-\u024F])(Stand\s*:)/gi, "$1\n$2");
  t = t.replace(/([A-Za-z\u00C0-\u024F])(Datum\s*:)/gi, "$1\n$2");
  return t;
}

/**
 * Ersetzt typische Encoding-/Darstellungsfehler (z. B. ? statt € in Preisangaben).
 * Nur in eindeutigem Währungs-/Einheitenkontext, keine inhaltliche Änderung.
 */
function cleanEncoding(s: string): string {
  let t = s;
  // "100,00 ?/Std." oder "?/Std." / "?/Stück" etc. → € (literal ? = falsches Encoding für €)
  t = t.replace(/(\d[\d.,]*)\s*[?]\s*\/\s*(Std\.?|Stück|Stk|m²|m³|kg|t\b)/gi, "$1 €/$2");
  t = t.replace(/\s*[?]\s*\/\s*(Std\.?|Stück|Stk|m²|m³|kg|t\b)/gi, " €/$1");
  // Einzelnes ? zwischen Zahl und / wo Euro üblich ist
  t = t.replace(/(\d[\d.,]*)\s+[?]\s+(\/)/g, "$1 € $2");
  return t;
}

/**
 * Wendet die komplette Remark-/LblTx-Textaufbereitung an.
 * Für use in: global/group remark texts, LblTx (group labels), topLabelForPreface, und kombinierter Preface.
 */
export function formatRemarkOrLabelText(raw: string): string {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.trim();
  if (s.length === 0) return "";
  s = normalizeParagraphBreaks(s);
  s = ensureSpaceAfterColon(s);
  s = splitGluedHeadings(s);
  s = cleanEncoding(s);
  // Abschluss: wieder überzählige Leerzeilen durch vorherige Ersetzungen begrenzen
  s = normalizeParagraphBreaks(s);
  return s.trim();
}

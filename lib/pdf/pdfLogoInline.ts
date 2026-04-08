/**
 * Lädt das PDF-Logo aus public/ für Puppeteer (setContent ohne Basis-URL).
 *
 * - Kein Modul-Cache: Nach Austausch der Datei ist das neue Logo sofort wirksam (Dev-Server ggf. einmal neu starten).
 * - Inline-SVG statt data:-URL im <img>: große Inkscape-Dateien mit eingebetteten Bildern
 *   funktionieren in Chromium/PDF zuverlässiger als riesige base64-src-Attribute.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const LOGO_REL = join("public", "lv-scope-logo.svg");

/**
 * Liefert den SVG-Markup-String (ohne zusätzliches Escaping – nur aus vertrauenswürdiger Datei).
 */
export function getPdfLogoInlineSvg(): string | null {
  const filePath = join(process.cwd(), LOGO_REL);
  if (!existsSync(filePath)) return null;
  try {
    let s = readFileSync(filePath, "utf8");
    s = s.replace(/<\?xml[^?]*\?>\s*/i, "").trim();
    if (!s) return null;
    return s;
  } catch {
    return null;
  }
}

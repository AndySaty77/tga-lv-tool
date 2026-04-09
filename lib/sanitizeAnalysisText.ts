/**
 * Entfernt offensichtliche eingebettete Bild-/Base64-Artefakte aus Texten, die in
 * Score-, Trigger-, LLM- und Vortext-Pipelines landen (GAEB-Exporte mit eingebetteten Bildern).
 *
 * Konzervativ: nur sehr lange Base64-artige Sequenzen, Data-URLs und bekannte Bild-Header.
 * Kein Ersatz für vollständiges Binär-Parsing — verhindert aber, dass Trigger/Regex auf
 * seitenlangem Müll laufen oder der Text nutzlos aufgeblasen wird.
 */

/** Mindestlänge für „generische“ Base64-Rohsequenzen (ohne Leerzeichen). */
const MIN_BASE64_RUN = 400;

/** Mindestlänge nach bekannten Base64-Bild-Headern. */
const MIN_AFTER_IMAGE_HEADER = 200;

export function stripEmbeddedBinaryAndBase64Artifacts(input: string): string {
  let t = input ?? "";
  if (t.length < 40) return t;

  // data:image/...;base64,... (inkl. typischer Zeilenumbrüche in eingebetteten Daten)
  t = t.replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/g, " ");

  // Bekannte Base64-Köpfe gängiger Rasterformate (Start eines Binärblocks im Text)
  t = t.replace(new RegExp(`iVBORw0KGgo[A-Za-z0-9+/=\\s\\r\\n]{${MIN_AFTER_IMAGE_HEADER},}`, "g"), " ");
  t = t.replace(new RegExp(`/9j/[A-Za-z0-9+/=\\s\\r\\n]{${MIN_AFTER_IMAGE_HEADER},}`, "g"), " ");
  t = t.replace(new RegExp(`R0lGOD[A-Za-z0-9+/=\\s\\r\\n]{${MIN_AFTER_IMAGE_HEADER},}`, "g"), " ");
  t = t.replace(new RegExp(`UklGR[A-Za-z0-9+/=\\s\\r\\n]{${MIN_AFTER_IMAGE_HEADER},}`, "g"), " ");

  // Generische sehr lange Base64-artige Sequenzen (typisch für eingebettete Blobs ohne data:-Präfix)
  t = t.replace(new RegExp(`[A-Za-z0-9+/=]{${MIN_BASE64_RUN},}`, "g"), " ");

  return t;
}

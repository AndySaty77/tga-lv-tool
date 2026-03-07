/**
 * GAEB-Extraktion: Vortext/Positionen-Trennung und Strukturaufbau.
 * Regelbasiert; LLM-Fallback kann später ergänzt werden.
 */

import type { GaebStructure, GaebMeta } from "./gaebStructure";

// ================= Limits =================
const HARD_MAX_CHARS = 200_000;

// ================= Helpers =================
export function hardCut(s: string, max: number = HARD_MAX_CHARS): string {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
}

export function normalizeNewlines(s: string): string {
  return (s ?? "").toString().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripHtml(input: string): string {
  let s = (input ?? "").toString();
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<\/?[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s*\n\s*/g, "\n");
  return s.trim();
}

function clampIdx(idx: number, len: number): number {
  if (!Number.isFinite(idx)) return 0;
  return Math.max(0, Math.min(idx, len));
}

// ================= Cut-Logik (regelbasiert) =================
export type CutResult = { cutIdx: number; method: string };

/**
 * Findet den Cut-Index zwischen Vortext und Positions-/LV-Teil.
 * Unterstützt: Dangl, CaliforniaX, XML-Marker, Mengenblock.
 */
export function findCutIdx(rawPreview: string): CutResult {
  const t = normalizeNewlines(rawPreview);
  const lower = t.toLowerCase();
  const len = t.length;

  // 1) Dangl-Anchor
  const eg = lower.indexOf("einrichtungsgegenstände");
  if (eg > 0) return { cutIdx: clampIdx(eg, len), method: "anchor-einrichtungsgegenstaende" };

  // 2) CaliforniaX: TITEL n:
  const mTitel = /(?:^|\n)titel\s+\d+\s*:\s*/i.exec(t);
  if (mTitel && typeof mTitel.index === "number") {
    const idx = mTitel.index === 0 ? 0 : mTitel.index + 1;
    return { cutIdx: clampIdx(idx, len), method: "anchor-titel-n" };
  }

  // 3) XML Marker
  const xml = ["<lvpos", "<position", "<pos"];
  for (const x of xml) {
    const i = lower.indexOf(x);
    if (i > 300) return { cutIdx: clampIdx(i, len), method: "xml-marker" };
  }

  // 4) Mengenblock-Fallback (CaliforniaX-Positionen)
  const qtyUnitRe = new RegExp(
    String.raw`(?:^|\n)\s*\d{1,6}\.\d{3}\s*\n\s*(m|st|kg|t|l|h|std|psch|m2|m²|m3|m³)\s*\n(?:\s*(yes|no)\s*\n)?`,
    "i"
  );
  const mq = qtyUnitRe.exec(t);
  if (mq && typeof mq.index === "number") {
    const idx = mq.index === 0 ? 0 : mq.index + 1;
    return { cutIdx: clampIdx(idx, len), method: "fallback-qty-unit" };
  }

  // 5) letzter Fallback: keine Trennung
  return { cutIdx: len, method: "fallback-no-cut-found" };
}

// ================= Vorbemerkungen vs. Vortext (Heuristik) =================
export function splitVorbemerkungenVortext(preCutText: string): { vorbemerkungen: string; vortext: string } {
  const t = (preCutText ?? "").trim();
  if (!t) return { vorbemerkungen: "", vortext: "" };

  // Suche nach typischen Übergängen zu Vertragsbedingungen
  const markers = [
    /\n\s*Allgemeine\s+Vertragsbedingungen\s*[:\s]/i,
    /\n\s*Vertragsbedingungen\s*[:\s]/i,
    /\n\s*§\s*\d+\s+Vertragsbedingungen/i,
    /\n\s*Besondere\s+Vertragsbedingungen\s*[:\s]/i,
    /\n\s*VOB\/B\s*[:\s]/i,
  ];

  for (const re of markers) {
    const m = re.exec(t);
    if (m && typeof m.index === "number" && m.index > 200) {
      const vorbemerkungen = t.slice(0, m.index).trim();
      const vortext = t.slice(m.index).trim();
      if (vortext.length > 100) {
        return { vorbemerkungen, vortext };
      }
    }
  }

  // Kein klarer Schnitt: alles als Vortext
  return { vorbemerkungen: "", vortext: t };
}

// ================= Hauptfunktion =================
export type ExtractGaebStructureOpts = {
  filename?: string;
};

/**
 * Extrahiert GAEB-Struktur aus dem rohen Dateiinhalt.
 * Regelbasiert; LLM-Fallback kann später ergänzt werden.
 */
export function extractGaebStructure(
  raw: string,
  opts?: ExtractGaebStructureOpts
): GaebStructure {
  const rawNorm = normalizeNewlines(hardCut(raw, HARD_MAX_CHARS));
  const len = rawNorm.length;

  const cut = findCutIdx(rawNorm);
  const cutIdx = clampIdx(cut.cutIdx, len);

  const preCutRaw = rawNorm.slice(0, cutIdx);
  const positionsRaw = rawNorm.slice(cutIdx);

  const { vorbemerkungen, vortext } = splitVorbemerkungenVortext(preCutRaw);

  const meta: GaebMeta = {
    source: "text-export",
    filename: opts?.filename,
  };

  return {
    meta,
    vorbemerkungen,
    vortext,
    abschnitte: [],
    positionen: { raw: positionsRaw },
    raw: {
      full: rawNorm,
      cutMethod: cut.method,
      vortextStart: 0,
      vortextEnd: cutIdx,
    },
  };
}

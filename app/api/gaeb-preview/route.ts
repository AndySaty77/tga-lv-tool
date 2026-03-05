// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HARD_MAX_CHARS = 200_000;
const VORTEXT_PREVIEW_MAX_CHARS = 120_000;

function hardCut(s: string, max: number) {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
}

function normalizeNewlines(s: string) {
  return (s ?? "").toString().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripHtml(input: string) {
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

type CutResult = { cutIdx: number; method: string };

function clampIdx(idx: number, len: number) {
  if (!Number.isFinite(idx)) return 0;
  return Math.max(0, Math.min(idx, len));
}

/**
 * Cut-Logik für mehrere GAEB-Text-Exporte:
 * 1) Dangl: "Einrichtungsgegenstände"
 * 2) CaliforniaX: Zeile "TITEL <n>: ..."
 * 3) Fallback: erster Mengenblock "40.000" + Einheit (m/St/...)
 */
function findCutIdx(rawPreview: string): CutResult {
  const t = normalizeNewlines(rawPreview);
  const lower = t.toLowerCase();
  const len = t.length;

  // 1) Dangl-Anchor
  const eg = lower.indexOf("einrichtungsgegenstände");
  if (eg > 0) return { cutIdx: clampIdx(eg, len), method: "anchor-einrichtungsgegenstaende" };

  // 2) CaliforniaX: TITEL n:
  // Wichtig: wir suchen den Start einer ZEILE, also "\ntitel " oder am Anfang "titel "
  // und schneiden GENAU dort.
  const mTitel = /(?:^|\n)titel\s+\d+\s*:\s*/i.exec(t);
  if (mTitel && typeof mTitel.index === "number") {
    const idx = mTitel.index === 0 ? 0 : mTitel.index + 1; // +1 damit wir nach dem \n starten
    return { cutIdx: clampIdx(idx, len), method: "anchor-titel-n" };
  }

  // 3) XML Marker
  const xml = ["<lvpos", "<position", "<pos"];
  for (const x of xml) {
    const i = lower.indexOf(x);
    if (i > 300) return { cutIdx: clampIdx(i, len), method: "xml-marker" };
  }

  // 4) Mengenblock-Fallback (CaliforniaX-Positionen)
  // Beispiel:
  // 40.000
  // m
  // Yes
  // schallgedämmte Abwasserleitung DN 56
  //
  // Tolerant: optional Yes/No-Zeile, optional Leerzeilen
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

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided (field name: file)" }, { status: 400 });
    }

    const f = file as File;
    const raw = await f.text();

    const rawPreview = normalizeNewlines(hardCut(raw, HARD_MAX_CHARS));
    const cleanPreview = stripHtml(rawPreview);

    const g = findCutIdx(rawPreview);
    const cutIdx = clampIdx(g.cutIdx, rawPreview.length);

    const vortextFullRaw = rawPreview.slice(0, cutIdx);
    const positionsFullRaw = rawPreview.slice(cutIdx);

    const vortextGuessRaw = hardCut(vortextFullRaw, VORTEXT_PREVIEW_MAX_CHARS);
    const vortextWasTruncated = vortextFullRaw.length > VORTEXT_PREVIEW_MAX_CHARS;

    return NextResponse.json({
      filename: f.name,
      size: f.size,

      rawPreview,
      cleanPreview,

      vortextGuessRaw,
      vortextGuessClean: stripHtml(vortextGuessRaw),
      vortextWasTruncated,

      vortextFullRaw,
      vortextFullClean: stripHtml(vortextFullRaw),

      positionsGuessRaw: positionsFullRaw,
      positionsGuessClean: stripHtml(positionsFullRaw),

      debug: {
        previewChars: rawPreview.length,
        cutIdx,
        method: g.method,
        vortextFullChars: vortextFullRaw.length,
        positionsFullChars: positionsFullRaw.length,
        positionsStartsWith: stripHtml(positionsFullRaw).slice(0, 260),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "gaeb-preview failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

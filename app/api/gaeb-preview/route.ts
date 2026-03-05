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

function findCutIdx(rawPreview: string): CutResult {
  const t = normalizeNewlines(rawPreview);
  const lower = t.toLowerCase();
  const len = t.length;

  // A) Dangl-Export: "Einrichtungsgegenstände" = sicherer Start Positionsblock
  const eg = lower.indexOf("einrichtungsgegenstände");
  if (eg > 0) return { cutIdx: clampIdx(eg, len), method: "anchor-einrichtungsgegenstaende" };

  // B) CaliforniaX / GAEB-Text: TITEL <nr>: <name>
  // Schneide am Beginn der Zeile "TITEL ..."
  const titelRe = /(?:^|\n)(titel\s+\d+\s*:\s*[^\n]+)/i;
  const mt = titelRe.exec(t);
  if (mt && typeof mt.index === "number") {
    const idx = mt.index === 0 ? 0 : mt.index + 1; // +1 weil match kann mit \n starten
    return { cutIdx: clampIdx(idx, len), method: "anchor-titel-n" };
  }

  // C) XML Marker
  for (const m of ["<lvpos", "<position", "<pos"]) {
    const i = lower.indexOf(m);
    if (i > 300) return { cutIdx: clampIdx(i, len), method: "xml-marker" };
  }

  // D) Dangl/WebGAEB Positions-Pattern: Titelzeile + No + Menge + Einheit + No + No
  const unit = "(St|Std|h|min|m|m2|m²|m3|m³|kg|t|l|psch)";
  const danglRe = new RegExp(
    String.raw`(?:^|\n)(?<title>[^\n]{3,180})\nNo\s*\n(?<qty>\d{1,7})\s*\n(?<unit>${unit})\s*\nNo\s*\nNo\s*\n`,
    "gi"
  );

  const badTitle = (s: string) => {
    const x = s.trim();
    if (!x) return true;
    if (/^no$/i.test(x)) return true;
    if (/^\d+(\.\d+)*$/.test(x)) return true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return true;
    if (/^\d{2}:\d{2}:\d{2}$/.test(x)) return true;
    if (/^(alltxt|boqlevel|item|index|hls|eur|euro|californiax|version|stand)$/i.test(x)) return true;
    if (/^[a-f0-9-]{16,}$/i.test(x)) return true;
    if (x.length < 4) return true;
    return false;
  };

  let bestIdx = -1;
  let bestScore = -1;
  let mm: RegExpExecArray | null;

  while ((mm = danglRe.exec(t)) !== null) {
    const idx = mm.index;
    const title = (mm.groups?.title ?? "").trim();
    if (badTitle(title)) continue;

    const window = t.slice(idx, Math.min(len, idx + 2000)).toLowerCase();
    const score =
      (window.includes("bestehend aus") ? 3 : 0) +
      (window.includes("liefern und montieren") ? 3 : 0) +
      (window.includes("hersteller") ? 2 : 0) +
      (window.includes("modell") ? 1 : 0);

    const before = t.slice(Math.max(0, idx - 15000), idx).toLowerCase();
    const bonus = before.includes("allgemeine vorbemerkungen") ? 3 : 0;

    const total = score + bonus;
    if (total > bestScore) {
      bestScore = total;
      bestIdx = idx;
    }
  }

  if (bestIdx !== -1) {
    return { cutIdx: clampIdx(bestIdx, len), method: `dangl-title+no-qty-unit score=${bestScore}` };
  }

  // E) CaliforniaX Positions-Pattern: Menge (z.B. 40.000) + Einheit (m/St/...) + optional Yes/No
  // Beispiel: "40.000\nm\nYes\nschallgedämmte Abwasserleitung DN 56"
  const qtyUnitRe = new RegExp(
    String.raw`(?:^|\n)\d{1,6}\.\d{3}\s*\n(?:m|st|kg|t|l|h|std|psch|m2|m²|m3|m³)\s*\n(?:yes|no)?\s*\n`,
    "i"
  );
  const mq = qtyUnitRe.exec(lower);
  if (mq && typeof mq.index === "number" && mq.index > 0) {
    const idx = mq.index === 0 ? 0 : mq.index + 1;
    return { cutIdx: clampIdx(idx, len), method: "californiax-qty-unit" };
  }

  // F) Fallback: keine Trennung
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
        vortextPreviewChars: vortextGuessRaw.length,
        positionsFullChars: positionsFullRaw.length,
        positionsStartsWith: stripHtml(positionsFullRaw).slice(0, 220),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "gaeb-preview failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

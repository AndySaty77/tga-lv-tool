// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HARD_MAX_CHARS = 200_000;            // Roh-Preview (gesamt)
const VORTEXT_PREVIEW_MAX_CHARS = 120_000; // UI-Preview für Vortext (hochgesetzt!)

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

type VortextGuess = {
  cutIdx: number; // Index im rawPreview
  method: string;
};

function clampIdx(idx: number, len: number) {
  if (!Number.isFinite(idx)) return 0;
  return Math.max(0, Math.min(idx, len));
}

/**
 * Ziel: genau dort schneiden, wo bei dir die Positionen anfangen:
 * - bevorzugt: "Einrichtungsgegenstände"
 * - sonst: Titelzeile + No + Menge + Einheit + No + No
 */
function findCutIdx(rawPreview: string): VortextGuess {
  const t = normalizeNewlines(rawPreview);
  const lower = t.toLowerCase();
  const len = t.length;

  // 1) Harte Ankerstelle (bei deinem Export 100% richtig)
  const eg = lower.indexOf("einrichtungsgegenstände");
  if (eg > 0) return { cutIdx: clampIdx(eg, len), method: "anchor-einrichtungsgegenstaende" };

  // 2) XML Marker (falls echtes XML)
  for (const m of ["<lvpos", "<position", "<pos"]) {
    const i = lower.indexOf(m);
    if (i > 300) return { cutIdx: clampIdx(i, len), method: "xml-marker" };
  }

  // 3) Generisch: Titelzeile + No + Menge + Einheit + No + No
  const unit = "(St|Std|h|min|m|m2|m²|m3|m³|kg|t|l|psch)";
  const re = new RegExp(
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
    if (/^(alltxt|boqlevel|item|index|hls|eur|euro|webgaeb|dangl|version|stand)$/i.test(x)) return true;
    if (/^[a-f0-9-]{16,}$/i.test(x)) return true;
    if (x.length < 4) return true;
    return false;
  };

  let bestIdx = -1;
  let bestScore = -1;

  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const idx = m.index;
    const title = (m.groups?.title ?? "").trim();
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
    return { cutIdx: clampIdx(bestIdx, len), method: `title+no-qty-unit score=${bestScore}` };
  }

  // 4) Letzter Fallback: keine Trennung
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

    // UI-Preview fürs Vortext-Feld
    const vortextGuessRaw = hardCut(vortextFullRaw, VORTEXT_PREVIEW_MAX_CHARS);
    const vortextWasTruncated = vortextFullRaw.length > VORTEXT_PREVIEW_MAX_CHARS;

    return NextResponse.json({
      filename: f.name,
      size: f.size,

      // Gesamt
      rawPreview,
      cleanPreview,

      // Vortext (Preview + Full)
      vortextGuessRaw,
      vortextGuessClean: stripHtml(vortextGuessRaw),
      vortextWasTruncated,
      vortextFullRaw,
      vortextFullClean: stripHtml(vortextFullRaw),

      // Positionen (Full)
      positionsGuessRaw: positionsFullRaw,
      positionsGuessClean: stripHtml(positionsFullRaw),

      debug: {
        rawChars: raw.length,
        previewChars: rawPreview.length,
        cutIdx,
        method: g.method,
        vortextFullChars: vortextFullRaw.length,
        vortextPreviewChars: vortextGuessRaw.length,
        positionsFullChars: positionsFullRaw.length,
        positionsStartsWith: stripHtml(positionsFullRaw).slice(0, 200),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "gaeb-preview failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

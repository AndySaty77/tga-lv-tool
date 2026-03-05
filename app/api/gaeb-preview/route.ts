// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HARD_MAX_CHARS = 200_000;
const VORTEXT_MAX_CHARS = 20_000;

function hardCut(s: string, max: number) {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
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
  vortextRaw: string;
  cutIdx: number;          // <- entscheidend
  method: string;
};

function guessVortext(raw: string): VortextGuess {
  const t = raw ?? "";
  const lower = t.toLowerCase();

  // 1) XML echte Positions-Tags (wenn GAEB-XML)
  const xmlMarkers = ["<lvpos", "<position", "<pos"];
  let cutIdx = -1;
  for (const m of xmlMarkers) {
    const i = lower.indexOf(m);
    if (i !== -1) cutIdx = cutIdx === -1 ? i : Math.min(cutIdx, i);
  }
  if (cutIdx !== -1 && cutIdx > 300) {
    const vt = hardCut(t.slice(0, cutIdx).trim(), VORTEXT_MAX_CHARS);
    return { vortextRaw: vt, cutIdx, method: "xml-marker" };
  }

  // 2) TEXT-EXPORT (wie bei dir): Position-Row Muster "No / <zahl> / <Einheit> / No / No"
  // Wichtig: Einheit-Liste bewusst kurz halten, sonst false positives.
  const unit = "(St|Std|h|min|m|m2|m²|m3|m³|kg|t|l)";
  const posRowRe = new RegExp(
    String.raw`(?:^|\n)No\s*\n\d{1,7}\s*\n${unit}\s*\nNo\s*\nNo\s*\n`,
    "i"
  );
  const m = posRowRe.exec(t);
  if (m && typeof m.index === "number") {
    // cut am Beginn der Tabellenzeile "No..."
    cutIdx = m.index === 0 ? 0 : m.index; 
    // Optional: noch 1-2 Zeilen nach oben ziehen, wenn davor ein Positionskurztext steht.
    // Heuristik: schau 1 Zeile nach oben.
    const before = t.slice(0, cutIdx);
    const lastNl = before.lastIndexOf("\n");
    const prevLineStart = before.lastIndexOf("\n", lastNl - 1);
    const prevLine = before.slice(prevLineStart + 1, lastNl).trim();

    // Wenn die vorherige Zeile NICHT leer ist, ist das wahrscheinlich der Kurztext -> mitnehmen
    if (prevLine && prevLine.length < 120) {
      cutIdx = prevLineStart + 1;
    }

    const vt = hardCut(t.slice(0, cutIdx).trim(), VORTEXT_MAX_CHARS);
    return { vortextRaw: vt, cutIdx, method: "no-qty-unit-pattern" };
  }

  // 3) Fallback: nix gefunden -> einfach Top-Chunk
  const fallbackCut = Math.min(t.length, VORTEXT_MAX_CHARS);
  return { vortextRaw: hardCut(t.slice(0, fallbackCut).trim(), VORTEXT_MAX_CHARS), cutIdx: fallbackCut, method: "fallback-top-chunk" };
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

    const rawPreview = hardCut(raw, HARD_MAX_CHARS);
    const cleanPreview = stripHtml(rawPreview);

    const g = guessVortext(rawPreview);
    const vortextGuessRaw = g.vortextRaw;
    const vortextGuessClean = stripHtml(vortextGuessRaw);

    // Positions = ab cutIdx (nicht startsWith/trim-Spielchen)
    const positionsGuessRaw = rawPreview.slice(Math.max(0, g.cutIdx));
    const positionsGuessClean = stripHtml(hardCut(positionsGuessRaw, HARD_MAX_CHARS));

    return NextResponse.json({
      filename: f.name,
      size: f.size,
      rawPreview,
      cleanPreview,
      vortextGuessRaw,
      vortextGuessClean,
      positionsGuessRaw: hardCut(positionsGuessRaw, HARD_MAX_CHARS),
      positionsGuessClean,
      debug: {
        rawChars: raw.length,
        previewChars: rawPreview.length,
        vortextChars: vortextGuessRaw.length,
        cutIdx: g.cutIdx,
        method: g.method,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "gaeb-preview failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

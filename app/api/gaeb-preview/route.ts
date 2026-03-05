// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // wichtig für File/Buffer

const HARD_MAX_CHARS = 200_000; // Preview-Limit (roh)
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

/**
 * GAEB/XML-Preview MVP:
 * - liest Datei als Text
 * - macht eine "Rohansicht"
 * - versucht einen GROBEN Vortext-Schnitt (heuristisch)
 * - liefert zusätzlich einen "clean" Text (HTML stripped)
 *
 * Perfektes GAEB-Parsing kommt später. Hier geht’s nur um Sichtbarkeit.
 */
function guessVortext(raw: string) {
  const t = raw ?? "";
  const lower = t.toLowerCase();

  const markers = [
    "\nposition",
    "\npos.",
    "\npos ",
    "\nleistungstext",
    "\nleistungsverzeichnis",
    "\nkurztext",
    "\nlangtext",
    "\nmenge",
    "\neinheit",
    "\n ep",
    "\ngp",
    "\n€",
    "<position", // XML
    "<pos", // XML
    "<lvpos", // XML
  ];

  let cutIdx = -1;
  for (const m of markers) {
    const i = lower.indexOf(m);
    if (i !== -1) cutIdx = cutIdx === -1 ? i : Math.min(cutIdx, i);
  }

  const candidate = cutIdx > 300 ? t.slice(0, cutIdx) : t.slice(0, Math.min(t.length, VORTEXT_MAX_CHARS));
  return hardCut(candidate.trim(), VORTEXT_MAX_CHARS);
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

    const vortextGuessRaw = guessVortext(rawPreview);
    const vortextGuessClean = stripHtml(vortextGuessRaw);

    // positionsGuess: einfach "alles nach vortextGuessRaw" (heuristisch)
    const positionsGuessRaw =
      vortextGuessRaw && rawPreview.startsWith(vortextGuessRaw)
        ? rawPreview.slice(vortextGuessRaw.length)
        : rawPreview;

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
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "gaeb-preview failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

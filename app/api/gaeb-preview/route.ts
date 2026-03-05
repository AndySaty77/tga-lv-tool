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

type VortextGuess = {
  vortextRaw: string;
  cutIdx: number;
  method: string;
};

/**
 * Robust für deinen Dangl/WebGAEB-Text-Export:
 * - Header enthält viele "No" -> darf NICHT triggern
 * - Echter Positionsstart ist: TITELZEILE + No + Menge + Einheit + No + No
 * - Wenn wir keinen guten Treffer finden: fallback auf "Einrichtungsgegenstände"
 */
function guessVortext(raw: string): VortextGuess {
  const t = raw ?? "";
  const lower = t.toLowerCase();

  // 1) XML Marker (falls doch mal XML)
  for (const m of ["<lvpos", "<position", "<pos"]) {
    const i = lower.indexOf(m);
    if (i > 300) {
      return {
        vortextRaw: hardCut(t.slice(0, i).trim(), VORTEXT_MAX_CHARS),
        cutIdx: i,
        method: "xml-marker",
      };
    }
  }

  // 2) Dangl/WebGAEB Textexport: Titel + No + Menge + Einheit + No + No
  const unit = "(St|Std|h|min|m|m2|m²|m3|m³|kg|t|l|psch)";
  const re = new RegExp(
    String.raw`(?:^|\n)(?<title>[^\n]{3,180})\nNo\s*\n(?<qty>\d{1,7})\s*\n(?<unit>${unit})\s*\nNo\s*\nNo\s*\n`,
    "gi"
  );

  const badTitle = (s: string) => {
    const x = s.trim();
    if (!x) return true;
    if (/^no$/i.test(x)) return true;
    if (/^\d+(\.\d+)*$/.test(x)) return true; // 3.3, 19.2, etc.
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return true; // Datum
    if (/^\d{2}:\d{2}:\d{2}$/.test(x)) return true; // Uhrzeit
    if (
      /^(alltxt|boqlevel|item|index|hls|eur|euro|webgaeb|dangl|version|stand)$/i.test(
        x
      )
    )
      return true;
    if (/^[a-f0-9-]{16,}$/i.test(x)) return true; // GUID/Hash
    if (x.length < 4) return true;
    return false;
  };

  let bestIdx = -1;
  let bestScore = -1;
  let bestTitle = "";

  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const idx = m.index; // Start der Titelzeile
    const title = (m.groups?.title ?? "").trim();
    if (badTitle(title)) continue;

    // Score: echtes LV hat kurz danach typische Phrasen
    const window = t.slice(idx, Math.min(t.length, idx + 1800)).toLowerCase();
    const score =
      (window.includes("bestehend aus") ? 3 : 0) +
      (window.includes("liefern und montieren") ? 3 : 0) +
      (window.includes("hersteller") ? 2 : 0) +
      (window.includes("modell") ? 1 : 0);

    // Bonus, wenn vor dem Treffer "Allgemeine Vorbemerkungen" vorkommt
    const before = t
      .slice(Math.max(0, idx - 12000), idx)
      .toLowerCase();
    const bonus = before.includes("allgemeine vorbemerkungen") ? 3 : 0;

    const total = score + bonus;

    if (total > bestScore) {
      bestScore = total;
      bestIdx = idx;
      bestTitle = title;
    }
  }

  if (bestIdx !== -1) {
    return {
      vortextRaw: hardCut(t.slice(0, bestIdx).trim(), VORTEXT_MAX_CHARS),
      cutIdx: bestIdx,
      method: `title+no-qty-unit bestScore=${bestScore} title="${bestTitle}"`,
    };
  }

  // 3) Fallback: bei "Einrichtungsgegenstände" schneiden (bei dir exakt der Start)
  const i2 = lower.indexOf("\neinrichtungsgegenstände\n");
  if (i2 > 0) {
    return {
      vortextRaw: hardCut(t.slice(0, i2).trim(), VORTEXT_MAX_CHARS),
      cutIdx: i2 + 1,
      method: "fallback-einrichtungsgegenstaende",
    };
  }

  // 4) Letzter Fallback
  const cut = Math.min(t.length, VORTEXT_MAX_CHARS);
  return {
    vortextRaw: hardCut(t.slice(0, cut).trim(), VORTEXT_MAX_CHARS),
    cutIdx: cut,
    method: "fallback-top-chunk",
  };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No file provided (field name: file)" },
        { status: 400 }
      );
    }

    const f = file as File;
    const raw = await f.text();

    const rawPreview = hardCut(raw, HARD_MAX_CHARS);
    const cleanPreview = stripHtml(rawPreview);

    const g = guessVortext(rawPreview);

    const vortextGuessRaw = g.vortextRaw;
    const vortextGuessClean = stripHtml(vortextGuessRaw);

    // WICHTIG: stumpf ab cutIdx slicen – kein startsWith/trim-Quatsch
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
        positionsStartsWith: stripHtml(positionsGuessRaw).slice(0, 120),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "gaeb-preview failed", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

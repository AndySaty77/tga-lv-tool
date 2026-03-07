// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";
import { parse } from "../../../lib/gaebParse";
import { hardCut } from "../../../lib/gaebParse/utils";

export const runtime = "nodejs";

const VORTEXT_PREVIEW_MAX_CHARS = 120_000;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided (field name: file)" }, { status: 400 });
    }

    const f = file as File;
    const raw = await f.text();

    const parsed = parse(raw, { filename: f.name });

    const vortextGuessRaw = hardCut(parsed.prefaceText, VORTEXT_PREVIEW_MAX_CHARS);
    const vortextWasTruncated = parsed.prefaceText.length > VORTEXT_PREVIEW_MAX_CHARS;

    return NextResponse.json({
      filename: f.name,
      size: f.size,

      rawPreview: parsed.rawText,
      cleanPreview: parsed.cleanedText,

      vortextGuessRaw,
      vortextGuessClean: vortextGuessRaw,
      vortextWasTruncated,

      vortextFullRaw: parsed.prefaceText,
      vortextFullClean: parsed.prefaceText,

      positionsGuessRaw: parsed.itemTexts,
      positionsGuessClean: parsed.itemTexts,

      structure: {
        meta: parsed.meta,
        vorbemerkungen: parsed.vorbemerkungenText ?? "",
        vortext: parsed.vortextText ?? "",
        abschnitte: parsed.sectionTexts,
        positionen: { raw: parsed.itemTexts, items: parsed.items },
        raw: {
          full: parsed.rawText,
          cutMethod: parsed.meta.cutMethod ?? parsed.meta.parserUsed ?? "unknown",
          vortextStart: 0,
          vortextEnd: parsed.prefaceText.length,
        },
      },

      parseResult: parsed,

      debug: {
        parserUsed: parsed.parserUsed,
        formatDetected: parsed.formatDetected,
        structureConfidence: parsed.structureConfidence,
        itemCount: parsed.itemCount,
        prefaceText: parsed.prefaceText.slice(0, 500),
        prefaceTextLength: parsed.prefaceText.length,
        itemTextsLength: parsed.itemTexts.length,
        warnings: parsed.warnings,
        sectionCount: parsed.sectionTexts.length,
        // Rückwärtskompatibilität
        previewChars: parsed.rawText.length,
        cutIdx: parsed.prefaceText.length,
        method: parsed.meta.cutMethod ?? parsed.meta.parserUsed ?? "unknown",
        vortextFullChars: parsed.prefaceText.length,
        positionsFullChars: parsed.itemTexts.length,
        positionsStartsWith: parsed.itemTexts.slice(0, 260),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "gaeb-preview failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

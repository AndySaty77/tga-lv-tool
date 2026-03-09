// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";
import { parse } from "../../../lib/gaebParse";
import { hardCut } from "../../../lib/gaebParse/utils";
import { parseGaebXmlNormalized, debugRawStructures } from "../../../lib/gaebParse/parseGaebXmlNormalized";

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

    // Normalisierte Struktur für Preview-UI (nur bei GAEB-XML)
    let normalized: { groups: unknown[]; remarks: unknown[]; items: unknown[] } | undefined;
    let rawStructures: ReturnType<typeof debugRawStructures> | undefined;
    if (parsed.formatDetected === "gaeb-xml") {
      const norm = parseGaebXmlNormalized(parsed.rawText);
      normalized = { groups: norm.groups, remarks: norm.remarks, items: norm.items };
      rawStructures = debugRawStructures(parsed.rawText);
    }

    const firstNormalizedItem =
      normalized && normalized.items.length > 0
        ? (() => {
            const it = normalized!.items[0] as Record<string, unknown>;
            return {
              posNr: it.posNr,
              shortText: typeof it.shortText === "string" ? it.shortText.slice(0, 120) : it.shortText,
              longText: typeof it.longText === "string" ? it.longText.slice(0, 200) : it.longText,
              quantity: it.quantity,
              unit: it.unit,
              _source: it._source,
            };
          })()
        : undefined;

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

      /** Normalisierte LV-Struktur für die Preview-Anzeige (nur bei GAEB-XML) */
      normalized,

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
        // Normalisierte Struktur (Debug)
        normalizedGroupCount: normalized?.groups.length ?? 0,
        normalizedRemarkCount: normalized?.remarks.length ?? 0,
        normalizedItemCount: normalized?.items.length ?? 0,
        firstNormalizedItemExample: firstNormalizedItem ?? null,
        /** Rohstrukturen (erste BoQCtgy, Remark, Item 1+2) + extrahierte Felder – für Feldpfad-Mapping */
        rawStructures: rawStructures ?? null,
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

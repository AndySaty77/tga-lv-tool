// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";
import { parse } from "../../../lib/gaebParse";
import { hardCut } from "../../../lib/gaebParse/utils";
import { parseGaebXmlNormalized, debugRawStructures } from "../../../lib/gaebParse/parseGaebXmlNormalized";
import { formatRemarkOrLabelText } from "../../../lib/gaebParse/textFormatting";

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

    // Normalisierte Struktur für Preview-UI (nur bei GAEB-XML)
    let normalized:
      | {
          groups: unknown[];
          remarks: unknown[];
          items: unknown[];
          displayNodes?: unknown[];
          topLabelForPreface?: string;
          debugExtra?: Record<string, unknown>;
        }
      | undefined;
    let rawStructures: ReturnType<typeof debugRawStructures> | undefined;
    let prefaceSource: "global-remarks" | "top-label-fallback" | "none" | "raw-head-fallback" = "raw-head-fallback";
    let positionsSource: "normalized-items" | "legacy-structured-items" = "legacy-structured-items";

    if (parsed.formatDetected === "gaeb-xml") {
      const norm = parseGaebXmlNormalized(parsed.rawText);
      normalized = {
        groups: norm.groups,
        remarks: norm.remarks,
        items: norm.items,
        displayNodes: norm.displayNodes,
        topLabelForPreface: norm.topLabelForPreface,
        debugExtra: norm.debugExtra,
      };
      rawStructures = debugRawStructures(parsed.rawText);

      const globalRemarks = (norm.remarks as { scope?: string }[]).filter((r) => r.scope === "global");
      if (globalRemarks.length > 0) {
        prefaceSource = "global-remarks";
      } else if (norm.topLabelForPreface?.trim()) {
        prefaceSource = "top-label-fallback";
      } else {
        prefaceSource = "none";
      }
      if (normalized.items.length > 0) {
        positionsSource = "normalized-items";
      }
    }

    // Vortext: nur globale Remarks; sonst LblTx-Fallback; sonst Parser-Preface
    const globalRemarksList =
      normalized && Array.isArray(normalized.remarks)
        ? (normalized.remarks as { text?: string; scope?: string }[]).filter((r) => r.scope === "global")
        : [];
    const remarksText =
      globalRemarksList.length > 0
        ? globalRemarksList.map((r) => (r.text ?? "").trim()).filter(Boolean).join("\n\n")
        : "";
    const vortextFromNormalized = remarksText.trim();
    const vortextFromLabel =
      vortextFromNormalized.length === 0 && normalized?.topLabelForPreface?.trim()
        ? (normalized as { topLabelForPreface?: string }).topLabelForPreface!.trim()
        : "";
    let vortextForPreview =
      vortextFromNormalized.length > 0
        ? vortextFromNormalized
        : vortextFromLabel.length > 0
          ? vortextFromLabel
          : parsed.prefaceText;
    const prefaceFormattingApplied = vortextForPreview.length > 0;
    if (prefaceFormattingApplied) {
      vortextForPreview = formatRemarkOrLabelText(vortextForPreview);
    }
    const formattedPrefaceLength = vortextForPreview.length;
    const vortextGuessRaw = hardCut(vortextForPreview, VORTEXT_PREVIEW_MAX_CHARS);
    const vortextWasTruncated = vortextForPreview.length > VORTEXT_PREVIEW_MAX_CHARS;

    // Positionen: bei GAEB-XML mit displayNodes (Gruppen + Hinweise + Items) oder nur Items
    const buildPositionsTextFromDisplayNodes = (nodes: unknown[]) => {
      const blocks: string[] = [];
      for (const n of nodes) {
        const node = n as { type?: string; posNr?: string; label?: string; text?: string; shortText?: string; longText?: string; quantity?: string; unit?: string };
        if (node.type === "group") {
          const line = ("Gruppe " + (node.posNr ?? "—") + " – " + (node.label ?? "(ohne Bezeichnung)")).trim();
          if (line.length > 0) blocks.push(line);
        } else if (node.type === "remark") {
          const t = (node.text ?? "").trim();
          if (t.length > 0) blocks.push(t);
        } else if (node.type === "item") {
          const posNr = String(node.posNr ?? "").trim();
          const shortText = String(node.shortText ?? "").trim();
          const longText = String(node.longText ?? "").trim();
          const quantity = String(node.quantity ?? "").trim();
          const unit = String(node.unit ?? "").trim();
          const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();
          const lines = [posNr, shortText, mengeEinheit, longText].filter(Boolean);
          if (lines.length > 0) blocks.push(lines.join("\n"));
        }
      }
      return blocks.join("\n\n");
    };
    const buildPositionsTextFromItems = (items: unknown[]) => {
      const blocks: string[] = [];
      for (const it of items) {
        const o = it as Record<string, unknown>;
        const posNr = String(o?.posNr ?? "").trim();
        const shortText = String(o?.shortText ?? "").trim();
        const longText = String(o?.longText ?? "").trim();
        const quantity = String(o?.quantity ?? "").trim();
        const unit = String(o?.unit ?? "").trim();
        const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();
        const lines = [posNr, shortText, mengeEinheit, longText].filter(Boolean);
        if (lines.length > 0) blocks.push(lines.join("\n"));
      }
      return blocks.join("\n\n");
    };
    const positionsFromNormalized =
      normalized?.displayNodes?.length
        ? buildPositionsTextFromDisplayNodes(normalized.displayNodes)
        : normalized?.items?.length
          ? buildPositionsTextFromItems(normalized.items)
          : "";
    const positionsForPreview =
      positionsFromNormalized.length > 0 ? positionsFromNormalized : parsed.itemTexts;

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

      vortextFullRaw: vortextForPreview,
      vortextFullClean: vortextForPreview,

      positionsGuessRaw: positionsForPreview,
      positionsGuessClean: positionsForPreview,

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
        prefaceSource,
        positionsSource,
        globalRemarkCount:
          normalized?.remarks != null
            ? (normalized.remarks as { scope?: string }[]).filter((r) => r.scope === "global").length
            : 0,
        groupRemarkCount:
          normalized?.remarks != null
            ? (normalized.remarks as { scope?: string }[]).filter((r) => r.scope === "group").length
            : 0,
        itemlistRemarkCount:
          normalized?.remarks != null
            ? (normalized.remarks as { scope?: string }[]).filter((r) => r.scope === "itemlist-note").length
            : 0,
        groupHeaderCount: normalized?.groups?.length ?? 0,
        displayNodeCounts:
          normalized?.displayNodes != null
            ? {
                group: (normalized.displayNodes as { type?: string }[]).filter((n) => n.type === "group").length,
                remark: (normalized.displayNodes as { type?: string }[]).filter((n) => n.type === "remark").length,
                item: (normalized.displayNodes as { type?: string }[]).filter((n) => n.type === "item").length,
              }
            : undefined,
        totalRemarkCountFound: normalized?.remarks?.length ?? 0,
        remarkTextsJoinedLength:
          normalized?.remarks?.length != null
            ? (normalized.remarks as { text?: string }[]).reduce((sum, r) => sum + (r.text ?? "").length, 0)
            : 0,
        remarkCollectionMode: normalized ? "recursive-xml-order" : undefined,
        // End-to-End-Debug: exakt die Datenbasis für den Tab „Positionen“
        positionsSourceUsed:
          normalized?.displayNodes != null && (normalized.displayNodes as unknown[]).length > 0
            ? "displayNodes"
            : positionsSource,
        prefaceSourceUsed: prefaceSource,
        first10DisplayNodes:
          normalized?.displayNodes != null
            ? (normalized.displayNodes as unknown[]).slice(0, 10)
            : null,
        first5GroupNodes:
          normalized?.displayNodes != null
            ? (normalized.displayNodes as { type?: string }[]).filter((n) => n.type === "group").slice(0, 5)
            : null,
        first5RemarkNodes:
          normalized?.displayNodes != null
            ? (normalized.displayNodes as { type?: string }[]).filter((n) => n.type === "remark").slice(0, 5)
            : null,
        first5ItemNodes:
          normalized?.displayNodes != null
            ? (normalized.displayNodes as { type?: string }[]).filter((n) => n.type === "item").slice(0, 5)
            : null,
        renderedPositionsCount: (normalized?.displayNodes as unknown[])?.length ?? 0,
        renderedGroupHeaderCount:
          (normalized?.displayNodes as { type?: string }[])?.filter((n) => n.type === "group").length ?? 0,
        renderedRemarkCountInPositions:
          (normalized?.displayNodes as { type?: string }[])?.filter((n) => n.type === "remark").length ?? 0,
        hasLegacyPositionsPathStillActive:
          parsed.formatDetected === "gaeb-xml" &&
          (normalized?.displayNodes as unknown[])?.length > 0
            ? false
            : true,
        hasGroupNodesInFinalRenderData:
          (normalized?.displayNodes as { type?: string }[])?.some((n) => n.type === "group") ?? false,
        hasGlobalRemarksInPositionsRenderData:
          (normalized?.displayNodes as { type?: string; scope?: string }[])?.some(
            (n) => n.type === "remark" && n.scope === "global"
          ) ?? false,
        topLevelBoQBodyChildSequence: (normalized as { debugExtra?: { topLevelBoQBodyChildSequence?: string[] } })?.debugExtra?.topLevelBoQBodyChildSequence ?? null,
        globalRemarkTexts: (normalized as { debugExtra?: { globalRemarkTexts?: string[] } })?.debugExtra?.globalRemarkTexts ?? null,
        groupRemarkTexts: (normalized as { debugExtra?: { groupRemarkTexts?: string[] } })?.debugExtra?.groupRemarkTexts ?? null,
        formattedPrefaceLength,
        prefaceFormattingApplied,
        positionRenderMode:
          normalized?.displayNodes != null && (normalized.displayNodes as unknown[]).length > 0
            ? "node-renderer"
            : "text-renderer",
        visibleGroupHeaderCount:
          (normalized?.displayNodes as { type?: string }[])?.filter((n) => n.type === "group").length ?? 0,
        visibleRemarkCount:
          (normalized?.displayNodes as { type?: string }[])?.filter((n) => n.type === "remark").length ?? 0,
        // Rückwärtskompatibilität
        previewChars: parsed.rawText.length,
        cutIdx: vortextForPreview.length,
        method: parsed.meta.cutMethod ?? parsed.meta.parserUsed ?? "unknown",
        vortextFullChars: vortextForPreview.length,
        positionsFullChars: positionsForPreview.length,
        positionsStartsWith: positionsForPreview.slice(0, 260),
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

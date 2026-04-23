// app/api/gaeb-preview/route.ts
import { NextResponse } from "next/server";
import { parse } from "../../../lib/gaebParse";
import { hardCut } from "../../../lib/gaebParse/utils";
import { parseGaebXmlNormalized, debugRawStructures } from "../../../lib/gaebParse/parseGaebXmlNormalized";
import { formatRemarkOrLabelText } from "../../../lib/gaebParse/textFormatting";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/auth/is-admin";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const VORTEXT_PREVIEW_MAX_CHARS = 120_000;
const MAX_UPLOAD_BYTES = 10_000_000;
const GAEB_PREVIEW_RATE_LIMIT_PER_10_MIN = 20;
const GAEB_PREVIEW_RATE_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_EXTENSIONS = new Set([".x83", ".x84", ".x86", ".xml", ".gaeb", ".txt"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "text/xml",
  "application/xml",
  "application/octet-stream",
]);

function getLowercaseExtension(filename: string): string {
  const clean = (filename ?? "").trim().toLowerCase();
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === clean.length - 1) return "";
  return clean.slice(dotIdx);
}

function isAllowedUploadFile(file: File): boolean {
  const ext = getLowercaseExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const mime = (file.type ?? "").trim().toLowerCase();
  // Einige Browser liefern für diese Dateien keinen verlässlichen MIME-Type.
  return mime.length === 0 || ALLOWED_MIME_TYPES.has(mime);
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(
      `gaeb-preview:${ip}`,
      GAEB_PREVIEW_RATE_LIMIT_PER_10_MIN,
      GAEB_PREVIEW_RATE_WINDOW_MS
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const reqUrl = new URL(req.url);
    const user = await getUser().catch(() => null);
    const includeDebugPayload = reqUrl.searchParams.get("debug") === "1" && !!user && isAdmin(user);

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided (field name: file)" }, { status: 400 });
    }

    const f = file as File;
    if (!isAllowedUploadFile(f)) {
      return NextResponse.json(
        {
          error: "Ungültiger Dateityp. Erlaubt: .x83, .x84, .x86, .xml, .gaeb, .txt",
        },
        { status: 400 }
      );
    }
    if (!Number.isFinite(f.size) || f.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Datei zu groß. Maximal erlaubt: ${MAX_UPLOAD_BYTES} Bytes`,
        },
        { status: 413 }
      );
    }
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
      // Vollständige Datei für normalisierte Struktur (X83 mit vielen Positionen), nicht parsed.rawText (kann bei sehr großen Dateien gekürzt sein)
      const norm = parseGaebXmlNormalized(raw);
      normalized = {
        groups: norm.groups,
        remarks: norm.remarks,
        items: norm.items,
        displayNodes: norm.displayNodes,
        topLabelForPreface: norm.topLabelForPreface,
        debugExtra: norm.debugExtra,
      };
      rawStructures = debugRawStructures(raw.length > (parsed.rawText?.length ?? 0) ? raw : parsed.rawText);

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

    // structure.positionen.items: bei GAEB-XML aus normalized (vollständige Datei), sonst aus parsed
    const structurePositionenItems =
      normalized?.items != null && normalized.items.length > 0
        ? (normalized.items as { posNr?: string; shortText?: string; longText?: string; quantity?: string; unit?: string }[]).map((it) => ({
            posNr: it.posNr,
            shortText: it.shortText,
            longText: it.longText,
            quantity: it.quantity,
            unit: it.unit,
            raw: [it.posNr, it.shortText, it.longText, it.quantity, it.unit].filter(Boolean).join(" "),
          }))
        : parsed.items ?? [];

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

    const responsePayload: Record<string, unknown> = {
      filename: f.name,
      size: f.size,

      vortextGuessRaw,
      vortextGuessClean: vortextGuessRaw,
      vortextWasTruncated,

      vortextFullClean: vortextForPreview,

      positionsGuessRaw: positionsForPreview,
      positionsGuessClean: positionsForPreview,

      structure: {
        meta: parsed.meta,
        vorbemerkungen: parsed.vorbemerkungenText ?? "",
        vortext: parsed.vortextText ?? "",
        abschnitte: parsed.sectionTexts,
        positionen: { raw: positionsForPreview, items: structurePositionenItems },
      },

      /** Normalisierte LV-Struktur für die Preview-Anzeige (nur bei GAEB-XML) */
      normalized,
      debug: {
        parserUsed: parsed.parserUsed,
        formatDetected: parsed.formatDetected,
        previewChars: parsed.rawText.length,
        vortextFullChars: vortextForPreview.length,
        positionsFullChars: positionsForPreview.length,
      },
    };

    if (includeDebugPayload) {
      responsePayload.rawPreview = parsed.rawText;
      responsePayload.cleanPreview = parsed.cleanedText;
      responsePayload.vortextFullRaw = vortextForPreview;
      (responsePayload.structure as Record<string, unknown>).raw = {
        full: parsed.rawText,
        cutMethod: parsed.meta.cutMethod ?? parsed.meta.parserUsed ?? "unknown",
        vortextStart: 0,
        vortextEnd: parsed.prefaceText.length,
      };
      responsePayload.parseResult = parsed;
      (responsePayload.debug as Record<string, unknown>) = {
        ...((responsePayload.debug as Record<string, unknown>) ?? {}),
        structureConfidence: parsed.structureConfidence,
        itemCount: parsed.itemCount,
        prefaceText: parsed.prefaceText.slice(0, 500),
        prefaceTextLength: parsed.prefaceText.length,
        itemTextsLength: parsed.itemTexts.length,
        warnings: parsed.warnings,
        sectionCount: parsed.sectionTexts.length,
        normalizedGroupCount: normalized?.groups.length ?? 0,
        normalizedRemarkCount: normalized?.remarks.length ?? 0,
        normalizedItemCount: normalized?.items.length ?? 0,
        firstNormalizedItemExample: firstNormalizedItem ?? null,
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
        positionsParserDebug: (normalized as { debugExtra?: { positionsParserDebug?: unknown } })?.debugExtra?.positionsParserDebug ?? null,
        positionsRegressionCheck:
          normalized?.items != null && (normalized.items as unknown[]).length > 0
            ? (() => {
                const arr = normalized!.items as { posNr?: string; quantity?: string; unit?: string; shortText?: string; longText?: string }[];
                const first = arr[0];
                const hasRNoPart = (first?.posNr ?? "").trim().length > 0;
                const hasQty = (first?.quantity ?? "").trim().length > 0;
                const hasQU = (first?.unit ?? "").trim().length > 0;
                const hasText = ((first?.shortText ?? "").trim() + (first?.longText ?? "").trim()).length > 0;
                const ok = hasRNoPart && hasQty && hasQU && hasText;
                return {
                  ok,
                  positionCount: arr.length,
                  firstHasRNoPart: hasRNoPart,
                  firstHasQty: hasQty,
                  firstHasQU: hasQU,
                  firstHasText: hasText,
                  message: ok ? "ok" : [hasRNoPart ? null : "missing RNoPart", hasQty ? null : "missing Qty", hasQU ? null : "missing QU", hasText ? null : "missing text"].filter(Boolean).join("; "),
                };
              })()
            : null,
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
        cutIdx: vortextForPreview.length,
        method: parsed.meta.cutMethod ?? parsed.meta.parserUsed ?? "unknown",
        positionsStartsWith: positionsForPreview.slice(0, 260),
      };
    }

    return NextResponse.json(responsePayload);
  } catch (e: unknown) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[gaeb-preview] failed", e instanceof Error ? e.message : String(e));
    }
    return NextResponse.json(
      {
        error: "gaeb-preview failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Suchtext für den Tab „Positionen“ bei GAEB displayNodes: gleiche Filterung und
 * Feldreihenfolge wie in PositionenNodeView, damit Trefferzählung und Markierungen übereinstimmen.
 */

import { sanitizeForDisplay, stripTechnicalNoiseForDisplay } from "@/lib/displayText";
import type { GaebPreviewDisplayNode } from "@/lib/gaebPreviewModel";

/** Gleiche Filterlogik wie PositionenNodeView (keine Remarks, Gruppe nur mit nachfolgendem Item). */
export function filterDisplayNodesForPositionenTab(nodes: GaebPreviewDisplayNode[]): GaebPreviewDisplayNode[] {
  const result: GaebPreviewDisplayNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "group") {
      let hasItemAfter = false;
      for (let j = i + 1; j < nodes.length; j++) {
        const n = nodes[j];
        if (n.type === "group") break;
        if (n.type === "item") {
          hasItemAfter = true;
          break;
        }
      }
      if (hasItemAfter) result.push(node);
      continue;
    }
    if (node.type === "remark") continue;
    result.push(node);
  }
  return result;
}

export type PositionenHitPlacement = {
  hitIndex: number;
  itemVisualIndex: number | null;
  requiresExpandedLong: boolean;
};

function countMatchesInSegment(seg: string, escaped: string): number {
  if (!seg.trim()) return 0;
  const regex = new RegExp(escaped, "gi");
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(seg)) !== null) count++;
  return count;
}

/**
 * Reihenfolge: Gruppenzeile, dann pro Item posNr → shortText → mengeEinheit → longText
 * (identisch zur Darstellung / highlight-Reihenfolge in PositionenNodeView).
 */
export function computePositionenHitPlacements(
  nodes: GaebPreviewDisplayNode[],
  query: string
): PositionenHitPlacement[] {
  const q = query.trim();
  const placements: PositionenHitPlacement[] = [];
  if (!q) return placements;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filtered = filterDisplayNodesForPositionenTab(nodes);
  let itemVisualIndex = -1;
  let hitIndex = 0;

  for (const node of filtered) {
    if (node.type === "group") {
      const line = `${(node.posNr ?? "—")} ${(node.label ?? "").trim() || "(ohne Bezeichnung)"}`.trim();
      const seg = stripTechnicalNoiseForDisplay(sanitizeForDisplay(line));
      const n = countMatchesInSegment(seg, escaped);
      for (let i = 0; i < n; i++) {
        placements.push({ hitIndex: hitIndex++, itemVisualIndex: null, requiresExpandedLong: false });
      }
      continue;
    }
    if (node.type === "item") {
      itemVisualIndex += 1;
      const posNr = String(node.posNr ?? "").trim();
      const shortText = String(node.shortText ?? "").trim();
      const longText = String(node.longText ?? "").trim();
      const quantity = String(node.quantity ?? "").trim();
      const unit = String(node.unit ?? "").trim();
      const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();

      const fields: Array<{ text: string; requiresExpandedLong: boolean }> = [
        { text: posNr, requiresExpandedLong: false },
        { text: shortText, requiresExpandedLong: false },
        { text: mengeEinheit, requiresExpandedLong: false },
        { text: longText, requiresExpandedLong: longText.trim().length > 0 },
      ];

      for (const f of fields) {
        if (!f.text.trim()) continue;
        const seg = stripTechnicalNoiseForDisplay(sanitizeForDisplay(f.text));
        const n = countMatchesInSegment(seg, escaped);
        for (let i = 0; i < n; i++) {
          placements.push({
            hitIndex: hitIndex++,
            itemVisualIndex,
            requiresExpandedLong: f.requiresExpandedLong,
          });
        }
      }
    }
  }

  return placements;
}

export function countPositionenMatchesInDisplayNodes(nodes: GaebPreviewDisplayNode[], query: string): number {
  return computePositionenHitPlacements(nodes, query).length;
}

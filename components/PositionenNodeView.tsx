"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeForDisplay, stripTechnicalNoiseForDisplay } from "@/lib/displayText";
import {
  computePositionenHitPlacements,
  filterDisplayNodesForPositionenTab,
} from "@/lib/positionenSearch";
import type { GaebPreviewDisplayNode } from "@/lib/gaebPreviewModel";

function prepSearchSegment(raw: string): string {
  return stripTechnicalNoiseForDisplay(sanitizeForDisplay(raw));
}

export type PositionenNodeViewProps = {
  nodes: GaebPreviewDisplayNode[];
  maxHeight?: string;
  searchQuery?: string;
  /** Aktiver Treffer (0..n-1) für Scroll/Hervorhebung — wie Vorbemerkungen positionen-hit-* */
  activeHitIndex?: number;
  theme?: {
    textPrimary?: string;
    textSecondary?: string;
    cardBorder?: string;
    surfaceBg?: string;
    groupRowBg?: string;
    expandedRowBg?: string;
    groupAccentBorder?: string;
    controlAccent?: string;
    searchHighlightBg?: string;
    searchHighlightActiveOutline?: string;
  };
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(
  text: string,
  query: string,
  hitIdRef: React.MutableRefObject<number>,
  highlightStyle: React.CSSProperties,
  activeOutlineStyle: React.CSSProperties,
  activeHitIndex: number | undefined
): React.ReactNode[] {
  if (!query || !query.trim()) return [text];
  const escaped = escapeRegex(query.trim());
  const regex = new RegExp(escaped, "gi");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    parts.push(text.slice(lastIndex, m.index));
    const idx = hitIdRef.current++;
    const id = `positionen-hit-${idx}`;
    const isActive = activeHitIndex === idx;
    parts.push(
      <mark key={id} id={id} style={isActive ? { ...highlightStyle, ...activeOutlineStyle } : highlightStyle}>
        {m[0]}
      </mark>
    );
    lastIndex = regex.lastIndex;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Rendert den Tab „Positionen“ direkt aus displayNodes (group => Überschrift, remark => Hinweisblock, item => Zeile).
 * Suchtreffer: stabile IDs positionen-hit-0..n-1 (gleiche Reihenfolge wie Trefferzählung in score/page).
 */
export function PositionenNodeView({
  nodes,
  maxHeight = "420px",
  searchQuery,
  activeHitIndex,
  theme,
}: PositionenNodeViewProps) {
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
  const hitIdRef = useRef(0);
  if (searchQuery?.trim()) hitIdRef.current = 0;

  const textPrimary = theme?.textPrimary ?? "#0f172a";
  const textSecondary = theme?.textSecondary ?? "#475569";
  const cardBorder = theme?.cardBorder ?? "#e2e8f0";
  const surfaceBg = theme?.surfaceBg ?? "#fff";
  const groupRowBg = theme?.groupRowBg ?? "#f8fafc";
  const expandedRowBg = theme?.expandedRowBg ?? "#f8fafc";
  const groupAccentBorder = theme?.groupAccentBorder ?? textSecondary;
  const controlAccent = theme?.controlAccent;

  const highlightBg = theme?.searchHighlightBg ?? "#fef9c3";
  const highlightStyle: React.CSSProperties = {
    background: highlightBg,
    color: textPrimary,
    padding: "0 2px",
    borderRadius: 2,
  };
  const activeOutlineStyle: React.CSSProperties = {
    outline: `2px solid ${theme?.searchHighlightActiveOutline ?? "#ca8a04"}`,
    outlineOffset: 1,
    borderRadius: 3,
  };

  const placements = useMemo(
    () => computePositionenHitPlacements(nodes, searchQuery ?? ""),
    [nodes, searchQuery]
  );

  const q = searchQuery?.trim() ?? "";

  useEffect(() => {
    if (activeHitIndex == null || activeHitIndex < 0 || !q) return;
    const p = placements[activeHitIndex];
    if (p?.requiresExpandedLong && p.itemVisualIndex != null) {
      setExpandedItemIndex(p.itemVisualIndex);
    }
  }, [activeHitIndex, q, placements]);

  useEffect(() => {
    if (activeHitIndex == null || activeHitIndex < 0 || !q) return;
    const p = placements[activeHitIndex];
    if (!p) return;
    if (p.requiresExpandedLong && p.itemVisualIndex != null && expandedItemIndex !== p.itemVisualIndex) return;
    requestAnimationFrame(() => {
      document.getElementById(`positionen-hit-${activeHitIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [activeHitIndex, expandedItemIndex, q, placements]);

  const filteredNodes = useMemo(() => filterDisplayNodesForPositionenTab(nodes), [nodes]);

  let itemIndex = 0;
  return (
    <div
      style={{
        maxHeight,
        overflow: "auto",
        border: `1px solid ${cardBorder}`,
        borderRadius: 12,
        background: surfaceBg,
        color: textPrimary,
      }}
    >
      {filteredNodes.map((node, i) => {
        if (node.type === "group") {
          const line = `${(node.posNr ?? "—")} ${(node.label ?? "").trim() || "(ohne Bezeichnung)"}`.trim();
          const seg = prepSearchSegment(line);
          return (
            <div
              key={`g-${i}`}
              style={{
                padding: "10px 14px",
                marginTop: i === 0 ? 0 : 12,
                borderLeft: `4px solid ${groupAccentBorder}`,
                background: groupRowBg,
                fontWeight: 800,
                fontSize: 14,
                color: textPrimary,
              }}
            >
              {q && seg ? highlightMatches(seg, q, hitIdRef, highlightStyle, activeOutlineStyle, activeHitIndex) : line}
            </div>
          );
        }
        if (node.type === "item") {
          const idx = itemIndex++;
          const hasLong = (node.longText ?? "").trim().length > 0;
          const isExpanded = expandedItemIndex === idx;
          const posNr = String(node.posNr ?? "").trim();
          const shortText = String(node.shortText ?? "").trim();
          const quantity = String(node.quantity ?? "").trim();
          const unit = String(node.unit ?? "").trim();
          const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();
          const longText = String(node.longText ?? "").trim();
          const posSeg = prepSearchSegment(posNr);
          const shortSeg = prepSearchSegment(shortText);
          const mengeSeg = prepSearchSegment(mengeEinheit);
          const longSeg = prepSearchSegment(longText);

          return (
            <div key={`item-${i}`} style={{ borderBottom: `1px solid ${cardBorder}` }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 120px 32px",
                  gap: 10,
                  alignItems: "start",
                  padding: "8px 14px",
                  fontSize: 13,
                  color: textPrimary,
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {q && posSeg
                    ? highlightMatches(posSeg, q, hitIdRef, highlightStyle, activeOutlineStyle, activeHitIndex)
                    : posNr || "—"}
                </span>
                <span>
                  {q && shortSeg
                    ? highlightMatches(shortSeg, q, hitIdRef, highlightStyle, activeOutlineStyle, activeHitIndex)
                    : shortText || "—"}
                </span>
                <span style={{ textAlign: "right" }}>
                  {q && mengeSeg
                    ? highlightMatches(mengeSeg, q, hitIdRef, highlightStyle, activeOutlineStyle, activeHitIndex)
                    : mengeEinheit || "—"}
                </span>
                <span>
                  {hasLong ? (
                    <button
                      type="button"
                      onClick={() => setExpandedItemIndex(isExpanded ? null : idx)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontWeight: 800,
                        padding: 0,
                        fontSize: 12,
                        color: controlAccent ?? textPrimary,
                      }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  ) : null}
                </span>
              </div>
              {hasLong && isExpanded && (
                <div
                  style={{
                    padding: "8px 14px 12px",
                    background: expandedRowBg,
                    fontSize: 12,
                    color: textSecondary,
                    whiteSpace: "pre-wrap",
                    borderTop: `1px solid ${cardBorder}`,
                  }}
                >
                  {q && longSeg
                    ? highlightMatches(longSeg, q, hitIdRef, highlightStyle, activeOutlineStyle, activeHitIndex)
                    : longText}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

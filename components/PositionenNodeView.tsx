"use client";

import React, { useState } from "react";
import type { GaebPreviewDisplayNode } from "@/lib/gaebPreviewModel";

export type PositionenNodeViewProps = {
  nodes: GaebPreviewDisplayNode[];
  maxHeight?: string;
  searchQuery?: string;
  theme?: {
    textPrimary?: string;
    textSecondary?: string;
    cardBorder?: string;
    surfaceBg?: string;
    groupRowBg?: string;
    expandedRowBg?: string;
    groupAccentBorder?: string;
    controlAccent?: string;
  };
};

/**
 * Rendert den Tab „Positionen“ direkt aus displayNodes (group => Überschrift, remark => Hinweisblock, item => Zeile).
 * Keine Text-Zwischenstufe – Gruppenüberschriften bleiben sichtbar.
 */
export function PositionenNodeView({ nodes, maxHeight = "420px", searchQuery, theme }: PositionenNodeViewProps) {
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
  const textPrimary = theme?.textPrimary ?? "#0f172a";
  const textSecondary = theme?.textSecondary ?? "#475569";
  const cardBorder = theme?.cardBorder ?? "#e2e8f0";
  const surfaceBg = theme?.surfaceBg ?? "#fff";
  const groupRowBg = theme?.groupRowBg ?? "#f8fafc";
  const expandedRowBg = theme?.expandedRowBg ?? "#f8fafc";
  const groupAccentBorder = theme?.groupAccentBorder ?? textSecondary;
  const controlAccent = theme?.controlAccent;

  // Nur echte Positionsinhalte anzeigen:
  // - Gruppenüberschriften nur, wenn danach mindestens ein Item folgt
  // - Remark-Knoten vollständig aus der Positionssicht entfernen (gehören zu Vorbemerkungen/Kontext).
  const filteredNodes = (() => {
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
      if (node.type === "remark") {
        // Remark-Only-Inhalte nicht im Tab „Positionen“ anzeigen.
        continue;
      }
      // Items immer übernehmen.
      result.push(node);
    }
    return result;
  })();

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
              {(node.posNr ?? "—")} {(node.label ?? "").trim() || "(ohne Bezeichnung)"}
            </div>
          );
        }
        if (node.type === "remark") {
          return (
            <div
              key={`r-${i}`}
              style={{
                padding: "10px 14px",
                marginTop: 6,
                background: expandedRowBg,
                borderRadius: 8,
                fontSize: 13,
                color: textPrimary,
                whiteSpace: "pre-wrap",
              }}
            >
              {node.text ?? ""}
            </div>
          );
        }
        if (node.type === "item") {
          const idx = itemIndex++;
          const hasLong = (node.longText ?? "").trim().length > 0;
          const isExpanded = expandedItemIndex === idx;
          return (
            <div key={`item-${i}`} style={{ borderBottom: `1px solid ${cardBorder}` }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 70px 50px 32px",
                  gap: 10,
                  alignItems: "start",
                  padding: "8px 14px",
                  fontSize: 13,
                  color: textPrimary,
                }}
              >
                <span style={{ fontWeight: 700 }}>{node.posNr ?? "—"}</span>
                <span>{node.shortText ?? "—"}</span>
                <span style={{ textAlign: "right" }}>{node.quantity ?? "—"}</span>
                <span>{node.unit ?? "—"}</span>
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
                  {node.longText}
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

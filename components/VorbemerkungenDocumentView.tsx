"use client";

import React, { useRef } from "react";
import { sanitizeForDisplay, stripTechnicalNoiseForDisplay, toParagraphs } from "@/lib/displayText";

/** Zeile, die mit Abschnittsnummer (0.1, 0.1.1, 1.2.3) beginnt. */
const SECTION_NUMBER_LINE = /^(\d+(?:\.\d+)*)\s+(.+)$/;
/** Label:Wert-Zeile (Label bis 60 Zeichen, dann Doppelpunkt, Wert). Reihenfolge im Dokument unverändert. */
const LABEL_VALUE_LINE = /^([^:]{1,60}):\s*(.*)$/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Teilt Text an Suchtreffern und gibt React-Node-Array zurück (Treffer als <mark>). Reihenfolge unverändert. */
function highlightMatches(
  text: string,
  query: string,
  getNextId: () => string,
  highlightStyle: React.CSSProperties
): React.ReactNode[] {
  if (!query || !query.trim()) return [text];
  const escaped = escapeRegex(query.trim());
  const regex = new RegExp(escaped, "gi");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    parts.push(text.slice(lastIndex, m.index));
    const id = getNextId();
    parts.push(
      <mark key={id} id={id} style={highlightStyle}>
        {m[0]}
      </mark>
    );
    lastIndex = regex.lastIndex;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}

export type VorbemerkungenDocumentViewProps = {
  content: string;
  maxHeight?: string;
  /** Suchbegriff – durchsucht den angezeigten (bereinigten) Text, Treffer werden hervorgehoben. */
  searchQuery?: string;
  /** "positionen" = dokumentenartige Positionenansicht (gleiche Struktur, bessere Lesbarkeit). */
  variant?: "vorbemerkungen" | "positionen";
  theme?: {
    textPrimary?: string;
    textSecondary?: string;
    cardBorder?: string;
  };
};

/**
 * Zeigt Vorbemerkungen/Vortext als dokumentenartige Lesansicht.
 * Nur Darstellung: Reihenfolge und Struktur des Dokuments bleiben exakt erhalten.
 * - Abschnittsnummern und Label:Wert-Zeilen werden visuell hervorgehoben, bleiben an derselben Stelle.
 * - Keine Umgruppierung, keine neuen Container, keine Metadaten-Auslagerung.
 */
export function VorbemerkungenDocumentView({
  content,
  maxHeight = "480px",
  searchQuery,
  variant = "vorbemerkungen",
  theme,
}: VorbemerkungenDocumentViewProps) {
  const cleaned = sanitizeForDisplay(content);
  const withoutNoise = stripTechnicalNoiseForDisplay(cleaned);
  const paragraphs = toParagraphs(withoutNoise);

  const hitIdRef = useRef(0);
  if (searchQuery?.trim()) hitIdRef.current = 0;
  const hitIdPrefix = variant === "positionen" ? "positionen-hit" : "vorbemerkungen-hit";
  const getNextHitId = () => `${hitIdPrefix}-${hitIdRef.current++}`;

  const textPrimary = theme?.textPrimary ?? "#0f172a";
  const textSecondary = theme?.textSecondary ?? "#475569";
  const cardBorder = theme?.cardBorder ?? "#e2e8f0";
  const isPositionen = variant === "positionen";

  const highlightStyle: React.CSSProperties = isPositionen
    ? {
        background: "#e2e8f0",
        color: textPrimary,
        padding: "0 2px",
        borderRadius: 3,
      }
    : {
        background: "#fef9c3",
        color: textPrimary,
        padding: "0 2px",
        borderRadius: 2,
      };

  const documentContainerStyle: React.CSSProperties = isPositionen
    ? {
        maxWidth: "58ch",
        margin: "0 auto",
        padding: "32px 40px",
        lineHeight: 1.78,
        fontSize: 15,
        color: textPrimary,
        letterSpacing: "0.012em",
      }
    : {
        maxWidth: "65ch",
        margin: "0 auto",
        padding: "28px 32px",
        lineHeight: 1.7,
        fontSize: 15,
        color: textPrimary,
        letterSpacing: "0.01em",
      };

  const baseParagraphStyle: React.CSSProperties = isPositionen
    ? { margin: "0 0 1.4em", whiteSpace: "pre-wrap" }
    : { margin: "0 0 1.25em", whiteSpace: "pre-wrap" };

  const sectionHeadingStyle: React.CSSProperties = isPositionen
    ? {
        margin: "1.6em 0 0.5em",
        fontSize: 15,
        fontWeight: 700,
        color: textPrimary,
        letterSpacing: "0.02em",
        paddingBottom: "0.25em",
      }
    : {
        margin: "1.5em 0 0.6em",
        fontSize: 15,
        fontWeight: 700,
        color: textPrimary,
        letterSpacing: "0.02em",
      };

  const labelValueLineStyle: React.CSSProperties = isPositionen
    ? { margin: "0.4em 0", display: "flex", flexWrap: "wrap", gap: "0.4em", alignItems: "baseline" }
    : { margin: "0.35em 0", display: "flex", flexWrap: "wrap", gap: "0.35em", alignItems: "baseline" };

  const labelStyle: React.CSSProperties = isPositionen
    ? { fontWeight: 600, color: textSecondary, flexShrink: 0, fontSize: "0.98em" }
    : { fontWeight: 600, color: textSecondary, flexShrink: 0 };

  const valueStyle: React.CSSProperties = {
    color: textPrimary,
    fontWeight: 400,
  };

  const emptyMessage = isPositionen ? "Keine Positionen vorhanden." : "Keine Vorbemerkungen vorhanden.";

  if (!withoutNoise.trim()) {
    return (
      <div
        style={{
          padding: 32,
          color: textSecondary,
          fontSize: 15,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  function renderParagraph(p: string, key: string) {
    const lines = p.split("\n");
    if (lines.length === 0) return null;

    const blocks: React.ReactNode[] = [];
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        blocks.push(<div key={`${key}-${lineIdx}`} style={{ height: isPositionen ? "0.75em" : "0.6em" }} />);
        return;
      }
      const sectionMatch = trimmed.match(SECTION_NUMBER_LINE);
      if (sectionMatch) {
        blocks.push(
          <div key={`${key}-${lineIdx}`} style={sectionHeadingStyle}>
            <span style={{ color: textSecondary, fontWeight: 600, marginRight: 8 }}>{sectionMatch[1]}</span>
            {searchQuery ? highlightMatches(sectionMatch[2], searchQuery, getNextHitId, highlightStyle) : sectionMatch[2]}
          </div>
        );
        return;
      }
      const labelMatch = trimmed.match(LABEL_VALUE_LINE);
      if (labelMatch && labelMatch[2].length < 200) {
        const valuePart = labelMatch[2] ? `: ${labelMatch[2]}` : "";
        blocks.push(
          <div key={`${key}-${lineIdx}`} style={labelValueLineStyle}>
            <span style={labelStyle}>{searchQuery ? highlightMatches(labelMatch[1].trim(), searchQuery, getNextHitId, highlightStyle) : labelMatch[1].trim()}</span>
            <span style={valueStyle}>{searchQuery ? highlightMatches(valuePart, searchQuery, getNextHitId, highlightStyle) : valuePart}</span>
          </div>
        );
        return;
      }
      blocks.push(
        <div key={`${key}-${lineIdx}`} style={baseParagraphStyle}>
          {searchQuery ? highlightMatches(trimmed, searchQuery, getNextHitId, highlightStyle) : trimmed}
        </div>
      );
    });

    return <div key={key}>{blocks}</div>;
  }

  const outerStyle: React.CSSProperties = isPositionen
    ? {
        overflow: "auto",
        maxHeight,
        borderRadius: 10,
        border: `1px solid ${cardBorder}`,
        background: "#fafbfc",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }
    : {
        overflow: "auto",
        maxHeight,
        borderRadius: 12,
        border: `1px solid ${cardBorder}`,
        background: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      };

  return (
    <div style={outerStyle}>
      <div style={documentContainerStyle}>
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => renderParagraph(p, `p-${i}`))
        ) : (
          <p style={baseParagraphStyle}>{withoutNoise}</p>
        )}
      </div>
    </div>
  );
}

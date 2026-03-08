"use client";

import { sanitizeForDisplay, toParagraphs } from "@/lib/displayText";

export type LesansichtProps = {
  /** Roher Inhalt (wird bereinigt und als Dokument dargestellt). */
  content: string;
  /** Optionale CSS-Klasse. */
  className?: string;
  /** Max. Höhe mit Scroll (z. B. "320px"). */
  maxHeight?: string;
  /** Design-Tokens für Kundenroute (optional). */
  styles?: {
    textPrimary?: string;
    textSecondary?: string;
    sectionTitle?: React.CSSProperties;
    paragraph?: React.CSSProperties;
  };
};

/**
 * Präsentationskomponente: Zeigt Text als lesbare Dokumentansicht.
 * Entfernt HTML/XML, erhält Absätze und Zeilenumbrüche.
 * Keine Fachlogik – nur Darstellung.
 */
export function Lesansicht({
  content,
  className,
  maxHeight = "320px",
  styles: customStyles,
}: LesansichtProps) {
  const cleaned = sanitizeForDisplay(content);
  const paragraphs = toParagraphs(cleaned);

  const textPrimary = customStyles?.textPrimary ?? "#0f172a";
  const textSecondary = customStyles?.textSecondary ?? "#475569";
  const sectionTitle = customStyles?.sectionTitle ?? {
    fontSize: 13,
    fontWeight: 700,
    color: textSecondary,
    marginBottom: 12,
  };
  const paragraphStyle: React.CSSProperties = customStyles?.paragraph ?? {
    margin: "0 0 1em",
    fontSize: 14,
    lineHeight: 1.6,
    color: textPrimary,
    whiteSpace: "pre-wrap",
  };

  if (!cleaned) {
    return (
      <div
        className={className}
        style={{ color: textSecondary, fontSize: 13, fontStyle: "italic" }}
      >
        Kein Inhalt.
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        overflow: "auto",
        maxHeight,
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      {paragraphs.length > 0 ? (
        paragraphs.map((p, i) => (
          <p key={i} style={paragraphStyle}>
            {p}
          </p>
        ))
      ) : (
        <p style={paragraphStyle}>{cleaned}</p>
      )}
    </div>
  );
}

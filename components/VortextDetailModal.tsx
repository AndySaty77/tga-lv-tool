"use client";

import { sanitizeForDisplay, toParagraphs } from "@/lib/displayText";
import { formatEvidenceModalBody, normalizeEvidenceDisplayString } from "@/lib/evidenceSnippet";

export type VortextDetailModalProps = {
  /** Titel der Detailansicht (z. B. Risikotyp + Stufe). */
  title: string;
  /** Optionaler Kurztext / Teaser (wird unter dem Titel angezeigt). */
  shortText?: string;
  /** Vollständiger Langtext (Absätze werden formatiert). */
  longText: string;
  /** Optionale Interpretation (unter dem Langtext). */
  interpretation?: string;
  onClose: () => void;
  /** Design-Tokens für Kundenroute (optional). */
  theme?: {
    primary?: string;
    textPrimary?: string;
    textSecondary?: string;
    cardBg?: string;
    cardBorder?: string;
  };
};

/**
 * Modal für Vortext-/Hinweistext-Detailansicht.
 * Nur Darstellung – keine Fachlogik.
 * B2B, ruhig, lesbar.
 */
export function VortextDetailModal({
  title,
  shortText,
  longText,
  interpretation,
  onClose,
  theme,
}: VortextDetailModalProps) {
  const cleaned = formatEvidenceModalBody(sanitizeForDisplay(longText));
  const paragraphs = toParagraphs(cleaned);
  const textPrimary = theme?.textPrimary ?? "#0f172a";
  const textSecondary = theme?.textSecondary ?? "#475569";
  const cardBg = theme?.cardBg ?? "#ffffff";
  const cardBorder = theme?.cardBorder ?? "#e2e8f0";

  const paragraphStyle: React.CSSProperties = {
    margin: "0 0 1em",
    fontSize: 15,
    lineHeight: 1.65,
    color: textPrimary,
    whiteSpace: "pre-wrap",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vortext-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(15, 23, 42, 0.4)",
        boxSizing: "border-box",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: cardBg,
          borderRadius: 16,
          border: `1px solid ${cardBorder}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: "20px 24px",
            borderBottom: `1px solid ${cardBorder}`,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h2
              id="vortext-detail-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: textPrimary,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h2>
            {shortText && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  color: textSecondary,
                  lineHeight: 1.5,
                }}
              >
                {normalizeEvidenceDisplayString(sanitizeForDisplay(shortText))}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              padding: 0,
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color: textSecondary,
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Body: Langtext */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 24px",
          }}
        >
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} style={paragraphStyle}>
                {p}
              </p>
            ))
          ) : (
            <p style={paragraphStyle}>{cleaned || "—"}</p>
          )}

          {interpretation && sanitizeForDisplay(interpretation).trim() && (
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                }}
              >
                Interpretation
              </div>
              <p style={{ ...paragraphStyle, marginBottom: 0 }}>
                {sanitizeForDisplay(interpretation)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

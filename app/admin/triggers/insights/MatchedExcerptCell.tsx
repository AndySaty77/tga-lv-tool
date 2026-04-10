"use client";

import { useMemo, useState } from "react";

/** Risikoarme Dekodierung gängiger HTML-Entities für Lesbarkeit (nur Anzeige, kein HTML-Parsing). */
function decodeHtmlEntities(s: string): string {
  let t = s.replace(/&nbsp;/gi, " ");
  t = t.replace(/&#x([0-9a-f]{1,6});/gi, (full, hex) => {
    const cp = parseInt(hex, 16);
    if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return full;
    try {
      return String.fromCodePoint(cp);
    } catch {
      return full;
    }
  });
  t = t.replace(/&#(\d{1,7});/g, (full, dec) => {
    const cp = parseInt(dec, 10);
    if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return full;
    try {
      return String.fromCodePoint(cp);
    } catch {
      return full;
    }
  });
  t = t.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#0*39;/g, "'").replace(/&apos;/gi, "'");
  t = t.replace(/&amp;/g, "&");
  return t;
}

function normalizeExcerpt(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return "";
  const decoded = decodeHtmlEntities(String(raw));
  return decoded
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

const clampBoxStyle: React.CSSProperties = {
  whiteSpace: "normal",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  lineHeight: 1.45,
  fontSize: 13,
  color: "#222",
};

const toggleStyle: React.CSSProperties = {
  marginTop: 4,
  padding: 0,
  border: "none",
  background: "none",
  color: "#1565c0",
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
  fontFamily: "inherit",
};

type Props = {
  text: string | null;
};

const PREVIEW_MAX_CHARS = 72;

function previewExcerpt(full: string): { preview: string; needsMore: boolean } {
  if (full.length <= PREVIEW_MAX_CHARS) return { preview: full, needsMore: false };
  let cut = full.slice(0, PREVIEW_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 36) cut = cut.slice(0, lastSpace);
  return { preview: `${cut.trimEnd()}…`, needsMore: true };
}

/** Standard: kurzer Ausschnitt; „Volltext“ ausklappbar mit Scroll bei langen Excerpts (nur Anzeige). */
export function MatchedExcerptCell({ text }: Props) {
  const [expanded, setExpanded] = useState(false);
  const normalized = useMemo(() => normalizeExcerpt(text), [text]);

  if (!normalized) {
    return <span style={{ color: "#999" }}>—</span>;
  }

  const { preview, needsMore } = previewExcerpt(normalized);

  return (
    <div style={{ maxWidth: 320 }}>
      {expanded ? (
        <div
          style={{
            ...clampBoxStyle,
            maxHeight: 220,
            overflowY: "auto",
            padding: "6px 8px",
            background: "#fafafa",
            borderRadius: 6,
            border: "1px solid #e0e0e0",
          }}
        >
          {normalized}
        </div>
      ) : (
        <div style={{ ...clampBoxStyle, whiteSpace: "normal" }} title={needsMore ? normalized : undefined}>
          {preview}
        </div>
      )}
      {needsMore && (
        <button type="button" style={toggleStyle} onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? "Kürzer anzeigen" : "Volltext anzeigen"}
        </button>
      )}
    </div>
  );
}

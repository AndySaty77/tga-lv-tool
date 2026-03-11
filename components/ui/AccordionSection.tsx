"use client";

import React from "react";
import { colors, spacing, radius } from "@/lib/ui/theme";

type AccordionSectionProps = {
  /** Titel der Sektion (klickbar) */
  title: React.ReactNode;
  /** Inhalt (bei open gerendert) */
  children: React.ReactNode;
  /** Gestartet offen oder zu */
  defaultOpen?: boolean;
  /** Kontrolliert (controlled) */
  open?: boolean;
  /** Callback bei Toggle (für controlled) */
  onToggle?: (open: boolean) => void;
  /** Farbe des Titels / Pfeils */
  accentColor?: string;
  /** Kein unterer Rand beim Titel */
  noBorder?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Einklappbare Sektion: klickbarer Header mit Pfeil, Inhalt darunter.
 * Nur Präsentation – State optional controlled.
 */
export function AccordionSection({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  accentColor = colors.primary,
  noBorder = false,
  className = "",
  style = {},
}: AccordionSectionProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleClick = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={className} style={{ marginTop: spacing[4], ...style }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: `${spacing[2]} 0`,
          background: "none",
          border: "none",
          borderBottom: noBorder ? "none" : `1px solid ${colors.border}`,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.875rem",
          color: colors.text,
          textAlign: "left",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = accentColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.text;
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: spacing[3], paddingTop: spacing[2] }}>
          {children}
        </div>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { spacing, radius } from "@/lib/ui/theme";

const MAX_WIDTH = "1280px";
const PADDING_X = spacing[6];
const PADDING_Y = spacing[6];

type PageShellProps = {
  children: React.ReactNode;
  /** Optionale max-width (default 1280px) */
  maxWidth?: string;
  /** Weniger seitlicher Abstand auf kleinen Screens */
  compact?: boolean;
  className?: string;
};

/**
 * Zentrale Layoutstruktur für Seiten: max-width, konsistente Abstände.
 * Nur Präsentation – keine Business-Logik.
 */
export function PageShell({
  children,
  maxWidth = MAX_WIDTH,
  compact = false,
  className = "",
}: PageShellProps) {
  const paddingX = compact ? spacing[4] : PADDING_X;
  const paddingY = compact ? spacing[4] : PADDING_Y;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth,
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: paddingX,
        paddingRight: paddingX,
        paddingTop: paddingY,
        paddingBottom: paddingY,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

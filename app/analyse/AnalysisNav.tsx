import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";

/**
 * Kompakte obere Navigation für die Analyse-Seite: Zur App, Zur Website, Account.
 * Keine App-Shell, nur klare Rückwege – passt zum Dark-Design der Analyse.
 */
export function AnalysisNav() {
  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: T.muted,
    textDecoration: "none",
    padding: "6px 12px",
    borderRadius: T.radiusSm,
  };

  return (
    <nav
      aria-label="Navigation Analyse"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        padding: `${T.space.sm}px ${T.space.xl}px`,
        background: T.sidebarBg,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <Link
        href="/app"
        style={{
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: T.text,
          textDecoration: "none",
        }}
      >
        TGA LV Tool
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <Link href="/app" style={linkStyle}>
          Zur App
        </Link>
        <Link href="/" style={linkStyle}>
          Zur Website
        </Link>
        <Link href="/app/settings" style={linkStyle}>
          Account
        </Link>
      </div>
    </nav>
  );
}

"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { appTheme as T } from "./appTheme";

const pathToTitle: Record<string, string> = {
  "/app": "Dashboard",
  "/app/analysen": "Analysen",
  "/app/settings": "Settings",
  "/app/billing": "Billing",
};

function getPageTitle(pathname: string): string {
  if (pathname in pathToTitle) return pathToTitle[pathname];
  if (pathname.startsWith("/app/analysen/")) return "Ergebnis";
  return "App";
}

export function AppHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${T.space.sm}px 0 ${T.space.lg}px`,
        marginBottom: T.space.md,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: T.space.sm,
          padding: `${T.space.xs}px ${T.space.sm}px`,
          borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`,
          background: "rgba(255,255,255,0.03)",
          fontSize: 13,
          fontWeight: 600,
          color: T.muted,
        }}
      >
        Account
      </div>
    </header>
  );
}

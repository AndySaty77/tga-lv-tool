"use client";

import React from "react";
import Link from "next/link";
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
  const [menuOpen, setMenuOpen] = React.useState(false);

  const toggleMenu = () => setMenuOpen((v) => !v);
  const closeMenu = () => setMenuOpen(false);

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
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={toggleMenu}
          style={{
            display: "flex",
            alignItems: "center",
            gap: T.space.xs,
            padding: `${T.space.xs}px ${T.space.sm}px`,
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            background: "rgba(255,255,255,0.03)",
            fontSize: 13,
            fontWeight: 600,
            color: T.muted,
            cursor: "pointer",
          }}
        >
          <span>Account</span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>{menuOpen ? "▲" : "▼"}</span>
        </button>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              marginTop: 6,
              minWidth: 160,
              borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`,
              background: T.card,
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              padding: 4,
              zIndex: 30,
            }}
          >
            <Link
              href="/app/settings"
              onClick={closeMenu}
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: T.radiusSm,
                fontSize: 13,
                color: T.text,
                textDecoration: "none",
              }}
            >
              Settings
            </Link>
            <Link
              href="/app/logout"
              onClick={closeMenu}
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: T.radiusSm,
                fontSize: 13,
                color: "#fecaca",
                textDecoration: "none",
              }}
            >
              Logout
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

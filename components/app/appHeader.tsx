"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appTheme as T } from "./appTheme";

const pathToTitle: Record<string, string> = {
  "/app": "Dashboard",
  "/app/analyse": "Analyse",
  "/app/analysen": "Analysen",
  "/app/settings": "Settings",
  "/app/billing": "Billing",
};

const publicLinks = [
  { href: "/", label: "Zur Website" },
  { href: "/pricing", label: "Preise" },
  { href: "/docs", label: "Docs" },
  { href: "/features", label: "Features" },
  { href: "/faq", label: "FAQ" },
] as const;

function getPageTitle(pathname: string): string {
  if (pathname in pathToTitle) return pathToTitle[pathname];
  if (pathname === "/app/analyse") return "Analyse";
  if (pathname.startsWith("/app/analysen/")) return "Ergebnis";
  return "App";
}

const linkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: T.muted,
  textDecoration: "none",
  padding: "4px 8px",
  borderRadius: T.radiusSm,
};

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
        flexWrap: "wrap",
        gap: T.space.sm,
        padding: `${T.space.sm}px 0 ${T.space.lg}px`,
        marginBottom: T.space.md,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <nav
        aria-label="Zur öffentlichen Website"
        className="app-header-public-nav"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        {publicLinks.map(({ href, label }) => (
          <Link key={href} href={href} style={linkStyle} className="app-header-public-link">
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ position: "relative", flexShrink: 0 }}>
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
              minWidth: 180,
              borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`,
              background: T.card,
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              padding: 4,
              zIndex: 30,
            }}
          >
            <Link
              href="/"
              onClick={closeMenu}
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: T.radiusSm,
                fontSize: 13,
                color: T.muted,
                textDecoration: "none",
              }}
            >
              Zur Website
            </Link>
            <Link
              href="/pricing"
              onClick={closeMenu}
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: T.radiusSm,
                fontSize: 13,
                color: T.muted,
                textDecoration: "none",
              }}
            >
              Preise
            </Link>
            <Link
              href="/docs"
              onClick={closeMenu}
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: T.radiusSm,
                fontSize: 13,
                color: T.muted,
                textDecoration: "none",
              }}
            >
              Docs
            </Link>
            <div style={{ height: 1, background: T.border, margin: "4px 6px" }} />
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
                color: T.danger,
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

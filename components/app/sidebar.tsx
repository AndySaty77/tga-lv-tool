"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderSearch, Settings, CreditCard } from "lucide-react";
import { appTheme as T } from "./appTheme";

const navItems = [
  { href: "/app", label: "Dashboard", icon: BarChart3 },
  { href: "/app/analysen", label: "Analysen", icon: FolderSearch },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        boxSizing: "border-box",
        width: "100%",
        minWidth: 248,
        height: "100%",
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        padding: T.space.lg,
        display: "flex",
        flexDirection: "column",
        gap: T.space.md,
      }}
    >
      <div style={{ marginBottom: T.space.sm }}>
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
        <div style={{ fontSize: 11, fontWeight: 600, color: T.faint, marginTop: 2, letterSpacing: "0.04em" }}>
          App-Bereich
        </div>
      </div>

      <nav aria-label="App-Navigation" style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/app" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: `${T.space.sm}px ${T.space.md}px`,
                borderRadius: T.radiusSm,
                fontSize: 13,
                fontWeight: 600,
                color: isActive ? T.text : T.muted,
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                border: `1px solid ${isActive ? T.borderHover : "transparent"}`,
                textDecoration: "none",
              }}
              className="app-sidebar-link"
            >
              <Icon size={18} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.8 }} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: T.space.sm, marginTop: T.space.sm }}>
        <Link
          href="/"
          style={{
            display: "block",
            padding: `${T.space.sm}px ${T.space.md}px`,
            borderRadius: T.radiusSm,
            fontSize: 12,
            fontWeight: 600,
            color: T.faint,
            textDecoration: "none",
          }}
          className="app-sidebar-link"
        >
          Zur Website
        </Link>
      </div>
    </aside>
  );
}

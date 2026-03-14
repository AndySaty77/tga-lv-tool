"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AppSidebar } from "@/components/app/sidebar";
import { AppHeader } from "@/components/app/appHeader";
import { appTheme as T } from "@/components/app/appTheme";

const SIDEBAR_WIDTH = 248;
const BREAKPOINT = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  return (
    <>
      {/* Mobile-Topbar: nur unter 768px sichtbar, oben, links Logo / rechts Hamburger + Account */}
      <div
        className="app-mobile-topbar"
        style={{
            position: "sticky",
            top: 0,
            zIndex: 25,
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${T.space.sm}px ${T.space.md}px`,
            minHeight: 52,
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
        <div style={{ display: "flex", alignItems: "center", gap: T.space.sm }}>
          <Link
            href="/app/settings"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.muted,
              textDecoration: "none",
              padding: `${T.space.xs}px ${T.space.sm}px`,
              borderRadius: T.radiusSm,
            }}
          >
            Account
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menü öffnen"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              padding: 0,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              background: "rgba(255,255,255,0.05)",
              color: T.text,
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Backdrop wenn Drawer offen (nur auf kleinen Screens, wo Sidebar Overlay ist) */}
      {drawerOpen && !isDesktop && (
        <div
          className="app-drawer-backdrop"
          role="presentation"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}

      {/* Sidebar: Desktop = im Layout, Mobile = Overlay (Drawer, Steuerung per CSS + app-drawer-open) */}
      <div
        className={`app-sidebar-wrapper${drawerOpen ? " app-drawer-open" : ""}`}
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          flexShrink: 0,
        }}
      >
        <AppSidebar />
        {drawerOpen && !isDesktop && (
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "absolute",
              top: T.space.sm,
              right: T.space.sm,
              width: 32,
              height: 32,
              padding: 0,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              background: "rgba(255,255,255,0.06)",
              color: T.muted,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Main Content: rechte Spalte auf Desktop, volle Breite auf Mobile */}
      <div className="app-main-wrapper">
        <main style={{ flex: 1, padding: T.space.xl }}>
          <AppHeader />
          {children}
        </main>
      </div>
    </>
  );
}

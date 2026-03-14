"use client";

import Link from "next/link";
import React from "react";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "./MarketingTheme";
import { useSessionClient } from "@/lib/auth/use-session-client";

/** Echtes LV-Scope-Logo: public/brand/lv-scope-logo.png. Bei viel transparentem Rand in der PNG wirkt es trotz CSS-Höhe kleiner – dann PNG zuschneiden oder separates Header-Logo-Asset nutzen. */
const LOGO_SRC = "/brand/lv-scope-logo.png";

const linkStyle: React.CSSProperties = {
  color: T.muted,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.01em",
  padding: "8px 10px",
  borderRadius: 10,
};

export function MarketingNav({ active }: { active?: string }) {
  const isLoggedIn = useSessionClient();
  const isActive = (href: string) => (active ? active === href : false);
  const showZurApp = isLoggedIn === true;

  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      setIsMobile(window.innerWidth <= 800);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const item = (href: string, label: string) => (
    <Link
      href={href}
      style={{
        ...linkStyle,
        color: isActive(href) ? T.text : T.muted,
        background: isActive(href) ? "rgba(255,255,255,0.07)" : "transparent",
        border: isActive(href) ? `1px solid ${T.border}` : "1px solid transparent",
      }}
    >
      {label}
    </Link>
  );

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(10, 14, 26, 0.88)",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {/* Desktop-Header */}
      <div
        className="marketing-nav-desktop"
        style={{
          display: isMobile ? "none" : "block",
        }}
      >
        <Container style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 88, paddingTop: 14, paddingBottom: 14, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 280, flexShrink: 0 }}>
            <Link href="/" style={{ display: "block", lineHeight: 0, flexShrink: 0 }} title="LV Scope – Startseite">
              <img
                src={LOGO_SRC}
                alt="LV Scope"
                width={400}
                height={110}
                style={{ display: "block", height: 72, width: "auto", minHeight: 72, objectFit: "contain", objectPosition: "left center" }}
              />
            </Link>
            <span style={{ color: T.faint, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", whiteSpace: "nowrap", flexShrink: 1, borderLeft: `1px solid ${T.border}`, paddingLeft: 18, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>KI-gestützte LV-/GAEB-Analyse</span>
          </div>

          <nav aria-label="Produktseiten" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {item("/features", "Features")}
            {item("/how-it-works", "Ablauf")}
            {item("/pricing", "Preise")}
            {item("/faq", "FAQ")}
            {item("/docs", "Docs")}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, justifyContent: "flex-end", flexShrink: 1 }}>
            {showZurApp ? (
              <Link
                href="/app"
                style={{
                  ...linkStyle,
                  color: T.muted,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                }}
              >
                Zur App
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  ...linkStyle,
                  color: T.muted,
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                }}
              >
                Login
              </Link>
            )}
            <Link
              href="/app/analyse"
              style={{
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
                color: "#020617",
                padding: "10px 12px",
                borderRadius: 12,
                background: T.brand,
                border: "1px solid transparent",
              }}
            >
              Zur Analyse
            </Link>
          </div>
        </Container>
      </div>

      {/* Mobile-Header */}
      <div
        className="marketing-nav-mobile"
        style={{
          display: isMobile ? "block" : "none",
        }}
      >
        <Container
          style={{
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 68,
            paddingTop: 10,
            paddingBottom: 10,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", minWidth: 180, flexShrink: 0 }}>
            <Link href="/" style={{ display: "block", lineHeight: 0, flexShrink: 0 }} onClick={closeMenu} title="LV Scope – Startseite">
              <img
                src={LOGO_SRC}
                alt="LV Scope"
                width={340}
                height={94}
                style={{ display: "block", height: 48, width: "auto", minHeight: 48, objectFit: "contain", objectPosition: "left center" }}
              />
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
            <Link
              href="/app/analyse"
              style={{
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 800,
                color: "#020617",
                padding: "8px 10px",
                borderRadius: 999,
                background: T.brand,
                border: "1px solid transparent",
              }}
              onClick={closeMenu}
            >
              Zur Analyse
            </Link>

            <button
              type="button"
              onClick={toggleMenu}
              aria-label="Hauptmenü öffnen"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: "rgba(15,23,42,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 2,
                  borderRadius: 999,
                  background: T.text,
                  boxShadow: "0 -4px 0 0 currentColor, 0 4px 0 0 currentColor",
                }}
              />
            </button>
          </div>
        </Container>

        {isMenuOpen && (
          <div
            style={{
              borderTop: `1px solid ${T.border}`,
              borderBottom: `1px solid ${T.border}`,
              background: "rgba(11,18,32,0.98)",
            }}
          >
            <Container>
              <nav
                aria-label="Hauptmenü"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 0 8px",
                }}
              >
                {item("/features", "Features")}
                {item("/how-it-works", "Ablauf")}
                {item("/pricing", "Preise")}
                {item("/faq", "FAQ")}
                {item("/docs", "Docs")}

                <div style={{ height: 1, background: T.border, margin: "6px 0" }} />

                {showZurApp ? (
                  <Link
                    href="/app"
                    style={{
                      ...linkStyle,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      border: `1px solid ${T.border}`,
                      background: "transparent",
                    }}
                    onClick={closeMenu}
                  >
                    Zur App
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    style={{
                      ...linkStyle,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      border: `1px solid ${T.border}`,
                      background: "transparent",
                    }}
                    onClick={closeMenu}
                  >
                    Login
                  </Link>
                )}
                <Link
                  href="/app/analyse"
                  style={{
                    ...linkStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    color: "#020617",
                    background: T.brand,
                    border: "1px solid transparent",
                  }}
                  onClick={closeMenu}
                >
                  Zur Analyse
                </Link>
              </nav>
            </Container>
          </div>
        )}
      </div>
    </div>
  );
}


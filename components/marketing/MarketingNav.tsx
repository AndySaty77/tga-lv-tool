import Link from "next/link";
import React from "react";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "./MarketingTheme";

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
  const isActive = (href: string) => (active ? active === href : false);

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
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(11, 18, 32, 0.82)",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <Container style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link href="/" style={{ color: T.text, textDecoration: "none", fontWeight: 900, letterSpacing: "-0.02em" }}>
            TGA&nbsp;LV&nbsp;Tool
          </Link>
          <span style={{ color: T.faint, fontSize: 12, fontWeight: 700 }}>LV-/GAEB-Analyse</span>
        </div>

        <nav aria-label="Produktseiten" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
          {item("/features", "Features")}
          {item("/how-it-works", "Ablauf")}
          {item("/pricing", "Preise")}
          {item("/faq", "FAQ")}
          {item("/docs", "Docs")}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, justifyContent: "flex-end", flexShrink: 1 }}>
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
          <Link
            href="/analyse"
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
  );
}


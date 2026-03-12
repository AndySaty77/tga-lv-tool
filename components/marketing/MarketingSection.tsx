import React from "react";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "./MarketingTheme";

export function MarketingSection({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <section style={{ padding: "56px 0" }}>
      <Container>
        <div style={{ maxWidth: 860 }}>
          {eyebrow && (
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.brand }}>
              {eyebrow}
            </div>
          )}
          <h2 style={{ margin: "10px 0 0", fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: T.text }}>
            {title}
          </h2>
          {lead && (
            <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.7, color: T.muted, maxWidth: 760 }}>
              {lead}
            </p>
          )}
        </div>
        {children && <div style={{ marginTop: 22 }}>{children}</div>}
      </Container>
    </section>
  );
}

export function MarketingCard({
  title,
  text,
  bullets,
  accent,
}: {
  title: string;
  text: string;
  bullets?: string[];
  accent?: "brand" | "risk" | "ops";
}) {
  const accentColor = accent === "risk" ? "#FBBF24" : accent === "ops" ? "#A7F3D0" : T.brand2;

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${T.border}`,
        background: "rgba(255,255,255,0.04)",
        padding: 18,
        boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: T.text, letterSpacing: "-0.01em" }}>{title}</div>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accentColor, boxShadow: `0 0 0 4px rgba(255,255,255,0.06)` }} />
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.65, color: T.muted }}>{text}</p>
      {bullets && bullets.length > 0 && (
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.7 }}>
          {bullets.map((b) => (
            <li key={b} style={{ marginBottom: 6 }}>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


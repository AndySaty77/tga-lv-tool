"use client";

import React from "react";
import { appTheme as T } from "@/components/app/appTheme";

/**
 * Startet POST /api/billing/checkout und leitet zur Stripe Checkout Session weiter.
 * Nur für eingeloggte Free-Nutzer sinnvoll; Fehler kommen als JSON von der API.
 */
type CheckoutVariant = "default" | "hero";

const variantStyles: Record<
  CheckoutVariant,
  { padding: string; fontSize: number; fontWeight: number; color: string; background: string; border: string }
> = {
  default: {
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: T.accent,
    background: "rgba(56,189,248,0.06)",
    border: `1px solid ${T.border}`,
  },
  hero: {
    padding: "14px 28px",
    fontSize: 15,
    fontWeight: 700,
    color: "#0a0e1a",
    background: T.accent,
    border: "1px solid rgba(224,124,94,0.95)",
  },
};

export function CheckoutProButton({ variant = "default" }: { variant?: CheckoutVariant }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const vs = variantStyles[variant];

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string; error?: string };
      if (!res.ok) {
        setError(data.message || data.error || "Checkout konnte nicht gestartet werden.");
        return;
      }
      if (typeof data.url === "string" && data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Keine Checkout-URL erhalten.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: vs.fontSize,
          fontWeight: vs.fontWeight,
          color: vs.color,
          cursor: loading ? "wait" : "pointer",
          padding: vs.padding,
          borderRadius: variant === "hero" ? T.radius : T.radiusSm,
          border: vs.border,
          background: vs.background,
          boxShadow: variant === "hero" ? "0 8px 24px rgba(224,124,94,0.25)" : undefined,
          minWidth: variant === "hero" ? 260 : undefined,
        }}
      >
        {loading ? "Wird geladen…" : "Jetzt auf Pro upgraden"}
      </button>
      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#fecaca", lineHeight: 1.5 }}>{error}</p>
      ) : null}
    </div>
  );
}

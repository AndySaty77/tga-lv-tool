"use client";

import React from "react";
import { appTheme as T } from "@/components/app/appTheme";

/**
 * Startet POST /api/billing/checkout und leitet zur Stripe Checkout Session weiter.
 * Nur für eingeloggte Free-Nutzer sinnvoll; Fehler kommen als JSON von der API.
 */
export function CheckoutProButton() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: T.accent,
          cursor: loading ? "wait" : "pointer",
          padding: "8px 12px",
          borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`,
          background: "rgba(56,189,248,0.06)",
        }}
      >
        {loading ? "Wird geladen…" : "Jetzt auf Pro upgraden (Stripe)"}
      </button>
      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#fecaca", lineHeight: 1.5 }}>{error}</p>
      ) : null}
    </div>
  );
}

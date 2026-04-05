"use client";

import React from "react";
import { appTheme as T } from "@/components/app/appTheme";

type Variant = "primary" | "muted";

const styles: Record<
  Variant,
  { color: string; border: string; background: string }
> = {
  primary: {
    color: T.accent,
    border: T.border,
    background: "rgba(56,189,248,0.06)",
  },
  muted: {
    color: T.muted,
    border: T.border,
    background: "rgba(255,255,255,0.02)",
  },
};

/**
 * POST /api/billing/portal → Redirect zu Stripe Customer Portal.
 */
export function BillingPortalButton({
  label = "Abrechnung verwalten",
  variant = "primary",
}: {
  label?: string;
  variant?: Variant;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const s = styles[variant];

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string; error?: string };
      if (!res.ok) {
        setError(data.message || data.error || "Portal konnte nicht geöffnet werden.");
        return;
      }
      if (typeof data.url === "string" && data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Keine Portal-URL erhalten.");
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
          color: s.color,
          cursor: loading ? "wait" : "pointer",
          padding: "8px 12px",
          borderRadius: T.radiusSm,
          border: `1px solid ${s.border}`,
          background: s.background,
        }}
      >
        {loading ? "Wird geladen…" : label}
      </button>
      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#fecaca", lineHeight: 1.5 }}>{error}</p>
      ) : null}
    </div>
  );
}

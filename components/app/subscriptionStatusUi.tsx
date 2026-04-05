import React from "react";
import { appTheme as T } from "@/components/app/appTheme";

export type SubscriptionTone = "active" | "canceling" | "payment" | "neutral";

export function SubscriptionBadge({ tone, children }: { tone: SubscriptionTone; children: React.ReactNode }) {
  const map: Record<SubscriptionTone, { bg: string; border: string; color: string }> = {
    active: {
      bg: "rgba(74,222,128,0.1)",
      border: "rgba(74,222,128,0.35)",
      color: T.success,
    },
    canceling: {
      bg: "rgba(251,191,36,0.1)",
      border: "rgba(251,191,36,0.35)",
      color: T.warning,
    },
    payment: {
      bg: "rgba(248,113,113,0.1)",
      border: "rgba(248,113,113,0.35)",
      color: T.danger,
    },
    neutral: {
      bg: "rgba(255,255,255,0.06)",
      border: T.border,
      color: T.muted,
    },
  };
  const s = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
      }}
    >
      {children}
    </span>
  );
}

export function SubscriptionMetaRow({ label, value, isLast }: { label: string; value: React.ReactNode; isLast?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "8px 20px",
        padding: "8px 0",
        borderBottom: isLast ? "none" : `1px solid ${T.border}`,
      }}
    >
      <span style={{ fontSize: 12, color: T.faint, letterSpacing: "0.02em" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text, textAlign: "right" as const }}>{value}</span>
    </div>
  );
}

export function planAboShellStyle(): React.CSSProperties {
  return {
    border: `1px solid ${T.accentMuted}`,
    borderRadius: T.radius,
    background: `linear-gradient(155deg, ${T.accentMuted} 0%, ${T.card} 50%)`,
    padding: T.space.xl,
    marginBottom: T.space.lg,
    boxShadow: "0 12px 36px rgba(0,0,0,0.22)",
  };
}

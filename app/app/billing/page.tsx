import React from "react";
import { appTheme as T } from "@/components/app/appTheme";

export const metadata = {
  title: "Billing – LV Scope",
  description: "Plan und Abrechnung.",
};

export default function AppBillingPage() {
  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Billing
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Planübersicht und Abrechnung. Billing wird später integriert.
        </p>
      </div>

      <div
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          background: T.card,
          padding: T.space.lg,
        }}
      >
        <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 15, fontWeight: 700, color: T.text }}>
          Planübersicht
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
          Aktuell: Platzhalter. Später Anbindung an Zahlungsanbieter (z. B. Stripe), Abo-Modelle und Rechnungsstellung.
        </p>
        <p style={{ marginTop: T.space.md, fontSize: 12, color: T.faint }}>
          Billing wird später integriert.
        </p>
      </div>
    </>
  );
}

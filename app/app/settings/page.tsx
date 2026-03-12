import React from "react";
import { appTheme as T } from "@/components/app/appTheme";

export const metadata = {
  title: "Settings – TGA LV Tool",
  description: "Profil, Sprache und Einstellungen.",
};

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.card,
        padding: T.space.lg,
        marginBottom: T.space.lg,
      }}
    >
      <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.text }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function AppSettingsPage() {
  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Settings
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Profil, Sprache und App-Einstellungen. Platzhalter – wird später mit echten Optionen ergänzt.
        </p>
      </div>

      <SettingsCard title="Profil">
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Name, E-Mail, Avatar. Später: Anbindung an Auth/User-Service.
        </p>
      </SettingsCard>

      <SettingsCard title="Sprache">
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          UI-Sprache (z. B. Deutsch / Englisch). Später: aus Konfiguration oder User-Preference.
        </p>
      </SettingsCard>

      <SettingsCard title="Einstellungen">
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Allgemeine App-Optionen (Benachrichtigungen, Standardansicht, Export-Optionen). Später ergänzen.
        </p>
      </SettingsCard>
    </>
  );
}

import React from "react";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/app/AppShell";
import { appTheme as T } from "@/components/app/appTheme";
import "./app.css";
import { ensureUserProfile } from "@/lib/billing/bootstrapProfile";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app-inter",
});

export const metadata = {
  title: "App – TGA LV Tool",
  description: "Geschützter Kundenbereich: Dashboard, Analysen, Einstellungen.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureUserProfile();
  return (
    <div
      className={`app-layout ${inter.variable}`}
      style={{
        background: T.bg,
        color: T.text,
        fontFamily: "var(--font-app-inter), system-ui, sans-serif",
      }}
    >
      <AppShell>{children}</AppShell>
    </div>
  );
}

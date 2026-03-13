import React from "react";
import { Inter } from "next/font/google";
import { AppSidebar } from "@/components/app/sidebar";
import { AppHeader } from "@/components/app/appHeader";
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
      className={inter.variable}
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        display: "flex",
        fontFamily: "var(--font-app-inter), system-ui, sans-serif",
      }}
    >
      <AppSidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, padding: T.space.xl }}>
          <AppHeader />
          {children}
        </main>
      </div>
    </div>
  );
}

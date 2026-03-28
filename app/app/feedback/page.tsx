import React from "react";
import { redirect } from "next/navigation";
import { appTheme as T } from "@/components/app/appTheme";
import { getUser } from "@/lib/auth/get-user";
import { FeedbackForm } from "./FeedbackForm";

export const metadata = {
  title: "Feedback – LV Scope",
  description: "Bug melden, Wünsche einreichen oder eine Frage zur Nutzung stellen.",
};

export default async function AppFeedbackPage() {
  const user = await getUser().catch(() => null);
  if (!user) redirect("/login?redirectTo=/app/feedback");

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const lastName = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const defaultName = fullName || (user.email ? user.email.split("@")[0] : "") || "";
  const defaultCompany = typeof meta.company === "string" ? meta.company.trim() : "";
  const defaultEmail = user.email ?? "";

  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Hilfe & Feedback
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.55, maxWidth: 520 }}>
          Melden Sie einen Bug, reichen Sie einen Wunsch ein oder stellen Sie eine Frage zur Nutzung. Wir lesen jede
          Nachricht und melden uns bei Bedarf bei Ihnen.
        </p>
      </div>

      <FeedbackForm defaultName={defaultName} defaultEmail={defaultEmail} defaultCompany={defaultCompany} />
    </>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingPageShell>
      <MarketingSection
        eyebrow="Sicherheit"
        title="Passwort zurücksetzen"
        lead="Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zurücksetzen des Passworts."
      >
        <Container>
          <div
            style={{
              boxSizing: "border-box",
              width: "100%",
              maxWidth: 400,
              minWidth: 0,
              padding: 20,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            {success ? (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
                  Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts versendet. Bitte prüfen Sie Ihr Postfach (auch den Spam-Ordner).
                </p>
                <Link
                  href="/login"
                  style={{
                    display: "inline-block",
                    marginTop: 16,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.brand,
                    textDecoration: "none",
                  }}
                >
                  Zurück zum Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "block", minWidth: 0 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                    E-Mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    style={{
                      boxSizing: "border-box",
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: "rgba(15,23,42,0.9)",
                      color: T.text,
                      fontSize: 13,
                    }}
                  />
                </div>
                {error && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: T.danger }}>
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    boxSizing: "border-box",
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: T.brand,
                    color: "#020617",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: loading ? "default" : "pointer",
                    opacity: loading ? 0.8 : 1,
                    marginBottom: 10,
                  }}
                >
                  {loading ? "Wird gesendet…" : "Reset-Link senden"}
                </button>
              </form>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: T.muted }}>
              <Link href="/login" style={{ color: T.text, fontWeight: 600, textDecoration: "none" }}>
                Zurück zum Login
              </Link>
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}

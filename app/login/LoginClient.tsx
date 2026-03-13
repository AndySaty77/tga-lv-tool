"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { supabase } from "@/lib/supabaseClient";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const redirectTo = searchParams.get("redirectTo") || "/app";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      // Vollständiger Reload stellt sicher, dass Cookies/Session auch serverseitig greifen
      window.location.href = redirectTo;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingPageShell>
      <MarketingSection
        eyebrow="SaaS"
        title="Login"
        lead="Melden Sie sich mit Ihrem TGA LV Tool Konto an oder setzen Sie bei Bedarf Ihr Passwort zurück."
      >
        <Container>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)", maxWidth: 480 }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: "rgba(15,23,42,0.9)",
                    color: T.text,
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                  Passwort
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
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
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
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
                {loading ? "Einloggen…" : "Login"}
              </button>
            </form>
            <div style={{ marginTop: 8, fontSize: 12, color: T.muted }}>
              Passwort vergessen?{" "}
              <Link href="/reset-password" style={{ color: T.text, fontWeight: 600 }}>
                Passwort zurücksetzen
              </Link>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: T.muted }}>
              Noch kein Account?{" "}
              <Link href="/register" style={{ color: T.text, fontWeight: 600 }}>
                Jetzt registrieren
              </Link>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: T.muted }}>
              Oder ohne Login weiter unter{" "}
              <Link href="/analyse" style={{ color: T.text, fontWeight: 600 }}>
                /analyse
              </Link>
              .
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}


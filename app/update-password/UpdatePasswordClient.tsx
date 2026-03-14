"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { supabase } from "@/lib/supabaseClient";

export function UpdatePasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  // Recovery: Entweder Hash (vom Client verarbeitet) oder token_hash/type in der Query.
  // Bei token_hash/type zum Auth-Callback weiterleiten, der die Session setzt und hierher zurückleitet.
  useEffect(() => {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    if (token_hash && type === "recovery") {
      window.location.href = `/auth/callback?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(type)}`;
      return;
    }
  }, [searchParams]);

  // Nach Redirect von Supabase: Hash (access_token, type=recovery) wird vom Client verarbeitet.
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setSessionReady(!!session);
    };

    check();
    const t = setTimeout(check, 800);
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
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
        title="Neues Passwort setzen"
        lead="Setzen Sie hier Ihr neues Passwort. Sie wurden per E-Mail-Link hierher geleitet."
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
            {sessionReady === false ? (
              <div>
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                  Bitte nutzen Sie den Link aus der Passwort-Reset-E-Mail. Wenn Sie den Link bereits geöffnet haben und diese Meldung sehen, versuchen Sie die Seite neu zu laden.
                </p>
                <Link
                  href="/reset-password"
                  style={{
                    display: "inline-block",
                    marginTop: 16,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.brand,
                    textDecoration: "none",
                  }}
                >
                  Reset-Link erneut anfordern
                </Link>
              </div>
            ) : success ? (
              <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
                Passwort wurde aktualisiert. Sie werden zum Login weitergeleitet…
              </p>
            ) : sessionReady === true ? (
              <form onSubmit={handleSubmit} style={{ display: "block", minWidth: 0 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                    Neues Passwort
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
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
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                    Passwort wiederholen
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
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
                  {loading ? "Wird gespeichert…" : "Passwort aktualisieren"}
                </button>
              </form>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
                Session wird geladen…
              </p>
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

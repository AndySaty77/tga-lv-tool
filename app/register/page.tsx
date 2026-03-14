"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = React.useState<{
    firstName?: string;
    lastName?: string;
    company?: string;
    email?: string;
    password?: string;
    passwordConfirm?: string;
    acceptTerms?: string;
  }>({});

  const validate = () => {
    const next: typeof fieldErrors = {};

    if (!firstName.trim()) {
      next.firstName = "Bitte Vornamen angeben.";
    }
    if (!lastName.trim()) {
      next.lastName = "Bitte Nachnamen angeben.";
    }
    if (!company.trim()) {
      next.company = "Bitte Firmenname angeben.";
    }
    if (!email.trim()) {
      next.email = "Bitte E-Mail-Adresse angeben.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        next.email = "Bitte eine gültige E-Mail-Adresse eingeben.";
      }
    }
    if (!password) {
      next.password = "Bitte ein Passwort wählen.";
    } else if (password.length < 8) {
      next.password = "Das Passwort muss mindestens 8 Zeichen lang sein.";
    }
    if (!passwordConfirm) {
      next.passwordConfirm = "Bitte Passwort bestätigen.";
    } else if (passwordConfirm !== password) {
      next.passwordConfirm = "Passwort und Bestätigung stimmen nicht überein.";
    }
    if (!acceptTerms) {
      next.acceptTerms = "Bitte stimmen Sie den Bedingungen zu.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!validate()) {
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            company: company.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setInfo(
        "Wenn für diese E-Mail-Adresse ein Konto angelegt werden konnte, prüfen Sie bitte Ihr Postfach. Anschließend können Sie sich anmelden oder Ihr Passwort zurücksetzen.",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler bei der Registrierung.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingPageShell>
      <MarketingSection
        eyebrow="Konto"
        title="Konto erstellen"
        lead="Erstellen Sie Ihr Konto für die KI-gestützte LV-/GAEB-Analyse."
      >
        <Container>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 640,
                border: `1px solid ${T.border}`,
                borderRadius: 18,
                padding: 24,
                background: "rgba(255,255,255,0.03)",
              }}
            >
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                    Vorname
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${fieldErrors.firstName ? T.danger : T.border}`,
                      background: "rgba(15,23,42,0.9)",
                      color: T.text,
                      fontSize: 13,
                    }}
                  />
                  {fieldErrors.firstName && (
                    <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.firstName}</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                    Nachname
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${fieldErrors.lastName ? T.danger : T.border}`,
                      background: "rgba(15,23,42,0.9)",
                      color: T.text,
                      fontSize: 13,
                    }}
                  />
                  {fieldErrors.lastName && (
                    <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.lastName}</div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                  Firma
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    if (fieldErrors.company) setFieldErrors((prev) => ({ ...prev, company: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${fieldErrors.company ? T.danger : T.border}`,
                    background: "rgba(15,23,42,0.9)",
                    color: T.text,
                    fontSize: 13,
                  }}
                />
                {fieldErrors.company && (
                  <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.company}</div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${fieldErrors.email ? T.danger : T.border}`,
                    background: "rgba(15,23,42,0.9)",
                    color: T.text,
                    fontSize: 13,
                  }}
                />
                {fieldErrors.email && (
                  <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.email}</div>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                  Passwort
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${fieldErrors.password ? T.danger : T.border}`,
                    background: "rgba(15,23,42,0.9)",
                    color: T.text,
                    fontSize: 13,
                  }}
                />
                {fieldErrors.password && (
                  <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.password}</div>
                )}
                <div style={{ marginTop: 4, fontSize: 11, color: T.muted }}>
                  Mindestens 8 Zeichen. Verwenden Sie für produktive Accounts ein starkes, einzigartiges Passwort.
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>
                  Passwort bestätigen
                </label>
                <input
                  type="password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    if (fieldErrors.passwordConfirm) setFieldErrors((prev) => ({ ...prev, passwordConfirm: undefined }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${fieldErrors.passwordConfirm ? T.danger : T.border}`,
                    background: "rgba(15,23,42,0.9)",
                    color: T.text,
                    fontSize: 13,
                  }}
                />
                {fieldErrors.passwordConfirm && (
                  <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.passwordConfirm}</div>
                )}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 12,
                    color: T.muted,
                    lineHeight: 1.6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => {
                      setAcceptTerms(e.target.checked);
                      if (fieldErrors.acceptTerms) setFieldErrors((prev) => ({ ...prev, acceptTerms: undefined }));
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    Ich habe die{" "}
                    <Link href="/datenschutz" style={{ color: T.text, fontWeight: 600 }}>
                      Datenschutzhinweise
                    </Link>{" "}
                    und die{" "}
                    <Link href="/agb" style={{ color: T.text, fontWeight: 600 }}>
                      AGB
                    </Link>{" "}
                    zur Kenntnis genommen und stimme ihnen zu.
                  </span>
                </label>
                {fieldErrors.acceptTerms && (
                  <div style={{ marginTop: 4, fontSize: 11, color: T.danger }}>{fieldErrors.acceptTerms}</div>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: 12, fontSize: 12, color: T.danger }}>
                  {error}
                </div>
              )}
              {info && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: "rgba(15,23,42,0.9)",
                    fontSize: 12,
                    color: T.muted,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: `1px solid ${T.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        color: T.text,
                      }}
                    >
                      i
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: T.text }}>Bitte Postfach prüfen</div>
                      <div style={{ marginTop: 4 }}>{info}</div>
                    </div>
                  </div>
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
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                {loading ? "Konto wird erstellt…" : info ? "Eingabe verarbeitet" : "Konto erstellen"}
              </button>
            </form>
            <div style={{ marginTop: 12, fontSize: 12, color: T.muted }}>
              Bereits ein Konto?{" "}
              <Link href="/login" style={{ color: T.text, fontWeight: 600 }}>
                Jetzt einloggen
              </Link>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>
              Passwort vergessen?{" "}
              <Link href="/reset-password" style={{ color: T.text, fontWeight: 600 }}>
                Passwort zurücksetzen
              </Link>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: T.muted }}>
              Sie können die LV-/GAEB-Analyse weiterhin ohne Login über{" "}
              <Link href="/app/analyse" style={{ color: T.text, fontWeight: 600 }}>
                zur Analyse
              </Link>{" "}
              testen.
            </div>
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}


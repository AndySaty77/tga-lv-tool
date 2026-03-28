"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appTheme as T } from "@/components/app/appTheme";
import { APP_FEEDBACK_CATEGORIES, CATEGORY_LABELS, type ContactCategory } from "@/lib/contactCategory";

const HINTS: Partial<Record<ContactCategory, string>> = {
  bug: "Was ist passiert, was haben Sie erwartet? Gerne Schritte oder Browser nennen.",
  feature: "Welche Verbesserung würde Ihnen helfen?",
  product: "Fragen zur Bedienung, Funktionen oder zum Ablauf in der App.",
  feedback_other: "Alles, was nicht in die anderen Punkte passt.",
};

type Props = {
  defaultName: string;
  defaultEmail: string;
  defaultCompany: string;
};

function emailPlausible(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length < 5) return false;
  if (!trimmed.includes("@") || !trimmed.includes(".")) return false;
  const at = trimmed.indexOf("@");
  const domain = trimmed.slice(at + 1);
  return domain.length >= 2 && domain.includes(".");
}

export function FeedbackForm({ defaultName, defaultEmail, defaultCompany }: Props) {
  const pathname = usePathname();
  const [category, setCategory] = useState<ContactCategory>("bug");
  const [name, setName] = useState(defaultName);
  const [company, setCompany] = useState(defaultCompany);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const hint = useMemo(() => HINTS[category] ?? "", [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Bitte Namen angeben.";
    if (!company.trim()) next.company = "Bitte Unternehmen oder «Privat» angeben.";
    if (!defaultEmail.trim()) next.email = "Keine E-Mail im Konto.";
    else if (!emailPlausible(defaultEmail)) next.email = "Ungültige Konto-E-Mail.";
    if (!message.trim()) next.message = "Bitte Nachricht angeben.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          email: defaultEmail.trim(),
          message: message.trim(),
          category,
          source: "app",
          appPath: pathname || "/app/feedback",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ form: (data.error as string) || "Nachricht konnte nicht gesendet werden." });
        return;
      }
      setSuccess(true);
      setMessage("");
    } catch {
      setErrors({ form: "Netzwerkfehler. Bitte später erneut versuchen." });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: `${T.space.sm}px ${T.space.md}px`,
    borderRadius: T.radiusSm,
    border: `1px solid ${T.border}`,
    background: T.surface,
    color: T.text,
    fontSize: 13,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: T.muted,
    marginBottom: T.space.xs,
    letterSpacing: "0.02em",
  };

  if (success) {
    return (
      <div
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          background: T.card,
          padding: T.space.lg,
          maxWidth: 480,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: T.space.sm }}>Nachricht gesendet</div>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Wir haben Ihre Nachricht erhalten. Bei Bedarf senden wir eine kurze Bestätigung an Ihre Konto-E-Mail.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 480 }}>
      {errors.form && (
        <div
          style={{
            marginBottom: T.space.md,
            padding: T.space.sm,
            borderRadius: T.radiusSm,
            background: "rgba(248,113,113,0.12)",
            border: `1px solid ${T.danger}`,
            color: T.danger,
            fontSize: 13,
          }}
        >
          {errors.form}
        </div>
      )}

      <div style={{ marginBottom: T.space.md }}>
        <label htmlFor="fb-category" style={labelStyle}>
          Art der Nachricht
        </label>
        <select
          id="fb-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ContactCategory)}
          style={inputStyle}
          disabled={submitting}
        >
          {APP_FEEDBACK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {hint ? (
          <p style={{ margin: `${T.space.sm}px 0 0`, fontSize: 12, color: T.faint, lineHeight: 1.5 }}>{hint}</p>
        ) : null}
      </div>

      <div style={{ marginBottom: T.space.md }}>
        <label htmlFor="fb-name" style={labelStyle}>
          Name
        </label>
        <input
          id="fb-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ ...inputStyle, borderColor: errors.name ? T.danger : T.border }}
          disabled={submitting}
          autoComplete="name"
        />
        {errors.name && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.name}</span>
        )}
      </div>

      <div style={{ marginBottom: T.space.md }}>
        <span style={labelStyle}>E-Mail (Antwortadresse)</span>
        <div
          style={{
            ...inputStyle,
            opacity: 0.85,
            cursor: "not-allowed",
            color: T.muted,
          }}
          title="Verknüpft mit Ihrem Konto"
        >
          {defaultEmail || "—"}
        </div>
        {errors.email && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.email}</span>
        )}
        <p style={{ margin: `${T.space.xs}px 0 0`, fontSize: 11, color: T.faint, lineHeight: 1.45 }}>
          Antworten erhalten Sie an diese Adresse. Änderungen nehmen Sie in den Settings vor.
        </p>
      </div>

      <div style={{ marginBottom: T.space.md }}>
        <label htmlFor="fb-company" style={labelStyle}>
          Unternehmen
        </label>
        <input
          id="fb-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{ ...inputStyle, borderColor: errors.company ? T.danger : T.border }}
          placeholder="Firma oder «Privat»"
          disabled={submitting}
          autoComplete="organization"
        />
        {errors.company && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.company}</span>
        )}
      </div>

      <div style={{ marginBottom: T.space.lg }}>
        <label htmlFor="fb-message" style={labelStyle}>
          Nachricht
        </label>
        <textarea
          id="fb-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{
            ...inputStyle,
            minHeight: 120,
            resize: "vertical",
            borderColor: errors.message ? T.danger : T.border,
          }}
          disabled={submitting}
          rows={5}
        />
        {errors.message && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.message}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: `${T.space.sm}px ${T.space.lg}px`,
          borderRadius: T.radiusSm,
          border: "none",
          background: T.accent,
          color: "#0a0e1a",
          fontSize: 13,
          fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.85 : 1,
        }}
      >
        {submitting ? "Wird gesendet…" : "Nachricht senden"}
      </button>

      <p style={{ margin: `${T.space.lg}px 0 0`, fontSize: 12, color: T.faint, lineHeight: 1.55 }}>
        Für allgemeine Kontaktanfragen von außen nutzen Sie die{" "}
        <Link href="/contact" style={{ color: T.muted, fontWeight: 600 }}>
          Kontaktseite
        </Link>
        .
      </p>
    </form>
  );
}

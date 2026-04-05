"use client";

import React, { useMemo, useState } from "react";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import type { ContactCategory } from "@/lib/contactCategory";

const CATEGORY_OPTIONS: {
  value: ContactCategory;
  label: string;
  hint: string;
}[] = [
  {
    value: "general",
    label: "Allgemeine Anfrage",
    hint: "Fragen zu LV Scope, zur Zusammenarbeit oder zu Konditionen.",
  },
  {
    value: "product",
    label: "Produktfrage",
    hint: "Funktionen, Einsatz im Alltag oder fachliche Details zum Produkt.",
  },
  {
    value: "demo",
    label: "Demo / Kontakt",
    hint: "Wenn Sie eine kurze Vorstellung oder einen Rückruf wünschen.",
  },
  {
    value: "bug",
    label: "Bug",
    hint: "Bitte kurz beschreiben, was passiert ist und was Sie erwartet hätten.",
  },
  {
    value: "feature",
    label: "Wunsch / Feature",
    hint: "Ideen und Verbesserungen – wir lesen jeden Hinweis.",
  },
  {
    value: "feedback_other",
    label: "Sonstiges Feedback",
    hint: "Alles andere, was nicht in die anderen Punkte passt.",
  },
];

function emailPlausible(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length < 5) return false;
  if (!trimmed.includes("@") || !trimmed.includes(".")) return false;
  const at = trimmed.indexOf("@");
  const domain = trimmed.slice(at + 1);
  return domain.length >= 2 && domain.includes(".");
}

type ContactFormProps = {
  /** z. B. von `/contact?topic=team` (Produkt/Team-Anfrage) oder `?category=demo` */
  initialCategory?: ContactCategory;
};

export function ContactForm({ initialCategory }: ContactFormProps = {}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [category, setCategory] = useState<ContactCategory>(initialCategory ?? "general");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const categoryHint = useMemo(
    () => CATEGORY_OPTIONS.find((o) => o.value === category)?.hint ?? "",
    [category]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Bitte Namen angeben.";
    if (!company.trim()) next.company = "Bitte Unternehmen angeben.";
    if (!email.trim()) next.email = "Bitte E-Mail angeben.";
    else if (!emailPlausible(email)) next.email = "Bitte gültige E-Mail-Adresse angeben.";
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
          email: email.trim(),
          message: message.trim(),
          phone: phone.trim() || undefined,
          teamSize: teamSize.trim() || undefined,
          category,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ form: (data.error as string) || "Nachricht konnte nicht gesendet werden." });
        return;
      }
      setSuccess(true);
      setName("");
      setCompany("");
      setEmail("");
      setMessage("");
      setPhone("");
      setTeamSize("");
      setCategory("general");
    } catch {
      setErrors({ form: "Netzwerkfehler. Bitte später erneut versuchen." });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          Vielen Dank
        </div>
        <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
          Ihre Nachricht ist eingegangen. Sie erhalten in Kürze eine kurze Bestätigung an die angegebene
          E-Mail-Adresse.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${T.border}`,
    background: "rgba(15,23,42,0.8)",
    color: T.text,
    fontSize: 14,
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: T.muted,
    marginBottom: 6,
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.form && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            background: "rgba(248,113,113,0.15)",
            border: `1px solid ${T.danger}`,
            color: T.danger,
            fontSize: 13,
          }}
        >
          {errors.form}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-category" style={labelStyle}>
          Thema *
        </label>
        <select
          id="contact-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ContactCategory)}
          style={inputStyle}
          disabled={submitting}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {categoryHint ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: T.muted,
              lineHeight: 1.5,
            }}
          >
            {categoryHint}
          </p>
        ) : null}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-name" style={labelStyle}>
          Name *
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ ...inputStyle, borderColor: errors.name ? T.danger : undefined }}
          placeholder="Ihr Name"
          disabled={submitting}
        />
        {errors.name && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.name}</span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-company" style={labelStyle}>
          Unternehmen *
        </label>
        <input
          id="contact-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{ ...inputStyle, borderColor: errors.company ? T.danger : undefined }}
          placeholder="Firma / Organisation"
          disabled={submitting}
        />
        {errors.company && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.company}</span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-email" style={labelStyle}>
          E-Mail *
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...inputStyle, borderColor: errors.email ? T.danger : undefined }}
          placeholder="ihre@email.de"
          disabled={submitting}
        />
        {errors.email && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.email}</span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-phone" style={labelStyle}>
          Telefon (optional)
        </label>
        <input
          id="contact-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          placeholder="+49 …"
          disabled={submitting}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-teamsize" style={labelStyle}>
          Teamgröße (optional)
        </label>
        <input
          id="contact-teamsize"
          type="text"
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          style={inputStyle}
          placeholder="z. B. 5–10 Nutzer"
          disabled={submitting}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="contact-message" style={labelStyle}>
          Nachricht *
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{
            ...inputStyle,
            minHeight: 120,
            resize: "vertical",
            borderColor: errors.message ? T.danger : undefined,
          }}
          placeholder="Ihre Nachricht"
          disabled={submitting}
          rows={4}
        />
        {errors.message && (
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.danger }}>{errors.message}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "none",
          background: T.brand,
          color: "#020617",
          fontSize: 14,
          fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.8 : 1,
        }}
      >
        {submitting ? "Wird gesendet…" : "Nachricht senden"}
      </button>
    </form>
  );
}

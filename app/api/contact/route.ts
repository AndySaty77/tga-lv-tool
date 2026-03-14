/**
 * POST /api/contact – Team-/Kontaktanfragen per E-Mail versenden (Resend).
 *
 * Benötigte Umgebungsvariablen:
 * - RESEND_API_KEY     – API-Key von resend.com (z. B. re_…)
 * - CONTACT_FORM_TO_EMAIL – E-Mail-Adresse, an die Anfragen gesendet werden
 *
 * Optional:
 * - CONTACT_FORM_FROM_EMAIL – Absender-Adresse (z. B. "LV Scope <kontakt@lvscope.de>").
 *   Wenn nicht gesetzt: "TGA LV Tool <onboarding@resend.dev>" (Resend-Test-Absender, nur für Tests).
 * - CONTACT_FORM_REPLY_TO – Reply-To der Bestätigungsmail (z. B. support@lvscope.de), damit Antworten beim Support landen.
 *
 * Ablauf: Zuerst interne Mail an CONTACT_FORM_TO_EMAIL; nur bei Erfolg Bestätigungsmail an den Absender.
 * Schlägt die Bestätigungsmail fehl, antwortet die API weiterhin mit 200 (Anfrage ist angekommen), Fehler wird nur geloggt.
 *
 * Lokal: .env.local mit RESEND_API_KEY und CONTACT_FORM_TO_EMAIL anlegen.
 * Vercel: gleiche Variablen im Projekt unter Settings → Environment Variables setzen.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INTEREST_LABELS: Record<string, string> = {
  team: "Team-Zugang",
  angebot: "Individuelles Angebot",
  demo: "Demo",
  sonstiges: "Sonstiges",
};

function buildEmailBody(p: {
  name: string;
  company: string;
  email: string;
  message: string;
  phone?: string;
  teamSize?: string;
  interest?: string;
  timestamp: string;
}): string {
  const lines: string[] = [
    "Neue Team-/Individuelle Anfrage",
    "",
    "---",
    "",
    `Name:       ${p.name}`,
    `Unternehmen: ${p.company}`,
    `E-Mail:    ${p.email}`,
    "",
    `Nachricht:`,
    p.message,
    "",
    "---",
  ];
  if (p.phone) lines.push(`Telefon:   ${p.phone}`, "");
  if (p.teamSize) lines.push(`Teamgröße: ${p.teamSize}`, "");
  if (p.interest) lines.push(`Interesse: ${INTEREST_LABELS[p.interest] ?? p.interest}`, "");
  lines.push("---", "", `Eingegangen: ${p.timestamp}`);
  return lines.join("\n");
}

/** Bestätigungsmail an den Absender (nur wenn interne Mail erfolgreich war). */
function buildConfirmationBody(p: {
  name: string;
  company: string;
  interest?: string;
  message: string;
}): string {
  const interestLabel = p.interest ? INTEREST_LABELS[p.interest] ?? p.interest : null;
  const lines: string[] = [
    `Hallo ${p.name},`,
    "",
    "vielen Dank für Ihre Anfrage. Wir haben sie erhalten und melden uns zeitnah bei Ihnen.",
    "",
    "Ihre Angaben:",
    `  Name:         ${p.name}`,
    `  Unternehmen:  ${p.company}`,
    ...(interestLabel ? [`  Interesse:   ${interestLabel}`] : []),
    "",
    "Ihre Nachricht:",
    p.message.slice(0, 800) + (p.message.length > 800 ? "…" : ""),
    "",
    "---",
    "Mit freundlichen Grüßen",
    "Ihr Team von LV Scope",
  ];
  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body muss ein Objekt sein" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const company = typeof o.company === "string" ? o.company.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : undefined;
  const teamSize = typeof o.teamSize === "string" ? o.teamSize.trim() : undefined;
  const interest = typeof o.interest === "string" && o.interest.trim() ? o.interest.trim() : undefined;

  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }
  if (!company) {
    return NextResponse.json({ error: "Unternehmen ist erforderlich" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Bitte gültige E-Mail-Adresse angeben" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Nachricht ist erforderlich" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_FORM_TO_EMAIL;

  if (!apiKey || !toEmail) {
    console.error("[contact] Missing RESEND_API_KEY or CONTACT_FORM_TO_EMAIL");
    return NextResponse.json(
      { error: "Anfrage derzeit nicht möglich. Bitte später erneut versuchen." },
      { status: 503 }
    );
  }

  const fromEmail = process.env.CONTACT_FORM_FROM_EMAIL ?? "TGA LV Tool <onboarding@resend.dev>";
  const timestamp = new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const resend = new Resend(apiKey);
  const subjectInternal = `Neue Team-/Individuelle Anfrage – ${company}`;
  const textBodyInternal = buildEmailBody({
    name,
    company,
    email,
    message,
    phone,
    teamSize,
    interest,
    timestamp,
  });

  // 1. Interne Mail zuerst – nur bei Erfolg Bestätigungsmail an den Nutzer
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    replyTo: email,
    subject: subjectInternal,
    text: textBodyInternal,
  });

  if (error) {
    console.error("[contact] internal-email failed:", error.message);
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen." },
      { status: 500 }
    );
  }
  console.error("[contact] internal-email ok, id:", data?.id ?? "—");

  // 2. Bestätigungsmail an den Absender (nur wenn interne Mail erfolgreich)
  // Bei Fehler der Bestätigungsmail: Anfrage gilt als angekommen, wir loggen nur und antworten weiterhin mit Erfolg.
  const replyToSupport = process.env.CONTACT_FORM_REPLY_TO ?? undefined;
  const { error: autoReplyError } = await resend.emails.send({
    from: fromEmail,
    to: [email],
    ...(replyToSupport ? { replyTo: replyToSupport } : {}),
    subject: "Ihre Anfrage bei LV Scope ist eingegangen",
    text: buildConfirmationBody({ name, company, interest, message }),
  });

  if (autoReplyError) {
    console.error("[contact] auto-reply failed (internal mail was ok):", autoReplyError.message);
    // Bewusst weiterhin 200: Die Anfrage ist bei uns angekommen; die Bestätigungsmail ist Zusatzservice.
  } else {
    console.error("[contact] auto-reply ok");
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

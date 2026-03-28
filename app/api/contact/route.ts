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
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  CATEGORY_LABELS,
  INTEREST_TO_CATEGORY,
  type ContactCategory,
  isContactCategory,
} from "@/lib/contactCategory";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveCategory(
  rawCategory: string | undefined,
  interest: string | undefined
): { category: ContactCategory; invalidCategory: boolean } {
  const trimmed = typeof rawCategory === "string" ? rawCategory.trim() : "";
  if (trimmed) {
    if (!isContactCategory(trimmed)) {
      return { category: "general", invalidCategory: true };
    }
    return { category: trimmed, invalidCategory: false };
  }
  if (interest && INTEREST_TO_CATEGORY[interest]) {
    return { category: INTEREST_TO_CATEGORY[interest], invalidCategory: false };
  }
  if (interest) {
    return { category: "general", invalidCategory: false };
  }
  return { category: "general", invalidCategory: false };
}

function sanitizeAppPath(s: string): string {
  return s.replace(/[\r\n\x00-\x1f]/g, " ").trim().slice(0, 240);
}

function buildEmailBody(p: {
  name: string;
  company: string;
  email: string;
  message: string;
  categoryLabel: string;
  phone?: string;
  teamSize?: string;
  /** Nur für Abwärtskompatibilität in der internen Mail sichtbar, wenn mitgesendet. */
  legacyInterestLabel?: string;
  /** Optional: eingeloggte App (Herkunft in interner Mail). */
  source?: "app" | "website";
  appPath?: string;
  timestamp: string;
}): string {
  const lines: string[] = [
    "Neue Kontaktanfrage",
    "",
    "---",
    "",
    `Kategorie:  ${p.categoryLabel}`,
    "",
  ];
  if (p.source === "app") {
    lines.push("Herkunft:   LV Scope App (eingeloggt)", "");
    if (p.appPath) lines.push(`App-Seite:  ${p.appPath}`, "");
  }
  lines.push(
    `Name:       ${p.name}`,
    `Unternehmen: ${p.company}`,
    `E-Mail:    ${p.email}`,
    "",
    `Nachricht:`,
    p.message,
    "",
    "---",
  );
  if (p.phone) lines.push(`Telefon:   ${p.phone}`, "");
  if (p.teamSize) lines.push(`Teamgröße: ${p.teamSize}`, "");
  if (p.legacyInterestLabel) {
    lines.push(`(Legacy Interesse: ${p.legacyInterestLabel})`, "");
  }
  lines.push("---", "", `Eingegangen: ${p.timestamp}`);
  return lines.join("\n");
}

/** Bestätigungsmail an den Absender (nur wenn interne Mail erfolgreich war). */
function buildConfirmationBody(p: {
  name: string;
  company: string;
  categoryLabel: string;
  message: string;
}): string {
  const lines: string[] = [
    `Hallo ${p.name},`,
    "",
    "vielen Dank für Ihre Nachricht. Wir haben sie erhalten und melden uns zeitnah bei Ihnen.",
    "",
    "Ihre Angaben:",
    `  Name:         ${p.name}`,
    `  Unternehmen:  ${p.company}`,
    `  Thema:        ${p.categoryLabel}`,
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

const CONTACT_RATE_LIMIT_PER_10MIN = 5;
const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT_PER_10MIN, CONTACT_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

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
  const rawCategory = typeof o.category === "string" ? o.category : undefined;
  const interest =
    typeof o.interest === "string" && o.interest.trim() ? o.interest.trim() : undefined;

  const { category, invalidCategory } = resolveCategory(rawCategory, interest);
  if (invalidCategory) {
    return NextResponse.json(
      { error: "Ungültige Kategorie. Bitte eine gültige Auswahl treffen." },
      { status: 400 }
    );
  }

  const categoryLabel = CATEGORY_LABELS[category];
  const hadExplicitCategory =
    typeof rawCategory === "string" &&
    rawCategory.trim() !== "" &&
    isContactCategory(rawCategory.trim());
  /** Unbekanntes altes `interest`-Feld, wenn keine explizite Kategorie mitgesendet wurde. */
  const legacyInterestLabel =
    interest && !INTEREST_TO_CATEGORY[interest] && !hadExplicitCategory ? interest : undefined;

  const rawSource = typeof o.source === "string" ? o.source.trim() : "";
  const source: "app" | "website" = rawSource === "app" ? "app" : "website";
  const appPathSanitized =
    typeof o.appPath === "string" && o.appPath.trim() ? sanitizeAppPath(o.appPath) : "";
  const appPath = source === "app" && appPathSanitized ? appPathSanitized : undefined;

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
  const subjectInternal = `Kontakt: ${categoryLabel} – ${company}`;
  const textBodyInternal = buildEmailBody({
    name,
    company,
    email,
    message,
    categoryLabel,
    phone,
    teamSize,
    legacyInterestLabel,
    source,
    appPath,
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
    subject: "Ihre Nachricht an LV Scope ist eingegangen",
    text: buildConfirmationBody({ name, company, categoryLabel, message }),
  });

  if (autoReplyError) {
    console.error("[contact] auto-reply failed (internal mail was ok):", autoReplyError.message);
    // Bewusst weiterhin 200: Die Anfrage ist bei uns angekommen; die Bestätigungsmail ist Zusatzservice.
  } else {
    console.error("[contact] auto-reply ok");
  }

  return NextResponse.json({ ok: true, id: data?.id, category });
}

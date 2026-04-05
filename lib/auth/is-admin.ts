import type { User } from "@supabase/supabase-js";

/**
 * Prüft, ob eine E-Mail in ADMIN_EMAILS steht (gleiche wie isAdmin, ohne User-Objekt).
 * Für Webhooks / Stripe-Profile ohne Auth-User-Objekt.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const list = process.env.ADMIN_EMAILS;
  if (!list || typeof list !== "string") return false;
  const emails = list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return emails.includes(email.trim().toLowerCase());
}

/**
 * Prüft, ob der Nutzer als Admin zugelassen ist.
 * Konfiguration über Umgebungsvariable ADMIN_EMAILS (kommaseparierte E-Mail-Adressen).
 * Keine DB-Struktur, keine RLS – nur serverseitige Guard.
 */
export function isAdmin(user: User | null): boolean {
  return isAdminEmail(user?.email ?? null);
}

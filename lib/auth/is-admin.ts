import type { User } from "@supabase/supabase-js";

/**
 * Prüft, ob der Nutzer als Admin zugelassen ist.
 * Konfiguration über Umgebungsvariable ADMIN_EMAILS (kommaseparierte E-Mail-Adressen).
 * Keine DB-Struktur, keine RLS – nur serverseitige Guard.
 */
export function isAdmin(user: User | null): boolean {
  if (!user?.email?.trim()) return false;
  const list = process.env.ADMIN_EMAILS;
  if (!list || typeof list !== "string") return false;
  const emails = list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return emails.includes(user.email.trim().toLowerCase());
}

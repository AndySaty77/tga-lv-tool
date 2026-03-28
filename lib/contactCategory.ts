/** Öffentliches Kategorie-Feld für POST /api/contact (Kontakt & Feedback). */
export const CONTACT_CATEGORIES = [
  "general",
  "product",
  "demo",
  "bug",
  "feature",
  "feedback_other",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ContactCategory, string> = {
  general: "Allgemeine Anfrage",
  product: "Produktfrage",
  demo: "Demo / Kontakt",
  bug: "Bug",
  feature: "Wunsch / Feature",
  feedback_other: "Sonstiges Feedback",
};

/** Legacy `interest` → `category` (nur wenn `category` fehlt oder leer). */
export const INTEREST_TO_CATEGORY: Record<string, ContactCategory> = {
  team: "product",
  angebot: "general",
  demo: "demo",
  sonstiges: "feedback_other",
};

export function isContactCategory(s: string): s is ContactCategory {
  return (CONTACT_CATEGORIES as readonly string[]).includes(s);
}

/** Kategorien für /app/feedback (Teilmenge, Reihenfolge für UI). */
export const APP_FEEDBACK_CATEGORIES: readonly ContactCategory[] = [
  "bug",
  "feature",
  "product",
  "feedback_other",
];

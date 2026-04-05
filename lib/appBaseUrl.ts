/**
 * Öffentliche Basis-URL für Server-Redirects (Checkout success/cancel, Webhooks-Docs).
 * Reihenfolge: NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost.
 */
export function getAppBaseUrl(): string {
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromSite) return fromSite.replace(/\/$/, "");
  const fromApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromApp) return fromApp.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}

/**
 * Einfaches In-Memory-Rate-Limiting (fixed window).
 * Pro Server-Instanz; bei mehreren Instanzen gilt das Limit pro Instanz.
 * Keine sensiblen Daten in Logs.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

const CLEANUP_THRESHOLD = 2000;
let checkCount = 0;

function cleanupIfNeeded(now: number) {
  checkCount++;
  if (checkCount % 50 !== 0 || store.size < CLEANUP_THRESHOLD) return;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; retryAfter?: number }
  | { allowed: false; remaining: 0; retryAfter: number };

/**
 * Prüft das Limit für einen Schlüssel (z. B. user.id oder IP).
 * @param key Eindeutiger Schlüssel (User-ID oder IP)
 * @param limit Max. Anzahl Requests im Fenster
 * @param windowMs Fensterdauer in Millisekunden
 * @returns allowed, remaining, retryAfter (Sekunden, nur bei allowed: false)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanupIfNeeded(now);

  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    if (process.env.NODE_ENV !== "test") {
      console.error("[rateLimit] Limit überschritten", { limit, windowSec: Math.ceil(windowMs / 1000) });
    }
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

/** Client-IP aus Request-Headern (Vercel/Proxy-kompatibel). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

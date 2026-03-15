# Rate Limiting (API)

Minimales In-Memory-Rate-Limiting für ausgewählte API-Routen. Keine DB, keine externen Dienste.

## Gesetzte Limits

| Route | Schlüssel | Limit | Fenster | Antwort bei Überschreitung |
|-------|-----------|--------|---------|----------------------------|
| `POST /api/score` | User-ID (eingeloggt) | 5 | 1 Minute | 429, `Retry-After`-Header |
| `POST /api/analyze-vortext` | User-ID (eingeloggt) | 5 | 1 Minute | 429, `Retry-After`-Header |
| `POST /api/contact` | Client-IP | 5 | 10 Minuten | 429, `Retry-After`-Header |

## Wie es greift

- **Fixed Window:** Pro Schlüssel wird ein Zeitfenster (z. B. 1 Min) betrachtet. Sobald die Anzahl Requests im Fenster das Limit erreicht, folgen 429-Antworten bis das Fenster abläuft.
- **Score / Analyze-Vortext:** Nur eingeloggte Nutzer können die Route aufrufen (401 ohne Login). Das Limit gilt pro Nutzer (Supabase User-ID).
- **Contact:** Das Limit gilt pro Client-IP (`x-forwarded-for` bzw. `x-real-ip`). Ohne IP-Fallback: Schlüssel `"unknown"` (alle teilen sich dann ein Limit).

## Antwort bei 429

- **Score / Analyze-Vortext:** `{ "error": "Zu viele Anfragen. Bitte kurz warten." }`
- **Contact:** `{ "error": "Zu viele Anfragen. Bitte später erneut versuchen." }`
- Header `Retry-After: <Sekunden>` gibt an, nach wie vielen Sekunden ein erneuter Versuch sinnvoll ist.

## Technik

- Implementierung: `lib/rateLimit.ts` (In-Memory-Map, fixed window).
- Pro Server-Instanz getrennt; bei mehreren Instanzen (z. B. Vercel) gilt das Limit pro Instanz, nicht global.
- Alte Einträge werden bei Bedarf bereinigt (keine sensiblen Daten in Logs; nur generisches „Limit überschritten“ mit limit/window).

## Tests

- **Manuell:** Z. B. 6× innerhalb einer Minute `POST /api/score` als gleicher User → 6. Request sollte 429 liefern.
- **Contact:** 6× von gleicher IP in 10 Min → 6. Request 429.
- In Tests (`NODE_ENV=test`) wird bei Limit-Überschreitung kein Log geschrieben.

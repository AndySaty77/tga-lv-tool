# TGA-LV-Tool online stellen

## 1. Code bereitmachen

- Änderungen committen und auf GitHub (oder anderes Git-Remote) pushen.
- **Wichtig:** `.env.local` und alle `.env*` stehen in `.gitignore` – keine Secrets ins Repo pushen.

## 2. Bei Vercel deployen (empfohlen für Next.js)

1. **Account:** [vercel.com](https://vercel.com) – mit GitHub anmelden.
2. **New Project:** "Add New" → "Project" → Repo `tga-lv-tool` auswählen (oder per Git-URL importieren).
3. **Einstellungen:**
   - Framework: Next.js (wird erkannt)
   - Build Command: `npm run build`
   - Output: Standard (kein Static Export)
4. **Environment Variables** (unter "Environment Variables" im Projekt):

   | Name | Wert | Hinweis |
   |------|------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | deine Supabase-URL | z.B. `https://xxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dein Supabase Anon Key | aus Supabase Dashboard → Settings → API |
   | `OPENAI_API_KEY` | dein OpenAI API Key | für LLM-Features (Split, Nachtragsanalyse, Vortext, etc.) |

   Für alle drei "Production", "Preview" und "Development" setzen (oder nur Production, wenn du nur live nutzt).

5. **Deploy** starten – Vercel baut und stellt die App unter einer URL wie `tga-lv-tool-xxx.vercel.app` bereit.

## 3. Nach dem ersten Deploy

- **Supabase:** In Supabase unter "Authentication" → "URL Configuration" die Vercel-URL in "Site URL" / "Redirect URLs" eintragen, falls du später Auth nutzt.
- **Domain (optional):** In Vercel unter "Settings" → "Domains" eine eigene Domain verbinden.

## 4. Andere Hosting-Optionen

- **Eigenes VPS / Server:** `npm run build` und `npm run start` (Port z.B. 3000). Die gleichen Umgebungsvariablen als echte ENV setzen (nicht in Repo).
- **Docker:** Dockerfile mit `npm run build` und `node .next/standalone/server.js` (oder klassisch `npm run start`) – Next.js "standalone" Output in `next.config` aktivieren, falls gewünscht.

## Kurz-Checkliste

- [ ] Repo auf GitHub (o.ä.) gepusht, ohne `.env*`
- [ ] Vercel-Projekt mit diesem Repo verbunden
- [ ] `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel gesetzt
- [ ] `OPENAI_API_KEY` in Vercel gesetzt (wenn LLM-Features genutzt werden)
- [ ] Deploy durchgelaufen, App unter der Vercel-URL erreichbar

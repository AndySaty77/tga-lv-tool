-- Tabelle für Kontakt-/Team-Anfragen (Team / Individuelle Anfrage).
-- Im Supabase SQL Editor ausführen, damit POST /api/contact funktioniert.

create table if not exists contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  company text not null,
  email text not null,
  message text not null,
  phone text,
  team_size text,
  interest text
);

-- Optional: RLS aktivieren und Policy für Service-Role-Insert (Service-Role umgeht RLS).
-- Für öffentliches Formular: nur Service-Role soll schreiben; Lese-Rechte nach Bedarf.

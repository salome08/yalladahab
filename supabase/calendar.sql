-- Yalla Dahab : synchronisation avec le calendrier Airbnb (ou tout calendrier iCal).
-- L'hôte colle dans son annonce le lien « Exporter le calendrier » d'Airbnb ; toutes les heures,
-- la fonction « sync-calendars » lit ce calendrier et enregistre les dates déjà réservées,
-- affichées comme indisponibles sur la fiche. Le script peut être relancé sans danger.

-- Lien du calendrier : privé (seuls l'hôte et l'admin le voient).
create table if not exists public.listing_calendars (
  listing_id text primary key references public.listings (id) on delete cascade,
  ical_url text not null check (ical_url ~ '^https://'),
  last_sync timestamptz,
  last_error text
);

alter table public.listing_calendars enable row level security;
drop policy if exists "calendars: hôte et admin" on public.listing_calendars;
create policy "calendars: hôte et admin" on public.listing_calendars for all
  using (public.is_admin() or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));

-- Dates réservées (date de départ non comprise) : visibles par tous, écrites seulement par la fonction.
create table if not exists public.listing_busy (
  listing_id text not null references public.listings (id) on delete cascade,
  starts date not null,
  ends date not null
);
create index if not exists listing_busy_listing_idx on public.listing_busy (listing_id);

alter table public.listing_busy enable row level security;
drop policy if exists "busy: lecture" on public.listing_busy;
create policy "busy: lecture" on public.listing_busy for select using (true);

-- Toutes les heures, la base appelle la fonction (même mot de passe que les emails d'annonces).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'sync-calendars';
select cron.schedule('sync-calendars', '7 * * * *', $$
  select net.http_post(
    url := 'https://ictttlerigxrpqgqpsxs.supabase.co/functions/v1/sync-calendars',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', public.notify_secret())
  );
$$);

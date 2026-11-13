-- Statistiques de visites (sans cookies ni données personnelles).
-- À coller une seule fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans danger : il ne supprime aucune donnée.
--
-- Chaque ligne est un événement anonyme :
--   view      une page du site ouverte (page = home, listings, listing, events, host, advertise)
--   whatsapp  clic sur « Contacter sur WhatsApp » d'une annonce
--   ad_view   une bannière affichée
--   ad_click  clic sur une bannière
-- first_today : vrai pour la première page vue dans la journée sur cet appareil
-- (sert à compter les visiteurs du jour ; le site ne garde que la date du jour dans le navigateur).
-- source : le site d'où vient le visiteur (facebook.com, google.com…), vide s'il tape l'adresse.

create table if not exists public.site_stats (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('view', 'whatsapp', 'ad_view', 'ad_click')),
  page text check (char_length(page) <= 30),
  listing_id text references public.listings (id) on delete cascade,
  ad_id text references public.ads (id) on delete cascade,
  first_today boolean not null default false,
  source text check (char_length(source) <= 100)
);

create index if not exists site_stats_created_at on public.site_stats (created_at);
create index if not exists site_stats_listing on public.site_stats (listing_id) where listing_id is not null;
create index if not exists site_stats_ad on public.site_stats (ad_id) where ad_id is not null;

alter table public.site_stats enable row level security;

-- Tout le monde peut ajouter un événement (le site le fait pour chaque visiteur),
-- seule l'admin peut lire les lignes.
drop policy if exists "site_stats: ajouter" on public.site_stats;
create policy "site_stats: ajouter" on public.site_stats for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute' and created_at < now() + interval '1 minute');
drop policy if exists "site_stats: admin" on public.site_stats;
create policy "site_stats: admin" on public.site_stats for select using (public.is_admin());

-- ---------- Résumés (les dates sont comptées à l'heure du Caire) ----------

-- Par jour : visiteurs, pages vues, contacts WhatsApp, clics sur les bannières. Admin seulement.
create or replace function public.stats_daily(days int default 30)
returns table (day date, visitors bigint, views bigint, whatsapp bigint, ad_clicks bigint)
language sql stable security definer set search_path = public as $$
  select (s.created_at at time zone 'Africa/Cairo')::date as day,
    count(*) filter (where s.kind = 'view' and s.first_today),
    count(*) filter (where s.kind = 'view'),
    count(*) filter (where s.kind = 'whatsapp'),
    count(*) filter (where s.kind = 'ad_click')
  from public.site_stats s
  where public.is_admin() and s.created_at >= now() - make_interval(days => days)
  group by 1 order by 1;
$$;

-- Par annonce : vues de la fiche et clics WhatsApp.
-- L'admin voit toutes les annonces, un hôte seulement les siennes.
create or replace function public.stats_listings(days int default 30)
returns table (listing_id text, views bigint, whatsapp bigint)
language sql stable security definer set search_path = public as $$
  select s.listing_id,
    count(*) filter (where s.kind = 'view'),
    count(*) filter (where s.kind = 'whatsapp')
  from public.site_stats s
  join public.listings l on l.id = s.listing_id
  where s.created_at >= now() - make_interval(days => days)
    and (public.is_admin() or l.owner_id = auth.uid())
  group by 1;
$$;

-- Par bannière : affichages et clics. Admin seulement.
create or replace function public.stats_ads(days int default 30)
returns table (ad_id text, views bigint, clicks bigint)
language sql stable security definer set search_path = public as $$
  select s.ad_id,
    count(*) filter (where s.kind = 'ad_view'),
    count(*) filter (where s.kind = 'ad_click')
  from public.site_stats s
  where public.is_admin() and s.ad_id is not null and s.created_at >= now() - make_interval(days => days)
  group by 1;
$$;

-- D'où viennent les visiteurs (première page de la journée). Admin seulement.
create or replace function public.stats_sources(days int default 30)
returns table (source text, visitors bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(s.source, ''), 'direct'), count(*)
  from public.site_stats s
  where public.is_admin() and s.kind = 'view' and s.first_today
    and s.created_at >= now() - make_interval(days => days)
  group by 1 order by 2 desc limit 15;
$$;

-- Date du tout premier événement (« comptage depuis le … »). Admin seulement.
create or replace function public.stats_since()
returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(created_at) from public.site_stats where public.is_admin();
$$;

revoke execute on function public.stats_daily(int), public.stats_listings(int), public.stats_ads(int),
  public.stats_sources(int), public.stats_since() from public, anon;
grant execute on function public.stats_daily(int), public.stats_listings(int), public.stats_ads(int),
  public.stats_sources(int), public.stats_since() to authenticated;

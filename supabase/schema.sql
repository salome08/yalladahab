-- Yalla Dahab : base de données Supabase.
-- À coller une seule fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans danger : il ne supprime aucune donnée.

-- ---------- Profils (un par compte) ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  whatsapp text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crée le profil automatiquement à la première connexion.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Vrai pour l'admin connectée au site, et pour l'éditeur SQL de Supabase.
create or replace function public.is_trusted()
returns boolean language sql stable set search_path = public as $$
  select current_user not in ('anon', 'authenticated') or public.is_admin();
$$;

-- Un hôte ne peut pas se donner lui-même les droits d'admin.
create or replace function public.guard_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_trusted() then
    new.is_admin := old.is_admin;
  end if;
  new.id := old.id;
  return new;
end $$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

alter table public.profiles enable row level security;
drop policy if exists "profiles: lire le sien" on public.profiles;
create policy "profiles: lire le sien" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: modifier le sien" on public.profiles;
create policy "profiles: modifier le sien" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- ---------- Annonces ----------
-- status : pending (en attente de validation), published (en ligne),
--          paused (mise en pause par l'hôte), rejected (refusée)

create table if not exists public.listings (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  owner_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'published', 'paused', 'rejected')),
  title jsonb not null default '{}',
  description jsonb not null default '{}',
  area text not null,
  type text not null,
  guests int not null default 2 check (guests > 0),
  bedrooms int not null default 1 check (bedrooms >= 0),
  price_night numeric check (price_night >= 0),
  price_month numeric check (price_month >= 0),
  currency text not null default 'EGP' check (currency in ('EGP', 'USD')),
  wifi_mbps int check (wifi_mbps >= 0),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  hue int not null default 190,
  verified boolean not null default false,
  featured boolean not null default false,
  host_name text not null,
  host_whatsapp text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_owner_idx on public.listings (owner_id);
create index if not exists listings_status_idx on public.listings (status);

-- Ce qu'un hôte peut changer seul : textes, prix, photos, équipements, et la pause.
-- La validation, le badge « vérifié » et la mise en avant restent réservés à l'admin.
create or replace function public.guard_listing()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.verified := false;
    new.featured := false;
    return new;
  end if;
  new.id := old.id;
  new.owner_id := old.owner_id;
  new.verified := old.verified;
  new.featured := old.featured;
  new.created_at := old.created_at;
  if old.status = 'rejected' then
    new.status := 'pending';           -- une annonce refusée et corrigée repasse en validation
  elsif old.status = 'pending' or new.status not in ('published', 'paused') then
    new.status := old.status;          -- seul le passage en ligne ↔ en pause est libre
  end if;
  return new;
end $$;

drop trigger if exists guard_listing on public.listings;
create trigger guard_listing before insert or update on public.listings
  for each row execute function public.guard_listing();

alter table public.listings enable row level security;
drop policy if exists "listings: lecture" on public.listings;
create policy "listings: lecture" on public.listings for select
  using (status = 'published' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "listings: créer" on public.listings;
create policy "listings: créer" on public.listings for insert to authenticated
  with check (true);
drop policy if exists "listings: modifier" on public.listings;
create policy "listings: modifier" on public.listings for update
  using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "listings: supprimer" on public.listings;
create policy "listings: supprimer" on public.listings for delete
  using (owner_id = auth.uid() or public.is_admin());

-- ---------- Agenda ----------

create table if not exists public.events (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  date date not null,
  time text not null default '',
  category text not null,
  title jsonb not null default '{}',
  description jsonb not null default '{}',
  place text not null default '',
  price text not null default '',
  featured boolean not null default false,
  hue int not null default 200,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
drop policy if exists "events: lecture" on public.events;
create policy "events: lecture" on public.events for select using (true);
drop policy if exists "events: admin" on public.events;
create policy "events: admin" on public.events for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Bannières publicitaires ----------
-- slot : home (accueil) ou search (résultats et agenda).
-- Une bannière s'affiche si active est vrai et que la date du jour est entre starts_on et ends_on.

create table if not exists public.ads (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  slot text not null check (slot in ('home', 'search')),
  active boolean not null default true,
  starts_on date,
  ends_on date,
  title jsonb not null default '{}',
  text jsonb not null default '{}',
  cta jsonb not null default '{}',
  link text not null default '',
  hue int not null default 280,
  advertiser text not null default '',
  created_at timestamptz not null default now()
);

alter table public.ads enable row level security;
drop policy if exists "ads: lecture" on public.ads;
create policy "ads: lecture" on public.ads for select
  using ((active and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date))
         or public.is_admin());
drop policy if exists "ads: admin" on public.ads;
create policy "ads: admin" on public.ads for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Photos ----------
-- Chaque hôte dépose ses photos dans un dossier à son nom ; tout le monde peut les voir.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "photos: déposer dans son dossier" on storage.objects;
create policy "photos: déposer dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos: supprimer les siennes" on storage.objects;
create policy "photos: supprimer les siennes" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Yalla Dahab : demandes de bannières et d'événements à la une.
-- Un bar ou un organisateur remplit le formulaire de la page Publicité (sans compte) ;
-- la demande arrive dans l'espace admin, onglet « Demandes pub ». Quand l'admin la marque
-- payée, la bannière ou l'événement est créé et s'affiche tout seul pendant la période payée.
-- À coller dans Supabase → SQL Editor → New query → Run. Le script peut être relancé sans danger.

-- Tarifs en EGP, les mêmes que AD_PRICES dans assets/js/app.js.
create or replace function public.ad_price(kind text)
returns numeric language sql immutable as $$
  select case kind when 'home' then 1500 when 'search' then 800 when 'event' then 300 end::numeric;
$$;

-- kind : home (bannière accueil), search (bannière résultats et agenda), event (événement à la une)
-- status : new (à traiter), paid (payée, en ligne), rejected (refusée)
create table if not exists public.ad_requests (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  kind text not null check (kind in ('home', 'search', 'event')),
  status text not null default 'new' check (status in ('new', 'paid', 'rejected')),
  business text not null check (length(business) between 1 and 120),
  whatsapp text not null check (length(whatsapp) between 6 and 30),
  email text check (length(email) <= 200),
  starts_on date not null,
  weeks int not null default 1 check (weeks between 1 and 12),
  amount numeric not null default 0,
  title text not null check (length(title) between 1 and 120),
  text text not null default '' check (length(text) <= 400),
  link text not null default '' check (length(link) <= 500),
  event_time text not null default '' check (length(event_time) <= 20),
  event_place text not null default '' check (length(event_place) <= 120),
  event_price text not null default '' check (length(event_price) <= 60),
  event_category text not null default 'party'
    check (event_category in ('party', 'yoga', 'diving', 'market', 'music', 'workshop')),
  payment_method text,
  paid_at timestamptz,
  ad_id text references public.ads (id) on delete set null,
  event_id text references public.events (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ad_requests_status_idx on public.ad_requests (status);

-- Une demande envoyée depuis le site part toujours « à traiter », au bon prix.
create or replace function public.guard_ad_request()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_trusted() then
    return new;
  end if;
  if new.kind = 'event' then
    new.weeks := 1;
  end if;
  if new.starts_on < current_date then
    raise exception 'The start date is in the past';
  end if;
  new.status := 'new';
  new.amount := public.ad_price(new.kind) * new.weeks;
  new.payment_method := null;
  new.paid_at := null;
  new.ad_id := null;
  new.event_id := null;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists guard_ad_request on public.ad_requests;
create trigger guard_ad_request before insert on public.ad_requests
  for each row execute function public.guard_ad_request();

-- Tout le monde peut envoyer une demande ; seule l'admin les lit et les traite.
alter table public.ad_requests enable row level security;
grant insert on public.ad_requests to anon, authenticated;
grant select, update, delete on public.ad_requests to authenticated;
drop policy if exists "ad_requests: envoyer" on public.ad_requests;
create policy "ad_requests: envoyer" on public.ad_requests for insert to anon, authenticated
  with check (true);
drop policy if exists "ad_requests: admin" on public.ad_requests;
create policy "ad_requests: admin" on public.ad_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- « Payé » dans l'espace admin : crée la bannière ou l'événement, puis marque la demande payée.
-- Une bannière payée en retard démarre le jour du paiement, pour que l'annonceur ait toutes ses semaines.
create or replace function public.mark_ad_request_paid(request_id text, method text)
returns public.ad_requests language plpgsql set search_path = public as $$
declare
  r public.ad_requests;
  new_id text;
  start_day date;
  contact text;
begin
  if not public.is_admin() then
    raise exception 'Only the administrator can do this';
  end if;
  select * into r from public.ad_requests where id = request_id for update;
  if r.id is null then
    raise exception 'Request not found';
  end if;
  if r.status = 'paid' then
    return r;
  end if;
  contact := 'https://wa.me/' || regexp_replace(r.whatsapp, '\D', '', 'g');

  if r.kind = 'event' then
    insert into public.events (date, time, category, title, description, place, price, featured, hue)
    values (r.starts_on, r.event_time, r.event_category, jsonb_build_object('en', r.title),
            jsonb_build_object('en', r.text), r.event_place, r.event_price, true, floor(random() * 360)::int)
    returning id into new_id;
    update public.ad_requests set event_id = new_id where id = r.id;
  else
    start_day := greatest(r.starts_on, current_date);
    insert into public.ads (slot, active, starts_on, ends_on, title, text, cta, link, hue, advertiser)
    values (r.kind, true, start_day, start_day + r.weeks * 7 - 1,
            jsonb_build_object('en', r.title), jsonb_build_object('en', r.text),
            case when r.link = '' then jsonb_build_object('en', 'Message on WhatsApp', 'fr', 'Écrire sur WhatsApp')
                 else jsonb_build_object('en', 'Find out more', 'fr', 'En savoir plus') end,
            coalesce(nullif(r.link, ''), contact), floor(random() * 360)::int, r.business)
    returning id into new_id;
    update public.ad_requests set ad_id = new_id where id = r.id;
  end if;

  update public.ad_requests set status = 'paid', paid_at = now(), payment_method = method
  where id = r.id returning * into r;
  return r;
end $$;

revoke execute on function public.mark_ad_request_paid(text, text) from public, anon;
grant execute on function public.mark_ad_request_paid(text, text) to authenticated;

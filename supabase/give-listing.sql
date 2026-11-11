-- Yalla Dahab : « Donner l'annonce à l'hôte ».
-- L'admin crée une annonce pour un hôte, puis la donne à son compte quand il s'inscrit.
-- À coller une seule fois dans Supabase → SQL Editor → New query → Run (sans danger si relancé).

create or replace function public.give_listing(listing_id text, host_email text)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  host_id uuid;
  result public.listings;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  select id into host_id from auth.users where lower(email) = lower(trim(host_email)) limit 1;
  if host_id is null then
    raise exception 'NO_ACCOUNT';
  end if;
  insert into public.profiles (id) values (host_id) on conflict do nothing;
  update public.listings set owner_id = host_id where id = listing_id returning * into result;
  if result.id is null then
    raise exception 'NO_LISTING';
  end if;
  -- Profil encore vide : on reprend le nom et le WhatsApp de l'annonce.
  update public.profiles p
     set name = coalesce(nullif(p.name, ''), result.host_name),
         whatsapp = coalesce(nullif(p.whatsapp, ''), result.host_whatsapp)
   where p.id = host_id;
  return result;
end $$;

revoke execute on function public.give_listing(text, text) from public, anon;
grant execute on function public.give_listing(text, text) to authenticated;

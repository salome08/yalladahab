-- Yalla Dahab : emails automatiques sur les annonces.
-- Quand une annonce attend une validation, la base appelle la fonction « notify-listing »
-- (supabase/functions/notify-listing) qui envoie un email à l'admin ; quand l'admin la valide
-- ou la refuse, l'hôte reçoit un email. Le script peut être relancé sans danger.

create extension if not exists pg_net with schema extensions;

-- Mot de passe partagé entre la base et la fonction, créé au hasard et gardé dans le coffre (Vault).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notify_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_secret');
  end if;
end $$;

-- Lu par la fonction (clé service_role) pour vérifier que l'appel vient bien de la base.
create or replace function public.notify_secret()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret';
$$;
revoke execute on function public.notify_secret() from public, anon, authenticated;
grant execute on function public.notify_secret() to service_role;

create or replace function public.notify_listing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind text;
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    kind := 'pending';
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('published', 'rejected') then
    kind := new.status;
  else
    return null;
  end if;
  perform net.http_post(
    url := 'https://ictttlerigxrpqgqpsxs.supabase.co/functions/v1/notify-listing',
    body := jsonb_build_object('id', new.id, 'kind', kind),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', public.notify_secret())
  );
  return null;
end $$;
revoke execute on function public.notify_listing() from public, anon, authenticated;

drop trigger if exists notify_listing on public.listings;
create trigger notify_listing after insert or update of status on public.listings
  for each row execute function public.notify_listing();

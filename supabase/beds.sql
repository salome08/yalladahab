-- Nombre de lits par annonce (vide tant que l'hôte ne l'a pas indiqué).
alter table public.listings add column if not exists beds int check (beds > 0);

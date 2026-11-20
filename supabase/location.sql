-- Localisation approximative d'une annonce (lue sur Airbnb lors de l'import).
-- show_location : l'hôte a coché « Afficher la localisation approximative sur la carte ».
-- Sans cette case (ou sans point), la carte montre seulement le quartier.
alter table public.listings add column if not exists lat double precision check (lat between -90 and 90);
alter table public.listings add column if not exists lng double precision check (lng between -180 and 180);
alter table public.listings add column if not exists show_location boolean not null default false;

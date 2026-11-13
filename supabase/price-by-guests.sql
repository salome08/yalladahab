-- Prix par nuit selon le nombre de personnes (facultatif), ex. {"3": 2750, "4": 3000}.
-- Vide = le prix ne change pas avec le nombre de personnes.
alter table public.listings add column if not exists price_by_guests jsonb
  check (price_by_guests is null or jsonb_typeof(price_by_guests) = 'object');

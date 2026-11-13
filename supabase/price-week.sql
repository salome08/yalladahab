-- Prix à la semaine (facultatif).
alter table public.listings add column if not exists price_week numeric check (price_week >= 0);

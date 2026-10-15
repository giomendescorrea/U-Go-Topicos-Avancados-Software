create extension if not exists pgcrypto;

create table if not exists public.driver_routes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  driver_name text not null default '',
  name text not null,
  origin text not null,
  destination text not null,
  departure_time time not null,
  return_time time not null,
  seats integer not null check (seats > 0),
  occupied_seats integer not null default 0 check (occupied_seats >= 0 and occupied_seats <= seats),
  price numeric(12, 2) not null check (price > 0),
  days text[] not null default array['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  vehicle text not null default '',
  pickup_points jsonb not null default '[]'::jsonb check (jsonb_typeof(pickup_points) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_routes_driver_id_idx
  on public.driver_routes(driver_id);

alter table public.driver_routes enable row level security;

drop policy if exists "Drivers can read own routes" on public.driver_routes;
drop policy if exists "Drivers and students can read routes" on public.driver_routes;
create policy "Drivers and students can read routes"
  on public.driver_routes
  for select
  to authenticated
  using (
    auth.uid() = driver_id
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'student'
  );

drop policy if exists "Drivers can create own routes" on public.driver_routes;
create policy "Drivers can create own routes"
  on public.driver_routes
  for insert
  to authenticated
  with check (auth.uid() = driver_id);

drop policy if exists "Drivers can update own routes" on public.driver_routes;
create policy "Drivers can update own routes"
  on public.driver_routes
  for update
  to authenticated
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

drop policy if exists "Drivers can delete own routes" on public.driver_routes;
create policy "Drivers can delete own routes"
  on public.driver_routes
  for delete
  to authenticated
  using (auth.uid() = driver_id);

grant select, insert, update, delete on public.driver_routes to authenticated;

notify pgrst, 'reload schema';

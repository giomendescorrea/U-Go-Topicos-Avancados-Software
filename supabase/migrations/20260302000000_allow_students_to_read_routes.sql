alter table public.driver_routes
  add column if not exists driver_name text not null default '';

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

notify pgrst, 'reload schema';

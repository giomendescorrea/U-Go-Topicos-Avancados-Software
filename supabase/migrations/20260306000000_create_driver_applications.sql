create table if not exists public.driver_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  cpf text not null default '',
  cnh text not null default '',
  plate text not null default '',
  vehicle text not null default '',
  seats integer not null default 0 check (seats >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_applications enable row level security;

drop policy if exists "Drivers read own application"
  on public.driver_applications;
create policy "Drivers read own application"
  on public.driver_applications
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.driver_applications to authenticated;

create or replace function public.sync_driver_application_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('driver_status', new.status)
  where id = new.user_id;

  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status <> old.status then
    new.reviewed_at := case
      when new.status in ('approved', 'rejected') then now()
      else null
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_driver_application_status() from public;

drop trigger if exists sync_driver_application_status
  on public.driver_applications;
create trigger sync_driver_application_status
  before insert or update of status
  on public.driver_applications
  for each row
  execute function public.sync_driver_application_status();

-- Motoristas cadastrados antes desta migration continuam com acesso.
insert into public.driver_applications (
  user_id,
  email,
  full_name,
  cpf,
  cnh,
  plate,
  vehicle,
  seats,
  status,
  reviewed_at,
  created_at
)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  coalesce(raw_user_meta_data ->> 'cpf', ''),
  coalesce(raw_user_meta_data ->> 'cnh', ''),
  coalesce(raw_user_meta_data ->> 'plate', ''),
  coalesce(raw_user_meta_data ->> 'vehicle', ''),
  case
    when coalesce(raw_user_meta_data ->> 'seats', '') ~ '^[0-9]+$'
      then (raw_user_meta_data ->> 'seats')::integer
    else 0
  end,
  'approved',
  now(),
  created_at
from auth.users
where raw_user_meta_data ->> 'role' = 'driver'
on conflict (user_id) do nothing;

create or replace function public.create_driver_application()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.raw_user_meta_data ->> 'role' = 'driver' then
    insert into public.driver_applications (
      user_id,
      email,
      full_name,
      cpf,
      cnh,
      plate,
      vehicle,
      seats,
      status
    )
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      coalesce(new.raw_user_meta_data ->> 'cpf', ''),
      coalesce(new.raw_user_meta_data ->> 'cnh', ''),
      coalesce(new.raw_user_meta_data ->> 'plate', ''),
      coalesce(new.raw_user_meta_data ->> 'vehicle', ''),
      case
        when coalesce(new.raw_user_meta_data ->> 'seats', '') ~ '^[0-9]+$'
          then (new.raw_user_meta_data ->> 'seats')::integer
        else 0
      end,
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.create_driver_application() from public;

drop trigger if exists create_driver_application on auth.users;
create trigger create_driver_application
  after insert on auth.users
  for each row
  execute function public.create_driver_application();

drop policy if exists "Drivers and students can read routes"
  on public.driver_routes;
create policy "Drivers and students can read routes"
  on public.driver_routes
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'student'
    or (
      auth.uid() = driver_id
      and coalesce(
        auth.jwt() -> 'app_metadata' ->> 'driver_status',
        ''
      ) = 'approved'
    )
  );

drop policy if exists "Drivers can create own routes" on public.driver_routes;
create policy "Drivers can create own routes"
  on public.driver_routes
  for insert
  to authenticated
  with check (
    auth.uid() = driver_id
    and coalesce(
      auth.jwt() -> 'app_metadata' ->> 'driver_status',
      ''
    ) = 'approved'
  );

drop policy if exists "Drivers can update own routes" on public.driver_routes;
create policy "Drivers can update own routes"
  on public.driver_routes
  for update
  to authenticated
  using (
    auth.uid() = driver_id
    and coalesce(
      auth.jwt() -> 'app_metadata' ->> 'driver_status',
      ''
    ) = 'approved'
  )
  with check (
    auth.uid() = driver_id
    and coalesce(
      auth.jwt() -> 'app_metadata' ->> 'driver_status',
      ''
    ) = 'approved'
  );

drop policy if exists "Drivers can delete own routes" on public.driver_routes;
create policy "Drivers can delete own routes"
  on public.driver_routes
  for delete
  to authenticated
  using (
    auth.uid() = driver_id
    and coalesce(
      auth.jwt() -> 'app_metadata' ->> 'driver_status',
      ''
    ) = 'approved'
  );

notify pgrst, 'reload schema';

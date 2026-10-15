create table if not exists public.route_memberships (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.driver_routes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  route_name text not null,
  driver_id uuid not null references auth.users(id) on delete cascade,
  driver_name text not null,
  start_date date not null,
  end_date date not null,
  monthly_price numeric(12, 2) not null check (monthly_price > 0),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists route_memberships_active_student_route_idx
  on public.route_memberships(route_id, student_id)
  where status = 'active';

create index if not exists route_memberships_driver_id_idx
  on public.route_memberships(driver_id);

alter table public.route_memberships enable row level security;

drop policy if exists "Students and drivers can read route memberships"
  on public.route_memberships;
create policy "Students and drivers can read route memberships"
  on public.route_memberships
  for select
  to authenticated
  using (auth.uid() = student_id or auth.uid() = driver_id);

grant select on public.route_memberships to authenticated;

create or replace function public.join_driver_route(
  p_route_id uuid,
  p_start_date date default current_date,
  p_duration_months integer default 12
)
returns public.route_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_student_id uuid := auth.uid();
  selected_route public.driver_routes;
  membership public.route_memberships;
  student_name text;
begin
  if current_student_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'student' then
    raise exception 'Somente universitários podem aderir a uma rota.';
  end if;

  if p_duration_months < 1 then
    raise exception 'A duração do contrato deve ser maior que zero.';
  end if;

  select *
  into selected_route
  from public.driver_routes
  where id = p_route_id
  for update;

  if not found then
    raise exception 'Rota não encontrada.';
  end if;

  if selected_route.driver_id = current_student_id then
    raise exception 'O motorista não pode aderir à própria rota.';
  end if;

  if selected_route.occupied_seats >= selected_route.seats then
    raise exception 'Esta rota não possui vagas disponíveis.';
  end if;

  if exists (
    select 1
    from public.route_memberships
    where route_id = p_route_id
      and student_id = current_student_id
      and status = 'active'
  ) then
    raise exception 'Já existe um contrato ativo para esta rota.';
  end if;

  student_name := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() ->> 'email',
    'Universitário'
  );

  insert into public.route_memberships (
    route_id,
    student_id,
    student_name,
    route_name,
    driver_id,
    driver_name,
    start_date,
    end_date,
    monthly_price
  )
  values (
    selected_route.id,
    current_student_id,
    student_name,
    selected_route.name,
    selected_route.driver_id,
    selected_route.driver_name,
    p_start_date,
    (p_start_date + make_interval(months => p_duration_months))::date,
    selected_route.price
  )
  returning * into membership;

  update public.driver_routes
  set occupied_seats = occupied_seats + 1,
      updated_at = now()
  where id = selected_route.id;

  return membership;
end;
$$;

create or replace function public.leave_driver_route_membership(
  p_membership_id uuid
)
returns public.route_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_student_id uuid := auth.uid();
  membership public.route_memberships;
begin
  select *
  into membership
  from public.route_memberships
  where id = p_membership_id
    and student_id = current_student_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Contrato ativo não encontrado.';
  end if;

  update public.route_memberships
  set status = 'cancelled',
      updated_at = now()
  where id = membership.id
  returning * into membership;

  update public.driver_routes
  set occupied_seats = greatest(0, occupied_seats - 1),
      updated_at = now()
  where id = membership.route_id;

  return membership;
end;
$$;

revoke all on function public.join_driver_route(uuid, date, integer) from public;
revoke all on function public.leave_driver_route_membership(uuid) from public;
grant execute on function public.join_driver_route(uuid, date, integer)
  to authenticated;
grant execute on function public.leave_driver_route_membership(uuid)
  to authenticated;

notify pgrst, 'reload schema';

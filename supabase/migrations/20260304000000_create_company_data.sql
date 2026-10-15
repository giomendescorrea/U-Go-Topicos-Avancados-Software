create table if not exists public.company_collaborators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  cpf text not null default '',
  phone text not null default '',
  address text not null default '',
  department text not null default '',
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  needs_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_collaborators_company_email_idx
  on public.company_collaborators(company_id, lower(email));

create table if not exists public.company_routes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  origin text not null,
  destination text not null,
  departure_time time not null,
  return_time time not null,
  seats integer not null check (seats > 0),
  occupied_seats integer not null default 0
    check (occupied_seats >= 0 and occupied_seats <= seats),
  price numeric(12, 2) not null check (price > 0),
  days text[] not null default array['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  freight_company text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_routes_company_id_idx
  on public.company_routes(company_id);

create table if not exists public.company_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.company_routes(id) on delete cascade,
  party text not null,
  provider text not null,
  start_date date not null,
  end_date date not null,
  value numeric(12, 2) not null check (value > 0),
  status text not null default 'active'
    check (status in ('active', 'pending', 'expired', 'cancelled')),
  vehicles jsonb not null default '[]'::jsonb
    check (jsonb_typeof(vehicles) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_contracts_company_id_idx
  on public.company_contracts(company_id);

alter table public.company_collaborators enable row level security;
alter table public.company_routes enable row level security;
alter table public.company_contracts enable row level security;

drop policy if exists "Companies read own collaborators"
  on public.company_collaborators;
create policy "Companies read own collaborators"
  on public.company_collaborators for select to authenticated
  using (
    company_id = auth.uid()
    or auth_user_id = auth.uid()
  );

drop policy if exists "Companies update own collaborators"
  on public.company_collaborators;
create policy "Companies update own collaborators"
  on public.company_collaborators for update to authenticated
  using (company_id = auth.uid())
  with check (company_id = auth.uid());

drop policy if exists "Companies delete own collaborators"
  on public.company_collaborators;
create policy "Companies delete own collaborators"
  on public.company_collaborators for delete to authenticated
  using (company_id = auth.uid());

drop policy if exists "Companies and collaborators read company routes"
  on public.company_routes;
create policy "Companies and collaborators read company routes"
  on public.company_routes for select to authenticated
  using (
    company_id = auth.uid()
    or exists (
      select 1
      from public.company_collaborators
      where company_collaborators.company_id = company_routes.company_id
        and company_collaborators.auth_user_id = auth.uid()
        and company_collaborators.status = 'active'
    )
  );

drop policy if exists "Companies create own routes" on public.company_routes;
create policy "Companies create own routes"
  on public.company_routes for insert to authenticated
  with check (company_id = auth.uid());

drop policy if exists "Companies update own routes" on public.company_routes;
create policy "Companies update own routes"
  on public.company_routes for update to authenticated
  using (company_id = auth.uid())
  with check (company_id = auth.uid());

drop policy if exists "Companies delete own routes" on public.company_routes;
create policy "Companies delete own routes"
  on public.company_routes for delete to authenticated
  using (company_id = auth.uid());

drop policy if exists "Companies read own contracts"
  on public.company_contracts;
create policy "Companies read own contracts"
  on public.company_contracts for select to authenticated
  using (company_id = auth.uid());

drop policy if exists "Companies create own contracts"
  on public.company_contracts;
create policy "Companies create own contracts"
  on public.company_contracts for insert to authenticated
  with check (company_id = auth.uid());

drop policy if exists "Companies update own contracts"
  on public.company_contracts;
create policy "Companies update own contracts"
  on public.company_contracts for update to authenticated
  using (company_id = auth.uid())
  with check (company_id = auth.uid());

drop policy if exists "Companies delete own contracts"
  on public.company_contracts;
create policy "Companies delete own contracts"
  on public.company_contracts for delete to authenticated
  using (company_id = auth.uid());

grant select, update, delete on public.company_collaborators to authenticated;
grant select, insert, update, delete on public.company_routes to authenticated;
grant select, insert, update, delete on public.company_contracts to authenticated;

notify pgrst, 'reload schema';

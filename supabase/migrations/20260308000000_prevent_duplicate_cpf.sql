create or replace function public.prevent_duplicate_auth_cpf()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_cpf text;
begin
  normalized_cpf := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'cpf', ''),
    '[^0-9]',
    '',
    'g'
  );

  if normalized_cpf = '' then
    return new;
  end if;

  -- Serializa cadastros do mesmo CPF para evitar duplicidade simultânea.
  perform pg_advisory_xact_lock(hashtextextended(normalized_cpf, 0));

  if exists (
    select 1
    from auth.users
    where id <> new.id
      and regexp_replace(
        coalesce(raw_user_meta_data ->> 'cpf', ''),
        '[^0-9]',
        '',
        'g'
      ) = normalized_cpf
  ) then
    raise exception 'cpf_already_exists'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_duplicate_auth_cpf() from public;

drop trigger if exists prevent_duplicate_auth_cpf on auth.users;
create trigger prevent_duplicate_auth_cpf
  before insert or update of raw_user_meta_data
  on auth.users
  for each row
  execute function public.prevent_duplicate_auth_cpf();

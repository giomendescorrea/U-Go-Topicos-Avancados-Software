update auth.users
set
  raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'admin'),
  raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'admin',
      'full_name', 'Administração U-Go'
    )
where lower(coalesce(email, '')) = 'administracao.ugo@gmail.com';

do $$
begin
  if not exists (
    select 1
    from auth.users
    where lower(coalesce(email, '')) = 'administracao.ugo@gmail.com'
      and raw_app_meta_data ->> 'role' = 'admin'
  ) then
    raise exception
      'Crie primeiro a conta administracao.ugo@gmail.com em Authentication > Users e execute novamente esta migration.';
  end if;
end;
$$;

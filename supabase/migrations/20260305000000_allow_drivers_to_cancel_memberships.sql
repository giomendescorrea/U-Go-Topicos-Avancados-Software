create or replace function public.leave_driver_route_membership(
  p_membership_id uuid
)
returns public.route_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  membership public.route_memberships;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select *
  into membership
  from public.route_memberships
  where id = p_membership_id
    and status = 'active'
    and (
      student_id = current_user_id
      or driver_id = current_user_id
    )
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

revoke all on function public.leave_driver_route_membership(uuid) from public;
grant execute on function public.leave_driver_route_membership(uuid)
  to authenticated;

create or replace function public.mark_collaborator_password_set()
returns void
language sql
security definer
set search_path = public
as $$
  update public.company_collaborators
  set needs_password = false,
      updated_at = now()
  where auth_user_id = auth.uid();
$$;

revoke all on function public.mark_collaborator_password_set() from public;
grant execute on function public.mark_collaborator_password_set()
  to authenticated;

notify pgrst, 'reload schema';

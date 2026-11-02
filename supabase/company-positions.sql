-- Business positions share existing staff authorization; no new manager-wide role.
-- Existing roles/memberships are not reassigned by this migration.
alter table public.profiles add column staff_position text not null default 'manager'
 check(staff_position in ('manager','buyer'));
create function public.protect_staff_position() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('postgres','service_role','supabase_auth_admin') then return new;end if;
 if (tg_op='INSERT' and new.staff_position<>'manager') or
    (tg_op='UPDATE' and new.staff_position is distinct from old.staff_position) then
  raise exception 'Position must be assigned by company management' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.protect_staff_position() from public,anon,authenticated;
create trigger staff_position_guard before insert or update on public.profiles
for each row execute function public.protect_staff_position();

create or replace function public.company_branch_context() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('company_id',p.company_id,'branch_id',b.branch_id,
 'branch_role',b.branch_role,'can_manage',app_private.branch_can_manage(p.company_id),
 'can_assign_network_director',public.is_saletrening_super_admin(),
 'position',case when b.branch_role='branch_director' then 'branch_director'
 when p.role='director' then 'network_director' when p.role='admin' then 'admin' else p.staff_position end)
 from public.profiles p left join public.company_branch_members b
 on b.company_id=p.company_id and b.user_id=p.id
 where p.id=(select auth.uid()) and p.company_id=app_private.branch_company()
$$;
-- Versioned read endpoint leaves the old assignment endpoint's result contract intact.
create function public.company_position_candidates(p_company_id uuid)
returns table(employee_id uuid,employee_name text,branch_id uuid,branch_role text,position text)
language sql stable security definer set search_path='' as $$
 select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник'),
 b.branch_id,b.branch_role,case when m.role='director' then 'network_director'
 when b.branch_role='branch_director' then 'branch_director' else p.staff_position end
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 left join public.company_branch_members b on b.company_id=p.company_id and b.user_id=p.id
 where p.company_id=p_company_id and m.status='active'
 and (m.role in ('employee','manager') or (m.role='director' and public.is_saletrening_super_admin()))
 and app_private.branch_can_manage(p_company_id) order by p.first_name,p.last_name,p.id
$$;
-- Cards use actual positions for the same roster the caller may read already.
create function public.company_team_positions()
returns table(employee_id uuid,position text)
language sql stable security definer set search_path='' as $$
 select p.id,case when b.branch_role='branch_director' then 'branch_director'
 when m.role='director' then 'network_director' when m.role='admin' then 'admin' else p.staff_position end
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 left join public.company_branch_members b on b.company_id=p.company_id and b.user_id=p.id
 where p.company_id=app_private.branch_company() and m.status='active'
 and app_private.branch_can_read(p.company_id,p.id)
$$;

create or replace function public.set_company_position(p_company_id uuid,p_employee_id uuid,p_position text,p_branch_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare target record; platform_admin boolean:=coalesce(public.is_saletrening_super_admin(),false);
 normalized text:=case when p_position='employee' then 'manager' else p_position end;
begin
 if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode='42501';end if;
 if normalized is null or normalized not in ('manager','buyer','branch_director','network_director') then raise exception 'Invalid position' using errcode='22023';end if;
 if normalized='network_director' and not platform_admin then raise exception 'Administrator required' using errcode='42501';end if;
 if not platform_admin and not coalesce(app_private.branch_can_manage(p_company_id),false) then raise exception 'Permission denied' using errcode='42501';end if;
 select p.id,p.is_super_admin,m.role into target from public.profiles p join public.organization_members m
 on m.user_id=p.id and m.company_id=p.company_id
 where p.id=p_employee_id and p.company_id=p_company_id and m.status='active' for update of p,m;
 if not found then raise exception 'Employee not in company' using errcode='22023';end if;
 if target.role='admin' or (target.is_super_admin and normalized<>'network_director') then raise exception 'Administrator account is protected' using errcode='42501';end if;
 if target.role='director' and not platform_admin then raise exception 'Administrator required' using errcode='42501';end if;
 if normalized='network_director' then
  delete from public.company_branch_members where company_id=p_company_id and user_id=p_employee_id;
  update public.profiles set role='director',staff_position='manager',updated_at=now() where id=p_employee_id;
  update public.organization_members set role='director',updated_at=now() where company_id=p_company_id and user_id=p_employee_id;
 else
  if normalized='branch_director' and p_branch_id is null then raise exception 'Branch required' using errcode='22023';end if;
  if p_branch_id is not null and not exists(select 1 from public.company_branches where id=p_branch_id and company_id=p_company_id) then raise exception 'Branch not in company' using errcode='22023';end if;
  -- Explicitly assigning either ordinary job title grants exactly employee access.
  update public.profiles set role='employee',staff_position=case when normalized='buyer' then 'buyer' else 'manager' end,updated_at=now() where id=p_employee_id;
  update public.organization_members set role='employee',updated_at=now() where company_id=p_company_id and user_id=p_employee_id;
  if p_branch_id is null then
   delete from public.company_branch_members where company_id=p_company_id and user_id=p_employee_id;
  else
   insert into public.company_branch_members(company_id,branch_id,user_id,branch_role)
   values(p_company_id,p_branch_id,p_employee_id,case when normalized='branch_director' then 'branch_director' else 'employee' end)
   on conflict(company_id,user_id) do update set branch_id=excluded.branch_id,branch_role=excluded.branch_role;
  end if;
 end if;
end $$;
revoke all on function public.company_position_candidates(uuid),public.company_team_positions() from public,anon;
grant execute on function public.company_position_candidates(uuid),public.company_team_positions() to authenticated;
-- Explicitly retain existing authenticated grants for replaced functions.
revoke all on function public.set_company_position(uuid,uuid,text,uuid),public.company_branch_context() from public,anon;
grant execute on function public.set_company_position(uuid,uuid,text,uuid),public.company_branch_context() to authenticated;

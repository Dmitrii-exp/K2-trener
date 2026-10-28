-- Network director uses the existing director role, preserving all existing access.
-- No existing users are reassigned by this migration.
create or replace function public.protect_profile_membership_fields()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('postgres','service_role','supabase_auth_admin') then return new; end if;
 if new.company_id is distinct from old.company_id or new.role is distinct from old.role then
   raise exception 'membership_fields_immutable' using errcode='42501';
 end if;
 return new;
end $$;

create function app_private.guard_network_position() returns trigger
language plpgsql security definer set search_path='' as $$
declare protected_change boolean:=false;
begin
 if tg_op='INSERT' then protected_change:=new.role in ('director','admin');
 elsif tg_op='DELETE' then protected_change:=old.role in ('director','admin');
 else
   protected_change:=(new.role is distinct from old.role or new.company_id is distinct from old.company_id)
     and (old.role in ('director','admin') or new.role in ('director','admin'));
   if tg_table_name='organization_members' then
     protected_change:=protected_change or (new.user_id is distinct from old.user_id and (old.role in ('director','admin') or new.role in ('director','admin')));
   end if;
 end if;
 if protected_change
 and not (current_setting('role',true)='service_role' or
   ((select auth.uid()) is null and current_setting('role',true) not in ('authenticated','anon')))
 and not coalesce(public.is_saletrening_super_admin(),false) then
   raise exception 'Only the platform administrator can assign or change the network director' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function app_private.guard_network_position() from public,anon,authenticated;
create trigger network_position_guard before insert or update or delete on public.organization_members
for each row execute function app_private.guard_network_position();
create trigger network_position_guard before insert or update on public.profiles
for each row execute function app_private.guard_network_position();
-- Also close role escalation through directly-created invitations.
create trigger network_position_guard before insert or update on public.company_invitations
for each row execute function app_private.guard_network_position();
create trigger network_position_guard before insert or update on public.organization_invitations
for each row execute function app_private.guard_network_position();

create or replace function public.company_branch_context() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('company_id',p.company_id,'branch_id',b.branch_id,
 'branch_role',b.branch_role,'can_manage',app_private.branch_can_manage(p.company_id),
 'can_assign_network_director',public.is_saletrening_super_admin())
 from public.profiles p left join public.company_branch_members b
 on b.company_id=p.company_id and b.user_id=p.id
 where p.id=(select auth.uid()) and p.company_id=app_private.branch_company()
$$;
create or replace function public.list_company_branch_candidates(p_company_id uuid)
returns table(employee_id uuid,employee_name text,branch_id uuid,branch_role text)
language sql stable security definer set search_path='' as $$
 select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник'),
 b.branch_id,case when m.role='director' then 'network_director' else b.branch_role end
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 left join public.company_branch_members b on b.company_id=p.company_id and b.user_id=p.id
 where p.company_id=p_company_id and m.status='active'
 and (m.role in ('employee','manager') or (m.role='director' and public.is_saletrening_super_admin()))
 and app_private.branch_can_manage(p_company_id) order by p.first_name,p.last_name,p.id
$$;
create function public.set_company_position(p_company_id uuid,p_employee_id uuid,p_position text,p_branch_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare target record; platform_admin boolean:=coalesce(public.is_saletrening_super_admin(),false);
begin
 if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 if p_position is null or p_position not in ('employee','branch_director','network_director') then raise exception 'Invalid position' using errcode='22023'; end if;
 if p_position='network_director' and not platform_admin then raise exception 'Administrator required' using errcode='42501'; end if;
 if not platform_admin and not coalesce(app_private.branch_can_manage(p_company_id),false) then raise exception 'Permission denied' using errcode='42501'; end if;
 select p.id,p.is_super_admin,m.role into target
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 where p.id=p_employee_id and p.company_id=p_company_id and m.status='active'
 for update of p,m;
 if not found then raise exception 'Employee not in company' using errcode='22023'; end if;
 if target.role='admin' or (target.is_super_admin and p_position<>'network_director') then raise exception 'Administrator account is protected' using errcode='42501'; end if;
 if target.role='director' and not platform_admin then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_position='network_director' then
   delete from public.company_branch_members where company_id=p_company_id and user_id=p_employee_id;
   update public.profiles set role='director',updated_at=now() where id=p_employee_id;
   update public.organization_members set role='director',updated_at=now() where company_id=p_company_id and user_id=p_employee_id;
 else
   if not exists(select 1 from public.company_branches where id=p_branch_id and company_id=p_company_id) then raise exception 'Branch not in company' using errcode='22023'; end if;
   if target.role='director' then
     update public.profiles set role='employee',updated_at=now() where id=p_employee_id;
     update public.organization_members set role='employee',updated_at=now() where company_id=p_company_id and user_id=p_employee_id;
   end if;
   insert into public.company_branch_members(company_id,branch_id,user_id,branch_role)
   values(p_company_id,p_branch_id,p_employee_id,p_position)
   on conflict(company_id,user_id) do update set branch_id=excluded.branch_id,branch_role=excluded.branch_role;
 end if;
end $$;
revoke all on function public.set_company_position(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.set_company_position(uuid,uuid,text,uuid) to authenticated;

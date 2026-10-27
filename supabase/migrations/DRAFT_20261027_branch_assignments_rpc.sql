-- DRAFT: employee assignment; stage-test before applying.
-- Explicit company ID prevents ambiguous multi-company membership.
create or replace function public.assign_company_branch(
 p_company_id uuid, p_branch_id uuid, p_employee_id uuid,
 p_branch_role text default 'employee'
) returns void language plpgsql security definer set search_path=''
as $$
declare v_is_director boolean; v_same_branch boolean;
begin
 if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 if p_branch_role not in ('employee','branch_director') then
   raise exception 'Invalid branch role' using errcode='22023';
 end if;
 select exists(
   select 1 from public.organization_members m
   where m.company_id=p_company_id and m.user_id=(select auth.uid())
     and m.status='active' and m.role in ('director','admin')
 ) into v_is_director;
 if not v_is_director then raise exception 'Permission denied' using errcode='42501'; end if;
 if not exists(select 1 from public.company_branches b
   where b.id=p_branch_id and b.company_id=p_company_id) then
   raise exception 'Branch not in company' using errcode='22023';
 end if;
 if not exists(select 1 from public.organization_members m
   where m.company_id=p_company_id and m.user_id=p_employee_id and m.status='active')
   or not exists(select 1 from public.profiles p
   where p.id=p_employee_id and p.company_id=p_company_id) then
   raise exception 'Employee not in company' using errcode='22023';
 end if;
 -- Prevent company directors from being demoted to a branch employee.
 if exists(select 1 from public.organization_members m
   where m.company_id=p_company_id and m.user_id=p_employee_id
     and m.role in ('director','admin')) then
   raise exception 'Company leadership cannot be assigned a branch role' using errcode='42501';
 end if;
 insert into public.company_branch_members(company_id,branch_id,user_id,branch_role)
 values(p_company_id,p_branch_id,p_employee_id,p_branch_role)
 on conflict(company_id,user_id) do update set
   branch_id=excluded.branch_id, branch_role=excluded.branch_role;
end;
$$;
revoke all on function public.assign_company_branch(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.assign_company_branch(uuid,uuid,uuid,text) to authenticated;

create or replace function public.list_company_branch_candidates(p_company_id uuid)
returns table(employee_id uuid, employee_name text, branch_id uuid, branch_role text)
language sql stable security definer set search_path=''
as $$
 select m.user_id, coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник'),
   bm.branch_id,bm.branch_role
 from public.organization_members m
 join public.profiles p on p.id=m.user_id and p.company_id=m.company_id
 left join public.company_branch_members bm on bm.company_id=m.company_id and bm.user_id=m.user_id
 where m.company_id=p_company_id and m.status='active'
 and m.role not in ('director','admin')
 and exists(select 1 from public.organization_members actor
   where actor.company_id=p_company_id and actor.user_id=(select auth.uid())
   and actor.status='active' and actor.role in ('director','admin'))
 order by p.first_name,p.last_name,m.user_id;
$$;
revoke all on function public.list_company_branch_candidates(uuid) from public,anon;
grant execute on function public.list_company_branch_candidates(uuid) to authenticated;

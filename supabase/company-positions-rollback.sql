-- Exact pre-change definitions from production, 2026-11-02.
-- Retain the additive staff_position column and its protection trigger to preserve assigned titles.
CREATE OR REPLACE FUNCTION public.company_branch_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('company_id',p.company_id,'branch_id',b.branch_id,
 'branch_role',b.branch_role,'can_manage',app_private.branch_can_manage(p.company_id),
 'can_assign_network_director',public.is_saletrening_super_admin())
 from public.profiles p left join public.company_branch_members b
 on b.company_id=p.company_id and b.user_id=p.id
 where p.id=(select auth.uid()) and p.company_id=app_private.branch_company()
$function$
;

CREATE OR REPLACE FUNCTION public.set_company_position(p_company_id uuid, p_employee_id uuid, p_position text, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;


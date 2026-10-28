begin;
drop trigger if exists network_position_guard on public.organization_members;
drop trigger if exists network_position_guard on public.profiles;
drop trigger if exists network_position_guard on public.company_invitations;
drop trigger if exists network_position_guard on public.organization_invitations;
drop function if exists public.set_company_position(uuid,uuid,text,uuid);
drop function if exists app_private.guard_network_position();
CREATE OR REPLACE FUNCTION public.company_branch_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('company_id',p.company_id,'branch_id',b.branch_id,
 'branch_role',b.branch_role,'can_manage',app_private.branch_can_manage(p.company_id))
 from public.profiles p left join public.company_branch_members b
 on b.company_id=p.company_id and b.user_id=p.id
 where p.id=(select auth.uid()) and p.company_id=app_private.branch_company()
$function$;
CREATE OR REPLACE FUNCTION public.list_company_branch_candidates(p_company_id uuid)
 RETURNS TABLE(employee_id uuid, employee_name text, branch_id uuid, branch_role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник'),b.branch_id,b.branch_role
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 left join public.company_branch_members b on b.company_id=p.company_id and b.user_id=p.id
 where p.company_id=p_company_id and m.status='active' and m.role in ('employee','manager')
 and app_private.branch_can_manage(p_company_id) order by p.first_name,p.last_name,p.id
$function$;
CREATE OR REPLACE FUNCTION public.protect_profile_membership_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'membership_fields_immutable';
  END IF;
  RETURN NEW;
END;
$function$;
commit;

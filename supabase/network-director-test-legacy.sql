CREATE OR REPLACE FUNCTION public.has_company_role(target_company uuid, allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.organization_members m
    join public.profiles p
      on p.id = m.user_id
      and p.company_id = m.company_id
    where m.company_id = target_company
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$function$;
CREATE OR REPLACE FUNCTION public.manage_company_member(p_member_id uuid, p_action text, p_new_role text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare target record; caller_company uuid;
begin
 select company_id into caller_company from public.profiles where id=auth.uid();
 select * into target from public.organization_members where id=p_member_id for update;
 if not found or target.company_id<>caller_company then return false; end if;
 if not has_company_role(caller_company,array['director','admin']) then return false; end if;
 if p_action='deactivate' then update public.organization_members set status='inactive',updated_at=now() where id=p_member_id;
 elsif p_action='activate' then update public.organization_members set status='active',updated_at=now() where id=p_member_id;
 elsif p_action='role' and p_new_role in ('employee','manager','director') then update public.organization_members set role=p_new_role,updated_at=now() where id=p_member_id; update public.profiles set role=p_new_role where id=target.user_id;
 elsif p_action='remove' then delete from public.organization_members where id=p_member_id;
 else return false; end if;
 return true;
end; $function$;
CREATE OR REPLACE FUNCTION public.protect_saletrening_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Only the backend administrator may change super administrator status'; END IF; RETURN NEW; END $function$;

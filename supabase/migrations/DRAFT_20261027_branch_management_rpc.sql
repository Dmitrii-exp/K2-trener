-- DRAFT ONLY: apply on staging after security review.
-- The caller's active membership is checked from organization_members, never user metadata.
create or replace function public.list_company_branches()
returns table(branch_id uuid, branch_name text, director_name text, employee_count bigint)
language sql stable security definer set search_path=''
as $$
  select b.id,b.name,
    (select nullif(trim(concat_ws(' ',p.first_name,p.last_name)),'')
     from public.company_branch_members bm
     join public.profiles p on p.id=bm.user_id
     where bm.branch_id=b.id and bm.company_id=b.company_id and bm.branch_role='branch_director'
     order by bm.created_at limit 1),
    (select count(*) from public.company_branch_members bm
     where bm.branch_id=b.id and bm.company_id=b.company_id)
  from public.company_branches b
  where (select auth.uid()) is not null
    and exists(select 1 from public.organization_members m
      where m.user_id=(select auth.uid()) and m.company_id=b.company_id and m.status='active')
  order by b.name;
$$;
revoke all on function public.list_company_branches() from public,anon;
grant execute on function public.list_company_branches() to authenticated;

create or replace function public.create_company_branch(p_name text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid; v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 120 then
   raise exception 'Invalid branch name' using errcode='22023';
 end if;
 select m.company_id into v_company from public.organization_members m
 where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('director','admin')
 order by m.joined_at nulls last limit 1;
 if v_company is null then raise exception 'Permission denied' using errcode='42501'; end if;
 insert into public.company_branches(company_id,name)
 values(v_company,btrim(p_name)) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.create_company_branch(text) from public,anon;
grant execute on function public.create_company_branch(text) to authenticated;
-- REVIEW: multiple company memberships must be explicitly resolved rather than chosen automatically.

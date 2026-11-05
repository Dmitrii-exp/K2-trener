-- Registration email for the existing company roster. No caller-supplied company or user IDs.
create function public.company_team_emails()
returns table(employee_id uuid, email text)
language sql stable security definer set search_path='' as $$
 select p.id,u.email::text
 from public.profiles p
 join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id and m.status='active'
 join auth.users u on u.id=p.id
 where p.company_id=app_private.branch_company()
 and (select auth.uid()) is not null
 and (not exists(select 1 from public.company_branch_members leader
                 where leader.company_id=p.company_id and leader.user_id=(select auth.uid())
                   and leader.branch_role='branch_director')
      or app_private.branch_can_read(p.company_id,p.id))
$$;
revoke all on function public.company_team_emails() from public, anon;
grant execute on function public.company_team_emails() to authenticated;

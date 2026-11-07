begin;

-- Preserve legacy personal history with no company. Company records always
-- require current active membership, including when an employee reads their own.
create or replace function app_private.branch_can_read(p_company uuid,p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
 (p_company is null and p_employee=(select auth.uid())) or exists(
 select 1 from public.profiles p join public.organization_members actor
 on actor.user_id=p.id and actor.company_id=p.company_id
 where p.id=(select auth.uid()) and actor.company_id=p_company and actor.status='active'

 and (
 p_employee=(select auth.uid())
 or (actor.role in ('director','admin','manager') and not exists(
 select 1 from public.company_branch_members b where b.company_id=p_company and b.user_id=p.id))
 or exists(select 1 from public.company_branch_members leader
 join public.company_branch_members employee on employee.company_id=leader.company_id
 and employee.branch_id=leader.branch_id
 where leader.company_id=p_company and leader.user_id=p.id
 and leader.branch_role='branch_director' and employee.user_id=p_employee
 and exists(select 1 from public.profiles target join public.organization_members tm
 on tm.user_id=target.id and tm.company_id=target.company_id
 where target.id=p_employee and target.company_id=p_company and tm.status='active'))
 )))
$$;

-- Existing browser transcript is a draft. Scoring uses the separate server copy.
alter table public.saletrening_sessions
  add column verified_text_dialogue jsonb not null default '[]'::jsonb,
  add column verified_text_version integer not null default 0;
revoke insert (verified_text_dialogue, verified_text_version),
  update (verified_text_dialogue, verified_text_version)
  on public.saletrening_sessions from public, anon, authenticated;

commit;

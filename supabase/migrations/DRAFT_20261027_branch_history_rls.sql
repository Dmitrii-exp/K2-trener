-- SECURITY REVIEW DRAFT. Do not apply until existing RLS policies, RPCs,
-- realtime endpoints and historical rows are audited in staging.
-- RESTRICTIVE SELECT policies AND existing permissive SELECT policies.
-- Never add a permissive policy that re-opens company-wide access.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create or replace function app_private.can_read_employee_history(
  p_company_id uuid, p_employee_id uuid
) returns boolean
language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and (
      p_employee_id=(select auth.uid())
      or exists(
        select 1 from public.organization_members actor
        where actor.company_id=p_company_id
          and actor.user_id=(select auth.uid())
          and actor.status='active'
          and actor.role in ('director','admin')
      )
      or exists(
        select 1
        from public.company_branch_members leader
        join public.organization_members membership
          on membership.company_id=leader.company_id
          and membership.user_id=leader.user_id
        join public.company_branch_members employee
          on employee.company_id=leader.company_id
          and employee.branch_id=leader.branch_id
        where leader.company_id=p_company_id
          and leader.user_id=(select auth.uid())
          and leader.branch_role='branch_director'
          and membership.status='active'
          and employee.user_id=p_employee_id
      )
    )
    and exists(
      select 1 from public.organization_members target
      where target.company_id=p_company_id
        and target.user_id=p_employee_id
        and target.status='active'
    )
$$;
revoke all on function app_private.can_read_employee_history(uuid,uuid) from public,anon;
grant execute on function app_private.can_read_employee_history(uuid,uuid) to authenticated;

-- IMPORTANT: historical sessions with null company_id require explicit
-- ownership-only policy or backfill before this restrictive policy is applied.
create policy branch_history_read_guard on public.saletrening_sessions
  as restrictive for select to authenticated
  using (
    (employee_id=(select auth.uid()) and company_id is null)
    or app_private.can_read_employee_history(company_id,employee_id)
  );

create policy branch_score_read_guard on public.session_scores
  as restrictive for select to authenticated
  using (app_private.can_read_employee_history(company_id,employee_id));

-- Follow-up required before activation:
-- 1. Inspect ALL existing permissive policies (including UPDATE/DELETE).
-- 2. Audit training_results, realtime_training_sessions,
--    realtime_training_feedback, session_messages, assignments, and RPCs.
-- 3. Check profile updates and organization_members changes cannot elevate roles.
-- 4. Validate member transfer and director changes against old session access.
-- 5. Test 2 companies, 2 branches each, 3 roles, and anonymous access.
-- 6. Confirm authenticated ownership remains writable for GPT-Live.
commit;

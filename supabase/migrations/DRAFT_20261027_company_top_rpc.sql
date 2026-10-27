-- DRAFT ONLY: review and test against staging before application.
-- Restricted leaderboard endpoint. Never expose transcript or feedback.
create or replace function public.company_top_public()
returns table (
 employee_id uuid,
 employee_name text,
 branch_name text,
 text_count bigint,
 voice_count bigint,
 best_score integer,
 average_score numeric
)
language sql stable security definer
set search_path = ''
as $$
 with my_companies as (
  select m.company_id from public.organization_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
 ),
 visible_employees as (
  select p.id, p.company_id,
   nullif(trim(concat_ws(' ',p.first_name,p.last_name)),'') as display_name
  from public.profiles p
  where p.company_id in (select company_id from my_companies)
 ),
 stats as (
  select s.employee_id,
   count(*) filter (where s.voice_mode = false)::bigint as text_count,
   count(*) filter (where s.voice_mode = true)::bigint as voice_count,
   max(s.total_score)::integer as best_score,
   round(avg(s.total_score)::numeric,1) as average_score
  from public.saletrening_sessions s
  join visible_employees e on e.id=s.employee_id and e.company_id=s.company_id
  where s.status='completed' and s.total_score between 0 and 100
  group by s.employee_id
 )
 select e.id, coalesce(e.display_name,'Сотрудник'),
   b.name, coalesce(st.text_count,0),coalesce(st.voice_count,0),
   st.best_score,st.average_score
 from visible_employees e
 left join public.company_branch_members bm on bm.company_id=e.company_id and bm.user_id=e.id
 left join public.company_branches b on b.id=bm.branch_id and b.company_id=e.company_id
 left join stats st on st.employee_id=e.id
 order by st.average_score desc nulls last, e.display_name, e.id
$$;
revoke all on function public.company_top_public() from public, anon;
grant execute on function public.company_top_public() to authenticated;
-- IMPORTANT: confirm session status and voice classification in staging.
-- IMPORTANT: company membership uniqueness and branch membership integrity require audit.

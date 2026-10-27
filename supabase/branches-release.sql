-- Branch roles are separate from existing profile roles. No training or billing rows change.
-- Apply as one transaction after test-branches.py and a verified REG.RU backup.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;
create table public.company_branches (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 120),
 created_at timestamptz not null default now(),
 unique(company_id,id), unique(company_id,name)
);
create table public.company_branch_members (
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 branch_role text not null check(branch_role in ('employee','branch_director')),
 created_at timestamptz not null default now(),
 primary key(company_id,user_id),
 foreign key(company_id,branch_id) references public.company_branches(company_id,id) on delete cascade
);
create index company_branch_members_branch on public.company_branch_members(company_id,branch_id);
alter table public.company_branches enable row level security;
alter table public.company_branch_members enable row level security;
revoke all on public.company_branches,public.company_branch_members from public,anon,authenticated;

create function app_private.branch_company() returns uuid
language sql stable security definer set search_path='' as $$
 select p.company_id from public.profiles p join public.organization_members m
 on m.user_id=p.id and m.company_id=p.company_id
 where p.id=(select auth.uid()) and m.status='active'
$$;
create function app_private.branch_can_manage(p_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.organization_members m
 on m.user_id=p.id and m.company_id=p.company_id
 where p.id=(select auth.uid()) and m.company_id=p_company and m.status='active'
 and m.role in ('director','admin')
 and not exists(select 1 from public.company_branch_members b
 where b.company_id=m.company_id and b.user_id=m.user_id))
$$;
-- Existing owners retain their own history, including historical null company IDs.
-- A branch assignment overrides any legacy manager-wide read permission.
create function app_private.branch_can_read(p_company uuid,p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
 p_employee=(select auth.uid()) or exists(
 select 1 from public.profiles p join public.organization_members actor
 on actor.user_id=p.id and actor.company_id=p.company_id
 where p.id=(select auth.uid()) and actor.company_id=p_company and actor.status='active'

 and (
 (actor.role in ('director','admin','manager') and not exists(
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
revoke all on function app_private.branch_company(),app_private.branch_can_manage(uuid),app_private.branch_can_read(uuid,uuid) from public,anon;
grant execute on function app_private.branch_company(),app_private.branch_can_manage(uuid),app_private.branch_can_read(uuid,uuid) to authenticated;

create function public.company_branch_context() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('company_id',p.company_id,'branch_id',b.branch_id,
 'branch_role',b.branch_role,'can_manage',app_private.branch_can_manage(p.company_id))
 from public.profiles p left join public.company_branch_members b
 on b.company_id=p.company_id and b.user_id=p.id
 where p.id=(select auth.uid()) and p.company_id=app_private.branch_company()
$$;
create function public.list_company_branches()
returns table(branch_id uuid,branch_name text,director_name text,employee_count bigint)
language sql stable security definer set search_path='' as $$
 select b.id,b.name,
 (select nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')
 from public.company_branch_members bm join public.profiles p on p.id=bm.user_id and p.company_id=bm.company_id
 join public.organization_members m on m.user_id=p.id and m.company_id=bm.company_id and m.status='active'
 where bm.branch_id=b.id and bm.branch_role='branch_director' order by bm.created_at,bm.user_id limit 1),
 (select count(*) from public.company_branch_members bm join public.profiles p on p.id=bm.user_id and p.company_id=bm.company_id
 join public.organization_members m on m.user_id=p.id and m.company_id=bm.company_id and m.status='active'
 where bm.branch_id=b.id)
 from public.company_branches b where b.company_id=app_private.branch_company() order by b.name,b.id
$$;
create function public.create_company_branch(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c uuid:=app_private.branch_company(); result uuid;
begin
 if not coalesce(app_private.branch_can_manage(c),false) then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid branch name' using errcode='22023'; end if;
 insert into public.company_branches(company_id,name) values(c,btrim(p_name)) returning id into result;
 return result;
end $$;
create function public.assign_company_branch(p_company_id uuid,p_branch_id uuid,p_employee_id uuid,p_branch_role text default 'employee')
returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(app_private.branch_can_manage(p_company_id),false) then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_branch_role is null or p_branch_role not in ('employee','branch_director') then raise exception 'Invalid branch role' using errcode='22023'; end if;
 if not exists(select 1 from public.company_branches where id=p_branch_id and company_id=p_company_id) then raise exception 'Branch not in company' using errcode='22023'; end if;
 -- Serialize assignment against membership changes. Never demote network leadership.
 perform 1 from public.organization_members m join public.profiles p on p.id=m.user_id and p.company_id=m.company_id
 where m.company_id=p_company_id and m.user_id=p_employee_id and m.status='active' and m.role in ('employee','manager') for update of m,p;
 if not found then raise exception 'Employee not assignable' using errcode='22023'; end if;
 insert into public.company_branch_members(company_id,branch_id,user_id,branch_role)
 values(p_company_id,p_branch_id,p_employee_id,p_branch_role)
 on conflict(company_id,user_id) do update set branch_id=excluded.branch_id,branch_role=excluded.branch_role;
end $$;
create function public.list_company_branch_candidates(p_company_id uuid)
returns table(employee_id uuid,employee_name text,branch_id uuid,branch_role text)
language sql stable security definer set search_path='' as $$
 select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник'),b.branch_id,b.branch_role
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 left join public.company_branch_members b on b.company_id=p.company_id and b.user_id=p.id
 where p.company_id=p_company_id and m.status='active' and m.role in ('employee','manager')
 and app_private.branch_can_manage(p_company_id) order by p.first_name,p.last_name,p.id
$$;
-- Names and branches only. Employee directory does not grant access to private history.
create function public.company_team_directory()
returns table(employee_id uuid,employee_name text,branch_name text)
language sql stable security definer set search_path='' as $$
 select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник'),b.name
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 left join public.company_branch_members bm on bm.company_id=p.company_id and bm.user_id=p.id
 left join public.company_branches b on b.id=bm.branch_id
 where p.company_id=app_private.branch_company() and m.status='active' order by p.first_name,p.last_name,p.id
$$;
create function public.company_top_public()
returns table(employee_id uuid,employee_name text,branch_name text,text_count bigint,voice_count bigint,best_score integer,average_score numeric)
language sql stable security definer set search_path='' as $$
 with employees as (
 select p.id,p.company_id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Сотрудник') as name
 from public.profiles p join public.organization_members m on m.user_id=p.id and m.company_id=p.company_id
 where p.company_id=app_private.branch_company() and m.status='active'
 ), stats as (
 select s.employee_id,count(*) filter(where not coalesce(s.voice_mode,false)) as text_count,
 count(*) filter(where s.voice_mode) as voice_count,max(sc.overall_score) as best_score,
 round(avg(sc.overall_score),1) as average_score
 from public.saletrening_sessions s join employees e on e.id=s.employee_id and e.company_id=s.company_id
 join public.session_scores sc on sc.session_id=s.id and sc.employee_id=s.employee_id and sc.company_id=s.company_id
 where s.status='completed' and s.completed_at is not null and sc.overall_score between 0 and 100
 group by s.employee_id
 )
 select e.id,e.name,b.name,coalesce(st.text_count,0),coalesce(st.voice_count,0),st.best_score,st.average_score
 from employees e left join stats st on st.employee_id=e.id
 left join public.company_branch_members bm on bm.user_id=e.id and bm.company_id=e.company_id
 left join public.company_branches b on b.id=bm.branch_id
 order by st.average_score desc nulls last,e.name,e.id
$$;
revoke all on function public.company_branch_context(),public.list_company_branches(),public.create_company_branch(text),public.assign_company_branch(uuid,uuid,uuid,text),public.list_company_branch_candidates(uuid),public.company_team_directory(),public.company_top_public() from public,anon;
grant execute on function public.company_branch_context(),public.list_company_branches(),public.create_company_branch(text),public.assign_company_branch(uuid,uuid,uuid,text),public.list_company_branch_candidates(uuid),public.company_team_directory(),public.company_top_public() to authenticated;

-- Restrictive guards preserve existing grants and writes, and prevent OR-ed legacy
-- manager policies from reopening other branches. Explicit read policies add branch readers.
DO $policies$
declare t text;
begin
 foreach t in array array['saletrening_sessions','session_scores','training_results','realtime_training_sessions','realtime_training_feedback','employee_learning_profiles','employee_training_goals','training_assignments'] loop
 execute format('create policy branch_scope_guard on public.%I as restrictive for all to authenticated using (app_private.branch_can_read(company_id,employee_id)) with check (app_private.branch_can_read(company_id,employee_id))',t);
 execute format('create policy branch_scope_read on public.%I for select to authenticated using (app_private.branch_can_read(company_id,employee_id))',t);
 end loop;
end $policies$;
create policy branch_profile_read on public.profiles for select to authenticated using(app_private.branch_can_read(company_id,id));
create policy branch_profile_guard on public.profiles as restrictive for select to authenticated
using(id=(select auth.uid()) or app_private.branch_can_read(company_id,id) or (select public.is_saletrening_super_admin()));
-- Guard the separate message endpoint too, including employees with legacy manager roles.
create policy branch_message_guard on public.session_messages as restrictive for select to authenticated
using(exists(select 1 from public.saletrening_sessions s where s.id=session_id and app_private.branch_can_read(s.company_id,s.employee_id)));
create policy branch_message_read on public.session_messages for select to authenticated
using(exists(select 1 from public.saletrening_sessions s where s.id=session_id and app_private.branch_can_read(s.company_id,s.employee_id)));

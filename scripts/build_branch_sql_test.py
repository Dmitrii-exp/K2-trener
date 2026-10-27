"""Generate a rollback-only SQL fixture suite using the actual candidate functions/policies.
No production rows, auth users or production policies are modified.
"""
from pathlib import Path
sql = Path('supabase/branches-release.sql').read_text()
sql = sql.replace('public.', 'branch_test.').replace('app_private', 'branch_test_private')
bootstrap = '''begin;
create schema branch_test;
grant usage on schema branch_test to authenticated;
create table branch_test.companies(id uuid primary key);
create table branch_test.profiles(id uuid primary key,company_id uuid,first_name text,last_name text,role text,is_super_admin boolean default false);
create table branch_test.organization_members(user_id uuid,company_id uuid,role text,status text,primary key(company_id,user_id));
create function branch_test.is_saletrening_super_admin() returns boolean language sql security definer set search_path='' as $$select exists(select 1 from branch_test.profiles where id=auth.uid() and is_super_admin)$$;
create table branch_test.saletrening_sessions(id uuid primary key default gen_random_uuid(),company_id uuid,employee_id uuid,status text,completed_at timestamptz,voice_mode boolean,total_score int,transcript jsonb);
create table branch_test.session_messages(session_id uuid,content text);
create table branch_test.session_scores(id uuid default gen_random_uuid(),session_id uuid primary key,company_id uuid,employee_id uuid,overall_score int);
'''
others=['training_results','realtime_training_sessions','realtime_training_feedback','employee_learning_profiles','employee_training_goals','training_assignments']
for table in others:
    bootstrap+=f'create table branch_test.{table}(id uuid default gen_random_uuid(),company_id uuid,employee_id uuid);\n'
all_tables=['saletrening_sessions','session_scores']+others
for table in all_tables+['profiles','session_messages']:
    bootstrap+=f'alter table branch_test.{table} enable row level security; create policy legacy_open on branch_test.{table} for all to authenticated using(true) with check(true); grant select,insert,update,delete on branch_test.{table} to authenticated;\n'
fixtures='''
insert into branch_test.companies values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into branch_test.profiles(id,company_id,first_name,role) values
('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Director','director'),
('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Branch leader','manager'),
('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Own branch','employee'),
('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Other branch','employee'),
('00000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Other company','employee');
insert into branch_test.organization_members select id,company_id,role,'active' from branch_test.profiles;
insert into branch_test.company_branches(id,company_id,name) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Branch 1'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Branch 2'),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Other company 1'),
('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','Other company 2');
insert into branch_test.company_branch_members values
('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','branch_director',now()),
('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','employee',now()),
('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','employee',now());
insert into branch_test.saletrening_sessions(id,company_id,employee_id,status,completed_at,voice_mode,total_score)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,company_id,id,'completed',now(),(n=2),70+n*5
from (select p.*,row_number() over(order by id)::int as n from branch_test.profiles p where role='employee') x;
insert into branch_test.session_scores(session_id,company_id,employee_id,overall_score)
select id,company_id,employee_id,total_score from branch_test.saletrening_sessions;
'''
for t in others:
    fixtures+=f'insert into branch_test.{t}(company_id,employee_id) select company_id,id from branch_test.profiles where role=\'employee\';\n'
fixtures+='''
insert into branch_test.session_messages select id,'private' from branch_test.saletrening_sessions;
create function pg_temp.assert_branch(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_branch(branch_test.company_branch_context()->>'branch_role'='branch_director','branch role context');
'''
for t in all_tables:
    fixtures+=f"select pg_temp.assert_branch((select count(*)=1 and bool_and(employee_id='00000000-0000-4000-8000-000000000003') from branch_test.{t}),'branch-scoped {t} despite permissive legacy policy');\n"
fixtures+='''
select pg_temp.assert_branch((select count(*)=1 from branch_test.session_messages),'branch message isolation');
select pg_temp.assert_branch((select count(*)=2 from branch_test.profiles),'branch profiles');
select pg_temp.assert_branch((select count(*)=4 from branch_test.company_top_public()),'TOP contains only current company');
select pg_temp.assert_branch((select voice_count=1 and text_count=0 from branch_test.company_top_public() where employee_id='00000000-0000-4000-8000-000000000004'),'TOP voice counts');
select pg_temp.assert_branch((select count(*)=4 from branch_test.company_team_directory()),'directory projection company isolation');
do $$begin
 begin perform branch_test.create_company_branch('Forbidden');raise exception 'FAIL: branch leader created branch';exception when insufficient_privilege then null;end;
 begin perform branch_test.assign_company_branch('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','branch_director');raise exception 'FAIL: branch leader assigned role';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_branch((select count(*)=1 from branch_test.saletrening_sessions),'employee sees own only');
select pg_temp.assert_branch((select count(*)=4 from branch_test.company_team_directory()),'employee can see names and branches');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_branch((select count(*)=2 from branch_test.saletrening_sessions),'network director sees all company branches');
select branch_test.create_company_branch('New branch');
select branch_test.assign_company_branch('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','employee');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_branch((select count(*)=0 from branch_test.saletrening_sessions),'transfer immediately removes old leader access');
reset role;
select pg_temp.assert_branch(not has_function_privilege('anon','branch_test.company_top_public()','EXECUTE'),'anonymous TOP denied');
select pg_temp.assert_branch(not has_table_privilege('authenticated','branch_test.company_branch_members','INSERT'),'direct membership writes denied');
select 'PASS: branch read isolation on 8 tables, company directory/TOP, ownership, role mutation and transfer guards' as result;
rollback;
'''
print(bootstrap+sql+fixtures)

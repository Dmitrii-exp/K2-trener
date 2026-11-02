"""Actual old role/branch contracts plus the new business-position migration; rollback-only fixtures."""
from pathlib import Path
import subprocess
base=subprocess.check_output(['python','scripts/build_network_position_test.py'],text=True)
source=Path('supabase/company-positions.sql').read_text().replace('public.','branch_test.').replace('app_private','branch_test_private')
base=base.replace('insert into branch_test.companies values',source+'\ninsert into branch_test.companies values',1).rsplit('rollback;',1)[0]
extra="""
select set_config('request.jwt.claim.sub','',true);
insert into branch_test.profiles(id,company_id,first_name,role) values
('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Sales manager','employee'),
('00000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Buyer','employee');
insert into branch_test.organization_members(user_id,company_id,role,status) select id,company_id,role,'active' from branch_test.profiles where id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008');
insert into branch_test.saletrening_sessions(id,company_id,employee_id,status,completed_at,total_score)
select ('20000000-0000-4000-8000-'||right(id::text,12))::uuid,company_id,id,'completed',now(),75 from branch_test.profiles where id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008');
insert into branch_test.session_scores(session_id,company_id,employee_id,overall_score) select id,company_id,employee_id,75 from branch_test.saletrening_sessions where employee_id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008');
insert into branch_test.session_messages select id,'role test' from branch_test.saletrening_sessions where employee_id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008');
"""
tables=['saletrening_sessions','session_scores','training_results','realtime_training_sessions','realtime_training_feedback','employee_learning_profiles','employee_training_goals','training_assignments']
for table in tables[2:]:
 extra+=f"insert into branch_test.{table}(company_id,employee_id) select company_id,id from branch_test.profiles where id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008');\n"
extra+="""
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_branch((branch_test.company_branch_context()->>'can_manage')::boolean,'network director has company administration');
select branch_test.create_company_branch('Created by network director');
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000007','manager','30000000-0000-4000-8000-000000000001');
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','buyer','30000000-0000-4000-8000-000000000001');
select pg_temp.assert_branch((select "position"='buyer' from branch_test.company_position_candidates('10000000-0000-4000-8000-000000000001') where employee_id='00000000-0000-4000-8000-000000000008'),'candidate reports buyer title');
select pg_temp.assert_branch((select "position"='branch_director' from branch_test.company_team_positions() where employee_id='00000000-0000-4000-8000-000000000003'),'team card reports branch title');
select pg_temp.assert_branch((select bool_and(role='employee') from branch_test.profiles where id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008')),'same staff permissions in profiles');
reset role;
select pg_temp.assert_branch((select bool_and(role='employee') from branch_test.organization_members where user_id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008')),'same staff permissions in memberships');
set local role authenticated;
"""
for uid,position in [('00000000-0000-4000-8000-000000000007','manager'),('00000000-0000-4000-8000-000000000008','buyer')]:
 extra+=f"select set_config('request.jwt.claim.sub','{uid}',true);\nselect pg_temp.assert_branch(branch_test.company_branch_context()->>'position'='{position}','own {position} title');\n"
 for table in tables:
  extra+=f"select pg_temp.assert_branch((select count(*)=1 and bool_and(employee_id='{uid}') from branch_test.{table}),'{position} only own {table}');\n"
 extra+="select pg_temp.assert_branch(not (branch_test.company_branch_context()->>'can_manage')::boolean,'staff cannot administer company');\nselect pg_temp.assert_branch((select count(*)=1 from branch_test.company_team_positions()),'staff position endpoint returns own only');\n"
extra+="""
do $$begin
 begin update branch_test.profiles set staff_position='manager' where id=auth.uid();raise exception 'FAIL: staff self job change';exception when insufficient_privilege then null;end;
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','branch_director','30000000-0000-4000-8000-000000000001');raise exception 'FAIL: staff self branch promotion';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_branch(branch_test.company_branch_context()->>'position'='branch_director','branch leader title overrides legacy technical role');
"""
for table in tables:
 extra+=f"select pg_temp.assert_branch((select count(*) filter(where employee_id in ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008'))=2 and count(*) filter(where employee_id='00000000-0000-4000-8000-000000000004')=0 from branch_test.{table}),'branch sees both staff jobs and no other branch {table}');\n"
extra+="""
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','buyer','30000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
"""
for table in tables:
 extra+=f"select pg_temp.assert_branch(not exists(select 1 from branch_test.{table} where employee_id='00000000-0000-4000-8000-000000000008'),'transfer revokes old branch {table}');\n"
extra+="""
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000007','branch_director','30000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
select pg_temp.assert_branch(branch_test.company_branch_context()->>'position'='branch_director','new branch leadership title');
select pg_temp.assert_branch(exists(select 1 from branch_test.saletrening_sessions where employee_id='00000000-0000-4000-8000-000000000008'),'new leader reads buyer history');
select pg_temp.assert_branch(not exists(select 1 from branch_test.saletrening_sessions where employee_id='00000000-0000-4000-8000-000000000003'),'new leader cannot read other branch');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000007','buyer','30000000-0000-4000-8000-000000000002');
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','buyer',null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
select pg_temp.assert_branch(not exists(select 1 from branch_test.saletrening_sessions where employee_id='00000000-0000-4000-8000-000000000008'),'demotion immediately removes branch history');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_branch(branch_test.company_branch_context()->>'branch_id' is null and branch_test.company_branch_context()->>'position'='buyer','buyer can be assigned without branch');
select pg_temp.assert_branch((select count(*)=1 from branch_test.saletrening_sessions),'unassigned buyer never gains legacy company manager rights');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$begin
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','branch_director',null);raise exception 'FAIL: branch leader without branch';exception when invalid_parameter_value then null;end;
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','buyer','30000000-0000-4000-8000-000000000003');raise exception 'FAIL: foreign branch';exception when invalid_parameter_value then null;end;
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','buyer',null);raise exception 'FAIL: foreign employee';exception when invalid_parameter_value then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','network_director',null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_branch(branch_test.company_branch_context()->>'position'='network_director' and (branch_test.company_branch_context()->>'can_manage')::boolean,'buyer promotion gets full company administration');
select pg_temp.assert_branch(not exists(select 1 from branch_test.saletrening_sessions where company_id='10000000-0000-4000-8000-000000000002'),'network leadership remains company scoped');
select branch_test.create_company_branch('Created by newly appointed network director');
reset role;
select pg_temp.assert_branch(not (select is_super_admin from branch_test.profiles where id='00000000-0000-4000-8000-000000000008'),'company leadership does not become platform operator');
select pg_temp.assert_branch(not has_function_privilege('anon','branch_test.company_position_candidates(uuid)','EXECUTE') and not has_function_privilege('anon','branch_test.company_team_positions()','EXECUTE'),'position metadata requires authentication');
select 'PASS: four positions; manager/buyer identical permissions; direct API RLS on all 8 training tables; leader scope, transfer/demotion, company boundaries, administrator-only network appointment and no self escalation' as result;
rollback;
"""
print(base+extra)

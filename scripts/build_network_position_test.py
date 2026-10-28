"""Reuse branch fixtures, apply the real candidate, then test privileged assignment.
Everything runs in isolated test schemas and ends with ROLLBACK.
"""
from pathlib import Path
import subprocess
base=subprocess.check_output(['python','scripts/build_branch_sql_test.py'],text=True)
base=base.replace('role text,is_super_admin boolean default false);','role text,is_super_admin boolean default false,updated_at timestamptz default now());')
base=base.replace('role text,status text,primary key(company_id,user_id));','role text,status text,id uuid default gen_random_uuid(),updated_at timestamptz default now(),primary key(company_id,user_id));')
base=base.replace('insert into branch_test.organization_members select id,company_id,role,\'active\' from', 'insert into branch_test.organization_members(user_id,company_id,role,status) select id,company_id,role,\'active\' from')
def translated(s):return s.replace('public.','branch_test.').replace('app_private','branch_test_private').replace("SET search_path TO 'public'","SET search_path TO 'branch_test'")
setup='''create table branch_test.company_invitations(company_id uuid,role text);
create table branch_test.organization_invitations(company_id uuid,role text);
grant select,insert,update on branch_test.organization_members,branch_test.company_invitations,branch_test.organization_invitations to authenticated;
'''
setup+=translated(Path('supabase/network-director.sql').read_text())
setup+=translated(Path('supabase/network-director-test-legacy.sql').read_text())
setup+='''create trigger protect_profile_membership_fields before update on branch_test.profiles for each row execute function branch_test.protect_profile_membership_fields();
create trigger protect_saletrening_super_admin_trigger before update on branch_test.profiles for each row execute function branch_test.protect_saletrening_super_admin();
'''
base=base.replace('insert into branch_test.companies values',setup+'\ninsert into branch_test.companies values',1)
base=base.rsplit('rollback;',1)[0]
extra='''
select set_config('request.jwt.claim.sub','',true);
insert into branch_test.profiles(id,company_id,first_name,role,is_super_admin) values
('00000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Administrator','director',true);
insert into branch_test.organization_members(user_id,company_id,role,status)
values('00000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','director','active');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_branch(not (branch_test.company_branch_context()->>'can_assign_network_director')::boolean,'company director is not platform administrator');
do $$begin
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','network_director',null);raise exception 'FAIL: company director promoted employee';exception when insufficient_privilege then null;end;
 begin update branch_test.organization_members set role='director' where user_id='00000000-0000-4000-8000-000000000003';raise exception 'FAIL: direct membership promotion';exception when insufficient_privilege then null;end;
 begin perform branch_test.manage_company_member((select id from branch_test.organization_members where user_id='00000000-0000-4000-8000-000000000003'),'role','director');raise exception 'FAIL: legacy RPC promotion';exception when insufficient_privilege then null;end;
 begin insert into branch_test.company_invitations values('10000000-0000-4000-8000-000000000001','director');raise exception 'FAIL: director invitation';exception when insufficient_privilege then null;end;
 insert into branch_test.company_invitations values('10000000-0000-4000-8000-000000000001','employee');
 begin update branch_test.company_invitations set role='director';raise exception 'FAIL: invitation role update';exception when insufficient_privilege then null;end;
 begin insert into branch_test.organization_invitations values('10000000-0000-4000-8000-000000000001','admin');raise exception 'FAIL: administrator invitation';exception when insufficient_privilege then null;end;
 begin update branch_test.profiles set role='admin' where id='00000000-0000-4000-8000-000000000001';raise exception 'FAIL: direct profile promotion';exception when insufficient_privilege then null;end;
 begin update branch_test.profiles set is_super_admin=true where id='00000000-0000-4000-8000-000000000001';raise exception 'FAIL: self administrator flag';exception when others then if sqlerrm like 'FAIL:%' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$begin
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','network_director',null);raise exception 'FAIL: employee self promotion';exception when insufficient_privilege then null;end;
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','employee','30000000-0000-4000-8000-000000000001');raise exception 'FAIL: employee self assignment';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_branch((branch_test.company_branch_context()->>'can_assign_network_director')::boolean,'verified administrator capability');
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','network_director',null);
select pg_temp.assert_branch((select role='director' from branch_test.profiles where id='00000000-0000-4000-8000-000000000003'),'administrator assigns network role');
select pg_temp.assert_branch((select role='director' from branch_test.organization_members where user_id='00000000-0000-4000-8000-000000000003'),'membership role is synchronized');
reset role;
select pg_temp.assert_branch(not exists(select 1 from branch_test.company_branch_members where user_id='00000000-0000-4000-8000-000000000003'),'network director is not restricted to old branch');
set local role authenticated;
select pg_temp.assert_branch((select branch_role='network_director' from branch_test.list_company_branch_candidates('10000000-0000-4000-8000-000000000001') where employee_id='00000000-0000-4000-8000-000000000003'),'existing network role is shown to administrator');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_branch((select count(*)=2 from branch_test.saletrening_sessions),'network director sees all company history');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$begin
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','employee','30000000-0000-4000-8000-000000000001');raise exception 'FAIL: non-admin changed network director';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','branch_director','30000000-0000-4000-8000-000000000001');
select pg_temp.assert_branch((select role='employee' from branch_test.profiles where id='00000000-0000-4000-8000-000000000003'),'administrator can change network director to branch director');
do $$begin
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','network_director',null);raise exception 'FAIL: target company spoofing';exception when invalid_parameter_value then null;end;
 begin perform branch_test.set_company_position('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006','employee','30000000-0000-4000-8000-000000000001');raise exception 'FAIL: administrator account downgrade';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.assert_branch(not has_function_privilege('anon','branch_test.set_company_position(uuid,uuid,text,uuid)','EXECUTE'),'anonymous assignment denied');
select 'PASS: administrator-only network assignment; direct/profile/legacy/invitation/self escalation denied; branch isolation and role transition preserved' as result;
rollback;
'''
print(base+extra)

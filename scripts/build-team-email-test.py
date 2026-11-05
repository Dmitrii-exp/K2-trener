from pathlib import Path
import subprocess
base=subprocess.check_output(['python','scripts/build_branch_sql_test.py'],text=True)
source=Path('supabase/team-emails.sql').read_text().replace('public.','branch_test.').replace('app_private','branch_test_private').replace('auth.users','branch_test_auth.users')
base=base.replace('insert into branch_test.companies values',"create schema branch_test_auth; create table branch_test_auth.users(id uuid primary key,email text);\n"+source+'\ninsert into branch_test.companies values',1)
seed="""insert into branch_test_auth.users select id,first_name||'@example.test' from branch_test.profiles;
select pg_temp.assert_branch(not has_function_privilege('anon','branch_test.company_team_emails()','EXECUTE'),'anon cannot read email');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_branch((select count(*)=2 from branch_test.company_team_emails()),'branch director sees only own branch email');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_branch((select count(*)=4 from branch_test.company_team_emails()),'employee sees same-company directory email');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_branch((select count(*)=4 and bool_and(email not like 'Other company%') from branch_test.company_team_emails()),'director company isolation');
reset role;
"""
base=base.replace('set local role authenticated;\nselect set_config',seed+'set local role authenticated;\nselect set_config',1)
print(base)

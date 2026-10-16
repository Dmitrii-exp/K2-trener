-- Run after training-data-integrity.sql. No production rows are modified.
-- All test data lives in a temporary table and is rolled back.
begin;
create temporary table integrity_test_sessions (like public.saletrening_sessions including defaults);
create trigger integrity_guard before insert or update on integrity_test_sessions
for each row execute function public.protect_saletrening_session_fields();
grant select, insert, update on integrity_test_sessions to authenticated, service_role;

do $test$
begin
  if has_column_privilege('authenticated','public.saletrening_sessions','total_score','UPDATE')
    or has_column_privilege('authenticated','public.saletrening_sessions','total_score','INSERT')
    or has_column_privilege('authenticated','public.saletrening_sessions','status','UPDATE') then
    raise exception 'FAIL: protected fields remain client writable';
  end if;
  if not has_column_privilege('authenticated','public.saletrening_sessions','transcript','UPDATE')
    or not has_column_privilege('service_role','public.saletrening_sessions','total_score','UPDATE') then
    raise exception 'FAIL: transcript saving or backend scoring is blocked';
  end if;
  if exists (select 1 from pg_proc where oid='public.protect_saletrening_session_fields()'::regprocedure and prosecdef) then
    raise exception 'FAIL: guard still runs as function owner';
  end if;
end;
$test$;

set local role authenticated;
insert into integrity_test_sessions (id,employee_id,company_id,scenario_id,status,total_score,transcript,difficulty_level,assignment_id)
values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',1,'completed',100,'[{"speaker":"client","content":"fabricated"}]','Средний',null);
do $test$
begin
  if not exists(select 1 from integrity_test_sessions where status='started' and total_score is null and transcript='[]'::jsonb) then
    raise exception 'FAIL: INSERT accepted a fabricated result';
  end if;
  update integrity_test_sessions set transcript='[{"speaker":"manager","content":"Здравствуйте"}]',updated_at=now();
  begin
    update integrity_test_sessions set total_score=100;
    raise exception 'FAIL: score update was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update integrity_test_sessions set difficulty_level='Сложный';
    raise exception 'FAIL: difficulty update was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$test$;

set local role service_role;
update integrity_test_sessions set status='completed',total_score=85,ai_evaluation='{"overall_score":85}';
do $test$
begin
  if not exists(select 1 from integrity_test_sessions where status='completed' and total_score=85) then
    raise exception 'FAIL: backend scoring is blocked';
  end if;
end;
$test$;

set local role authenticated;
do $test$
begin
  begin
    update integrity_test_sessions set transcript='[]';
    raise exception 'FAIL: completed transcript was editable';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
reset role;
select 'PASS: client score changes blocked; transcript saves and backend scoring allowed' as result;
rollback;

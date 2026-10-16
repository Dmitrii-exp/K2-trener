-- Temporary fixtures only. The copied function is identical except for its
-- table references and billing stub. No real user or usage rows are modified.
begin;
create temporary table test_ai_profiles(id uuid,company_id uuid,is_super_admin boolean);
create temporary table test_ai_members(user_id uuid,company_id uuid,status text);
create temporary table test_ai_subscriptions(company_id uuid,status text,seat_count integer,current_period_end timestamptz);
create temporary table test_ai_sessions(id uuid,employee_id uuid,company_id uuid,status text,access_mode text,started_at timestamptz,voice_mode boolean,transcript jsonb,total_score integer,ai_evaluation jsonb);
create temporary table test_ai_usage(user_id uuid,scope text,operation text,window_start timestamptz,used integer,primary key(user_id,scope,operation,window_start));
create function pg_temp.test_billing_access(uuid,text,text) returns jsonb language sql as $$select '{"allowed":false,"reason":"daily_limit","unlimited":false}'::jsonb$$;
create function pg_temp.assert_ai(p_ok boolean,p_label text) returns void language plpgsql as $$begin if p_ok is distinct from true then raise exception 'FAIL: %',p_label;end if;end$$;
do $setup$
declare definition text;
begin
  definition:=pg_get_functiondef('public.authorize_saletrening_ai_request(uuid,text,uuid)'::regprocedure);
  definition:=replace(definition,'public.authorize_saletrening_ai_request','pg_temp.test_authorize_ai');
  definition:=replace(definition,'public.profiles','pg_temp.test_ai_profiles');
  definition:=replace(definition,'public.organization_members','pg_temp.test_ai_members');
  definition:=replace(definition,'public.company_subscriptions','pg_temp.test_ai_subscriptions');
  definition:=replace(definition,'public.saletrening_sessions','pg_temp.test_ai_sessions');
  definition:=replace(definition,'saletrening_private.ai_request_usage','pg_temp.test_ai_usage');
  definition:=replace(definition,'public.get_training_access','pg_temp.test_billing_access');
  execute definition;
end;
$setup$;
insert into test_ai_profiles values
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',false),
 ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',false),
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',false),
 ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',false),
 ('00000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005',false),
 ('00000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',true);
insert into test_ai_members select id,company_id,case when id='00000000-0000-4000-8000-000000000004' then 'inactive' else 'active' end from test_ai_profiles;
insert into test_ai_subscriptions values
 ('10000000-0000-4000-8000-000000000001','active',1,now()+interval '1 day'),
 ('10000000-0000-4000-8000-000000000002','trial',0,null),
 ('10000000-0000-4000-8000-000000000003','expired',0,now()-interval '1 day'),
 ('10000000-0000-4000-8000-000000000005','active',1,now()+interval '1 day');
insert into test_ai_sessions values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','started','paid',now(),false,'[]',null,null),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','started','paid',now(),true,'[]',null,null),
 ('20000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','started','trial',now(),false,'[]',null,null),
 ('20000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','completed','paid',now(),false,'[]',85,'{"overall_score":85}'),
 ('20000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','started','paid',now()-interval '16 minutes',true,'[]',null,null),
 ('20000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','started','paid',now(),false,'[]',null,null);
do $tests$
declare
  u uuid:='00000000-0000-4000-8000-000000000001';
  s uuid:='20000000-0000-4000-8000-000000000001';
  voice uuid:='20000000-0000-4000-8000-000000000002';
  result jsonb;
begin
  result:=pg_temp.test_authorize_ai(u,'reply',s);
  perform pg_temp.assert_ai((result->>'allowed')::boolean,'existing session works at the daily-start limit');
  result:=pg_temp.test_authorize_ai('00000000-0000-4000-8000-000000000002','reply','20000000-0000-4000-8000-000000000003');
  perform pg_temp.assert_ai((result->>'allowed')::boolean,'trial session retains access after credit consumption');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'reply','20000000-0000-4000-8000-000000000003')->>'reason'='training_required','other company session is denied');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'live','99999999-0000-4000-8000-000000000001')->>'reason'='training_required','explicit missing ID never falls back');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai('00000000-0000-4000-8000-000000000004','mentor',null)->>'reason'='membership_required','inactive employee is denied');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai('00000000-0000-4000-8000-000000000003','reply','20000000-0000-4000-8000-000000000007')->>'reason'='subscription_required','expired subscription is denied');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai('00000000-0000-4000-8000-000000000002','mentor',null)->>'reason'='subscription_required','trial does not unlock paid mentor');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'diagnostic',null)->>'reason'='admin_required','old diagnostic routes require platform admin');
  perform pg_temp.assert_ai((pg_temp.test_authorize_ai('00000000-0000-4000-8000-000000000006','diagnostic',null)->>'allowed')::boolean,'platform admin diagnostic remains available');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'tts',s)->>'reason'='voice_training_required','text session cannot unlock audio billing');
  result:=pg_temp.test_authorize_ai(u,'stt',null);
  perform pg_temp.assert_ai(result->>'session_id'=voice::text,'legacy audio infers own open voice session');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'stt','20000000-0000-4000-8000-000000000006')->>'reason'='training_expired','expired voice session is denied');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'reply','20000000-0000-4000-8000-000000000005')->>'reason'='training_closed','completed training cannot generate replies');
  result:=pg_temp.test_authorize_ai(u,'evaluate','20000000-0000-4000-8000-000000000005');
  perform pg_temp.assert_ai(result->'cached_evaluation'->>'overall_score'='85','completed evaluation uses cached result');
  perform pg_temp.assert_ai(not exists(select 1 from test_ai_usage where operation='evaluate'),'cached result incurs no metering');
  for i in 1..3 loop
    perform pg_temp.assert_ai((pg_temp.test_authorize_ai(u,'live',voice)->>'allowed')::boolean,'voice connection retry allowed');
  end loop;
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'live',voice)->>'reason'='request_limit','voice connection attempts are bounded');
  for i in 1..30 loop result:=pg_temp.test_authorize_ai(u,'mentor',null); end loop;
  perform pg_temp.assert_ai((result->>'allowed')::boolean,'normal mentor rate allowed');
  perform pg_temp.assert_ai(pg_temp.test_authorize_ai(u,'mentor',null)->>'reason'='rate_limit','mentor burst is bounded');
  perform pg_temp.assert_ai(not has_function_privilege('authenticated','public.authorize_saletrening_ai_request(uuid,text,uuid)','EXECUTE'),'metering RPC is not client callable');
  perform pg_temp.assert_ai(has_function_privilege('service_role','public.authorize_saletrening_ai_request(uuid,text,uuid)','EXECUTE'),'backend can call metering RPC');
  perform pg_temp.assert_ai(not has_schema_privilege('authenticated','saletrening_private','USAGE'),'private counters are not exposed');
end;
$tests$;
select 'PASS: ownership, subscription, trial, cached scoring, rate/session budgets and legacy audio' as result;
rollback;

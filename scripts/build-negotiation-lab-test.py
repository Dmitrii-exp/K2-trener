from pathlib import Path
prefix="""begin;
create schema negotiation_test;
grant usage on schema negotiation_test to authenticated,service_role;
create table negotiation_test.users(id uuid primary key);
create table negotiation_test.companies(id uuid primary key);
create table negotiation_test.profiles(id uuid primary key,company_id uuid);
create table negotiation_test.saletrening_sessions(id uuid primary key,employee_id uuid,company_id uuid,total_score integer);
create table negotiation_test.allowed_reads(user_id uuid,session_id uuid);
grant select on negotiation_test.profiles,negotiation_test.saletrening_sessions,negotiation_test.allowed_reads to authenticated;
alter table negotiation_test.saletrening_sessions enable row level security;
create policy source_read on negotiation_test.saletrening_sessions for select to authenticated using(employee_id=(select auth.uid()) or exists(select 1 from negotiation_test.allowed_reads a where a.user_id=(select auth.uid()) and a.session_id=id));
insert into negotiation_test.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into negotiation_test.companies values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into negotiation_test.profiles select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid from negotiation_test.users;
insert into negotiation_test.saletrening_sessions values('cccccccc-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',74);
"""
source=Path('supabase/negotiation-lab.sql').read_text().replace('public.','negotiation_test.').replace('auth.users','negotiation_test.users')
tests="""
select negotiation_test.create_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','review','cccccccc-1111-4111-8111-111111111111','review:source','{"transcript":[],"finished":false}');
select negotiation_test.create_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-2222-4222-8222-222222222222','deal',null,'deal:manager','{"role":"manager","stage":0}');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin
 if (select count(*) from negotiation_test.negotiation_labs)<>2 then raise exception 'Own practice unavailable';end if;
 begin update negotiation_test.negotiation_labs set data='{}';raise exception 'Direct lab writes allowed';exception when insufficient_privilege then null;end;
 begin perform negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0}');raise exception 'Service RPC exposed';exception when insufficient_privilege then null;end;
 begin perform count(*) from negotiation_test.negotiation_lab_requests;raise exception 'Request table exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin if exists(select 1 from negotiation_test.negotiation_labs) then raise exception 'Cross owner read';end if;end $$;
reset role;
insert into negotiation_test.allowed_reads values('22222222-2222-4222-8222-222222222222','cccccccc-1111-4111-8111-111111111111');
set local role authenticated;
do $$begin if (select count(*) from negotiation_test.negotiation_labs)<>1 or exists(select 1 from negotiation_test.negotiation_labs where kind='deal') then raise exception 'Authorized report access exposed private practice';end if;end $$;
reset role;
delete from negotiation_test.allowed_reads;
set local role authenticated;
do $$begin if exists(select 1 from negotiation_test.negotiation_labs) then raise exception 'Revoked report access retained snapshot';end if;end $$;
reset role;
do $$declare r jsonb;begin
 r:=negotiation_test.claim_negotiation_lab('22222222-2222-4222-8222-222222222222','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0,"action":"review"}');if r->>'state'<>'forbidden' then raise exception 'Cross-owner claim';end if;
 begin perform negotiation_test.create_negotiation_lab('22222222-2222-4222-8222-222222222222','dddddddd-3333-4333-8333-333333333333','review','cccccccc-1111-4111-8111-111111111111','foreign','{}');raise exception 'Foreign source accepted';exception when insufficient_privilege then null;end;
 r:=negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0,"action":"review"}');if r->>'state'<>'claimed' then raise exception 'First claim';end if;
 r:=negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0,"action":"review"}');if r->>'state'<>'busy' then raise exception 'Concurrent duplicate';end if;
 r:=negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0,"action":"changed"}');if r->>'state'<>'conflict' then raise exception 'Request identity';end if;
 r:=negotiation_test.finish_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-2222-4222-8222-222222222222','{}');if r is not null then raise exception 'Stale finish';end if;
 perform negotiation_test.finish_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111',null);
 r:=negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-2222-4222-8222-222222222222','{"revision":0,"action":"other"}');if r->>'state'<>'conflict' then raise exception 'Failed request skipped';end if;
 r:=negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0,"action":"review"}');if r->>'state'<>'claimed' then raise exception 'Failed request not retryable';end if;
 r:=negotiation_test.finish_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"finished":true,"moments":[]}');if (r->>'revision')::int<>1 then raise exception 'Revision not updated';end if;
 r:=negotiation_test.claim_negotiation_lab('11111111-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','eeeeeeee-1111-4111-8111-111111111111','{"revision":0,"action":"review"}');if r->>'state'<>'cached' then raise exception 'Cached reply missing';end if;
 if (select count(*) from negotiation_test.negotiation_lab_requests)<>1 then raise exception 'Duplicate request row';end if;
 if (select total_score from negotiation_test.saletrening_sessions limit 1)<>74 then raise exception 'Original score changed';end if;
end $$;
update negotiation_test.profiles set company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin if exists(select 1 from negotiation_test.negotiation_labs) then raise exception 'Company transfer exposed prior practice';end if;end $$;
reset role;
select 'PASS: private practice and scoped report RLS, no client writes/service RPC, source ownership, stable claims/retries/cached replies, stale finish, company transfer and unchanged source score' as result;
rollback;
"""
print(prefix+source+tests)

from pathlib import Path
source=Path('supabase/mentor-chat-history.sql').read_text().replace('public.','mentor_chat_test.').replace('auth.users','mentor_chat_test.users')
prefix="""begin;
create schema mentor_chat_test;
grant usage on schema mentor_chat_test to authenticated,service_role;
create table mentor_chat_test.users(id uuid primary key);
create table mentor_chat_test.companies(id uuid primary key);
create table mentor_chat_test.profiles(id uuid primary key,company_id uuid);
grant select on mentor_chat_test.profiles to authenticated;
insert into mentor_chat_test.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into mentor_chat_test.companies values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into mentor_chat_test.profiles select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid from mentor_chat_test.users;
"""
tests="""
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select mentor_chat_test.create_mentor_dialogue('aaaaaaaa-1111-4111-8111-111111111111');
select mentor_chat_test.create_mentor_dialogue('aaaaaaaa-3333-4333-8333-333333333333');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select mentor_chat_test.create_mentor_dialogue('aaaaaaaa-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin
 if (select count(*) from mentor_chat_test.mentor_chat_dialogues)<>2 then raise exception 'RLS exposed other dialogue'; end if;
 begin
  update mentor_chat_test.mentor_chat_dialogues set messages='[]';raise exception 'Direct write allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Forged');raise exception 'Authenticated service RPC';
 exception when insufficient_privilege then null;end;
 begin
  perform mentor_chat_test.create_mentor_dialogue('aaaaaaaa-2222-4222-8222-222222222222');raise exception 'Claimed another owner dialogue';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare r jsonb;begin
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-2222-4222-8222-222222222222','cccccccc-1111-4111-8111-111111111111','Other user');
 if r->>'state'<>'forbidden' then raise exception 'Cross-user claim';end if;
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','First question');
 if r->>'state'<>'claimed' or jsonb_array_length(r->'messages')<>1 then raise exception 'First claim/context';end if;
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','First question');
 if r->>'state'<>'busy' then raise exception 'Duplicate concurrent claim';end if;
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Changed payload');
 if r->>'state'<>'conflict' then raise exception 'Idempotency content mismatch';end if;
 if mentor_chat_test.finish_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-2222-4222-8222-222222222222','Stale answer') then raise exception 'Stale finish';end if;
 perform mentor_chat_test.finish_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111',null);
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','First question');
 if r->>'state'<>'claimed' or jsonb_array_length(r->'messages')<>1 then raise exception 'Retry duplicated question';end if;
 perform mentor_chat_test.finish_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','First answer');
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','First question');
 if r->>'state'<>'cached' or r->>'reply'<>'First answer' then raise exception 'Cached response lost';end if;
 if (select jsonb_array_length(messages) from mentor_chat_test.mentor_chat_dialogues where id='aaaaaaaa-1111-4111-8111-111111111111')<>2 then raise exception 'Duplicate answer';end if;
 r:=mentor_chat_test.claim_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333','cccccccc-3333-4333-8333-333333333333','Fresh context');
 if jsonb_array_length(r->'messages')<>1 or r->'messages'->0->>'content'<>'Fresh context' then raise exception 'New chat context leaked';end if;
end $$;
update mentor_chat_test.profiles set company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin if exists(select 1 from mentor_chat_test.mentor_chat_dialogues) then raise exception 'Old company history exposed';end if;end $$;
reset role;
select 'PASS: private owner/company RLS, no client writes, service-only RPC, duplicate/busy/cached/retry semantics, stale finish, separate dialogue context' as result;
rollback;
"""
print(prefix+source+tests)

from pathlib import Path
import subprocess
base=subprocess.check_output(['python','scripts/build-mentor-history-test.py'],text=True).split('set local role authenticated;')[0]
source=Path('supabase/mentor-chat-attachments.sql').read_text().replace('public.','mentor_chat_test.').replace('storage.buckets','mentor_chat_test.buckets').replace('storage.objects','mentor_chat_test.objects')
setup="""
create table mentor_chat_test.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table mentor_chat_test.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table mentor_chat_test.objects enable row level security;
grant select,insert,update,delete on mentor_chat_test.objects to authenticated;
"""
tests="""
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select mentor_chat_test.create_mentor_dialogue('aaaaaaaa-1111-4111-8111-111111111111');
insert into mentor_chat_test.objects(bucket_id,name) values('mentor-private','11111111-1111-4111-8111-111111111111/aaaaaaaa-1111-4111-8111-111111111111/cccccccc-1111-4111-8111-111111111111.txt');
do $$begin
 if (select count(*) from mentor_chat_test.objects)<>1 then raise exception 'Own file hidden';end if;
 update mentor_chat_test.objects set name='changed';if found then raise exception 'Files mutable';end if;
 delete from mentor_chat_test.objects;if found then raise exception 'Files deletable';end if;
 begin
  perform mentor_chat_test.claim_mentor_turn_with_files('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Question','[]');raise exception 'Service RPC exposed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
 if exists(select 1 from mentor_chat_test.objects) then raise exception 'Other user file exposed';end if;
 begin
  insert into mentor_chat_test.objects(bucket_id,name) values('mentor-private','11111111-1111-4111-8111-111111111111/aaaaaaaa-1111-4111-8111-111111111111/foreign.txt');raise exception 'Other user upload allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare r jsonb; files jsonb:='[{"path":"11111111-1111-4111-8111-111111111111/aaaaaaaa-1111-4111-8111-111111111111/cccccccc-1111-4111-8111-111111111111.txt","name":"Условия.txt","type":"text/plain"}]';begin
 r:=mentor_chat_test.claim_mentor_turn_with_files('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Question',files);
 if r->>'state'<>'claimed' or r->'messages'->0->'attachments'<>files then raise exception 'Attachments not persisted/context missing';end if;
 perform mentor_chat_test.finish_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111',null);
 r:=mentor_chat_test.claim_mentor_turn_with_files('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Question','[]');
 if r->>'state'<>'conflict' then raise exception 'Retry changed attachments';end if;
 r:=mentor_chat_test.claim_mentor_turn_with_files('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Question',files);
 if r->>'state'<>'claimed' or jsonb_array_length(r->'messages')<>1 then raise exception 'Retry duplicate';end if;
 perform mentor_chat_test.finish_mentor_turn('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Answer');
 r:=mentor_chat_test.claim_mentor_turn_with_files('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','cccccccc-1111-4111-8111-111111111111','Question',files);
 if r->>'state'<>'cached' then raise exception 'Cached attachments retry';end if;
end $$;
update mentor_chat_test.profiles set company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin if exists(select 1 from mentor_chat_test.objects) then raise exception 'Company transfer exposed old files';end if;end $$;
reset role;
select 'PASS: owner/company file RLS, insert-only immutable storage, service-only RPC, persisted attachments, retry identity and cached reply' as result;
rollback;
"""
print(base+setup+source+tests)

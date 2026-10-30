from pathlib import Path
source=Path('supabase/personal-notes.sql').read_text().replace('public.','personal_notes_test.').replace('auth.users','personal_notes_test.users')
prefix="""begin;
create schema personal_notes_test;
grant usage on schema personal_notes_test to authenticated,service_role;
create table personal_notes_test.users(id uuid primary key);
create table personal_notes_test.companies(id uuid primary key);
create table personal_notes_test.profiles(id uuid primary key,company_id uuid);
grant select on personal_notes_test.profiles to authenticated;
insert into personal_notes_test.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into personal_notes_test.companies values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into personal_notes_test.profiles select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid from personal_notes_test.users;
"""
tests="""
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare r jsonb;begin
 r:=personal_notes_test.save_personal_topic('aaaaaaaa-1111-4111-8111-111111111111','Работа',0,'cccccccc-1111-4111-8111-111111111111');
 if (r->>'revision')::int<>1 then raise exception 'Create topic';end if;
 r:=personal_notes_test.save_personal_topic('aaaaaaaa-1111-4111-8111-111111111111','Работа',0,'cccccccc-1111-4111-8111-111111111111');
 if (r->>'revision')::int<>1 then raise exception 'Retry created duplicate';end if;
 r:=personal_notes_test.save_personal_note('bbbbbbbb-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','','Первый текст',0,'dddddddd-1111-4111-8111-111111111111');
 if r->>'title'<>'Первый текст' or (r->>'revision')::int<>1 then raise exception 'Create note/title';end if;
 r:=personal_notes_test.save_personal_note('bbbbbbbb-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','','Первый текст',0,'dddddddd-1111-4111-8111-111111111111');
 if (r->>'revision')::int<>1 then raise exception 'Retry changed revision';end if;
 r:=personal_notes_test.save_personal_note('bbbbbbbb-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','Заголовок','Изменённый текст',1,'dddddddd-2222-4222-8222-222222222222');
 if (r->>'revision')::int<>2 or r->>'content'<>'Изменённый текст' then raise exception 'Update failed';end if;
 begin
  perform personal_notes_test.save_personal_note('bbbbbbbb-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','Старое окно','Старый текст',1,'dddddddd-3333-4333-8333-333333333333');raise exception 'Stale overwrite';
 exception when serialization_failure then null;end;
 begin
  perform personal_notes_test.save_personal_note('bbbbbbbb-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','Иной текст','Иное содержимое',2,'dddddddd-2222-4222-8222-222222222222');raise exception 'Changed request payload';
 exception when serialization_failure then null;end;
 begin
  update personal_notes_test.personal_notes set content='Forged';raise exception 'Direct write allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform personal_notes_test.save_personal_topic('aaaaaaaa-3333-4333-8333-333333333333','',0,'cccccccc-3333-4333-8333-333333333333');raise exception 'Blank topic allowed';
 exception when invalid_parameter_value then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select personal_notes_test.save_personal_topic('aaaaaaaa-2222-4222-8222-222222222222','Личное',0,'cccccccc-2222-4222-8222-222222222222');
do $$begin
 if exists(select 1 from personal_notes_test.personal_notes) then raise exception 'Other user notes exposed';end if;
 if (select count(*) from personal_notes_test.personal_note_topics)<>1 then raise exception 'Other topic exposed';end if;
 begin
  perform personal_notes_test.save_personal_topic('aaaaaaaa-1111-4111-8111-111111111111','Чужая',1,'cccccccc-4444-4444-8444-444444444444');raise exception 'Foreign rename';
 exception when insufficient_privilege then null;end;
 begin
  perform personal_notes_test.save_personal_note('bbbbbbbb-2222-4222-8222-222222222222','aaaaaaaa-1111-4111-8111-111111111111','Захват','Текст',0,'dddddddd-4444-4444-8444-444444444444');raise exception 'Foreign parent accepted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update personal_notes_test.profiles set company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin
 if exists(select 1 from personal_notes_test.personal_notes) or exists(select 1 from personal_notes_test.personal_note_topics) then raise exception 'Old company data exposed';end if;
 begin
  perform personal_notes_test.save_personal_note('bbbbbbbb-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','Чужая компания','Текст',2,'dddddddd-5555-4555-8555-555555555555');raise exception 'Old company write';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: topic/note CRUD, title derivation, idempotent retries, stale-version and changed-payload rejection, denied direct writes, owner/company RLS and foreign-parent protection' as result;
rollback;
"""
print(prefix+source+tests)

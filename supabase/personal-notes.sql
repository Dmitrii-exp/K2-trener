create table public.personal_note_topics (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 revision integer not null default 1 check(revision>0),
 last_request_id uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_id,company_id)
);
create table public.personal_notes (
 id uuid primary key,
 topic_id uuid not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 200),
 content text not null check(char_length(content)<=50000),
 revision integer not null default 1 check(revision>0),
 last_request_id uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(topic_id,owner_id,company_id) references public.personal_note_topics(id,owner_id,company_id) on delete cascade
);
create index personal_topics_owner on public.personal_note_topics(owner_id,company_id,created_at desc,id desc);
create index personal_topics_company on public.personal_note_topics(company_id);
create index personal_notes_topic on public.personal_notes(topic_id,owner_id,company_id,updated_at desc,id desc);
create index personal_notes_owner on public.personal_notes(owner_id,company_id);
create index personal_notes_company on public.personal_notes(company_id);
alter table public.personal_note_topics enable row level security;
alter table public.personal_notes enable row level security;
revoke all on public.personal_note_topics,public.personal_notes from public,anon,authenticated;
grant select on public.personal_note_topics,public.personal_notes to authenticated;
grant all on public.personal_note_topics,public.personal_notes to service_role;
create policy personal_topics_own on public.personal_note_topics for select to authenticated using (
 owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=personal_note_topics.company_id)
);
create policy personal_notes_own on public.personal_notes for select to authenticated using (
 owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=personal_notes.company_id)
);

create function public.save_personal_topic(p_id uuid,p_title text,p_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;d public.personal_note_topics%rowtype;t text:=btrim(p_title);
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 select p.company_id into c from public.profiles p where p.id=u;
 if c is null then raise exception 'Company required' using errcode='42501';end if;
 if p_id is null or p_request_id is null or p_revision is null or p_revision<0 or t is null or char_length(t) not between 1 and 120 then raise exception 'Invalid topic' using errcode='22023';end if;
 if p_revision=0 then
  insert into public.personal_note_topics(id,owner_id,company_id,title,last_request_id) values(p_id,u,c,t,p_request_id) on conflict(id) do nothing returning * into d;
  if found then return to_jsonb(d);end if;
 end if;
 select * into d from public.personal_note_topics where id=p_id for update;
 if not found or d.owner_id is distinct from u or d.company_id is distinct from c then raise exception 'Forbidden' using errcode='42501';end if;
 if d.last_request_id=p_request_id then
  if d.title is distinct from t then raise exception 'Request content changed' using errcode='40001';end if;
  return to_jsonb(d);
 end if;
 if d.revision<>p_revision then raise exception 'Topic changed' using errcode='40001';end if;
 update public.personal_note_topics set title=t,revision=revision+1,last_request_id=p_request_id,updated_at=now() where id=p_id returning * into d;
 return to_jsonb(d);
end $$;
revoke all on function public.save_personal_topic(uuid,text,integer,uuid) from public,anon;
grant execute on function public.save_personal_topic(uuid,text,integer,uuid) to authenticated;

create function public.save_personal_note(p_id uuid,p_topic_id uuid,p_title text,p_content text,p_revision integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;d public.personal_notes%rowtype;t text;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 select p.company_id into c from public.profiles p where p.id=u;
 if c is null or not exists(select 1 from public.personal_note_topics x where x.id=p_topic_id and x.owner_id=u and x.company_id=c) then raise exception 'Topic unavailable' using errcode='42501';end if;
 if p_id is null or p_request_id is null or p_revision is null or p_revision<0 or p_content is null or char_length(p_content)>50000 or p_title is null or char_length(p_title)>200 or (btrim(p_title)='' and btrim(p_content)='') then raise exception 'Invalid note' using errcode='22023';end if;
 t:=coalesce(nullif(btrim(p_title),''),nullif(left(btrim(split_part(p_content,E'\n',1)),80),''),'Без названия');
 if p_revision=0 then
  insert into public.personal_notes(id,topic_id,owner_id,company_id,title,content,last_request_id) values(p_id,p_topic_id,u,c,t,p_content,p_request_id) on conflict(id) do nothing returning * into d;
  if found then return to_jsonb(d);end if;
 end if;
 select * into d from public.personal_notes where id=p_id for update;
 if not found or d.owner_id is distinct from u or d.company_id is distinct from c or d.topic_id is distinct from p_topic_id then raise exception 'Forbidden' using errcode='42501';end if;
 if d.last_request_id=p_request_id then
  if d.title is distinct from t or d.content is distinct from p_content then raise exception 'Request content changed' using errcode='40001';end if;
  return to_jsonb(d);
 end if;
 if d.revision<>p_revision then raise exception 'Note changed' using errcode='40001';end if;
 update public.personal_notes set title=t,content=p_content,revision=revision+1,last_request_id=p_request_id,updated_at=now() where id=p_id returning * into d;
 return to_jsonb(d);
end $$;
revoke all on function public.save_personal_note(uuid,uuid,text,text,integer,uuid) from public,anon;
grant execute on function public.save_personal_note(uuid,uuid,text,text,integer,uuid) to authenticated;

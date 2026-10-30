-- Personal mentor dialogues; no grants to other company members or managers.
create table public.mentor_chat_dialogues (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 title text not null default 'Новый диалог' check(char_length(title)<=100),
 messages jsonb not null default '[]'::jsonb check(jsonb_typeof(messages)='array'),
 status text not null default 'ready' check(status in ('ready','pending','failed')),
 current_request_id uuid,
 request_content text,
 pending_since timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index mentor_chat_owner_updated on public.mentor_chat_dialogues(owner_id,company_id,updated_at desc,id);
create index mentor_chat_company on public.mentor_chat_dialogues(company_id);
alter table public.mentor_chat_dialogues enable row level security;
revoke all on public.mentor_chat_dialogues from public,anon,authenticated;
grant select on public.mentor_chat_dialogues to authenticated;
grant all on public.mentor_chat_dialogues to service_role;
create policy mentor_chat_own on public.mentor_chat_dialogues for select to authenticated using (
 owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=mentor_chat_dialogues.company_id)
);
create function public.create_mentor_dialogue(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c uuid; existing public.mentor_chat_dialogues%rowtype;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select p.company_id into c from public.profiles p where p.id=u;
 if c is null then raise exception 'Company required' using errcode='42501'; end if;
 insert into public.mentor_chat_dialogues(id,owner_id,company_id) values(p_id,u,c) on conflict(id) do nothing;
 select * into existing from public.mentor_chat_dialogues where id=p_id;
 if existing.owner_id is distinct from u or existing.company_id is distinct from c then raise exception 'Forbidden' using errcode='42501'; end if;
 return p_id;
end $$;
revoke all on function public.create_mentor_dialogue(uuid) from public,anon;
grant execute on function public.create_mentor_dialogue(uuid) to authenticated;

-- These two RPCs are service-only. User identity comes from verified Auth in the Edge Function.
create function public.claim_mentor_turn(p_user_id uuid,p_dialogue_id uuid,p_request_id uuid,p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.mentor_chat_dialogues%rowtype; saved_user jsonb; saved_reply jsonb; context_messages jsonb;
begin
 if p_request_id is null or p_message is null or char_length(btrim(p_message)) not between 1 and 5000 then return jsonb_build_object('state','invalid'); end if;
 select * into d from public.mentor_chat_dialogues where id=p_dialogue_id for update;
 if not found or d.owner_id is distinct from p_user_id or not exists(select 1 from public.profiles p where p.id=p_user_id and p.company_id=d.company_id) then return jsonb_build_object('state','forbidden'); end if;
 select value into saved_user from jsonb_array_elements(d.messages) where value->>'request_id'=p_request_id::text and value->>'role'='user' limit 1;
 if saved_user is not null and saved_user->>'content' is distinct from p_message then return jsonb_build_object('state','conflict'); end if;
 select value into saved_reply from jsonb_array_elements(d.messages) where value->>'request_id'=p_request_id::text and value->>'role'='assistant' limit 1;
 if saved_reply is not null then return jsonb_build_object('state','cached','reply',saved_reply->>'content'); end if;
 if d.status='pending' and d.pending_since>now()-interval '2 minutes' then return jsonb_build_object('state','busy'); end if;
 if saved_user is not null and d.current_request_id is distinct from p_request_id then return jsonb_build_object('state','conflict'); end if;
 if saved_user is null then
  if jsonb_array_length(d.messages)>=500 then return jsonb_build_object('state','full'); end if;
  d.messages:=d.messages||jsonb_build_array(jsonb_build_object('role','user','content',p_message,'request_id',p_request_id,'created_at',now()));
 end if;
 update public.mentor_chat_dialogues set messages=d.messages,status='pending',current_request_id=p_request_id,request_content=p_message,pending_since=now(),title=case when jsonb_array_length(d.messages)=1 then left(p_message,80) else title end,updated_at=now() where id=d.id;
 select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into context_messages from (select value,ordinal from jsonb_array_elements(d.messages) with ordinality as m(value,ordinal) order by ordinal desc limit 20) tail;
 return jsonb_build_object('state','claimed','messages',context_messages);
end $$;
revoke all on function public.claim_mentor_turn(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_mentor_turn(uuid,uuid,uuid,text) to service_role;

create function public.finish_mentor_turn(p_user_id uuid,p_dialogue_id uuid,p_request_id uuid,p_reply text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare d public.mentor_chat_dialogues%rowtype;
begin
 select * into d from public.mentor_chat_dialogues where id=p_dialogue_id for update;
 if not found or d.owner_id is distinct from p_user_id or d.current_request_id is distinct from p_request_id or d.status<>'pending' or not exists(select 1 from public.profiles p where p.id=p_user_id and p.company_id=d.company_id) then return false; end if;
 if p_reply is null then
  update public.mentor_chat_dialogues set status='failed',pending_since=null,updated_at=now() where id=d.id;
 else
  if char_length(btrim(p_reply)) not between 1 and 12000 then raise exception 'Invalid reply'; end if;
  update public.mentor_chat_dialogues set messages=messages||jsonb_build_array(jsonb_build_object('role','assistant','content',p_reply,'request_id',p_request_id,'created_at',now())),status='ready',pending_since=null,updated_at=now() where id=d.id;
 end if;
 return true;
end $$;
revoke all on function public.finish_mentor_turn(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_mentor_turn(uuid,uuid,uuid,text) to service_role;

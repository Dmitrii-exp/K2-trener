-- Additive attachment support. Existing text-only RPC remains available for rollback.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mentor-private','mentor-private',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']) on conflict(id) do nothing;
create policy mentor_files_read on storage.objects for select to authenticated using (
 bucket_id='mentor-private' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.mentor_chat_dialogues d where d.id::text=(storage.foldername(name))[2] and d.owner_id=(select auth.uid()))
);
create policy mentor_files_insert on storage.objects for insert to authenticated with check (
 bucket_id='mentor-private' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.mentor_chat_dialogues d where d.id::text=(storage.foldername(name))[2] and d.owner_id=(select auth.uid()))
);
create function public.claim_mentor_turn_with_files(p_user_id uuid,p_dialogue_id uuid,p_request_id uuid,p_message text,p_attachments jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.mentor_chat_dialogues%rowtype; a jsonb; saved jsonb; result jsonb; context_messages jsonb;
begin
 if p_attachments is null or jsonb_typeof(p_attachments)<>'array' then return jsonb_build_object('state','invalid'); end if;
 if jsonb_array_length(p_attachments)>3 then return jsonb_build_object('state','invalid'); end if;
 select * into d from public.mentor_chat_dialogues where id=p_dialogue_id for update;
 if not found or d.owner_id is distinct from p_user_id or not exists(select 1 from public.profiles p where p.id=p_user_id and p.company_id=d.company_id) then return jsonb_build_object('state','forbidden'); end if;
 select value into saved from jsonb_array_elements(d.messages) where value->>'request_id'=p_request_id::text and value->>'role'='user' limit 1;
 if saved is not null and coalesce(saved->'attachments','[]'::jsonb) is distinct from p_attachments then return jsonb_build_object('state','conflict'); end if;
 for a in select value from jsonb_array_elements(p_attachments) loop
  if jsonb_typeof(a)<>'object' or char_length(a->>'name') not between 1 and 200
   or a->>'type' not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain')
   or a->>'path' not like p_user_id::text||'/'||p_dialogue_id::text||'/%'
   or not exists(select 1 from storage.objects o where o.bucket_id='mentor-private' and o.name=a->>'path')
   then return jsonb_build_object('state','invalid'); end if;
 end loop;
 result:=public.claim_mentor_turn(p_user_id,p_dialogue_id,p_request_id,p_message);
 if result->>'state'<>'claimed' then return result; end if;
 update public.mentor_chat_dialogues set messages=(select jsonb_agg(case when value->>'request_id'=p_request_id::text and value->>'role'='user' then value||jsonb_build_object('attachments',p_attachments) else value end order by ord) from jsonb_array_elements(messages) with ordinality m(value,ord)) where id=p_dialogue_id returning * into d;
 select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into context_messages from (select value,ord from jsonb_array_elements(d.messages) with ordinality m(value,ord) order by ord desc limit 20) tail;
 return jsonb_build_object('state','claimed','messages',context_messages);
end $$;
revoke all on function public.claim_mentor_turn_with_files(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_mentor_turn_with_files(uuid,uuid,uuid,text,jsonb) to service_role;

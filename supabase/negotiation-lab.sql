-- Additive practice workspace; original sessions, scores, credits and tasks are untouched.
create table public.negotiation_labs (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 kind text not null check(kind in ('review','replay','deal')),
 source_session_id uuid references public.saletrening_sessions(id) on delete set null,
 creation_key text not null,
 data jsonb not null check(jsonb_typeof(data)='object'),
 revision integer not null default 0,
 status text not null default 'ready' check(status in ('ready','pending','failed')),
 current_request_id uuid,
 request_payload jsonb,
 pending_since timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index negotiation_labs_owner on public.negotiation_labs(owner_id,company_id,updated_at desc,id);
create index negotiation_labs_source on public.negotiation_labs(source_session_id);
create index negotiation_labs_company on public.negotiation_labs(company_id);
alter table public.negotiation_labs enable row level security;
revoke all on public.negotiation_labs from public,anon,authenticated;
grant select on public.negotiation_labs to authenticated;
grant all on public.negotiation_labs to service_role;
create policy negotiation_labs_read on public.negotiation_labs for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.company_id=negotiation_labs.company_id)
 and (owner_id=(select auth.uid()) or (kind='review' and exists(select 1 from public.saletrening_sessions s where s.id=source_session_id)))
);
create table public.negotiation_lab_requests (
 lab_id uuid not null references public.negotiation_labs(id) on delete cascade,
 request_id uuid not null,
 payload jsonb not null,
 done boolean not null default false,
 primary key(lab_id,request_id)
);
alter table public.negotiation_lab_requests enable row level security;
revoke all on public.negotiation_lab_requests from public,anon,authenticated;
grant all on public.negotiation_lab_requests to service_role;

create function public.create_negotiation_lab(p_user_id uuid,p_id uuid,p_kind text,p_source_session_id uuid,p_key text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; d public.negotiation_labs%rowtype;
begin
 select company_id into c from public.profiles where id=p_user_id;
 if c is null or p_id is null or p_kind not in ('review','replay','deal') or p_key is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>900000 then raise exception 'Invalid lab' using errcode='42501'; end if;
 if p_source_session_id is not null and not exists(select 1 from public.saletrening_sessions where id=p_source_session_id and employee_id=p_user_id and company_id=c) then raise exception 'Forbidden source' using errcode='42501';end if;
 insert into public.negotiation_labs(id,owner_id,company_id,kind,source_session_id,creation_key,data) values(p_id,p_user_id,c,p_kind,p_source_session_id,p_key,p_data) on conflict(id) do nothing;
 select * into d from public.negotiation_labs where id=p_id;
 if d.owner_id is distinct from p_user_id or d.company_id is distinct from c or d.kind is distinct from p_kind or d.creation_key is distinct from p_key then raise exception 'Conflicting lab' using errcode='42501';end if;
 return to_jsonb(d);
end $$;
create function public.claim_negotiation_lab(p_user_id uuid,p_id uuid,p_request_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.negotiation_labs%rowtype; r public.negotiation_lab_requests%rowtype;
begin
 select * into d from public.negotiation_labs where id=p_id for update;
 if not found or d.owner_id is distinct from p_user_id or not exists(select 1 from public.profiles p where p.id=p_user_id and p.company_id=d.company_id) then return jsonb_build_object('state','forbidden');end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>10000 then return jsonb_build_object('state','invalid');end if;
 select * into r from public.negotiation_lab_requests where lab_id=p_id and request_id=p_request_id;
 if found then
  if r.payload is distinct from p_payload then return jsonb_build_object('state','conflict');end if;
  if r.done then return jsonb_build_object('state','cached','lab',to_jsonb(d));end if;
 elsif (p_payload->>'revision')::integer is distinct from d.revision then return jsonb_build_object('state','conflict');
 end if;
 if d.status='pending' and d.pending_since>now()-interval '2 minutes' then return jsonb_build_object('state','busy');end if;
 if d.status in ('pending','failed') and d.current_request_id is distinct from p_request_id then return jsonb_build_object('state','conflict');end if;
 if (select count(*) from public.negotiation_lab_requests where lab_id=p_id)>=200 and r.request_id is null then return jsonb_build_object('state','full');end if;
 insert into public.negotiation_lab_requests(lab_id,request_id,payload) values(p_id,p_request_id,p_payload) on conflict do nothing;
 update public.negotiation_labs set status='pending',current_request_id=p_request_id,request_payload=p_payload,pending_since=now() where id=p_id returning * into d;
 return jsonb_build_object('state','claimed','lab',to_jsonb(d));
end $$;
create function public.finish_negotiation_lab(p_user_id uuid,p_id uuid,p_request_id uuid,p_data jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.negotiation_labs%rowtype;
begin
 select * into d from public.negotiation_labs where id=p_id for update;
 if not found or d.owner_id is distinct from p_user_id or d.status<>'pending' or d.current_request_id is distinct from p_request_id or not exists(select 1 from public.profiles p where p.id=p_user_id and p.company_id=d.company_id) then return null;end if;
 if p_data is null then update public.negotiation_labs set status='failed',pending_since=null,updated_at=now() where id=p_id returning * into d;
 else
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>900000 then raise exception 'Invalid state';end if;
  update public.negotiation_labs set data=p_data,revision=revision+1,status='ready',pending_since=null,updated_at=now() where id=p_id returning * into d;
  update public.negotiation_lab_requests set done=true where lab_id=p_id and request_id=p_request_id;
 end if;
 return to_jsonb(d);
end $$;
revoke all on function public.create_negotiation_lab(uuid,uuid,text,uuid,text,jsonb),public.claim_negotiation_lab(uuid,uuid,uuid,jsonb),public.finish_negotiation_lab(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_negotiation_lab(uuid,uuid,text,uuid,text,jsonb),public.claim_negotiation_lab(uuid,uuid,uuid,jsonb),public.finish_negotiation_lab(uuid,uuid,uuid,jsonb) to service_role;

begin;
create schema if not exists saletrening_private;
revoke all on schema saletrening_private from public, anon, authenticated;

-- One row per company serializes reservations across all function instances.
create table if not exists saletrening_private.invitation_send_locks (
  company_id uuid primary key references public.companies(id) on delete cascade
);
create table if not exists saletrening_private.invitation_send_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient text not null,
  reserved_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz
);
create index if not exists invitation_send_attempts_company_time
  on saletrening_private.invitation_send_attempts(company_id, reserved_at);
alter table saletrening_private.invitation_send_locks enable row level security;
alter table saletrening_private.invitation_send_attempts enable row level security;
revoke all on saletrening_private.invitation_send_locks from public, anon, authenticated;
revoke all on saletrening_private.invitation_send_attempts from public, anon, authenticated;

-- Public schema is needed for PostgREST RPC; EXECUTE is service_role only.
create or replace function public.reserve_saletrening_invitation_send(
  p_user_id uuid, p_company_id uuid, p_invitation_id uuid, p_email text
) returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_now timestamptz;
  v_email text := lower(trim(p_email));
  v_retry_until timestamptz;
  v_attempt uuid;
  v_count integer;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('allowed',false,'status',400);
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_user_id
      and p.company_id=p_company_id and p.role in ('director','admin','manager')) then
    return jsonb_build_object('allowed',false,'status',403);
  end if;
  if not exists (select 1 from public.company_invitations i where i.id=p_invitation_id
      and i.company_id=p_company_id and lower(i.email)=v_email
      and i.accepted_at is null and i.expires_at > clock_timestamp()) then
    return jsonb_build_object('allowed',false,'status',403);
  end if;
  insert into saletrening_private.invitation_send_locks(company_id)
    values (p_company_id) on conflict do nothing;
  perform 1 from saletrening_private.invitation_send_locks
    where company_id=p_company_id for update;
  v_now := clock_timestamp();
  -- New invitation IDs for the same recipient cannot bypass the cooldown.
  select max(greatest(a.reserved_at + interval '60 seconds',
    case when a.finished_at is null then a.reserved_at + interval '120 seconds'
      else a.reserved_at + interval '60 seconds' end))
    into v_retry_until from saletrening_private.invitation_send_attempts a
    where a.company_id=p_company_id and a.recipient=v_email
      and a.reserved_at > v_now - interval '120 seconds';
  if v_retry_until > v_now then
    return jsonb_build_object('allowed',false,'status',429,
      'retry_after',greatest(1,ceil(extract(epoch from v_retry_until-v_now))::integer));
  end if;
  select count(*), min(a.reserved_at) + interval '1 hour' into v_count,v_retry_until
    from saletrening_private.invitation_send_attempts a
    where a.company_id=p_company_id and a.reserved_at > v_now - interval '1 hour';
  if v_count >= 30 then
    return jsonb_build_object('allowed',false,'status',429,
      'retry_after',greatest(1,ceil(extract(epoch from v_retry_until-v_now))::integer));
  end if;
  delete from saletrening_private.invitation_send_attempts
    where company_id=p_company_id and reserved_at < v_now - interval '1 day';
  insert into saletrening_private.invitation_send_attempts(company_id,recipient,reserved_at)
    values (p_company_id,v_email,v_now) returning id into v_attempt;
  return jsonb_build_object('allowed',true,'attempt_id',v_attempt);
end;
$function$;

create or replace function public.finish_saletrening_invitation_send(p_attempt_id uuid)
returns void language sql security definer set search_path = ''
as $function$
  update saletrening_private.invitation_send_attempts
    set finished_at=clock_timestamp() where id=p_attempt_id and finished_at is null;
$function$;
revoke all on function public.reserve_saletrening_invitation_send(uuid,uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.finish_saletrening_invitation_send(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_saletrening_invitation_send(uuid,uuid,uuid,text) to service_role;
grant execute on function public.finish_saletrening_invitation_send(uuid) to service_role;
commit;

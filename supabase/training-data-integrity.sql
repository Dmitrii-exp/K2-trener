begin;

-- Guard runs with the SQL caller's privileges, not the function owner's.
create or replace function public.protect_saletrening_session_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if current_user in ('postgres','service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'started';
    new.transcript := '[]'::jsonb;
    new.total_score := null;
    new.feedback := null;
    new.ai_summary := null;
    new.ai_evaluation := '{}'::jsonb;
    new.completed_at := null;
    new.duration_seconds := null;
    new.deal_closed := false;
    new.created_at := pg_catalog.now();
    new.started_at := pg_catalog.now();
    return new;
  end if;
  if (pg_catalog.to_jsonb(new) - array['transcript','updated_at'])
      is distinct from (pg_catalog.to_jsonb(old) - array['transcript','updated_at']) then
    raise exception 'session_server_fields_immutable' using errcode='42501';
  end if;
  if old.status not in ('started','in_progress')
      and new.transcript is distinct from old.transcript then
    raise exception 'completed_session_transcript_immutable' using errcode='42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists aaa_protect_saletrening_session_fields on public.saletrening_sessions;
create trigger aaa_protect_saletrening_session_fields
before insert or update on public.saletrening_sessions
for each row execute function public.protect_saletrening_session_fields();

-- Remove table-wide and any column-level client write grants.
revoke insert, update on public.saletrening_sessions from public, anon, authenticated;
do $block$
declare columns_sql text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_ident(attname), ', ' order by attnum)
    into columns_sql from pg_catalog.pg_attribute
    where attrelid='public.saletrening_sessions'::regclass and attnum>0 and not attisdropped;
  execute pg_catalog.format('revoke insert (%s), update (%s) on public.saletrening_sessions from public, anon, authenticated',columns_sql,columns_sql);
end;
$block$;
grant insert (employee_id, company_id, scenario_id, status, transcript, voice_mode,
              difficulty_level, assignment_id, training_kind, access_mode)
  on public.saletrening_sessions to authenticated;
grant update (transcript, updated_at) on public.saletrening_sessions to authenticated;

-- Scenarios have no company_id: they are a shared library.
drop policy if exists "company admins manage scenarios" on public.saletrening_scenarios;
drop policy if exists "platform admin manages shared scenarios" on public.saletrening_scenarios;
create policy "platform admin manages shared scenarios"
on public.saletrening_scenarios for all to authenticated
using ((select public.is_saletrening_super_admin()))
with check ((select public.is_saletrening_super_admin()));

alter function public.st_set_session_difficulty() set search_path = '';
alter function public.st_verify_hard_deal() set search_path = '';

commit;

begin;
create schema if not exists saletrening_private;
revoke all on schema saletrening_private from public, anon, authenticated;
create table if not exists saletrening_private.ai_request_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  operation text not null,
  window_start timestamptz not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, scope, operation, window_start)
);
alter table saletrening_private.ai_request_usage enable row level security;
revoke all on saletrening_private.ai_request_usage from public, anon, authenticated;

create or replace function public.authorize_saletrening_ai_request(
  p_user_id uuid, p_operation text, p_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_session public.saletrening_sessions%rowtype;
  v_subscription public.company_subscriptions%rowtype;
  v_access jsonb;
  v_unlimited boolean := false;
  v_session_limit integer;
  v_minute_limit integer := 30;
  v_used integer;
  v_minute timestamptz := pg_catalog.date_trunc('minute',pg_catalog.now());
  v_scope text;
begin
  if p_user_id is null or p_operation is null or p_operation not in ('reply','tts','stt','live','mentor','evaluate','diagnostic') then
    return jsonb_build_object('allowed',false,'reason','invalid_request','status',400);
  end if;
  select * into v_profile from public.profiles where id=p_user_id;
  if not found or v_profile.company_id is null then
    return jsonb_build_object('allowed',false,'reason','company_required','status',403);
  end if;
  if not exists(select 1 from public.organization_members where user_id=p_user_id and company_id=v_profile.company_id and status='active') then
    return jsonb_build_object('allowed',false,'reason','membership_required','status',403);
  end if;
  -- Retain only the pre-existing billing test exemption; no new admin rights.
  v_access := public.get_training_access(p_user_id,'text','');
  v_unlimited := coalesce((v_access->>'unlimited')::boolean,false);
  select * into v_subscription from public.company_subscriptions where company_id=v_profile.company_id;

  if p_operation='diagnostic' then
    if not coalesce(v_profile.is_super_admin,false) then
      return jsonb_build_object('allowed',false,'reason','admin_required','status',403);
    end if;
    v_minute_limit := 3;
  elsif p_operation='mentor' then
    if not v_unlimited and not coalesce(v_subscription.status='active' and v_subscription.seat_count>0 and (v_subscription.current_period_end is null or v_subscription.current_period_end>now()),false) then
      return jsonb_build_object('allowed',false,'reason','subscription_required','status',402);
    end if;
  else
    if p_session_id is not null then
      select * into v_session from public.saletrening_sessions where id=p_session_id and employee_id=p_user_id and company_id=v_profile.company_id;
    else
      -- Current audio clients do not send a session ID. Infer only this user's
      -- newest open voice session; explicit IDs never fall back to another row.
      select * into v_session from public.saletrening_sessions
        where employee_id=p_user_id and company_id=v_profile.company_id
          and status in ('started','in_progress','limit_exceeded')
          and (p_operation not in ('tts','stt','live') or voice_mode=true)
        order by started_at desc limit 1;
    end if;
    if v_session.id is null then
      return jsonb_build_object('allowed',false,'reason','training_required','status',403);
    end if;
    if p_operation='evaluate' and v_session.status='completed' and v_session.total_score is not null and v_session.ai_evaluation ? 'overall_score' then
      return jsonb_build_object('allowed',true,'cached_evaluation',v_session.ai_evaluation,'session_id',v_session.id);
    end if;
    if p_operation in ('reply','tts','live') and v_session.status not in ('started','in_progress') then
      return jsonb_build_object('allowed',false,'reason','training_closed','status',403);
    end if;
    if p_operation='stt' and v_session.status not in ('started','in_progress','limit_exceeded') then
      return jsonb_build_object('allowed',false,'reason','training_closed','status',403);
    end if;
    if p_operation in ('tts','stt','live') and not coalesce(v_session.voice_mode,false) then
      return jsonb_build_object('allowed',false,'reason','voice_training_required','status',403);
    end if;
    -- Ten-minute voice sessions retain five minutes to finish upload/transcription.
    if p_operation<>'evaluate' and (v_session.started_at is null or v_session.started_at < now() - case when v_session.voice_mode then interval '15 minutes' else interval '24 hours' end) then
      return jsonb_build_object('allowed',false,'reason','training_expired','status',403);
    end if;
    if not v_unlimited and not (
      (v_session.access_mode='trial' and coalesce(v_subscription.status='trial',false)) or
      (v_session.access_mode='paid' and coalesce(v_subscription.status in ('active','paid') and v_subscription.current_period_end>now(),false))
    ) then
      return jsonb_build_object('allowed',false,'reason','subscription_required','status',402);
    end if;
    if p_operation='reply' and (jsonb_typeof(v_session.transcript)<>'array' or jsonb_array_length(v_session.transcript)>30) then
      return jsonb_build_object('allowed',false,'reason','dialogue_limit','status',429);
    end if;
    -- Technical abuse ceilings, shared by all legacy aliases. They do not
    -- consume training credits or change the three-trainings-per-day rule.
    v_session_limit := case p_operation when 'reply' then 30 when 'tts' then 120 when 'stt' then 32 when 'live' then 3 when 'evaluate' then 3 end;
  end if;

  insert into saletrening_private.ai_request_usage as u(user_id,scope,operation,window_start,used)
    values(p_user_id,'minute',p_operation,v_minute,1)
    on conflict(user_id,scope,operation,window_start) do update set used=u.used+1 where u.used<v_minute_limit
    returning used into v_used;
  if v_used is null then return jsonb_build_object('allowed',false,'reason','rate_limit','status',429); end if;
  if v_session_limit is not null then
    v_scope := 'session:'||v_session.id::text;
    v_used := null;
    insert into saletrening_private.ai_request_usage as u(user_id,scope,operation,window_start,used)
      values(p_user_id,v_scope,p_operation,date_trunc('day',v_session.started_at),1)
      on conflict(user_id,scope,operation,window_start) do update set used=u.used+1 where u.used<v_session_limit
      returning used into v_used;
    if v_used is null then return jsonb_build_object('allowed',false,'reason','request_limit','status',429); end if;
  end if;
  return jsonb_build_object('allowed',true,'session_id',v_session.id,'operation',p_operation);
end;
$function$;
revoke all on function public.authorize_saletrening_ai_request(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.authorize_saletrening_ai_request(uuid,text,uuid) to service_role;
commit;

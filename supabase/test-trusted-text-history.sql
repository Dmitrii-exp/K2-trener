-- Run after the migration on an isolated database. All writes roll back.
begin;
do $$
begin
  if current_setting('techcontrol.allow_fixture', true) is distinct from 'on' then
    raise exception 'Enable techcontrol.allow_fixture only on a disposable test database';
  end if;
  if has_column_privilege('authenticated','public.saletrening_sessions','verified_text_dialogue','UPDATE')
    or has_column_privilege('authenticated','public.saletrening_sessions','verified_text_dialogue','INSERT')
    or has_column_privilege('authenticated','public.saletrening_sessions','verified_text_version','UPDATE')
    or has_column_privilege('authenticated','public.saletrening_sessions','verified_text_version','INSERT')
    or has_column_privilege('authenticated','public.saletrening_sessions','total_score','UPDATE')
    or has_column_privilege('authenticated','public.profiles','role','UPDATE')
    or has_table_privilege('authenticated','public.training_results','INSERT')
    or has_table_privilege('authenticated','public.session_scores','INSERT') then
    raise exception 'Client has a protected score, history or role write permission';
  end if;
end $$;

-- Run the branch and membership assertions separately with an app fixture.
create temporary table trusted_fixture(id uuid, company_id uuid);
insert into trusted_fixture values ('77000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub',id::text,true),
  set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated')::text,true)
from trusted_fixture;
do $$
declare f record;
begin
  select * into f from trusted_fixture;
  if app_private.branch_can_read(f.company_id,f.id) then
    raise exception 'An inactive or removed user can still read company history';
  end if;
  if not app_private.branch_can_read(null,f.id) then
    raise exception 'The owner lost access to personal legacy history';
  end if;
end $$;
rollback;

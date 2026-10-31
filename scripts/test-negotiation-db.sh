#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,service_role;
grant execute on function auth.uid() to authenticated,service_role;
SQL
python scripts/build-negotiation-lab-test.py | psql -v ON_ERROR_STOP=1 -q

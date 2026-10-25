# Invitation email send limits

## Status

Candidate implementation, tested locally. Not applied to production Supabase.
The current connector denies SQL execution and Edge Function inspection/deployment;
a successful GitHub commit or merge does not activate these limits.

## Behavior

- Minimum 60 seconds between send attempts to the same normalized recipient in
  the same company, even when a new invitation is created or another manager sends it.
- Maximum 30 attempts in a rolling hour for a company. Failed/uncertain attempts
  consume the quota to prevent retry abuse.
- A per-company database row lock makes reservation atomic across workers.
- An unfinished reservation blocks the recipient for 120 seconds; normal completion
  restores the 60-second cooldown. The two upstream requests each time out at 20 seconds.
  Timeouts can leave delivery uncertain: verify the recipient's inbox before retrying.
- HTTP 429 includes Retry-After. Database outages/missing RPCs fail closed with HTTP
  503, before generating authentication links or contacting the email provider.
- Existing invitation IDs, membership checks, email-only links and privacy remain.
  The creation endpoint and frontend are unchanged. No CAPTCHA is introduced.

The quota tables use RLS without client policies and have no anon/authenticated
privileges. The two narrowly scoped SECURITY DEFINER RPCs use an empty search_path
and grant EXECUTE only to service_role. The reservation also checks the actor's
company/role and the invitation's recipient, expiry and acceptance status.

## Apply in order

1. Apply supabase/invitation-send-limits.sql to K2-trener (svxykakyrloqzloerygb).
2. Verify SQL grants and run the reservation tests in an isolated test database.
3. Deploy supabase/functions/send-company-invitation/index.ts, preserving the
   function's existing JWT settings and environment secrets. Deploying the new
   function before its SQL causes sends to return 503.
4. Verify one invitation with an authorized test recipient, followed by a repeat
   request returning 429. This sends one real email and has not been performed.

No REG.RU frontend deployment is needed. To revert, redeploy the prior Edge
Function first; the new private tables and RPCs can remain unused. Do not drop
shared schemas or modify existing invitations, billing or training data.

## Local validation

    node scripts/test-invitation-privacy.cjs
    npm install --prefix /tmp/invitation-sql-audit @electric-sql/pglite@0.3.14 --ignore-scripts --no-audit --no-fund
    PGLITE_MODULE=/tmp/invitation-sql-audit/node_modules/@electric-sql/pglite node scripts/test-invitation-limits.cjs

The PGlite test executes the actual SQL against a minimal isolated fixture schema:
role/company/recipient denial, cooldown across invitation IDs, worker-crash expiry,
30th allowed / 31st denied in a rolling hour, aged quota recovery, repeat installation,
RLS and RPC/table grants. It does not prove production schema compatibility or
true multi-connection lock behavior. Edge tests mock the RPC and email provider:
five parallel requests result in one mocked send; denied or broken limiter never
calls the provider; cleanup failure cannot mask a completed send. No real emails,
production data writes or paid AI calls were made.

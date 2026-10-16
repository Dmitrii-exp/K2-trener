# Private invitation delivery

Managers prepare an invitation and send the registration email. Only the recipient receives the authentication link. Manager responses contain a non-secret invitation record ID and delivery status.

## Deployment order

1. Deploy `main` using the existing **Deploy SaleTrening to REG.RU** GitHub Actions workflow. This uploads `deploy/index.html` and `deploy/company-invitations.js`.
2. Verify `https://app.sale-trener.ru/` references `/company-invitations.js?v=20261016-private` and that asset is served successfully.
3. Deploy `supabase/functions/send-company-invitation/index.ts` to the existing `send-company-invitation` function with JWT verification enabled.
4. Apply `supabase/invitation-privacy.sql`. It preserves RLS and metadata reads, but reserves token access and invitation writes to the backend. Existing recipient acceptance RPCs run as SECURITY DEFINER and keep their existing permissions.
5. Verify `authenticated` and `anon` cannot read the `token` column or write invitation records directly. Verify the deployed function matches the committed source.

The new frontend supports the previous API during the transition, discarding its authentication URL without rendering or logging it. Full server-side privacy takes effect after steps 3–4. The updated backend accepts pending invitations from an older open tab. Reload old tabs after deploying the frontend.

## Validation

- `python scripts/check_frontend.py`
- `node scripts/test-invitation-privacy.cjs`
- `node scripts/test-training-runtime.cjs`
- `node scripts/test-voice-runtime.cjs`

Invitation tests use mocked Supabase Auth and email delivery. They do not send email or modify production users. They cover recipient-only link delivery, safe responses on success/error, authentication/role checks, invitation ownership filters, email mismatch, retry, duplicate clicks, and root/REG.RU asset parity.

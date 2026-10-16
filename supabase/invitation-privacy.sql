-- Apply after deploying the private invitation handler and REG.RU frontend.
-- Recipients still accept invitations via the existing SECURITY DEFINER RPCs.
begin;
revoke all privileges on table public.company_invitations from public, anon, authenticated;
revoke select (token), insert (token), update (token) on public.company_invitations from public, anon, authenticated;
grant select (id, company_id, email, role, invited_by, expires_at, accepted_at, created_at)
  on public.company_invitations to authenticated;
-- Existing RLS policies still limit metadata reads to authorized company managers.
commit;

# Server-side AI access

All sixteen deployed billable AI functions use `supabase/functions/_shared/ai-access.ts`. The guard verifies the user with Supabase Auth, then calls the service-only `authorize_saletrening_ai_request` RPC before entering the original handler. Failure to verify access fails closed. Provider prompts, models, voices and transport payloads remain unchanged.

## Access rules

- Active company membership is required. A supplied session ID must belong to that user and company; an invalid explicit ID never falls back to another record.
- Training requests require a session already admitted by the existing billing/credit trigger. Continuations do not consume another training credit or reapply the daily-start limit.
- Trial sessions retain access after their start consumed the last trial credit. Paid mentor chat requires the existing paid-chat entitlement. The pre-existing billing test exemption is retained without granting new roles.
- Audio endpoints require a voice session. Existing audio clients omit session IDs, so the RPC resolves only the user's newest open voice session.
- Closed sessions cannot generate further replies or speech. Voice request admission allows fifteen minutes from session start, including upload/transcription grace after the ten-minute call. Text request admission allows twenty-four hours. Completed evaluations with a stored overall score return the cached evaluation without contacting the provider.
- Legacy diagnostic endpoints require the platform super-admin flag.

## Technical ceilings

These protect API spending and do not change training-credit counts. All aliases share the same operation bucket. Counters use atomic PostgreSQL upserts; clients cannot read or modify them.

| Operation | Requests per minute per user | Requests per training |
|---|---:|---:|
| Client reply | 30 | 30 |
| Speech synthesis | 30 | 120 (streamed sentence chunks) |
| Speech recognition | 30 | 32 (including final recording recovery) |
| Live connection creation | 30 | 3 (including failed attempts/retries) |
| Evaluation | 30 | 3; completed results are cached |
| Paid mentor | 30 | Not session-bound |
| Legacy diagnostics | 3 | Platform admin only |

Failed provider requests also consume a technical attempt. The private usage table is in `saletrening_private`, has RLS enabled, no client grants and no client schema access; the public RPC grants EXECUTE only to service_role. The RLS-with-no-policy advisory for this private table is intentional: direct access is denied and only its SECURITY DEFINER RPC updates it.

## Deployment and verification

The SQL patch is `supabase/ai-request-access.sql`. Each function bundle includes `<slug>/index.ts` plus `_shared/ai-access.ts`, preserving its original deno.json where present and JWT verification.

Applied to the K2-trener Supabase project and all sixteen functions. Retrieved deployed source was compared with the committed candidate. `supabase/test-ai-request-access.sql` passed with temporary fixtures and rollback; it covers ownership, membership, paid/trial access, cached evaluations, rate ceilings, explicit-ID isolation, legacy audio and RPC permissions. `node scripts/test-ai-request-guard.cjs` passed and verifies denial occurs before the provider handler, JSON/form bodies remain readable, encoded mentor modes cannot bypass paid-chat checks, errors fail closed and every AI entry point is wrapped. Frontend, invitation and training-runtime regression checks passed.

No real emails, paid AI calls or live calls were made for verification. This gate bounds connection creation, not an already established direct WebRTC connection's provider-side duration. A strict server-enforced live-stream duration would require supported provider controls or a server relay; the existing browser timer is not proof of that limit. Signup abuse, native Auth rate limits, password policies and REG.RU response headers remain separate follow-up work. No REG.RU frontend deployment is required for this change.

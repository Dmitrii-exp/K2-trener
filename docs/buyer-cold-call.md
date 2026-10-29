# Purchasing cold-call mode

User decisions (2026-10-29): add Manager/Buyer buttons to Cold call. Buyer phones an AI wholesale tyre supplier and negotiates price, delivery, payment and bonuses. Assess five procurement competencies, strengths/weaknesses and agreed terms from the real transcript.

## Ownership and compatibility

- Existing purchasing scenario 19 («Холодный звонок поставщику») is used. No tables, migrations, grants, auth or billing changes.
- Browser `coldCall.mode` controls setup only. Persisted scenario_id identifies the saved role and evaluator rubric. Live supplier mode verifies its session's persisted purchasing scenario via current-user REST/RLS before contacting the provider.
- Supplier instruction owner: `_shared/supplier-behavior.ts`. Shared catalogue selection supports seller instructions while default buyer instructions stay unchanged.
- Evaluator owner: `_shared/buyer-rubric.ts`, selected only for persisted scenario IDs 19–33. Client request transcripts/mode cannot override it. Original manager evaluation remains intact.
- Existing score columns are reused: discovery=conditions, objection=refusal handling, value=negotiation, communication=overall value/interests, closing=agreements. The buyer report uses correct labels. Overall is the sum of all five valid 1–20 scores; incomplete evaluations return a retryable error before writes.
- `ai_evaluation` JSON also stores rubric buyer_v1 and negotiation_result (initial/agreed conditions, supported savings, unresolved issues). Existing strengths, weaknesses and recommendations remain in session_scores. Transcript speaker keys remain manager/client; buyer UI displays Buyer/Seller.
- Existing record/save/finish, access checks, achievement eligibility and manager mode are preserved. No new AI provider/model is introduced.

## Initial fictional supplier policies

These are training policies only, not verified terms of any real catalogue company. Default opening is catalogue reference price, 100% prepayment, separately calculated delivery, no discount. Hidden maximum discount: easy 6%, medium 4%, hard 2%. Different stable supplier profiles permit free delivery from 40–60 tyres and credit of 0, 7 or 14 days subject to verification. Allowed bonus: 2-day reservation or 3-day price fixing. Limits are not guaranteed concessions: each requires relevant arguments and reciprocal commitments. No invented transport cost or stock promise. Model instructions enforce these policies; this is not a deterministic pricing engine.

## Exact pre-release backups / rollback

Before changes all three deployed source bundles matched byte-for-byte repository commit `8af8f6798e1e811ef5181aebb29f84101b983a5a`, tree `ef8283f9442d0a16cb61165a12e066432b183f70`:
- gpt-live-session v27 (verify_jwt=true).
- chat-client v69 (verify_jwt=true).
- evaluate-session-v3 v25 (verify_jwt=true).

To roll back functions, redeploy the complete relevant entrypoint and relative dependencies from that immutable commit with JWT verification retained. New supplier/rubric modules are then unused. Frontend REG.RU deployment backs up exactly five public files before writes (including cold-call-voice-v5.js), uploads backup artifact first, verifies FTPS and public HTTPS hashes, publishes index.html last, and automatically restores attempted files on error. New release archives contain five paths; old four-path archives cannot restore this expanded release through the strict manifest check.

Tests verify real handler wiring and persisted-role selection with mocked providers, both-role frontend switching, scoped report escaping and browser/mobile layout. They do not assert paid model output or perform actual live calls.

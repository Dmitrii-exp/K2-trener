# Gemini Live trial

A separate unscored cold-call modal with four selectable voices (Orus, Alnilam, Algenib, Schedar). Existing GPT Live,
text/voice training, points, achievements, levels and training credits are unchanged.
No training session, result or transcript is persisted by this feature. The visible
trial ends after at most three minutes; switching tabs, closing it or leaving the
page stops the microphone, output audio and socket.

## Deployment

1. Add `GEMINI_API_KEY` in Supabase project `svxykakyrloqzloerygb` Edge Function
   secrets. Use a dedicated billed Google AI API project with a small quota/budget.
   Never put the key in HTML, browser JavaScript, git or chat.
2. Deploy `supabase/functions/gemini-live-preview/index.ts` with its existing
   `../_shared/ai-access.ts` dependency and JWT verification enabled. No migrations
   or changes to existing functions are required.
3. Merge this feature branch after review. Run the existing manual
   `.github/workflows/deploy-reg-ru.yml` workflow to publish `deploy/`.
4. Log in with an entitled synthetic test account. Open Cold Call → Try Gemini Live.
   Start with Orus, then compare Alnilam, Algenib and Schedar. Speak first. Test Russian
   pronunciation, interruption during speech, mute/unmute, End, Escape and mobile.
   Check that points, achievements, levels and credit balances do not change.

Default model: `gemini-3.1-flash-live-preview`. Server-only `GEMINI_LIVE_MODEL`
may select another explicitly allowlisted model. Verify availability in the Google
project before changing it. Voice/model/prompt/setup are constrained in the
single-use provider token, not entrusted to browser-supplied configuration.
The existing authenticated company/subscription and mentor rate gate runs before
issuing tokens. No persistent Google credential reaches the browser.

## Validation

Passed locally: six new Node tests (token constraints, entitlement rejection,
allowlists/error sanitization, HTTP bounds, PCM resampling and mirrored assets),
existing frontend, text runtime, voice runtime and AI request guard checks.

A Chromium/WebAudio test is supplied in `scripts/test-gemini-live-browser.cjs`.
Auth, token and Google socket are synthetic, microphone/WebAudio are real browser
APIs. It has NOT completed in this environment: Chromium download returned a
truncated archive. Run with Playwright installed and
`CODEX_PRIMARY_RUNTIME_NODE_MODULES` pointing to the node_modules directory.
Deno type checking/provider deployment and a paid Google conversation also need
verification; local npm registry access did not complete. No quality, latency or
actual savings measurements are available yet.

The three-minute browser timer is a UX limit, not a trusted billing ceiling.
Token expiry limits credential validity; do not rely on it as proof an already
connected provider session is forcibly terminated. Subscription checks and
rate-limits reduce access but a trusted hard per-session spend cap would require
server-proxied audio/session enforcement. Provider budget alerts are not necessarily
hard spending limits. Start with a dedicated low-quota Google project.

This trial does not fix the pre-existing training-history trust boundary. Scored
Gemini training requires a separate server-authoritative session/transcript and
idempotent evaluation/points implementation before enabling rewards.

## Rollback

Remove the Gemini button, stylesheet/script references and mirrored trial assets,
or redeploy the previous frontend commit. Delete/disable only the new
`gemini-live-preview` function and revoke its dedicated Google key. No database
rollback is needed.

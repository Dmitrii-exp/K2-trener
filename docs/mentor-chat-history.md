# Private AI mentor dialogue history

User request: a History button in AI-chat and a separate conversation for every New chat.

- New owner-private `mentor_chat_dialogues` table stores title, dates and full messages. RLS requires both current auth.uid() ownership and current profile company. No manager/super-admin exception. Browser roles have SELECT only; new dialogues use an auth-checked RPC. No browser writes to stored messages.
- Edge Function authenticates as before and receives dialogue_id/request_id. Service-only row-locking RPCs reserve a turn and append the reply. The function uses persisted context only for these requests; legacy cached clients retain the old nonpersistent endpoint behaviour.
- Context sent to AI is the last 20 messages of this dialogue, including the current user message once. Full stored history remains available; nothing is silently trimmed. At 500 stored messages, a new chat is requested and old history is retained.
- Request IDs bind retries to the same exact content. Cached completed replies avoid another provider call; concurrent pending work returns a retryable status. Provider timeout is 45 seconds; abandoned locks can be retried after 2 minutes. A stale completion cannot overwrite a newer turn. Safe displayed replies are stored; transient errors never become assistant messages.
- Each frontend record owns draft/busy/error/retry state. Starting/opening another chat cannot capture the first chat’s answer. Account/company changes invalidate cached state; no message bodies go into localStorage. History uses current-user REST/RLS and keyset pagination.
- Anonymous access, direct authenticated writes and other-owner access are denied. SQL tests create only an isolated fixture schema in a transaction ending ROLLBACK; no real users, accounts or conversations are added.

## Verification

SQL fixture: `python scripts/build-mentor-history-test.py` executed as a rollback-only transaction. Covers own/company RLS, denied direct writes, service-only claims, foreign dialogue rejection, busy/cache/content-conflict/retry behaviour, stale completion and fresh context.
Handler test: `node scripts/test-mentor-history.cjs` verifies authenticated identity, persisted context, no provider calls for cached/busy/forbidden requests, reply persistence, failure recovery, sanitized reply and legacy compatibility. Providers are mocked.
Browser workflow covers new/list/open/continue, reload persistence, in-flight switching, stable retry ID, escaped content, account switching, empty/error recovery and 320/390/1440px widths. No paid AI conversation is claimed.

## Backup and rollback

The exact manager-ai-chat v21 source (verify_jwt=true) and its ai-access dependency matched immutable commit `3240ce81657e2c965ad4d500850261ea83501069`, tree `6983ba6e0dd33960bfc697c4d3b2b099d61abd66`, before modification. Redeploy those exact files to roll back the endpoint. Frontend deployment backs up six paths including the new mentor-chat.js before any write and verifies public HTTPS hashes, publishing index.html last.

The migration is additive. For rollback, retain the dialogue table and its saved messages; restore the old frontend/function. Do not drop the table or delete user conversations. The new RPCs can be revoked separately if needed. Earlier five-file frontend archives cannot be applied through the expanded six-path strict manifest check; use this release’s backup artifact.

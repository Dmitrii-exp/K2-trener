# Repair log — 2026-08-27

## Verified
- GitHub write access restored.
- Supabase project `K2-trener` is healthy.
- Edge functions are active with JWT verification.
- `chat-client` had repeated HTTP 500 failures in logs.
- `evaluate-session` had repeated HTTP 502 failures in logs.

## Repair
- Deployed `chat-client` version 7.
- Added the same Russian Trusted Root CA HTTP client configuration already used by `evaluate-session`.
- Normalized GigaChat credential handling and OAuth error reporting.

## Next
- Exercise an authenticated training session and verify `chat-client` and `evaluate-session` end-to-end.
- Then fix the frontend result/history flow and remaining UI placeholders.

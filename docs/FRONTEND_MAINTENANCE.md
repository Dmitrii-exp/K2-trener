# Frontend maintenance

The production entry is the repository root `index.html` (static HTML/JS).

CSS loads once, in this order:
1. `assets/app.css`: existing base styles and page components.
2. `assets/legacy-ui.css`: existing dashboard visual overrides.
3. `assets/auth.css`: desktop and mobile login/registration layout.

Keep legacy `.auth` overrides scoped away from `.auth-desktop`. New auth layout
rules belong in `auth.css`. The unused scenario-editor fragment was removed:
it had no startup call, no editor state, and referenced undefined P/O/E globals.
This does not add a scenario editor or change database settings.

`startTraining` delegates to `__launchTextTrainingV7`. Only the V7 module creates
text training sessions. Do not restore click interception or timer-based wrappers
around this function. Voice runtime remains `cold-call-voice-v5.js`.

Old one-time repair workflows are archived (manual trigger, job disabled). They
must not rewrite and push production source after each commit. The read-only
`frontend-checks.yml` validates changes instead.

Checks from repository root:

    python scripts/check_frontend.py
    node scripts/test-training-runtime.cjs

The concurrency tests use mocks and never write to Supabase. Browser checks on
2026-09-25 covered login at 320, 390, 768, 900, 1024 and 1440 pixels, registration
navigation, empty-email reset validation and catalog handler parsing. Real login,
email delivery, live AI replies and database policies were not exercised.

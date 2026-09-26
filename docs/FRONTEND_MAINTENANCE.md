# Frontend maintenance

The production entry is the repository root `index.html` (static HTML/JS).

CSS loads once, in this order:
1. `assets/app.css`: existing base styles and page components.
2. `assets/auth.css`: desktop and mobile login/registration layout.
3. `assets/home-premium.css`: dashboard styles scoped to `.dashboard-shell`.

`assets/legacy-ui.css` and `canva-ui.js` were removed. Do not restore those
style/renderer overrides. Cold-call filters load directly from `index.html`.
Voice V5 owns `trainingCallPage`; `index.html` owns the fallback text renderer
and reports.

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
    node scripts/test-voice-runtime.cjs

The concurrency tests use mocks and never write to Supabase. Browser checks on
2026-09-25 covered login at 320, 390, 768, 900, 1024 and 1440 pixels, registration
navigation, empty-email reset validation and catalog handler parsing. Real login,
email delivery, live AI replies and database policies were not exercised.

## 2026-09-26 runtime follow-up

Voice V5 owns cold-call launch, rendering and recorder state. Its Back action
returns through the application `window.render`, not the voice-local renderer.
A launch lock prevents concurrent session inserts. Typed-turn persistence stays
inside try/finally so network rejection cannot leave the controls locked.
Live recorder handles are declared locally and stopped during cleanup.

Text V7 has five grid rows; the transcript uses `minmax(0, 1fr)` so long
conversations scroll instead of pushing the composer and finish action out.

Regression checks use mocked persistence, AI and audio. They do not establish
that production authorization, microphone permissions, TTS or Supabase work.

## 2026-09-26 design cleanup

Removed the unused legacy stylesheet and Canva monkey patches that replaced
text training, voice training and report renderers after startup. Existing
report rendering remains in index.html. Voice page rendering now has one owner
in V5, including navigation redraws. Data/AI/auth functions were not changed.

Removed 242 superseded CSS selector declarations only where a later declaration
with identical selector, property and media condition wins. Kept source order
and responsive breakpoints. An offline cascade comparison at 320, 390, 600,
760, 768, 800, 900, 901, 1024, 1050, 1200 and 1440 px, each with normal and
reduced motion, preserved all selector/property values except the intentional
nav-icon sizing correction. This is static evidence, not a browser layout test.

Navigation uses 24px icon slots and 22px SVGs; removed the old 19px SVG selector
and unnecessary icon !important declarations.

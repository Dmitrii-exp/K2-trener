# Cold-call modes

Cold-call settings expose Advanced (existing GPT Live, default) and Regular
(experimental, separate recognition / text model / synthesis). Assigned voice
trainings keep their existing Advanced route. Switching modes preserves character,
facts and difficulty and shows only the relevant voice selector.

Regular uses the existing authenticated Supabase functions proxy-stt, chat-client
(SSE) and proxy-tts through ProxyAPI, with existing server model/secret settings.
STT/TTS now receive the active session ID for the existing entitlement gate.
There are no database migrations and no changes to server evaluation or rewards.

Microphone capture starts at call launch. After about 600ms of silence a completed
utterance is recognized; this is NOT continuous streaming ASR. Text response SSE
starts synthesis per sentence. Microphone capture continues while the AI answers;
three VAD checks above the speech threshold cancel the current turn/audio. Ending
or leaving cancels regular requests/audio and prevents stale responses from being
added to a subsequent session. Speech interrupted during playback is not committed
as a fully completed AI reply. Speakerphone echo cancellation effectiveness needs
real-device testing; use headphones for the first comparison.

Passed offline checks: frontend syntax/assets; mode routing and preserved settings;
authenticated session IDs on STT/TTS; final SSE delta and ordered speech;
interruption/exit cancellation; existing invitation login, text/voice runtime and
AI access gate tests. Auth/provider/audio were mocked for new runtime checks.
The strict UI audit reports the same four existing findings in cold-call-filters.js,
landing/index.html and scrollbar rules; no new mode-control finding. Chromium is
not installed in the current environment, so browser/audio quality, true VAD
interruption behaviour, latency and cost have not been measured.

Publish with the existing manual REG.RU workflow from main. Compare the same
scenario on Advanced and Regular: speech recognition, first-audio delay, Russian
voice/accent, interruptions, End/Back during each request, permission/network error,
retry, and successful/failed training completion. Measure ProxyAPI charges for
Regular separately from direct OpenAI charges for Advanced. No price saving is
claimed before measurement. No new keys are placed in frontend code.

Rollback: redeploy the previous main commit 497d3af1f25286a7e14353386697a91e31815018.

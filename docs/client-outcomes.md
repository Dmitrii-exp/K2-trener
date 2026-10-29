# Training client outcomes

Business source: user decision, 2026-10-28. Applies to the potential-client role in text training (`chat-client`) and live cold calls (`gpt-live-session`). Mentor chat and supplier role in purchasing scenarios retain their behaviour.

`_shared/client-outcomes.ts` is the single instruction owner. Evaluate the actual objection handling after a meaningful opportunity to respond; no final outcome after just a greeting, first objection, or the manager's assertion of success.

- A decision maker whose substantial doubts have been resolved agrees: «Хорошо, отправляйте КП». This does not constitute an order or payment.
- If the manager had an opportunity but ignored needs or left substantial doubts unresolved, the client refuses: «Извините, но мне не интересно ваше предложение».
- An interested non-decision-maker can give the buyer's training contact, 88005353555. A technician judges quality/applicability, not price/budget. The role and authority remain stable. Contact disclosure is not unconditional and does not imply the buyer's agreement.
- Partial progress continues the conversation. No artificial new objection after earned agreement. Do not invent a recipient email/name, another number, or an action performed in the real world. Do not call or message the training contact.

These are model instructions, not deterministic decisions. The automated tests verify the real handlers' instruction wiring and role boundaries using mocked provider responses; they do not claim to verify model decisions in paid live calls. Scoring, access control, subscriptions, models, audio and session persistence are unchanged.

## Pre-release backup and rollback

The exact deployed source files and all bundled dependencies were retrieved before modification and verified byte-for-byte against the GitHub tree at commit `f9cce4b62433705a8809a6cd7e987460c47797f3` (tree `15bddc6d9054881cae19e6faf1d45620eda13bd9`). This immutable commit is the complete source backup:

- `gpt-live-session`: version 26, verify_jwt=true; entrypoint `gpt-live-session/index.ts`, dependencies `_shared/ai-access.ts`, `_shared/cold-call-behavior.ts`, `_shared/product-catalog.ts`, `_shared/product-catalog-data.ts`.
- `chat-client`: version 68, verify_jwt=true; entrypoint `chat-client/index.ts`, dependency `_shared/ai-access.ts`.

Rollback redeploys those exact files from that commit to the corresponding function with verify_jwt=true. No database migration or static frontend deployment is required.

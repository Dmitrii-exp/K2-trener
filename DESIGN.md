# TrenerSale Design Context

## Product
AI-тренажёр продаж для менеджеров и руководителей. Интерфейс должен ощущаться как рабочий B2B-инструмент: спокойный, быстрый, уверенный, без декоративного шума.

## Visual direction
- Light application canvas with graphite navigation.
- Primary accent: restrained violet, used for actions, progress and focus.
- Surfaces: white, thin neutral borders, minimal shadow.
- Typography: compact sans-serif hierarchy with strong display headings and highly readable utility text.
- Signature: dark training hero that visually separates active practice from analytics.
- Radius system: 16–28px depending on hierarchy; avoid excessive pill styling.
- Motion: short functional transitions only; respect reduced motion.

## Runtime mapping
Home-specific visual tokens live in `assets/home-premium.css` and are scoped to `.dashboard-shell`.
Global application primitives remain in `assets/app.css`.
Authentication remains in `assets/auth.css`.
Legacy UI stylesheet and Canva renderer overrides have been removed to prevent cascade collisions.
Shared CSS keeps media-query order; redundant declarations are removed only within identical selector/condition pairs.
Navigation icons use a single 24px container and 22px SVG rule without `!important`.

## Constraints
Do not alter Supabase auth, invitation flow, training runtime, AI calls, session persistence or navigation behavior as part of visual work.
Desktop and mobile must preserve the same functional controls.

## Invitation privacy
Manager invitation controls are owned by `company-invitations.js`, shared by the root and REG.RU entry points. Managers prepare an invitation and send it by email; the form shows the recipient and delivery status only. Authentication links and invitation tokens are generated and kept server-side, and are delivered only to the recipient. Browser responses carry only a non-secret invitation record ID. Recipient registration behavior is unchanged.

## Invitation login switch
Invitation links initially show registration. Both existing-account controls explicitly select login; the invitation token and email stay available for acceptance after sign-in. Login uses current-password autocomplete; registration uses new-password. Switching views never accepts an invitation or changes account data.

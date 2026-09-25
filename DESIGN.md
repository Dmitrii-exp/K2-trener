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
Legacy UI stylesheet is no longer loaded by `index.html` to prevent cascade collisions.

## Constraints
Do not alter Supabase auth, invitation flow, training runtime, AI calls, session persistence or navigation behavior as part of visual work.
Desktop and mobile must preserve the same functional controls.

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

## Branches and company TOP
The current static HTML, native selects, primary/secondary buttons, card/table styling and `toast()` remain canonical. `company-branches.js` owns branch creation/assignment and the names-only directory. `manager-history.js` loads server-confirmed branch capabilities before history. The database enforces branch scope; frontend flags only control navigation. New async pages share `setPageHTML` loading/error and stale-response protection. Assignment controls use explicit labels and prevent duplicate requests. Existing auth, training and billing behavior is preserved.

## Mobile TOP and team assignment
At 700px and below, TOP uses employee cards with all four labeled metrics; larger screens keep the table. The team card opens the company-branches native dialog to assign role and branch through the existing RPC. Native dialog owns focus trapping/Escape; branch creation is available when there are no branches.

## Network director assignment
The existing database director role is labeled «Руководитель сети». Only the server-confirmed platform-administrator capability exposes that assignment option. Network directors need no branch selection. Existing branch/member roles use the shared position RPC; no client flag grants permissions.

## Employee progress charts
Analytics owns per-employee SVG line charts of all completed numeric scores. X is the ordinal scored training, Y is fixed 0–100. Native range controls reveal exact score/date on touch and keyboard; ResizeObserver keeps axes legible on phones. Failed/unevaluated sessions are excluded, empty and single-point states remain honest. The existing analytics summary receives the same full-history metrics without mutating shared team state. REST reads use the current user token and existing company/branch RLS; no new database grants or AI requests.

Analytics uses the canonical labeled native select to show one authorized employee at a time. Selection updates both summary and chart immediately from loaded history, keeps focus in the select, and is retained in memory only while that employee remains in the current authorized roster. Platform-owned popup geometry is intentional, including on phones.

## Cold-call purchasing mode
Cold-call setup uses two standard primary/secondary toggle buttons with aria-pressed in a labeled group. Each role keeps its in-memory setup draft and keyboard focus. Buyer mode calls the existing purchasing scenario 19, has a wholesale supplier counterpart, and hides customer objections. Report labels reflect buyer competencies; saved transcript speaker keys and existing score columns remain compatible. Fictional supplier concessions are training-only and server-owned. Existing manager behaviour, auth, billing and achievements are preserved.

## Navigation simplification
The sidebar omits «Мой прогресс» and «Сценарии». Training selection remains in «Тренировки», detailed manager metrics in «Аналитика», and personal completed results in «История». Text and voice hangup return to history; legacy progress/scenarios view names normalize to history/training. No permission or evaluation behaviour changes.

## Personal mentor dialogues
AI-chat uses its existing card/message/composer styling with «История» and «Новый чат» actions. History contains private, server-persisted dialogues with first-question titles and dates. Each dialogue owns its draft, pending request and errors; switching does not move an answer to another thread. Failed requests are retryable without duplicate user messages. No message bodies are stored in browser localStorage. Native buttons and labels remain canonical, with wrapping actions/composer at mobile widths.

## Personal notes
The main menu includes «Заметки». Topics and entries use existing cards, native buttons, labeled fields and explicit Save. Desktop has a topic sidebar plus notes/editor workspace; phones stack these regions with natural page scrolling. Drafts remain in memory across in-app navigation; leaving the page or signing out warns about unsaved text. Saved notes are private to their owner/current company. No delete controls are introduced.

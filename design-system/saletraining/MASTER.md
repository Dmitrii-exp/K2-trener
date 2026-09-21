# SaleTrening — UI/UX Pro Max Design System

## Product
AI sales-training SaaS / B2B productivity application for sales managers and teams.

## Visual direction
- Primary style: AI-Native UI + Minimalism
- Secondary style: Trust & Authority / clean B2B SaaS
- Tone: premium, focused, modern, operational
- Avoid: excessive gradients, decorative clutter, heavy glassmorphism, emoji-as-icons, oversized empty areas, horizontal scrolling.

## Color tokens
- Primary: #7357FF
- Primary hover: #6245E8
- Primary soft: #EEEAFE
- App background: #F7F7FB
- Surface: #FFFFFF
- Surface muted: #FAF9FF
- Text: #171827
- Text secondary: #6F7285
- Border: #E6E7EF
- Success: #20B486
- Danger: #D84D5B
- Sidebar: #15131F
- Sidebar surface: #211D32

## Typography
- Primary: Inter/system sans
- Base: 16px
- Body line-height: 1.5
- Headings: 700–850 weight, tight tracking
- Avoid body text below 12px except metadata.

## Layout
- Desktop: fixed 250px sidebar + fluid content.
- Main content must use width: calc(100% - sidebar) and min-width: 0.
- No horizontal page scroll.
- Content max-width is contextual, not a hard global width.
- Dashboard grids use minmax(0, 1fr).
- Responsive checkpoints: 1440, 1024, 768, 375.
- Cards must shrink/reflow rather than overflow.

## Components
- Cards: 16–20px radius, 1px neutral border, restrained shadow.
- Buttons: minimum 44px touch target.
- Primary CTA: solid purple, clear label, no emoji dependency.
- Navigation: clear active state, consistent icon box.
- Status: text + semantic indicator, never color alone.
- Forms: visible labels, inline errors, clear focus ring.
- Voice screen: large status area, obvious microphone state, compact controls, no live transcript required.

## Motion
- Micro-interactions 150–220ms.
- Page/section transitions 200–300ms.
- Respect prefers-reduced-motion.
- Never animate layout dimensions when transform/opacity is sufficient.

## Accessibility / UX
- Contrast target >= 4.5:1.
- Keyboard-visible focus.
- Click/touch targets >= 44x44px.
- Labels and icon buttons must be accessible.
- Long labels and chips must wrap instead of clipping.
- Error messages appear next to the affected action.
- Loading states must preserve layout and communicate progress.

## Dashboard rules
- Prioritize today's action and training CTA.
- Metrics are compact and scannable.
- Keep cards visually aligned.
- Use charts only when they add decision value.

## Cold call rules
- Voice interaction is the primary task.
- One dominant action: start speaking.
- Status changes must be immediate and clear.
- Do not render a scrolling transcript during the live call.
- Preserve complete dialogue in training history.
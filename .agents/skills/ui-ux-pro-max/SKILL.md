---
name: ui-ux-pro-max
description: UI/UX design intelligence for SaleTrener. Use when designing, building, reviewing, or fixing interfaces, including pages, components, design systems, accessibility, responsive layout, typography, color, charts, and stack-specific UI implementation.
---

# UI/UX Pro Max — SaleTrener

Use this skill for all UI/UX work in this repository. Keep existing functionality intact unless the user explicitly asks to change it.

## Source
Official project: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Official CLI installation: `npx ui-ux-pro-max-cli init --ai codex`

## Required workflow

1. **Inspect before editing**
   - Identify the current page, components, styles, assets, and existing design-system files.
   - Preserve authentication, Supabase data flow, training logic, voice logic, and existing working behavior.
   - Do not replace a working screen wholesale unless explicitly requested.

2. **Establish a design system before broad UI changes**
   - Product: AI sales-training SaaS.
   - Audience: sales managers and sales teams.
   - Visual direction: light main workspace, graphite/dark navigation, restrained purple accent, modern SaaS, clean cards, strong hierarchy.
   - Prioritize usability and information density over decoration.
   - Use semantic design tokens instead of scattered hard-coded colors.

3. **For targeted work, reason by domain**
   - style: visual language, surfaces, effects
   - color: palette and contrast
   - typography: font hierarchy and readability
   - ux: interaction, forms, navigation, accessibility
   - icons: consistent icon family and semantics
   - landing: marketing page structure
   - react / nextjs: implementation and performance
   - chart: data visualization

4. **Responsive and accessibility requirements**
   - Mobile-first behavior must remain usable at 375px and wider desktop widths.
   - Body text should maintain at least 4.5:1 contrast.
   - Interactive targets should have adequate hit areas.
   - Do not use emoji as structural UI icons.
   - Use SVG/icon libraries consistently.
   - Respect keyboard focus and reduced-motion preferences.

5. **Visual quality**
   - Avoid excessive gradients, glassmorphism, decorative blobs, random shadows, inconsistent radii, and arbitrary spacing.
   - Maintain a consistent 4/8px spacing rhythm.
   - Use one clear primary CTA per context.
   - Keep card hierarchy and sidebar navigation visually stable.
   - Prefer subtle micro-interactions that do not shift layout.

6. **Before delivery**
   - Check desktop and mobile layouts.
   - Check hover/focus/disabled/loading states.
   - Check text wrapping and overflow.
   - Check contrast and icon consistency.
   - Verify that functional/auth/data behavior was not changed accidentally.

## SaleTrener design baseline

- Main background: light neutral.
- Sidebar: graphite/dark.
- Primary accent: purple.
- Cards: clean, moderately rounded, low visual noise.
- Typography: modern neutral sans-serif with strong heading/body contrast.
- Navigation: compact, predictable, with active state clearly visible.
- Dashboard: prioritize quick start, training scenarios, effectiveness, history, mentor/chat and daily goal.
- Do not introduce a new visual language without checking the existing `design-system/saletraining` files first.

## Change discipline

UI changes should be isolated from business logic where possible. Before modifying a shared component or stylesheet, inspect its consumers. Never remove or rename existing auth/data identifiers merely to improve appearance.

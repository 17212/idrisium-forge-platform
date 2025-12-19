# PROJECT_BLUEPRINT – IDRISIUM Forge Platform

## Overview
- Rebuild landing layout to embody IDRISIUM Corp’s offline-first, privacy-first ethos.
- Remove legacy hero/control/feed/cards matching previous screenshots; replace with a cinematic “Forge 2.0” narrative: focused hero, live pulse rail, submission CTA, launchpad cards, momentum timeline, and founder/About presence.
- Keep AR/EN friendly typography with Cairo/IDRISIUMfont, strict dark (#000) background, neon green (#39FF14) and aurora teal accents, glassmorphism surfaces, rounded 16–24px, interactive press feedback.

## Stack
- HTML5 with Tailwind CDN for utility scaffolding.
- Custom CSS (`styles.css`) for brand theming (neon, glass, aurora background, chips, cards, motion).
- Vanilla JS (`app.js`) already present for auth/feed; retained hooks for future wiring after layout refresh.

## Target File Tree (key surfaces)
- `index.html` – New structure:
  - Header: brand + phase chip + auth slot.
  - Main:
    - Hero slab with claim, IDRISIUM founder credit, primary CTA + secondary.
    - Metrics rail (live pulse, karma, streak, status).
    - Launchpad grid (Top signal, Fresh drops, Founder picks).
    - Momentum timeline & Weekly spotlight.
    - Submission CTA strip.
    - About IDRISIUM Corp & founder contact (required by company rules).
  - Footer: brand/socials.
- `styles.css` – Theming, glass, neon buttons, gradients, cards, timeline, grid, responsive tweaks.
- `app.js` – Existing logic kept; UI bindings will target new IDs/classes where needed after layout swap.

## Notes
- Strict dark background, neon accents, glass cards, hover/press feedback.
- Use Arabic-first copy with concise English labels where helpful.
- Ensure responsive grid (1–2 columns on mobile, 2–3 on desktop), avoid horizontal scroll.

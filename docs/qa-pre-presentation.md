# Pre-presentation QA — 2026-09-26

Scope: all 29 routes × 6 languages (EN, RU, ZH, TR, AR, ES). No copy, translations, project data, imagery mapping, URLs or design direction changed.

## Method
- Automated layout audit (Playwright/Chromium), 1,740 page renders: 29 routes × 6 languages × 10 widths (320, 375, 390, 430, 768, 834, 1024, 1280, 1440, 1920) plus extra passes at 360/414/480/1366/1536. Checks: document overflow, every element outside the viewport (ignoring clipped decoration), text overflowing its box, broken images, one H1 per page, runtime/console errors.
- Interaction tests: mobile menu (open/Escape/close on navigation/scroll/targets) at 320–768 in EN/AR/RU/ZH; language switch EN→RU/ZH/TR/AR/ES and back on 12 page types (60 switches) incl. refresh; back/forward; unknown URL; every internal link on every page resolves to a real route; home CTAs; video links; dialogs (Escape, scroll lock, keyboard open).
- Visual review of rendered screenshots at 320/390/768/1024/1440 in all languages.
- English text regression vs previous build (only intended changes).

Result after fixes: 0 layout issues, 0 broken links, 0 broken images, 0 runtime errors; TypeScript and production build pass.

## Fixes
| Issue | Where | Fix |
|---|---|---|
| Mobile header wider than the screen: menu button 30–65 px off-screen, language button partly cut (320–430 px, all languages) | Header, all pages | Header CTA hidden below 640 px and added as a full-width button at the bottom of the mobile menu; logo 44 px tall on phones (50 px from 640 px, aspect ratio kept); tighter gap |
| Mobile menu: small tap targets, no Escape, stayed open after back/forward or language change, could exceed short screens | Header | 40 px+ targets, Escape closes, closes on any route change, scrollable within viewport, `aria-expanded`/`aria-controls` |
| Heading → paragraph spacing missing (text touching the heading) | About, Global Presence, EPCM, Contact, product/technology/project detail sidebars | Root cause: `ScrollReveal` wrapper swallowed the parent's `space-y-*`; spacing now applied on the wrapper |
| Home “EPCM approach” row cut off at the edge on phones/tablets with no scroll hint; step labels split mid-word in RU/TR/ES | Home | Trailing-edge fade (mirrored in Arabic) + end padding; steps are real buttons; RU/TR/ES/AR labels get more width and never split mid-word |
| Video Materials: All Projects card squeezed to ~150 px at 1024–1279 (“VIEW / ALL / PROJECTS”) | Home | 5/5/2 layout from 1280 px; below that two video cards + full-width All Projects card with reduced min-height |
| Technology cards: “LEARN MORE” wrapped at 1024 | Home | No-wrap label |
| “Learn more” technology cards, “Explore our IP portfolio”, “Our EPC/EPCM approach” opened the inquiry form | Home | Now navigate to the technology page (or /technologies for the two groups without a page), /technologies/patents and /epcm; SPECS dialog unchanged |
| Hero capability line could start a wrapped line with “|” | Home | Each tag stays with its separator |
| Orphans / one-word last lines | All headings & paragraphs, all languages | `text-wrap: balance` (headings) and `pretty` (paragraphs) |
| Long single words overflowing (Arabic compound terms at 320 px) | Product detail (AR) etc. | `overflow-wrap: break-word` on headings |
| E-mail overflowing narrow cells / breaking mid-word | Footer (768), page-header info cells (Contact 320–1024) | E-mail may wrap only after “@” |
| “SHOWING n …” row colliding with the right-hand note on phones | Products, Projects, Technologies | Row wraps with a gap |
| Image captions (“EPCM PHASE 03”, “View Specs”) squeezed into 3 lines | EPCM, Technologies | Label no-wrap, caption shrinks/wraps |
| Footer link columns cramped at 768–1023 | Footer | Brand block above, 3 link columns |
| Dialogs: no Escape, background scrolled, patent/stage dialogs could exceed small screens | Inquiry form, SPECS, EPCM step, patent dialogs | Shared `useDialog` hook (Escape + scroll lock), `max-h-[90vh]` scroll, `role="dialog"` on the inquiry form |
| Form labels not linked to inputs | Contact page, CTA forms, inquiry form | `htmlFor`/`id` via `useId` |
| Patent cards clickable with mouse only | Home | Keyboard operable (`role="button"`, Enter/Space, focus ring) |
| Heading level skip (h2→h4) | Technology detail, related projects | h3 with identical styling |
| Focus visibility on logo, language and menu buttons | Header | Visible focus outline |
| Heavy images: 14.2 MB of JPEG in /public/images | Site-wide | Re-encoded at quality 85, same files/dimensions → 4.4 MB total; below-fold images lazy-loaded; logo has intrinsic size (no layout shift) |

## Not changed (report only)
- Forms: BACKEND NOT IMPLEMENTED (simulated submit, leads are not stored or sent).
- Footer “Privacy Policy” / “Terms of Use” open the inquiry form because no legal pages exist — content needed.
- Content: EPCM page shows 10 stages (“Ten structured stages”), home shows 7; see docs/copy-audit.md for the full content list (company age, capacities, dates, patents, UAE/SOLTEX GROUP LTD, working hours, © 2024, outdated ISO versions…).
- Project detail “Facility archive imagery” strip is hidden for the six projects with verified photos (only one verified photo each); returns automatically when more verified photos are added.
- Project detail page band “Precision Separation & Multi-Stage Evaporation Infrastructure” uses a generic illustration on every project.
- Verified project photos are 300–1,400 px wide and look soft in the full-width detail hero; higher-resolution originals needed.
- Home metric labels in ZH/AR break into very short lines because the translations keep the English line breaks.
- Main JS bundle 513 kB (140 kB gzip); route-level code splitting would be the next performance step. Brand fonts load from Google Fonts.

## Follow-up (2026-09-28): EPCM stages consolidated to the approved 8
- Single source: `EPCM_STAGES` in `src/data/soltexData.ts` (approved master: 01 Feasibility study → 08 Maintenance & support).
- Home “From concept to commercial production” and `/epcm` both render `EPCM_STAGES`; fields used: `number`, `title`, `focus`, `description`, `deliverables`.
- Removed the duplicate 7-step list hard-coded in `EpcmStages.tsx` and the 10-stage `EPCM_SERVICES_DETAILED` in `pagesData.ts`.
- `/epcm` subtitle now “Eight structured stages …” (was “Ten …”); stage list label reuses the existing “KEY DELIVERABLES & SCOPE”; image captions from the 10-stage version removed (they described stages that no longer exist); stage images keep the “EPCM PHASE 0n” label.
- Translations for the approved stage texts added in RU/ZH/TR/AR/ES (46 strings each), following docs/i18n-terminology.md.
- Not changed (not stage lists): footer EPCM links (Feasibility Study, Engineering, Procurement, Construction Management, Turnkey Process, all → /epcm); project “scope of delivery” items; unused component `FeaturedProject.tsx` (not rendered anywhere).

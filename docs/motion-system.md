# Soltex motion system & warm palette

"Precision engineering expressed through motion": one easing (`--ease-precise`, cubic-bezier(0.16, 1, 0.3, 1)), short distances, transform/opacity/clip-path only. No animation library, no scroll hijacking, no continuous loops.

## Files
| File | Role |
|---|---|
| `src/styles/motion.css` | All motion tokens, primitives, keyframes, hover systems, reduced-motion rules |
| `src/motion/prefs.ts` | Sets `html.motion-ready` / `html.vt` before first paint; `withViewTransition()` |
| `src/motion/useRevealSystem.ts` | The single IntersectionObserver (+ MutationObserver) driving all reveals |
| `src/motion/usePresence.ts` | Keeps dialogs/menus mounted ~220 ms for exit transitions |
| `src/components/ScrollReveal.tsx` | `<ScrollReveal variant index group>` wrapper (renders `data-reveal`) |
| `src/components/EpcmProcessRail.tsx` | Scroll-linked 8-stage rail on /epcm |
| `src/i18n/Link.tsx` | Page changes run inside a View Transition |
| `src/hooks/useDialog.ts` | Escape, scroll lock, focus return for every dialog |

## Primitives (data attributes)
| Attribute | Use | Effect |
|---|---|---|
| `data-reveal="up"` | grouped content | fade + 28 px rise (14 px on phones) |
| `data-reveal="mask"` | headings | masked upward reveal; real, selectable text |
| `data-reveal="image"` | framed images | shutter rises, photo settles 1.06 → 1 |
| `data-reveal="line"` (`data-origin="center"`, `data-axis="y"`) | hairlines | draws from reading start (RTL aware) |
| `data-reveal="step"` | process nodes | settle from 0.9 |
| `data-reveal-group` | grids, columns | members reveal together, staggered in DOM order (`--rv-i`) |
| `--rv-i`, `--rv-d` | inline style | stagger index / extra delay (inherited by nested reveals) |

Automatic inside page content (`[data-page]`): every `h2` → mask, every `.image-zoom-container` → image. Opt out with `data-motion="manual"` (hero, page headers use their own choreography). Card titles (`.s-card h2`) reveal with their card.

State lives in `data-rv="in" → "done"` (not in classes, which React owns). "done" hands transitions back to each element's own hover styles.

## Choreographed entrances
- Home hero: image settles (2.2 s) · eyebrow line draws · label · three headline lines masked in sequence (330/430/530 ms) · description · capability line · primary CTA · secondary CTA · USP. Metric ribbon follows at 550 ms.
- Every inner page header: architectural grid lines draw vertically · breadcrumbs · section badge + drawn taupe hairline · masked title · subtitle · description · action · meta cells staggered.

## Page transitions
View Transitions API: old page eases out (240 ms, −10 px), new page rises in (560 ms, +18 px); the header is a named, static layer; a forest→taupe hairline sweeps under the header on every route change. Browsers without the API keep the CSS entrance. Language switching uses the same transition and keeps scroll position.

## Interaction systems
- `.s-card`: forest top line draws on hover/focus, taupe border, `.s-meta` / `.s-num` step forward, `.s-overlay` lightens. Applied to technology, project, product, patent and video cards.
- `.s-btn`: taupe underline draws on hover/focus, 1 px press. All primary green/gold CTAs.
- `.s-link`: underline draws (footer).
- Navigation: sliding forest indicator (translate + scaleX) rests on the current section, follows hover/focus; mobile menu and language list items settle in sequence; menu fades out on close.
- Dialogs: backdrop fade + panel 0.98 → 1; reverse on close; Escape, backdrop, close button, scroll lock, focus return.
- EPCM: home stepper draws node → arrow → node (8 stages); /epcm rail fills with scroll, active node and active card top line.

## Warm palette (supporting only)
Tailwind tokens (`@theme` in `src/index.css`): `beige #E9DFC8`, `beige-soft #F3EEE2`, `warm #F8F7F2`, `taupe #CDBA9A`, `ink #282828`, `sage #6B8463`, `pine #254F3D`. Existing Soltex greens (`--color-forest…`) remain the primary identity.

Used in: home EPCM and IP bands; bottom summary bands on Projects, Patents, About (capabilities), Global Presence (sites); page-header section badges and meta cells; technical chips/labels (feedstocks, patents, office badges, inquiry topic); performance box (project detail), IP box (contact); dividers in home EPCM/IP columns; card hover borders; button/route hairlines; EPCM rail node ring; language-menu hover.

## Accessibility & performance
- `prefers-reduced-motion`: no `motion-ready` class → nothing is hidden, no reveals, no view transitions, no hover movement; transitions shortened globally.
- Content is never gated on JS: hidden states only exist under `html.motion-ready`.
- Only transform / opacity / clip-path are animated; one observer for the whole site; the EPCM scroll listener is attached only while the list is visible and rAF-throttled. No new dependencies.

# Design system (as implemented)

Status: current as of Phase M-1 (commit 959f733)

This file describes what the code does today. It is not a target specification. The design intent (Design Direction V1.0 and its V1.1 logo amendments) lives in the claude.ai project; how far the site follows it is tracked in [`design-v1-implementation.md`](design-v1-implementation.md). Motion is documented separately in [`motion-system.md`](motion-system.md).

**Sources in code**

| What | File |
|---|---|
| Tailwind entry, tokens, base typography, i18n/RTL rules | `apps/web/src/index.css` |
| Motion tokens and primitives | `apps/web/src/styles/motion.css` |
| Font loading, body colours, motion boot script | `apps/web/index.html` |
| Per-language fallback fonts | `apps/web/src/i18n/config.ts` (`fallbackFonts`), injected by `apps/web/scripts/prerender.ts` |
| Admin tokens | `apps/admin/src/styles.css` |

The site uses **Tailwind CSS 4** through `@tailwindcss/vite`. There is no `tailwind.config.*` file; tokens are declared in CSS (`@theme` and `:root`).

---

## 1. Colour

### 1.1 Declared tokens

**Primary identity** (`:root` variables in `index.css`, `@layer base`). These are CSS variables, **not** Tailwind utilities: they are referenced from CSS (`var(--color-forest)`), not as classes.

| Token | Hex | Role |
|---|---|---|
| `--color-forest` | `#0E482C` | Brand green: primary buttons, headline colour, links, active states |
| `--color-forest-dark` | `#0A3620` | Button hover |
| `--color-forest-deep` | `#072516` | Deep green grounds |
| `--color-forest-muted` | `#1B5E3C` | Secondary green (card number hover in `motion.css`) |
| `--color-brass` | `#B89758` | Gold accent (dots, rules) |
| `--color-brass-light` | `#D4B982` | Gold on dark grounds |
| `--color-brass-dim` | `#997A3E` | Darker gold |
| `--color-paper` | `#FBFBF8` | Page background |
| `--color-paper-subtle` | `#F3F3EC` | Subtle section ground |
| `--color-paper-card` | `#FFFFFF` | Card ground |
| `--color-charcoal` | `#121815` | Body text |
| `--color-charcoal-muted` | `#2A3630` | Muted text |

**Supporting warm palette** (`@theme` in `index.css`, so these **are** Tailwind utilities such as `bg-beige-soft`, `border-taupe`). Accents only: section bands, labels, hairlines, hover borders.

| Token | Hex |
|---|---|
| `beige` | `#E9DFC8` |
| `beige-soft` | `#F3EEE2` |
| `warm` | `#F8F7F2` |
| `taupe` | `#CDBA9A` |
| `ink` | `#282828` |
| `sage` | `#6B8463` |
| `pine` | `#254F3D` |

`site.webmanifest`: `theme_color #0E482C`, `background_color #FBFBF8`.

### 1.2 How colour is applied in components

Components mostly use **arbitrary hex values** (`bg-[#0E482C]`, `text-[#16211B]`) rather than token utilities. The most frequent values in `components/` and `pages/`:

| Hex | Use | Token equivalent |
|---|---|---|
| `#0E482C` | brand green | `--color-forest` |
| `#16211B` | text and hairline colour (often with opacity, e.g. `/12`, `/20`) | none |
| `#334439`, `#46574D`, `#4A5B51` | secondary text greys-greens | none |
| `#121815`, `#111814` | headings / body text | `--color-charcoal` (`#121815`) |
| `#BA9B60` | gold dots and accents | none (close to `--color-brass`) |
| `#B89758`, `#D4B982` | gold | `--color-brass`, `--color-brass-light` |
| `#07130E` | darkest green ground | none |
| `#FBFBF8`, `#F3F3EC`, `#FAF9F5` | light grounds | `--color-paper`, `--color-paper-subtle` |

Warm-palette utilities are used sparingly (`bg-beige-soft` ×24, `border-taupe` ×22, `bg-taupe` ×1).

**Consequence:** a palette change is not a token change today; it needs a search-and-replace across components. Moving the arbitrary values onto tokens is an open clean-up item (not scheduled).

---

## 2. Typography

### 2.1 Faces

Loaded from Google Fonts in `apps/web/index.html` (allowed by the site CSP: `style-src … https://fonts.googleapis.com`, `font-src … https://fonts.gstatic.com`).

| Face | Weights loaded | Where it is applied |
|---|---|---|
| **Plus Jakarta Sans** | 300–800 | `body`, `h1–h3`, `.font-editorial` (letter-spacing −0.025em on headings) |
| **JetBrains Mono** | 400–600 | `.font-tech`: labels, eyebrows, section headings on the home page, figures |
| Cinzel | 500–800 | only via `.font-brand-serif`, which **no component uses** |
| Cormorant Garamond | 400–700, italics | only as the second fallback of `.font-brand-serif`; **unused** |

Tailwind's default stacks are also used directly and do **not** resolve to the brand faces in English:

- `font-serif` (≈74 uses, e.g. every inner-page `<h1>` in `PageHeader.tsx`) → Tailwind's default serif stack (`ui-serif, Georgia, …`). For `zh` and `ar` the stack is redefined in `index.css` (`--font-serif`).
- `font-mono` (≈173 uses) → Tailwind's default monospace stack (`ui-monospace, SFMono-Regular, …`), not JetBrains Mono, except in `zh`/`ar`, where `--font-mono` is redefined.

The TTF files in `apps/web/src/assets/fonts/` (Bodoni Moda, Cinzel, Montserrat, Playfair Display) are **not referenced** by any code.

### 2.2 Script fallbacks

The brand faces have no Cyrillic, Chinese or Arabic glyphs. Each such language loads extra Google Fonts only on its own pages (`fallbackFonts` in `i18n/config.ts`, `<link id="i18n-fonts-…">` written by the prerender):

| Language | Extra faces | Stack (in `index.css`, scoped by `html:lang()`) |
|---|---|---|
| `ru` | Manrope | Plus Jakarta Sans → Manrope → system |
| `zh` | Noto Sans SC, Noto Serif SC | Plus Jakarta Sans → Noto Sans SC → PingFang SC → Microsoft YaHei |
| `ar` | IBM Plex Sans Arabic, Noto Naskh Arabic | Plus Jakarta Sans → IBM Plex Sans Arabic → Noto Sans Arabic → Tahoma |
| `tr`, `es` | none | Latin brand faces |

Language-specific rules in `index.css`:

- Arabic: `letter-spacing: 0 !important` on everything (connected script); headings `line-height: 1.3`; no synthetic italics (also for Chinese).
- Chinese: `h1`, `h2` `line-height: 1.25`.
- RU / TR / ES: `hyphens: auto`; `overflow-wrap: anywhere` on headings, labels and buttons, so long words never overflow narrow cards.
- All languages: `text-wrap: balance` on `h1–h4`, `text-wrap: pretty` on `p, li, blockquote`.

### 2.3 Scale (observed)

There is no named type scale; sizes are Tailwind steps plus arbitrary pixel values.

| Element | Classes (example file) |
|---|---|
| Home hero H1 | `text-3xl sm:text-5xl lg:text-[46px] xl:text-[52px] font-extrabold leading-[1.06] tracking-tight`, uppercase content (`Hero.tsx`) |
| Inner page H1 | `font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.08] tracking-tight` (`PageHeader.tsx`) |
| Home section H2 | `font-tech uppercase font-extrabold text-xl sm:text-2xl (lg:text-[26px])` (`KeyDirections.tsx`, `EpcmStages.tsx`) |
| Stat figure | `font-tech text-2xl sm:text-[28px] font-extrabold tabular-nums`, brand green (`MetricRibbon.tsx`) |
| Labels / eyebrows / buttons | `text-[10px]`–`text-xs`, `font-bold`, `uppercase`, `tracking-wider` |

Most frequent sizes: `text-xs` (≈240), `text-[11px]` (≈63), `text-sm` (≈50), `text-[10px]` (≈46), `text-3xl`, `text-2xl`.

Headings are largely **uppercase**, and the mono face is used for headings as well as values. Design V1.0 asks for sentence case and mono only for measured values; that typography pass is open ([`design-v1-implementation.md`](design-v1-implementation.md) §4, item 3).

---

## 3. Layout, spacing and grid

| Rule | Implementation |
|---|---|
| Content width | `max-w-[1400px] mx-auto` (34 uses); some bands use `max-w-7xl` (1280 px) |
| Side gutters | Mostly `px-6 lg:px-12`; some bands use `px-4 sm:px-6 lg:px-8` |
| Section rhythm | `py-16`, `py-20`, `py-24` on sections |
| Grid | Tailwind grid; `grid-cols-12` for editorial splits, `grid-cols-2/3/4` for card grids, `grid-cols-1` on phones |
| Hairlines | 1 px borders in `#16211B` at low opacity, or `taupe` |
| Overflow | `body { overflow-x: hidden }` |
| RTL | Logical utilities (`ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start`); directional Lucide icons mirrored under `[dir="rtl"]`; hover nudges reversed |

Spacing uses the default Tailwind spacing scale; no custom spacing tokens.

## 4. Breakpoints

Tailwind 4 defaults; none are overridden.

| Prefix | Min width | Uses in components/pages |
|---|---|---|
| `sm` | 640 px | ≈213 |
| `md` | 768 px | ≈34 |
| `lg` | 1024 px | ≈219 |
| `xl` | 1280 px | ≈19 |
| `2xl` | 1536 px | 3 |

`motion.css` adds one breakpoint of its own: `max-width: 767px` shortens motion durations and distances. Hover effects are gated by `@media (hover: hover)`.

## 5. Radius and shadow

| Rule | What the code does |
|---|---|
| Buttons, cards, inputs, images | Square. Buttons often state `rounded-none` explicitly. No `rounded-*` on cards |
| Circles | `rounded-full` only for small dots and markers (status/accent dots, EPCM step nodes, rail nodes, video play buttons) |
| Exceptions | `rounded-sm` on the video-card icon box (`VideoBlock.tsx`); `rounded` on the video progress bar (`VideoModal.tsx`, unused legacy) |
| Shadows | Buttons: `shadow-xs` / `shadow-2xs`. Larger shadows on overlays and floating elements: dialogs and detail panels (`shadow-2xl`: inquiry dialog, technology/EPCM/patent dialogs), mobile menu (`shadow-lg`), video play buttons, the CTA form panel and the dark feature boxes on `/epcm` and `/company/global-presence` (`shadow-xl`); the mobile hero image (`shadow-sm`). Hover shadows were removed from the home technology and patent cards in design pass 1; card hover shadows remain on `/products` (`hover:shadow-md`) and `/projects` (`hover:shadow-lg`), an open item in `design-v1-implementation.md` §4 |
| Blurred circles | Decorative blurred circles remain in `CtaSection.tsx` (open item in `design-v1-implementation.md` §4) |

## 6. Motion

See [`motion-system.md`](motion-system.md). In short: one easing (`--ease-precise: cubic-bezier(0.16, 1, 0.3, 1)`), reveal primitives driven by `data-reveal` and one IntersectionObserver, View Transitions for page changes, transform / opacity / clip-path only, nothing hidden without the `motion-ready` class, full `prefers-reduced-motion` support. Interaction classes: `.s-card`, `.s-btn`, `.s-link`, `.image-zoom-container`, `.border-draw-on-hover`.

The `motion` npm package is listed in `apps/web/package.json` but is not imported by the site.

## 7. Imagery

| Rule | Implementation |
|---|---|
| Source | Every content image is a media reference (`{ mediaId }`) resolved by `src/content/media.ts`; components never hardcode paths. The logo comes from `settings.logo` / `settings.logoReversed` |
| Logo | Client-supplied raster, 1280 × 440 (`/images/soltex-global-logo*.png`: on white, transparent, reversed). Rendered as `<img>`, never redrawn |
| Responsive copies | `srcSet` + `sizes` from `responsive()` when the media record has WebP variants (Phase J-2, [`admin-media.md`](admin-media.md) §9). Legacy files without variants render a plain `src` |
| Loading | Below-the-fold images `loading="lazy"` (16 uses); the hero image is not lazy |
| Framing | `object-cover` with explicit focal positions where needed (`object-[72%_center]` in the hero) |
| Overlays | Dark gradients (`bg-gradient-to-t`) for text on photos; the hero photo is feathered into the page ground (`.hero-feather`, mirrored in RTL) |
| Hover | Image zoom 1.035 inside `.image-zoom-container` |
| Video | Two MP4 files in `/public/videos`, served from the same origin (`media-src 'self'`) |
| Content limits | Technology cards still use food photography; design V1.0 asks for plant/process photography (open, needs client material) |

`apps/web/src/assets/images/` duplicates files that are served from `public/images/`; nothing imports the `src/assets` copies.

## 8. Accessibility rules in the styling

- `prefers-reduced-motion`: global durations shortened to 0.01 ms; no reveal states (see motion system).
- Phone numbers, e-mails and codes stay LTR inside Arabic text (`direction: ltr; unicode-bidi: isolate`).
- Selection colour: forest background, white text.
- Scrollbar: 6 px, thumb `#C4C4B5`, hover `#0E482C` (WebKit only).

---

## 9. Admin UI styling (`apps/admin`, separate)

The admin has its own Tailwind 4 entry (`apps/admin/src/styles.css`) and shares **no** CSS with the site. Russian interface, light theme only (`color-scheme: light`).

| Token | Value |
|---|---|
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| `canvas` / `surface` / `subtle` | `#f6f6f3` / `#ffffff` / `#f1f1ec` |
| `line` / `line-strong` | `#e2e2dc` / `#c9c9c1` |
| `ink` / `ink-muted` / `ink-faint` | `#1b1f1d` / `#545b57` / `#646a66` |
| `accent` / `accent-hover` / `accent-soft` | `#0e482c` / `#0a3620` / `#e6efe9` (the site's brand green is the only accent) |
| `ok` / `ok-soft` | `#1f7a43` / `#e7f4ec` |
| `warn` / `warn-soft` | `#8a5a00` / `#fbf1dc` |
| `danger` / `danger-hover` / `danger-soft` | `#b42318` / `#912018` / `#fdecea` |
| `info` / `info-soft` | `#1d4f91` / `#e8f0fb` |

Rules: system fonts only (no external font requests; admin CSP `font-src 'self'`); body `text-sm`; focus ring 2 px accent with 2 px offset; statuses are dot + text, never colour alone (`components/ui/Status.tsx`); dense tables with thin borders. Primitives come from Radix UI (dialogs, menus, toasts), which is why the admin CSP allows `style-src 'unsafe-inline'` (decision D-5). Details: [`admin-ui.md`](admin-ui.md).

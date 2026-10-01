# Phase 1 — Regression baseline (before the CMS-readiness refactor)

Recorded **2026-10-01** from a clean checkout of `origin/main` at **c685d32** ("Refine Soltex motion and visual system"; video implementation 4a20d7a). Nothing in this file is updated after the refactor. Phase 1 results are compared against these numbers.

## Build

| Item | Baseline |
|---|---|
| Commands | `vite build && tsx scripts/prerender.ts` |
| TypeScript (`tsc --noEmit`) | pass |
| Main JS `assets/index-*.js` | 513.26 kB (141.46 kB gzip) |
| CSS `assets/index-*.css` | 87.82 kB (15.47 kB gzip) |
| Language chunks (legacy English-keyed dictionaries) | ru 202.28 kB · ar 174.83 kB · es 148.25 kB · tr 140.72 kB · zh 122.85 kB |
| HTML files | 174 (29 routes × 6 languages). Each has a **head only**: title, description, canonical, hreflang and OG tags are present, but `<div id="root"></div>` is empty (0 `<h1>` in the source HTML) |
| Sitemap | `dist/sitemap.xml`, 174 URLs with hreflang alternates and x-default = English |
| Unknown URL | Rendered the home page with **HTTP 200** (Netlify `/* → /index.html 200`) and noindex set client-side, i.e. a soft 404 |

## Routes (29 per language; EN without prefix, `/ru` `/zh` `/tr` `/ar` `/es`)

- Static pages:
  - `/`
  - `/company`
  - `/company/global-presence`
  - `/technologies`
  - `/technologies/patents`
  - `/epcm`
  - `/products`
  - `/projects`
  - `/contact`
- Technologies (6): `pectin`, `soy-protein`, `inulin`, `pomegranate`, `dietary-fibers`, `concentrated-bases`.
- Products (6): `pectin`, `soy-protein-isolate`, `inulin-fos`, `dietary-fibers`, `concentrated-bases`, `bioactive-compounds`.
- Projects (8): `solbar-israel`, `solbar-ningbo`, `solbar-nebraska`, `siberian-wellness`, `agritech-kazakhstan`, `aznar-pomegranate`, `cargill-brazil`, `yantai-dsm-andre-pectin`.

## Media references

- **Images:** 24 distinct files under `/public/images` (including `/images/projects/*`). They are listed in `src/content/seed/media.json` with their measured dimensions.
- **Videos:** `/videos/soltex-technologies.mp4` and `/videos/soltex-epcm.mp4`. Both use native `<video>` with a hover preview and a lightbox, and both are stored in git.

## Captured behaviour (Playwright / Chromium, reduced motion, served as static files)

| Capture | Scope |
|---|---|
| Page data | 29 routes × 6 languages × widths 1440 and 390 (348 page loads). Captures title, description, robots, canonical, hreflang, OG/Twitter tags, `lang`, `dir`, `<h1>` count, and the normalized `innerText` of header, `<main>` and footer. Also captures `src`/`alt`/`href`/`aria-label`/`title`/`placeholder`/`poster` of every image, link, button and form field |
| Screenshots | 29 routes × 6 languages × widths 390, 768, 1280 and 1440 (696 full-page PNGs) |
| Interactions | Per language: the 6 home SPECS dialogs and their inquiry hand-off; the 4 home patent dialogs; the header inquiry dialog including submit; the footer Privacy button; the EPCM stage inquiry buttons; the contact form submit |
| Runtime errors | None across all captures |

The harness lives in `scripts/qa/` (see `scripts/qa/README.md`). The raw baseline data, about 300 MB of screenshots, is kept outside the repository.

## Known baseline facts kept unchanged by Phase 1

- Forms simulate submission and store or send nothing. This is now isolated behind `LeadSubmissionService`.
- Privacy / Terms open the inquiry form, because no legal content exists.
- Facts flagged in `docs/copy-audit.md` remain unverified and unchanged.

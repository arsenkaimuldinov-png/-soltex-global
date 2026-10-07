# Design Direction V1.0: implementation status (public site, `apps/web`)

**Reference:** Design Direction V1.0 (`docs/design-system.md` in the Project) with the logo amendments V1.1 (`docs/brand-assets.md` §9, `docs/decisions.md` D-006).
**Scope of this file:** what the current React/Vite site (`apps/web`) implements of V1.0, what changed in each pass, and what is still open.

---

## 1. Audit (2026-10-02, before pass 1)

### Already in line with V1.0

- Dark natural green as primary on warm neutral grounds; gold as accent.
- Square buttons; no rounded cards.
- Stat band under the hero; patents as first-class cards (status, number, jurisdiction).
- Horizontal EPC/EPCM sequence on the homepage and a scroll-drawn EPCM rail on `/epcm`.
- Restrained motion: one reveal system, no count-up on figures, reduced-motion support.
- Real facility footage in the two videos.
- 6 languages including RTL Arabic; prerendered pages, real 404s.

### Contradicting V1.0 (found on the homepage)

| # | Element | V1.0 rule |
|---|---|---|
| 1 | Adjective tag row "ENGINEERING · TECHNOLOGY · INNOVATION · RELIABILITY" in the hero | §2 rejected |
| 2 | Two-tone hero headline (green line + black lines) | §2 rejected |
| 3 | Pictograms in the stat band (laurel, globe, cog, factory, shield) | §2 rejected (icons restating their label) |
| 4 | Botanical icons on technology cards (leaf, wheat, flower, sprout) | §3: the leaf lives only in the logo |
| 5 | Circled pictograms on the 8 EPCM steps | §2 rejected |
| 6 | Botanical illustrations (apple, orange, soy pod, tuber) on patent cards | §2 rejected |
| 7 | Centred band headings with a centred gold underline | §2 rejected |
| 8 | Hover shadows on cards | §2 rejected (no shadows) |
| 9 | Food photography on technology cards (apples, oranges, soybeans, tubers) | §2 rejected. **Needs real plant or process photography: not replaceable in code** |
| 10 | Six equal technology tiles | §2 rejected. Needs a content decision on which technologies lead (pectin and soy protein carry patents and built plants) |
| 11 | All headings uppercase, set in the mono face | V1.0 typography: headlines never all-caps, mono only for measured values. Site-wide change across 6 languages: separate pass |
| 12 | Footer background: close-up leaf photograph | V1.0 §1 kept "botanical imagery held back to near-texture", but the current principle says the leaf must not become a decorative pattern. **Decision needed** |

---

## 2. Pass 1: homepage (2026-10-02)

| Fixed | Change | File |
|---|---|---|
| 1 | Hero tag row no longer rendered. The content slot `home.heroTags` stays in the seed (not deleted) and is unused | `components/Hero.tsx` |
| 2 | Hero headline in one colour (brand green) | `components/Hero.tsx` |
| 3 | Stat band without pictograms: figure (mono, brand green, tabular) over label, rule-separated. Mobile: 2 columns, the closing statement spans both | `components/MetricRibbon.tsx` |
| 4 | Technology cards: index number (`01`–`06`, existing content) instead of botanical icons; no hover shadow | `components/KeyDirections.tsx` |
| 5 | EPCM strip: the eight stages as thin **circle nodes carrying the stage number**, joined by hairlines drawn in reading direction (RTL-aware). The circle is the system's curve/motion element | `components/EpcmStages.tsx` |
| 6 | Patent cards as records: status → title → number / jurisdiction, start-aligned, no illustration, no hover shadow | `components/IntellectualProperty.tsx` |
| 7 | Technology and video headings start-aligned; the gold rule draws from the reading start | `components/KeyDirections.tsx`, `components/VideoBlock.tsx` |

**Unchanged:**
- all texts, figures, translations, URLs, SEO, routes;
- dialogs (SPECS, patent, EPCM stage) and inquiry topics;
- videos, images, motion system, RTL.

No content value was changed.

---

## 3. Figures shown on the site that need confirmation (not changed)

Registered in `docs/CONTENT-TRUTH.md` / `docs/copy-audit.md`. Displayed as before, **not** resolved by inference.

| Where | Shown | Conflict |
|---|---|---|
| Stat band | **300+ million USD** projects delivered | C-5 / V3: not stated anywhere on the original site; V1.0 says do not publish without written confirmation |
| Stat band | **10+** countries | V3: only 7 countries named anywhere on the site |
| Stat band / About | **25+** years vs **30+** years vs "founded 1999" | V1 |
| Stat band / About | **20+** vs **18+** years of technology in operation | V2 |
| Patent cards | BG **66235** B1, BG **63596** B1, BG 114363 A1, BG 114364 A1 | C-4 / V7: Design Direction V1.0 §2b lists BG **69235** B1 and BG **63996** B1 (different digits); `/technologies/patents` shows RU 2709384 C1 and application 113754 instead |
| Footer | © 2024 | V17: outdated year |

---

## 4. Open items (next passes)

1. **Photography** for the technology cards (#9): real process or plant images per technology.
2. **Technology hierarchy** (#10): which technologies lead the homepage.
3. **Typography pass** (#11): sentence-case headings, mono only for values. Touches every page and all six languages.
4. **Footer ground** (#12).
5. **Inner pages:**
   - `PageHeader` (gold dot);
   - `CtaSection` (decorative blurred circle, coloured dots);
   - project detail (circled numerals);
   - card shadows on index pages.
6. **Logo rule conflict:** the current brief restates the V1.0 rules ("leaf only in the logo", "circle as the curve element"). The V1.1 amendment (D-006, accepted 2026-09-14) found the real logo has neither a leaf nor a circle and set "radius 0, no exceptions". Pass 1 follows the current brief: circles are used only as nodes and markers, never as icon containers. **Which rule set is current needs confirmation.**

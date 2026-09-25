# Multilingual architecture

- **Languages:** EN (master, unprefixed URLs), RU `/ru`, ZH-Hans `/zh`, TR `/tr`, AR `/ar` (RTL), ES `/es`. Slugs are identical across languages.
- **Source of truth:** English strings stay in components/data files. Other languages are dictionaries keyed by the exact English string: `src/i18n/locales/{ru,zh,tr,ar,es}.json` (1236 entries each).
- **Runtime:** `I18nProvider` exposes `t()` (plain), `tr()` (rich text with node placeholders), `lp()` (localised path), `switchLocale()`. English always returns the input unchanged.
- **Switcher:** Navbar; labels EN · RU · 中文 · TR · العربية · ES. Keeps the same page, query and hash. Choice stored in `localStorage["soltex.locale"]`; only the bare `/` redirects to the stored language.
- **RTL:** `<html dir="rtl">` for Arabic; logical Tailwind utilities (`ms/me/ps/pe/start/end`); arrow icons mirrored; phone/e-mail forced LTR.
- **Fonts:** brand fonts lack Cyrillic/CJK/Arabic glyphs, so per-locale fallbacks load only for that locale (Manrope, Noto Sans/Serif SC, IBM Plex Sans Arabic / Noto Naskh Arabic).
- **SEO:** `SeoHead` (runtime) + `scripts/prerender.ts` (build) → 174 static HTML shells (29 routes × 6) with `lang`, `dir`, title, description, canonical, hreflang (incl. `x-default` = EN), og:locale; `dist/sitemap.xml` with hreflang. Origin from `VITE_SITE_URL` (default `https://soltexglobal.co`).
- **Terminology:** `docs/i18n-terminology.md`.
- **Adding a language:** add to `LOCALES` in `src/i18n/config.ts`, add a loader in `dictionaries.ts`, add `locales/<code>.json`.

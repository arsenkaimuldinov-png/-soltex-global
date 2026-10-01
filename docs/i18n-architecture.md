# Multilingual architecture (Phase 1)

- **Languages:** EN (source language, unprefixed URLs), RU `/ru`, ZH-Hans `/zh`, TR `/tr`, AR `/ar` (RTL), ES `/es`. Slugs are identical across languages. There are no localized slugs and no IP-based redirects.
- **Two kinds of text:**
  - **UI strings** (navigation, buttons, labels, form texts, accessibility labels, system messages) live in `src/i18n/ui/<locale>.json` with **stable semantic keys** (`nav.projects`, `common.startYourProject`, `notFound.title`). `en.json` defines the `UiKey` type, so `t('unknown.key')` fails type checking. The content build fails if any language misses a key or changes `{placeholders}`.
  - **Content** (pages, projects, technologies, products, EPCM, patents, videos, settings, SEO) lives in `src/content/seed/*.json`. Translatable fields are `{ en, ru, zh, tr, ar, es }`; IDs, slugs, numbers and codes are not translated. Content never goes through `t()`. Components read it already in the visitor's language via `useContent()` / `usePage()`.
- **Translation status:** each content record has `translationStatus.<locale>` with values `missing`, `in_progress` or `approved`, plus the approved source hash. A language is published only when `approved`. Otherwise the whole record falls back to English (canonical → English URL, excluded from that language's hreflang and sitemap). Changing English after approval is reported as an outdated translation.
- **Runtime:** `I18nProvider` exposes:
  - `t(key, params)` and `tr(key, nodes)` (rich text) for UI strings;
  - `content` for the current language;
  - `lp()` (localized path) and `switchLocale()`.

  English UI strings and the English content snapshot are bundled with the app. Other languages are code-split and loaded before the first render and before switching.
- **Switcher:** Navbar; labels EN · RU · 中文 · TR · العربية · ES. Keeps the same page, query and hash. The choice is stored in `localStorage["soltex.locale"]`; only the bare `/` redirects to the stored language.
- **RTL:** `<html dir="rtl">` for Arabic, set statically in the prerendered HTML. Logical Tailwind utilities; arrow icons mirrored; phone numbers and e-mail addresses forced LTR.
- **Fonts:** the brand fonts lack Cyrillic, CJK and Arabic glyphs, so per-locale fallback fonts load only for that locale.
- **SEO:** `scripts/prerender.ts` renders **full HTML** for 29 routes × 6 languages. Each page gets `lang`, `dir`, title, description, canonical, hreflang (including `x-default` = EN) and OG tags, plus 404 pages per language and `sitemap.xml`. `SeoHead` keeps the tags in sync during client-side navigation. Origin from `VITE_SITE_URL` (default `https://soltexglobal.co`).
- **Migration:** the legacy English-keyed dictionaries (`src/i18n/locales/*.json`) were converted by `scripts/content/migration/migrate-legacy.ts`. Every value is exactly what the old lookup returned. They are no longer loaded and are kept until the dedicated legacy-cleanup task (with the old loader `src/i18n/dictionaries.ts`, excluded from type checking).
- **Terminology:** `docs/i18n-terminology.md`.
- **Adding a language:**
  1. Add it to `LOCALES` in `src/i18n/config.ts`.
  2. Add a loader in `src/i18n/bundles.ts`.
  3. Add `src/i18n/ui/<code>.json`.
  4. Add the language to every `Localized` value. The content build reports anything missing.

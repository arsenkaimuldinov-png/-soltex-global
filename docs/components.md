# Component inventory

Status: current as of Phase M-1 (commit 959f733)

Two front-ends, no shared components: the public site (`apps/web`, React 19 + Vite + Tailwind 4, prerendered) and the admin (`apps/admin`, React 19 + Vite + Tailwind 4 + Radix, Russian UI). Shared **logic** (SEO rules, permissions, locales, page registry, validation) lives in `packages/core`; shared **UI** does not exist by design.

---

## 1. Reuse rules (public site)

1. **No hardcoded content.** Components read content only through `useContent()` / `usePage(key)` (`src/content/useContent.ts`) and UI strings only through `t()` / `tr()` (`useI18n()`). Content comes from the per-language snapshot generated from the content source: the seed (`src/content/seed/*.json`) or the admin database export (`CONTENT_SOURCE=file`, see [`admin-database.md`](admin-database.md) §5).
2. **Enforced by the build.** `scripts/content/build-snapshots.ts` (architecture guard) fails when code in `components/`, `pages/`, `i18n/`, `motion/` or `services/` imports `src/data/*`, the legacy `i18n/locales/*` dictionaries or `content/seed/*` directly. Files excluded in `tsconfig.json` are skipped (legacy, see §2.6).
3. **Media by reference.** Images come from media records (`{ mediaId }` → `src`, `width`, variants); `responsive(asset, sizes)` adds `srcSet`/`sizes`. No component builds an image path itself.
4. **Routes are code-owned.** URL patterns live in `src/content/routes.ts` (mirrored in `@soltex/core/seo` `PAGE_ROUTES`); content only supplies slugs and publication state. Internal links use `src/i18n/Link.tsx` with locale-less paths.
5. **One implementation per behaviour.** Dialogs use `useDialog` (Escape, scroll lock, focus return) and `usePresence` (exit transition); reveals use `ScrollReveal` / `data-reveal`; lead forms use `LeadFormGuard` and the lead service (`src/services/leads`).
6. **No page builder.** Pages are fixed layouts with named text slots, lists and images (decision P1-07); editors change values, not structure.

---

## 2. Public site (`apps/web/src`)

### 2.1 Shell and layout (`components/`)

| Component | Role |
|---|---|
| `Navbar.tsx` | Header: logo (`settings.logo`), main navigation with sliding indicator, header CTA, language selector, mobile menu drawer, route hairline |
| `Footer.tsx` | Footer: reversed logo, five link groups (technologies, EPCM, products, company, contact), inquiry links with topics, legal links once legal pages are published; background image from `settings.footerBackground` |
| `PageHeader.tsx` | Presentation-only header of every inner page: breadcrumbs, badge, masked H1, subtitle, description, action, meta cells |
| `PageTransition.tsx` | Page wrapper (`data-page`), View Transition / CSS entrance |
| `ScrollToTop.tsx` | Scrolls to top on page change; keeps position on language switch |
| `ScrollReveal.tsx` | `<ScrollReveal>` wrapper rendering `data-reveal` for the motion system |
| `SoltexLogo.tsx` | Logo `<img>` with size variants; used only by the legacy `AboutModal` (Navbar and Footer render the logo from settings directly) |

### 2.2 Home page sections (`components/`, composed by `pages/HomePage.tsx`)

| Component | Role |
|---|---|
| `Hero.tsx` | Hero: eyebrow, three-line headline, description, two CTAs, USP, hero image (choreographed entrance) |
| `MetricRibbon.tsx` | Stat band under the hero: figures + labels from `settings.metrics`, no icons, no count-up |
| `KeyDirections.tsx` | Technology cards (index number, photo) with a SPECS dialog per technology |
| `EpcmStages.tsx` | Eight EPCM stages as numbered nodes joined by hairlines; stage dialog |
| `VideoBlock.tsx` | Two video cards (hover preview on desktop) + "All projects" card; opens the video player |
| `IntellectualProperty.tsx` | Patent cards as records (status, title, number, jurisdiction) with a patent dialog |

### 2.3 Shared sections and process visuals (`components/`)

| Component | Role |
|---|---|
| `CtaSection.tsx` | Closing CTA band with the quick lead form (name + phone); used on all inner pages except Contact |
| `EpcmProcessRail.tsx` | Scroll-linked rail for the stage list on `/epcm` |

### 2.4 Forms and dialogs (`components/`)

| Component | Role |
|---|---|
| `ProjectInquiryModal.tsx` | Global inquiry dialog (name + phone, preselected topic), mounted once in `App.tsx` |
| `LeadFormGuard.tsx` | Shared lead-form plumbing: honeypot field, fill-time signal, send through the lead service, error message |

The full contact form (name, phone, e-mail, company, description) is part of `pages/ContactPage.tsx`.

### 2.5 Pages (`pages/`)

| Page | Route |
|---|---|
| `HomePage.tsx` | `/` |
| `AboutPage.tsx` | `/company` |
| `GlobalPresencePage.tsx` | `/company/global-presence` |
| `TechnologiesPage.tsx` | `/technologies` |
| `TechnologyDetailPage.tsx` | `/technologies/:slug` |
| `PatentsPage.tsx` | `/technologies/patents` |
| `EpcmPage.tsx` | `/epcm` |
| `ProductsPage.tsx` | `/products` |
| `ProductDetailPage.tsx` | `/products/:slug` |
| `ProjectsPage.tsx` | `/projects` |
| `ProjectDetailPage.tsx` | `/projects/:slug` |
| `ContactPage.tsx` | `/contact` (form + office directory) |
| `LegalPage.tsx` | `/privacy`, `/terms`: routed only when the page record is published (currently drafts) |
| `NotFoundPage.tsx` | any unknown URL; prerendered as `404.html` per language |

Every route exists in six languages: English unprefixed, others under `/ru`, `/zh`, `/tr`, `/ar`, `/es` (`App.tsx`).

### 2.6 Legacy components (not rendered)

Excluded from type checking in `apps/web/tsconfig.json` and kept for a later clean-up (decision P1-17). They read the legacy `src/data/*.ts` and must not be reused:

`AboutModal`, `ContactModal`, `FeaturedProject`, `FinalCta`, `IndustriesModal`, `InsightsModal`, `MissionDark`, `SectorsGrid`, `VideoModal`, `WhySoltex` (all in `components/`), plus `src/i18n/dictionaries.ts`, `src/i18n/locales/*.json`, `src/data/*.ts`, `src/types/index.ts`.

### 2.7 Non-visual modules

| Folder / file | Role |
|---|---|
| `content/getters.ts`, `useContent.ts` | `ContentApi` and the `useContent()` / `usePage()` hooks: the only content API of components |
| `content/types.ts`, `normalize.ts`, `locale.ts` | Stored vs resolved content shapes; multilingual store → one-language snapshot (fallback, publication filter) |
| `content/media.ts` | Media references → URLs; `buildSrcSet()`, `responsive()` |
| `content/routes.ts` | Route patterns, `getPublicPaths()`, `resolveRoute()` |
| `content/source.ts`, `sources/seed.ts`, `sources/file.ts` | `ContentSource` interface: seed JSON or a DB export file |
| `i18n/I18nProvider.tsx` | Locale, `t()`/`tr()`, content of the current language, `lp()`, `switchLocale()` |
| `i18n/config.ts`, `paths.ts`, `bundles.ts`, `translate.ts` | Locale list, URL prefixes, code-split language bundles, UI-string lookup |
| `i18n/Link.tsx` | Locale-aware link; page changes inside a View Transition |
| `i18n/SeoHead.tsx`, `seo.ts` | Head tags on client navigation; per-route SEO metadata (see [`seo.md`](seo.md)) |
| `motion/prefs.ts`, `useRevealSystem.ts`, `usePresence.ts` | Motion classes, the single reveal observer, exit transitions |
| `hooks/useDialog.ts` | Shared dialog behaviour |
| `services/leads/*` | Lead service: demo (`simulated.ts`) or HTTP (`http.ts`) chosen by build flag; topics; UTM attribution (off by default) |
| `entry-server.tsx`, `main.tsx`, `App.tsx` | Prerender entry (StaticRouter), browser entry (hydrate), routes and layout |

Build scripts: `scripts/content/build-snapshots.ts` (validate content, run the SEO checker, write snapshots), `scripts/prerender.ts` (HTML per route × language, 404 pages, sitemap), `scripts/validate-site.ts` (output checks), `scripts/qa/*` (visual regression).

---

## 3. Admin (`apps/admin/src`)

### 3.1 Application shell (`app/`)

| File | Role |
|---|---|
| `App.tsx` | Providers (Query, session, toasts) and routes; screens lazy-loaded |
| `app/Shell.tsx` | Authenticated layout: sidebar (drawer on narrow screens), top bar with ⌘K, user menu |
| `app/nav.ts` | One navigation model for the sidebar, ⌘K and route guards (sections and permissions) |
| `app/CommandPalette.tsx` | ⌘K palette: sections, harmless actions, people, and (from two characters) API search of content, media and leads; never publishes or rolls back |
| `app/search.ts` | ⌘K matching (pure, unit-tested) |
| `app/guards.tsx` | Route guards by session step and permission (the API authorises again) |
| `app/ErrorPages.tsx` | 403 / 404 screens |

### 3.2 Shared UI (`components/ui/`)

| File | Role |
|---|---|
| `Button.tsx` | Buttons and button-styled links |
| `Field.tsx` | Labelled form field with hint and error (react-hook-form) |
| `DataTable.tsx` | Dense table on TanStack Table; client sort; `/` focuses search |
| `Dialog.tsx` | Radix dialogs and `ConfirmDialog` for destructive actions |
| `Toast.tsx` | Radix toasts; error toasts carry the request id |
| `Layout.tsx` | Page header with breadcrumbs and actions; empty states |
| `Status.tsx` | Status as dot + text |
| `Alert.tsx` | Inline alerts |
| `Advanced.tsx` | «Дополнительно»: collapsed technical details for Owner/Admin |
| `CopyButton.tsx`, `Spinner.tsx`, `cx.ts` | Copy to clipboard, loading state, class joiner |

### 3.3 Features (`features/`)

| Folder | Screens / parts |
|---|---|
| `auth/` | `LoginPage`, `MfaPage`, `SecondFactorForm`, `SetupMfaPage` (mandatory enrollment), `ChangeInitialPasswordPage` (Phase M-1), `PasswordResetPages`, `StepUpDialog`, `AuthLayout`, `routing.ts` |
| `account/` | `AccountPage` with `ProfileCard`, `PasswordCard`, `SecondFactorsCard`, `SessionsCard` |
| `security/` | `AddPasskeyForm`, `TotpSetup` (local QR), `RecoveryCodesPanel` (shown once) |
| `overview/` | `OverviewPage` («Обзор» dashboard: every number links to its filtered list), `ReleaseRef`, `model.ts` |
| `content/` | `ContentListPage`, `CollectionEditor` (six collections), `PagesListPage`, `PageEditor` (fixed pages from the page registry), `CreateDialog`, `fields.tsx` (one input per field kind), `media.tsx` (media picker with upload), `model.ts`, `form.ts`, `page-form.ts`, `page-labels.ts`, `shared.tsx`, `field-errors.ts` |
| `translations/` | `TranslationsOverviewPage`, `TranslationsListPage`, `TranslationEditorPage` (source and target side by side), `model.ts` |
| `publishing/` | `PublishingOverviewPage`, `ReleasesPage`, `ReleaseDetailPage`, `RevisionsPage`, `HistoryPage`, `HistoryPanel` (in editors), `PublishButtons`, `model.ts` |
| `seo/` | `SeoReportPage`, `SeoPanel` (snippet and checks in editors), `RedirectsPage`, `SlugDialog` («Изменить адрес»), `model.ts` |
| `media/` | `MediaLibraryPage`, `MediaDetailPage`, `upload.tsx`, `model.ts` |
| `leads/` | `LeadsListPage`, `LeadDetailPage`, `model.ts` |
| `users/` | `UsersPage`, `UserDialogs` |
| `audit/` | `AuditPage`, `describe.ts` (audit events in Russian) |
| `system/` | `SystemPage` (API, database, worker, queues, release) |

### 3.4 Libraries (`lib/`, `i18n/`)

| File | Role |
|---|---|
| `lib/api/client.ts`, `schema.gen.ts` | Typed same-origin client; types generated from `apps/api/openapi.json`; CSRF header on mutations |
| `lib/session.tsx` | Session state from `GET /auth/session`; routing by its `next` step |
| `lib/step-up.tsx` | `withStepUp()` for sensitive actions |
| `lib/unsaved.tsx` | Unsaved-changes guard |
| `lib/webauthn.ts` | Passkey browser ceremony |
| `lib/password.ts` | Initial password generator (Web Crypto) |
| `lib/errors.ts`, `format.ts`, `held-codes.tsx` | API errors in Russian, formatting, recovery codes held until shown |
| `i18n/ru.ts` | Shared Russian vocabulary (statuses, roles) |

**Admin reuse rules:** pure logic sits in `model.ts` / `form.ts` files and is unit-tested in node (`apps/admin/test/`); screens are thin. Rules that the API also enforces (permissions, slug rules, SEO checks) come from `@soltex/core`, never re-implemented. Labels are Russian; enum values and codes are not shown in the main UI.

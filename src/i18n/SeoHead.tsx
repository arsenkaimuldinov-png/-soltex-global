import { useEffect } from 'react';
import { useI18n } from './I18nProvider';
import { absoluteUrl, getAlternates, getNotFoundMeta, getRouteMeta } from './seo';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

/**
 * Keeps <title>, meta description, canonical, hreflang and OpenGraph tags in sync with
 * the current route and language during client-side navigation. The same values are
 * written statically into each prerendered HTML file at build time (scripts/prerender.ts).
 */
export function SeoHead() {
  const { locale, info, path, t, content } = useI18n();

  useEffect(() => {
    const meta = getRouteMeta(path, content) ?? getNotFoundMeta(t('notFound.title'), content);
    const canonical = absoluteUrl(path, meta.canonicalLocale === locale ? locale : meta.canonicalLocale);

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', meta.indexable ? 'index, follow' : 'noindex, follow');
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:locale', info.ogLocale);
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical });

    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    if (meta.indexable) {
      getAlternates(path, meta.alternateLocales).forEach(({ hreflang, href }) => {
        const el = document.createElement('link');
        el.rel = 'alternate';
        el.hreflang = hreflang;
        el.href = href;
        document.head.appendChild(el);
      });
    }
  }, [locale, info, path, t, content]);

  return null;
}

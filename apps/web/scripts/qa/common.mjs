// Shared helpers for the QA harness. Requires Playwright (not a project dependency):
//   npx -y playwright@1 install chromium   (or set CHROMIUM_PATH to an existing Chromium)
import { chromium } from 'playwright';

export const LANGS = ['en', 'ru', 'zh', 'tr', 'ar', 'es'];

export function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

/** English locale-less routes, read from the site's own sitemap. */
export async function routesFrom(base) {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const origin = xml.match(/<loc>(https?:\/\/[^/<]+)/)[1];
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].slice(origin.length) || '/')
    .filter((p) => !/^\/(ru|zh|tr|ar|es)(\/|$)/.test(p));
}

export const urlFor = (base, lang, route) => base + (lang === 'en' ? route : route === '/' ? `/${lang}` : `/${lang}${route}`);
export const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

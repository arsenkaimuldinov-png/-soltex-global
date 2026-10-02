// Navigation regression: language switch, client navigation, stored-language redirect,
// video lightbox and mobile menu.  node navigation.mjs <base-url> <out.json>
// Output contains no host/port, so the files of two builds can be compared byte for byte.
import fs from 'fs';
import { launch } from './common.mjs';

const [, , BASE, OUT] = process.argv;
const b = await launch();
const rel = (u) => u.replace(BASE, '');
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const report = {};

// Desktop: language switch → client navigation → detail → back → stored-locale redirect → video lightbox
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/net::|Failed to load/.test(m.text())) errs.push(m.text().slice(0, 150)); });
  const r = {};
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => [...document.querySelectorAll('header button')].find((x) => /^EN/.test(x.innerText.trim()))?.click());
  await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('header button')].find((x) => x.innerText.includes('العربية'))?.click());
  await p.waitForURL(/\/ar$/, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(600);
  r.afterSwitch = { url: rel(p.url()), dir: await p.evaluate(() => document.documentElement.dir), title: await p.title(), h1: norm(await p.evaluate(() => document.querySelector('h1')?.innerText)) };
  await p.evaluate(() => [...document.querySelectorAll('header nav a')].find((a) => a.getAttribute('href') === '/ar/projects')?.click());
  await p.waitForTimeout(800);
  r.afterNav = {
    url: rel(p.url()),
    title: await p.title(),
    canonical: await p.evaluate(() => document.querySelector('link[rel=canonical]')?.getAttribute('href')),
    hreflangs: await p.evaluate(() => document.querySelectorAll('link[hreflang]').length),
  };
  await p.evaluate(() => [...document.querySelectorAll('main a')].find((a) => /\/ar\/projects\/./.test(a.getAttribute('href') || ''))?.click());
  await p.waitForTimeout(800);
  r.detail = { url: rel(p.url()), title: await p.title() };
  await p.goBack();
  await p.waitForTimeout(600);
  r.back = { url: rel(p.url()), title: await p.title() };
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  r.storedLocaleRedirect = { url: rel(p.url()), lang: await p.evaluate(() => document.documentElement.lang), h1: norm(await p.evaluate(() => document.querySelector('h1')?.innerText)).slice(0, 60) };
  await p.evaluate(() => localStorage.removeItem('soltex.locale'));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { const c = document.querySelector('[aria-label^="Watch video"]'); c?.scrollIntoView(); c?.click(); });
  await p.waitForTimeout(600);
  r.videoLightbox = await p.evaluate(() => { const v = document.querySelector('[role="dialog"] video'); return v ? { src: v.getAttribute('src'), poster: v.getAttribute('poster'), controls: v.controls } : null; });
  r.errors = errs;
  report.desktop = r;
  await ctx.close();
}

// Mobile menu (EN + AR): opens, shows links, closes on Escape
report.mobileMenu = {};
for (const l of ['', '/ar']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE + (l || '/'), { waitUntil: 'networkidle' });
  await (await p.$('button[aria-controls]'))?.click();
  await p.waitForTimeout(400);
  const links = await p.evaluate(() => [...document.querySelectorAll('[id] a')].filter((a) => a.offsetParent).map((a) => a.innerText.trim()).filter(Boolean).slice(0, 12));
  const expandedOpen = await p.evaluate(() => document.querySelector('button[aria-controls]')?.getAttribute('aria-expanded'));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const expandedAfterEsc = await p.evaluate(() => document.querySelector('button[aria-controls]')?.getAttribute('aria-expanded'));
  report.mobileMenu[l || '/'] = { links, expandedOpen, expandedAfterEsc };
  await ctx.close();
}

// Media URLs answer 200 (videos are never moved or renamed)
report.media = {};
for (const u of ['/videos/soltex-technologies.mp4', '/videos/soltex-epcm.mp4']) {
  const res = await fetch(BASE + u, { method: 'HEAD' });
  report.media[u] = { status: res.status, type: res.headers.get('content-type'), bytes: res.headers.get('content-length') };
}

await b.close();
fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report));

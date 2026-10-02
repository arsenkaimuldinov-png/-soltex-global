// Regression test: the inquiry dialog's selected topic follows the CURRENT language.
//   node scripts/qa/inquiry-language.mjs <baseUrl> [repoRoot=.]
// For several topic sources (UI key, page copy, entity references) it selects a topic in English,
// then switches to another language (a) while the dialog is OPEN (router navigation) and
// (b) after closing it (reopened from the header), and checks the "Focus: …" line equals the
// topic resolved in the new language from src/i18n/ui + src/content/snapshot.
import fs from 'fs';
import path from 'path';
import { launch, norm } from './common.mjs';

const [BASE, ROOT = '.'] = process.argv.slice(2);
const ui = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/ui/${l}.json`), 'utf8'));
const snap = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/content/snapshot/${l}.json`), 'utf8'));
const fill = (tpl, p) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
const page = (s, k) => s.pages.find((p) => p.key === k);

// Each case: page to open (EN), how to open the dialog, expected topic text for a language.
const CASES = [
  { name: 'footer privacy (UI key)', url: '/', open: async (p) => p.click('footer button'), expect: (l) => ui(l)['footer.privacyPolicy'] },
  {
    name: 'home technology SPECS → inquire (entity ref)', url: '/',
    open: async (p) => { await p.click('#technologies button[type="button"]'); await p.waitForTimeout(450); const b = await p.$$('[role="dialog"] button'); await b[b.length - 1].click(); },
    expect: (l) => page(snap(l), 'home').lists.keyDirections[0].title,
  },
  {
    name: 'home patent card (UI key + entity ref)', url: '/',
    open: async (p) => { await p.click('#intellectual-property [role="button"]'); await p.waitForTimeout(450); const b = await p.$$('[role="dialog"] button'); await b[b.length - 1].click(); },
    expect: (l) => { const pt = snap(l).patents.find((x) => x.placements.includes('home')); return fill(ui(l)['patent.licensingTopic'], { title: pt.title, patentNo: pt.patentNo }); },
  },
  {
    name: 'company header action (page copy)', url: '/company',
    open: async (p) => p.click('main section button.s-btn'),
    expect: (l) => page(snap(l), 'company').copy.inquiryTopic,
  },
  {
    name: 'project detail header action (page copy + entity ref)', url: '/projects/solbar-israel',
    open: async (p) => p.click('main section button.s-btn'),
    expect: (l) => fill(page(snap(l), 'projectDetail').copy.headerInquiryTopic, { title: snap(l).projects.find((x) => x.slug === 'solbar-israel').title }),
  },
  {
    name: 'global presence office (UI key + office ref)', url: '/company/global-presence',
    open: async (p) => { const b = await p.$$('main button'); for (const x of b) if (/Direct Consultation/i.test(await x.innerText())) { await x.scrollIntoViewIfNeeded(); await x.click(); break; } },
    expect: (l) => fill(ui(l)['office.inquiryTopic'], { office: snap(l).settings.offices[0].title }),
  },
];

const focusOf = async (p) => {
  const text = norm(await p.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? ''));
  return text;
};
const localize = (url, l) => (l === 'en' ? url : url === '/' ? `/${l}` : `/${l}${url}`);

const b = await launch();
let failed = 0;
for (const c of CASES) {
  for (const l of ['ru', 'ar', 'zh']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(BASE + c.url, { waitUntil: 'networkidle' });
    await c.open(p);
    await p.waitForTimeout(450);
    const focusEn = fill(ui('en')['inquiry.focus'], { topic: c.expect('en') });
    const r = { open_en: (await focusOf(p)).includes(focusEn) };
    // (a) language changes while the dialog is open (client-side navigation, dialog stays mounted)
    await p.evaluate((to) => { history.pushState({}, '', to); dispatchEvent(new PopStateEvent('popstate')); }, localize(c.url, l));
    await p.waitForTimeout(700);
    const focusL = fill(ui(l)['inquiry.focus'], { topic: c.expect(l) });
    const whileOpen = await focusOf(p);
    r.switched_while_open = whileOpen.includes(focusL);
    // (b) close, reopen from the header CTA in the new language (keeps the selected topic)
    await p.keyboard.press('Escape');
    await p.waitForTimeout(450);
    await p.click('header button.s-btn');
    await p.waitForTimeout(450);
    r.reopened = (await focusOf(p)).includes(focusL);
    const ok = Object.values(r).every(Boolean);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} [en→${l}] ${JSON.stringify(r)}${ok ? '' : `\n      expected: "${focusL}"\n      got: "${whileOpen.slice(0, 200)}"`}`);
    await ctx.close();
  }
}
await b.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);

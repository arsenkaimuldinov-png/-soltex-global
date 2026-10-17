/**
 * The public site under its production Content Security Policy (Phase M-1): the published release,
 * served with the headers of deploy/nginx/soltexglobal.conf (scripts/e2e-site-server.mjs), loads every
 * page of the sitemap in English and the home page in every language without a CSP violation or a
 * script error; the video lightbox and the inquiry dialog work under the policy.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, profile } from './harness.mjs';

const SITE = process.env.E2E_SITE_ORIGIN ?? 'http://site.e2e.test:4177';
let p;
// Google Fonts may be unreachable where the tests run; a failed download is not a policy violation.
const problems = () => p.problems.filter((x) => !/Failed to load resource/.test(x));

describe('Site under its CSP (Phase M-1)', () => {
  before(async () => {
    p = await profile({ ip: '198.51.100.90' });
  });
  after(async () => {
    await p.close();
    await closeBrowser();
  });

  test('the policy is sent with every page', async () => {
    const res = await fetch(`${SITE.replace('site.e2e.test', '127.0.0.1')}/company`);
    const csp = res.headers.get('content-security-policy') ?? '';
    assert.match(csp, /script-src 'self' 'sha256-/);
  });

  test('every English page of the sitemap and every home page load without a violation', async () => {
    const xml = await (await fetch(`${SITE.replace('site.e2e.test', '127.0.0.1')}/sitemap.xml`)).text();
    const paths = [...new Set([...xml.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)?<\/loc>/g)].map((m) => m[1] || '/'))];
    const english = paths.filter((x) => !/^\/(ru|zh|tr|ar|es)(\/|$)/.test(x));
    assert.ok(english.length >= 25, `sitemap pages: ${english.length}`);
    for (const path of [...english, '/ru', '/zh', '/tr', '/ar', '/es']) {
      await p.page.goto(`${SITE}${path}`, { waitUntil: 'load' });
      await p.page.locator('h1').first().waitFor();
    }
    assert.deepEqual(problems(), []);
  });

  test('the inquiry dialog and the video lightbox work under the policy', async () => {
    await p.page.goto(`${SITE}/epcm`);
    await p.page.getByRole('button', { name: 'Inquire on this Stage' }).first().click();
    await p.page.getByRole('dialog').waitFor();
    await p.page.keyboard.press('Escape');
    await p.page.goto(`${SITE}/`);
    await p.page.getByRole('button', { name: /^Watch/ }).first().click();
    await p.page.getByRole('dialog').locator('video').waitFor();
    assert.deepEqual(problems(), []);
  });
});

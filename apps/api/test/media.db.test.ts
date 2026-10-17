/**
 * Media library (Phase J-1, docs/admin-media.md): upload (type by content, limits, EXIF/GPS
 * removed, UUID names, duplicates), previews, usages, replace (same id), delete guard,
 * permissions and audit. The type rules themselves are unit-tested in packages/core/test/media.test.ts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { desc, eq } from 'drizzle-orm';
import sharp from 'sharp';
import * as s from '../src/db/schema.ts';
import { closeTestDb, DB_ENABLED, makeApp, signedIn, type TestApp } from './helpers.ts';
import { resetToSeed } from './release-helpers.ts';
import { exportStore } from '../src/content/export.ts';
import { generateAllVariants } from '../src/media/variants.ts';

type Signed = Awaited<ReturnType<typeof signedIn>>;
type Json = Record<string, any>;

/** A 300 × 200 JPEG that a phone would produce: rotated by EXIF, with a GPS position. */
const phonePhoto = () =>
  sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 30, g: 120, b: 60 } } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '43/1 15/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '76/1 57/1 0/1' } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
const png = (w: number, h: number, g = 10) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g, b: 10 } } }).png().toBuffer();

describe('Media library (Phase J-1)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let mediaDir: string;
  let editor: Signed, cm: Signed, admin: Signed, marketer: Signed;
  let uploaded: Json;

  before(async () => {
    mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soltex-media-'));
    t = await makeApp({ MEDIA_DIR: mediaDir });
    await resetToSeed(t);
    [editor, cm, admin, marketer] = [await signedIn(t, 'editor'), await signedIn(t, 'content_manager'), await signedIn(t, 'admin'), await signedIn(t, 'marketer')];
  });
  after(async () => {
    await resetToSeed(t);
    await t.app.close();
    await closeTestDb();
    for (const f of fs.readdirSync(mediaDir, { recursive: true }) as string[]) fs.chmodSync(path.join(mediaDir, f), 0o755);
    fs.rmSync(mediaDir, { recursive: true, force: true });
  });

  test('upload: type by content, EXIF orientation applied and metadata removed, UUID path, original name kept, audit', async () => {
    const photo = await phonePhoto();
    const fixture = await sharp(photo).metadata();
    assert.ok(fixture.exif?.toString('latin1').includes('TestPhone') && fixture.orientation === 6, 'the fixture carries EXIF and a rotation');
    const res = await editor.c.upload('/api/v1/media?name=' + encodeURIComponent('Фото завода (GPS).jpg'), photo);
    assert.equal(res.statusCode, 201, res.body);
    uploaded = res.json();
    assert.equal(uploaded.kind, 'image');
    assert.equal(uploaded.source, 'upload');
    assert.equal(uploaded.fileName, 'Фото завода (GPS).jpg');
    assert.equal(uploaded.mime, 'image/jpeg');
    assert.deepEqual([uploaded.width, uploaded.height], [200, 300], 'rotated by the EXIF orientation');
    assert.match(uploaded.src, /^\/media\/originals\/\d{4}\/[0-9a-f-]{36}\.jpg$/);
    assert.match(uploaded.key, /^media-foto-zavoda-gps-[0-9a-f]{8}$|^media-gps-[0-9a-f]{8}$/);
    assert.equal(uploaded.usageCount, 0);
    assert.equal(uploaded.publicUrl, `https://soltexglobal.co${uploaded.src}`);
    const stored = path.join(mediaDir, uploaded.src.replace('/media/', ''));
    assert.equal(fs.statSync(stored).mode & 0o777, 0o444, 'stored read-only');
    const meta = await sharp(stored).metadata();
    assert.equal(meta.exif, undefined, 'no EXIF / GPS left');
    assert.equal(meta.orientation, undefined);
    assert.equal(fs.readdirSync(path.join(mediaDir, 'tmp')).length, 0, 'no temporary files left');
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'media.upload')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.deepEqual([audit!.resourceId, (audit!.summary as Json).kind], [uploaded.id, 'image']);
  });

  test('refused: the same file again, SVG / HTML / other types, a broken image, empty, too large, not a file body', async () => {
    const dup = await editor.c.upload('/api/v1/media?name=again.jpg', await phonePhoto());
    assert.equal(dup.statusCode, 409);
    assert.deepEqual([dup.json().code, dup.json().errors[0].message], ['media_duplicate', uploaded.id]);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'.padEnd(64, ' '));
    for (const [name, body] of [['x.svg', svg], ['x.jpg', Buffer.from('<!doctype html><html><script>x</script></html>')], ['x.pdf', Buffer.from('%PDF-1.7\n'.padEnd(64, '%'))], ['x.gif', Buffer.from('GIF89a'.padEnd(64, '\0'))]] as const) {
      const r = await editor.c.upload(`/api/v1/media?name=${name}`, body);
      assert.deepEqual([r.statusCode, r.json().code], [415, 'media_type_rejected'], name);
    }
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    assert.deepEqual([(await editor.c.upload('/api/v1/media?name=b.jpg', broken)).json().code], ['media_invalid']);
    assert.equal((await editor.c.upload('/api/v1/media?name=e.jpg', Buffer.alloc(0))).statusCode, 400);
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(21 * 1024 * 1024)]);
    const big = await editor.c.upload('/api/v1/media?name=big.jpg', huge);
    assert.deepEqual([big.statusCode, big.json().code], [413, 'payload_too_large']);
    const json = await editor.c.req('POST', '/api/v1/media?name=x.jpg', { file: 'x' });
    assert.equal(json.statusCode, 415);
    assert.equal(fs.readdirSync(path.join(mediaDir, 'tmp')).length, 0, 'refused uploads leave nothing behind');
    assert.equal((await t.deps.db!.select().from(s.media).where(eq(s.media.source, 'upload'))).length, 1);
  });

  test('permissions follow the matrix: marketer reads only; editor uploads but does not replace; content manager does not delete', async () => {
    assert.equal((await marketer.c.upload('/api/v1/media?name=m.png', await png(10, 10))).statusCode, 403);
    assert.equal((await marketer.c.req('GET', '/api/v1/media')).statusCode, 200);
    assert.equal((await editor.c.upload(`/api/v1/media/${uploaded.id}/replace?name=r.png`, await png(10, 10), { 'if-match': '"1"' })).statusCode, 403);
    assert.equal((await cm.c.req('DELETE', `/api/v1/media/${uploaded.id}`, undefined, { 'if-match': '"1"' })).statusCode, 403);
  });

  test('library: legacy files keep their URLs; usage counts; filters; previews of uploaded and legacy images', async () => {
    const all = (await editor.c.req('GET', '/api/v1/media')).json() as Json;
    const legacy = all.items.filter((m: Json) => m.source === 'legacy');
    assert.equal(legacy.length, JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../web/src/content/seed/media.json'), 'utf8')).length);
    assert.ok(legacy.every((m: Json) => /^\/(images|videos)\//.test(m.src)));
    assert.ok(legacy.filter((m: Json) => m.kind === 'image').every((m: Json) => m.bytes > 0), 'sizes read from the site files');
    assert.ok(legacy.some((m: Json) => m.usageCount > 0));
    assert.ok(!legacy.some((m: Json) => m.warnings.includes('hero_too_narrow')), 'the current hero image is 2117 px wide');
    const unused = (await editor.c.req('GET', '/api/v1/media?usage=unused')).json() as Json;
    assert.ok(unused.items.some((m: Json) => m.id === uploaded.id));
    assert.ok(unused.items.every((m: Json) => m.usageCount === 0));
    assert.equal((await editor.c.req('GET', '/api/v1/media?kind=video')).json().items.length, 2);
    assert.equal((await editor.c.req('GET', `/api/v1/media?q=${encodeURIComponent('Фото завода')}`)).json().items[0].id, uploaded.id);

    const prev = await editor.c.req('GET', `/api/v1/media/${uploaded.id}/preview?w=480&v=1`);
    assert.equal(prev.statusCode, 200);
    assert.equal(prev.headers['content-type'], 'image/webp');
    assert.equal(prev.headers['cache-control'], 'private, max-age=86400');
    assert.equal((await sharp(prev.rawPayload).metadata()).format, 'webp');
    const legacyImage = legacy.find((m: Json) => m.kind === 'image');
    const lp = await editor.c.req('GET', `/api/v1/media/${legacyImage.id}/preview?w=1200`);
    assert.equal(lp.statusCode, 200);
    assert.ok(((await sharp(lp.rawPayload).metadata()).width ?? 0) <= 1200);
    const video = legacy.find((m: Json) => m.kind === 'video');
    assert.equal((await editor.c.req('GET', `/api/v1/media/${video.id}/preview`)).statusCode, 404);
    assert.equal((await editor.c.req('GET', `/api/v1/media/${uploaded.id}/preview?w=333`)).statusCode, 400);
  });

  test('usages: a project using the file is listed; delete is refused; replace keeps the id and the reference', async () => {
    const projects = (await cm.c.req('GET', '/api/v1/content/projects?limit=100')).json().items as Json[];
    const p = projects.find((x) => x.slug === 'solbar-israel')!;
    const cur = await cm.c.req('GET', `/api/v1/content/projects/${p.id}`);
    const originalImage = cur.json().fields.image;
    const saved = await cm.c.req('PATCH', `/api/v1/content/projects/${p.id}`, { image: uploaded.id }, { 'if-match': String(cur.headers.etag) });
    assert.equal(saved.statusCode, 200, saved.body);

    const detail = (await cm.c.req('GET', `/api/v1/media/${uploaded.id}`)).json() as Json;
    assert.deepEqual(detail.usages.map((u: Json) => [u.type, u.id, u.field]), [['projects', p.id, 'image']]);
    assert.equal(detail.usages[0].title, 'SOLBAR ISRAEL');
    const del = await admin.c.req('DELETE', `/api/v1/media/${uploaded.id}`, undefined, { 'if-match': '"1"' });
    assert.deepEqual([del.statusCode, del.json().code], [409, 'media_in_use']);
    assert.match(del.json().detail, /SOLBAR ISRAEL/);

    // replace: a video for an image is refused, the same bytes are refused, a new image moves the pointer
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
    const wrong = await cm.c.upload(`/api/v1/media/${uploaded.id}/replace?name=v.mp4`, mp4, { 'if-match': '"1"' });
    assert.deepEqual([wrong.statusCode, wrong.json().errors[0].message], [400, 'kind_mismatch']);
    const same = await cm.c.upload(`/api/v1/media/${uploaded.id}/replace?name=same.jpg`, await phonePhoto(), { 'if-match': '"1"' });
    assert.equal(same.json().errors[0].message, 'unchanged');
    assert.equal((await cm.c.upload(`/api/v1/media/${uploaded.id}/replace?name=n.png`, await png(1800, 900), { 'if-match': '"7"' })).json().code, 'edit_conflict');
    const rep = await cm.c.upload(`/api/v1/media/${uploaded.id}/replace?name=new-plant.png`, await png(1800, 900), { 'if-match': '"1"' });
    assert.equal(rep.statusCode, 200, rep.body);
    const r = rep.json() as Json;
    assert.deepEqual([r.id, r.version, r.fileName, r.width, r.mime], [uploaded.id, 2, 'new-plant.png', 1800, 'image/png']);
    assert.notEqual(r.src, uploaded.src);
    assert.ok(fs.existsSync(path.join(mediaDir, uploaded.src.replace('/media/', ''))), 'the previous file is kept (immutable storage)');
    assert.equal((await cm.c.req('GET', `/api/v1/content/projects/${p.id}`)).json().fields.image, uploaded.id, 'the project still points to the same media id');
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'media.replace')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.equal(audit!.resourceId, uploaded.id);

    // unused again → delete works; the file stays for the garbage collection
    const back = await cm.c.req('GET', `/api/v1/content/projects/${p.id}`);
    assert.equal((await cm.c.req('PATCH', `/api/v1/content/projects/${p.id}`, { image: originalImage }, { 'if-match': String(back.headers.etag) })).statusCode, 200);
    const ok = await admin.c.req('DELETE', `/api/v1/media/${uploaded.id}`, undefined, { 'if-match': '"2"' });
    assert.equal(ok.statusCode, 204, ok.body);
    assert.equal((await admin.c.req('GET', `/api/v1/media/${uploaded.id}`)).statusCode, 404);
    assert.ok(fs.existsSync(path.join(mediaDir, r.src.replace('/media/', ''))));
  });

  test('responsive copies (J-2): WebP below the original width, in the export, renewed after a replace', async () => {
    const before = (await editor.c.req('GET', '/api/v1/media')).json().items as Json[];
    assert.ok(before.filter((m: Json) => m.kind === 'image').every((m: Json) => m.variants.state === 'pending' || m.variants.state === 'none'));
    const handled = await generateAllVariants(t.deps);
    assert.ok(handled >= 20, `handled ${handled}`);
    assert.equal(await generateAllVariants(t.deps), 0, 'nothing left');

    const after = (await editor.c.req('GET', '/api/v1/media')).json().items as Json[];
    const hero = after.find((m: Json) => m.key === 'media-soltex-hero-industrial')!;
    assert.deepEqual(hero.variants, { state: 'ready', widths: [480, 960, 1600] }, '2117 px wide: three smaller copies');
    const small = after.find((m: Json) => m.kind === 'image' && m.width && m.width <= 480);
    if (small) assert.equal(small.variants.state, 'none');
    const store = await exportStore(t.deps.db!);
    const rec = store.media.find((m) => m.id === 'media-soltex-hero-industrial')!;
    assert.deepEqual(rec.variants!.map((v) => v.width), [480, 960, 1600]);
    for (const v of rec.variants!) {
      assert.match(v.src, /^\/media\/variants\/[0-9a-f-]{36}\/[0-9a-f]{12}\/\d+\.webp$/);
      const file = path.join(mediaDir, v.src.replace('/media/', ''));
      const meta = await sharp(file).metadata();
      assert.deepEqual([meta.format, meta.width, meta.height], ['webp', v.width, v.height]);
      assert.equal(Math.round((v.width * 743) / 2117), v.height, 'proportional');
    }
    assert.ok(store.media.filter((m) => m.kind === 'video').every((m) => m.variants === undefined));

    // a new upload is pending until the worker runs; a replacement makes its copies out of date
    const up = (await editor.c.upload('/api/v1/media?name=wide.png', await png(2600, 1000, 77))).json() as Json;
    assert.equal(up.variants.state, 'pending');
    await generateAllVariants(t.deps);
    const ready = (await cm.c.req('GET', `/api/v1/media/${up.id}`)).json() as Json;
    assert.deepEqual(ready.variants, { state: 'ready', widths: [480, 960, 1600, 2400] });
    const rep = (await cm.c.upload(`/api/v1/media/${up.id}/replace?name=wide2.png`, await png(1000, 500, 78), { 'if-match': `"${ready.version}"` })).json() as Json;
    assert.equal(rep.variants.state, 'pending');
    assert.ok(!(await exportStore(t.deps.db!)).media.find((m) => m.src === rep.src)!.variants, 'out-of-date copies are not exported');
    await generateAllVariants(t.deps);
    assert.deepEqual((await cm.c.req('GET', `/api/v1/media/${up.id}`)).json().variants, { state: 'ready', widths: [480, 960] });
  });

  test('the database refuses an upload row outside the UUID layout', async () => {
    await assert.rejects(
      t.deps.db!.insert(s.media).values({ key: 'media-bad', kind: 'image', src: '/media/originals/2026/../../etc.jpg', source: 'upload', storagePath: 'originals/2026/../../etc.jpg' }),
      (e: { cause?: { constraint?: string } }) => e.cause?.constraint === 'media_upload_path'
    );
  });
});

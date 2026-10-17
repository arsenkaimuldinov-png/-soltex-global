/**
 * Media rules (Phase J): type by content, the allowlist (no SVG, no HTML, no executables), file
 * names as kept for people, and the limits.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanFileName, MEDIA_MAX_BYTES, MEDIA_UPLOAD_MAX_BYTES, sniffMediaType } from '../src/domain/index.ts';

const bytes = (...parts: Array<string | number[]>) => {
  const out: number[] = [];
  for (const p of parts) if (typeof p === 'string') for (const c of p) out.push(c.charCodeAt(0));
  else out.push(...p);
  return new Uint8Array(out);
};
const ftyp = (brand: string) => bytes([0, 0, 0, 0x20], 'ftyp', brand, [0, 0, 0, 0]);

test('type by content: JPEG, PNG, WebP, AVIF, MP4', () => {
  assert.equal(sniffMediaType(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime, 'image/jpeg');
  assert.equal(sniffMediaType(bytes([0x89], 'PNG\r\n\x1a\n'))?.mime, 'image/png');
  assert.equal(sniffMediaType(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))?.mime, 'image/webp');
  assert.equal(sniffMediaType(ftyp('avif'))?.ext, 'avif');
  assert.equal(sniffMediaType(ftyp('isom'))?.kind, 'video');
  assert.equal(sniffMediaType(ftyp('mp42'))?.mime, 'video/mp4');
});

test('everything else is refused, whatever the name says', () => {
  for (const head of [
    bytes('<svg xmlns="http://www.w3.org/2000/svg">'),
    bytes('<?xml version="1.0"?><svg>'),
    bytes('<!doctype html><script>'),
    bytes('%PDF-1.7'),
    bytes('GIF89a'),
    bytes('MZ', [0x90, 0]),
    bytes([0x7f], 'ELF'),
    bytes('PK', [3, 4]),
    ftyp('qt  '),
    ftyp('heic'),
    bytes([0xff, 0xd8]),
    new Uint8Array(),
  ])
    assert.equal(sniffMediaType(head), null, String.fromCharCode(...head.slice(0, 12)));
});

test('file names and limits', () => {
  assert.equal(cleanFileName('C:\\Users\\a\\Фото завода.jpg'), 'Фото завода.jpg');
  assert.equal(cleanFileName('../../etc/passwd'), 'passwd');
  assert.equal(cleanFileName('a\u0000b\r\n.png'), 'ab.png');
  assert.equal(cleanFileName('   '), 'file');
  assert.equal(cleanFileName('x'.repeat(300)).length, 200);
  assert.equal(MEDIA_MAX_BYTES.image, 20 * 1024 * 1024);
  assert.equal(MEDIA_UPLOAD_MAX_BYTES, MEDIA_MAX_BYTES.video);
});

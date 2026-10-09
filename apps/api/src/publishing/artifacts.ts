/**
 * Release artifacts on disk (Phase G, docs/admin-publishing.md §5; approved §4.3).
 *
 *   <root>/releases/<key>/   immutable artifact (read-only files) + release.json manifest
 *   <root>/current           symlink → releases/<key>: the only thing the web server serves
 *   <root>/build/<key>/      scratch workspace of a running build (removed afterwards)
 *   <root>/blobs/<sha256>    large files shared by every release through hard links
 *
 * Activation replaces `current` atomically: a new symlink `current.<random>` is created and
 * renamed over `current` (rename(2) is atomic on POSIX). A reader therefore always sees either the
 * old or the new complete artifact, never a mix.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BLOB_MIN_BYTES = 1 << 20;
const MANIFEST = 'release.json';

export interface ArtifactFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface ArtifactTree {
  files: ArtifactFile[];
  bytes: number;
  /** SHA-256 over "path\tsha256\n" of every file (manifest excluded), sorted by path. */
  checksum: string;
}

export const releasesPath = (root: string) => path.join(root, 'releases');
export const releaseDir = (root: string, key: string) => path.join(root, 'releases', key);
export const buildDir = (root: string, key: string) => path.join(root, 'build', key);
export const currentLink = (root: string) => path.join(root, 'current');

const KEY = /^[RP]-\d{8}-\d{6}-[0-9a-f]{6}$/;
export const isReleaseKey = (key: string) => KEY.test(key);

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Every file below `dir` with its hash, sorted (the manifest itself is not part of the artifact). */
export function readTree(dir: string): ArtifactTree {
  const files: ArtifactFile[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const rel = path.relative(dir, p).split(path.sep).join('/');
        if (rel === MANIFEST) continue;
        files.push({ path: rel, sha256: sha256File(p), bytes: fs.statSync(p).size });
      } else throw new Error(`artifact: unexpected entry ${path.relative(dir, p)}`);
    }
  };
  walk(dir);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const checksum = crypto
    .createHash('sha256')
    .update(files.map((f) => `${f.path}\t${f.sha256}\n`).join(''))
    .digest('hex');
  return { files, bytes: files.reduce((n, f) => n + f.bytes, 0), checksum };
}

/** Replace large files by hard links to content-addressed blobs (one copy of each video on disk). */
function shareBlobs(root: string, dir: string, tree: ArtifactTree) {
  const blobs = path.join(root, 'blobs');
  fs.mkdirSync(blobs, { recursive: true });
  for (const f of tree.files) {
    if (f.bytes < BLOB_MIN_BYTES) continue;
    const blob = path.join(blobs, f.sha256);
    const file = path.join(dir, f.path);
    try {
      if (!fs.existsSync(blob)) {
        fs.linkSync(file, blob);
        fs.chmodSync(blob, 0o444);
      } else {
        const tmp = `${file}.blob-${crypto.randomBytes(4).toString('hex')}`;
        fs.linkSync(blob, tmp);
        fs.renameSync(tmp, file);
      }
    } catch {
      // Different file system or no hard links: keep the regular file (only costs disk space).
    }
  }
}

function setReadOnly(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      setReadOnly(p);
      fs.chmodSync(p, 0o555);
    } else fs.chmodSync(p, 0o444);
  }
}

/** Make an artifact writable again (only to delete a failed / pruned release). */
export function setWritable(dir: string) {
  if (!fs.existsSync(dir)) return;
  fs.chmodSync(dir, 0o755);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) setWritable(p);
    else fs.chmodSync(p, 0o644);
  }
}

export function removeDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  setWritable(dir);
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Move a finished build into releases/<key>, write its manifest, share large files and make it
 * read-only. Returns the tree as stored (checksum verified after the move).
 */
export function storeArtifact(root: string, key: string, distDir: string, manifest: Record<string, unknown>, expected: ArtifactTree): ArtifactTree {
  if (!isReleaseKey(key)) throw new Error(`artifact: invalid release key ${key}`);
  const target = releaseDir(root, key);
  if (fs.existsSync(target)) throw new Error(`artifact: ${key} already exists (artifacts are immutable)`);
  fs.mkdirSync(releasesPath(root), { recursive: true });
  fs.renameSync(distDir, target);
  shareBlobs(root, target, expected);
  const stored = readTree(target);
  if (stored.checksum !== expected.checksum) throw new Error('artifact: checksum changed while storing');
  const file = path.join(target, MANIFEST);
  fs.writeFileSync(file, JSON.stringify({ ...manifest, artifact_checksum: `sha256:${stored.checksum}`, artifact_bytes: stored.bytes, files: stored.files.length }, null, 2) + '\n');
  const fd = fs.openSync(file, 'r');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  setReadOnly(target);
  fs.chmodSync(target, 0o555);
  return stored;
}

export function readManifest(root: string, key: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(releaseDir(root, key), MANIFEST), 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The release `current` points to, or null (no release activated yet). */
export function readCurrent(root: string): string | null {
  try {
    const target = fs.readlinkSync(currentLink(root));
    const key = path.basename(target);
    return isReleaseKey(key) ? key : null;
  } catch {
    return null;
  }
}

/** Verify an artifact is complete and unchanged (checksum of the stored files). */
export function verifyArtifact(root: string, key: string, checksum: string): { ok: true } | { ok: false; reason: string } {
  const dir = releaseDir(root, key);
  if (!fs.existsSync(dir)) return { ok: false, reason: 'missing' };
  try {
    const tree = readTree(dir);
    return tree.checksum === checksum ? { ok: true } : { ok: false, reason: 'checksum' };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/** Point `current` at releases/<key> atomically; returns the previous key (or null). */
export function switchCurrent(root: string, key: string): string | null {
  if (!isReleaseKey(key)) throw new Error(`activate: invalid release key ${key}`);
  if (!fs.existsSync(releaseDir(root, key))) throw new Error(`activate: release ${key} has no artifact`);
  const previous = readCurrent(root);
  const tmp = path.join(root, `current.${crypto.randomBytes(6).toString('hex')}`);
  fs.symlinkSync(path.join('releases', key), tmp);
  try {
    fs.renameSync(tmp, currentLink(root));
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return previous;
}

/** Smoke check of the served tree after a switch: home in every language, 404 pages, sitemap. */
export function smokeCheck(root: string, locales: readonly string[]): string[] {
  const cur = currentLink(root);
  const problems: string[] = [];
  const need = ['index.html', '404.html', 'sitemap.xml', ...locales.filter((l) => l !== 'en').flatMap((l) => [`${l}.html`, `${l}/404.html`])];
  for (const f of need) {
    try {
      if (fs.statSync(path.join(cur, f)).size === 0) problems.push(`${f}: empty`);
    } catch {
      problems.push(`${f}: missing`);
    }
  }
  return problems;
}

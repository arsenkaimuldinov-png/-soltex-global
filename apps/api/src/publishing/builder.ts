/**
 * Site builder of the publishing worker (Phase G, docs/admin-publishing.md §5).
 *
 * Runs the EXISTING public build (`npm run build` of apps/web: content validation → vite build →
 * prerender → validate-site) on a content snapshot, in an isolated workspace:
 *
 *   <root>/build/<key>/apps/web/        copy of apps/web sources (public/ as hard links)
 *   <root>/build/<key>/apps/web/node_modules → <repo>/apps/web/node_modules   (symlink)
 *   <root>/build/<key>/node_modules          → <repo>/node_modules            (symlink)
 *   <root>/build/<key>/packages              → <repo>/packages                (symlink)
 *   <root>/build/<key>/store.json            the snapshot (CONTENT_SOURCE=file)
 *
 * so a build never writes into apps/web/dist or apps/web/src/content/snapshot of the running
 * code, and two builds never share an output directory. The child process gets a minimal
 * environment (no database URLs, no keys).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ContentStore } from '@soltex/core/content';
import { buildDir, removeDir } from './artifacts.ts';

export interface BuildIssue {
  step: 'content' | 'build' | 'prerender' | 'site' | 'timeout' | 'workspace';
  message: string;
  errors: string[];
}

export class BuildFailure extends Error {
  constructor(readonly issue: BuildIssue) {
    super(issue.message);
  }
}

export interface BuildResult {
  /** Directory with the finished site (moved into releases/<key> by the worker). */
  distDir: string;
  /** Content warnings reported by the build (e.g. outdated translations). */
  warnings: string[];
  log: string;
}

export interface Builder {
  build(input: { root: string; key: string; store: ContentStore; heartbeat: () => void }): Promise<BuildResult>;
  /** Remove the workspace of a build (always called after the build, also after a failure). */
  cleanup(root: string, key: string): void;
}

const REPO = path.resolve(import.meta.dirname, '../../../..');
const WEB = path.join(REPO, 'apps/web');
const SKIP = new Set(['node_modules', 'dist', '.vite']);
const LOG_LIMIT = 1 << 20;

function copyTree(from: string, to: string, link: boolean) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyTree(a, b, link);
    else if (e.isFile()) {
      if (link) {
        try {
          fs.linkSync(a, b);
          continue;
        } catch {
          /* other file system: copy */
        }
      }
      fs.copyFileSync(a, b);
    } else if (e.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(a), b);
  }
}

/** Prepare the isolated workspace for one build. */
export function prepareWorkspace(root: string, key: string, store: ContentStore): string {
  const ws = buildDir(root, key);
  removeDir(ws);
  const web = path.join(ws, 'apps/web');
  fs.mkdirSync(web, { recursive: true });
  for (const e of fs.readdirSync(WEB, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const a = path.join(WEB, e.name);
    const b = path.join(web, e.name);
    // public/ (images, videos) is only read by the build: hard links instead of 140 MB of copies.
    if (e.isDirectory()) copyTree(a, b, e.name === 'public');
    else if (e.isFile()) fs.copyFileSync(a, b);
  }
  // Generated per-language snapshots of the running code are never reused.
  fs.rmSync(path.join(web, 'src/content/snapshot'), { recursive: true, force: true });
  fs.symlinkSync(path.join(WEB, 'node_modules'), path.join(web, 'node_modules'));
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(ws, 'node_modules'));
  fs.symlinkSync(path.join(REPO, 'packages'), path.join(ws, 'packages'));
  fs.writeFileSync(path.join(ws, 'store.json'), JSON.stringify(store));
  return ws;
}

/** Bullet lines ("  - …") after a "<tool>: N error(s)" header. */
function bullets(output: string, header: RegExp): string[] {
  const i = output.search(header);
  if (i < 0) return [];
  const out: string[] = [];
  for (const line of output.slice(i).split('\n').slice(1)) {
    const m = line.match(/^\s+- (.*)$/);
    if (!m) break;
    out.push(m[1]!.slice(0, 500));
  }
  return out;
}

function classify(output: string): BuildIssue {
  const content = bullets(output, /content: \d+ error\(s\)/);
  if (content.length) return { step: 'content', message: 'Проверка содержимого не пройдена', errors: content };
  const site = output.match(/validate-site: (\d+) error[\s\S]*/);
  if (site) return { step: 'site', message: 'Проверка готового сайта не пройдена', errors: bullets(output, /validate-site: \d+ error/).length ? bullets(output, /validate-site: \d+ error/) : [site[0].split('\n')[0]!.slice(0, 500)] };
  if (/prerender/i.test(output) && /error/i.test(output.slice(output.lastIndexOf('prerender')))) return { step: 'prerender', message: 'Ошибка при генерации страниц', errors: [] };
  return { step: 'build', message: 'Ошибка сборки сайта', errors: [] };
}

/** The real builder: `npm run build` of the copied apps/web with CONTENT_SOURCE=file. */
export function siteBuilder(options: { timeoutMs?: number; mediaDir?: string } = {}): Builder {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  return {
    async build({ root, key, store, heartbeat }) {
      let ws: string;
      try {
        ws = prepareWorkspace(root, key, store);
      } catch (e) {
        throw new BuildFailure({ step: 'workspace', message: 'Не удалось подготовить сборку (место на диске, права)', errors: [String((e as Error).message).slice(0, 300)] });
      }
      const web = path.join(ws, 'apps/web');
      // Minimal environment: no database URLs, keys or other secrets reach the build.
      const env: Record<string, string> = {
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        HOME: process.env.HOME ?? ws,
        NODE_ENV: 'production',
        CONTENT_SOURCE: 'file',
        CONTENT_STORE_FILE: path.join(ws, 'store.json'),
        npm_config_update_notifier: 'false',
        // Media library files (/media/…) are checked against shared storage, not copied (Phase J).
        ...(options.mediaDir ? { MEDIA_ROOT: options.mediaDir } : {}),
      };
      let log = '';
      const append = (b: Buffer) => {
        log += b.toString();
        if (log.length > LOG_LIMIT) log = log.slice(0, LOG_LIMIT / 2) + '\n…\n' + log.slice(-LOG_LIMIT / 2);
      };
      const code = await new Promise<number | 'timeout'>((resolve) => {
        const child = spawn('npm', ['run', 'build'], { cwd: web, env, stdio: ['ignore', 'pipe', 'pipe'] });
        const beat = setInterval(heartbeat, 5000);
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve('timeout');
        }, timeoutMs);
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        child.on('close', (c) => {
          clearInterval(beat);
          clearTimeout(timer);
          resolve(c ?? 1);
        });
      });
      if (code === 'timeout') throw new BuildFailure({ step: 'timeout', message: `Сборка не уложилась в ${Math.round(timeoutMs / 60000)} мин`, errors: [] });
      if (code !== 0) throw new BuildFailure(classify(log));
      return { distDir: path.join(web, 'dist'), warnings: bullets(log, /content: \d+ warning\(s\)/), log };
    },
    cleanup(root, key) {
      removeDir(buildDir(root, key));
    },
  };
}

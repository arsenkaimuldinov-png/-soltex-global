#!/usr/bin/env node
/**
 * Dependency-direction check for the monorepo (docs/admin-architecture-approved.md §18).
 *
 *   apps/web, apps/admin, apps/api  ──►  packages/core        (allowed)
 *   packages/core                   ──►  apps/*               (forbidden)
 *   apps/<a>                        ──►  apps/<b>             (forbidden)
 *
 * packages/core must also stay framework- and platform-free (no React, Vite, DOM or Node APIs),
 * and its layers follow: domain ← validation ← seo / content (seo and content do not import each other).
 *
 * No dependencies; scans import/export/require specifiers with a regex. Exit 1 on any violation.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APPS = ['web', 'admin', 'api'];
const CORE_LAYERS = { domain: [], validation: ['domain'], seo: ['domain', 'validation'], content: ['domain', 'validation'] };
const CORE_FORBIDDEN_PACKAGES = /^(react|react-dom|react-router|react-router-dom|vite|@vitejs\/|tailwindcss|@tailwindcss\/|lucide-react|motion|express|fastify|drizzle-orm|pg|pg-boss|playwright)(\/|$)/;
const CORE_FORBIDDEN_NODE = /^(node:|fs$|path$|os$|child_process$|http$|https$|crypto$|url$|process$)/;
const CORE_FORBIDDEN_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator|HTMLElement|process\.env|__dirname|require\()\b/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.qa', 'coverage', 'snapshot']);

const errors = [];

function* files(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(m?[jt]sx?|cjs)$/.test(e.name)) yield p;
  }
}

const SPEC = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const specifiers = (text) => [...text.matchAll(SPEC)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
const rel = (p) => path.relative(ROOT, p);
/** Strip comments so documentation that mentions `window` or `apps/web` does not count. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// 1. packages/core
const coreSrc = path.join(ROOT, 'packages/core/src');
for (const file of files(coreSrc)) {
  const text = code(fs.readFileSync(file, 'utf8'));
  const layer = path.relative(coreSrc, file).split(path.sep)[0];
  for (const spec of specifiers(text)) {
    if (/^@soltex\/(web|admin|api)(\/|$)/.test(spec)) errors.push(`${rel(file)}: core imports an application (${spec})`);
    if (CORE_FORBIDDEN_PACKAGES.test(spec)) errors.push(`${rel(file)}: core imports a UI/framework/runtime package (${spec})`);
    if (CORE_FORBIDDEN_NODE.test(spec)) errors.push(`${rel(file)}: core imports a Node-only module (${spec})`);
    if (spec.startsWith('.')) {
      const target = path.resolve(path.dirname(file), spec);
      if (!target.startsWith(coreSrc + path.sep)) errors.push(`${rel(file)}: core imports outside packages/core/src (${spec})`);
      else {
        const targetLayer = path.relative(coreSrc, target).split(path.sep)[0];
        if (targetLayer !== layer && !(CORE_LAYERS[layer] ?? []).includes(targetLayer))
          errors.push(`${rel(file)}: layer "${layer}" may not import layer "${targetLayer}" (${spec})`);
      }
    }
  }
  const g = text.match(CORE_FORBIDDEN_GLOBALS);
  if (g) errors.push(`${rel(file)}: core uses a browser/Node global (${g[0]})`);
}
const corePkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/package.json'), 'utf8'));
for (const dep of Object.keys(corePkg.dependencies ?? {}))
  if (dep !== 'zod') errors.push(`packages/core/package.json: runtime dependency "${dep}" is not allowed (only zod)`);

// 2. applications do not import each other (by package name or by relative path)
for (const app of APPS) {
  const appDir = path.join(ROOT, 'apps', app);
  for (const file of files(appDir)) {
    const text = code(fs.readFileSync(file, 'utf8'));
    for (const spec of specifiers(text)) {
      const m = spec.match(/^@soltex\/(web|admin|api)(\/|$)/);
      if (m && m[1] !== app) errors.push(`${rel(file)}: apps/${app} imports @soltex/${m[1]}`);
      if (spec.startsWith('.')) {
        const target = path.resolve(path.dirname(file), spec);
        if (!target.startsWith(appDir + path.sep) && target.startsWith(path.join(ROOT, 'apps') + path.sep))
          errors.push(`${rel(file)}: apps/${app} imports another application by path (${spec})`);
        if (target.startsWith(path.join(ROOT, 'packages') + path.sep))
          errors.push(`${rel(file)}: import packages by name (@soltex/core/…), not by relative path (${spec})`);
      }
    }
  }
}

if (errors.length) {
  console.error(`check-deps: ${errors.length} violation(s)\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log('check-deps: OK (core is independent of apps and UI; apps do not import each other; core layers respected)');

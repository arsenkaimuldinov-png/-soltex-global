# Generated — do not edit

`<locale>.json` files in this folder are **generated** from the source-controlled content seed (`src/content/seed/*.json`) by `npm run content` (`scripts/content/build-snapshots.ts`). They are git-ignored.

`npm run dev`, `npm run lint` and `npm run build` regenerate them automatically before they run. After a fresh clone, run `npm ci`, then any of those commands. If you run `vite` or `tsc` directly, run `npm run content` first; otherwise the import of `src/content/snapshot/en.json` fails loudly. Content never silently disappears.

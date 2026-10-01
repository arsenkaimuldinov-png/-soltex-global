# QA harness (regression testing)

These scripts are development tools for the Phase 1 acceptance tests. They are not part of the build. They need Playwright, which is deliberately **not** a project dependency. Install it ad hoc with `npx -y playwright@1 install chromium`, or set `CHROMIUM_PATH`.

## Steps

1. Serve both builds the way a real host would:

   ```
   node scripts/serve-dist.mjs <baseline-dist> 4173
   node scripts/serve-dist.mjs dist 4174
   ```

2. Capture page data from both builds:

   ```
   node scripts/qa/capture.mjs http://localhost:4173 out/base en,ru,zh,tr,ar,es 1440,390 0
   node scripts/qa/capture.mjs http://localhost:4174 out/new  en,ru,zh,tr,ar,es 1440,390 0
   ```

   Page data covers the head tags plus the texts and attributes of header, main and footer.

3. Compare the two captures:

   ```
   node scripts/qa/compare.mjs out/base/data-*.json out/new/data-*.json
   ```

4. Capture screenshots (last argument `1`) and compare them:

   ```
   node scripts/qa/capture.mjs <url> out/x en,ru,zh,tr,ar,es 390,768,1280,1440 1
   node scripts/qa/diff-shots.mjs out/base/shots out/new/shots
   ```

5. Run the interaction scripts against each build and diff their outputs:

   ```
   node scripts/qa/interact.mjs <url> out.json
   ```

   This covers dialogs, inquiry topics and form submission.

6. Run the extra checks against the new build:

   ```
   node scripts/qa/checks.mjs http://localhost:4174 out/base/data-*.json
   ```

   These cover JavaScript disabled, the motion system, script failure, and real 404 pages.
7. Run the inquiry language-switch regression test. It checks that the selected inquiry topic follows the current language, both while the dialog is open and after reopening it:

   ```
   node scripts/qa/inquiry-language.mjs http://localhost:4174 .
   ```

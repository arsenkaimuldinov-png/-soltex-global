// Pixel comparison of two screenshot folders (capture.mjs SHOTS=1).
//   node diff-shots.mjs baseline/shots candidate/shots [threshold=0.001]
// Uses sharp (already a devDependency). Reports images whose share of differing pixels
// (per-channel delta > 24) exceeds the threshold, or whose height differs.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
const [A, B, thr = '0.001'] = process.argv.slice(2);
const names = fs.readdirSync(A).filter((n) => n.endsWith('.png'));
const bad = [];
let identical = 0;
for (const n of names) {
  if (!fs.existsSync(path.join(B, n))) { bad.push([n, 'missing']); continue; }
  const [ia, ib] = await Promise.all([A, B].map((d) => sharp(path.join(d, n)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) { bad.push([n, `size ${ia.info.width}x${ia.info.height} vs ${ib.info.width}x${ib.info.height}`]); continue; }
  let diff = 0;
  for (let i = 0; i < ia.data.length; i += 4) {
    if (Math.abs(ia.data[i] - ib.data[i]) > 24 || Math.abs(ia.data[i + 1] - ib.data[i + 1]) > 24 || Math.abs(ia.data[i + 2] - ib.data[i + 2]) > 24) diff++;
  }
  const ratio = diff / (ia.data.length / 4);
  if (ratio === 0) identical++;
  if (ratio > Number(thr)) bad.push([n, `${(ratio * 100).toFixed(3)}% pixels differ`]);
}
console.log(`compared ${names.length} screenshots: ${identical} pixel-identical, ${bad.length} above threshold`);
for (const [n, why] of bad) console.log(`  ${n}: ${why}`);
process.exit(bad.length ? 1 : 0);

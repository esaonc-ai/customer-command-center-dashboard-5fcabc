/**
 * One-shot, idempotent patcher: derives scripts/refresh-v47.mjs from scripts/refresh-v46.mjs.
 * Only version identifiers, capture paths and the refresh instant change; all
 * eligibility / exclusion / dedup logic is inherited unchanged.
 */
import fs from 'node:fs';

const NOW = process.env.REFRESH_INSTANT_UTC ?? '2026-09-19T18:26:00Z';

let s = fs.readFileSync('scripts/refresh-v46.mjs', 'utf8');

const reps = [
  ["const VERSION = 'v46';", "const VERSION = 'v47';"],
  ['scripts/gate-live-2026-09-18-v46.tsv', 'scripts/gate-live-2026-09-19-v47.tsv'],
  ['scripts/reopen-live-2026-09-18-v46.tsv', 'scripts/reopen-live-2026-09-19-v47.tsv'],
  ["const REFRESH_INSTANT = new Date('2026-09-18T09:35:00Z');", `const REFRESH_INSTANT = new Date('${NOW}');`],
  ["endsWith('-AUTHORITATIVE-v45')", "endsWith('-AUTHORITATIVE-v46')"],
  ['expected v44 predecessor, got', 'expected v46 predecessor, got'],
  ['AUTHORITATIVE v46)', 'AUTHORITATIVE v47)'],
  ['**AUTHORITATIVE v45**, department', '**AUTHORITATIVE v47**, department'],
  ['### v45 -> v46 (', '### v46 -> v47 ('],
  ["readme.replace(/### v44 -> v45 \\(/, '### v44 -> v45 (superseded by v46) (')",
   "readme.replace(/### v45 -> v46 \\(/, '### v45 -> v46 (superseded by v47) (')"],
  ['if (/### v45 -> v46', 'if (/### v46 -> v47'],
  ['NHT/Cesanek Customer Command Center refresh v45.', 'NHT/Cesanek Customer Command Center refresh v47.'],
];

for (const [from, to] of reps) {
  if (!s.includes(from)) {
    console.error(`MISSING PATTERN: ${from}`);
    process.exit(1);
  }
  s = s.split(from).join(to);
}

fs.writeFileSync('scripts/refresh-v47.mjs', s);
console.log('refresh-v47.mjs written; refresh instant', NOW);

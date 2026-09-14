#!/usr/bin/env node
/**
 * v41 gate artifact preparation.
 *
 * Input : scripts/gate-flags-2026-09-13-v41.csv  (raw delegate export, 18 columns,
 *         7 rows carry unquoted commas inside subject/organization so those rows
 *         shift after the subject column).
 * Output: scripts/gate-raw-delegate-2026-09-13-v41.csv  (byte-faithful provenance copy)
 *         scripts/gate-flags-2026-09-13-v41.csv        (normalized 5-column gate,
 *         same shape as the v40 gate artifact: only the fields the pipeline consumes
 *         and that sit BEFORE the shift point are kept).
 *
 * Rationale: ticketNumber, displayStatusName, closeFlag, isSlaBreached and isOverdue are
 * all left of the subject field, so they survive the shift unchanged. Everything to the
 * right of subject is not used from this artifact; those fields are carried forward from
 * the v40 baseline (or taken from the clean arrival rows) instead of being trusted here.
 */
import { readFile, writeFile } from 'node:fs/promises';

const RAW = 'scripts/gate-flags-2026-09-13-v41.csv';
const RAW_COPY = 'scripts/gate-raw-delegate-2026-09-13-v41.csv';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
}

const raw = await readFile(RAW, 'utf8');
await writeFile(RAW_COPY, raw, 'utf8');

const rows = parseCsv(raw);
const header = rows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const width = header.length;

const records = rows.map((r) => ({
  ticketId: r[idx.ticketNumber],
  status: r[idx.status],
  closeFlag: r[idx.closeFlag] === 'true',
  sla: r[idx.slaBreached] === 'true',
  overdue: r[idx.overdue] === 'true',
  shifted: r.length !== width,
}));

const bad = records.filter((r) => !r.ticketId || !r.ticketId.startsWith('UFN-'));
if (bad.length) throw new Error(`${bad.length} rows are not UFN-prefixed`);
if (new Set(records.map((r) => r.ticketId)).size !== records.length) throw new Error('duplicate ticket numbers in gate');
const statuses = new Set(records.map((r) => r.status));
for (const s of statuses) if (!['New', 'Pending'].includes(s)) throw new Error(`unexpected gate status ${s}`);

const out = ['ticketNumber,displayStatusName,closeFlag,isSlaBreached,isOverdue'];
for (const r of records) out.push([r.ticketId, r.status, r.closeFlag, r.sla, r.overdue].join(','));
await writeFile(RAW, `${out.join('\n')}\n`, 'utf8');

console.log('raw delegate rows           :', records.length);
console.log('rows with shifted columns   :', records.filter((r) => r.shifted).length,
  records.filter((r) => r.shifted).map((r) => r.ticketId).join(', '));
console.log('status split                :', records.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}));
console.log('closeFlag=true              :', records.filter((r) => r.closeFlag).length);
console.log('isSlaBreached=true          :', records.filter((r) => r.sla).length);
console.log('isOverdue=true              :', records.filter((r) => r.overdue).length);
console.log('normalized gate written to  :', RAW);
console.log('raw provenance copy         :', RAW_COPY);

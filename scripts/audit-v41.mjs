#!/usr/bin/env node
/**
 * Read-only audit of the v41 candidate gate against the v40 baseline.
 * No writes. Prints the reconciliation the coordinator needs.
 */
import { readFile } from 'node:fs/promises';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
}

const newCsv = await readFile('scripts/gate-flags-2026-09-13-v41.csv', 'utf8');
const newRows = parseCsv(newCsv);
const header = newRows.shift();
console.log('v41 header:', header.join(' | '));
console.log('v41 data rows:', newRows.length);

const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const gate41 = newRows.map((r) => ({
  ticketId: r[idx.ticketNumber],
  status: r[idx.status],
  statusId: r[idx.statusId],
  sysStatus: r[idx.sysStatus],
  closeFlag: r[idx.closeFlag] === 'true',
  sla: r[idx.slaBreached] === 'true',
  overdue: r[idx.overdue] === 'true',
  org: (r[idx.organization] || '').trim(),
  customer: (r[idx.customer] || '').trim(),
  priority: (r[idx.priority] || '').trim(),
  assignee: (r[idx.assignee] || '').trim(),
  created: r[idx.created],
}));

const ids41 = gate41.map((r) => r.ticketId);
const set41 = new Set(ids41);
console.log('unique:', set41.size, 'dupes:', ids41.length - set41.size);
console.log('non-UFN:', ids41.filter((t) => !t.startsWith('UFN-')).length);
console.log('status split:', gate41.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}));
console.log('sysStatus values:', [...new Set(gate41.map((r) => r.sysStatus))]);
console.log('statusId values:', [...new Set(gate41.map((r) => r.statusId))]);
console.log('closeFlag=true count:', gate41.filter((r) => r.closeFlag).length);
console.log('closeFlag=true rows:', gate41.filter((r) => r.closeFlag).map((r) => r.ticketId).join(', '));
console.log('priority values:', [...new Set(gate41.map((r) => r.priority))]);

// ---- v40 baseline ----
const gate40raw = (await readFile('scripts/gate-flags-2026-09-13-v40.csv', 'utf8')).trim().split('\n');
const gate40 = gate40raw.slice(1).map((l) => l.split(',')[0]);
const set40 = new Set(gate40);
console.log('\nv40 gate rows:', gate40.length, 'unique:', set40.size);

const arrivals = [...set41].filter((t) => !set40.has(t)).sort();
const departures = [...set40].filter((t) => !set41.has(t)).sort();
console.log('arrivals vs v40 gate:', arrivals.length, arrivals.join(', '));
console.log('departures vs v40 gate:', departures.length, departures.join(', '));

// ---- excluded sets ----
const manifest = JSON.parse(await readFile('dashboard/data/refresh-manifest.json', 'utf8'));
const tickets40 = JSON.parse(await readFile('dashboard/data/tickets.json', 'utf8'));
const billing = manifest.exclusions.billingTicketIds;
const dupes = manifest.exclusions.duplicateConversations.map((d) => d.ticketId);
console.log('\nv40 eligible:', tickets40.length, 'billing:', billing.length, 'dupes:', dupes.length,
  'sum:', tickets40.length + billing.length + dupes.length);

const recon = tickets40.map((t) => t.ticketId).concat(billing, dupes);
const reconMissing = recon.filter((t) => !set41.has(t));
console.log('v40 baseline rows missing from v41 gate:', reconMissing.length, reconMissing.join(', '));

const excluded41 = [...billing, ...dupes].filter((t) => set41.has(t));
console.log('excluded rows present in v41 gate:', excluded41.length, '/', billing.length + dupes.length);
const billingMissing = billing.filter((t) => !set41.has(t));
console.log('billing rows NOT in v41 gate:', billingMissing.length, billingMissing.join(', '));
const dupesMissing = dupes.filter((t) => !set41.has(t));
console.log('duplicate rows NOT in v41 gate:', dupesMissing.length, dupesMissing.join(', '));

const eligible41 = gate41.filter((r) => !billing.includes(r.ticketId) && !dupes.includes(r.ticketId));
console.log('\nv41 eligible (gate - billing - dupes):', eligible41.length);
console.log('v41 eligible by status:', eligible41.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}));
console.log('v41 eligible closeFlag=true:', eligible41.filter((r) => r.closeFlag).length,
  eligible41.filter((r) => r.closeFlag).map((r) => r.ticketId).join(', '));
console.log('v41 eligible slaBreached:', eligible41.filter((r) => r.sla).length,
  'onTrack:', eligible41.filter((r) => !r.sla).length);
console.log('v41 eligible unassigned:', eligible41.filter((r) => !r.assignee).length);

const eligIds41 = new Set(eligible41.map((r) => r.ticketId));
const eligArrivals = arrivals.filter((t) => eligIds41.has(t));
const eligDepartures = tickets40.map((t) => t.ticketId).filter((t) => !eligIds41.has(t)).sort();
console.log('eligible arrivals:', eligArrivals.length, eligArrivals.join(', '));
console.log('eligible departures:', eligDepartures.length, eligDepartures.join(', '));
console.log('eligible carried over:', tickets40.filter((t) => eligIds41.has(t.ticketId)).length);

// ---- per-record flag drift on carried-over eligible ----
const g41 = new Map(gate41.map((r) => [r.ticketId, r]));
const drift = [];
for (const t of tickets40) {
  const live = g41.get(t.ticketId);
  if (!live) continue;
  if (live.status !== t.opsStatus) drift.push({ id: t.ticketId, field: 'opsStatus', from: t.opsStatus, to: live.status });
  if (live.closeFlag !== t.closeFlag) drift.push({ id: t.ticketId, field: 'closeFlag', from: t.closeFlag, to: live.closeFlag });
  if (live.sla !== t.isSlaBreached) drift.push({ id: t.ticketId, field: 'isSlaBreached', from: t.isSlaBreached, to: live.sla });
  if (live.overdue !== t.isOverdue) drift.push({ id: t.ticketId, field: 'isOverdue', from: t.isOverdue, to: live.overdue });
}
console.log('\nper-record flag drift on carried-over eligible:', drift.length);
for (const d of drift) console.log('  ', JSON.stringify(d));

// ---- priority reconciliation vs v40 ----
const miss40 = tickets40.filter((t) => t.prioritySourceMissing || !t.priority).map((t) => t.ticketId);
console.log('\nv40 records with missing priority:', miss40.length, miss40.join(', '));
for (const id of miss40) console.log('   v41 says priority=', JSON.stringify(g41.get(id)?.priority));

// ---- customer/org mapping spot check for carried-over ----
let custMismatch = 0; const samples = [];
for (const t of tickets40) {
  const live = g41.get(t.ticketId);
  if (!live) continue;
  const expected = live.org || live.customer;
  if (expected && expected !== t.customer) { custMismatch += 1; if (samples.length < 10) samples.push({ id: t.ticketId, v40: t.customer, v41: expected }); }
}
console.log('\ncustomer-label mismatches (v40 vs v41 org-else-name):', custMismatch);
for (const s of samples) console.log('  ', JSON.stringify(s));

// ---- originals for eligible arrivals (full field source) ----
console.log('\n--- eligible arrival raw rows ---');
for (const r of eligible41.filter((x) => eligArrivals.includes(x.ticketId))) {
  console.log(JSON.stringify(r));
}

// ---- oldest records sanity ----
const sorted = [...eligible41].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
console.log('\noldest 3 by created:', sorted.slice(0, 3).map((r) => `${r.ticketId} ${r.created}`).join(' | '));
console.log('newest 3 by created:', sorted.slice(-3).map((r) => `${r.ticketId} ${r.created}`).join(' | '));

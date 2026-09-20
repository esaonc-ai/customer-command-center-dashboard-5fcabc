#!/usr/bin/env node
// v48 refresh computation for the NHT/Cesanek Customer Command Center dashboard.
// Reads the eligible ticket records and recomputes every age-derived dashboard
// section at a given reference time. Deterministic: running it with
// --reference 2026-09-19T14:26:00-04:00 must reproduce the v47 manifest.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const REFERENCE = argOf('--reference');
const OUT = argOf('--out');
const VERIFY = args.includes('--verify');

const tickets = JSON.parse(readFileSync('dashboard/data/tickets.json', 'utf8'));
const refMs = new Date(REFERENCE).getTime();
if (!Number.isFinite(refMs)) throw new Error(`bad reference: ${REFERENCE}`);

const hoursSince = (iso) => (refMs - new Date(iso).getTime()) / 36e5;

const enriched = tickets.map((t) => {
  const ageHours = Math.max(0, hoursSince(t.createdAt));
  const ageDays = Math.floor(ageHours / 24);
  const breached = Boolean(t.isSlaBreached || t.isOverdue || /breach/i.test(t.slaStatus || ''));
  return { ...t, ageHours: Math.floor(ageHours), ageDays, breached };
});

const total = enriched.length;
const byStatus = {
  New: enriched.filter((t) => t.displayStatusName === 'New').length,
  Open: enriched.filter((t) => t.displayStatusName === 'Open').length,
  Pending: enriched.filter((t) => t.displayStatusName === 'Pending').length,
};
const byPriority = enriched.reduce((acc, t) => {
  const k = t.priority || 'unavailable';
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

const breachedList = enriched.filter((t) => t.breached);
const onTrack = enriched.filter((t) => !t.breached);

// Priority queue: oldest first (SLA breach, then age).
const priorityQueue = [...enriched]
  .sort((a, b) => (Number(b.breached) - Number(a.breached)) || (b.ageHours - a.ageHours))
  .slice(0, 15)
  .map((t) => ({
    ticketId: t.ticketId,
    customer: t.customer,
    subject: t.subject,
    ageDays: t.ageDays,
    ageHours: t.ageHours,
    slaStatus: t.breached ? 'Breached' : 'On Track',
  }));

// Action buckets by age.
const bucketOf = (h) => (h < 24 ? 'Immediate' : h < 72 ? 'Short-Term' : h < 168 ? 'Medium-Term' : 'Watch');
const actionBuckets = { Immediate: 0, 'Short-Term': 0, 'Medium-Term': 0, Watch: 0 };
for (const t of enriched) actionBuckets[bucketOf(t.ageHours)] += 1;

// Customer health: every customer visible in eligible tickets; roster is supplemental.
const byCustomer = new Map();
for (const t of enriched) {
  const name = t.customer || t.customerEmail || 'Unknown';
  const row = byCustomer.get(name) || { tickets: 0, breached: 0, oldestBreachedAgeDays: 0, olderThan7d: 0 };
  row.tickets += 1;
  if (t.breached) {
    row.breached += 1;
    row.oldestBreachedAgeDays = Math.max(row.oldestBreachedAgeDays, t.ageDays);
  }
  if (t.ageDays > 7) row.olderThan7d += 1;
  byCustomer.set(name, row);
}
const customers = {};
const tiers = { Critical: 0, Warning: 0, Healthy: 0 };
for (const [name, row] of byCustomer) {
  const share = row.tickets ? row.olderThan7d / row.tickets : 0;
  const tier = share >= 0.5 || row.tickets >= 3 ? 'Critical' : share >= 0.25 || row.tickets >= 1 ? 'Warning' : 'Healthy';
  tiers[tier] += 1;
  customers[name] = {
    tickets: row.tickets,
    breached: row.breached,
    oldestBreachedAgeDays: row.oldestBreachedAgeDays,
    tier,
  };
}
const sortedCustomers = Object.fromEntries(
  Object.entries(customers).sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0])),
);

const result = {
  reference: REFERENCE,
  counts: {
    totalEligible: total,
    byStatus,
    byPriority,
    excluded: 0,
  },
  workload: {
    overdueOrSlaBreached: breachedList.length,
    current: onTrack.length,
  },
  priorityQueue,
  actionBuckets,
  customerHealth: { totalCustomers: byCustomer.size, tiers, customers: sortedCustomers },
  evidenceMetrics: {
    totalEligible: total,
    slaBreached: breachedList.length,
    slaOnTrack: onTrack.length,
    unassigned: enriched.filter((t) => /unassigned/i.test(t.assigned || '')).length,
    oldestAgeDays: enriched.reduce((m, t) => Math.max(m, t.ageDays), 0),
    closeFlagTrueRetained: enriched.filter((t) => t.closeFlag).length,
  },
};

if (VERIFY) {
  const manifest = JSON.parse(readFileSync('dashboard/data/refresh-manifest.json', 'utf8'));
  const ds = manifest.dashboardState;
  const cmp = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: computed=${JSON.stringify(actual)} v47=${JSON.stringify(expected)}`);
    return ok;
  };
  let all = true;
  all &= cmp('byStatus', result.counts.byStatus, ds.byStatus);
  all &= cmp('byPriority', result.counts.byPriority, ds.byPriority);
  all &= cmp('workload', result.workload, ds.workload);
  all &= cmp('actionBuckets', result.actionBuckets, ds.actionBuckets);
  all &= cmp('priorityQueue[0]', result.priorityQueue[0], ds.priorityQueue[0]);
  all &= cmp('priorityQueue[14]', result.priorityQueue[14], ds.priorityQueue[14]);
  all &= cmp('customerHealth.totalCustomers', result.customerHealth.totalCustomers, ds.customerHealth.totalCustomers);
  all &= cmp('customerHealth.tiers', result.customerHealth.tiers, ds.customerHealth.tiers);
  all &= cmp('customerHealth.sample', result.customerHealth.customers['Maria Aponte (maria.aponte@unisco.com)'], ds.customerHealth.customers['Maria Aponte (maria.aponte@unisco.com)']);
  all &= cmp('evidence.slaBreached', result.evidenceMetrics.slaBreached, ds.evidenceMetrics.slaBreached);
  all &= cmp('evidence.slaOnTrack', result.evidenceMetrics.slaOnTrack, ds.evidenceMetrics.slaOnTrack);
  all &= cmp('evidence.unassigned', result.evidenceMetrics.unassigned, ds.evidenceMetrics.unassigned);
  all &= cmp('evidence.oldestAgeDays', result.evidenceMetrics.oldestAgeDays, ds.evidenceMetrics.oldestAgeDays);
  console.log(all ? '\nBASELINE REPRODUCED' : '\nBASELINE MISMATCH');
}

if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 2));
else console.log(JSON.stringify(result, null, 2));

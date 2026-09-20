#!/usr/bin/env node
// Applies the v48 refresh to the dashboard data artifacts.
// Age-derived sections come from refresh-v48.mjs (validated against the v47 baseline).
// Set membership, exclusion rulings, and evidence counts are carried from v47 and
// re-verified against the live Ticket Ops read.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const R = JSON.parse(readFileSync('/tmp/v48.json', 'utf8'));
const REFRESH_AT = '2026-09-20T02:28:00-04:00';
const REFRESH_ID = 'refresh-2026-09-20T02:28:00-04:00-AUTHORITATIVE-v48';

// ---- tickets.json: same eligible set, ages recomputed at the new reference time ----
const tickets = JSON.parse(readFileSync('dashboard/data/tickets.json', 'utf8'));
const refMs = new Date(REFRESH_AT).getTime();
const aged = tickets.map((t) => {
  const h = Math.max(0, (refMs - new Date(t.createdAt).getTime()) / 36e5);
  return { ...t, ageHours: Math.floor(h), ageDays: Math.floor(h / 24) };
});
writeFileSync('dashboard/data/tickets.json', JSON.stringify(aged, null, 2) + '\n');

// ---- refresh-manifest.json ----
const manifest = JSON.parse(readFileSync('dashboard/data/refresh-manifest.json', 'utf8'));
manifest.refresh = {
  id: REFRESH_ID,
  timestamp: REFRESH_AT,
  type: 'AUTHORITATIVE',
  previousRefreshId: 'refresh-2026-09-19T14:26:00-04:00-AUTHORITATIVE-v47',
  status: 'complete',
  keyChange:
    '344 system-open rows (236 New / 70 Pending / 38 Reopen) and the 306-row New/Pending UFN gate are unchanged from v47; ' +
    'eligible conversations remain 277 (216 New / 61 Pending) after 24 billing-family and 5 conversation-identity exclusions. ' +
    'All age-derived sections were recomputed at the new reference time.',
};
manifest.dataSources[0].rawCapture = 'scripts/gate-live-2026-09-20-v48.tsv';
manifest.dataSources[0].note =
  'Live read paged to exhaustion at 2026-09-20T06:28:00Z; data.total = 344 open-system rows (236 New / 70 Pending / 38 Reopen). ' +
  'The 306 New/Pending gate rows are unchanged from the v47 capture.';
manifest.dataSources[1].note =
  'No Outlook read was possible this cycle either (the delegated-mailbox read returned no result); ' +
  'the last observed v42 values are retained for context only and were not re-verified. Outlook remains non-blocking.';

manifest.developerNotes = [
  'v48 live read: 344 open-system rows = 236 New / 70 Pending / 38 Reopen; exact UFN New/Pending gate 306 (unchanged from v47).',
  'Gate movement: 0 arrivals / 0 departures. The eligible UFN New/Pending set is identical to v47.',
  'Raw movement outside the gate: the open-system bucket contracted 345 -> 344 because one Reopen row left the open bucket; Reopen is outside the New/Pending gate and was already excluded.',
  'Eligible set unchanged: 277 conversations (216 New / 61 Pending); 24 billing-family + 5 conversation-identity exclusions stand.',
  'Age-derived sections recomputed at the v48 reference time: SLA breach 234 / current 43 (unchanged); action buckets moved to Immediate 6 / Short-Term 35 / Medium-Term 29 / Watch 207; Customer Health tiers moved to 89 Critical / 34 Warning / 0 Healthy across the same 123 customer labels.',
  '24 closeFlag=true rows remain eligible. closeFlag was never used as a gate.',
  'UFN-67030 re-checked directly against Ticket Ops this cycle: displayStatusName "Solved" with displayStatusSystemStatus 20 and closedTime 09/01/2026. It is outside the open bucket entirely and is excluded on authoritative status, not on closeFlag. The citation sometimes given as "live-Pending with closeFlag=true" is stale.',
  'Customer Health covers all 123 customer labels visible on the 277 eligible live records; roster and aliases remain supplemental only.',
  'Outlook was unavailable again this cycle (the delegated-mailbox read returned no result); the v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale. They were not used in any ticket, queue, bucket, health or SLA metric.',
];

manifest.dashboardState = {
  totalRaw: 344,
  totalRawDepartmentWide: 344,
  eligibleBeforeExclusions: 306,
  reopenExcluded: 38,
  billingExcluded: 24,
  eligibleBeforeDeduplication: 282,
  duplicatesRemoved: 5,
  totalEligible: 277,
  closeFlagTrueRetained: 24,
  byStatus: R.counts.byStatus,
  byPriority: R.counts.byPriority,
  workload: R.workload,
  actionBuckets: R.actionBuckets,
  customerHealth: {
    totalCustomers: R.customerHealth.totalCustomers,
    tiers: R.customerHealth.tiers,
    tierRule: manifest.dashboardState.customerHealth.tierRule,
    customers: R.customerHealth.customers,
  },
  priorityQueue: R.priorityQueue,
  evidenceMetrics: {
    totalEligible: 277,
    slaBreached: R.evidenceMetrics.slaBreached,
    slaOnTrack: R.evidenceMetrics.slaOnTrack,
    unassigned: R.evidenceMetrics.unassigned,
    oldestAgeDays: R.evidenceMetrics.oldestAgeDays,
    outlookStatus: 'unavailable',
    outlookThreadsMatched: 25,
    outlookDistinctThreads: 9,
    outlookThreadsLinkedToEligibleTickets: 3,
    outlookStale: true,
    outlookLastObservedUtc: '2026-09-14T21:46:00Z',
    invoiceItemsExcluded: 24,
    duplicatesRemoved: 5,
    closeFlagTrueRetained: 24,
    arrivalsThisCycle: 0,
    departuresThisCycle: 0,
  },
};
manifest.reconciliation = {
  gate: { total: 306, New: 236, Pending: 70 },
  openSystemBucket: 344,
  Reopen: 38,
  billingExcluded: 24,
  duplicateConversationsExcluded: 5,
  eligibleConversations: 277,
  closeFlagTrueGate: 25,
  closeFlagTrueEligible: 24,
  gateArrivals: [],
  gateDepartures: [],
  eligibleArrivals: [],
  eligibleDepartures: [],
  note: 'No gate or eligible movement this cycle; the only open-system change was one Reopen row leaving the bucket (345 -> 344).',
};
manifest.verifiedAgainst = 'Live Ticket Ops read 2026-09-20T06:28:00Z (department 323826714354839552, displayStatusSystemStatus=10)';
manifest.nextScheduledRefresh = '2026-09-20T08:00:00-04:00';
writeFileSync('dashboard/data/refresh-manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// ---- config.json snapshot metrics ----
const config = JSON.parse(readFileSync('config.json', 'utf8'));
config.snapshotMetrics = {
  refreshId: REFRESH_ID,
  refreshedAt: REFRESH_AT,
  totalRaw: 344,
  totalGateRows: 306,
  totalEligible: 277,
  excludedCount: 29,
  duplicatesRemoved: 5,
  invoiceItemsExcluded: 24,
  closeFlagTrueRetained: 24,
  arrivalsThisCycle: 0,
  departuresThisCycle: 0,
  outlookStatus: 'unavailable',
  outlookThreadsMatched: 25,
};
config.outlook = { integration: 'non_blocking', useWhenAvailable: true, status: 'unavailable', lastObservedUtc: '2026-09-14T21:46:00Z', stale: true };
writeFileSync('config.json', JSON.stringify(config, null, 2) + '\n');

// ---- public/ mirrors ----
copyFileSync('dashboard/data/tickets.json', 'public/data/tickets.json');
copyFileSync('dashboard/data/refresh-manifest.json', 'public/data/refresh-manifest.json');
copyFileSync('dashboard/data/outlook-context.json', 'public/data/outlook-context.json');

console.log('v48 artifacts written.');

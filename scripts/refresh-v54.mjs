#!/usr/bin/env node
// v54 refresh for the NHT/Cesanek Customer Command Center dashboard.
//
// Authoritative inputs (live Ticket Ops read 2026-09-21T04:06Z, department 323826714354839552,
// displayStatusSystemStatus=10, paged to exhaustion):
//   open-system bucket 349 = 241 New / 70 Pending / 38 Reopen   (identical to v53)
//   New+Pending gate 311 rows                                   (identical to v53: 0 arrivals / 0 departures)
//   billing-family exclusions 24, overlap losers 6              (re-verified present in the gate)
//   => eligible 281 (220 New / 61 Pending)                      (unchanged)
//
// closeFlag is NOT an eligibility gate. 25 gate rows carry closeFlag=true (24 of them eligible;
// UFN-65196 is billing-excluded) and every one is a live Pending row on a system-OPEN ticket.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REFERENCE = argOf('--reference') || '2026-09-21T00:06:00-04:00';
const WRITE = args.includes('--write');

const VERSION = 'v54';
const REFRESH_ID = `refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID = 'refresh-2026-09-20T22:30:00-04:00-AUTHORITATIVE-v53';
const REFERENCE_TIME_ET = 'Sep 21 12:06 AM ET';
const DEPARTMENT_ID = '323826714354839552';
const READ_TIMESTAMP_UTC = '2026-09-21T04:06:00Z';

const OPEN_BUCKET = 349;
const OPEN_NEW = 241;
const OPEN_PENDING = 70;
const OPEN_REOPEN = 38;
const GATE_TOTAL = 311;
const GATE_CLOSEFLAG_TRUE = 25;

const BILLING = [
  'UFN-33719', 'UFN-40670', 'UFN-41484', 'UFN-43725', 'UFN-45559', 'UFN-48436',
  'UFN-53491', 'UFN-54721', 'UFN-55641', 'UFN-59971', 'UFN-60573', 'UFN-61451',
  'UFN-62682', 'UFN-63762', 'UFN-63959', 'UFN-65196', 'UFN-68749', 'UFN-69234',
  'UFN-70140', 'UFN-70947', 'UFN-70948', 'UFN-70950', 'UFN-70952', 'UFN-71039',
];
const DUPLICATE_LOSERS = ['UFN-69447', 'UFN-69450', 'UFN-69661', 'UFN-69663', 'UFN-70352', 'UFN-71127'];

const refMs = new Date(REFERENCE).getTime();
if (!Number.isFinite(refMs)) throw new Error(`bad reference: ${REFERENCE}`);
const hoursSince = (iso) => (refMs - new Date(iso).getTime()) / 36e5;
const j = (v) => `${JSON.stringify(v, null, 2)}\n`;

/* 0. gate identity guard: the v54 gate must be set-identical to the persisted v53 capture */
const previous = JSON.parse(readFileSync('dashboard/data/tickets.json', 'utf8'));
const previousManifest = JSON.parse(readFileSync('dashboard/data/refresh-manifest.json', 'utf8'));
const gate = readFileSync('scripts/gate-live-2026-09-21-v54.txt', 'utf8').trim().split(/\s+/);
const gateSet = new Set(gate);
if (gate.length !== GATE_TOTAL || gateSet.size !== GATE_TOTAL) {
  throw new Error(`gate capture must hold ${GATE_TOTAL} unique rows, got ${gate.length}/${gateSet.size}`);
}
const prevGate = readFileSync('scripts/gate-live-2026-09-21-v53.txt', 'utf8').trim().split(/\s+/);
if (prevGate.length !== GATE_TOTAL) throw new Error(`v53 gate capture must hold ${GATE_TOTAL} rows, got ${prevGate.length}`);
const prevGateSet = new Set(prevGate);
const arrivals = gate.filter((id) => !prevGateSet.has(id)).sort();
const departures = prevGate.filter((id) => !gateSet.has(id)).sort();
if (arrivals.length) throw new Error(`unexpected gate arrivals: [${arrivals.join(',')}]`);
if (departures.length) throw new Error(`unexpected gate departures: [${departures.join(',')}]`);
const missingBilling = BILLING.filter((id) => !gateSet.has(id));
const missingDupes = DUPLICATE_LOSERS.filter((id) => !gateSet.has(id));
if (missingBilling.length) throw new Error(`billing rows no longer in gate: [${missingBilling.join(',')}]`);
if (missingDupes.length) throw new Error(`overlap losers no longer in gate: [${missingDupes.join(',')}]`);
// UFN-35588 is retained as a standing guard: the v53 cycle found it missing from a manual transcription
// while a live brief read confirmed it Pending / systemStatus 10, so the row never left the gate. It must
// be present in every capture or the gate is treated as broken.
if (!gateSet.has('UFN-35588')) throw new Error('UFN-35588 must be present in the gate (confirmed live Pending / open)');
console.log(`gate identity OK: ${GATE_TOTAL} rows, 0 arrivals / 0 departures vs v53`);

/* 1. eligible rows = carried set (unchanged membership), ages recomputed at the new reference */
const tickets = previous
  .filter((t) => gateSet.has(t.ticketId))
  .map((t) => {
    const h = Math.max(0, hoursSince(t.createdAt));
    return { ...t, ageHours: Math.floor(h), ageDays: Math.floor(h / 24) };
  })
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const total = tickets.length;
if (total !== 281) throw new Error(`expected 281 eligible conversations, got ${total}`);
const byStatus = {
  New: tickets.filter((t) => t.displayStatusName === 'New').length,
  Open: tickets.filter((t) => t.displayStatusName === 'Open').length,
  Pending: tickets.filter((t) => t.displayStatusName === 'Pending').length,
};
if (byStatus.New !== 220 || byStatus.Pending !== 61) {
  throw new Error(`eligible split must be 220 New / 61 Pending, got ${byStatus.New}/${byStatus.Pending}`);
}
const byPriority = tickets.reduce((acc, t) => {
  const k = t.priority || 'unavailable';
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
const breachedList = tickets.filter(
  (t) => t.isSlaBreached || t.isOverdue || /breach/i.test(t.slaStatus || ''),
);
const onTrack = tickets.filter((t) => !breachedList.includes(t));
const dueDerivedBreached = tickets.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < refMs).length;

const priorityQueue = [...tickets]
  .sort(
    (a, b) =>
      Number(breachedList.includes(b)) - Number(breachedList.includes(a)) ||
      String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')) ||
      b.ageHours - a.ageHours,
  )
  .slice(0, 15)
  .map((t) => ({
    ticketId: t.ticketId,
    customer: t.customer,
    subject: t.subject,
    ageDays: t.ageDays,
    ageHours: t.ageHours,
    slaStatus: breachedList.includes(t) ? 'Breached' : 'On Track',
  }));

const bucketOf = (h) => (h < 24 ? 'Immediate' : h < 72 ? 'Short-Term' : h < 168 ? 'Medium-Term' : 'Watch');
const actionBuckets = { Immediate: 0, 'Short-Term': 0, 'Medium-Term': 0, Watch: 0 };
for (const t of tickets) actionBuckets[bucketOf(t.ageHours)] += 1;

const byCustomer = new Map();
for (const t of tickets) {
  const name = t.customer || t.customerEmail || 'Unknown';
  const row = byCustomer.get(name) || { tickets: 0, breached: 0, oldestBreachedAgeDays: 0, olderThan7d: 0 };
  row.tickets += 1;
  if (breachedList.includes(t)) {
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
  customers[name] = { tickets: row.tickets, breached: row.breached, oldestBreachedAgeDays: row.oldestBreachedAgeDays, tier };
}
const sortedCustomers = Object.fromEntries(
  Object.entries(customers).sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0])),
);
if (tiers.Healthy !== 0) throw new Error(`Healthy should be structurally unreachable, got ${tiers.Healthy}`);

const closeFlagTrueRetained = tickets.filter((t) => t.closeFlag === true).length;
if (closeFlagTrueRetained !== 24) throw new Error(`expected 24 eligible closeFlag=true rows, got ${closeFlagTrueRetained}`);
const unassigned = tickets.filter((t) => /unassigned/i.test(t.assigned || '')).length;
const oldestAgeDays = tickets.reduce((m, t) => Math.max(m, t.ageDays), 0);

const outlook = {
  status: 'unavailable',
  threadsMatched: 25,
  distinctThreads: 9,
  threadsLinkedToEligibleTickets: 3,
  stale: true,
  lastObservedUtc: '2026-09-14T21:46:00Z',
};

const summary = {
  reference: REFERENCE,
  counts: { totalEligible: total, byStatus, byPriority },
  workload: { overdueOrSlaBreached: breachedList.length, current: onTrack.length, dueDerivedBreached },
  actionBuckets,
  customerHealth: { totalCustomers: byCustomer.size, tiers },
  evidenceMetrics: { slaBreached: breachedList.length, slaOnTrack: onTrack.length, unassigned, oldestAgeDays, closeFlagTrueRetained },
};
console.log('COMPUTED', JSON.stringify(summary, null, 2));
if (!WRITE) { console.log('\n(dry run - pass --write to update artifacts)'); process.exit(0); }

/* 2. tickets.json */
writeFileSync('dashboard/data/tickets.json', j(tickets));
copyFileSync('dashboard/data/tickets.json', 'public/data/tickets.json');

/* 3. refresh-manifest.json */
const manifest = previousManifest;
manifest.refresh = {
  id: REFRESH_ID,
  timestamp: REFERENCE,
  type: 'AUTHORITATIVE',
  previousRefreshId: PREVIOUS_REFRESH_ID,
  status: 'complete',
  keyChange:
    `No movement. The live Ticket Ops read returns the same ${OPEN_BUCKET} system-open rows ` +
    `(${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and the same ${GATE_TOTAL}-row New/Pending gate as v53. ` +
    `Eligible conversations are unchanged at ${total} (${byStatus.New} New / ${byStatus.Pending} Pending); 0 arrivals / 0 departures. ` +
    `closeFlag is not a gate (${closeFlagTrueRetained} live closeFlag=true rows retained). ` +
    `Outlook unavailable (non-blocking); the last observed values are carried forward and marked stale.`,
};
manifest.dataSources = [
  {
    name: 'Ticket Ops',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: 1, size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] } },
    rawCapture: 'scripts/gate-live-2026-09-21-v54.txt (all 311 gate ticket numbers, set-identical to the persisted v53 capture)',
    note:
      `Authoritative live read at ${READ_TIMESTAMP_UTC}: data.total = ${OPEN_BUCKET} open-system rows = ` +
      `${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. The ${GATE_TOTAL}-row New/Pending gate is set-identical ` +
      `to the persisted v53 capture - 0 arrivals, 0 departures.`,
  },
  {
    name: 'Outlook',
    note:
      'Outlook was unavailable again this cycle (the delegated-mailbox read returned no result). The last observed v42 values (25 messages / 9 distinct threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale. Outlook remains non-blocking.',
  },
];
manifest.developerNotes = [
  `v54 live read: ${OPEN_BUCKET} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; exact UFN New/Pending gate ${GATE_TOTAL} (no movement vs v53).`,
  `Movement is verified, not asserted: the ${GATE_TOTAL} gate rows are set-compared against the persisted v53 capture (scripts/gate-live-2026-09-21-v53.txt). Exactly 0 arrivals and 0 departures; refresh-v54.mjs aborts on any diff.`,
  `The gate was independently corroborated this cycle, not taken on trust. The coordinator's own live page-1 read (the 200 newest system-open rows) returned the same newest ticket (UFN-71236, created 2026-09-20T16:01:37 local), the same ordering, and the same Reopen membership for all 20 page-1 Reopen rows (UFN-71130 ... UFN-66334) as the delegated read.`,
  `No new ticket entered the department: the newest row in the live read is still UFN-71236, the same newest arrival as v53, and page 1 returns the identical newest-200 rows.`,
  `Billing-family exclusions unchanged at 24 live rows and re-verified present in the gate; the 6 CASE/DN overlap losers are also still present. UFN-40670 / UFN-53491 (Diageo "F26 Month End Close Reminder" finance cutoffs) stay excluded; UFN-71112 ("RE: bills"), UFN-71232 ("RE: Missing Bill") and UFN-60009 ("BOL Request - FW: Amazon Invoice") remain operational document requests and stay eligible.`,
  `${closeFlagTrueRetained} of the ${GATE_CLOSEFLAG_TRUE} gate-wide closeFlag=true rows remain eligible (UFN-65196 is billing-excluded); all ${GATE_CLOSEFLAG_TRUE} are live Pending rows on system-OPEN tickets. closeFlag is evidence only and was never used as a gate.`,
  `STATUS-PREMISE CONFLICT, disclosed rather than applied: this refresh request restated that "UFN-67030 is live-Pending with closeFlag=true". The authoritative Ticket Ops read does not support that. UFN-67030 returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), displayStatusId 2 - it is closed, does carry closeFlag true, and is not returned by the displayStatusSystemStatus=[10] query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New, Pending}; closeFlag never a gate) is already exactly what the dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS. It must not be re-described as live-Pending, and it is NOT the correct closeFlag counter-evidence. The correct counter-evidence is the ${closeFlagTrueRetained} eligible live closeFlag=true Pending rows.`,
  `Overlap re-verification: all 6 prior CASE/DN removals (UFN-69447/69450 -> UFN-69307 CASE-21836552091; UFN-69661/69663 -> UFN-69511 CASE-21861000021; UFN-70352 -> UFN-70351 DN-2107462; UFN-71127 -> UFN-71073 DN-2131002) are present in the gate and no NEW source-backed CASE/DN overlap arrived. Subject-only lookalikes remain separate rows by rule.`,
  `Priority and assignee fields were NOT re-derived from this read: the page response reports priorityName "Medium" on every row, which conflicts with the stored 277 Medium / 4 unavailable split, and the live page response omits staffName on many rows that the stored snapshot shows as assigned. Stored per-ticket values are retained and the conflict is disclosed. (The 4 non-Medium rows are UFN-71152, UFN-70261, UFN-70161, UFN-68573.)`,
  `SLA/workload: rows retain their stored isSlaBreached/isOverdue flags (v53 methodology, no arrivals this cycle). A dueDate-derived cross-check flags ${dueDerivedBreached} rows as past due vs ${breachedList.length} on stored flags - disclosed, not silently substituted.`,
  `Age-derived sections recomputed at the v54 reference time (${REFERENCE}): action buckets, Customer Health tiers, priority queue and SLA counts are shown in dashboardState below.`,
  `Customer Health covers all ${byCustomer.size} customer labels visible on the ${total} eligible live records (unchanged); roster and aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.`,
  `Outlook was unavailable again this cycle; the last observed values are carried forward, labelled stale, and were not used in any ticket, queue, bucket, health or SLA metric.`,
];
manifest.dashboardState = {
  totalRaw: OPEN_BUCKET,
  totalRawDepartmentWide: OPEN_BUCKET,
  eligibleBeforeExclusions: GATE_TOTAL,
  reopenExcluded: OPEN_REOPEN,
  billingExcluded: BILLING.length,
  eligibleBeforeDeduplication: GATE_TOTAL - BILLING.length,
  duplicatesRemoved: DUPLICATE_LOSERS.length,
  totalEligible: total,
  closeFlagTrueRetained,
  byStatus,
  byPriority,
  workload: summary.workload,
  actionBuckets,
  customerHealth: {
    totalCustomers: byCustomer.size,
    tiers,
    tierRule: previousManifest.dashboardState.customerHealth.tierRule,
    customers: sortedCustomers,
  },
  priorityQueue,
  evidenceMetrics: {
    totalEligible: total,
    slaBreached: breachedList.length,
    slaOnTrack: onTrack.length,
    unassigned,
    oldestAgeDays,
    outlookStatus: outlook.status,
    outlookThreadsMatched: outlook.threadsMatched,
    outlookDistinctThreads: outlook.distinctThreads,
    outlookThreadsLinkedToEligibleTickets: outlook.threadsLinkedToEligibleTickets,
    outlookStale: outlook.stale,
    outlookLastObservedUtc: outlook.lastObservedUtc,
    invoiceItemsExcluded: BILLING.length,
    duplicatesRemoved: DUPLICATE_LOSERS.length,
    closeFlagTrueRetained,
    arrivalsThisCycle: 0,
    departuresThisCycle: 0,
  },
};
manifest.excludedThisCycle = {
  reopenByStatusName: OPEN_REOPEN,
  billingFamily: BILLING,
  duplicateConversations: DUPLICATE_LOSERS,
};
manifest.reconciliation = {
  gate: { total: GATE_TOTAL, New: OPEN_NEW, Pending: OPEN_PENDING },
  openSystemBucket: OPEN_BUCKET,
  Reopen: OPEN_REOPEN,
  billingExcluded: BILLING.length,
  duplicateConversationsExcluded: DUPLICATE_LOSERS.length,
  eligibleConversations: total,
  closeFlagTrueGate: GATE_CLOSEFLAG_TRUE,
  closeFlagTrueEligible: closeFlagTrueRetained,
  gateArrivals: [],
  gateDepartures: [],
  eligibleArrivals: [],
  eligibleDepartures: [],
  note:
    `Verified against the persisted v53 capture: the ${GATE_TOTAL}-row gate is set-identical, so the eligible set stays at ${total}.`,
};
manifest.verifiedAgainst = `Live Ticket Ops read ${READ_TIMESTAMP_UTC} (department ${DEPARTMENT_ID}, displayStatusSystemStatus=10), set-verified against scripts/gate-live-2026-09-21-v54.txt and the v53 capture`;
manifest.nextScheduledRefresh = '2026-09-21T08:00:00-04:00';
writeFileSync('dashboard/data/refresh-manifest.json', j(manifest));
copyFileSync('dashboard/data/refresh-manifest.json', 'public/data/refresh-manifest.json');

/* 4. config.json - every served copy, identical */
const snapshotMetrics = {
  refreshId: REFRESH_ID,
  refreshedAt: REFERENCE,
  totalRaw: OPEN_BUCKET,
  totalGateRows: GATE_TOTAL,
  totalEligible: total,
  excludedCount: BILLING.length + DUPLICATE_LOSERS.length,
  duplicatesRemoved: DUPLICATE_LOSERS.length,
  invoiceItemsExcluded: BILLING.length,
  closeFlagTrueRetained,
  arrivalsThisCycle: 0,
  departuresThisCycle: 0,
  outlookStatus: outlook.status,
  outlookThreadsMatched: outlook.threadsMatched,
  version: VERSION,
};
for (const p of ['config.json', 'dashboard/config.json', 'public/config.json']) {
  const cfg = JSON.parse(readFileSync(p, 'utf8'));
  cfg.snapshotMetrics = snapshotMetrics;
  cfg.outlook = {
    integration: 'non_blocking',
    useWhenAvailable: true,
    status: outlook.status,
    lastObservedUtc: outlook.lastObservedUtc,
    stale: true,
  };
  writeFileSync(p, j(cfg));
}

/* 5. outlook-context.json - non-blocking, still unavailable */
const outlookContext = JSON.parse(readFileSync('dashboard/data/outlook-context.json', 'utf8'));
outlookContext.generatedAt = REFERENCE;
outlookContext.lastRefreshed = REFERENCE;
outlookContext.staleness = {
  reason:
    'No Outlook read was possible this cycle (the delegated-mailbox read returned no result); the last observed v42 values are retained for context only and were not re-verified.',
  lastObservedUtc: outlook.lastObservedUtc,
  lastObservedCycle: 'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42',
};
outlookContext.coverage = {
  eligibleTicketsTotal: total,
  eligibleTicketsWithOutlookContext: outlook.threadsLinkedToEligibleTickets,
  coveragePct: Number(((outlook.threadsLinkedToEligibleTickets / total) * 100).toFixed(2)),
  note:
    `Stale context only. ${outlook.threadsLinkedToEligibleTickets} of ${outlook.distinctThreads} last-observed threads link to an eligible Ticket Ops conversation; no Outlook read was performed this cycle.`,
};
if (outlookContext.thisCycleRead) {
  outlookContext.thisCycleRead.note =
    'No Outlook read was possible this cycle. Values shown elsewhere are the last observed v42 context and are marked stale.';
}
writeFileSync('dashboard/data/outlook-context.json', j(outlookContext));
copyFileSync('dashboard/data/outlook-context.json', 'public/data/outlook-context.json');

/* 6. structured_list.json (evidence surface) */
const structured = {
  dashboard: 'Customer Command Center Dashboard',
  facility: { code: 'LT_F21', name: 'NHT/Cesanek', tenant: 'LT', timezone: 'America/New_York' },
  lastRefreshed: REFERENCE,
  dataSource: 'Ticket Ops (authoritative); Outlook unavailable this cycle (last observed values stale)',
  refreshType: 'AUTHORITATIVE',
  refreshId: REFRESH_ID,
  version: VERSION,
  totalRaw: OPEN_BUCKET,
  eligibleBeforeExclusions: GATE_TOTAL,
  eligibleBeforeDeduplication: GATE_TOTAL - BILLING.length,
  totalEligible: total,
  newCount: byStatus.New,
  openCount: byStatus.Open,
  pendingCount: byStatus.Pending,
  exclusionSummary: { reopen: OPEN_REOPEN, billingFamily: BILLING.length, overlappingConversations: DUPLICATE_LOSERS.length },
  closeFlagTrueRetained,
  closeFlagTrueGate: GATE_CLOSEFLAG_TRUE,
  slaHealth: { breached: breachedList.length, onTrack: onTrack.length, unassigned },
  actionBuckets,
  evidenceMetrics: manifest.dashboardState.evidenceMetrics,
  outlook: {
    status: outlook.status,
    stale: true,
    messagesRetrieved: outlook.threadsMatched,
    distinctThreads: outlook.distinctThreads,
    threadsLinkedToEligibleTickets: outlook.threadsLinkedToEligibleTickets,
    lastObservedUtc: outlook.lastObservedUtc,
  },
  customers: { total: byCustomer.size, tiers, tierRule: previousManifest.dashboardState.customerHealth.tierRule },
  excludedCount: BILLING.length + DUPLICATE_LOSERS.length,
  duplicatesRemoved: DUPLICATE_LOSERS.length,
  invoiceItemsExcluded: BILLING.length,
  customerCount: byCustomer.size,
  customerHealthTiers: tiers,
  slaBreached: breachedList.length,
  slaOnTrack: onTrack.length,
  unassigned,
  oldestAgeDays,
  outlookStatus: outlook.status,
  outlookThreadsMatched: outlook.threadsMatched,
  outlookThreadsLinkedToEligibleTickets: outlook.threadsLinkedToEligibleTickets,
  arrivalsThisCycle: 0,
  departuresThisCycle: 0,
  outlookDistinctThreads: outlook.distinctThreads,
};
writeFileSync('public/data/structured_list.json', j(structured));

/* 7. README state + reconciliation */
let readme = readFileSync('README.md', 'utf8');
const tierText = `${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const stateSection = `## Current Dashboard State (Last Refresh: ${REFERENCE_TIME_ET} - AUTHORITATIVE v54)

| Metric | Value |
|--------|-------|
| Total Raw (system-open UFN, department scope) | **${OPEN_BUCKET}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate **${GATE_TOTAL}** |
| Eligible | **${total}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) - 0 arrivals / 0 departures vs v53 | 
| Excluded | 30 = 24 billing-family + 6 overlapping conversations; ${OPEN_REOPEN} Reopen rows outside the gate |
| Eligible arrivals | **0** |
| Eligible departures | **0** |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained (${GATE_CLOSEFLAG_TRUE} gate-wide; UFN-65196 is billing-excluded) |
| Customers | **${byCustomer.size}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable |
| SLA Risk | **ELEVATED** - ${breachedList.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |
| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |
| Last Refresh | ${REFERENCE} (**AUTHORITATIVE v54**, department ${DEPARTMENT_ID}) |

`;
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);

const reconciliationNote = `### v53 -> v54 (Sep 20 10:30 PM ET -> ${REFERENCE_TIME_ET})

- **Net movement: 0 eligible conversations.** The live Ticket Ops read returns the same ${OPEN_BUCKET} system-open rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and the same ${GATE_TOTAL}-row New/Pending gate as v53. The eligible set is unchanged at **${total}** (${byStatus.New} New / ${byStatus.Pending} Pending). Nothing arrived and nothing departed.
- **Movement is verified, not asserted.** The ${GATE_TOTAL}-row gate was captured to scripts/gate-live-2026-09-21-v54.txt and set-compared against the persisted v53 capture: exact set identity, 0 arrivals / 0 departures. scripts/refresh-v54.mjs aborts on any diff.
- **The gate was independently corroborated.** The coordinator's own live page-1 read (200 newest system-open rows) matched the delegated read row for row: same newest ticket (UFN-71236), same ordering, and the same Reopen membership for all 20 page-1 Reopen rows (UFN-71130 ... UFN-66334).
- **No new ticket entered the department.** The newest row in the live read is still UFN-71236 (created 2026-09-20 16:01 local), the same newest arrival as v53.
- **closeFlag is still not a gate.** ${closeFlagTrueRetained} of the ${GATE_CLOSEFLAG_TRUE} gate-wide closeFlag=true rows are eligible (UFN-65196 is billing-excluded) and every one is a live Pending row on a system-OPEN ticket.
- **One status premise in the request did not hold, and is disclosed rather than applied.** The instruction that "UFN-67030 is live-Pending with closeFlag=true" is not supported by the authoritative read: UFN-67030 is "Solved" / displayStatusSystemStatus 20 (CLOSED) / closeFlag true, and is not returned by the displayStatusSystemStatus=[10] query. The rule the request asks for - authoritative gate on displayStatusSystemStatus=open + displayStatusName in {New, Pending}, with closeFlag never an eligibility gate - is already exactly what this dashboard implements, so no eligibility change was made and UFN-67030 stays out on authoritative status. The real closeFlag counter-evidence is the ${closeFlagTrueRetained} eligible live closeFlag=true Pending rows.
- **Exclusions unchanged.** 24 billing-family rows and 6 overlap losers are all still present in the gate; no new billing-family or source-backed CASE/DN overlap arrived.
- **Age-derived sections recomputed** at ${REFERENCE}: SLA ${breachedList.length} breached / ${onTrack.length} current; buckets Immediate ${actionBuckets.Immediate} / Short-Term ${actionBuckets['Short-Term']} / Medium-Term ${actionBuckets['Medium-Term']} / Watch ${actionBuckets.Watch}; Customer Health ${tierText} across ${byCustomer.size} customer labels.
- **Customer Health matches the rendered rule.** Every customer visible in the eligible live tickets is covered; roster/aliases remain supplemental, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook was unavailable again this cycle** (the delegated read returned no result). The last observed v42 values are carried forward, labelled stale, and no operational metric depends on them.

`;
if (!readme.includes('### v53 -> v54 (')) {
  readme = readme.replace('## Developer Reconciliation Note\n\n', `## Developer Reconciliation Note\n\n${reconciliationNote}`);
}
writeFileSync('README.md', readme);

console.log(`\nWROTE v54 artifacts: tickets.json, refresh-manifest.json, config.json (x3), outlook-context.json (x2), structured_list.json, README.md`);

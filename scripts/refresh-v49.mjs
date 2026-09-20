#!/usr/bin/env node
// v49 refresh for the NHT/Cesanek Customer Command Center dashboard.
//
// Authoritative inputs (coordinator + ticket-ops-agent live read, 2026-09-20T10:04-10:08Z,
// department 323826714354839552, displayStatusSystemStatus=10):
//   open-system bucket 344 = 236 New / 70 Pending / 38 Reopen
//   New+Pending gate 306
//   billing-family exclusions 24 (unchanged, matches v48 exactly)
//   overlap losers 6  (v48's 5 + the newly confirmed DN-2131002 duplicate UFN-71127)
//   => eligible 276 (215 New / 61 Pending)
//
// The only set delta vs v48 is the removal of UFN-71127 (duplicate of UFN-71073,
// conversation DN-2131002). Age-derived sections are recomputed at the new
// reference time. Writes every served copy (identical), because the previous
// cycle left public/config.json and dashboard/config.json stale at v47.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REFERENCE = argOf('--reference') || '2026-09-20T06:15:00-04:00';
const WRITE = args.includes('--write');

const VERSION = 'v49';
const REFRESH_ID = `refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID = 'refresh-2026-09-20T02:28:00-04:00-AUTHORITATIVE-v48';
const REFERENCE_TIME_ET = 'Sep 20 6:15 AM ET';
const DEPARTMENT_ID = '323826714354839552';

const OPEN_BUCKET = 344;
const OPEN_NEW = 236;
const OPEN_PENDING = 70;
const OPEN_REOPEN = 38;
const GATE_TOTAL = 306;
const BILLING = [
  'UFN-33719', 'UFN-40670', 'UFN-41484', 'UFN-43725', 'UFN-45559', 'UFN-48436',
  'UFN-53491', 'UFN-54721', 'UFN-55641', 'UFN-59971', 'UFN-60573', 'UFN-61451',
  'UFN-62682', 'UFN-63762', 'UFN-63959', 'UFN-65196', 'UFN-68749', 'UFN-69234',
  'UFN-70140', 'UFN-70947', 'UFN-70948', 'UFN-70950', 'UFN-70952', 'UFN-71039',
];
const DUPLICATE_LOSERS = ['UFN-69447', 'UFN-69450', 'UFN-69661', 'UFN-69663', 'UFN-70352', 'UFN-71127'];
const NEW_DUPLICATE = {
  ticketId: 'UFN-71127',
  canonical: 'UFN-71073',
  conversationId: 'DN-2131002',
  reason:
    'excluded as an overlapping DN conversation; UFN-71127 quotes UFN-71073 verbatim (same DN-2131002 load conversation, same author/recipient) and UFN-71073 is the earliest surviving row',
};

const refMs = new Date(REFERENCE).getTime();
if (!Number.isFinite(refMs)) throw new Error(`bad reference: ${REFERENCE}`);
const hoursSince = (iso) => (refMs - new Date(iso).getTime()) / 36e5;
const j = (v) => `${JSON.stringify(v, null, 2)}\n`;

/* ── 1. eligible rows = v48 set − UFN-71127, ages recomputed ─────────────── */
const previous = JSON.parse(readFileSync('dashboard/data/tickets.json', 'utf8'));
const previousManifest = JSON.parse(readFileSync('dashboard/data/refresh-manifest.json', 'utf8'));
const removed = previous.filter((t) => t.ticketId === 'UFN-71127');
if (removed.length !== 1) throw new Error(`expected exactly one UFN-71127 in the v48 set, found ${removed.length}`);
// v48 stored UFN-71127 with a null conversationId (the "RE: DN-2131002" title was never
// normalised), which is exactly why this overlap was carried as two separate rows.
if (!/DN-?2131002/i.test(removed[0].subject || '')) {
  throw new Error(`UFN-71127 subject no longer references DN-2131002: ${removed[0].subject}`);
}

const tickets = previous
  .filter((t) => t.ticketId !== 'UFN-71127')
  .map((t) => {
    const h = Math.max(0, hoursSince(t.createdAt));
    return { ...t, ageHours: Math.floor(h), ageDays: Math.floor(h / 24) };
  })
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const total = tickets.length;
const byStatus = {
  New: tickets.filter((t) => t.displayStatusName === 'New').length,
  Open: tickets.filter((t) => t.displayStatusName === 'Open').length,
  Pending: tickets.filter((t) => t.displayStatusName === 'Pending').length,
};
const byPriority = tickets.reduce((acc, t) => {
  const k = t.priority || 'unavailable';
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
const breachedList = tickets.filter(
  (t) => t.isSlaBreached || t.isOverdue || /breach/i.test(t.slaStatus || ''),
);
const onTrack = tickets.filter((t) => !breachedList.includes(t));

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
// every eligible ticket is UFN-tagged, so Healthy is structurally unreachable
if (tiers.Healthy !== 0) throw new Error(`Healthy should be structurally unreachable, got ${tiers.Healthy}`);

const closeFlagTrueRetained = tickets.filter((t) => t.closeFlag === true).length;
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
  workload: { overdueOrSlaBreached: breachedList.length, current: onTrack.length },
  actionBuckets,
  customerHealth: { totalCustomers: byCustomer.size, tiers },
  evidenceMetrics: { slaBreached: breachedList.length, slaOnTrack: onTrack.length, unassigned, oldestAgeDays, closeFlagTrueRetained },
};
console.log('COMPUTED', JSON.stringify(summary, null, 2));
if (!WRITE) { console.log('\n(dry run — pass --write to update artifacts)'); process.exit(0); }

/* ── 2. tickets.json ─────────────────────────────────────────────────────── */
writeFileSync('dashboard/data/tickets.json', j(tickets));
copyFileSync('dashboard/data/tickets.json', 'public/data/tickets.json');

/* ── 3. refresh-manifest.json ────────────────────────────────────────────── */
const manifest = previousManifest;
const etHeading = REFERENCE_TIME_ET;
manifest.refresh = {
  id: REFRESH_ID,
  timestamp: REFERENCE,
  type: 'AUTHORITATIVE',
  previousRefreshId: PREVIOUS_REFRESH_ID,
  status: 'complete',
  keyChange:
    `344 system-open rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and the ${GATE_TOTAL}-row New/Pending UFN gate are unchanged from v48. ` +
    `A newly confirmed overlap (DN-2131002: UFN-71073 surviving, UFN-71127 removed) takes the eligible set to ${total} conversations (${byStatus.New} New / ${byStatus.Pending} Pending). ` +
    `24 billing-family exclusions stand. All age-derived sections were recomputed at the new reference time.`,
};
manifest.rulesApplied = [
  'displayStatusSystemStatus == 10 AND displayStatusName in {New, Pending} is the authoritative eligibility gate',
  'Reopen/Reopened, Closed, Resolved, Solved, Cancelled and Done are excluded by display status name',
  'closeFlag is retained as evidence and is not an eligibility gate',
  `ticketNumber begins UFN- within department ${DEPARTMENT_ID}`,
  '24 live billing, UF Billing, storage, handling or invoice-family rows are excluded',
  '6 overlapping rows are removed by source CASE/DN conversation identity (subject text alone is never a dedupe key)',
  'Customer Health includes every customer visible in eligible tickets; roster and aliases are supplemental only',
  'Outlook is supplemental and never changes ticket counts, queue, buckets, Customer Health, or SLA metrics',
];
manifest.dataSources = [
  {
    name: 'Ticket Ops',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: '1,2', size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] } },
    rawCapture:
      'not persisted this cycle - the authoritative live read was performed in-session at 2026-09-20T10:04-10:08Z, and the resulting eligible projection is captured in dashboard/data/tickets.json',
    note:
      `Authoritative live read at ${REFERENCE} (pages 1-2, size 200), paged to exhaustion: data.total = ${OPEN_BUCKET} open-system rows = ` +
      `${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. The ${GATE_TOTAL} New/Pending gate rows are unchanged from v48.`,
  },
  {
    name: 'Outlook',
    note:
      'No Outlook read was possible this cycle either (the delegated-mailbox read returned no result); the last observed v42 values are retained for context only and were not re-verified. Outlook remains non-blocking.',
  },
];
manifest.developerNotes = [
  `v49 live read: ${OPEN_BUCKET} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; exact UFN New/Pending gate ${GATE_TOTAL} (unchanged from v48).`,
  `Eligible set: ${total} conversations (${byStatus.New} New / ${byStatus.Pending} Pending). Single delta vs v48: UFN-71127 removed as a duplicate of UFN-71073 (DN-2131002).`,
  'Gate movement: 0 arrivals / 0 departures. The eligible change is a deduplication correction, not a status change.',
  `Billing-family exclusions are unchanged at 24 live rows, re-verified against the live gate (UFN-40670 and UFN-53491 remain billing/finance month-end-close items; UFN-71112 "RE: bills" and UFN-60009 "BOL Request – FW: Amazon Invoice" are operational document requests and remain eligible).`,
  `${closeFlagTrueRetained} closeFlag=true rows remain eligible. closeFlag was never used as a gate.`,
  'The DN-2131002 pair was carried as two separate eligible rows in v48 (UFN-71127 was stored with a null conversationId, so the client-side dedupe never collapsed it). The overlap is now resolved explicitly in the snapshot: UFN-71073 survives, UFN-71127 is excluded.',
  'Age-derived sections recomputed at the v49 reference time: action buckets and Customer Health tiers are shown in dashboardState below.',
  `Customer Health covers all ${byCustomer.size} customer labels visible on the ${total} eligible live records; roster and aliases remain supplemental only.`,
  'Outlook was unavailable again this cycle (the delegated-mailbox read returned no result); the v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale. They were not used in any ticket, queue, bucket, health or SLA metric.',
];
manifest.exclusions.billingTicketIds = BILLING;
manifest.exclusions.billingFamilyExcludedCount = BILLING.length;
manifest.exclusions.duplicateConversations = [
  { ticketId: 'UFN-69447', canonical: 'UFN-69307', conversationId: '21836552091', reason: 'excluded as an overlapping CASE conversation; UFN-69307 is the earliest surviving row for CASE-21836552091' },
  { ticketId: 'UFN-69450', canonical: 'UFN-69307', conversationId: '21836552091', reason: 'excluded as an overlapping CASE conversation; UFN-69307 is the earliest surviving row for CASE-21836552091' },
  { ticketId: 'UFN-69661', canonical: 'UFN-69511', conversationId: '21861000021', reason: 'excluded as an overlapping CASE conversation; UFN-69511 is the earliest surviving row for CASE-21861000021' },
  { ticketId: 'UFN-69663', canonical: 'UFN-69511', conversationId: '21861000021', reason: 'excluded as an overlapping CASE conversation; UFN-69511 is the earliest surviving row for CASE-21861000021' },
  { ticketId: 'UFN-70352', canonical: 'UFN-70351', conversationId: 'DN-2107462', reason: 'excluded as an overlapping DN conversation; UFN-70351 is the earliest surviving row for DN-2107462' },
  NEW_DUPLICATE,
];
manifest.exclusions.candidateOverlapNote =
  'Only explicit CASE-/DN- conversation identities were collapsed. Two subject-only similarities (Return authorization notification for Order 112-4505161-2497057: UFN-59777 / UFN-59238; NIAGARA BOTTLIN_YMJAE490405029_015445: UFN-48670 / UFN-48777) remain separate rows, consistent with the no-subject-text-dedupe rule.';

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
    departuresThisCycle: 1,
  },
};
manifest.excludedThisCycle = {
  reopenByStatusName: previousManifest.excludedThisCycle.reopenByStatusName,
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
  closeFlagTrueGate: previousManifest.reconciliation.closeFlagTrueGate,
  closeFlagTrueEligible: closeFlagTrueRetained,
  gateArrivals: [],
  gateDepartures: [],
  eligibleArrivals: [],
  eligibleDepartures: ['UFN-71127'],
  note: 'No gate movement this cycle. The eligible set moves 277 -> 276 solely because UFN-71127 is now removed as the DN-2131002 overlap loser.',
};
manifest.verifiedAgainst = `Live Ticket Ops read ${REFERENCE} (department ${DEPARTMENT_ID}, displayStatusSystemStatus=10)`;
manifest.nextScheduledRefresh = '2026-09-20T20:00:00-04:00';
writeFileSync('dashboard/data/refresh-manifest.json', j(manifest));
copyFileSync('dashboard/data/refresh-manifest.json', 'public/data/refresh-manifest.json');

/* ── 4. config.json — every served copy, identical ───────────────────────── */
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
  departuresThisCycle: 1,
  outlookStatus: outlook.status,
  outlookThreadsMatched: outlook.threadsMatched,
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

/* ── 5. outlook-context.json — non-blocking, still unavailable ───────────── */
const outlookContext = JSON.parse(readFileSync('dashboard/data/outlook-context.json', 'utf8'));
outlookContext.generatedAt = REFERENCE;
outlookContext.lastRefreshed = REFERENCE;
outlookContext.staleness = {
  reason:
    'No Outlook read was possible this cycle either (the delegated-mailbox read returned no result); the last observed v42 values are retained for context only and were not re-verified.',
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
outlookContext.thisCycleRead.note =
  'No Outlook read was possible this cycle. Values shown elsewhere are the last observed v42 context and are marked stale.';
writeFileSync('dashboard/data/outlook-context.json', j(outlookContext));
copyFileSync('dashboard/data/outlook-context.json', 'public/data/outlook-context.json');

/* ── 6. structured_list.json (evidence surface) ──────────────────────────── */
const structured = {
  dashboard: 'Customer Command Center Dashboard',
  facility: { code: 'LT_F21', name: 'NHT/Cesanek', tenant: 'LT', timezone: 'America/New_York' },
  lastRefreshed: REFERENCE,
  dataSource: 'Ticket Ops (authoritative); Outlook unavailable this cycle (last observed values stale)',
  refreshType: 'AUTHORITATIVE',
  refreshId: REFRESH_ID,
  totalRaw: OPEN_BUCKET,
  eligibleBeforeExclusions: GATE_TOTAL,
  eligibleBeforeDeduplication: GATE_TOTAL - BILLING.length,
  totalEligible: total,
  newCount: byStatus.New,
  openCount: byStatus.Open,
  pendingCount: byStatus.Pending,
  exclusionSummary: { reopen: OPEN_REOPEN, billingFamily: BILLING.length, overlappingConversations: DUPLICATE_LOSERS.length },
  closeFlagTrueRetained,
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
  customers: {
    total: byCustomer.size,
    tiers,
    tierRule: previousManifest.dashboardState.customerHealth.tierRule,
  },
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
  departuresThisCycle: 1,
  outlookDistinctThreads: outlook.distinctThreads,
};
writeFileSync('public/data/structured_list.json', j(structured));

/* ── 7. README state + reconciliation ────────────────────────────────────── */
let readme = readFileSync('README.md', 'utf8');
const tierText = `${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const stateSection = `## Current Dashboard State (Last Refresh: ${etHeading} - AUTHORITATIVE v49)

| Metric | Value |
|--------|-------|
| Total Raw (system-open UFN, department scope) | **${OPEN_BUCKET}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate **${GATE_TOTAL}** |
| Eligible | **${total}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) - v48 was 277; the single delta is the DN-2131002 dedupe |
| Excluded | 30 = 24 billing-family + 6 overlapping conversations; ${OPEN_REOPEN} Reopen rows outside the gate |
| Eligible arrivals | **0** - no new eligible tickets this cycle |
| Eligible departures | **1** - UFN-71127 removed as the duplicate of UFN-71073 (conversation DN-2131002) |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained |
| Customers | **${byCustomer.size}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable |
| SLA Risk | **ELEVATED** - ${breachedList.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |
| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |
| Last Refresh | ${REFERENCE} (**AUTHORITATIVE v49**, department ${DEPARTMENT_ID}) |

`;
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);

const reconciliationNote = `### v48 -> v49 (Sep 20 2:28 AM ET -> ${etHeading})

- **Net movement: -1.** The authoritative New/Pending gate is unchanged at ${GATE_TOTAL} (${OPEN_BUCKET} system-open = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen). The eligible set moves 277 -> **${total}** because **UFN-71127** is now removed as an overlapping conversation.
- **New dedupe correction.** UFN-71127 ("RE: DN-2131002") quotes UFN-71073 ("DN-2131002") verbatim - same load conversation, same author and recipient. UFN-71073 (created 09/17 18:43) survives; UFN-71127 (created 09/18 14:43) is dropped. The pair had been carried as two separate eligible rows (UFN-71127 stored a null \`conversationId\`, so the client-side dedupe never collapsed it); the overlap is now resolved explicitly in the snapshot.
- **Exclusions re-verified.** The 24 billing-family rows are unchanged and were re-checked against the live gate: UFN-40670 / UFN-53491 (Diageo "F26 Month End Close Reminder" finance cutoffs) stay excluded; UFN-71112 ("RE: bills") and UFN-60009 ("BOL Request – FW: Amazon Invoice") are BOL/document requests and stay eligible.
- **closeFlag evidence.** ${closeFlagTrueRetained} live \`closeFlag=true\` tickets remain in the eligible set; \`closeFlag\` is not a gate.
- **Serving fix.** The previous cycle updated only the root \`config.json\`, leaving \`public/config.json\` and \`dashboard/config.json\` stale at v47. All served copies - including the \`/config.json\` that \`server.js\` actually serves - are now written from one snapshot so the UI reads v49 metrics.
- **Customer Health matches the rendered rule.** ${byCustomer.size} ticket-visible customers, ${tierText}. Healthy remains structurally unreachable because every eligible ticket is UFN-tagged.

`;
if (!readme.includes('### v48 -> v49 (')) {
  readme = readme.replace('## Developer Reconciliation Note\n\n', `## Developer Reconciliation Note\n\n${reconciliationNote}`);
}
writeFileSync('README.md', readme);

console.log('\nWROTE v49 artifacts: tickets.json, refresh-manifest.json, config.json (x3), outlook-context.json (x2), structured_list.json, README.md');

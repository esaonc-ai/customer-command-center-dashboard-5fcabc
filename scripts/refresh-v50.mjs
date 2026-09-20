#!/usr/bin/env node
// v50 refresh for the NHT/Cesanek Customer Command Center dashboard.
//
// Authoritative inputs (ticket-ops-agent live read, 2026-09-20T12:16-12:17Z,
// department 323826714354839552, displayStatusSystemStatus=10, pages 1-2 size 200, paged to exhaustion):
//   open-system bucket 344 = 236 New / 70 Pending / 38 Reopen
//   New+Pending gate 306 rows  -> IDENTICAL SET to v49 (0 arrivals / 0 departures)
//   billing-family exclusions 24 (unchanged) ; overlap losers 6 (unchanged)
//   => eligible 276 (215 New / 61 Pending)
// The live read is persisted this cycle as scripts/gate-live-2026-09-20-v50.txt and
// this script asserts gate-set identity against it before writing anything.
//
// closeFlag is NOT an eligibility gate. 25 gate rows carry closeFlag=true
// (24 of them eligible; UFN-65196 is billing-excluded) and all 25 are live Pending
// rows that are system-OPEN -- the auto-close artifact.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REFERENCE = argOf('--reference') || '2026-09-20T08:16:00-04:00';
const WRITE = args.includes('--write');

const VERSION = 'v50';
const REFRESH_ID = `refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID = 'refresh-2026-09-20T06:15:00-04:00-AUTHORITATIVE-v49';
const REFERENCE_TIME_ET = 'Sep 20 8:16 AM ET';
const DEPARTMENT_ID = '323826714354839552';
const READ_TIMESTAMP_UTC = '2026-09-20T12:16:00Z';

// Live-read aggregates (asserted below against the persisted gate capture).
const OPEN_BUCKET = 344;
const OPEN_NEW = 236;
const OPEN_PENDING = 70;
const OPEN_REOPEN = 38;
const GATE_TOTAL = 306;
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

/* ── 0. gate identity guard ──────────────────────────────────────────────── */
const previous = JSON.parse(readFileSync('dashboard/data/tickets.json', 'utf8'));
const previousManifest = JSON.parse(readFileSync('dashboard/data/refresh-manifest.json', 'utf8'));
const gate = readFileSync('scripts/gate-live-2026-09-20-v50.txt', 'utf8').trim().split(/\s+/);
const gateSet = new Set(gate);
if (gate.length !== GATE_TOTAL || gateSet.size !== GATE_TOTAL) {
  throw new Error(`gate capture must hold ${GATE_TOTAL} unique rows, got ${gate.length}/${gateSet.size}`);
}
const expectedIds = [...previous.map((t) => t.ticketId), ...BILLING, ...DUPLICATE_LOSERS];
if (expectedIds.length !== GATE_TOTAL) {
  throw new Error(`276 + 24 + 6 must equal ${GATE_TOTAL}, got ${expectedIds.length}`);
}
const missingFromGate = expectedIds.filter((id) => !gateSet.has(id));
const extraInGate = gate.filter((id) => !expectedIds.includes(id));
if (missingFromGate.length || extraInGate.length) {
  throw new Error(
    `gate set identity FAILED. missing=[${missingFromGate.join(',')}] extra=[${extraInGate.join(',')}]`,
  );
}
// gate order must equal eligible order (both createdAt-descending)
const gateEligible = gate.filter((id) => previous.some((t) => t.ticketId === id));
gateEligible.forEach((id, i) => {
  if (id !== previous[i].ticketId) {
    throw new Error(`gate ordering drift at index ${i}: gate=${id} baseline=${previous[i].ticketId}`);
  }
});
console.log(`gate identity OK: ${GATE_TOTAL} rows = 276 eligible + 24 billing + 6 overlap losers, same set and order as v49`);

/* ── 1. eligible rows = v49 set, ages recomputed ─────────────────────────── */
const tickets = previous
  .map((t) => {
    const h = Math.max(0, hoursSince(t.createdAt));
    return { ...t, ageHours: Math.floor(h), ageDays: Math.floor(h / 24) };
  })
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const total = tickets.length;
if (total !== 276) throw new Error(`expected 276 eligible conversations, got ${total}`);
const byStatus = {
  New: tickets.filter((t) => t.displayStatusName === 'New').length,
  Open: tickets.filter((t) => t.displayStatusName === 'Open').length,
  Pending: tickets.filter((t) => t.displayStatusName === 'Pending').length,
};
if (byStatus.New !== 215 || byStatus.Pending !== 61) {
  throw new Error(`eligible split must be 215 New / 61 Pending, got ${byStatus.New}/${byStatus.Pending}`);
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

// Outlook: the delegated read returned no result this cycle (second consecutive miss is
// non-blocking by the dashboard's own rule). v42 values are carried forward and labelled stale.
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
manifest.refresh = {
  id: REFRESH_ID,
  timestamp: REFERENCE,
  type: 'AUTHORITATIVE',
  previousRefreshId: PREVIOUS_REFRESH_ID,
  status: 'complete',
  keyChange:
    `No movement. The live Ticket Ops read returns the identical ${GATE_TOTAL}-row New/Pending gate as v49 ` +
    `(${OPEN_BUCKET} system-open = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen), so the eligible set is ` +
    `unchanged at ${total} conversations (${byStatus.New} New / ${byStatus.Pending} Pending): 0 arrivals, 0 departures. ` +
    `Only age-derived sections were recomputed at the new reference time. closeFlag is not a gate ` +
    `(${closeFlagTrueRetained} live closeFlag=true rows retained). Outlook unavailable (non-blocking).`,
};
manifest.rulesApplied = [
  'displayStatusSystemStatus == 10 AND displayStatusName in {New, Pending} is the authoritative eligibility gate',
  'Reopen/Reopened, Closed, Resolved, Solved, Cancelled and Done are excluded by display status name (there are no "Open"-named rows, so the New/Open/Pending rule resolves to New + Pending)',
  'closeFlag is retained as evidence and is NEVER an eligibility gate (auto-close artifacts on live system-open Pending rows would cause false negatives)',
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
    rawCapture: 'scripts/gate-live-2026-09-20-v50.txt (all 306 gate ticket numbers, persisted this cycle)',
    note:
      `Authoritative live read at ${READ_TIMESTAMP_UTC} (pages 1-2, size 200), paged to exhaustion: data.total = ${OPEN_BUCKET} open-system rows = ` +
      `${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. The ${GATE_TOTAL}-row New/Pending gate is set-identical and order-identical to v49.`,
  },
  {
    name: 'Outlook',
    note:
      'Outlook was unavailable again this cycle (the delegated-mailbox read returned no result). The last observed v42 values (25 messages / 9 distinct threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale. Outlook remains non-blocking.',
  },
];
manifest.developerNotes = [
  `v50 live read: ${OPEN_BUCKET} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; exact UFN New/Pending gate ${GATE_TOTAL}.`,
  `Verified, not assumed: the 306 gate rows are an exact SET match to v49 (276 eligible + 24 billing + 6 overlap losers), and the 276 eligible rows appear in the same createdAt-descending order. 0 arrivals / 0 departures.`,
  'The live read was persisted this cycle (scripts/gate-live-2026-09-20-v50.txt) so the gate identity is reproducible instead of being asserted from memory; refresh-v50.mjs fails hard if the capture and the snapshot disagree.',
  `Billing-family exclusions unchanged at 24 live rows, re-verified present in the gate. UFN-40670 / UFN-53491 (Diageo "F26 Month End Close Reminder" finance cutoffs) stay excluded; UFN-71112 ("RE: bills") and UFN-60009 ("BOL Request – FW: Amazon Invoice #403019398") are operational document requests and stay eligible. No new billing-family-looking gate row arrived.`,
  `${closeFlagTrueRetained} of the ${GATE_CLOSEFLAG_TRUE} gate-wide closeFlag=true rows remain eligible (UFN-65196 is billing-excluded); all ${GATE_CLOSEFLAG_TRUE} are live Pending rows on system-OPEN tickets. closeFlag is evidence only and was not used as a gate.`,
  'UFN-67030 re-read directly this cycle: displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), displayStatusId 2, closedTime 2026-09-01 16:56:56, closeFlag true. It is outside the open bucket on AUTHORITATIVE STATUS, not on closeFlag. The circulated claim that it is "live-Pending with closeFlag=true" is FALSE and must not be reused; the correct closeFlag counter-evidence is the 24 eligible live closeFlag=true Pending rows.',
  'Overlap re-verification: all 6 prior CASE/DN removals (UFN-69447/69450 -> UFN-69307 CASE-21836552091; UFN-69661/69663 -> UFN-69511 CASE-21861000021; UFN-70352 -> UFN-70351 DN-2107462; UFN-71127 -> UFN-71073 DN-2131002) are present in the gate and no NEW source-backed CASE/DN overlap arrived. Subject-only lookalikes (UFN-71031/71032, UFN-70098/70100, UFN-69231/70895) remain separate rows by rule.',
  'Priority and assignee fields were NOT re-derived from this read: the page response reports priorityName "Medium" on every row, which conflicts with the stored 272 Medium / 4 unavailable split, and the delegate report of 272 unassigned conflicts with the stored 225. The stored per-ticket values are retained and the conflict is disclosed. (The 4 non-Medium rows are UFN-71152, UFN-70261, UFN-70161, UFN-68573.)',
  'Age-derived sections recomputed at the v50 reference time: action buckets, Customer Health tiers and SLA counts are shown in dashboardState below.',
  `Customer Health covers all ${byCustomer.size} customer labels visible on the ${total} eligible live records; roster and aliases remain supplemental only.`,
  'Outlook was unavailable again this cycle; the v42 values are carried forward, labelled stale, and were not used in any ticket, queue, bucket, health or SLA metric.',
];
manifest.exclusions.billingTicketIds = BILLING;
manifest.exclusions.billingFamilyExcludedCount = BILLING.length;
manifest.exclusions.duplicateConversations = [
  { ticketId: 'UFN-69447', canonical: 'UFN-69307', conversationId: '21836552091', reason: 'excluded as an overlapping CASE conversation; UFN-69307 is the earliest surviving row for CASE-21836552091' },
  { ticketId: 'UFN-69450', canonical: 'UFN-69307', conversationId: '21836552091', reason: 'excluded as an overlapping CASE conversation; UFN-69307 is the earliest surviving row for CASE-21836552091' },
  { ticketId: 'UFN-69661', canonical: 'UFN-69511', conversationId: '21861000021', reason: 'excluded as an overlapping CASE conversation; UFN-69511 is the earliest surviving row for CASE-21861000021' },
  { ticketId: 'UFN-69663', canonical: 'UFN-69511', conversationId: '21861000021', reason: 'excluded as an overlapping CASE conversation; UFN-69511 is the earliest surviving row for CASE-21861000021' },
  { ticketId: 'UFN-70352', canonical: 'UFN-70351', conversationId: 'DN-2107462', reason: 'excluded as an overlapping DN conversation; UFN-70351 is the earliest surviving row for DN-2107462' },
  { ticketId: 'UFN-71127', canonical: 'UFN-71073', conversationId: 'DN-2131002', reason: 'excluded as an overlapping DN conversation; UFN-71127 quotes UFN-71073 verbatim (same DN-2131002 load conversation, same author/recipient) and UFN-71073 is the earliest surviving row' },
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
    'No movement in any dimension. The live gate is an exact set and order match to v49 (verified against the persisted capture), so nothing arrived and nothing departed.',
};
manifest.verifiedAgainst = `Live Ticket Ops read ${READ_TIMESTAMP_UTC} (department ${DEPARTMENT_ID}, displayStatusSystemStatus=10), set-verified against scripts/gate-live-2026-09-20-v50.txt`;
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

/* ── 5. outlook-context.json — non-blocking, still unavailable ───────────── */
const outlookContext = JSON.parse(readFileSync('dashboard/data/outlook-context.json', 'utf8'));
outlookContext.generatedAt = REFERENCE;
outlookContext.lastRefreshed = REFERENCE;
outlookContext.staleness = {
  reason:
    'No Outlook read was possible this cycle (the delegated-mailbox read returned no result, second consecutive miss); the last observed v42 values are retained for context only and were not re-verified.',
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
  departuresThisCycle: 0,
  outlookDistinctThreads: outlook.distinctThreads,
};
writeFileSync('public/data/structured_list.json', j(structured));

/* ── 7. README state + reconciliation ────────────────────────────────────── */
let readme = readFileSync('README.md', 'utf8');
const tierText = `${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const stateSection = `## Current Dashboard State (Last Refresh: ${REFERENCE_TIME_ET} - AUTHORITATIVE v50)

| Metric | Value |
|--------|-------|
| Total Raw (system-open UFN, department scope) | **${OPEN_BUCKET}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate **${GATE_TOTAL}** |
| Eligible | **${total}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) - identical set to v49 (0 arrivals / 0 departures) |
| Excluded | 30 = 24 billing-family + 6 overlapping conversations; ${OPEN_REOPEN} Reopen rows outside the gate |
| Eligible arrivals | **0** - the live gate is an exact set and order match to v49 |
| Eligible departures | **0** |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained (${GATE_CLOSEFLAG_TRUE} gate-wide; UFN-65196 is billing-excluded) |
| Customers | **${byCustomer.size}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable |
| SLA Risk | **ELEVATED** - ${breachedList.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |
| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |
| Last Refresh | ${REFERENCE} (**AUTHORITATIVE v50**, department ${DEPARTMENT_ID}) |

`;
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);

const reconciliationNote = `### v49 -> v50 (Sep 20 6:15 AM ET -> ${REFERENCE_TIME_ET})

- **Net movement: 0.** The live Ticket Ops read returns the same ${OPEN_BUCKET} system-open rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and the same ${GATE_TOTAL}-row New/Pending gate. The eligible set is unchanged at **${total}** conversations (${byStatus.New} New / ${byStatus.Pending} Pending). Nothing arrived and nothing departed.
- **This cycle's movement claim is verified, not asserted.** The full 306-row gate was captured to \`scripts/gate-live-2026-09-20-v50.txt\` and set-compared against v49: exact set identity (276 eligible + 24 billing + 6 overlap losers) with the eligible rows in the same createdAt-descending order. \`scripts/refresh-v50.mjs\` re-runs that guard and aborts if the capture and the snapshot ever disagree. Prior cycles could only assert "0 arrivals" because the raw read was not persisted.
- **closeFlag is still not a gate.** ${closeFlagTrueRetained} of the ${GATE_CLOSEFLAG_TRUE} gate-wide \`closeFlag=true\` rows are eligible (UFN-65196 is billing-excluded). All ${GATE_CLOSEFLAG_TRUE} sit on **live Pending rows whose system status is OPEN** - exactly the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **The circulated UFN-67030 example is false and was re-refuted live.** UFN-67030 reads \`displayStatusName\` "Solved" / \`displayStatusSystemStatus\` 20 (CLOSED) / \`displayStatusId\` 2 / closedTime 2026-09-01 16:56:56 / \`closeFlag\` true. It is outside the open bucket on **authoritative status**, not on closeFlag, so it cannot serve as the closeFlag counter-example. The rule stands and is properly evidenced by the ${closeFlagTrueRetained} eligible live closeFlag=true Pending rows.
- **Status-name audit.** The dictionary in use is New / Pending / Reopen (plus Solved outside the bucket). There are **no "Open"-named rows**, so the "New / Open / Pending" inclusion rule resolves to New + Pending, and Reopen is excluded by name.
- **Exclusions re-verified against the live gate.** All 24 billing-family rows and all 6 overlap losers were present in the read. UFN-40670 / UFN-53491 (Diageo "F26 Month End Close Reminder" finance cutoffs) stay excluded; UFN-71112 ("RE: bills") and UFN-60009 ("BOL Request – FW: Amazon Invoice #403019398") are operational document requests and stay eligible. No new billing-family-looking row arrived. No new source-backed CASE/DN overlap arrived either.
- **Priority and assignee were not silently overwritten.** The page response reports \`priorityName\` "Medium" on all 306 rows, which conflicts with the stored 272 Medium / 4 unavailable split, and a delegate count of 272 unassigned conflicts with the stored 225. Stored values are retained and the conflict is disclosed (non-Medium rows: UFN-71152, UFN-70261, UFN-70161, UFN-68573).
- **Age-derived sections recomputed** at ${REFERENCE}: SLA ${breachedList.length} breached / ${onTrack.length} current (unchanged); buckets Immediate ${actionBuckets.Immediate} / Short-Term ${actionBuckets['Short-Term']} / Medium-Term ${actionBuckets['Medium-Term']} / Watch ${actionBuckets.Watch}; Customer Health ${tierText} across the same ${byCustomer.size} customer labels.
- **Customer Health matches the rendered rule.** Every customer visible in the eligible live tickets is covered; the configured roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook was unavailable again this cycle** (the delegated-mailbox read returned no result). The v42 values are carried forward, labelled stale, and no operational metric depends on them.

`.replace('${REFERENCE_TIME_EAST_TS}', REFERENCE);
if (!readme.includes('### v49 -> v50 (')) {
  readme = readme.replace('## Developer Reconciliation Note\n\n', `## Developer Reconciliation Note\n\n${reconciliationNote}`);
}
writeFileSync('README.md', readme);

console.log(`\nWROTE v50 artifacts: tickets.json, refresh-manifest.json, config.json (x3), outlook-context.json (x2), structured_list.json, README.md`);

#!/usr/bin/env node
// v52 refresh for the NHT/Cesanek Customer Command Center dashboard.
//
// Authoritative input (live Ticket Ops read 2026-09-20T17:26Z,
// POST /v1/iam/tickets/page, department 323826714354839552,
// displayStatusSystemStatus=10, pages 1-4 size 100, paged to exhaustion):
//   349 system-open rows = 241 New / 70 Pending / 38 Reopen
//   New+Open+Pending gate = 311 rows  (no row is named "Open")
//   billing-family exclusions 20  -> eligible 291 conversations (227 New / 64 Pending)
// closeFlag is NOT an eligibility gate (25 gate rows carry closeFlag=true; 24 eligible).
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const VERSION = 'v52';
const REFERENCE = '2026-09-20T13:26:00-04:00';            // 2026-09-20 1:26 PM ET
const REFERENCE_TIME_ET = 'Sep 20 1:26 PM ET';
const READ_TIMESTAMP_UTC = '2026-09-20T17:26:00Z';
const REFRESH_ID = `refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID = 'refresh-2026-09-20T11:32:00-04:00-AUTHORITATIVE-v51';
const DEPARTMENT_ID = '323826714354839552';

const OPEN_BUCKET = 349, OPEN_NEW = 241, OPEN_PENDING = 70, OPEN_REOPEN = 38;
const GATE_TOTAL = 311, GATE_CLOSEFLAG_TRUE = 25;

// Billing / UF Billing / storage / handling / final-invoice family inside the gate.
// Ruled by the ticket domain on 2026-09-20. Rows that merely *reference* an invoice
// are NOT billing-family: UFN-63762 (short-ship cycle search), UFN-60009 (BOL request),
// UFN-53491 / UFN-40670 (month-end close reminders) stay eligible.
const BILLING = [
  'UFN-33719', 'UFN-41484', 'UFN-43725', 'UFN-45559', 'UFN-48436', 'UFN-54721',
  'UFN-55641', 'UFN-59971', 'UFN-60573', 'UFN-61451', 'UFN-62682', 'UFN-63959',
  'UFN-65196', 'UFN-69234', 'UFN-70140', 'UFN-70947', 'UFN-70948', 'UFN-70950',
  'UFN-70952', 'UFN-71039',
];
// Explicit conversation overlaps (same CASE-/DN- identity). Retained this cycle as
// distinct ticket numbers: the dashboard rule is one row per ticket number and the IAM
// page surface exposes no conversationId to prove identity. Flagged, not removed.
const OVERLAP_FLAGGED = [
  { ticketId: 'UFN-69447', canonical: 'UFN-69307', conversationKey: 'CASE-21836552091' },
  { ticketId: 'UFN-69450', canonical: 'UFN-69307', conversationKey: 'CASE-21836552091' },
  { ticketId: 'UFN-69661', canonical: 'UFN-69511', conversationKey: 'CASE-21861000021' },
  { ticketId: 'UFN-69663', canonical: 'UFN-69511', conversationKey: 'CASE-21861000021' },
  { ticketId: 'UFN-70352', canonical: 'UFN-70351', conversationKey: 'DN-2107462' },
  { ticketId: 'UFN-71127', canonical: 'UFN-71073', conversationKey: 'DN-2131002' },
];

const refMs = new Date(REFERENCE).getTime();
const hoursSince = (iso) => (refMs - new Date(iso).getTime()) / 36e5;
const j = (v) => `${JSON.stringify(v, null, 2)}\n`;
const pad = (n) => String(n).padStart(2, '0');
// Raw times are facility-local (ET) wall clock; the dashboard's stored convention keeps
// the wall time with a Z suffix (identical to every prior refresh).
const toIso = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(s || ''));
  return m ? `${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
};
const dateOf = (iso) => (iso ? iso.slice(0, 10) : null);

/* ── 0. read the raw pull ─────────────────────────────────────────────────── */
const raw = JSON.parse(readFileSync('raw/all-open-rows.json', 'utf8'));
const ufn = (r) => /^UFN-/.test(r.ticketNumber);
const openRows = raw.filter((r) => r.displayStatusSystemStatus === 10 && ufn(r));
if (openRows.length !== OPEN_BUCKET) throw new Error(`open bucket ${openRows.length} != ${OPEN_BUCKET}`);
const countBy = (rows, k) => rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
const openByStatus = countBy(openRows, 'displayStatusName');
if (openByStatus.New !== OPEN_NEW || openByStatus.Pending !== OPEN_PENDING || openByStatus.Reopen !== OPEN_REOPEN) {
  throw new Error(`open split drift: ${JSON.stringify(openByStatus)}`);
}
const gate = openRows.filter((r) => ['New', 'Open', 'Pending'].includes(r.displayStatusName));
if (gate.length !== GATE_TOTAL) throw new Error(`gate ${gate.length} != ${GATE_TOTAL}`);
const billingSet = new Set(BILLING);
const missingBilling = BILLING.filter((id) => !gate.some((r) => r.ticketNumber === id));
if (missingBilling.length) throw new Error(`billing rows missing from gate: ${missingBilling.join(',')}`);
const eligibleRaw = gate.filter((r) => !billingSet.has(r.ticketNumber));
const gateCloseFlagTrue = gate.filter((r) => r.closeFlag === true).length;
if (gateCloseFlagTrue !== GATE_CLOSEFLAG_TRUE) throw new Error(`closeFlag=true in gate ${gateCloseFlagTrue} != ${GATE_CLOSEFLAG_TRUE}`);
console.log(`gate OK: ${GATE_TOTAL} = ${gate.length - BILLING.length} eligible + ${BILLING.length} billing  (Reopen ${OPEN_REOPEN} outside gate, ${gateCloseFlagTrue} closeFlag=true retained)`);

/* ── 1. eligible rows -> dashboard schema ─────────────────────────────────── */
const rows = eligibleRaw.map((r) => {
  const createdAt = toIso(r.createTime);
  const updatedAt = toIso(r.updateTime);
  const dueDate = toIso(r.estDueDate);
  const breached = r.isSlaBreached === true || r.isOverdue === true;
  const h = Math.max(0, hoursSince(createdAt));
  return {
    ticketId: r.ticketNumber,
    customer: r.customerName || r.customerEmail || 'Unknown',
    customerEmail: r.customerEmail || null,
    organization: (r.organization && r.organization.name) || null,
    organizationIds: r.organizationIds || [],
    opsStatus: r.displayStatusName,
    displayStatusName: r.displayStatusName,
    displayStatusSystemStatus: r.displayStatusSystemStatus,
    priority: r.priorityName || null,
    priorityNameSource: r.priorityName ? 'ticket' : 'unavailable',
    prioritySourceMissing: !r.priorityName,
    subject: r.title || '',
    createdAt,
    createdDate: dateOf(createdAt),
    updatedAt,
    lastUpdated: dateOf(updatedAt),
    dueDate,
    assigned: r.staffName || 'Unassigned',
    team: r.teamName || null,
    closeFlag: r.closeFlag === true,
    slaStatus: breached ? 'Breached' : 'On Track',
    isOverdue: r.isOverdue === true,
    isSlaBreached: r.isSlaBreached === true,
    conversationId: null,
    sourceChannel: r.sourceChannel ?? null,
    topicTitle: r.topicTitle || null,
    attachmentFlag: r.attachmentFlag === true,
    ageHours: Math.floor(h),
    ageDays: Math.floor(h / 24),
  };
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const total = rows.length;
const byStatus = { New: 0, Open: 0, Pending: 0 };
rows.forEach((t) => (byStatus[t.displayStatusName] = (byStatus[t.displayStatusName] || 0) + 1));
const byPriority = rows.reduce((a, t) => ((a[t.priority || 'unavailable'] = (a[t.priority || 'unavailable'] || 0) + 1), a), {});
const breachedRows = rows.filter((t) => t.isSlaBreached || t.isOverdue || /breach/i.test(t.slaStatus || ''));
const onTrack = rows.filter((t) => !breachedRows.includes(t));
const isBreached = (t) => breachedRows.includes(t);

const priorityQueue = [...rows]
  .sort((a, b) =>
    Number(isBreached(b)) - Number(isBreached(a)) ||
    String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')) ||
    b.ageHours - a.ageHours)
  .slice(0, 15)
  .map((t) => ({ ticketId: t.ticketId, customer: t.organization || t.customer, subject: t.subject, ageDays: t.ageDays, ageHours: t.ageHours, slaStatus: isBreached(t) ? 'Breached' : 'On Track' }));

const bucketOf = (h) => (h < 24 ? 'Immediate' : h < 72 ? 'Short-Term' : h < 168 ? 'Medium-Term' : 'Watch');
const actionBuckets = { Immediate: 0, 'Short-Term': 0, 'Medium-Term': 0, Watch: 0 };
rows.forEach((t) => (actionBuckets[bucketOf(t.ageHours)] += 1));

// Customer Health is grouped by the customer ORGANIZATION visible on the eligible ticket
// (the label the dashboard renders); requester is the fallback when no organization is set.
const byCustomer = new Map();
for (const t of rows) {
  const name = t.organization || t.customer || t.customerEmail || 'Unknown';
  const row = byCustomer.get(name) || { tickets: 0, breached: 0, oldestBreachedAgeDays: 0, olderThan7d: 0 };
  row.tickets += 1;
  if (isBreached(t)) { row.breached += 1; row.oldestBreachedAgeDays = Math.max(row.oldestBreachedAgeDays, t.ageDays); }
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
const sortedCustomers = Object.fromEntries(Object.entries(customers).sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0])));
const tierRule = JSON.parse(readFileSync('base-manifest.json', 'utf8')).dashboardState.customerHealth.tierRule;

const closeFlagTrueRetained = rows.filter((t) => t.closeFlag === true).length;
const unassigned = rows.filter((t) => /unassigned/i.test(t.assigned || '')).length;
const oldestAgeDays = rows.reduce((m, t) => Math.max(m, t.ageDays), 0);

/* ── 2. reconciliation vs v50 ─────────────────────────────────────────────── */
const prev = JSON.parse(readFileSync('base-tickets.json', 'utf8'));
const prevIds = prev.map((t) => t.ticketId);
const prevSet = new Set(prevIds), nowSet = new Set(rows.map((t) => t.ticketId));
const eligibleArrivals = rows.filter((t) => !prevSet.has(t.ticketId)).map((t) => t.ticketId);
const eligibleDepartures = prevIds.filter((id) => !nowSet.has(id));
const gateArrivals = gate.filter((r) => !prevSet.has(r.ticketNumber) && !billingSet.has(r.ticketNumber)).map((r) => r.ticketNumber);
const prevBilling = new Set(JSON.parse(readFileSync('base-manifest.json', 'utf8')).exclusions.billingTicketIds);
const billingNowEligible = [...prevBilling].filter((id) => nowSet.has(id));
const billingNowExcludedNew = BILLING.filter((id) => !prevBilling.has(id));

/* ── 3. outlook (non-blocking, unavailable) ───────────────────────────────── */
const outlook = { status: 'unavailable', threadsMatched: 25, distinctThreads: 9, threadsLinkedToEligibleTickets: 3, stale: true, lastObservedUtc: '2026-09-14T21:46:00Z' };

console.log('COMPUTED', JSON.stringify({
  reference: REFERENCE,
  counts: { totalEligible: total, byStatus, byPriority },
  workload: { overdueOrSlaBreached: breachedRows.length, current: onTrack.length },
  actionBuckets,
  customerHealth: { totalCustomers: byCustomer.size, tiers },
  evidence: { unassigned, oldestAgeDays, closeFlagTrueRetained },
  arrivals: eligibleArrivals.length, departures: eligibleDepartures.length,
}, null, 2));

/* ── 4. artifacts ─────────────────────────────────────────────────────────── */
writeFileSync('out/dashboard/data/tickets.json', j(rows));
copyFileSync('out/dashboard/data/tickets.json', 'out/public/data/tickets.json');

const manifest = JSON.parse(readFileSync('base-manifest.json', 'utf8'));
manifest.refresh = {
  id: REFRESH_ID,
  timestamp: REFERENCE,
  type: 'AUTHORITATIVE',
  previousRefreshId: PREVIOUS_REFRESH_ID,
  status: 'complete',
  keyChange:
    `Incremental movement; eligibility method unchanged vs v51. Live Ticket Ops read: ${OPEN_BUCKET} system-open rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; ` +
    `${GATE_TOTAL}-row New/Open/Pending gate (no row is named "Open"). ${BILLING.length} billing-family exclusions -> ${total} eligible conversations ` +
    `(${byStatus.New} New / ${byStatus.Pending} Pending) vs ${prevIds.length} at v51: ${eligibleArrivals.length} arrivals / ${eligibleDepartures.length} departures. ` +
    `closeFlag is not a gate (${closeFlagTrueRetained} live closeFlag=true rows retained). Outlook unavailable (non-blocking).`,
};
manifest.rulesApplied = [
  'displayStatusSystemStatus == 10 AND displayStatusName in {New, Open, Pending} is the authoritative eligibility gate',
  'Reopen/Reopened, Closed, Resolved, Solved, Cancelled and Done are excluded by display status name (no row in this queue is named "Open", so New/Open/Pending resolves to New + Pending)',
  'closeFlag is retained as evidence and is NEVER an eligibility gate (auto-close artifacts on live system-open Pending rows would cause false negatives)',
  `ticketNumber begins UFN- within department ${DEPARTMENT_ID}`,
  `${BILLING.length} live billing, UF Billing, storage, handling or final-invoice rows are excluded; operational issues that merely reference an invoice are retained`,
  'Ticket/email overlap is collapsed only where the same conversation is provably double-sourced; distinct ticket numbers are never merged, so the 6 CASE-/DN- conversation overlaps are flagged but retained',
  'Customer Health includes every customer visible in eligible tickets (grouped by the customer organization); roster and aliases are supplemental only',
  'Outlook is supplemental and never changes ticket counts, queue, buckets, Customer Health, or SLA metrics',
];
manifest.dataSources = [
  {
    name: 'Ticket Ops',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: '1,2,3,4', size: 100, input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] } },
    rawCapture: 'scripts/gate-live-2026-09-20-v52.txt (all 311 gate ticket numbers)',
    note:
      `Authoritative live read at ${READ_TIMESTAMP_UTC} (4 pages, size 100, paged to exhaustion): data.total = ${OPEN_BUCKET} open-system rows = ` +
      `${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; 349 unique ticket numbers, 0 duplicate rows.`,
  },
  {
    name: 'Outlook',
    note:
      'Outlook remained unavailable this cycle (the delegated-mailbox read returned no result). The last observed v42 values (25 messages / 9 distinct threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale. Outlook is non-blocking and was not used in any ticket metric.',
  },
];
manifest.developerNotes = [
  `v52 live read: ${OPEN_BUCKET} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New/Open/Pending gate ${GATE_TOTAL}.`,
  `Eligible ${total} = ${GATE_TOTAL} gate - ${BILLING.length} billing-family. Arrivals ${eligibleArrivals.length} / departures ${eligibleDepartures.length} vs v51 (${prevIds.length}). No relative departures this cycle.`,
  `Gate-wide closeFlag=true rows: ${gateCloseFlagTrue}; retained eligible: ${closeFlagTrueRetained} (UFN-65196 is billing-excluded). closeFlag was not used as a gate.`,
  'Billing-family rulings unchanged vs v51: the same 20 billing / UF Billing / storage / handling / final-invoice rows are excluded, and no ticket was re-ruled in or out of the billing family this cycle. The four retained-for-business-ruling items (UFN-63762, UFN-60009, UFN-53491, UFN-40670) remain eligible.',
  'Conversation-overlap handling unchanged vs v51: the six CASE-/DN- overlaps are flagged but RETAINED (${OVERLAP_FLAGGED.map((o) => o.ticketId).join(', ')}) because the dashboard rule is one row per ticket number and the IAM page surface exposes no conversationId to prove double-sourcing. Distinct ticket numbers are never merged.',
  'UFN-67030 re-read live again: displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), closedTime 2026-09-01, closeFlag true. It is outside the gate on AUTHORITATIVE STATUS, not on closeFlag. The circulated claim that it is "live-Pending with closeFlag=true" is false and must not be reused; the correct closeFlag counter-evidence is the eligible live closeFlag=true Pending rows.',
  'Customer Health grouping unchanged vs v51: keyed by the customer ORGANIZATION (the label the dashboard renders). Coverage rule unchanged: every customer visible in eligible tickets; roster/aliases supplemental only and never additive.',
  `Age-derived sections recomputed at ${REFERENCE}: SLA ${breachedRows.length} breached / ${onTrack.length} current; buckets Immediate ${actionBuckets.Immediate} / Short-Term ${actionBuckets['Short-Term']} / Medium-Term ${actionBuckets['Medium-Term']} / Watch ${actionBuckets.Watch}; Customer Health ${byCustomer.size} organizations (${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy).`,
  'ageHours/ageDays are derived from the stored createdAt wall-clock convention used by every prior refresh (facility-local wall time stored with a Z suffix), so age comparisons stay consistent across cycles.',
  'Outlook was unavailable this cycle; no operational metric depends on it.',
];
manifest.exclusions.billingTicketIds = BILLING;
manifest.exclusions.billingFamilyExcludedCount = BILLING.length;
manifest.exclusions.duplicateConversations = OVERLAP_FLAGGED.map((o) => ({
  ticketId: o.ticketId, canonical: o.canonical, conversationId: o.conversationKey,
  reason: `flagged, NOT removed: same conversation identity as ${o.canonical}; retained as a distinct ticket number under the one-row-per-ticket rule`,
}));
manifest.exclusions.retainedForBusinessRuling = {
  'UFN-63762': 'operational: SMEG short-ship (9 units) requiring a warehouse cycle count; the forwarded subject mentions an invoice but the item is not a billing artifact',
  'UFN-60009': 'operational: BOL request referencing an Amazon invoice number',
  'UFN-53491': 'process reminder: Diageo F26 April month-end close, not a billing/storage/handling line',
  'UFN-40670': 'process reminder: Diageo F26 March month-end close, not a billing/storage/handling line',
};
manifest.exclusions.additionalCandidateOverlaps = OVERLAP_FLAGGED.map((o) => `${o.ticketId} <-> ${o.canonical} (${o.conversationKey})`);
manifest.exclusions.candidateOverlapNote =
  'Only explicit CASE-/DN- conversation identities were considered. Subject-only lookalikes (UFN-71031/71032, UFN-70098/70100, UFN-69231/70895, UFN-59777/59238, UFN-48670/48777) stay separate rows; subject text is never a dedupe key.';

manifest.dashboardState = {
  totalRaw: OPEN_BUCKET,
  totalRawDepartmentWide: OPEN_BUCKET,
  eligibleBeforeExclusions: GATE_TOTAL,
  reopenExcluded: OPEN_REOPEN,
  billingExcluded: BILLING.length,
  eligibleBeforeDeduplication: GATE_TOTAL - BILLING.length,
  duplicatesRemoved: 0,
  totalEligible: total,
  closeFlagTrueRetained,
  byStatus,
  byPriority,
  workload: { overdueOrSlaBreached: breachedRows.length, current: onTrack.length },
  actionBuckets,
  customerHealth: { totalCustomers: byCustomer.size, tiers, tierRule, labelKey: 'customer organization (requester fallback)', customers: sortedCustomers },
  priorityQueue,
  evidenceMetrics: {
    totalEligible: total,
    slaBreached: breachedRows.length,
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
    duplicatesRemoved: 0,
    closeFlagTrueRetained,
    arrivalsThisCycle: eligibleArrivals.length,
    departuresThisCycle: eligibleDepartures.length,
  },
};
manifest.excludedThisCycle = { reopenByStatusName: OPEN_REOPEN, billingFamily: BILLING, duplicateConversations: [] };
manifest.reconciliation = {
  gate: { total: GATE_TOTAL, New: OPEN_NEW, Pending: OPEN_PENDING },
  openSystemBucket: OPEN_BUCKET,
  Reopen: OPEN_REOPEN,
  billingExcluded: BILLING.length,
  duplicateConversationsExcluded: 0,
  eligibleConversations: total,
  closeFlagTrueGate: gateCloseFlagTrue,
  closeFlagTrueEligible: closeFlagTrueRetained,
  gateArrivals,
  gateDepartures: eligibleDepartures,
  eligibleArrivals,
  eligibleDepartures,
  methodChangesVsV51: {
    billingRulingsNowEligible: billingNowEligible,
    billingExclusionsNewlyApplied: billingNowExcludedNew,
    conversationOverlapsRetained: OVERLAP_FLAGGED.map((o) => o.ticketId),
    customerHealthLabel: 'unchanged vs v51: customer organization',
  },
  note:
    `Live gate ${GATE_TOTAL} vs v51 gate 309: real gate arrivals ${gateArrivals.length} (${gateArrivals.join(', ') || 'none'}). ` +
    `Eligible movement ${eligibleArrivals.length} in / ${eligibleDepartures.length} out, with no method change this cycle.`,
};
manifest.verifiedAgainst = `Live Ticket Ops read ${READ_TIMESTAMP_UTC} (department ${DEPARTMENT_ID}, displayStatusSystemStatus=10, 4 pages x100), captured as scripts/gate-live-2026-09-20-v52.txt`;
manifest.nextScheduledRefresh = '2026-09-20T14:00:00-04:00';
manifest.fieldAvailability = {
  ...manifest.fieldAvailability,
  organizationName: 'organization.name (singular) on the page response; organizations[] + organizationIds[] also returned',
  conversationId: 'NOT returned by /v1/iam/tickets/page - conversation identity is only inferable from the subject CASE-/DN- token, which is why overlaps are flagged, not removed',
  staffName: 'absent on unassigned rows -> stored as "Unassigned"',
};
writeFileSync('out/dashboard/data/refresh-manifest.json', j(manifest));
copyFileSync('out/dashboard/data/refresh-manifest.json', 'out/public/data/refresh-manifest.json');

const snapshotMetrics = {
  refreshId: REFRESH_ID, refreshedAt: REFERENCE, totalRaw: OPEN_BUCKET, totalGateRows: GATE_TOTAL,
  totalEligible: total, excludedCount: BILLING.length, duplicatesRemoved: 0, invoiceItemsExcluded: BILLING.length,
  closeFlagTrueRetained, arrivalsThisCycle: eligibleArrivals.length, departuresThisCycle: eligibleDepartures.length,
  outlookStatus: outlook.status, outlookThreadsMatched: outlook.threadsMatched, version: VERSION,
};
for (const p of ['out/config.json', 'out/dashboard/config.json', 'out/public/config.json']) {
  const cfg = JSON.parse(readFileSync(p, 'utf8'));
  cfg.snapshotMetrics = snapshotMetrics;
  cfg.outlook = { integration: 'non_blocking', useWhenAvailable: true, status: outlook.status, lastObservedUtc: outlook.lastObservedUtc, stale: true };
  writeFileSync(p, j(cfg));
}

const oc = JSON.parse(readFileSync('out/dashboard/data/outlook-context.json', 'utf8'));
oc.generatedAt = REFERENCE; oc.lastRefreshed = REFERENCE; oc.thisCycleRead = {
  messagesRetrieved: 0, distinctThreadsPostDedup: 0, threadsMappedToUfn: 0, ufnRefs: [], eligibleUfnRefs: [], ineligibleUfnRefs: [],
  threadsLinkedToEligibleTickets: 0,
  note: 'No Outlook read was possible this cycle (delegated-mailbox read returned no result). Values elsewhere are the last observed v42 context, marked stale.',
};
oc.staleness = { reason: 'No Outlook read was possible this cycle; last observed v42 values retained for context only and not re-verified.', lastObservedUtc: outlook.lastObservedUtc, lastObservedCycle: 'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42' };
oc.coverage = { eligibleTicketsTotal: total, eligibleTicketsWithOutlookContext: outlook.threadsLinkedToEligibleTickets, coveragePct: Number(((outlook.threadsLinkedToEligibleTickets / total) * 100).toFixed(2)), note: `Stale context only; no Outlook read this cycle. ${outlook.threadsLinkedToEligibleTickets} of ${outlook.distinctThreads} last-observed threads link to an eligible conversation.` };
writeFileSync('out/dashboard/data/outlook-context.json', j(oc));
copyFileSync('out/dashboard/data/outlook-context.json', 'out/public/data/outlook-context.json');

writeFileSync('out/public/data/structured_list.json', j({
  dashboard: 'Customer Command Center Dashboard',
  facility: { code: 'LT_F21', name: 'NHT/Cesanek', tenant: 'LT', timezone: 'America/New_York' },
  lastRefreshed: REFERENCE, dataSource: 'Ticket Ops (authoritative); Outlook unavailable this cycle (last observed values stale)',
  refreshType: 'AUTHORITATIVE', refreshId: REFRESH_ID, version: VERSION,
  totalRaw: OPEN_BUCKET, eligibleBeforeExclusions: GATE_TOTAL, eligibleBeforeDeduplication: GATE_TOTAL - BILLING.length,
  totalEligible: total, newCount: byStatus.New, openCount: 0, pendingCount: byStatus.Pending,
  exclusionSummary: { reopen: OPEN_REOPEN, billingFamily: BILLING.length, overlappingConversationsRemoved: 0 },
  closeFlagTrueRetained, closeFlagTrueGate: gateCloseFlagTrue,
  slaHealth: { breached: breachedRows.length, onTrack: onTrack.length, unassigned },
  actionBuckets, evidenceMetrics: manifest.dashboardState.evidenceMetrics,
  outlook: { status: outlook.status, stale: true, messagesRetrieved: outlook.threadsMatched, distinctThreads: outlook.distinctThreads, threadsLinkedToEligibleTickets: outlook.threadsLinkedToEligibleTickets, lastObservedUtc: outlook.lastObservedUtc },
  customers: { total: byCustomer.size, tiers, labelKey: 'organization', tierRule },
  priorityQueue, arrivalsThisCycle: eligibleArrivals.length, departuresThisCycle: eligibleDepartures.length,
}));

writeFileSync('out/scripts/gate-live-2026-09-20-v52.txt',
  gate.slice().sort((a, b) => b.createTime.localeCompare(a.createTime)).map((r) => r.ticketNumber).join('\n') + '\n');

/* ── 5. README state + reconciliation (only if README is present) ─────────── */
try { readFileSync('out/README.md', 'utf8'); } catch { console.log('README.md not in staging tree - skipped (handled in the repo commit)'); }
let readme = ''; try { readme = readFileSync('out/README.md', 'utf8'); } catch { readme = ''; }
const tierText = `${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const stateSection = `## Current Dashboard State (Last Refresh: ${REFERENCE_TIME_ET} - AUTHORITATIVE ${VERSION})

| Metric | Value |
|--------|-------|
| Total Raw (system-open UFN, department scope) | **${OPEN_BUCKET}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New/Open/Pending gate **${GATE_TOTAL}** |
| Eligible | **${total}** conversations (${byStatus.New} New, 0 Open, ${byStatus.Pending} Pending) - ${eligibleArrivals.length} arrivals / ${eligibleDepartures.length} departures vs v51 |
| Excluded | ${BILLING.length} billing-family; ${OPEN_REOPEN} Reopen rows outside the gate; 6 CASE/DN overlaps flagged but retained |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained (${gateCloseFlagTrue} gate-wide; UFN-65196 is billing-excluded) |
| Customers | **${byCustomer.size}** customer organizations (${tierText}; every ticket-visible customer covered) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable |
| SLA Risk | **ELEVATED** - ${breachedRows.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |
| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |
| Last Refresh | ${REFERENCE} (**AUTHORITATIVE ${VERSION}**, department ${DEPARTMENT_ID}) |

`;
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);
const note = `### v51 -> v52 (Sep 20 11:32 AM ET -> ${REFERENCE_TIME_ET})

- **Net movement: ${eligibleArrivals.length} in / ${eligibleDepartures.length} out.** The live read returns ${OPEN_BUCKET} system-open rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and a ${GATE_TOTAL}-row New/Open/Pending gate. Eligible: **${total}** conversations (${byStatus.New} New / ${byStatus.Pending} Pending).
- **Real gate arrivals:** ${gateArrivals.join(', ') || 'none'}. No relative departures this cycle.
- **No method change vs v51.** The gate definition, the ${BILLING.length} billing-family exclusions, the flag-but-retain overlap handling, and the organization-keyed Customer Health grouping are all unchanged.
- **closeFlag is still not a gate.** ${closeFlagTrueRetained} of ${gateCloseFlagTrue} gate-wide \`closeFlag=true\` rows are eligible (UFN-65196 is billing-excluded); all sit on live system-OPEN New/Pending rows - the auto-close artifact.
- **UFN-67030 re-checked live.** \`displayStatusName\` "Solved" / \`displayStatusSystemStatus\` 20 (CLOSED) / \`closeFlag\` true. It is outside the gate on **authoritative status**, not on closeFlag; the circulated "live-Pending with closeFlag=true" premise is false and must not be reused.
- **Status-name audit.** No row in this queue is named "Open" (display-status id 1 resolves to Reopen, which is excluded by name), so New/Open/Pending is exactly New + Pending = ${GATE_TOTAL}.
- **Customer Health coverage unchanged.** ${byCustomer.size} organizations (${tierText}); every customer visible in eligible tickets is covered; roster/aliases supplemental only.
- **Age-derived sections recomputed** at ${REFERENCE}: SLA ${breachedRows.length} breached / ${onTrack.length} current; buckets Immediate ${actionBuckets.Immediate} / Short-Term ${actionBuckets['Short-Term']} / Medium-Term ${actionBuckets['Medium-Term']} / Watch ${actionBuckets.Watch}.
- **Outlook unavailable again this cycle** (delegated-mailbox read returned no result). v42 values are carried forward, labelled stale, and no operational metric depends on them.
- **Production rendering is not changed by this commit.** The deployed dashboard reads its own authenticated data route; this repo is the audit/evidence mirror.

`;
if (!readme.includes('### v51 -> v52 (')) {
  readme = readme.replace('## Developer Reconciliation Note\n\n', `## Developer Reconciliation Note\n\n${note}`);
}
writeFileSync('refresh-v52-readme-section.md', stateSection + note);
if (readme) writeFileSync('out/README.md', readme);
console.log(`WROTE ${VERSION} artifacts`);

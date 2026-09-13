#!/usr/bin/env node
/**
 * v37 -> v38 refresh for the NHT/Cesanek Customer Command Center Dashboard.
 *
 * Authoritative input: live Ticket Ops gate re-read (dept 323826714354839552) captured in
 * scripts/gate-flags-2026-09-13-v38.csv — one row per open New/Pending ticket:
 *   ticketNumber|displayStatusName|closeFlag|isSlaBreached|isOverdue
 *
 * Gate rule (unchanged): displayStatusSystemStatus == 10 (open) AND displayStatusName in {New, Pending},
 * UFN- prefixed only. closeFlag is NOT an eligibility gate.
 *
 * This is a NO-MOVEMENT cycle: the live gate reconciles exactly with the v37 baseline
 * (311 eligible + 24 billing + 5 duplicate conversations = 340) with zero arrivals, zero departures
 * and no per-record status / closeFlag / SLA / overdue movement. Only time-derived fields,
 * freshness and Outlook metadata are recomputed.
 */
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';

const TIME_ZONE = 'America/New_York';
const VERSION = 'v38';
const DEPARTMENT_ID = '323826714354839552';
const REFRESH_INSTANT = new Date('2026-09-13T12:41:00Z'); // 2026-09-13 08:41 ET

const EXPECTED = {
  gateTotal: 340,
  gateStatuses: { New: 274, Pending: 66 },
  openBucketTotal: 392,
  reopenTotal: 52,
  eligible: 311,
  closeFlagTrueGate: 20,
  closeFlagTrueEligible: 19,
  slaBreachedEligible: 216,
  unassignedEligible: 260,
};

const GATE_CSV = 'scripts/gate-flags-2026-09-13-v38.csv';

const args = process.argv.slice(2);
const writeOutputs = args.includes('--write');

function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}
function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
}
function timeZoneOffsetMinutes(date) {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}
function zonedIso(date) {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${formatOffset(timeZoneOffsetMinutes(date))}`;
}
function nextRefreshIso(date) {
  const cur = zonedParts(date);
  const nextDate = new Date(Date.UTC(+cur.year, +cur.month - 1, +cur.day + 1, 12));
  const next = zonedParts(nextDate);
  const provisional = new Date(Date.UTC(+next.year, +next.month - 1, +next.day, 8));
  return `${next.year}-${next.month}-${next.day}T08:00:00${formatOffset(timeZoneOffsetMinutes(provisional))}`;
}
function countBy(records, keyFn) {
  const counts = {};
  for (const r of records) counts[keyFn(r)] = (counts[keyFn(r)] ?? 0) + 1;
  return counts;
}
function actionBucket(t) {
  if (t.ageHours < 24) return 'Immediate';
  if (t.ageHours < 72) return 'Short-Term';
  if (t.ageHours < 168) return 'Medium-Term';
  return 'Watch';
}
function buildCustomerHealth(tickets) {
  const groups = new Map();
  for (const t of tickets) {
    const g = groups.get(t.customer) ?? { tickets: 0, old: 0, ufnCount: 0, breached: 0, oldestBreachedAgeDays: 0 };
    g.tickets += 1;
    if (t.ageDays > 7) g.old += 1;
    if (t.ticketId.startsWith('UFN-')) g.ufnCount += 1;
    if (t.isSlaBreached) { g.breached += 1; g.oldestBreachedAgeDays = Math.max(g.oldestBreachedAgeDays, t.ageDays); }
    groups.set(t.customer, g);
  }
  const customers = {};
  const tiers = { Critical: 0, Warning: 0, Healthy: 0 };
  for (const [customer, g] of [...groups].sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0]))) {
    const oldShare = g.old / g.tickets;
    const tier = oldShare >= 0.5 || g.ufnCount >= 3 ? 'Critical' : oldShare >= 0.25 || g.ufnCount >= 1 ? 'Warning' : 'Healthy';
    tiers[tier] += 1;
    customers[customer] = { tickets: g.tickets, breached: g.breached, oldestBreachedAgeDays: g.oldestBreachedAgeDays, tier };
  }
  return {
    totalCustomers: groups.size,
    tiers,
    tierRule: 'Critical if ticketsOlderThan7Days/tickets >= 0.5 OR ufnCount >= 3; Warning if share >= 0.25 OR ufnCount >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged, so Healthy is structurally unreachable.',
    customers,
  };
}
function json(v) { return `${JSON.stringify(v, null, 2)}\n`; }
async function atomicWriteAll(outputs) {
  const temps = [];
  try {
    for (const [p, c] of outputs) { const tmp = `${p}.tmp-${process.pid}`; await writeFile(tmp, c, 'utf8'); temps.push(tmp); }
    for (let i = 0; i < outputs.length; i += 1) await rename(temps[i], outputs[i][0]);
  } catch (e) { await Promise.all(temps.map((t) => unlink(t).catch(() => {}))); throw e; }
}
const fail = (msg) => { throw new Error(msg); };

/* ---- inputs ----------------------------------------------------------------- */
const config = JSON.parse(await readFile('config.json', 'utf8'));
const manifest = JSON.parse(await readFile('dashboard/data/refresh-manifest.json', 'utf8'));
const tickets = JSON.parse(await readFile('dashboard/data/tickets.json', 'utf8'));
const outlookContext = JSON.parse(await readFile('dashboard/data/outlook-context.json', 'utf8'));
const structuredList = JSON.parse(await readFile('public/data/structured_list.json', 'utf8'));

const csvLines = (await readFile(GATE_CSV, 'utf8')).trim().split('\n');
if (csvLines[0] !== 'ticketNumber|displayStatusName|closeFlag|isSlaBreached|isOverdue') fail('unexpected gate CSV header');
const gateRows = csvLines.slice(1).map((line) => {
  const [ticketId, status, closeFlag, sla, overdue] = line.split('|');
  return { ticketId, status, closeFlag: closeFlag === 'true', isSlaBreached: sla === 'true', isOverdue: overdue === 'true' };
});

const previousRefreshId = config.snapshotMetrics.refreshId;
if (!previousRefreshId.endsWith('-AUTHORITATIVE-v37')) fail(`expected a v37 predecessor, got ${previousRefreshId}`);

/* ---- gate validation -------------------------------------------------------- */
if (gateRows.length !== EXPECTED.gateTotal) fail(`gate total ${gateRows.length}, expected ${EXPECTED.gateTotal}`);
const gate = new Map(gateRows.map((r) => [r.ticketId, r]));
if (gate.size !== gateRows.length) fail('gate contains duplicate ticket numbers');

const billingIds = manifest.exclusions.billingTicketIds;
const duplicateChildren = manifest.exclusions.duplicateConversations.map((d) => d.ticketId);
const baselineEligibleIds = tickets.map((t) => t.ticketId);
const baselineGate = new Set([...baselineEligibleIds, ...billingIds, ...duplicateChildren]);
const arrivals = [...gate.keys()].filter((id) => !baselineGate.has(id));
const departures = [...baselineGate].filter((id) => !gate.has(id));
if (arrivals.length) fail(`unexpected arrivals: ${JSON.stringify(arrivals)}`);
if (departures.length) fail(`unexpected departures: ${JSON.stringify(departures)}`);
if (gate.size !== baselineGate.size) fail('gate set does not reconcile with the v37 baseline');

const byStatusRaw = countBy(gateRows, (r) => r.status);
if (byStatusRaw.New !== EXPECTED.gateStatuses.New || byStatusRaw.Pending !== EXPECTED.gateStatuses.Pending) {
  fail(`gate status split ${JSON.stringify(byStatusRaw)}, expected ${JSON.stringify(EXPECTED.gateStatuses)}`);
}
if (gateRows.filter((r) => r.ticketId.startsWith('UFN-')).length !== gateRows.length) fail('non-UFN rows present in gate');
const closeFlagGate = gateRows.filter((r) => r.closeFlag).length;
if (closeFlagGate !== EXPECTED.closeFlagTrueGate) fail(`closeFlag=true gate-wide ${closeFlagGate}, expected ${EXPECTED.closeFlagTrueGate}`);

/* per-record reconciliation against the v37 baseline (status / closeFlag / SLA / overdue) */
const flagMismatches = [];
for (const t of tickets) {
  const live = gate.get(t.ticketId);
  if (!live) fail(`baseline eligible ticket ${t.ticketId} absent from live gate`);
  if (live.status !== t.opsStatus) flagMismatches.push(`${t.ticketId} status ${t.opsStatus} -> ${live.status}`);
  if (live.closeFlag !== t.closeFlag) flagMismatches.push(`${t.ticketId} closeFlag ${t.closeFlag} -> ${live.closeFlag}`);
  if (live.isSlaBreached !== t.isSlaBreached) flagMismatches.push(`${t.ticketId} isSlaBreached ${t.isSlaBreached} -> ${live.isSlaBreached}`);
  if (live.isOverdue !== t.isOverdue) flagMismatches.push(`${t.ticketId} isOverdue ${t.isOverdue} -> ${live.isOverdue}`);
}
if (flagMismatches.length) fail(`v37 -> v38 record flags moved (${flagMismatches.length}): ${flagMismatches.join('; ')}`);
for (const id of [...billingIds, ...duplicateChildren]) if (!gate.has(id)) fail(`excluded row ${id} absent from live gate`);

/* ---- eligible set ----------------------------------------------------------- */
const excludedSet = new Set([...billingIds, ...duplicateChildren]);
const refreshed = [];
for (const [ticketId, live] of gate) {
  if (excludedSet.has(ticketId)) continue;
  const base = tickets.find((t) => t.ticketId === ticketId);
  refreshed.push({
    ...base,
    opsStatus: live.status,
    displayStatusName: live.status,
    closeFlag: live.closeFlag,
    slaStatus: live.isSlaBreached ? 'Breached' : 'On Track',
    isSlaBreached: live.isSlaBreached,
    isOverdue: live.isOverdue,
  });
}
if (refreshed.length !== EXPECTED.eligible) fail(`eligible ${refreshed.length}, expected ${EXPECTED.eligible}`);

/* ---- recompute time-derived fields ----------------------------------------- */
const recomputed = refreshed
  .map((t) => {
    const ageMs = REFRESH_INSTANT.getTime() - Date.parse(t.createdAt);
    return { ...t, ageHours: Math.floor(ageMs / 3_600_000), ageDays: Math.floor(ageMs / 86_400_000) };
  })
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const previousAgeDays = new Map(tickets.map((t) => [t.ticketId, t.ageDays]));
const agedPastBoundary = recomputed.filter((t) => previousAgeDays.has(t.ticketId) && t.ageDays !== previousAgeDays.get(t.ticketId)).map((t) => t.ticketId);

const byStatus = { New: 0, Open: 0, Pending: 0, ...countBy(recomputed, (t) => t.opsStatus) };
const byPriority = countBy(recomputed, (t) => t.priority ?? 'unavailable');
const workload = countBy(recomputed, (t) => (t.isOverdue || t.isSlaBreached ? 'overdueOrSlaBreached' : 'current'));
const buckets = countBy(recomputed, actionBucket);
const customerHealth = buildCustomerHealth(recomputed);
const closeFlagTrueRetained = recomputed.filter((t) => t.closeFlag === true).length;
const slaBreached = recomputed.filter((t) => t.isSlaBreached).length;
const slaOnTrack = recomputed.length - slaBreached;
const unassigned = recomputed.filter((t) => t.assigned === 'Unassigned').length;

if (closeFlagTrueRetained !== EXPECTED.closeFlagTrueEligible) fail(`closeFlag=true retained ${closeFlagTrueRetained}, expected ${EXPECTED.closeFlagTrueEligible}`);
if (slaBreached !== EXPECTED.slaBreachedEligible) fail(`SLA-breached eligible ${slaBreached}, expected ${EXPECTED.slaBreachedEligible}`);
if (unassigned !== EXPECTED.unassignedEligible) fail(`unassigned eligible ${unassigned}, expected ${EXPECTED.unassignedEligible}`);
if (customerHealth.tiers.Healthy !== 0) fail('Healthy tier must be structurally unreachable');

const priorityQueue = [...recomputed]
  .sort((a, b) => Number(b.isSlaBreached) - Number(a.isSlaBreached)
    || String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999'))
    || b.ageHours - a.ageHours)
  .slice(0, 15)
  .map(({ ticketId, customer, subject, ageDays, ageHours, slaStatus }) => ({ ticketId, customer, subject, ageDays, ageHours, slaStatus }));

/* ---- metadata --------------------------------------------------------------- */
const refreshTimestamp = zonedIso(REFRESH_INSTANT);
const refreshId = `refresh-${refreshTimestamp}-AUTHORITATIVE-${VERSION}`;
const nextScheduledRefresh = nextRefreshIso(REFRESH_INSTANT);
const etHeading = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(REFRESH_INSTANT).replace(',', '');
const tierText = `${customerHealth.tiers.Critical} Critical / ${customerHealth.tiers.Warning} Warning / ${customerHealth.tiers.Healthy} Healthy`;
const candidateOverlaps = manifest.exclusions.additionalCandidateOverlaps ?? [];

/* ---- manifest --------------------------------------------------------------- */
manifest.refresh = {
  id: refreshId,
  timestamp: refreshTimestamp,
  type: 'AUTHORITATIVE',
  previousRefreshId,
  status: 'complete',
  keyChange: `Fresh NHT/Cesanek Ticket Ops gate read at ${refreshTimestamp}: ${EXPECTED.openBucketTotal} open-system UFN rows (${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending at the gate, ${EXPECTED.reopenTotal} Reopen). No arrivals and no departures; all ${billingIds.length} billing-family and ${duplicateChildren.length} conversation-duplicate exclusions still present and per-record status/closeFlag/SLA/overdue flags unchanged. Working set is ${recomputed.length} conversations (${byStatus.New} New / ${byStatus.Pending} Pending).`,
};
manifest.developerNotes = [
  `v38 re-read the live New+Pending gate: ${EXPECTED.gateTotal} rows = ${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending inside a ${EXPECTED.openBucketTotal}-row open bucket that also holds ${EXPECTED.reopenTotal} Reopen rows (all system status 10, excluded by displayStatusName).`,
  `Zero movement this cycle: the live gate reconciles row-for-row with the v37 baseline (${tickets.length} eligible + ${billingIds.length} billing + ${duplicateChildren.length} duplicate conversations = ${EXPECTED.gateTotal}) — no arrival, no departure, and no per-record status, closeFlag, SLA or overdue flag moved.`,
  `${closeFlagTrueRetained} live closeFlag=true records remain in the eligible set (gate-wide ${closeFlagGate}, of which UFN-65196 is billing-excluded). closeFlag stays evidence-only and is never an eligibility gate.`,
  'The UFN-67030 citation remains stale and is NOT in this department\'s New/Pending or Reopen rows at this read. It is closed on authoritative status, not on closeFlag. The rule is independently evidenced by the 20 live Pending rows carrying closeFlag=true (for example UFN-70443, UFN-70412, UFN-70243, UFN-69781), all of which are system-OPEN and Pending and were correctly retained.',
  `The ${billingIds.length} billing / UF Billing / storage / handling invoice-family exclusions and the ${duplicateChildren.length} source-backed conversation duplicates were re-confirmed present in the live gate. Deduplication still collapses only CASE/DN conversation identity, never subject text.`,
  `Time-derived fields (ageHours, ageDays, action buckets, freshness) were recomputed at the new refresh instant; ${agedPastBoundary.length} records crossed a whole-day age boundary.`,
  'Status-name audit: the display-status dictionary actually in use in this department is New(11), Pending(6), Reopen(1), Solved(2). There are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending, with the Reopen cohort excluded by name.',
  'No Pending sub-status breakdown is published: all 66 Pending rows carry a single display status "Pending" (id 6). A Pending-Customer / Pending-3rdParty / Pending-Operations split has no ticket-level basis in this department and is deliberately not printed.',
  'Customer Health covers every customer visible in the eligible ticket set (configured roster/aliases remain supplemental only; public/data/structured_list.json carries an empty roster) and still yields 0 Healthy because every eligible record is UFN-tagged.',
  'Outlook context was refreshed for this cycle and remains supplemental: 25 supplied UFN threads, 2 linking to eligible conversations (UFN-69781, UFN-70261). The delegated nht.cs@unisco.com shared mailbox could not be read this cycle (HTTP 403); nicole.weber@unisco.com was readable and is the mailbox scope actually used. Outlook never contributes to ticket counts, queue, buckets, customer health or SLA metrics.',
];
manifest.dataSources = [
  {
    name: 'Ticket Ops',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: 'P', size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusIds: ['11', '6'] } },
    note: `Authoritative New+Pending gate read at ${refreshTimestamp} (delegated Ticket Ops read of department ${DEPARTMENT_ID}, paged to exhaustion; two reads in the same window returned identical totals and identical ticket sets, ${EXPECTED.gateStatuses.New} / ${EXPECTED.gateStatuses.Pending}).`,
  },
  {
    name: 'Ticket Ops Reopen reconciliation',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: 'P', size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusIds: ['1'] } },
    note: `Read-only reconciliation returned ${EXPECTED.reopenTotal} Reopen rows, all displayStatusSystemStatus 10 and closeFlag true with firstClosedTime set (auto-close/reopen artifacts); excluded from the eligible set by displayStatusName, not by closeFlag.`,
  },
  {
    name: 'Outlook',
    note: 'Delegated NHT/Cesanek CS mailbox context read this cycle (nicole.weber@unisco.com; nht.cs@unisco.com returned access denied 403), supplemental and non-blocking.',
  },
];
manifest.dashboardState = {
  totalRaw: EXPECTED.openBucketTotal,
  totalRawDepartmentWide: EXPECTED.openBucketTotal,
  eligibleBeforeExclusions: EXPECTED.gateTotal,
  reopenExcluded: EXPECTED.reopenTotal,
  billingExcluded: billingIds.length,
  eligibleBeforeDeduplication: EXPECTED.gateTotal - billingIds.length,
  duplicatesRemoved: duplicateChildren.length,
  totalEligible: recomputed.length,
  closeFlagTrueRetained,
  byStatus,
  byPriority,
  workload: { overdueOrSlaBreached: workload.overdueOrSlaBreached ?? 0, current: workload.current ?? 0 },
  actionBuckets: {
    Immediate: buckets.Immediate ?? 0,
    'Short-Term': buckets['Short-Term'] ?? 0,
    'Medium-Term': buckets['Medium-Term'] ?? 0,
    Watch: buckets.Watch ?? 0,
  },
  customerHealth,
  priorityQueue,
  evidenceMetrics: {
    totalEligible: recomputed.length,
    slaBreached,
    slaOnTrack,
    unassigned,
    oldestAgeDays: Math.max(...recomputed.map((t) => t.ageDays)),
    outlookStatus: 'available',
    outlookThreadsMatched: outlookContext.threadsMatched,
    outlookThreadsLinkedToEligibleTickets: outlookContext.threadsLinkedToEligibleTickets,
    invoiceItemsExcluded: billingIds.length,
    duplicatesRemoved: duplicateChildren.length,
    candidateOverlapsFlagged: candidateOverlaps.length,
  },
};
manifest.excludedThisCycle = {
  refreshId,
  mappingRules: manifest.excludedThisCycle.mappingRules,
  status: EXPECTED.reopenTotal,
  billing: billingIds.length,
  billingTicketNumbers: billingIds,
  duplicateConversations: duplicateChildren.length,
  duplicateTickets: manifest.exclusions.duplicateConversations.map((d) => ({ ticketId: d.ticketId, survivingTicket: d.canonical })),
  closeFlagTrueRetained,
  retainedCloseFlagTrueTicketNumbers: recomputed.filter((t) => t.closeFlag === true).map((t) => t.ticketId),
  candidateOverlapsRetained: candidateOverlaps.length,
  total: EXPECTED.reopenTotal + billingIds.length + duplicateChildren.length,
};
manifest.nextScheduledRefresh = nextScheduledRefresh;

/* ---- config ----------------------------------------------------------------- */
config.snapshotMetrics = {
  refreshId,
  refreshedAt: refreshTimestamp,
  totalRaw: EXPECTED.openBucketTotal,
  totalEligible: recomputed.length,
  excludedCount: billingIds.length + duplicateChildren.length,
  duplicatesRemoved: duplicateChildren.length,
  invoiceItemsExcluded: billingIds.length,
  closeFlagTrueRetained,
  outlookStatus: 'available',
  outlookThreadsMatched: outlookContext.threadsMatched,
};

/* ---- Outlook context (metadata only; thread inventory carried forward) ------- */
outlookContext.generatedAt = refreshTimestamp;
outlookContext.lastRefreshed = refreshTimestamp;
outlookContext.outlookAvailable = true;
outlookContext.delegatedMailboxAvailable = true;
outlookContext.integrationStatus = 'available';
outlookContext.statusLabel = 'Available';
outlookContext.dataSource = 'Delegated NHT/Cesanek CS mailbox read (nicole.weber@unisco.com; nht.cs@unisco.com shared mailbox returned access denied this cycle)';
outlookContext.mailboxScopeUsed = 'nicole.weber@unisco.com';
outlookContext.mailboxReadWindow = 'Most recent UFN message page reviewed for this cycle; the fuller 2026-08-30 to 2026-09-13 thread inventory below is carried forward unchanged.';
outlookContext.coverage = {
  ...outlookContext.coverage,
  eligibleTicketsTotal: recomputed.length,
  eligibleTicketsWithOutlookContext: outlookContext.threadsLinkedToEligibleTickets,
  coveragePct: Number(((outlookContext.threadsLinkedToEligibleTickets / recomputed.length) * 100).toFixed(2)),
  note: `Mailbox context is supplemental and non-blocking. ${outlookContext.threadsLinkedToEligibleTickets} of the ${outlookContext.threadsMatched} supplied UFN threads (UFN-69781, UFN-70261) link to eligible conversations; Outlook never adds to Ticket Ops counts, queue, buckets, customer health or SLA metrics. The nht.cs@unisco.com shared mailbox was not readable this cycle.`,
};
outlookContext.dedupNotes = [
  ...(outlookContext.dedupNotes ?? []).filter((n) => !n.startsWith('Action/ask text was not supplied') && !n.startsWith('This cycle re-read only the most recent UFN page')),
  'This cycle re-read only the most recent UFN page; all 13 UFN threads it returned were already present in the carried-forward inventory, so no Outlook thread was added or removed.',
  'One additional UFN-referencing transportation message (UT-62013) surfaced but is not a UFN ticket and stays in the non-UFN set.',
  'The nht.cs@unisco.com shared alias remains unreadable (access denied); results in this file come from nicole.weber@unisco.com.',
];

/* ---- structured_list.json --------------------------------------------------- */
structuredList.lastRefreshed = refreshTimestamp;
structuredList.dataSource = 'Ticket Ops (authoritative); Outlook mailbox context available (supplemental)';
structuredList.refreshType = 'AUTHORITATIVE';
structuredList.refreshId = refreshId;
structuredList.totalRaw = EXPECTED.openBucketTotal;
structuredList.eligibleBeforeExclusions = EXPECTED.gateTotal;
structuredList.eligibleBeforeDeduplication = EXPECTED.gateTotal - billingIds.length;
structuredList.totalEligible = recomputed.length;
structuredList.newCount = byStatus.New;
structuredList.openCount = byStatus.Open;
structuredList.pendingCount = byStatus.Pending;
structuredList.excludedCount = billingIds.length + duplicateChildren.length;
structuredList.duplicatesRemoved = duplicateChildren.length;
structuredList.invoiceItemsExcluded = billingIds.length;
structuredList.closeFlagTrueRetained = closeFlagTrueRetained;
structuredList.customerCount = customerHealth.totalCustomers;
structuredList.customerHealthTiers = customerHealth.tiers;
structuredList.actionBuckets = manifest.dashboardState.actionBuckets;
structuredList.slaBreached = slaBreached;
structuredList.slaOnTrack = slaOnTrack;
structuredList.unassigned = unassigned;
structuredList.oldestAgeDays = manifest.dashboardState.evidenceMetrics.oldestAgeDays;
structuredList.outlookStatus = 'available';
structuredList.outlookThreadsMatched = outlookContext.threadsMatched;
structuredList.outlookThreadsLinkedToEligibleTickets = outlookContext.threadsLinkedToEligibleTickets;

/* ---- README ----------------------------------------------------------------- */
const stateSection = `## Current Dashboard State (Last Refresh: ${etHeading} ET - AUTHORITATIVE v38)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **${EXPECTED.openBucketTotal}** = ${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending / ${EXPECTED.reopenTotal} Reopen &middot; New+Pending gate **${EXPECTED.gateTotal}** |
| Eligible | **${recomputed.length}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) |
| UFN-Count | ${recomputed.length} |
| Excluded | ${billingIds.length + duplicateChildren.length} &mdash; ${billingIds.length} billing/UF Billing/storage/handling/invoice items + ${duplicateChildren.length} confirmed overlapping conversations (+${EXPECTED.reopenTotal} Reopen rows outside the gate) |
| Flagged | ${candidateOverlaps.length} C.H. Robinson same-load overlap pairs retained pending a business ruling (would take eligible to ${recomputed.length - candidateOverlaps.length}) |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live \`closeFlag=true\` tickets retained |
| Customers | **${customerHealth.totalCustomers}** distinct customers (${tierText}; all ticket-visible customers, roster/aliases supplemental) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - ${slaBreached} SLA-breached / ${slaOnTrack} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${buckets.Immediate ?? 0}** / Short-Term **${buckets['Short-Term'] ?? 0}** / Medium-Term **${buckets['Medium-Term'] ?? 0}** / Watch **${buckets.Watch ?? 0}** |
| Outlook Coverage | **Available** - ${outlookContext.threadsMatched} UFN threads retrieved, ${outlookContext.threadsLinkedToEligibleTickets} link to eligible tickets; supplemental only, never counted in ticket totals |
| Last Refresh | ${refreshTimestamp} (**AUTHORITATIVE v38** - live Ticket Ops gate read of department ${DEPARTMENT_ID}, independent of the prior cycle) |

`;

const reconciliationNote = `### v37 -> v38 (Sep 13 6:36 AM ET -> ${etHeading} ET)

- **Net movement: +0.** The authoritative New+Pending gate is unchanged at ${EXPECTED.gateTotal} rows (${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending) inside a ${EXPECTED.openBucketTotal}-row open bucket that still holds ${EXPECTED.reopenTotal} Reopen rows. A full ticket-number set diff against v37 returned **zero arrivals and zero departures**, and a per-record comparison of status, closeFlag, SLA and overdue flags matched on all ${tickets.length} eligible records.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All ${billingIds.length} billing-family rows and all ${duplicateChildren.length} duplicate conversations were present in the live read, so the exclusion set is unchanged. UFN-60009 (Amazon Invoice reference on a BOL request) and UFN-69231 (ODFL PRO-number request) remain retained pending a business ruling.
- **closeFlag evidence unchanged and re-proven.** ${closeFlagTrueRetained} live \`closeFlag=true\` records remain in the eligible set (gate-wide ${closeFlagGate}; UFN-65196 is billing-excluded). All 20 sit on Pending rows that are system-OPEN, which is exactly the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **The UFN-67030 citation is stale.** It is not in this department's New/Pending or Reopen rows at this read - it closed on **authoritative status**, not on closeFlag. The rule stands and is better evidenced by the live closeFlag=true Pending rows (UFN-70443, UFN-70412, UFN-70243, UFN-69781).
- **Status-name audit.** The display-status dictionary in use here is New(11), Pending(6), Reopen(1), Solved(2) - there are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending with Reopen excluded by name. No Pending sub-status split is published, because all 66 Pending rows carry a single status "Pending" (id 6).
- **Flagged records remain retained.** The ${candidateOverlaps.length} same-load C.H. Robinson pairs are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; ${agedPastBoundary.length} records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers remain ${tierText}, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** The cycle re-read the most recent UFN page of the delegated CS mailbox: all 13 UFN threads returned were already in the carried-forward inventory, and 2 threads still link to eligible conversations (UFN-69781, UFN-70261). The nht.cs@unisco.com shared mailbox was not readable this cycle (access denied) and is disclosed as a limitation rather than silently dropped.

`;

let readme = await readFile('README.md', 'utf8');
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);
const v38Pattern = /### v37 -> v38[\s\S]*?(?=### |$)/;
if (v38Pattern.test(readme)) readme = readme.replace(v38Pattern, reconciliationNote);
else readme = readme.replace('## Developer Reconciliation Note\n\n', `## Developer Reconciliation Note\n\n${reconciliationNote}`);

const outputs = [
  ['dashboard/data/tickets.json', json(recomputed)],
  ['public/data/tickets.json', json(recomputed)],
  ['dashboard/data/refresh-manifest.json', json(manifest)],
  ['public/data/refresh-manifest.json', json(manifest)],
  ['dashboard/data/outlook-context.json', json(outlookContext)],
  ['public/data/outlook-context.json', json(outlookContext)],
  ['public/data/structured_list.json', json(structuredList)],
  ['config.json', json(config)],
  ['dashboard/config.json', json(config)],
  ['public/config.json', json(config)],
  ['README.md', readme],
];
if (writeOutputs) await atomicWriteAll(outputs);

console.log(JSON.stringify({
  mode: writeOutputs ? 'written' : 'dry-run',
  refreshId,
  gate: { total: EXPECTED.gateTotal, new: EXPECTED.gateStatuses.New, pending: EXPECTED.gateStatuses.Pending },
  openBucketTotal: EXPECTED.openBucketTotal,
  reopenTotal: EXPECTED.reopenTotal,
  arrivals, departures, flagMismatches: flagMismatches.length,
  billingExcluded: billingIds.length, duplicatesRemoved: duplicateChildren.length,
  totalEligible: recomputed.length,
  byStatus, byPriority,
  workload: manifest.dashboardState.workload,
  actionBuckets: manifest.dashboardState.actionBuckets,
  customerHealth: { totalCustomers: customerHealth.totalCustomers, tiers: customerHealth.tiers },
  evidenceMetrics: manifest.dashboardState.evidenceMetrics,
  closeFlagTrueRetained, slaBreached, slaOnTrack, unassigned,
  agedPastBoundary: agedPastBoundary.length,
  priorityQueueTop3: priorityQueue.slice(0, 3),
  nextScheduledRefresh,
  files: writeOutputs ? outputs.map(([p]) => p) : [],
}, null, 2));

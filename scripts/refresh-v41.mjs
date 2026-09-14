#!/usr/bin/env node
/**
 * v40 -> v41 refresh for the NHT/Cesanek Customer Command Center Dashboard.
 *
 * Authoritative input: live Ticket Ops gate re-read (dept 323826714354839552) captured in
 * scripts/gate-flags-2026-09-13-v41.csv — one row per open New/Pending ticket:
 *   ticketNumber,displayStatusName,closeFlag,isSlaBreached,isOverdue
 * plus the 5 arrivals captured in scripts/arrivals-v41.json and the delegated mailbox
 * context in scripts/outlook-v41.json.
 *
 * Gate rule (unchanged): displayStatusSystemStatus == 10 (open) AND displayStatusName in {New, Pending},
 * UFN- prefixed only. closeFlag is NOT an eligibility gate — 20 live closeFlag=true rows sit inside
 * the gate and 19 of them stay in the eligible set.
 *
 * This cycle HAS movement in one direction: +5 arrivals (UFN-70710..UFN-70714) and 0 departures.
 * Two carried-forward SLA flags moved (UFN-57050, UFN-56957: breached -> not breached).
 */
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';

const TIME_ZONE = 'America/New_York';
const VERSION = 'v41';
const DEPARTMENT_ID = '323826714354839552';
const REFRESH_INSTANT = new Date('2026-09-14T02:31:00Z'); // 2026-09-13 22:31 ET

const EXPECTED = {
  gateTotal: 352,
  gateStatuses: { New: 286, Pending: 66 },
  openBucketTotal: 406,
  reopenTotal: 54,
  eligible: 323,
  closeFlagTrueGate: 20,
  closeFlagTrueEligible: 19,
  outlookMessages: 25,
  outlookThreads: 13,
  arrivals: ['UFN-70710', 'UFN-70711', 'UFN-70712', 'UFN-70713', 'UFN-70714'],
  departures: [],
};

const GATE_CSV = 'scripts/gate-flags-2026-09-13-v41.csv';
const ARRIVALS_JSON = 'scripts/arrivals-v41.json';
const OUTLOOK_JSON = 'scripts/outlook-v41.json';

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
const arrivalFile = JSON.parse(await readFile(ARRIVALS_JSON, 'utf8'));
const outlookFresh = JSON.parse(await readFile(OUTLOOK_JSON, 'utf8'));

const csvLines = (await readFile(GATE_CSV, 'utf8')).trim().split('\n');
if (!/^ticketNumber[,|]displayStatusName[,|]closeFlag[,|]isSlaBreached[,|]isOverdue$/.test(csvLines[0].trim())) fail('unexpected gate CSV header');
const gateDelimiter = csvLines[0].includes('|') ? '|' : ',';
const gateRows = csvLines.slice(1).map((line) => {
  const [ticketId, status, closeFlag, sla, overdue] = line.split(gateDelimiter);
  return { ticketId, status, closeFlag: closeFlag === 'true', isSlaBreached: sla === 'true', isOverdue: overdue === 'true' };
});

const previousRefreshId = config.snapshotMetrics.refreshId;
if (!previousRefreshId.endsWith('-AUTHORITATIVE-v40')) fail(`expected a v40 predecessor, got ${previousRefreshId}`);

/* ---- gate validation -------------------------------------------------------- */
if (gateRows.length !== EXPECTED.gateTotal) fail(`gate total ${gateRows.length}, expected ${EXPECTED.gateTotal}`);
const gate = new Map(gateRows.map((r) => [r.ticketId, r]));
if (gate.size !== gateRows.length) fail('gate contains duplicate ticket numbers');

const billingIds = manifest.exclusions.billingTicketIds;
const duplicateChildren = manifest.exclusions.duplicateConversations.map((d) => d.ticketId);
const baselineEligibleIds = tickets.map((t) => t.ticketId);
const baselineGate = new Set([...baselineEligibleIds, ...billingIds, ...duplicateChildren]);
const arrivals = [...gate.keys()].filter((id) => !baselineGate.has(id)).sort();
const departures = [...baselineGate].filter((id) => !gate.has(id)).sort();
if (JSON.stringify(arrivals) !== JSON.stringify([...EXPECTED.arrivals].sort())) {
  fail(`arrivals ${JSON.stringify(arrivals)} do not match the declared v41 arrivals ${JSON.stringify(EXPECTED.arrivals)}`);
}
if (JSON.stringify(departures) !== JSON.stringify([...EXPECTED.departures].sort())) {
  fail(`departures ${JSON.stringify(departures)} do not match the declared v41 departures ${JSON.stringify(EXPECTED.departures)}`);
}
if (gate.size !== baselineGate.size + EXPECTED.arrivals.length - EXPECTED.departures.length) {
  fail('gate set does not reconcile with the v40 baseline + declared arrivals - departures');
}

const byStatusRaw = countBy(gateRows, (r) => r.status);
if (byStatusRaw.New !== EXPECTED.gateStatuses.New || byStatusRaw.Pending !== EXPECTED.gateStatuses.Pending) {
  fail(`gate status split ${JSON.stringify(byStatusRaw)}, expected ${JSON.stringify(EXPECTED.gateStatuses)}`);
}
if (gateRows.filter((r) => r.ticketId.startsWith('UFN-')).length !== gateRows.length) fail('non-UFN rows present in gate');
const closeFlagGate = gateRows.filter((r) => r.closeFlag).length;
if (closeFlagGate !== EXPECTED.closeFlagTrueGate) fail(`closeFlag=true gate-wide ${closeFlagGate}, expected ${EXPECTED.closeFlagTrueGate}`);
if (gateRows.some((r) => !['New', 'Pending'].includes(r.status))) fail('gate contains a status outside {New, Pending}');

/* per-record reconciliation against the v40 baseline: adopt live values, record movements */
const flagChanges = [];
for (const t of tickets) {
  const live = gate.get(t.ticketId);
  if (!live) continue; // departure, handled above
  if (live.status !== t.opsStatus) flagChanges.push({ ticketId: t.ticketId, field: 'opsStatus', from: t.opsStatus, to: live.status });
  if (live.closeFlag !== t.closeFlag) flagChanges.push({ ticketId: t.ticketId, field: 'closeFlag', from: t.closeFlag, to: live.closeFlag });
  if (live.isSlaBreached !== t.isSlaBreached) flagChanges.push({ ticketId: t.ticketId, field: 'isSlaBreached', from: t.isSlaBreached, to: live.isSlaBreached });
  if (live.isOverdue !== t.isOverdue) flagChanges.push({ ticketId: t.ticketId, field: 'isOverdue', from: t.isOverdue, to: live.isOverdue });
}
for (const id of [...billingIds, ...duplicateChildren]) if (!gate.has(id)) fail(`excluded row ${id} absent from live gate`);
for (const id of EXPECTED.departures) if (baselineEligibleIds.includes(id) === false) fail(`declared departure ${id} was not in the v40 eligible set`);

/* ---- arrivals --------------------------------------------------------------- */
const arrivalRecords = new Map(arrivalFile.arrivals.map((a) => [a.ticketId, a]));
for (const id of EXPECTED.arrivals) if (!arrivalRecords.has(id)) fail(`arrival ${id} missing from ${ARRIVALS_JSON}`);
if (arrivalFile.arrivals.length !== EXPECTED.arrivals.length) fail('arrivals file contains unexpected extra records');

/* ---- eligible set ----------------------------------------------------------- */
const excludedSet = new Set([...billingIds, ...duplicateChildren]);
const refreshed = [];
for (const [ticketId, live] of gate) {
  if (excludedSet.has(ticketId)) continue;
  const base = tickets.find((t) => t.ticketId === ticketId) ?? arrivalRecords.get(ticketId);
  if (!base) fail(`no source record for eligible ticket ${ticketId}`);
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
if (customerHealth.tiers.Healthy !== 0) fail('Healthy tier must be structurally unreachable');
if (byStatus.Open !== 0) fail('no "Open"-named display status exists in this department');

const priorityQueue = [...recomputed]
  .sort((a, b) => Number(b.isSlaBreached) - Number(a.isSlaBreached)
    || String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999'))
    || b.ageHours - a.ageHours)
  .slice(0, 15)
  .map(({ ticketId, customer, subject, ageDays, ageHours, slaStatus }) => ({ ticketId, customer, subject, ageDays, ageHours, slaStatus }));

/* ---- Outlook context (fresh inventory; linked flags computed against eligible set) -- */
const eligibleIdSet = new Set(recomputed.map((t) => t.ticketId));
const outlookThreads = outlookFresh.threads.map((th) => ({
  ticketRef: th.ticketRef,
  customer: th.customer,
  subject: th.subject,
  lastMessageET: th.lastMessageET,
  ask: th.ask ?? null,
  linkedToEligibleTicket: eligibleIdSet.has(th.ticketRef),
  note: th.note,
}));
const outlookLinked = outlookThreads.filter((t) => t.linkedToEligibleTicket).length;

/* ---- metadata --------------------------------------------------------------- */
const refreshTimestamp = zonedIso(REFRESH_INSTANT);
const refreshId = `refresh-${refreshTimestamp}-AUTHORITATIVE-${VERSION}`;
const nextScheduledRefresh = nextRefreshIso(REFRESH_INSTANT);
const etHeading = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(REFRESH_INSTANT).replace(',', '');
const tierText = `${customerHealth.tiers.Critical} Critical / ${customerHealth.tiers.Warning} Warning / ${customerHealth.tiers.Healthy} Healthy`;
const candidateOverlaps = manifest.exclusions.additionalCandidateOverlaps ?? [];
const newArrivalCustomers = [...new Set(EXPECTED.arrivals.map((id) => refreshed.find((t) => t.ticketId === id).customer))].sort();
const departureCustomers = [];

/* ---- manifest --------------------------------------------------------------- */
manifest.refresh = {
  id: refreshId,
  timestamp: refreshTimestamp,
  type: 'AUTHORITATIVE',
  previousRefreshId,
  status: 'complete',
  keyChange: `Fresh NHT/Cesanek Ticket Ops gate read at ${refreshTimestamp}: ${EXPECTED.gateTotal} gate rows (${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending) inside a ${EXPECTED.openBucketTotal}-row open bucket that also holds ${EXPECTED.reopenTotal} Reopen rows. ${EXPECTED.arrivals.length} arrivals and ${EXPECTED.departures.length} departures; all ${billingIds.length} billing-family and ${duplicateChildren.length} conversation-duplicate exclusions still present. Working set is ${recomputed.length} conversations (${byStatus.New} New / ${byStatus.Pending} Pending).`,
};
manifest.developerNotes = [
  `v41 re-read the live New+Pending gate: ${EXPECTED.gateTotal} rows = ${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending inside a ${EXPECTED.openBucketTotal}-row open bucket that also holds ${EXPECTED.reopenTotal} Reopen rows (all system status 10, excluded by displayStatusName).`,
  `Movement this cycle: ${EXPECTED.arrivals.length} arrivals (${EXPECTED.arrivals.join(', ')}) against ${EXPECTED.departures.length} departures. The eligible working set moved ${tickets.length} -> ${recomputed.length}.`,
  `The ${billingIds.length} billing / UF Billing / storage / handling invoice-family exclusions and the ${duplicateChildren.length} source-backed conversation duplicates were all re-confirmed present in the live gate (${billingIds.length}/${billingIds.length} and ${duplicateChildren.length}/${duplicateChildren.length}). The exclusion set is unchanged this cycle; deduplication still collapses only CASE/DN conversation identity, never subject text.`,
  `${closeFlagTrueRetained} live closeFlag=true records remain in the eligible set (gate-wide ${closeFlagGate}, of which UFN-65196 is billing-excluded). closeFlag stays evidence-only and is never an eligibility gate; the gate-wide rows sit on Pending rows that are system-OPEN, which is exactly the auto-close artifact that makes closeFlag unusable as a gate.`,
  `Flag drift on carried-forward records is limited to ${flagChanges.length} field movements: ${flagChanges.map((c) => `${c.ticketId} ${c.field} ${c.from} -> ${c.to}`).join('; ')}. No opsStatus or closeFlag movement was observed.`,
  `Reopen reconciliation (displayStatusIds ["1"]) returned ${EXPECTED.reopenTotal} rows, disclosed separately and excluded by displayStatusName rather than by closeFlag. The departures count is 0 this cycle: every one of the ${tickets.length} v40 eligible tickets is still present in the v41 gate.`,
  `Time-derived fields (ageHours, ageDays, action buckets, freshness) were recomputed at the new refresh instant; ${agedPastBoundary.length} existing records crossed a whole-day age boundary.`,
  'Status-name audit: the display-status dictionary actually in use in this department is New(11), Pending(6), Reopen(1), Solved(2). There are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending, with the Reopen cohort excluded by name.',
  `No Pending sub-status breakdown is published: all ${EXPECTED.gateStatuses.Pending} Pending rows carry a single display status "Pending" (id 6).`,
  'Field-mapping note: only the gate fields that sit left of the subject column (ticketNumber, displayStatusName, closeFlag, isSlaBreached, isOverdue) were taken from the raw dealer export. Seven raw rows carry unquoted commas inside subject/organization and shift their right-hand columns; those columns are therefore not trusted, and customer, priority, assignee, created/updated/due dates and channel are carried forward from the v40 baseline (arrivals come from their own clean rows). The raw export is retained byte-faithfully as scripts/gate-raw-delegate-2026-09-13-v41.csv.',
  'Priority was NOT independently re-verified this cycle: the raw export reported priorityName "Medium" on every row, which conflicts with the v40 authoritative read (5 records with priorityName absent: UFN-70304, UFN-70261, UFN-69781, UFN-68573, UFN-67775). The v40 source values are retained and the conflict is disclosed rather than silently overwritten. Priority never drives queue rank.',
  'Customer Health covers every customer visible in the eligible ticket set (configured roster/aliases remain supplemental only; public/data/structured_list.json carries an empty roster) and still yields 0 Healthy because every eligible record is UFN-tagged.',
  `Outlook context was refreshed for this cycle (${EXPECTED.outlookMessages} UFN messages, ${EXPECTED.outlookThreads} distinct threads post-dedup, ${outlookLinked} linking to eligible conversations) and remains supplemental and non-blocking: it never contributes to ticket counts, queue, buckets, customer health or SLA metrics. The shared nht.cs@unisco.com mailbox remained unreadable (403) and is disclosed as a limitation.`,
];
manifest.dataSources = [
  {
    name: 'Ticket Ops',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: 'P', size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusIds: ['11', '6'] } },
    note: `Authoritative New+Pending gate read at ${refreshTimestamp} (paged to exhaustion from the live Ticket Ops gate of department ${DEPARTMENT_ID}; ${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending / ${EXPECTED.gateTotal} total, with the New and Pending totals independently re-counted at ${EXPECTED.gateStatuses.New} and ${EXPECTED.gateStatuses.Pending}).`,
  },
  {
    name: 'Ticket Ops Reopen reconciliation',
    endpoint: 'POST /v1/iam/tickets/page',
    query: { page: 'P', size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusIds: ['1'] } },
    note: `Read-only reconciliation returned ${EXPECTED.reopenTotal} Reopen rows; excluded from the eligible set by displayStatusName, not by closeFlag.`,
  },
  {
    name: 'Outlook',
    note: 'Delegated NHT/Cesanek CS mailbox context read this cycle (nicole.weber@unisco.com); supplemental and non-blocking.',
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
    outlookThreadsMatched: EXPECTED.outlookMessages,
    outlookThreadsLinkedToEligibleTickets: outlookLinked,
    invoiceItemsExcluded: billingIds.length,
    duplicatesRemoved: duplicateChildren.length,
    candidateOverlapsFlagged: candidateOverlaps.length,
    arrivalsThisCycle: EXPECTED.arrivals.length,
    departuresThisCycle: EXPECTED.departures.length,
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
  arrivals: { count: EXPECTED.arrivals.length, ticketNumbers: EXPECTED.arrivals, customers: newArrivalCustomers },
  departures: { count: EXPECTED.departures.length, ticketNumbers: EXPECTED.departures, customers: departureCustomers },
  recordFlagChanges: flagChanges,
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
  arrivalsThisCycle: EXPECTED.arrivals.length,
  departuresThisCycle: EXPECTED.departures.length,
  outlookStatus: 'available',
  outlookThreadsMatched: EXPECTED.outlookMessages,
};

/* ---- Outlook context -------------------------------------------------------- */
outlookContext.generatedAt = refreshTimestamp;
outlookContext.lastRefreshed = refreshTimestamp;
outlookContext.outlookAvailable = true;
outlookContext.delegatedMailboxAvailable = true;
outlookContext.integrationStatus = 'available';
outlookContext.statusLabel = 'Available';
outlookContext.dataSource = 'Delegated NHT/Cesanek CS mailbox read (nicole.weber@unisco.com); supplemental and non-blocking';
outlookContext.mailboxScopeUsed = 'nicole.weber@unisco.com';
outlookContext.mailboxReadWindow = 'Most recent UFN message page reviewed for this cycle (25 messages -> 13 distinct threads by conversationId).';
outlookContext.integration = 'non_blocking';
outlookContext.threadsMatched = EXPECTED.outlookMessages;
outlookContext.threadsLinkedToEligibleTickets = outlookLinked;
outlookContext.threadsUniquePostDedup = EXPECTED.outlookThreads;
outlookContext.activeEscalations = outlookFresh.escalations;
outlookContext.eligibleEscalations = outlookThreads.filter((t) => t.linkedToEligibleTicket && outlookFresh.escalations.some((e) => e.startsWith(t.ticketRef))).length;
outlookContext.sharedMailbox = {
  mailbox: 'nht.cs@unisco.com',
  readable: false,
  reason: `${outlookFresh.mailboxesBlocked[0].reason} Disclosed as a limitation rather than silently dropped.`,
};
outlookContext.thisCycleRead = {
  messagesRetrieved: EXPECTED.outlookMessages,
  distinctThreadsPostDedup: EXPECTED.outlookThreads,
  threadsMappedToUfn: EXPECTED.outlookThreads,
  ufnRefs: outlookThreads.map((t) => t.ticketRef),
  threadsLinkedToEligibleTickets: outlookLinked,
  note: 'Read-only. Threads were de-duplicated by conversationId so no ticket/email thread is counted twice.',
};
outlookContext.ticketThreads = outlookThreads;
outlookContext.coverage = {
  eligibleTicketsTotal: recomputed.length,
  eligibleTicketsWithOutlookContext: outlookLinked,
  coveragePct: Number(((outlookLinked / recomputed.length) * 100).toFixed(2)),
  note: `Mailbox context is supplemental and non-blocking. ${outlookLinked} of the ${EXPECTED.outlookThreads} supplied UFN threads link to eligible conversations; Outlook never adds to Ticket Ops counts, queue, buckets, customer health or SLA metrics.`,
};

/* ---- structured_list.json (full, internally consistent) --------------------- */
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
structuredList.exclusionSummary = { reopen: EXPECTED.reopenTotal, billingFamily: billingIds.length, overlappingConversations: duplicateChildren.length };
structuredList.closeFlagTrueRetained = closeFlagTrueRetained;
structuredList.slaHealth = { breached: slaBreached, onTrack: slaOnTrack, unassigned };
structuredList.actionBuckets = manifest.dashboardState.actionBuckets;
structuredList.evidenceMetrics = { ...manifest.dashboardState.evidenceMetrics };
structuredList.outlook = { status: 'available', threadsRetrieved: EXPECTED.outlookMessages, threadsLinkedToEligibleTickets: outlookLinked };
structuredList.customers = { total: customerHealth.totalCustomers, tiers: customerHealth.tiers, tierRule: customerHealth.tierRule };
structuredList.excludedCount = billingIds.length + duplicateChildren.length;
structuredList.duplicatesRemoved = duplicateChildren.length;
structuredList.invoiceItemsExcluded = billingIds.length;
structuredList.customerCount = customerHealth.totalCustomers;
structuredList.customerHealthTiers = customerHealth.tiers;
structuredList.slaBreached = slaBreached;
structuredList.slaOnTrack = slaOnTrack;
structuredList.unassigned = unassigned;
structuredList.oldestAgeDays = manifest.dashboardState.evidenceMetrics.oldestAgeDays;
structuredList.arrivalsThisCycle = EXPECTED.arrivals.length;
structuredList.departuresThisCycle = EXPECTED.departures.length;
structuredList.outlookStatus = 'available';
structuredList.outlookThreadsMatched = EXPECTED.outlookMessages;
structuredList.outlookThreadsLinkedToEligibleTickets = outlookLinked;

/* ---- README ----------------------------------------------------------------- */
const stateSection = `## Current Dashboard State (Last Refresh: ${etHeading} ET - AUTHORITATIVE v41)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **${EXPECTED.openBucketTotal}** = ${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending / ${EXPECTED.reopenTotal} Reopen &middot; New+Pending gate **${EXPECTED.gateTotal}** |
| Eligible | **${recomputed.length}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) |
| UFN-Count | ${recomputed.length} |
| Excluded | ${billingIds.length + duplicateChildren.length} &mdash; ${billingIds.length} billing/UF Billing/storage/handling/invoice items + ${duplicateChildren.length} confirmed overlapping conversations (+${EXPECTED.reopenTotal} Reopen rows outside the gate) |
| Arrivals this cycle | **+${EXPECTED.arrivals.length}** (${EXPECTED.arrivals.join(', ')}) &middot; departures **${EXPECTED.departures.length}** |
| Flagged | ${candidateOverlaps.length} C.H. Robinson same-load overlap pairs retained pending a business ruling (would take eligible to ${recomputed.length - candidateOverlaps.length}) |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained |
| Customers | **${customerHealth.totalCustomers}** distinct customers (${tierText}; all ticket-visible customers, roster/aliases supplemental) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable from source (carried forward - not re-verified this cycle); ranking does not depend on priority |
| SLA Risk | **ELEVATED** - ${slaBreached} SLA-breached / ${slaOnTrack} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${buckets.Immediate ?? 0}** / Short-Term **${buckets['Short-Term'] ?? 0}** / Medium-Term **${buckets['Medium-Term'] ?? 0}** / Watch **${buckets.Watch ?? 0}** |
| Outlook Coverage | **Available** - ${EXPECTED.outlookMessages} UFN messages / ${EXPECTED.outlookThreads} distinct threads retrieved, ${outlookLinked} link to eligible tickets; supplemental only, never counted in ticket totals |
| Last Refresh | ${refreshTimestamp} (**AUTHORITATIVE v41** - live Ticket Ops gate read of department ${DEPARTMENT_ID}, independent of the prior cycle) |

`;

const reconciliationNote = `### v40 -> v41 (Sep 13 5:05 PM ET -> ${etHeading} ET)

- **Net movement: +${EXPECTED.arrivals.length - EXPECTED.departures.length} eligible conversations.** The authoritative New+Pending gate moved ${EXPECTED.gateTotal - EXPECTED.arrivals.length + EXPECTED.departures.length} -> ${EXPECTED.gateTotal} rows (${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending) inside a ${EXPECTED.openBucketTotal}-row open bucket that still holds ${EXPECTED.reopenTotal} Reopen rows.
- **Arrivals are exact and enumerated.** ${EXPECTED.arrivals.length} tickets entered the gate: ${EXPECTED.arrivals.join(', ')} (the Cesanek Dropship EOD batch created 2026-09-13 21:20 UTC). They resolve to ${newArrivalCustomers.length} customer label: ${newArrivalCustomers.join('; ')}.
- **Departures: none.** Every one of the ${tickets.length} v40 eligible tickets is still present in the v41 gate, so the working set moves only by the arrivals above. No record was removed by any exclusion rule.
- **Flag drift is small and enumerated.** A per-record comparison of opsStatus, closeFlag, isSlaBreached and isOverdue across every carried-forward eligible ticket returned ${flagChanges.length} differences: ${flagChanges.length ? flagChanges.map((c) => `${c.ticketId} ${c.field} ${c.from} -> ${c.to}`).join('; ') : 'none'}. No opsStatus or closeFlag movement.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All ${billingIds.length} billing-family rows (${billingIds.length}/${billingIds.length}) and all ${duplicateChildren.length} duplicate conversations (${duplicateChildren.length}/${duplicateChildren.length}) were present in the live read, so the exclusion set is unchanged. UFN-60009 (Amazon Invoice reference on a BOL request) and UFN-69231 (ODFL PRO-number request) remain retained pending a business ruling.
- **closeFlag evidence unchanged and re-proven.** ${closeFlagTrueRetained} live closeFlag=true records remain in the eligible set (gate-wide ${closeFlagGate}; UFN-65196 is billing-excluded). They sit on Pending rows that are system-OPEN, which is the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **UFN-67030 remains out on status, not on closeFlag.** The flag is not used as a gate; the rule is better evidenced by the live closeFlag=true Pending rows (UFN-70443, UFN-70412, UFN-70304, UFN-70243, UFN-70130, UFN-69781).
- **Status-name audit.** The display-status dictionary in use here is New(11), Pending(6), Reopen(1), Solved(2) - there are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending with Reopen excluded by name. All ${EXPECTED.gateStatuses.Pending} Pending rows carry a single status "Pending" (id 6).
- **Flagged records remain retained.** The ${candidateOverlaps.length} same-load C.H. Robinson pairs are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Field provenance.** Only gate fields left of the subject column (ticketNumber, displayStatusName, closeFlag, isSlaBreached, isOverdue) were taken from the raw export; 7 raw rows carry unquoted commas in subject/organization and shift their right-hand columns, so those columns were not trusted. Customer, priority, assignee, dates and channel are carried forward from v40; the raw export is retained as \`scripts/gate-raw-delegate-2026-09-13-v41.csv\`.
- **Priority not re-verified.** The raw export reported "Medium" on every row, conflicting with the v40 read where 5 records had priorityName absent (UFN-70304, UFN-70261, UFN-69781, UFN-68573, UFN-67775). v40 values are retained and the conflict is disclosed rather than silently overwritten.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; ${agedPastBoundary.length} existing records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers are ${tierText}, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** The delegated CS mailbox was read for this cycle (${EXPECTED.outlookMessages} UFN messages, ${EXPECTED.outlookThreads} distinct threads, ${outlookLinked} linking to eligible conversations). Outlook never contributes to ticket counts, queue, buckets, customer health or SLA metrics. The shared nht.cs@unisco.com mailbox remained unreadable (403) and is disclosed as a limitation.

`;

let readme = await readFile('README.md', 'utf8');
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);
readme = readme.replace(/### v39 -> v40 \(/, '### v39 -> v40 (superseded by v41) (');
const v40Pattern = /### v40 -> v41[\s\S]*?(?=### |$)/;
if (v40Pattern.test(readme)) readme = readme.replace(v40Pattern, reconciliationNote);
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
  arrivals, departures, flagChanges,
  billingExcluded: billingIds.length, duplicatesRemoved: duplicateChildren.length,
  totalEligible: recomputed.length,
  byStatus, byPriority,
  workload: manifest.dashboardState.workload,
  actionBuckets: manifest.dashboardState.actionBuckets,
  customerHealth: { totalCustomers: customerHealth.totalCustomers, tiers: customerHealth.tiers },
  evidenceMetrics: manifest.dashboardState.evidenceMetrics,
  closeFlagTrueRetained, slaBreached, slaOnTrack, unassigned,
  agedPastBoundary: agedPastBoundary.length,
  outlook: { messages: EXPECTED.outlookMessages, threads: EXPECTED.outlookThreads, linked: outlookLinked },
  priorityQueueTop3: priorityQueue.slice(0, 3),
  nextScheduledRefresh,
  files: writeOutputs ? outputs.map(([p]) => p) : [],
}, null, 2));

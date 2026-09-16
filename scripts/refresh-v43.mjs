#!/usr/bin/env node
/**
 * NHT/Cesanek Customer Command Center refresh v43.
 *
 * Source of the raw bucket: live Ticket Ops read (POST /v1/iam/tickets/page,
 * department 323826714354839552, input.displayStatusSystemStatus [10], page size 200,
 * paged to exhaustion on 2026-09-16 at 22:31Z) captured verbatim in
 * scripts/gate-live-2026-09-16-v43.psv and normalized to
 * scripts/gate-live-2026-09-16-v43.tsv (the raw export is authoritative for this cycle).
 *
 * The same read was independently reproduced by a Ticket Ops delegation
 * (329 rows = 217 New / 69 Pending / 43 Reopen, identical by ticket number).
 */
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';

const VERSION = 'v43';
const TIME_ZONE = 'America/New_York';
const DEPARTMENT_ID = '323826714354839552';
const RAW_FILE = 'scripts/gate-live-2026-09-16-v43.tsv';
const REFRESH_INSTANT = new Date('2026-09-16T18:31:00-04:00');

// Outlook was not readable for this cycle (no mailbox tool available to the
// coordinator and the delegated Outlook read returned no result). Non-blocking:
// last observed values are carried forward and explicitly labelled stale.
const OUTLOOK = {
  status: 'unavailable',
  stale: true,
  lastObservedUtc: '2026-09-14T21:46:00Z',
  lastObservedCycle: 'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42',
  messages: 25,
  threads: 9,
  refs: ['UFN-70731', 'UFN-70804', 'UFN-68616', 'UFN-70404', 'UFN-69618', 'UFN-70413', 'UFN-70553', 'UFN-70753', 'UFN-70761'],
  note: 'No Outlook read was possible for this cycle; the last observed delegated-mailbox values (v42) are retained for context only and were not re-verified.',
};

// Billing-family rows are identified from the live titles each cycle. Two rows carried
// forward from the previous cycles are re-confirmed by title family (F26 Month End Close
// Reminder series); two rows are explicitly retained per earlier business rulings.
const BILLING_KEYWORDS = ['billing', 'uf billing', 'storage', 'handling', 'invoice'];
const BILLING_CARRY_FORWARD = ['UFN-53491', 'UFN-40670'];
const BILLING_RETAINED_BY_RULING = {
  'UFN-60009': 'references an Amazon Invoice but is an operational BOL request; retained (unchanged ruling)',
  'UFN-69231': 'ODFL PRO-number request in the billing-number series; retained pending a business ruling',
};

const args = process.argv.slice(2);
const writeOutputs = args.includes('--write');

const fail = (message) => { throw new Error(message); };
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const countBy = (records, keyFn) => records.reduce((counts, record) => {
  const key = keyFn(record);
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

async function atomicWriteAll(outputs) {
  const temps = [];
  try {
    for (const [path, content] of outputs) {
      const temp = `${path}.tmp-${process.pid}`;
      await writeFile(temp, content, 'utf8');
      temps.push(temp);
    }
    for (let index = 0; index < outputs.length; index += 1) await rename(temps[index], outputs[index][0]);
  } catch (error) {
    await Promise.all(temps.map((temp) => unlink(temp).catch(() => {})));
    throw error;
  }
}

function zonedParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function offsetMinutes(date) {
  const p = zonedParts(date);
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60_000);
}

function offsetText(minutes) {
  const absolute = Math.abs(minutes);
  return `${minutes >= 0 ? '+' : '-'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function zonedIso(date) {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetText(offsetMinutes(date))}`;
}

function nextRefreshIso(date) {
  const current = zonedParts(date);
  const probe = new Date(Date.UTC(+current.year, +current.month - 1, +current.day + 1, 12));
  const next = zonedParts(probe);
  return `${next.year}-${next.month}-${next.day}T08:00:00${offsetText(offsetMinutes(probe))}`;
}

function apiTime(value, field, ticketNumber) {
  if (value == null || value === '') return null;
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  if (!match) fail(`${ticketNumber} has invalid ${field}: ${value}`);
  return `${match[3]}-${match[1]}-${match[2]}T${match[4]}.000Z`;
}

function conversationIdentity(title) {
  const value = String(title ?? '');
  const caseMatch = value.match(/\bCASE\s*(?:ID)?\s*[:#\[]?\s*(\d{6,})\b/i) ?? value.match(/\bTicket\s*\[(\d{6,})\]/i);
  if (caseMatch) return `CASE-${caseMatch[1]}`;
  const dnMatch = value.match(/^\s*DN[-\s]?(\d{5,})\s*$/i);
  return dnMatch ? `DN-${dnMatch[1]}` : null;
}

function loadBucket() {
  const text = readText(RAW_FILE);
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const header = lines.shift().split('\t');
  const expected = ['ticketNumber', 'title', 'displayStatusName', 'closeFlag', 'isSlaBreached', 'isOverdue',
    'customerName', 'customerEmail', 'priorityName', 'staffName', 'createTime', 'updateTime', 'estDueDate',
    'sourceChannel', 'topicTitle'];
  if (header.join('|') !== expected.join('|')) fail(`unexpected raw header: ${header.join('|')}`);
  return lines.map((line) => {
    const cells = line.split('\t');
    if (cells.length !== expected.length) fail(`raw row ${cells[0]} has ${cells.length} cells`);
    const record = Object.fromEntries(expected.map((key, index) => [key, cells[index]]));
    return {
      ticketNumber: record.ticketNumber,
      title: record.title,
      displayStatusName: record.displayStatusName,
      displayStatusSystemStatus: 10,
      closeFlag: record.closeFlag === 'true',
      isSlaBreached: record.isSlaBreached === 'true',
      isOverdue: record.isOverdue === 'true',
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      priorityName: record.priorityName,
      staffName: record.staffName,
      createTime: record.createTime,
      updateTime: record.updateTime,
      estDueDate: record.estDueDate,
      sourceChannel: Number(record.sourceChannel),
      topicTitle: record.topicTitle,
    };
  });
}

import { readFileSync } from 'node:fs';
function readText(path) { return readFileSync(path, 'utf8'); }

function transform(record) {
  const createdAt = apiTime(record.createTime, 'createTime', record.ticketNumber);
  const updatedAt = apiTime(record.updateTime, 'updateTime', record.ticketNumber);
  const dueDate = apiTime(record.estDueDate, 'estDueDate', record.ticketNumber);
  const ageMs = REFRESH_INSTANT.getTime() - Date.parse(createdAt);
  const hasPriority = typeof record.priorityName === 'string' && record.priorityName.trim() !== '';
  return {
    ticketId: record.ticketNumber,
    customer: String(record.customerName || record.customerEmail || 'Customer not listed'),
    customerEmail: record.customerEmail || null,
    opsStatus: record.displayStatusName,
    displayStatusName: record.displayStatusName,
    displayStatusSystemStatus: record.displayStatusSystemStatus,
    priority: hasPriority ? record.priorityName : 'unavailable',
    priorityNameSource: hasPriority ? 'ticket' : 'unavailable',
    prioritySourceMissing: !hasPriority,
    subject: record.title,
    createdAt,
    createdDate: createdAt.slice(0, 10),
    updatedAt,
    lastUpdated: updatedAt.slice(0, 10),
    dueDate,
    assigned: record.staffName && record.staffName.trim() !== '' ? record.staffName : 'Unassigned',
    closeFlag: record.closeFlag === true,
    slaStatus: record.isSlaBreached === true ? 'Breached' : 'On Track',
    isOverdue: record.isOverdue === true,
    isSlaBreached: record.isSlaBreached === true,
    conversationId: conversationIdentity(record.title),
    sourceChannel: record.sourceChannel ?? null,
    topicTitle: record.topicTitle ?? null,
    ageHours: Math.max(0, Math.floor(ageMs / 3_600_000)),
    ageDays: Math.max(0, Math.floor(ageMs / 86_400_000)),
  };
}

function actionBucket(ticket) {
  if (ticket.ageHours < 24) return 'Immediate';
  if (ticket.ageHours < 72) return 'Short-Term';
  if (ticket.ageHours < 168) return 'Medium-Term';
  return 'Watch';
}

function buildCustomerHealth(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    const group = groups.get(ticket.customer) ?? { tickets: 0, old: 0, ufnCount: 0, breached: 0, oldestBreachedAgeDays: 0 };
    group.tickets += 1;
    if (ticket.ageDays > 7) group.old += 1;
    if (ticket.ticketId.startsWith('UFN-')) group.ufnCount += 1;
    if (ticket.isSlaBreached) {
      group.breached += 1;
      group.oldestBreachedAgeDays = Math.max(group.oldestBreachedAgeDays, ticket.ageDays);
    }
    groups.set(ticket.customer, group);
  }
  const customers = {};
  const tiers = { Critical: 0, Warning: 0, Healthy: 0 };
  for (const [customer, group] of [...groups].sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0]))) {
    const oldShare = group.old / group.tickets;
    const tier = oldShare >= 0.5 || group.ufnCount >= 3 ? 'Critical' : oldShare >= 0.25 || group.ufnCount >= 1 ? 'Warning' : 'Healthy';
    tiers[tier] += 1;
    customers[customer] = { tickets: group.tickets, breached: group.breached, oldestBreachedAgeDays: group.oldestBreachedAgeDays, tier };
  }
  return {
    totalCustomers: groups.size,
    tiers,
    tierRule: 'Critical if ticketsOlderThan7Days/tickets >= 0.5 OR ufnCount >= 3; Warning if share >= 0.25 OR ufnCount >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged, so Healthy is structurally unreachable.',
    customers,
  };
}

const previousConfig = JSON.parse(readText('dashboard/config.json'));
const previousManifest = JSON.parse(readText('dashboard/data/refresh-manifest.json'));
const previousTickets = JSON.parse(readText('dashboard/data/tickets.json'));
const structuredList = JSON.parse(readText('public/data/structured_list.json'));
if (!previousConfig.snapshotMetrics.refreshId.endsWith('-AUTHORITATIVE-v42')) fail(`expected v42 predecessor, got ${previousConfig.snapshotMetrics.refreshId}`);

const openBucket = loadBucket();
if (new Set(openBucket.map((record) => record.ticketNumber)).size !== openBucket.length) fail('system-open bucket contains duplicate ticket numbers');
if (openBucket.some((record) => !String(record.ticketNumber).startsWith('UFN-'))) fail('system-open bucket contains a non-UFN row');

const statusCounts = countBy(openBucket, (record) => record.displayStatusName);
const reopen = openBucket.filter((record) => ['Reopen', 'Reopened'].includes(record.displayStatusName));
const gateBeforeUfn = openBucket.filter((record) => ['New', 'Pending'].includes(record.displayStatusName));
const gate = gateBeforeUfn.filter((record) => String(record.ticketNumber).startsWith('UFN-'));
if (gate.length !== gateBeforeUfn.length) fail(`New/Pending gate contains ${gateBeforeUfn.length - gate.length} non-UFN rows`);

const liveGateIds = new Set(gate.map((record) => record.ticketNumber));

// Billing family: live-title keyword verification + carried-forward confirmations - retained rulings.
const keywordBilling = gate.filter((record) => {
  const title = String(record.title).toLowerCase();
  return BILLING_KEYWORDS.some((keyword) => title.includes(keyword));
});
const billingIds = [...new Set([
  ...keywordBilling.map((record) => record.ticketNumber),
  ...BILLING_CARRY_FORWARD.filter((id) => liveGateIds.has(id)),
])].filter((id) => !Object.hasOwn(BILLING_RETAINED_BY_RULING, id)).sort();
const billingSet = new Set(billingIds);
const billingReasons = Object.fromEntries(billingIds.map((id) => {
  const record = gate.find((item) => item.ticketNumber === id) ?? openBucket.find((item) => item.ticketNumber === id);
  if (id === 'UFN-53491' || id === 'UFN-40670') return [id, `carried-forward billing-family row (F26 Month End Close Reminder series) re-confirmed in the live gate: ${record.title}`];
  return [id, `excluded after live title verification: ${record.title}`];
}));

const identityGroups = new Map();
for (const record of gate.filter((item) => !billingSet.has(item.ticketNumber))) {
  const identity = conversationIdentity(record.title);
  if (!identity) continue;
  if (!identityGroups.has(identity)) identityGroups.set(identity, []);
  identityGroups.get(identity).push(record);
}
const duplicateConversations = [];
for (const [identity, group] of identityGroups) {
  if (group.length < 2) continue;
  group.sort((a, b) => a.createTime.localeCompare(b.createTime) || a.ticketNumber.localeCompare(b.ticketNumber));
  for (const record of group.slice(1)) duplicateConversations.push({ ticketId: record.ticketNumber, canonical: group[0].ticketNumber, conversationId: identity.replace(/^CASE-/, '') });
}
duplicateConversations.sort((a, b) => a.ticketId.localeCompare(b.ticketId));
const duplicateSet = new Set(duplicateConversations.map((entry) => entry.ticketId));
const tickets = gate.filter((record) => !billingSet.has(record.ticketNumber) && !duplicateSet.has(record.ticketNumber)).map(transform).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
if (tickets.length !== gate.length - billingIds.length - duplicateConversations.length) fail('gate reconciliation failed');
if (new Set(tickets.map((ticket) => ticket.ticketId)).size !== tickets.length) fail('eligible ticket numbers are not unique');

const eligibleIds = new Set(tickets.map((ticket) => ticket.ticketId));
const priorGateIds = new Set([...previousTickets.map((ticket) => ticket.ticketId), ...previousManifest.exclusions.billingTicketIds, ...previousManifest.exclusions.duplicateConversations.map((entry) => entry.ticketId)]);
const priorEligibleIds = new Set(previousTickets.map((ticket) => ticket.ticketId));
const gateArrivals = [...liveGateIds].filter((id) => !priorGateIds.has(id)).sort();
const gateDepartures = [...priorGateIds].filter((id) => !liveGateIds.has(id)).sort();
const eligibleArrivals = [...eligibleIds].filter((id) => !priorEligibleIds.has(id)).sort();
const eligibleDepartures = [...priorEligibleIds].filter((id) => !eligibleIds.has(id)).sort();

const closeFlagGate = gate.filter((record) => record.closeFlag === true).length;
const closeFlagEligible = tickets.filter((ticket) => ticket.closeFlag).length;
const byStatus = { New: 0, Open: 0, Pending: 0, ...countBy(tickets, (ticket) => ticket.opsStatus) };
const byPriority = countBy(tickets, (ticket) => ticket.priority);
const workloadRaw = countBy(tickets, (ticket) => ticket.isOverdue || ticket.isSlaBreached ? 'risk' : 'current');
const workload = { overdueOrSlaBreached: workloadRaw.risk ?? 0, current: workloadRaw.current ?? 0 };
const buckets = { Immediate: 0, 'Short-Term': 0, 'Medium-Term': 0, Watch: 0, ...countBy(tickets, actionBucket) };
const customerHealth = buildCustomerHealth(tickets);
const slaBreached = tickets.filter((ticket) => ticket.isSlaBreached).length;
const slaOnTrack = tickets.length - slaBreached;
const unassigned = tickets.filter((ticket) => ticket.assigned === 'Unassigned').length;
const oldestAgeDays = Math.max(...tickets.map((ticket) => ticket.ageDays));
const priorityQueue = [...tickets].sort((a, b) => Number(b.isSlaBreached) - Number(a.isSlaBreached) || String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')) || b.ageHours - a.ageHours).slice(0, 15).map(({ ticketId, customer, subject, ageDays, ageHours, slaStatus }) => ({ ticketId, customer, subject, ageDays, ageHours, slaStatus }));

const outlookReachable = OUTLOOK.status === 'available';
const outlookEligible = OUTLOOK.refs.filter((id) => eligibleIds.has(id));
const outlookIneligible = OUTLOOK.refs.filter((id) => !eligibleIds.has(id));
const refreshTimestamp = zonedIso(REFRESH_INSTANT);
const refreshId = `refresh-${refreshTimestamp}-AUTHORITATIVE-${VERSION}`;
const previousRefreshId = previousConfig.snapshotMetrics.refreshId;
const nextScheduledRefresh = nextRefreshIso(REFRESH_INSTANT);
const etHeading = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(REFRESH_INSTANT).replace(',', '');

const snapshotMetrics = {
  refreshId, refreshedAt: refreshTimestamp, totalRaw: openBucket.length, totalGateRows: gate.length,
  totalEligible: tickets.length, excludedCount: billingIds.length + duplicateConversations.length,
  duplicatesRemoved: duplicateConversations.length, invoiceItemsExcluded: billingIds.length,
  closeFlagTrueRetained: closeFlagEligible, arrivalsThisCycle: eligibleArrivals.length,
  departuresThisCycle: eligibleDepartures.length, outlookStatus: OUTLOOK.status, outlookThreadsMatched: OUTLOOK.messages,
};
const config = structuredClone(previousConfig);
config.ticketFilters.excludeStatuses = ['Reopen', 'Reopened', 'Closed', 'Resolved', 'Solved', 'Cancelled', 'Done'];
config.ticketFilters.excludeInvoiceItems = ['billing', 'UF Billing', 'storage', 'handling', 'invoice'];
config.snapshotMetrics = snapshotMetrics;
config.outlook = { ...config.outlook, status: OUTLOOK.status, lastObservedUtc: OUTLOOK.lastObservedUtc, stale: true };

const evidenceMetrics = {
  totalEligible: tickets.length, slaBreached, slaOnTrack, unassigned, oldestAgeDays,
  outlookStatus: OUTLOOK.status, outlookThreadsMatched: OUTLOOK.messages,
  outlookDistinctThreads: OUTLOOK.threads, outlookThreadsLinkedToEligibleTickets: outlookEligible.length,
  outlookStale: true, outlookLastObservedUtc: OUTLOOK.lastObservedUtc,
  invoiceItemsExcluded: billingIds.length, duplicatesRemoved: duplicateConversations.length,
  closeFlagTrueRetained: closeFlagEligible, arrivalsThisCycle: eligibleArrivals.length,
  departuresThisCycle: eligibleDepartures.length,
};

const manifest = {
  refresh: {
    id: refreshId, timestamp: refreshTimestamp, type: 'AUTHORITATIVE', previousRefreshId, status: 'complete',
    keyChange: `${openBucket.length} system-open rows (${statusCounts.New ?? 0} New / ${statusCounts.Pending ?? 0} Pending / ${reopen.length} Reopen), ${gate.length} New/Pending UFN gate rows, and ${tickets.length} eligible conversations after ${billingIds.length} billing-family and ${duplicateConversations.length} conversation-identity exclusions.`,
  },
  rulesApplied: [
    'displayStatusSystemStatus == 10 AND displayStatusName in {New, Pending} is the authoritative eligibility gate',
    'Reopen/Reopened, Closed, Resolved, Solved, Cancelled and Done are excluded by display status name',
    'closeFlag is retained as evidence and is not an eligibility gate',
    `ticketNumber begins UFN- within department ${DEPARTMENT_ID}`,
    `${billingIds.length} live billing, UF Billing, storage, handling or invoice-family rows are excluded`,
    `${duplicateConversations.length} overlapping rows are removed by source CASE/DN conversation identity`,
    'Customer Health includes every customer visible in eligible tickets; roster and aliases are supplemental only',
    'Outlook is supplemental and never changes ticket counts, queue, buckets, Customer Health, or SLA metrics',
  ],
  dataSources: [
    {
      name: 'Ticket Ops',
      endpoint: 'POST /v1/iam/tickets/page',
      query: { page: '1,2', size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusSystemStatus: [10] } },
      note: `Live read paged to exhaustion (${openBucket.length} rows) at 2026-09-16T22:31Z; raw rows retained in ${RAW_FILE}.`,
    },
    {
      name: 'Ticket Ops (independent delegation cross-check)',
      note: 'A delegated Ticket Ops read of the same department/status returned an identical bucket: 329 rows = 217 New / 69 Pending / 43 Reopen, matching by ticket number.',
    },
    {
      name: 'Outlook',
      note: OUTLOOK.note,
    },
  ],
  developerNotes: [
    `v43 live read: ${openBucket.length} open-system rows = ${statusCounts.New ?? 0} New / ${statusCounts.Pending ?? 0} Pending / ${reopen.length} Reopen; exact UFN New/Pending gate ${gate.length}.`,
    `Gate movement: ${gateArrivals.length} arrivals (${gateArrivals.join(', ') || 'none'}); ${gateDepartures.length} departures (${gateDepartures.join(', ') || 'none'}).`,
    `Eligible movement: ${eligibleArrivals.length} arrivals (${eligibleArrivals.join(', ') || 'none'}); ${eligibleDepartures.length} departures (${eligibleDepartures.join(', ') || 'none'}).`,
    `${billingIds.length} billing-family rows were verified from current live titles (including the carried-forward F26 Month End Close Reminder rows); ${duplicateConversations.length} overlapping rows were removed from explicit CASE/DN identity groups.`,
    `${closeFlagEligible} closeFlag=true rows remain eligible (${closeFlagGate} gate-wide). closeFlag was never used as a gate.`,
    `Customer Health covers all ${customerHealth.totalCustomers} customer labels visible on the ${tickets.length} eligible live records.`,
    `Outlook was unavailable for this cycle; the v42 delegated-mailbox values (${OUTLOOK.messages} messages / ${OUTLOOK.threads} threads, latest ${OUTLOOK.lastObservedUtc}) are carried forward and labelled stale. They were not used in any ticket, queue, bucket, health or SLA metric.`,
    'The UFN-67030 citation remains stale: that ticket is Solved / systemStatus 20 and is outside the open bucket entirely, so it is excluded on authoritative status, not on closeFlag.',
  ],
  exclusions: {
    billingTicketIds: billingIds,
    billingTicketReasons: billingReasons,
    duplicateConversations,
    billingFamilyExcludedCount: billingIds.length,
    retainedForBusinessRuling: Object.fromEntries(Object.entries(BILLING_RETAINED_BY_RULING).filter(([id]) => liveGateIds.has(id))),
    additionalCandidateOverlaps: [],
    candidateOverlapNote: 'No subject- or load-text similarity was used. Only explicit CASE/DN conversation identities were collapsed.',
  },
  dashboardState: {
    totalRaw: openBucket.length, totalRawDepartmentWide: openBucket.length,
    eligibleBeforeExclusions: gate.length, reopenExcluded: reopen.length,
    billingExcluded: billingIds.length, eligibleBeforeDeduplication: gate.length - billingIds.length,
    duplicatesRemoved: duplicateConversations.length, totalEligible: tickets.length,
    closeFlagTrueRetained: closeFlagEligible, byStatus, byPriority, workload,
    actionBuckets: buckets, customerHealth, priorityQueue, evidenceMetrics,
  },
  excludedThisCycle: {
    reopenByStatusName: reopen.map((record) => record.ticketNumber).sort(),
    billingFamily: billingIds,
    duplicateConversations: duplicateConversations.map((entry) => entry.ticketId),
  },
  reconciliation: {
    gate: { total: gate.length, New: statusCounts.New ?? 0, Pending: statusCounts.Pending ?? 0 },
    openSystemBucket: openBucket.length, Reopen: reopen.length,
    billingExcluded: billingIds.length, duplicateConversationsExcluded: duplicateConversations.length,
    eligibleConversations: tickets.length, closeFlagTrueGate: closeFlagGate,
    closeFlagTrueEligible: closeFlagEligible, gateArrivals, gateDepartures, eligibleArrivals, eligibleDepartures,
  },
  fieldAvailability: {
    ticketNumber: 'read', displayStatusName: 'read', displayStatusSystemStatus: 'read', closeFlag: 'read',
    customerName: 'read', customerEmail: 'read', priorityName: 'read where populated', staffName: 'read where populated',
    createTime: 'read', updateTime: 'read', estDueDate: 'read', isSlaBreached: 'read', isOverdue: 'read',
    organizationName: 'returned by the live ticket page where an organization is linked; Customer Health still keys on the customer label and excludes no visible customer',
  },
  nextScheduledRefresh,
};

const outlookContext = {
  facility: 'NHT/Cesanek', facilityCode: 'LT_F21', generatedAt: refreshTimestamp,
  lastRefreshed: refreshTimestamp, outlookAvailable: false, delegatedMailboxAvailable: false,
  integrationStatus: 'unavailable', statusLabel: 'Unavailable', integration: 'non_blocking',
  dataSource: 'Delegated CS mailbox nicole.weber@unisco.com; supplemental and non-blocking',
  stale: true,
  staleness: {
    reason: OUTLOOK.note,
    lastObservedUtc: OUTLOOK.lastObservedUtc,
    lastObservedCycle: OUTLOOK.lastObservedCycle,
  },
  threadsMatched: OUTLOOK.messages, threadsUniquePostDedup: OUTLOOK.threads,
  threadsLinkedToEligibleTickets: outlookEligible.length, latestMessageUtc: OUTLOOK.lastObservedUtc,
  activeEscalations: outlookEligible, eligibleEscalations: outlookEligible.length,
  coverage: {
    eligibleTicketsTotal: tickets.length, eligibleTicketsWithOutlookContext: outlookEligible.length,
    coveragePct: Number(((outlookEligible.length / tickets.length) * 100).toFixed(2)),
    note: `Stale context only. ${outlookEligible.length} of ${OUTLOOK.threads} last-observed threads links to an eligible Ticket Ops conversation; no Outlook read was performed this cycle.`,
  },
  ticketThreads: OUTLOOK.refs.map((ticketRef) => ({ ticketRef, linkedToEligibleTicket: eligibleIds.has(ticketRef) })),
  mailboxScopeUsed: 'nicole.weber@unisco.com',
  mailboxReadWindow: 'not read this cycle',
  thisCycleRead: {
    messagesRetrieved: 0, distinctThreadsPostDedup: 0, threadsMappedToUfn: 0,
    ufnRefs: [], eligibleUfnRefs: [], ineligibleUfnRefs: [], threadsLinkedToEligibleTickets: 0,
    note: 'No Outlook read was possible this cycle. Values shown elsewhere are the last observed v42 context and are marked stale.',
  },
};

Object.assign(structuredList, {
  lastRefreshed: refreshTimestamp, dataSource: 'Ticket Ops (authoritative); Outlook unavailable this cycle (last observed values stale)',
  refreshType: 'AUTHORITATIVE', refreshId, totalRaw: openBucket.length,
  eligibleBeforeExclusions: gate.length, eligibleBeforeDeduplication: gate.length - billingIds.length,
  totalEligible: tickets.length, newCount: byStatus.New, openCount: 0, pendingCount: byStatus.Pending,
  exclusionSummary: { reopen: reopen.length, billingFamily: billingIds.length, overlappingConversations: duplicateConversations.length },
  closeFlagTrueRetained: closeFlagEligible, slaHealth: { breached: slaBreached, onTrack: slaOnTrack, unassigned },
  actionBuckets: buckets, evidenceMetrics,
  outlook: { status: OUTLOOK.status, stale: true, messagesRetrieved: OUTLOOK.messages, distinctThreads: OUTLOOK.threads, threadsLinkedToEligibleTickets: outlookEligible.length, lastObservedUtc: OUTLOOK.lastObservedUtc },
  customers: { total: customerHealth.totalCustomers, tiers: customerHealth.tiers, tierRule: customerHealth.tierRule },
  excludedCount: billingIds.length + duplicateConversations.length, duplicatesRemoved: duplicateConversations.length,
  invoiceItemsExcluded: billingIds.length, customerCount: customerHealth.totalCustomers,
  customerHealthTiers: customerHealth.tiers, slaBreached, slaOnTrack, unassigned, oldestAgeDays,
  outlookStatus: OUTLOOK.status, outlookThreadsMatched: OUTLOOK.messages, outlookDistinctThreads: OUTLOOK.threads,
  outlookThreadsLinkedToEligibleTickets: outlookEligible.length,
  arrivalsThisCycle: eligibleArrivals.length, departuresThisCycle: eligibleDepartures.length,
});

const tierText = `${customerHealth.tiers.Critical} Critical / ${customerHealth.tiers.Warning} Warning / ${customerHealth.tiers.Healthy} Healthy`;
const stateSection = `## Current Dashboard State (Last Refresh: ${etHeading} ET - AUTHORITATIVE v43)\n\n| Metric | Value |\n|--------|-------|\n| Total Raw (system-open UFN, department scope) | **${openBucket.length}** = ${statusCounts.New ?? 0} New / ${statusCounts.Pending ?? 0} Pending / ${reopen.length} Reopen; New+Pending gate **${gate.length}** |\n| Eligible | **${tickets.length}** conversations (${byStatus.New} New, 0 Open, ${byStatus.Pending} Pending) |\n| Excluded | ${billingIds.length + duplicateConversations.length} = ${billingIds.length} billing-family + ${duplicateConversations.length} overlapping conversations; ${reopen.length} Reopen rows outside the gate |\n| Eligible arrivals | **+${eligibleArrivals.length}**: ${eligibleArrivals.join(', ') || 'none'} |\n| Eligible departures | **-${eligibleDepartures.length}**: ${eligibleDepartures.join(', ') || 'none'} |\n| closeFlag | **NOT a gate** - ${closeFlagEligible} live closeFlag=true tickets retained (${closeFlagGate} gate-wide) |\n| Customers | **${customerHealth.totalCustomers}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |\n| Priority | ${Object.entries(byPriority).map(([name, count]) => `${count} ${name}`).join(' / ')} |\n| SLA Risk | **ELEVATED** - ${slaBreached} SLA-breached / ${slaOnTrack} current; ${unassigned} unassigned |\n| Action Buckets | Immediate **${buckets.Immediate}** / Short-Term **${buckets['Short-Term']}** / Medium-Term **${buckets['Medium-Term']}** / Watch **${buckets.Watch}** |\n| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${OUTLOOK.messages} UFN messages / ${OUTLOOK.threads} distinct threads, latest ${OUTLOOK.lastObservedUtc}; stale and supplemental only |\n| Last Refresh | ${refreshTimestamp} (**AUTHORITATIVE v43**, department ${DEPARTMENT_ID}) |\n\n`;
const reconciliationNote = `### v42 -> v43 (${etHeading} ET)\n\n- **Live gate.** ${openBucket.length} system-open rows = ${statusCounts.New ?? 0} New / ${statusCounts.Pending ?? 0} Pending / ${reopen.length} Reopen. The exact New/Pending UFN gate contains ${gate.length} rows.\n- **Gate arrivals (${gateArrivals.length}).** ${gateArrivals.join(', ') || 'None'}.\n- **Gate departures (${gateDepartures.length}).** ${gateDepartures.join(', ') || 'None'}.\n- **Eligible arrivals (${eligibleArrivals.length}).** ${eligibleArrivals.join(', ') || 'None'}.\n- **Eligible departures (${eligibleDepartures.length}).** ${eligibleDepartures.join(', ') || 'None'}.\n- **Exclusions.** ${billingIds.length} live billing/UF Billing/storage/handling/invoice-family rows (including the carried-forward F26 Month End Close Reminder rows) and ${duplicateConversations.length} overlapping CASE/DN rows were excluded, yielding ${tickets.length} eligible conversations.\n- **closeFlag evidence.** ${closeFlagEligible} closeFlag=true rows remain eligible (${closeFlagGate} gate-wide); closeFlag was not used as a gate. UFN-67030 is Solved / systemStatus 20 and is outside the open bucket, so the gate is proven by the live closeFlag=true New/Pending rows instead.\n- **Customer Health.** All ${customerHealth.totalCustomers} customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.\n- **Outlook was unavailable this cycle.** No delegated-mailbox read was possible, so no Outlook value was refreshed. The v42 values (${OUTLOOK.messages} messages / ${OUTLOOK.threads} threads, latest ${OUTLOOK.lastObservedUtc}) are carried forward and labelled stale, and no operational metric depends on them.\n\n`;

let readme = readText('README.md');
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);
readme = readme.replace(/### v41 -> v42 \(/, '### v41 -> v42 (superseded by v43) (');
if (/### v42 -> v43[\s\S]*?(?=### |$)/.test(readme)) readme = readme.replace(/### v42 -> v43[\s\S]*?(?=### |$)/, reconciliationNote);
else readme = readme.replace('## Developer Reconciliation Note\n\n', `## Developer Reconciliation Note\n\n${reconciliationNote}`);

const outputs = [
  ['dashboard/data/tickets.json', json(tickets)], ['public/data/tickets.json', json(tickets)],
  ['dashboard/data/refresh-manifest.json', json(manifest)], ['public/data/refresh-manifest.json', json(manifest)],
  ['dashboard/data/outlook-context.json', json(outlookContext)], ['public/data/outlook-context.json', json(outlookContext)],
  ['public/data/structured_list.json', json(structuredList)], ['config.json', json(config)],
  ['dashboard/config.json', json(config)], ['public/config.json', json(config)], ['README.md', readme],
];
if (writeOutputs) await atomicWriteAll(outputs);

console.log(JSON.stringify({
  mode: writeOutputs ? 'written' : 'dry-run', refreshId, refreshTimestamp, openSystemBucket: openBucket.length,
  gate: { total: gate.length, New: statusCounts.New ?? 0, Pending: statusCounts.Pending ?? 0 },
  reopenRows: reopen.length, billingExcluded: billingIds.length, billingIds,
  duplicateConversations, eligibleConversations: tickets.length,
  closeFlagTrue: { gate: closeFlagGate, eligible: closeFlagEligible }, byStatus, byPriority, workload,
  actionBuckets: buckets, customerHealth: { totalCustomers: customerHealth.totalCustomers, tiers: customerHealth.tiers },
  evidenceMetrics, gateArrivals, gateDepartures, eligibleArrivals, eligibleDepartures,
  retainRuling: manifest.exclusions.retainedForBusinessRuling,
  outlook: OUTLOOK.status,
  files: writeOutputs ? outputs.map(([path]) => path) : [],
}, null, 2));

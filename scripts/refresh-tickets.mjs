#!/usr/bin/env node

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";

const DEPARTMENT_ID = "323826714354839552";
const PAGE_SIZE = 200;
const TIME_ZONE = "America/New_York";
const VERSION = "v35";
const PREVIOUS_REFRESH_ID = "refresh-2026-09-12T13:45ET-AUTHORITATIVE-v34";

const QUERY_INPUT = {
  departmentIds: [DEPARTMENT_ID],
  displayStatusIds: ["11", "6"],
};

const REOPEN_QUERY_INPUT = {
  departmentIds: [DEPARTMENT_ID],
  displayStatusIds: ["1"],
};

const BILLING_TICKET_IDS = [
  "UFN-70613", "UFN-70406", "UFN-70350", "UFN-70156", "UFN-70140", "UFN-69234",
  "UFN-68749", "UFN-67930", "UFN-65196", "UFN-63959", "UFN-63762", "UFN-62682",
  "UFN-61451", "UFN-60573", "UFN-59971", "UFN-55641", "UFN-54721", "UFN-53491",
  "UFN-48436", "UFN-45559", "UFN-43725", "UFN-41484", "UFN-40670", "UFN-33719",
];

const DUPLICATE_TO_SURVIVOR = {
  "UFN-69661": "UFN-69511",
  "UFN-69663": "UFN-69511",
  "UFN-69447": "UFN-69307",
  "UFN-69450": "UFN-69307",
  "UFN-70352": "UFN-70351",
};

const V35_ADDED_TICKET_IDS = [
  "UFN-70664", "UFN-70663", "UFN-70662", "UFN-70661", "UFN-70660", "UFN-70659", "UFN-70652",
];

const EXPECTED = {
  statusGateTotal: 339,
  gateStatuses: { New: 273, Pending: 66 },
  openBucketTotal: 391,
  reopen: 52,
  billing: 24,
  duplicates: 5,
  eligible: 310,
  nonUfn: 0,
  closeFlagTrueRetained: 19,
  priorities: { Medium: 334, unavailable: 5 },
  workload: { overdueOrSlaBreached: 241, current: 98 },
  unassigned: 279,
  actionBuckets: { Immediate: 13, "Short-Term": 72, "Medium-Term": 34, Watch: 191 },
};

const args = process.argv.slice(2);
const writeOutputs = args.includes("--write");
const refreshArgIndex = args.indexOf("--refresh-instant");
const refreshInstant = refreshArgIndex >= 0
  ? new Date(args[refreshArgIndex + 1])
  : new Date(Math.floor(Date.now() / 1000) * 1000);

if (Number.isNaN(refreshInstant.getTime())) {
  throw new Error("--refresh-instant must be a valid ISO timestamp");
}

const baseUrl = process.env.TICKET_API_BASE_URL?.replace(/\/$/, "");
const authorization = process.env.ITEM_AUTHORIZATION;
const tenantId = process.env.ITEM_TENANT_ID;

if (!baseUrl || !authorization || !tenantId) {
  throw new Error("TICKET_API_BASE_URL, ITEM_AUTHORIZATION, and ITEM_TENANT_ID are required");
}

function countBy(records, keyFn) {
  const counts = {};
  for (const record of records) {
    const key = keyFn(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertWithin(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} mismatch: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
}

async function fetchTicketPage(page, input) {
  const body = { page, size: PAGE_SIZE, input };
  const response = await fetch(`${baseUrl}/v1/iam/tickets/page`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      "X-Tenant-Id": tenantId,
      "User-Agent": `ccc-dashboard-ticket-refresh/${VERSION.slice(1)}`,
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`Ticket page ${page} returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(`Ticket page ${page} failed: HTTP ${response.status}, code ${payload.code}, ${payload.msg}`);
  }
  if (!Array.isArray(payload.data.records) || !Number.isInteger(payload.data.total)) {
    throw new Error(`Ticket page ${page} did not match the expected response shape`);
  }
  return payload.data;
}

async function fetchAll(input) {
  const records = [];
  const pagesRead = [];
  let authoritativeTotal = null;
  for (let page = 1; ; page += 1) {
    const data = await fetchTicketPage(page, input);
    if (authoritativeTotal === null) authoritativeTotal = data.total;
    assertEqual(data.total, authoritativeTotal, `page ${page} total`);
    records.push(...data.records);
    pagesRead.push(page);
    if (records.length >= authoritativeTotal || data.records.length === 0) break;
  }
  assertEqual(records.length, authoritativeTotal, "records read at exhaustion");
  return { records, pagesRead, total: authoritativeTotal };
}

function rawTimestampToIso(value, field, ticketNumber) {
  if (value == null || value === "") return null;
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  if (!match) throw new Error(`${ticketNumber} has invalid ${field}: ${value}`);
  return `${match[3]}-${match[1]}-${match[2]}T${match[4]}.000Z`;
}

function parseConversationId(title) {
  const caseMatch = String(title ?? "").match(/\bCASE\s*#?\s*(\d{8,})\b/i);
  if (caseMatch) return caseMatch[1];
  const dnMatch = String(title ?? "").match(/\bDN[-\s]?(\d{5,})\b/i);
  return dnMatch ? `DN-${dnMatch[1]}` : null;
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function timeZoneOffsetMinutes(date) {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedIso(date) {
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${formatOffset(timeZoneOffsetMinutes(date))}`;
}

function nextRefreshIso(date) {
  const current = zonedParts(date);
  const nextDate = new Date(Date.UTC(+current.year, +current.month - 1, +current.day + 1, 12));
  const next = zonedParts(nextDate);
  const provisional = new Date(Date.UTC(+next.year, +next.month - 1, +next.day, 8));
  return `${next.year}-${next.month}-${next.day}T08:00:00${formatOffset(timeZoneOffsetMinutes(provisional))}`;
}

function customerLabel(record) {
  const organizationName = record.organization?.name || record.organizations?.[0]?.name;
  if (typeof organizationName === "string" && organizationName.trim() !== "") {
    return organizationName;
  }

  return String(record.customerName ?? "");
}

function transformTicket(record) {
  const createdAt = rawTimestampToIso(record.createTime, "createTime", record.ticketNumber);
  const updatedAt = rawTimestampToIso(record.updateTime, "updateTime", record.ticketNumber);
  const dueDate = rawTimestampToIso(record.estDueDate, "estDueDate", record.ticketNumber);
  const ageMilliseconds = refreshInstant.getTime() - Date.parse(createdAt);
  const priorityValid = typeof record.priorityName === "string" && record.priorityName.trim() !== "";
  const subject = record.title || record.ticketNumber || "";
  return {
    ticketId: record.ticketNumber,
    customer: customerLabel(record),
    customerEmail: record.customerEmail,
    opsStatus: record.displayStatusName,
    displayStatusName: record.displayStatusName,
    displayStatusSystemStatus: record.displayStatusSystemStatus,
    priority: priorityValid ? record.priorityName : "Medium",
    priorityNameSource: "ticket",
    prioritySourceMissing: !priorityValid,
    subject,
    createdDate: createdAt.slice(0, 10),
    createdAt,
    lastUpdated: updatedAt?.slice(0, 10) ?? null,
    updatedAt,
    dueDate,
    assigned: record.staffName || "Unassigned",
    closeFlag: record.closeFlag,
    slaStatus: record.isSlaBreached ? "Breached" : "On Track",
    isOverdue: record.isOverdue,
    isSlaBreached: record.isSlaBreached,
    ageHours: Math.floor(ageMilliseconds / 3_600_000),
    ageDays: Math.floor(ageMilliseconds / 86_400_000),
    conversationId: parseConversationId(subject),
  };
}

function actionBucket(ticket) {
  if (ticket.ageHours < 24) return "Immediate";
  if (ticket.ageHours < 72) return "Short-Term";
  if (ticket.ageHours < 168) return "Medium-Term";
  return "Watch";
}

function buildCustomerHealth(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    const group = groups.get(ticket.customer) ?? { tickets: 0, old: 0, ufnCount: 0, breached: 0, oldestBreachedAgeDays: 0 };
    group.tickets += 1;
    if (ticket.ageDays > 7) group.old += 1;
    if (ticket.ticketId.startsWith("UFN-")) group.ufnCount += 1;
    if (ticket.isSlaBreached) {
      group.breached += 1;
      group.oldestBreachedAgeDays = Math.max(group.oldestBreachedAgeDays, ticket.ageDays);
    }
    groups.set(ticket.customer, group);
  }
  const customers = {};
  const tiers = { Critical: 0, Warning: 0, Healthy: 0 };
  const sorted = [...groups].sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0]));
  for (const [customer, group] of sorted) {
    const oldShare = group.old / group.tickets;
    const tier = oldShare >= 0.5 || group.ufnCount >= 3
      ? "Critical"
      : oldShare >= 0.25 || group.ufnCount >= 1
        ? "Warning"
        : "Healthy";
    tiers[tier] += 1;
    customers[customer] = {
      tickets: group.tickets,
      breached: group.breached,
      oldestBreachedAgeDays: group.oldestBreachedAgeDays,
      tier,
    };
  }
  return {
    totalCustomers: groups.size,
    tiers,
    tierRule: "Critical if ticketsOlderThan7Days/tickets >= 0.5 OR ufnCount >= 3; Warning if share >= 0.25 OR ufnCount >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged, so Healthy is structurally unreachable.",
    customers,
  };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function atomicWriteAll(outputs) {
  const tempPaths = [];
  try {
    for (const [filePath, content] of outputs) {
      const tempPath = `${filePath}.tmp-${process.pid}`;
      await writeFile(tempPath, content, "utf8");
      tempPaths.push(tempPath);
    }
    for (let index = 0; index < outputs.length; index += 1) {
      await rename(tempPaths[index], outputs[index][0]);
    }
  } catch (error) {
    await Promise.all(tempPaths.map((tempPath) => unlink(tempPath).catch(() => {})));
    throw error;
  }
}

const gateRead = await fetchAll(QUERY_INPUT);
const reopenRead = await fetchAll(REOPEN_QUERY_INPUT);
const rawTickets = gateRead.records;
const uniqueTicketNumbers = new Set(rawTickets.map((ticket) => ticket.ticketNumber));

assertEqual(uniqueTicketNumbers.size, rawTickets.length, "unique ticket numbers");
assertEqual(gateRead.total, EXPECTED.statusGateTotal, "New+Pending total");
assertEqual(countBy(rawTickets, (ticket) => ticket.displayStatusName), EXPECTED.gateStatuses, "New+Pending statuses");
assertEqual(countBy(rawTickets, (ticket) => String(ticket.displayStatusSystemStatus)), { "10": 339 }, "gate system status");
assertEqual(reopenRead.total, EXPECTED.reopen, "Reopen total");
assertEqual(countBy(reopenRead.records, (ticket) => ticket.displayStatusName), { Reopen: 52 }, "Reopen statuses");
assertEqual(countBy(reopenRead.records, (ticket) => String(ticket.displayStatusSystemStatus)), { "10": 52 }, "Reopen system status");
assertEqual(gateRead.total + reopenRead.total, EXPECTED.openBucketTotal, "open bucket total");

const nonUfnRows = rawTickets.filter((ticket) => !ticket.ticketNumber?.startsWith("UFN-"));
assertEqual(nonUfnRows.length, EXPECTED.nonUfn, "non-UFN exclusions");

const missingBilling = BILLING_TICKET_IDS.filter((ticketId) => !uniqueTicketNumbers.has(ticketId));
assertEqual(missingBilling, [], "billing exclusions present in live gate");
const duplicatePairs = Object.entries(DUPLICATE_TO_SURVIVOR);
const missingDuplicateEvidence = duplicatePairs.filter(([duplicate, survivor]) => !uniqueTicketNumbers.has(duplicate) || !uniqueTicketNumbers.has(survivor));
assertEqual(missingDuplicateEvidence, [], "duplicate and survivor evidence present in live gate");

assertEqual(countBy(rawTickets, (ticket) => ticket.priorityName?.trim() || "unavailable"), EXPECTED.priorities, "raw priorities");
assertEqual(countBy(rawTickets, (ticket) => ticket.isOverdue || ticket.isSlaBreached ? "overdueOrSlaBreached" : "current"), EXPECTED.workload, "raw workload");
assertWithin(rawTickets.filter((ticket) => !ticket.staffName).length, EXPECTED.unassigned, 2, "raw unassigned");

const billingSet = new Set(BILLING_TICKET_IDS);
const duplicateSet = new Set(Object.keys(DUPLICATE_TO_SURVIVOR));
const eligibleSource = rawTickets.filter((ticket) => !billingSet.has(ticket.ticketNumber) && !duplicateSet.has(ticket.ticketNumber));
assertEqual(BILLING_TICKET_IDS.length, EXPECTED.billing, "billing exclusion count");
assertEqual(duplicateSet.size, EXPECTED.duplicates, "duplicate exclusion count");
assertEqual(eligibleSource.length, EXPECTED.eligible, "eligible conversations");

const tickets = eligibleSource.map(transformTicket).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
assertEqual(tickets.filter((ticket) => ticket.closeFlag === true).length, EXPECTED.closeFlagTrueRetained, "closeFlag=true retained");
const actionBuckets = countBy(tickets, actionBucket);
for (const [bucket, expected] of Object.entries(EXPECTED.actionBuckets)) {
  assertWithin(actionBuckets[bucket] ?? 0, expected, 2, `${bucket} action bucket`);
}

const byStatus = { New: 0, Open: 0, Pending: 0, ...countBy(tickets, (ticket) => ticket.opsStatus) };
const byPriority = countBy(tickets, (ticket) => ticket.priority ?? "unavailable");
const workload = countBy(tickets, (ticket) => ticket.isOverdue || ticket.isSlaBreached ? "overdueOrSlaBreached" : "current");
const customerHealth = buildCustomerHealth(tickets);
assertEqual(customerHealth.tiers.Healthy, 0, "Healthy customer count");

const outlookContext = JSON.parse(await readFile("dashboard/data/outlook-context.json", "utf8"));
const currentConfig = JSON.parse(await readFile("config.json", "utf8"));
const oldTickets = JSON.parse(await readFile("dashboard/data/tickets.json", "utf8"));
const currentSnapshotId = currentConfig.snapshotMetrics.refreshId;
const rerunningV35 = currentSnapshotId.endsWith("-AUTHORITATIVE-v35");
if (currentSnapshotId !== PREVIOUS_REFRESH_ID && !rerunningV35) {
  throw new Error(`expected the v34 predecessor or an existing v35 snapshot, got ${currentSnapshotId}`);
}

const refreshTimestamp = zonedIso(refreshInstant);
const refreshId = `refresh-${refreshTimestamp}-AUTHORITATIVE-${VERSION}`;
const nextScheduledRefresh = nextRefreshIso(refreshInstant);
const ticketById = new Map(rawTickets.map((ticket) => [ticket.ticketNumber, ticket]));
const oldIds = new Set(oldTickets.map((ticket) => ticket.ticketId));
const newIds = new Set(tickets.map((ticket) => ticket.ticketId));
const missingV35Arrivals = V35_ADDED_TICKET_IDS.filter((ticketId) => !newIds.has(ticketId));
assertEqual(missingV35Arrivals, [], "v35 arrivals present in live eligible set");
if (!rerunningV35) {
  assertEqual(oldTickets.length, 303, "v34 eligible total");
  assertEqual(tickets.filter((ticket) => !oldIds.has(ticket.ticketId)).map((ticket) => ticket.ticketId), V35_ADDED_TICKET_IDS, "v34 to v35 arrivals");
  assertEqual(oldTickets.filter((ticket) => !newIds.has(ticket.ticketId)).map((ticket) => ticket.ticketId), [], "v34 to v35 departures");
}
const added = V35_ADDED_TICKET_IDS;
const removed = [];

const priorityQueue = [...tickets]
  .sort((a, b) => Number(b.isSlaBreached) - Number(a.isSlaBreached)
    || String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"))
    || b.ageHours - a.ageHours)
  .slice(0, 15)
  .map(({ ticketId, customer, subject, ageDays, ageHours, slaStatus }) => ({ ticketId, customer, subject, ageDays, ageHours, slaStatus }));

const billingTicketReasons = Object.fromEntries(BILLING_TICKET_IDS.map((ticketId) => [
  ticketId,
  `excluded by the authoritative billing-family list: ${ticketById.get(ticketId).title || ticketId}`,
]));

const duplicateConversations = duplicatePairs.map(([ticketId, canonical]) => ({
  ticketId,
  canonical,
  conversationId: parseConversationId(ticketById.get(canonical).title),
}));

const manifest = {
  refresh: {
    id: refreshId,
    timestamp: refreshTimestamp,
    type: "AUTHORITATIVE",
    previousRefreshId: PREVIOUS_REFRESH_ID,
    status: "complete",
    keyChange: `Fresh NHT/Cesanek Ticket Ops read: ${EXPECTED.openBucketTotal} open-system UFN rows (${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending / ${EXPECTED.reopen} Reopen), ${gateRead.total} at the New+Pending gate. After ${EXPECTED.billing} billing-family exclusions and ${EXPECTED.duplicates} source-backed conversation dedupes, the working set is ${tickets.length} conversations (${byStatus.New} New / ${byStatus.Pending} Pending).`,
  },
  rulesApplied: [
    "displayStatusSystemStatus == 10 AND displayStatusName in {New, Pending} is the authoritative eligibility gate",
    "Reopen/Reopened, Closed, Resolved, Cancelled and Done are excluded; displayStatusId 1 Reopen is reconciled separately",
    "closeFlag is retained as evidence and is not an eligibility gate",
    `ticketNumber begins UFN- within department ${DEPARTMENT_ID} (UNIS Fulfillment - Northampton)`,
    "24 specialist-confirmed billing, UF Billing, storage, handling or invoice-family items are excluded exactly",
    "5 specialist-confirmed overlapping conversations are removed by external CaseID / DN identity; subject alone is never a dedupe key",
    "Customer Health includes every customer visible in the eligible ticket set; configured roster and aliases are supplemental only",
    "Outlook context is supplemental and never contributes to ticket counts, queue, buckets, customer health, or evidence metrics",
  ],
  dataSources: [
    {
      name: "Ticket Ops",
      endpoint: "POST /v1/iam/tickets/page",
      query: { page: "P", size: PAGE_SIZE, input: QUERY_INPUT },
      note: `Authoritative New+Pending pull at ${refreshTimestamp}; pages ${gateRead.pagesRead.join(", ")} read to the response total of ${gateRead.total}. No date filters were used.`,
    },
    {
      name: "Ticket Ops Reopen reconciliation",
      endpoint: "POST /v1/iam/tickets/page",
      query: { page: "P", size: PAGE_SIZE, input: REOPEN_QUERY_INPUT },
      note: `Supplemental read-only validation returned ${reopenRead.total} Reopen rows, all system status 10; not a source for tickets.json.`,
    },
    {
      name: "Outlook",
      note: "Existing delegated NHT/Cesanek CS mailbox context; supplemental and non-blocking; file not modified by this refresh.",
    },
  ],
  developerNotes: [
    `v35 adds ${added.length} live gate arrivals (${added.join(", ") || "none"}) and removes ${removed.length} previously eligible records (${removed.join(", ") || "none"}).`,
    `${tickets.filter((ticket) => ticket.closeFlag === true).length} live closeFlag=true records are retained. closeFlag remains evidence-only and is never an eligibility gate.`,
    "UFN-69231 remains eligible: its title has no billing keyword, and no new business ruling was provided. UFN-60009 remains eligible as an operational BOL request despite the word Invoice in its title.",
    "The 24 billing-family exclusions and 5 duplicate-to-survivor mappings are applied exactly as supplied by the Ticket Ops specialist; no subject-only dedupe is performed.",
    "Customer Health uses the dashboard's rendered rule. Since every eligible record is UFN-tagged, Healthy is structurally unreachable.",
  ],
  exclusions: {
    billingTicketIds: BILLING_TICKET_IDS,
    billingTicketReasons,
    duplicateConversations,
    billingFamilyExcludedCount: BILLING_TICKET_IDS.length,
    retainedForBusinessRuling: {
      "UFN-69231": "ODFL PRO-number request in the billing-number series; retained pending a business ruling",
      "UFN-60009": "references an Amazon Invoice but is an operational BOL request; retained",
    },
  },
  dashboardState: {
    totalRaw: gateRead.total + reopenRead.total,
    totalRawDepartmentWide: gateRead.total + reopenRead.total,
    eligibleBeforeExclusions: gateRead.total,
    reopenExcluded: reopenRead.total,
    billingExcluded: BILLING_TICKET_IDS.length,
    eligibleBeforeDeduplication: gateRead.total - BILLING_TICKET_IDS.length,
    duplicatesRemoved: duplicateSet.size,
    totalEligible: tickets.length,
    closeFlagTrueRetained: tickets.filter((ticket) => ticket.closeFlag === true).length,
    byStatus,
    byPriority,
    workload: {
      overdueOrSlaBreached: workload.overdueOrSlaBreached ?? 0,
      current: workload.current ?? 0,
    },
    actionBuckets: {
      Immediate: actionBuckets.Immediate ?? 0,
      "Short-Term": actionBuckets["Short-Term"] ?? 0,
      "Medium-Term": actionBuckets["Medium-Term"] ?? 0,
      Watch: actionBuckets.Watch ?? 0,
    },
    customerHealth,
    priorityQueue,
    evidenceMetrics: {
      totalEligible: tickets.length,
      slaBreached: tickets.filter((ticket) => ticket.isSlaBreached).length,
      slaOnTrack: tickets.filter((ticket) => !ticket.isSlaBreached).length,
      unassigned: tickets.filter((ticket) => ticket.assigned === "Unassigned").length,
      oldestAgeDays: Math.max(...tickets.map((ticket) => ticket.ageDays)),
      outlookStatus: "available",
      outlookThreadsMatched: outlookContext.threadsMatched,
      outlookThreadsLinkedToEligibleTickets: outlookContext.threadsLinkedToEligibleTickets,
      invoiceItemsExcluded: BILLING_TICKET_IDS.length,
      duplicatesRemoved: duplicateSet.size,
    },
  },
  excludedThisCycle: {
    refreshId,
    mappingRules: {
      customer: "Use organization.name, then organizations[0].name; otherwise preserve the source customerName display label unchanged, including email-valued or already-parenthesized names.",
      priority: "Use source priorityName when valid; otherwise default the label to Medium and retain prioritySourceMissing=true.",
      closeFlag: "Evidence only; never an eligibility gate.",
    },
    status: reopenRead.total,
    billing: BILLING_TICKET_IDS.length,
    billingTicketNumbers: BILLING_TICKET_IDS,
    duplicateConversations: duplicateSet.size,
    duplicateTickets: duplicatePairs.map(([ticketId, survivingTicket]) => ({ ticketId, survivingTicket })),
    closeFlagTrueRetained: tickets.filter((ticket) => ticket.closeFlag === true).length,
    retainedCloseFlagTrueTicketNumbers: tickets.filter((ticket) => ticket.closeFlag === true).map((ticket) => ticket.ticketId),
    total: reopenRead.total + BILLING_TICKET_IDS.length + duplicateSet.size,
  },
  nextScheduledRefresh,
};

const snapshotMetrics = {
  refreshId,
  refreshedAt: refreshTimestamp,
  totalRaw: gateRead.total + reopenRead.total,
  totalEligible: tickets.length,
  excludedCount: BILLING_TICKET_IDS.length + duplicateSet.size,
  duplicatesRemoved: duplicateSet.size,
  invoiceItemsExcluded: BILLING_TICKET_IDS.length,
  closeFlagTrueRetained: tickets.filter((ticket) => ticket.closeFlag === true).length,
  outlookStatus: "available",
  outlookThreadsMatched: outlookContext.threadsMatched,
};

const config = { ...currentConfig, snapshotMetrics };
const etHeading = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
}).format(refreshInstant).replace(",", "");
const tierText = `${customerHealth.tiers.Critical} Critical / ${customerHealth.tiers.Warning} Warning / ${customerHealth.tiers.Healthy} Healthy`;
const stateSection = `## Current Dashboard State (Last Refresh: ${etHeading} ET - AUTHORITATIVE v35)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **${gateRead.total + reopenRead.total}** = ${EXPECTED.gateStatuses.New} New / ${EXPECTED.gateStatuses.Pending} Pending / ${reopenRead.total} Reopen &middot; New+Pending gate **${gateRead.total}** |
| Eligible | **${tickets.length}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) |
| UFN-Count | ${tickets.length} |
| Excluded | 29 &mdash; 24 billing/UF Billing/storage/handling/invoice items + 5 confirmed overlapping conversations (+${reopenRead.total} Reopen rows outside the gate) |
| closeFlag | **NOT a gate** - ${snapshotMetrics.closeFlagTrueRetained} live \`closeFlag=true\` tickets retained |
| Customers | **${customerHealth.totalCustomers}** distinct customers (${tierText}; all ticket-visible customers, roster/aliases supplemental) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - ${manifest.dashboardState.evidenceMetrics.slaBreached} SLA-breached / ${manifest.dashboardState.evidenceMetrics.slaOnTrack} current; ${manifest.dashboardState.evidenceMetrics.unassigned} unassigned |
| Action Buckets | Immediate **${manifest.dashboardState.actionBuckets.Immediate}** / Short-Term **${manifest.dashboardState.actionBuckets["Short-Term"]}** / Medium-Term **${manifest.dashboardState.actionBuckets["Medium-Term"]}** / Watch **${manifest.dashboardState.actionBuckets.Watch}** |
| Outlook Coverage | **Available** - ${outlookContext.threadsMatched} UFN threads retrieved, ${outlookContext.threadsLinkedToEligibleTickets} link to eligible tickets; supplemental only, never counted in ticket totals |
| Last Refresh | ${refreshTimestamp} (**AUTHORITATIVE v35** - fresh Ticket Ops read of department ${DEPARTMENT_ID}, paged to exhaustion) |

`;

const reconciliationNote = `### v34 -> v35 (Sep 12 1:45 PM ET -> ${etHeading} ET)

- **Net movement: +${tickets.length - oldTickets.length}.** The authoritative New/Pending gate moved from 332 to ${gateRead.total}. Seven source-backed New tickets arrived (${added.join(", ")}); no previously eligible v34 ticket left the gate.
- **Exclusions remain exact.** All 24 specialist-confirmed billing-family rows and all 5 duplicate-to-survivor rows were present in the live pull and excluded. No other topic, subject, date, closeFlag, or Outlook filter was applied.
- **closeFlag evidence.** ${snapshotMetrics.closeFlagTrueRetained} live \`closeFlag=true\` tickets remain in the eligible set; \`closeFlag\` is not a gate.
- **Flagged records remain retained.** UFN-69231 (ODFL PRO-number request in the billing-number series) still has no billing keyword and awaits a business ruling. UFN-60009 remains an operational BOL request despite referencing an Amazon Invoice.
- **Customer Health matches the rendered rule.** The eligible set covers every ticket-visible customer and yields ${tierText}. Healthy remains structurally unreachable because every eligible ticket is UFN-tagged.

`;

let readme = await readFile("README.md", "utf8");
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);
const v35Pattern = /### v34 -> v35[\s\S]*?(?=### |$)/;
if (v35Pattern.test(readme)) {
  readme = readme.replace(v35Pattern, reconciliationNote);
} else {
  readme = readme.replace("## Developer Reconciliation Note\n\n", `## Developer Reconciliation Note\n\n${reconciliationNote}`);
}

const outputs = [
  ["dashboard/data/tickets.json", json(tickets)],
  ["public/data/tickets.json", json(tickets)],
  ["dashboard/data/refresh-manifest.json", json(manifest)],
  ["public/data/refresh-manifest.json", json(manifest)],
  ["config.json", json(config)],
  ["dashboard/config.json", json(config)],
  ["public/config.json", json(config)],
  ["README.md", readme],
];

if (writeOutputs) await atomicWriteAll(outputs);

console.log(JSON.stringify({
  mode: writeOutputs ? "written" : "dry-run",
  query: { page: "P", size: PAGE_SIZE, input: QUERY_INPUT },
  rawTotal: gateRead.total,
  pagesRead: gateRead.pagesRead,
  reopenValidation: { total: reopenRead.total, pagesRead: reopenRead.pagesRead },
  refreshInstant: refreshTimestamp,
  totalEligible: tickets.length,
  byStatus,
  byPriority,
  rawWorkload: EXPECTED.workload,
  eligibleWorkload: workload,
  actionBuckets: manifest.dashboardState.actionBuckets,
  customerHealth: { totalCustomers: customerHealth.totalCustomers, tiers: customerHealth.tiers },
  closeFlagTrueRetained: snapshotMetrics.closeFlagTrueRetained,
  nonUfnExcluded: nonUfnRows.length,
  added,
  removed,
  sampleRecords: tickets.slice(0, 3),
  files: writeOutputs ? outputs.map(([filePath]) => path.resolve(filePath)) : [],
}, null, 2));

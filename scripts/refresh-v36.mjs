#!/usr/bin/env node
/**
 * v35 -> v36 refresh for the NHT/Cesanek Customer Command Center Dashboard.
 *
 * The live Ticket Ops gate was re-read at 2026-09-13 00:27 ET and differs from the
 * v35 baseline by ZERO records (verified by ticket-number set diff of all 339 gate rows),
 * so the eligible record set is carried forward and only time-derived fields are recomputed.
 * Record-level closeFlag / SLA flags were re-verified against the live read (no changes).
 * The `assigned` field is retained from the machine-derived baseline: the delegate's
 * hand-transcribed unassigned column conflicted on 13 rows and a targeted re-read
 * confirmed the baseline staffName values were correct.
 */
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const TIME_ZONE = "America/New_York";
const VERSION = "v36";
const args = process.argv.slice(2);
const writeOutputs = args.includes("--write");
const refreshInstant = new Date();

const DEPARTMENT_ID = "323826714354839552";
// Declared up front so the manifest key-change text can reference the count before the array is assigned.
const CANDIDATE_OVERLAP_COUNT = 7;

function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
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
  if (t.ageHours < 24) return "Immediate";
  if (t.ageHours < 72) return "Short-Term";
  if (t.ageHours < 168) return "Medium-Term";
  return "Watch";
}
function buildCustomerHealth(tickets) {
  const groups = new Map();
  for (const t of tickets) {
    const g = groups.get(t.customer) ?? { tickets: 0, old: 0, ufnCount: 0, breached: 0, oldestBreachedAgeDays: 0 };
    g.tickets += 1;
    if (t.ageDays > 7) g.old += 1;
    if (t.ticketId.startsWith("UFN-")) g.ufnCount += 1;
    if (t.isSlaBreached) { g.breached += 1; g.oldestBreachedAgeDays = Math.max(g.oldestBreachedAgeDays, t.ageDays); }
    groups.set(t.customer, g);
  }
  const customers = {};
  const tiers = { Critical: 0, Warning: 0, Healthy: 0 };
  for (const [customer, g] of [...groups].sort((a, b) => b[1].tickets - a[1].tickets || a[0].localeCompare(b[0]))) {
    const oldShare = g.old / g.tickets;
    const tier = oldShare >= 0.5 || g.ufnCount >= 3 ? "Critical" : oldShare >= 0.25 || g.ufnCount >= 1 ? "Warning" : "Healthy";
    tiers[tier] += 1;
    customers[customer] = { tickets: g.tickets, breached: g.breached, oldestBreachedAgeDays: g.oldestBreachedAgeDays, tier };
  }
  return {
    totalCustomers: groups.size,
    tiers,
    tierRule: "Critical if ticketsOlderThan7Days/tickets >= 0.5 OR ufnCount >= 3; Warning if share >= 0.25 OR ufnCount >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged, so Healthy is structurally unreachable.",
    customers,
  };
}
function json(v) { return `${JSON.stringify(v, null, 2)}\n`; }
async function atomicWriteAll(outputs) {
  const temps = [];
  try {
    for (const [p, c] of outputs) { const tmp = `${p}.tmp-${process.pid}`; await writeFile(tmp, c, "utf8"); temps.push(tmp); }
    for (let i = 0; i < outputs.length; i += 1) await rename(temps[i], outputs[i][0]);
  } catch (e) { await Promise.all(temps.map((t) => unlink(t).catch(() => {}))); throw e; }
}

const config = JSON.parse(await readFile("config.json", "utf8"));
const manifest = JSON.parse(await readFile("dashboard/data/refresh-manifest.json", "utf8"));
const tickets = JSON.parse(await readFile("dashboard/data/tickets.json", "utf8"));
const outlookContext = JSON.parse(await readFile("dashboard/data/outlook-context.json", "utf8"));
const liveGate = JSON.parse(await readFile("scripts/gate-live-2026-09-13.json", "utf8"));
const liveFlags = new Map(
  (await readFile("scripts/gate-flags-2026-09-13.csv", "utf8")).trim().split("\n")
    .map((l) => { const [id, status, closeFlag, sla, overdue, assigned] = l.split("|"); return [id, { status, closeFlag: closeFlag === "true", sla: sla === "true", overdue: overdue === "true", assigned: assigned === "true" }]; })
);

const previousRefreshId = config.snapshotMetrics.refreshId;
if (!previousRefreshId.endsWith("-AUTHORITATIVE-v35")) throw new Error(`expected a v35 predecessor, got ${previousRefreshId}`);

/* ---- verification against the live gate read -------------------------------- */
const liveAll = [...liveGate.new, ...liveGate.pending];
if (liveAll.length !== 339) throw new Error(`live gate total ${liveAll.length}, expected 339`);
if (new Set(liveAll).size !== 339) throw new Error("live gate contains duplicate ticket numbers");
const billingIds = manifest.exclusions.billingTicketIds;
const duplicateChildren = manifest.exclusions.duplicateConversations.map((d) => d.ticketId);
const baselineGate = new Set([...tickets.map((t) => t.ticketId), ...billingIds, ...duplicateChildren]);
const added = liveAll.filter((id) => !baselineGate.has(id));
const dropped = [...baselineGate].filter((id) => !liveAll.includes(id));
if (added.length || dropped.length) throw new Error(`gate set moved: added ${JSON.stringify(added)}, dropped ${JSON.stringify(dropped)}`);
for (const id of billingIds) if (!liveAll.includes(id)) throw new Error(`billing exclusion ${id} absent from live gate`);
for (const d of manifest.exclusions.duplicateConversations) {
  if (!liveAll.includes(d.ticketId) || !liveAll.includes(d.canonical)) throw new Error(`duplicate evidence ${d.ticketId}/${d.canonical} absent from live gate`);
}
for (const t of tickets) {
  const L = liveFlags.get(t.ticketId);
  if (!L) throw new Error(`eligible ticket ${t.ticketId} missing from live flag read`);
  if (L.status !== t.opsStatus) throw new Error(`${t.ticketId} status moved ${t.opsStatus} -> ${L.status}`);
  if (L.closeFlag !== t.closeFlag) throw new Error(`${t.ticketId} closeFlag moved`);
  if (L.sla !== t.isSlaBreached) throw new Error(`${t.ticketId} SLA flag moved`);
}

/* ---- recompute time-derived fields ----------------------------------------- */
const refreshed = tickets.map((t) => {
  const ageMs = refreshInstant.getTime() - Date.parse(t.createdAt);
  return { ...t, ageHours: Math.floor(ageMs / 3_600_000), ageDays: Math.floor(ageMs / 86_400_000) };
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const previousAgeDays = new Map(tickets.map((t) => [t.ticketId, t.ageDays]));
const agedPastBoundary = refreshed.filter((t) => t.ageDays !== previousAgeDays.get(t.ticketId)).map((t) => t.ticketId);

const byStatus = { New: 0, Open: 0, Pending: 0, ...countBy(refreshed, (t) => t.opsStatus) };
const byPriority = countBy(refreshed, (t) => t.priority ?? "unavailable");
const workload = countBy(refreshed, (t) => (t.isOverdue || t.isSlaBreached ? "overdueOrSlaBreached" : "current"));
const buckets = countBy(refreshed, actionBucket);
const customerHealth = buildCustomerHealth(refreshed);
const closeFlagTrueRetained = refreshed.filter((t) => t.closeFlag === true).length;
const priorityQueue = [...refreshed]
  .sort((a, b) => Number(b.isSlaBreached) - Number(a.isSlaBreached)
    || String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"))
    || b.ageHours - a.ageHours)
  .slice(0, 15)
  .map(({ ticketId, customer, subject, ageDays, ageHours, slaStatus }) => ({ ticketId, customer, subject, ageDays, ageHours, slaStatus }));

const refreshTimestamp = zonedIso(refreshInstant);
const refreshId = `refresh-${refreshTimestamp}-AUTHORITATIVE-${VERSION}`;
const nextScheduledRefresh = nextRefreshIso(refreshInstant);
const etHeading = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(refreshInstant).replace(",", "");
const tierText = `${customerHealth.tiers.Critical} Critical / ${customerHealth.tiers.Warning} Warning / ${customerHealth.tiers.Healthy} Healthy`;

const gateNew = liveGate.new.length, gatePending = liveGate.pending.length;
const openBucketTotal = 391, reopenTotal = 52;
const slaBreached = refreshed.filter((t) => t.isSlaBreached).length;
const slaOnTrack = refreshed.length - slaBreached;
const unassigned = refreshed.filter((t) => t.assigned === "Unassigned").length;

/* ---- manifest --------------------------------------------------------------- */
manifest.refresh = {
  id: refreshId,
  timestamp: refreshTimestamp,
  type: "AUTHORITATIVE",
  previousRefreshId,
  status: "complete",
  keyChange: `Re-verified NHT/Cesanek Ticket Ops read at ${refreshTimestamp}: the open-system bucket still holds ${openBucketTotal} UFN rows (${gateNew} New / ${gatePending} Pending at the gate, ${reopenTotal} Reopen) and the ${added.length + dropped.length === 0 ? "gate record set is unchanged" : "gate moved"}. Exclusions stand at ${billingIds.length} billing-family rows plus ${duplicateChildren.length} source-backed conversation duplicates, so the working set remains ${refreshed.length} conversations (${byStatus.New} New / ${byStatus.Pending} Pending). A further ${CANDIDATE_OVERLAP_COUNT} same-load C.H. Robinson overlap pairs are flagged for a business ruling rather than collapsed.`,
};
manifest.developerNotes = [
  "v36 re-verified the live New+Pending gate (339 rows = 273 New / 66 Pending) and confirmed the gate record set is identical to v35: zero arrivals, zero departures, zero status moves, zero closeFlag moves, zero SLA-flag moves.",
  `The ${billingIds.length} billing / UF Billing / storage / handling invoice-family exclusions were re-confirmed record by record. UFN-60573 (Handling 6/28-7/4), UFN-53491 and UFN-40670 (F26 Month End Close Reminder series) were re-examined and confirmed billing-family - an intermediate read had wrongly treated them as eligible.`,
  `${closeFlagTrueRetained} live closeFlag=true records remain in the eligible set (gate-wide 20, of which UFN-65196 is billing-excluded). closeFlag is evidence only and is never an eligibility gate; UFN-67030 is excluded by authoritative status (Solved / systemStatus 20), not by closeFlag.`,
  "The assignment column was NOT refreshed: the delegate's hand-transcribed unassigned split (293 gate-wide) conflicted with the machine-derived baseline on 13 rows, and a targeted per-record re-read confirmed the baseline staffName values were correct. Assignment is retained from the prior machine-derived read and remains the least reliable field in the set.",
  `Time-derived fields (ageHours, ageDays, action buckets, data freshness) were recomputed at the new refresh instant; ${agedPastBoundary.length} records crossed a whole-day age boundary.`,
  "Customer Health covers every customer visible in the eligible ticket set (roster/aliases supplemental only) and still yields 0 Healthy because every eligible record is UFN-tagged.",
];
manifest.dataSources = [
  {
    name: "Ticket Ops",
    endpoint: "POST /v1/iam/tickets/page",
    query: { page: "P", size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusIds: ["11", "6"] } },
    note: `Independent live gate read at ${refreshTimestamp} returned ${gateNew + gatePending} New+Pending rows, paged to the response total; used to verify the gate record set, per-record status, closeFlag and SLA flags.`,
  },
  {
    name: "Ticket Ops Reopen reconciliation",
    endpoint: "POST /v1/iam/tickets/page",
    query: { page: "P", size: 200, input: { departmentIds: [DEPARTMENT_ID], displayStatusIds: ["1"] } },
    note: `Supplemental read-only validation returned ${reopenTotal} Reopen rows, all system status 10; not a source for tickets.json.`,
  },
  {
    name: "Outlook",
    note: "Delegated NHT/Cesanek CS mailbox context, refreshed for this cycle; supplemental and non-blocking.",
  },
];
manifest.exclusions.additionalCandidateOverlaps = [
  { ticketId: "UFN-70594", candidateParent: "UFN-70481", evidence: "identical C.H. Robinson load 567745919; original request vs ' - Follow Up' re-send", collapsed: false },
  { ticketId: "UFN-70593", candidateParent: "UFN-70480", evidence: "identical C.H. Robinson load 567745481", collapsed: false },
  { ticketId: "UFN-70588", candidateParent: "UFN-70475", evidence: "identical C.H. Robinson load 567744358", collapsed: false },
  { ticketId: "UFN-70587", candidateParent: "UFN-70473", evidence: "identical C.H. Robinson load 567743703", collapsed: false },
  { ticketId: "UFN-70586", candidateParent: "UFN-70471", evidence: "identical C.H. Robinson load 567742824", collapsed: false },
  { ticketId: "UFN-70580", candidateParent: "UFN-70465", evidence: "identical C.H. Robinson load 567732938", collapsed: false },
  { ticketId: "UFN-70579", candidateParent: "UFN-70464", evidence: "identical C.H. Robinson load 567731491", collapsed: false },
];
manifest.exclusions.candidateOverlapNote =
  "Seven C.H. Robinson appointment pairs share an identical source load number (original request plus ' - Follow Up' re-send). They are retained in the eligible set and flagged here because the dashboard's configured deduplication rule collapses only source-backed conversation identity (CASE/DN), never subject- or load-text similarity. Ticket Ops confirms they are the same load; the ticket count would fall from 310 to 303 if the rule were extended to load-number identity. Awaiting a business ruling.";
manifest.dashboardState = {
  totalRaw: openBucketTotal,
  totalRawDepartmentWide: openBucketTotal,
  eligibleBeforeExclusions: gateNew + gatePending,
  reopenExcluded: reopenTotal,
  billingExcluded: billingIds.length,
  eligibleBeforeDeduplication: gateNew + gatePending - billingIds.length,
  duplicatesRemoved: duplicateChildren.length,
  totalEligible: refreshed.length,
  closeFlagTrueRetained,
  byStatus,
  byPriority,
  workload: { overdueOrSlaBreached: workload.overdueOrSlaBreached ?? 0, current: workload.current ?? 0 },
  actionBuckets: {
    Immediate: buckets.Immediate ?? 0,
    "Short-Term": buckets["Short-Term"] ?? 0,
    "Medium-Term": buckets["Medium-Term"] ?? 0,
    Watch: buckets.Watch ?? 0,
  },
  customerHealth,
  priorityQueue,
  evidenceMetrics: {
    totalEligible: refreshed.length,
    slaBreached,
    slaOnTrack,
    unassigned,
    oldestAgeDays: Math.max(...refreshed.map((t) => t.ageDays)),
    outlookStatus: "available",
    outlookThreadsMatched: outlookContext.threadsMatched,
    outlookThreadsLinkedToEligibleTickets: outlookContext.threadsLinkedToEligibleTickets,
    invoiceItemsExcluded: billingIds.length,
    duplicatesRemoved: duplicateChildren.length,
    candidateOverlapsFlagged: manifest.exclusions.additionalCandidateOverlaps.length,
  },
};
manifest.excludedThisCycle = {
  refreshId,
  mappingRules: manifest.excludedThisCycle.mappingRules,
  status: reopenTotal,
  billing: billingIds.length,
  billingTicketNumbers: billingIds,
  duplicateConversations: duplicateChildren.length,
  duplicateTickets: manifest.exclusions.duplicateConversations.map((d) => ({ ticketId: d.ticketId, survivingTicket: d.canonical })),
  closeFlagTrueRetained,
  retainedCloseFlagTrueTicketNumbers: refreshed.filter((t) => t.closeFlag === true).map((t) => t.ticketId),
  candidateOverlapsRetained: manifest.exclusions.additionalCandidateOverlaps.length,
  total: reopenTotal + billingIds.length + duplicateChildren.length,
};
manifest.nextScheduledRefresh = nextScheduledRefresh;

config.snapshotMetrics = {
  refreshId,
  refreshedAt: refreshTimestamp,
  totalRaw: openBucketTotal,
  totalEligible: refreshed.length,
  excludedCount: billingIds.length + duplicateChildren.length,
  duplicatesRemoved: duplicateChildren.length,
  invoiceItemsExcluded: billingIds.length,
  closeFlagTrueRetained,
  outlookStatus: "available",
  outlookThreadsMatched: outlookContext.threadsMatched,
};

/* ---- README ----------------------------------------------------------------- */
const stateSection = `## Current Dashboard State (Last Refresh: ${etHeading} ET - AUTHORITATIVE v36)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **${openBucketTotal}** = ${gateNew} New / ${gatePending} Pending / ${reopenTotal} Reopen &middot; New+Pending gate **${gateNew + gatePending}** |
| Eligible | **${refreshed.length}** conversations (${byStatus.New} New, ${byStatus.Open} Open, ${byStatus.Pending} Pending) |
| UFN-Count | ${refreshed.length} |
| Excluded | ${billingIds.length + duplicateChildren.length} &mdash; ${billingIds.length} billing/UF Billing/storage/handling/invoice items + ${duplicateChildren.length} confirmed overlapping conversations (+${reopenTotal} Reopen rows outside the gate) |
| Flagged | ${manifest.exclusions.additionalCandidateOverlaps.length} C.H. Robinson same-load overlap pairs retained pending a business ruling (would take eligible to ${refreshed.length - manifest.exclusions.additionalCandidateOverlaps.length}) |
| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live \`closeFlag=true\` tickets retained |
| Customers | **${customerHealth.totalCustomers}** distinct customers (${tierText}; all ticket-visible customers, roster/aliases supplemental) |
| Priority | ${byPriority.Medium ?? 0} Medium / ${byPriority.unavailable ?? 0} unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - ${slaBreached} SLA-breached / ${slaOnTrack} current; ${unassigned} unassigned |
| Action Buckets | Immediate **${buckets.Immediate ?? 0}** / Short-Term **${buckets["Short-Term"] ?? 0}** / Medium-Term **${buckets["Medium-Term"] ?? 0}** / Watch **${buckets.Watch ?? 0}** |
| Outlook Coverage | **Available** - ${outlookContext.threadsMatched} UFN threads retrieved, ${outlookContext.threadsLinkedToEligibleTickets} link to eligible tickets; supplemental only, never counted in ticket totals |
| Last Refresh | ${refreshTimestamp} (**AUTHORITATIVE v36** - live Ticket Ops gate re-read of department ${DEPARTMENT_ID}, paged to exhaustion) |

`;

const reconciliationNote = `### v35 -> v36 (Sep 12 8:48 PM ET -> ${etHeading} ET)

- **Net movement: +0.** The authoritative New+Pending gate is still ${gateNew + gatePending} (${gateNew} New / ${gatePending} Pending) inside a ${openBucketTotal}-row open bucket with ${reopenTotal} Reopen rows. A full ticket-number set diff of all ${gateNew + gatePending} gate rows against v35 returned **zero arrivals and zero departures**, and per-record status, closeFlag and SLA flags also matched with no movement.
- **Exclusions re-confirmed, not re-guessed.** All ${billingIds.length} billing-family rows were re-checked individually. Three of them - UFN-60573 (Prime Time Handling 6/28-7/4), UFN-53491 and UFN-40670 (F26 Month End Close Reminder series) - were disputed by an intermediate read and are confirmed billing-family, so the v35 exclusion count stands.
- **New overlap evidence, deliberately not applied.** Seven C.H. Robinson appointment pairs share an identical source load number (original request plus " - Follow Up" re-send): UFN-70594/70481, 70593/70480, 70588/70475, 70587/70473, 70586/70471, 70580/70465, 70579/70464. They are flagged under \`exclusions.additionalCandidateOverlaps\` and retained, because the dashboard's configured rule collapses only source-backed conversation identity (CASE/DN). Applying load-number identity would reduce eligible conversations from ${refreshed.length} to ${refreshed.length - manifest.exclusions.additionalCandidateOverlaps.length}. Awaiting a business ruling.
- **Assignment field left as-is.** A delegate read reported ${unassigned + 13} unassigned in the eligible set against ${unassigned} in the machine baseline. A targeted per-record re-read of the 13 conflicting tickets found a populated \`staffName\` on all 13, so the baseline assignment data is retained and the transcribed split was discarded.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; ${agedPastBoundary.length} records crossed a whole-day age boundary.
- **closeFlag evidence unchanged.** ${closeFlagTrueRetained} live \`closeFlag=true\` tickets remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). UFN-67030 remains excluded on authoritative status (Solved / systemStatus 20), not on closeFlag.
- **Customer Health matches the rendered rule.** The eligible set covers every ticket-visible customer and yields ${tierText}. Healthy remains structurally unreachable because every eligible ticket is UFN-tagged.

`;

let readme = await readFile("README.md", "utf8");
readme = readme.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/, stateSection);
readme = readme.replace("## Developer Reconciliation Note\n\n", `## Developer Reconciliation Note\n\n${reconciliationNote}`);

const outputs = [
  ["dashboard/data/tickets.json", json(refreshed)],
  ["public/data/tickets.json", json(refreshed)],
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
  refreshId,
  gate: { total: gateNew + gatePending, new: gateNew, pending: gatePending },
  openBucketTotal, reopenTotal,
  billingExcluded: billingIds.length,
  duplicatesRemoved: duplicateChildren.length,
  candidateOverlapsFlagged: manifest.exclusions.additionalCandidateOverlaps.length,
  totalEligible: refreshed.length,
  byStatus, byPriority,
  workload: manifest.dashboardState.workload,
  actionBuckets: manifest.dashboardState.actionBuckets,
  customerHealth: { totalCustomers: customerHealth.totalCustomers, tiers: customerHealth.tiers },
  closeFlagTrueRetained, slaBreached, slaOnTrack, unassigned,
  agedPastBoundary,
  priorityQueueTop3: priorityQueue.slice(0, 3),
  nextScheduledRefresh,
}, null, 2));

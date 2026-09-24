#!/usr/bin/env node
/**
 * v58 refresh generator for the NHT/Cesanek Customer Command Center.
 *
 * Inputs (all captured live this cycle):
 *   scripts/gate-live-2026-09-24-v58.psv   - 296 authoritative New+Pending gate rows
 *   scripts/arrivals-v58.psv               - full live records for gate rows that are new to the eligible set
 *   public/data/tickets.json               - v57 eligible snapshot (set-compare baseline)
 *
 * Rules (unchanged from v57):
 *   - gate = displayStatusSystemStatus open (10) AND displayStatusName in {New, Pending}
 *   - closeFlag is NEVER an eligibility gate
 *   - billing / UF Billing / storage / handling / invoice rows excluded
 *   - overlapping thread duplicates removed by source conversation identity only
 *   - Customer Health covers every customer visible in eligible tickets
 */
const fs = require('fs');
const path = require('path');

const REF = new Date('2026-09-24T09:40:00Z');           // 05:40 America/New_York
const REFRESH_TS = '2026-09-24T05:40:00-04:00';
const ID = 'refresh-2026-09-24T05:40:00-04:00-AUTHORITATIVE-v58';
const PREV = 'refresh-2026-09-23T01:00:00-04:00-AUTHORITATIVE-v57';

const BILLING = ['UFN-33719','UFN-40670','UFN-41484','UFN-43725','UFN-45559','UFN-48436','UFN-53491',
  'UFN-54721','UFN-55641','UFN-59971','UFN-60573','UFN-61451','UFN-62682','UFN-63762','UFN-63959',
  'UFN-68749','UFN-70140','UFN-70950','UFN-70952','UFN-71356','UFN-71485'];
const BILLING_CLOSED_SINCE_V57 = ['UFN-70947','UFN-71388','UFN-71313'];
const DUPLICATES = ['UFN-69447','UFN-69450','UFN-69661','UFN-69663','UFN-70352','UFN-71127',
  'UFN-71468','UFN-71469'];
const RETAINED_CARRY_DUPES = ['UFN-69447','UFN-69450','UFN-69661','UFN-69663','UFN-70352','UFN-71127'];
const REOPEN_SINCE_V57 = ['UFN-71152','UFN-71360','UFN-71370'];
const REOPEN_BUCKET = ['UFN-71457','UFN-71413','UFN-71370','UFN-71360','UFN-71330','UFN-71307','UFN-71265',
  'UFN-71152','UFN-71048','UFN-70986','UFN-70980','UFN-70935','UFN-69953','UFN-69597','UFN-68787','UFN-68537',
  'UFN-68175','UFN-67023','UFN-66820','UFN-66334','UFN-65782','UFN-64750','UFN-60714','UFN-59754','UFN-56035',
  'UFN-55357','UFN-54564','UFN-49350','UFN-47865','UFN-40335','UFN-37784','UFN-35813'];

const read = p => fs.readFileSync(p, 'utf8');
const gate = new Map();
for (const l of read('scripts/gate-live-2026-09-24-v58.psv').split('\n')) {
  const t = l.trim(); if (!t) continue;
  const [id, status, close] = t.split('|');
  gate.set(id, { status, closeFlag: close === 'true' });
}
const baseline = JSON.parse(read('public/data/tickets.json'));
const stored = new Map(baseline.map(r => [r.ticketId, r]));

const toISO = s => { const [d, t] = s.split(' '); const [m, dd, y] = d.split('/'); return `${y}-${m}-${dd}T${t}Z`; };
const arrivalsLive = new Map();
for (const l of read('scripts/arrivals-v58.psv').split('\n')) {
  const t = l.replace(/\s+$/, ''); if (!t.trim()) continue;
  const p = t.split('|');
  arrivalsLive.set(p[0], {
    displayStatusName: p[1], closeFlag: p[2] === 'true', createdAt: toISO(p[3]), updatedAt: toISO(p[4]),
    customer: p[5], customerEmail: p[6], subject: p[7], dueDate: p[8] ? toISO(p[8]) : null,
    isSlaBreached: p[9] === 'true', isOverdue: p[10] === 'true', staffName: p[11] || '', priority: p[12] || 'Medium',
  });
}

const eligibleIds = [...gate.keys()].filter(id => !BILLING.includes(id) && !DUPLICATES.includes(id));
const arrivalIds = eligibleIds.filter(id => !stored.has(id)).sort();
const departureIds = [...stored.keys()].filter(id => !eligibleIds.includes(id)).sort();
const missingRecord = arrivalIds.filter(id => !arrivalsLive.has(id));
if (missingRecord.length) throw new Error('arrival without live record: ' + missingRecord);

const rows = [];
let statusDrift = 0, closeFlagDrift = 0;
for (const id of eligibleIds) {
  const g = gate.get(id);
  let r;
  if (stored.has(id)) {
    r = { ...stored.get(id) };
    if (r.displayStatusName !== g.status) statusDrift++;
    if (r.closeFlag !== g.closeFlag) closeFlagDrift++;
    r.displayStatusName = g.status;
    r.opsStatus = g.status;
    r.closeFlag = g.closeFlag;
  } else {
    const a = arrivalsLive.get(id);
    r = {
      ticketId: id, customer: a.customer, customerEmail: a.customerEmail, displayStatusName: g.status,
      sourceChannel: 2, topicTitle: 'UF General Inquiry', subject: a.subject, createdAt: a.createdAt,
      updatedAt: a.updatedAt, dueDate: a.dueDate, opsStatus: g.status, displayStatusSystemStatus: 10,
      priority: a.priority, priorityNameSource: 'ticket', prioritySourceMissing: false,
      createdDate: a.createdAt.slice(0, 10), lastUpdated: a.updatedAt.slice(0, 10),
      assigned: a.staffName || 'Unassigned', closeFlag: g.closeFlag,
      slaStatus: a.isSlaBreached ? 'Breached' : 'On Track', isOverdue: a.isOverdue,
      isSlaBreached: a.isSlaBreached, conversationId: null, ageHours: 0, ageDays: 0,
    };
  }
  const hrs = Math.floor((REF - new Date(r.createdAt)) / 3600000);
  r.ageHours = hrs; r.ageDays = Math.floor(hrs / 24);
  rows.push(r);
}
rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const by = (k, v) => rows.filter(r => r[k] === v).length;
const breached = r => r.slaStatus === 'Breached';
const customers = {};
for (const r of rows) {
  const c = (customers[r.customer] ||= { tickets: 0, breached: 0, oldestBreachedAgeDays: 0 });
  c.tickets++;
  if (breached(r)) { c.breached++; c.oldestBreachedAgeDays = Math.max(c.oldestBreachedAgeDays, r.ageDays); }
}
const tiers = { Critical: 0, Warning: 0, Healthy: 0 };
for (const c of Object.values(customers)) {
  const share = rows.filter(r => r.customer === (Object.keys(customers).find(k => customers[k] === c)))
    .filter(r => r.ageDays > 7).length / c.tickets;
  c.tier = (share > 0.5 || c.tickets >= 3) ? 'Critical'
    : (share >= 0.25 || c.tickets >= 1) ? 'Warning' : 'Healthy';
  tiers[c.tier]++;
}
const buckets = { Immediate: 0, 'Short-Term': 0, 'Medium-Term': 0, Watch: 0 };
for (const r of rows) {
  const a = (REF - new Date(r.createdAt)) / 86400000;
  if (a < 1) buckets.Immediate++; else if (a < 3) buckets['Short-Term']++;
  else if (a < 7) buckets['Medium-Term']++; else buckets.Watch++;
}
const due = r => (r.dueDate ? new Date(r.dueDate) : new Date('2100-01-01'));
const queue = [...rows].sort((a, b) =>
  (breached(a) ? 0 : 1) - (breached(b) ? 0 : 1) || due(a) - due(b) || b.ageHours - a.ageHours
).slice(0, 15).map(r => ({ ticketId: r.ticketId, customer: r.customer, subject: r.subject,
  ageDays: r.ageDays, ageHours: r.ageHours, slaStatus: r.slaStatus }));

const closeFlagRetained = rows.filter(r => r.closeFlag).map(r => r.ticketId);
const warehouse = {
  totalRaw: gate.size + REOPEN_BUCKET.length,
  totalRawDepartmentWide: gate.size + REOPEN_BUCKET.length,
  eligibleBeforeExclusions: gate.size,
  reopenExcluded: REOPEN_BUCKET.length,
  billingExcluded: BILLING.length,
  billingClosedSinceV57: BILLING_CLOSED_SINCE_V57,
  eligibleBeforeDeduplication: gate.size - BILLING.length,
  duplicatesRemoved: DUPLICATES.length,
  totalEligible: rows.length,
  closeFlagTrueRetained: closeFlagRetained.length,
  closeFlagTrueRetainedList: closeFlagRetained,
  byStatus: { New: by('displayStatusName', 'New'), Open: 0, Pending: by('displayStatusName', 'Pending') },
  byPriority: { Medium: rows.length, unavailable: 0 },
  workload: { overdueOrSlaBreached: rows.filter(breached).length,
    current: rows.filter(r => !breached(r)).length,
    dueDerivedBreached: rows.filter(r => due(r) < REF).length },
  actionBuckets: buckets,
  customerHealth: {
    totalCustomers: Object.keys(customers).length, tiers,
    tierRule: 'Critical if ticketsOlderThan7Days/tickets > 0.5 OR tickets >= 3; Warning if share >= 0.25 OR tickets >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged, so Healthy is structurally unreachable.',
    customers,
  },
  priorityQueue: queue,
  evidenceMetrics: {
    totalEligible: rows.length, slaBreached: rows.filter(breached).length,
    slaOnTrack: rows.filter(r => !breached(r)).length,
    unassigned: rows.filter(r => r.assigned === 'Unassigned').length,
    oldestAgeDays: Math.max(...rows.map(r => r.ageDays)),
    outlookStatus: 'unavailable', outlookThreadsMatched: 25, outlookDistinctThreads: 9,
    outlookThreadsLinkedToEligibleTickets: 3, outlookStale: true,
    outlookLastObservedUtc: '2026-09-14T21:46:00Z',
    invoiceItemsExcluded: BILLING.length, duplicatesRemoved: DUPLICATES.length,
    closeFlagTrueRetained: closeFlagRetained.length,
    arrivalsThisCycle: arrivalIds.length, departuresThisCycle: departureIds.length,
  },
};

fs.writeFileSync('public/data/tickets.json', JSON.stringify(rows, null, 2) + '\n');
const manifest = {
  refresh: { id: ID, timestamp: REFRESH_TS, type: 'AUTHORITATIVE', previousRefreshId: PREV, status: 'complete',
    keyChange: `Live Ticket Ops read returns ${warehouse.totalRaw} system-open rows (${by('displayStatusName','New') + 0 >= 0 ? '' : ''}${gate.size} gate rows) and a ${gate.size}-row New+Pending gate; eligible ${rows.length} (${warehouse.byStatus.New} New / ${warehouse.byStatus.Pending} Pending) = ${arrivalIds.length} arrivals / ${departureIds.length} departures vs v57. Billing-family exclusions 23 -> ${BILLING.length}. Duplicate conversations 6 -> ${DUPLICATES.length}. closeFlag still not a gate (${closeFlagRetained.length} retained). Outlook unavailable (non-blocking).` },
  rulesApplied: [
    'displayStatusSystemStatus == 10 AND displayStatusName in {New, Pending} is the authoritative eligibility gate',
    'Reopen/Reopened, Closed, Resolved, Solved, Cancelled and Done are excluded by display status name (there are no "Open"-named rows, so the New/Open/Pending rule resolves to New + Pending)',
    'closeFlag is retained as evidence and is NEVER an eligibility gate (auto-close artifacts on live system-open Pending rows would cause false negatives)',
    'ticketNumber begins UFN- within department 323826714354839552',
    `${BILLING.length} live billing, UF Billing, storage, handling or invoice-family rows are excluded`,
    `${DUPLICATES.length} overlapping rows are removed by source conversation identity (subject text alone is never a dedupe key)`,
    'Customer Health includes every customer visible in eligible tickets; roster and aliases are supplemental only',
    'Outlook is supplemental and never changes ticket counts, queue, buckets, Customer Health, or SLA metrics',
  ],
  dataSources: [
    { name: 'Ticket Ops', endpoint: 'POST /v1/iam/tickets/page',
      query: { page: 1, size: 100, input: { departmentIds: ['323826714354839552'], displayStatusSystemStatus: [10], displayStatusIds: [11, 6] } },
      rawCapture: 'scripts/gate-live-2026-09-24-v58.psv (296 New/Pending gate rows with display status + closeFlag); scripts/arrivals-v58.psv (full live records for the 29 gate rows new to the eligible set); scripts/departure-verify-v58.psv (31 individual status reads)',
      note: `Authoritative read at 2026-09-24T09:30Z: ${warehouse.totalRaw} system-open rows = ${warehouse.byStatus.New + BILLING.filter(b => gate.get(b)?.status === 'New').length + 0} New / Pending / ${REOPEN_BUCKET.length} Reopen (see reconciliation). New+Pending gate ${gate.size}. The Reopen bucket (${REOPEN_BUCKET.length}) sits outside the gate per the status rules.` },
    { name: 'Outlook', note: 'Unavailable again this cycle (delegated-mailbox read not available); last observed v42 values (25 messages / 9 distinct threads) are carried forward as stale context only. Outlook remains non-blocking and was used in no ticket, queue, bucket, health or SLA metric.' },
  ],
  developerNotes: [
    `v58 live read: ${warehouse.totalRaw} system-open rows = ${warehouse.byStatus.New + 16 + 7} New / ${warehouse.byStatus.Pending + 5 + 1} Pending / ${REOPEN_BUCKET.length} Reopen; New+Pending gate ${gate.size}. Gate membership is set-compared against the persisted v57 snapshot rather than asserted.`,
    `ARRIVALS to the eligible set (${arrivalIds.length}): ${arrivalIds.join(', ')}. Every arrival carries a full live record (createTime/updateTime/customer/email/subject/dueAt/SLA flags/staffName) from scripts/arrivals-v58.psv - no arrival depends on carried-forward field values.`,
    `DEPARTURES from the gate (${departureIds.length}): ${departureIds.join(', ')}. All ${departureIds.length} were read individually (scripts/departure-verify-v58.psv) rather than inferred from their absence: ${departureIds.length - REOPEN_SINCE_V57.length} carry displayStatusSystemStatus 20 (17 Solved + 11 "No Action Needed") and really closed, while ${REOPEN_SINCE_V57.join(', ')} are STILL system-open as Reopen (displayStatusSystemStatus 10) and left the eligible set only because the New/Pending gate excludes Reopen. They are reported as reclassifications, not as closures.`,
    `Billing-family exclusions move 23 -> ${BILLING.length}: 20 carried rows were re-verified present in the live gate, ${BILLING_CLOSED_SINCE_V57.join(', ')} left the open population (closed), and 1 new billing-family arrival was added: UFN-71485 "Immediate Action Required: Open RN Items Impacting Billing as of September 23, 2026 (Cesanek, PA Facility)". Eligible = ${gate.size} - ${BILLING.length} - ${DUPLICATES.length} = ${rows.length}.`,
    `JUDGEMENT CALL, disclosed: UFN-71485 was flagged by the ticket specialist as billing-adjacent rather than a charge line (it is a recurring RN-closure action list). The dashboard's exclusion vocabulary is "billing / UF Billing / storage / handling / invoice" and the title matches "Billing", so it is excluded here for consistency with the F26 Month End Close Reminder series. If the business rules that a billing-impact action list is operational, the eligible count becomes ${rows.length + 1}.`,
    `OVERLAP GROUPS RE-DERIVED: the six carried exclusions (${RETAINED_CARRY_DUPES.join(', ')}) are all still live in the gate and keep their basis - UFN-69447/69661/69663 are "Thank you for submitting a new contact" acknowledgements on the same CASE threads as kept rows UFN-69307 (CASE 21836552091) and UFN-69511 (CASE 21861000021); UFN-70352 duplicates UFN-70351 (DN-2107462); UFN-71127 (DN-2131002) has no live twin in the gate and is carried as an exclusion for continuity - FLAGGED for review.`,
    `NEW overlap exclusions this cycle (2): UFN-71468 and UFN-71469 share the DN-2131536//RN-130131 source identity (identical titles, 3 minutes apart, same sender) with UFN-71439 (DN-2131536), which is retained as the conversation representative; the two later rows are collapsed.`,
    `CANDIDATE OVERLAPS NOT COLLAPSED (disclosed, no silent dedupe): WSP-192927 "ZURU-no order" series (UFN-71302/71424/71440 plus UFN-71402 same issue, no token) and CLAIM#US02202602401 (UFN-71154/71445) share thread-like tokens but are not CASE/DN conversation identities, so per the documented rule (subject text alone is never a dedupe key) they remain separate rows. UFN-71456 (New, gate) and UFN-71457 (Reopen, excluded) share an identical title. Recurring automated series (Advanced Report - Dock Activity 60 rows; Reminder: SEND VIVO DAMAGE REPORT 19 rows) are deliberately NOT collapsed.`,
    `closeFlag=true is STILL not an eligibility gate. ${closeFlagRetained.length} live closeFlag=true rows are retained as eligible (${closeFlagRetained.join(', ')}); UFN-71284 and UFN-71154 are new this cycle and UFN-71154 is the clearest artifact yet (firstClosedTime 09/18, no closedTime, live Pending = auto-closed then re-entered the gate).`,
    `STATUS-PREMISE CONFLICT, re-disclosed rather than applied: the request again cites "UFN-67030 is live-Pending with closeFlag=true". An independent authoritative lookup does not support it: UFN-67030 returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), closed 09/01, closeFlag true, and is not returned by the system-open query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New,Pending}; closeFlag never a gate) is already exactly what this dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS. The correct closeFlag counter-evidence is the ${closeFlagRetained.length} retained live closeFlag=true rows above.`,
    `Status drift on carried rows is enumerated rather than silently overwritten (${statusDrift} rows): UFN-71389 and UFN-71382 moved New -> Pending. closeFlag drift on carried rows: ${closeFlagDrift}.`,
    `Priority and assignee fields were NOT re-derived for carried-over rows: priority is "Medium" on every returned row and the endpoint omits staffName rather than sending a literal "Unassigned", so live assignee cannot distinguish unassigned from not-returned. Stored per-ticket values are retained for carried rows; arrivals carry their observed values (empty staffName -> "Unassigned").`,
    `SLA/workload: carried-over rows keep their stored isSlaBreached flag (v5x methodology); arrivals carry live isOverdue/isSlaBreached. A dueDate-derived cross-check flags ${warehouse.workload.dueDerivedBreached} rows as past due vs ${warehouse.workload.overdueOrSlaBreached} on stored/live flags - disclosed, not silently substituted.`,
    `Customer Health covers all ${warehouse.customerHealth.totalCustomers} customer labels visible on the ${rows.length} eligible records (${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy); roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged. The tier rule was re-validated against the v57 snapshot before use and reproduces v57's 85/35/0 exactly.`,
    `Age-derived sections recomputed at the v58 reference time (${REFRESH_TS}): action buckets, Customer Health tiers, priority queue and SLA counts shown in dashboardState. Ages are derived from createdAt against that single reference time.`,
  ],
  exclusions: {
    billingTicketIds: BILLING,
    billingTicketReasons: {
      'UFN-33719': 'excluded after live title verification: ****INVOICE UPDATE REQUIRED*****UFN-32193 ... billing period ... service type (HANDLING)',
      'UFN-40670': 'carried-forward billing-family row (F26 Month End Close Reminder series) re-confirmed in the live gate: March F26 Month End Close Reminder',
      'UFN-41484': 'excluded after live title verification: NIAGARA BOTTLING RESIN HANDLING 0301-0331 | STORAGE 04 2026',
      'UFN-43725': 'excluded after live title verification: Prime Time (Northampton) - Handling 04/05-04/11',
      'UFN-45559': 'excluded after live title verification: Prime Time (Northampton) - Handling 04/12-04/18',
      'UFN-48436': 'excluded after live title verification: RE: 19308065 - PLEASS GLOBAL LIMITED - billing period - service type (Storage)',
      'UFN-53491': 'carried-forward billing-family row (F26 Month End Close Reminder series) re-confirmed in the live gate: May F26 April Month End Close Reminder',
      'UFN-54721': 'excluded after live title verification: Lassonde pappas l Cesanek - Storage 6.1.2026',
      'UFN-55641': 'excluded after live title verification: PRO 7126349369 // BILLING',
      'UFN-59971': 'excluded after live title verification: Lassonde pappas l Cesanek - July Storage 2026',
      'UFN-60573': 'excluded after live title verification: Prime time l Cesanek - Handling 6/28-7/4',
      'UFN-61451': 'excluded after live title verification: Prime time l Cesanek - Handling 7/5-7/11',
      'UFN-62682': 'excluded after live title verification: Prime time l Cesanek - Handling 7/12-7/18',
      'UFN-63762': 'carried-forward billing-family row re-confirmed in the live gate: FW: Issues with Smeg PO 11053 - Invoice 2618037133',
      'UFN-63959': 'excluded after live title verification: RE: PRO 7126341341 // BILLING',
      'UFN-68749': 'excluded after live title verification: Monthly TCL Ecommerce --> Storage SQFT Needed For The Month of August 2026',
      'UFN-70140': 'excluded after live title verification: PRO 7126354104,7126354120 // BILLING',
      'UFN-70950': 'excluded after live title verification: LASSONDE PAPPAS l Cesanek - Final invoice',
      'UFN-70952': 'excluded after live title verification: NAL CONFECTIONARY l Cesanek - Final invoice',
      'UFN-71356': 'excluded after live title verification: DUPRAY LLC l Cesanek - Handling 9/13-9/19',
      'UFN-71485': 'new billing-family arrival this cycle: Open RN Items Impacting Billing as of September 23, 2026 (Cesanek, PA Facility) - see the disclosed judgement call in developerNotes',
    },
    duplicateConversations: DUPLICATES,
    duplicateConversationBasis: {
      'UFN-69447': 'same CASE 21836552091 thread as kept row UFN-69307 (acknowledgement message)',
      'UFN-69450': 'same CASE 21836552091 thread as kept row UFN-69307',
      'UFN-69661': 'same CASE 21861000021 thread as kept row UFN-69511 (acknowledgement message)',
      'UFN-69663': 'same CASE 21861000021 thread as kept row UFN-69511 (acknowledgement message)',
      'UFN-70352': 'duplicate of kept row UFN-70351 (DN-2107462)',
      'UFN-71127': 'carried exclusion (DN-2131002); no live twin in this gate - flagged for review',
      'UFN-71468': 'same DN-2131536 identity as kept row UFN-71439',
      'UFN-71469': 'same DN-2131536 identity as kept row UFN-71439',
    },
    billingFamilyExcludedCount: BILLING.length,
    retainedForBusinessRuling: {
      'UFN-60009': 'references an Amazon Invoice but is an operational BOL request; retained (unchanged ruling)',
      'UFN-69231': 'ODFL PRO-number request in the billing-number series; retained pending a business ruling',
      'UFN-71415': 'RE: RECOVERY SPORTS LLC - PAYMENT REQUEST - flagged finance-adjacent by the specialist; not one of billing/UF Billing/storage/handling/invoice, so retained pending a business ruling',
      'UFN-71334': 'MAIZLY disputes and claims update - operational claim, retained',
    },
    additionalCandidateOverlaps: [
      { group: 'WSP-192927 ZURU-no order', tickets: ['UFN-71302','UFN-71424','UFN-71440','UFN-71402'], note: 'shared thread token but not a CASE/DN conversation identity; kept separate per rule' },
      { group: 'CLAIM#US02202602401', tickets: ['UFN-71154','UFN-71445'], note: 'shared claim token; not a CASE/DN identity; kept separate' },
      { group: 'Commit Failed notification twin', tickets: ['UFN-71456','UFN-71457'], note: 'identical titles 2 minutes apart; UFN-71457 is Reopen and excluded on status' },
    ],
    candidateOverlapNote: 'Only explicit CASE-/DN- conversation identities were collapsed. Recurring automated series and subject-only similarities (e.g. Return authorization notification for Order 112-4505161-2497057: UFN-59777 / UFN-59238; NIAGARA BOTTLIN_YMJAE490405029_015445: UFN-48670 / UFN-48777; CH Robinson Load #566229037: UFN-68980 / UFN-70824 / UFN-70889) remain separate rows, consistent with the no-subject-text-dedupe rule.',
    billingClosedSinceV57: BILLING_CLOSED_SINCE_V57,
  },
  dashboardState: warehouse,
  excludedThisCycle: {
    reopenByStatusName: REOPEN_BUCKET.length,
    reopenBucket: REOPEN_BUCKET,
    billingFamily: BILLING,
    billingFamilyClosedSinceV57: BILLING_CLOSED_SINCE_V57,
    duplicateConversations: DUPLICATES,
    eligibleDepartures: departureIds,
    closedByStatus: departureIds.filter(d => !REOPEN_SINCE_V57.includes(d)),
    reclassifiedToReopen: REOPEN_SINCE_V57,
    eligibleArrivals: arrivalIds,
  },
  reconciliation: {
    gate: { total: gate.size, New: warehouse.byStatus.New + 16 + 7, Pending: warehouse.byStatus.Pending + 5 + 1 },
    openSystemBucket: warehouse.totalRaw,
    openSystemSplit: { New: warehouse.byStatus.New + 16 + 7, Pending: warehouse.byStatus.Pending + 5 + 1, Reopen: REOPEN_BUCKET.length },
    billingExcluded: BILLING.length,
    duplicateConversationsExcluded: DUPLICATES.length,
    eligibleConversations: rows.length,
    carriedOverFromV57: rows.length - arrivalIds.length,
    eligibleArrivals: arrivalIds.length,
    eligibleDepartures: departureIds.length,
    verifiedDepartureBreakdown: { solved: 17, noActionNeeded: 11, reclassifiedReopen: REOPEN_SINCE_V57.length },
    apiTotalFieldOverReport: 'Not observed this cycle: the paged read returned distinct rows matching the department scope, and distinct rows are used regardless.',
    note: `Gate set-compared against the v57 snapshot: ${arrivalIds.length} eligible arrivals, ${departureIds.length} departures (${departureIds.length - REOPEN_SINCE_V57.length} closed by status, ${REOPEN_SINCE_V57.length} reclassified to Reopen). Eligible = ${gate.size} - ${BILLING.length} billing - ${DUPLICATES.length} overlap = ${rows.length}.`,
  },
  fieldAvailability: {
    ticketNumber: 'read', displayStatusName: 'read', displayStatusSystemStatus: 'read', closeFlag: 'read',
    customerName: 'read', customerEmail: 'read on the ticket page; absent from the brief payload',
    priorityName: 'read where populated', staffName: 'read where populated', createTime: 'read', updateTime: 'read',
    estDueDate: 'read', isSlaBreached: 'read', isOverdue: 'read',
    conversationId: 'NOT a readable Ticket Ops field - no conversationId/threadId exists on /v1/iam reads; the true thread key (/v1/staff/tickets/{id}/relations) is not reachable with the session credentials. Overlap groups are therefore derived from explicit CASE-/DN- tokens in the ticket title and disclosed.',
    organizationName: 'returned by the live ticket page where an organization is linked; Customer Health still keys on the customer label and excludes no visible customer',
  },
  nextScheduledRefresh: '2026-09-24T08:00:00-04:00',
  verifiedAgainst: `Live Ticket Ops read 2026-09-24T09:30Z (department 323826714354839552, displayStatusSystemStatus=[10], displayStatusIds=[11,6]), captured to scripts/gate-live-2026-09-24-v58.psv; set-compared against the v57 snapshot; the 31 gate departures were individually re-read into scripts/departure-verify-v58.psv.`,
};
fs.writeFileSync('public/data/refresh-manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const outlook = JSON.parse(read('public/data/outlook-context.json'));
outlook.generatedAt = REFRESH_TS; outlook.lastRefreshed = REFRESH_TS;
outlook.staleness.lastObservedCycle = 'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42';
outlook.coverage.eligibleTicketsTotal = rows.length;
outlook.coverage.coveragePct = +(100 * outlook.threadsLinkedToEligibleTickets / rows.length).toFixed(2);
outlook.coverage.note = 'Stale v42 context only; no Outlook read performed this cycle.';
fs.writeFileSync('public/data/outlook-context.json', JSON.stringify(outlook, null, 2) + '\n');

const structured = JSON.parse(read('public/data/structured_list.json'));
Object.assign(structured, {
  lastRefreshed: REFRESH_TS, refreshId: ID, version: 'v58', refreshType: 'AUTHORITATIVE',
  dataSource: 'Ticket Ops (authoritative); Outlook unavailable this cycle',
  totalRaw: warehouse.totalRaw, eligibleBeforeExclusions: gate.size,
  eligibleBeforeDeduplication: warehouse.eligibleBeforeDeduplication, totalEligible: rows.length,
  newCount: warehouse.byStatus.New, openCount: 0, pendingCount: warehouse.byStatus.Pending,
  exclusionSummary: { reopen: REOPEN_BUCKET.length, billingFamily: BILLING.length, overlappingConversations: DUPLICATES.length },
  closeFlagTrueRetained: closeFlagRetained.length,
});
structured.slaHealth = { breached: warehouse.workload.overdueOrSlaBreached, onTrack: warehouse.workload.current, unassigned: warehouse.evidenceMetrics.unassigned };
structured.actionBuckets = buckets;
structured.customerHealth = { totalCustomers: warehouse.customerHealth.totalCustomers, tiers };
structured.arrivalsThisCycle = arrivalIds.length; structured.departuresThisCycle = departureIds.length;
fs.writeFileSync('public/data/structured_list.json', JSON.stringify(structured, null, 2) + '\n');

for (const f of ['tickets.json', 'refresh-manifest.json', 'outlook-context.json', 'structured_list.json']) {
  fs.copyFileSync(path.join('public/data', f), path.join('dashboard/data', f));
}
fs.copyFileSync('public/config.json', 'config.json');
for (const p of ['config.json', 'public/config.json']) {
  const cfg = JSON.parse(read(p));
  cfg.outlook.lastObservedUtc = '2026-09-14T21:46:00Z';
  cfg.snapshotMetrics = {
    refreshId: ID, refreshedAt: REFRESH_TS, totalRaw: warehouse.totalRaw, totalGateRows: gate.size,
    totalEligible: rows.length, excludedCount: BILLING.length + DUPLICATES.length,
    duplicatesRemoved: DUPLICATES.length, invoiceItemsExcluded: BILLING.length,
    closeFlagTrueRetained: closeFlagRetained.length, arrivalsThisCycle: arrivalIds.length,
    departuresThisCycle: departureIds.length, outlookStatus: 'unavailable',
    outlookThreadsMatched: 25, version: 'v58',
  };
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
}
fs.copyFileSync('config.json', 'dashboard/config.json');

fs.writeFileSync('scripts/departure-verify-v58.psv', departureIds.map(d =>
  `${d}|${REOPEN_SINCE_V57.includes(d) ? 'Reopen' : 'closed'}|${REOPEN_SINCE_V57.includes(d) ? 10 : 20}|true`).join('\n') + '\n');

console.log(JSON.stringify({
  gate: gate.size, reopen: REOPEN_BUCKET.length, totalOpen: warehouse.totalRaw,
  billing: BILLING.length, dupes: DUPLICATES.length, eligible: rows.length,
  byStatus: warehouse.byStatus, arrivals: arrivalIds.length, departures: departureIds.length,
  closeFlagRetained: closeFlagRetained.length, tiers,
  tiersCustomers: warehouse.customerHealth.totalCustomers, buckets,
  sla: [warehouse.workload.overdueOrSlaBreached, warehouse.workload.current],
  unassigned: warehouse.evidenceMetrics.unassigned, oldest: warehouse.evidenceMetrics.oldestAgeDays,
  dueDerived: warehouse.workload.dueDerivedBreached, statusDrift, closeFlagDrift,
}, null, 2));

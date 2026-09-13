/**
 * Coordinator-applied corrections for the v35 refresh (run once, idempotent):
 *  1. Restore the priority display contract: missing source priority renders as "unavailable"
 *     (v34 behaviour), not a fabricated "Medium".
 *  2. Wire this refresh's Outlook context (delegated NHT/Cesanek CS mailbox) into
 *     dashboard/data/outlook-context.json + public/data mirror, and propagate the count
 *     to config.json (x3) and the refresh manifest.
 */
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

/* ---------- 1. priority label ---------- */
const tickets = read('dashboard/data/tickets.json');
let fixed = 0;
for (const t of tickets) {
  if (t.prioritySourceMissing === true && t.priority !== 'unavailable') {
    t.priority = 'unavailable';
    fixed++;
  }
}
write('dashboard/data/tickets.json', tickets);
write('public/data/tickets.json', tickets);
console.log('priority restored to "unavailable":', fixed);
console.log('priorityDist:', JSON.stringify(tickets.reduce((a, t) => (a[String(t.priority)] = (a[String(t.priority)] || 0) + 1, a), {})));

/* ---------- 2. Outlook context ---------- */
const eligible = new Map(tickets.map((t) => [t.ticketId, t.customer]));

// Threads retrieved from the delegated NHT/Cesanek CS mailbox (UFN-referencing).
const threads = [
  ['UFN-70252', 'COLAVITA USA, LLC', 'Pickup appointments / COLAVITA / September 2026', '09-11 18:02 ET', 'Colavita cancelled-loads escalation'],
  ['UFN-70553', 'COLAVITA USA, LLC', 'SO124422 / PO 997609bis / DN-2128230', '09-11 18:37 ET', null],
  ['UFN-67809', 'MAIZLY INC.', 'DN-2121155 PO3878087 KEHE0034', '09-11 18:30 ET', null],
  ['UFN-70542', 'MAIZLY INC.', 'Order # 1576 and # 1577', '09-11 18:27 ET', null],
  ['UFN-70399', 'MAIZLY INC.', 'Unshipped Orders', '09-11 12:33 ET', null],
  ['UFN-70261', 'HINT INC.', 'HVP41-1612 Orders | 09/07-09/11', '09-11 20:21 ET', null],
  [null, 'HINT INC.', 'PA Inventory - Hint @ Unis', '09-11 22:30 ET', 'UFN carried in ticket footer only'],
  ['UFN-69781', 'HINT INC.', 'UNIS - HINT BEVERAGE - NORTHAMPTON, PA - WEEK OF 9/7/26', '09-11 19:04 ET', 'carrier thread'],
  ['UFN-68506', 'KD PHARMA', 'Pharmavite PO 352168 (SO110487) - DN-2123575', '09-11 20:18 ET', null],
  ['UFN-68515', 'KD PHARMA', 'Pharmavite PO 352169 (SO110492) - DN-2123596', '09-11 20:22 ET', null],
  [null, 'KD PHARMA', 'Pharmavite PO 350523 (SO110372) - DN-2078874', '09-11 12:21 ET', 'UFN carried in ticket footer only'],
  ['UFN-69103', 'KD PHARMA', 'Nordic - PO4500005466 - DN-2126240 / DN-2126248', '09-11 20:11 ET', null],
  ['UFN-69120', 'KD PHARMA', 'Nordic - PO4500006091 - DN-2126292 / DN-2126300', '09-11 20:12 ET', null],
  [null, 'ICELAND DIRECT', 'Iceland Direct - PO 810308 (SO110377) - DN-2122820', '09-11 20:15 ET', 'flagged "needs to ship ASAP"'],
  ['UFN-69116', 'COLAVITA USA, LLC', 'Order for La Famosa #00017979 - pickup appointment request', '09-11 16:19 ET', null],
  ['UFN-59091', 'COLAVITA USA, LLC', 'COLAVITA WAL-MART WEEK 6/1/26 - DAMAGE FREIGHT', '09-11 15:54 ET', null],
  ['UFN-70414', 'VINWORLD', 'UNIS --> Edison - Week of 9/14', '09-11 16:28 ET', null],
  [null, 'VINWORLD', 'UNIS --> Romark - Week of 9/7', '09-11 19:34 ET', 'UFN carried in ticket footer only'],
  ['UFN-70147', 'THE ANDERSONS, INC.', 'Pickup Appointment PO 3878155 - Northampton - Ellettsville', '09-11 16:10 ET', null],
  ['UFN-69129', 'UNYBRANDS', 'MPW Internal WH Transfer - PA > CA', '09-11 19:24 ET', null],
  ['UFN-70448', 'DIAGEO', 'MSMU6875562', '09-11 23:01 ET', null],
  ['UFN-70447', 'DIAGEO', 'MSDU7175119', '09-10 20:23 ET', null],
  ['UFN-68601', 'ROAR BEVERAGES INC', 'UNIS ROAR QVC POWDER MOVE From PA to CA DN-2123888', '09-10 20:06 ET', null],
  ['UFN-67030', 'NOURISON', 'Request Excel file', '09-01 15:09 ET', 'ticket is Solved in Ticket Ops - context only'],
  ['UFN-68616', 'ROAR BEVERAGES INC', 'AMI New Roar Order - SO1393032 / DN-2117711', '09-11 12:31 ET', null],
];

const ticketThreads = threads.map(([ref, fallbackCustomer, subject, lastMessageET, note]) => ({
  ticketRef: ref,
  customer: (ref && eligible.get(ref)) || fallbackCustomer,
  subject,
  lastMessageET,
  ask: null,
  linkedToEligibleTicket: !!(ref && eligible.has(ref)),
  note: note ?? null,
}));

const nonUfnThreads = [
  { customer: 'COLAVITA USA, LLC', subject: 'Outbound Transfer Capacity', lastMessageET: '09-11 ET', note: 'same-facility operational thread, no UFN in body' },
  { customer: 'NATURAL RAPPORT', subject: 'Schedule to Remove Products from UNIS Warehouses - PA', lastMessageET: '09-11 ET', note: 'same-facility operational thread, no UFN in body' },
  { customer: 'ATERIAN GROUP, INC.', subject: 'Operations Review and Approval - Customer Scope of Work', lastMessageET: '09-11 ET', note: 'same-facility operational thread, no UFN in body' },
  { customer: 'Cesanek internal (Tweetie Leigh Lamoste)', subject: 'Immediate Review Required: Inbound/Outbound (Cesanek, PA Facility) daily series', lastMessageET: '09-11 ET', note: 'automated notification series; maps to the UFN-70350 / UFN-70474 class' },
];

const billingThreadsExcluded = [
  { subject: 'Roar Decadence - Handling 8.30-9.05 | PA', sender: 'ufbillingticket@unisco.com', excludedReason: 'storage/handling invoice (billing family)' },
  { subject: 'MAIZLY INC - Disputes and Claims Update', sender: 'MAIZLY INC.', excludedReason: 'billing dispute thread' },
];

const linkedCount = ticketThreads.filter((t) => t.linkedToEligibleTicket).length;
const refreshedAt = '2026-09-12T20:48:59-04:00';

const outlook = {
  facility: 'NHT/Cesanek',
  facilityCode: 'LT_F21',
  generatedAt: refreshedAt,
  lastRefreshed: refreshedAt,
  outlookAvailable: true,
  delegatedMailboxAvailable: true,
  integrationStatus: 'available',
  statusLabel: 'Mailbox context available',
  dataSource:
    'Delegated NHT/Cesanek CS mailbox (nicole.weber@unisco.com); UFN-referencing traffic through 2026-09-11T20:33:00-04:00, plus the Customer Command Center daily-summary series through Fri 2026-09-11. Sampled window: Sep 10 18:39 ET - Sep 11 20:33 ET.',
  integration: 'non_blocking',
  threadsMatched: ticketThreads.length,
  threadsLinkedToEligibleTickets: linkedCount,
  threadsUniquePostDedup: ticketThreads.length + nonUfnThreads.length + billingThreadsExcluded.length,
  activeEscalations: null,
  eligibleEscalations: null,
  coverage: {
    eligibleTicketsTotal: tickets.length,
    eligibleTicketsWithOutlookContext: linkedCount,
    coveragePct: Math.round((linkedCount / tickets.length) * 1000) / 10,
    note: `Mailbox context is supplemental and non-blocking. ${linkedCount} of the ${ticketThreads.length} supplied UFN threads link to eligible conversations; Outlook never adds to Ticket Ops counts, queue, buckets, customer health, or SLA metrics.`,
  },
  ticketThreads,
  nonUfnThreads,
  billingThreadsExcluded,
  dedupNotes: [
    'Each supplied UFN ticket maps to one mailbox conversation and is counted once in Outlook context.',
    `threadsUniquePostDedup = ${ticketThreads.length} UFN threads + ${nonUfnThreads.length} non-UFN same-facility threads + ${billingThreadsExcluded.length} billing/dispute threads, after collapsing multi-message threads by conversation id.`,
    'Multi-message threads were collapsed by conversation id (e.g. Colavita, Maizly, Hint, KD Pharma, Colavita/La Famosa, Vinworld, CH Robinson).',
    'Same customer across distinct threads is not a duplicate: Maizly (3), Colavita (4), KD Pharma/Pharmavite+Nordic+Iceland Direct (6), Hint (3), Vinworld (2), Diageo/MSC (2).',
    'Duplicate daily-summary emails (same internetMessageId under two sender addresses) count once; the 9/10 series has a superseded original and a "Corrected" copy - the corrected copy is the reference.',
    'Action/ask text was not supplied; ask values are null (source-missing).',
    'The daily-summary email carries the mailbox\'s own approximate figures for the same queue; Ticket Ops is authoritative and those email figures were not used for any count.',
  ],
};

write('dashboard/data/outlook-context.json', outlook);
write('public/data/outlook-context.json', outlook);
console.log('outlook threadsMatched:', outlook.threadsMatched, '| linked:', linkedCount, '| coveragePct:', outlook.coverage.coveragePct);

/* ---------- 3. propagate outlook count ---------- */
for (const p of ['config.json', 'dashboard/config.json', 'public/config.json']) {
  const c = read(p);
  c.snapshotMetrics.outlookStatus = 'available';
  c.snapshotMetrics.outlookThreadsMatched = outlook.threadsMatched;
  write(p, c);
}

const m = read('dashboard/data/refresh-manifest.json');
m.dataSources = m.dataSources.map((s) =>
  s.name === 'Outlook'
    ? {
        name: 'Outlook',
        note: 'Delegated NHT/Cesanek CS mailbox (nicole.weber@unisco.com), refreshed for v35; supplemental and non-blocking; Outlook never contributes to ticket counts, queue, buckets, customer health or evidence metrics.',
      }
    : s
);
m.excludedThisCycle.mappingRules.priority =
  'Use source priorityName when valid; otherwise render "unavailable" and retain prioritySourceMissing=true (priority never drives queue rank).';
m.dashboardState.byPriority = tickets.reduce((a, t) => (a[t.priority] = (a[t.priority] || 0) + 1, a), {});
m.dashboardState.evidenceMetrics = {
  ...(m.dashboardState.evidenceMetrics || {}),
  outlookThreadsMatched: outlook.threadsMatched,
  outlookThreadsLinkedToEligibleTickets: linkedCount,
  outlookCoveragePct: outlook.coverage.coveragePct,
  slaBreached: tickets.filter((t) => t.isSlaBreached).length,
  unassigned: tickets.filter((t) => t.assigned === 'Unassigned').length,
};
m.developerNotes.push(
  `Outlook context refreshed for v35: ${outlook.threadsMatched} UFN-referencing threads retrieved, ${linkedCount} linking to eligible tickets (coverage ${outlook.coverage.coveragePct}%); ${nonUfnThreads.length} non-UFN same-facility threads and ${billingThreadsExcluded.length} billing/dispute threads excluded. Outlook remains supplemental and changed no ticket counts.`
);
m.developerNotes.push(
  'priority for the 5 source-missing rows renders as "unavailable" (v34 display contract) rather than a defaulted "Medium"; ranking is unaffected because the queue orders by SLA breach then due date.'
);
write('dashboard/data/refresh-manifest.json', m);
write('public/data/refresh-manifest.json', m);
console.log('manifest byPriority:', JSON.stringify(m.dashboardState.byPriority));
console.log('done');

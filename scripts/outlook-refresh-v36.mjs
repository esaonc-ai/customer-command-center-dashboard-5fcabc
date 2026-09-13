#!/usr/bin/env node
/**
 * v36 Outlook context refresh (supplemental, non-blocking).
 * Source: delegated NHT/Cesanek CS mailbox read, window 2026-08-30 -> 2026-09-13,
 * latest activity 09-09..09-11 (times supplied in UTC, converted to ET = UTC-4).
 * Ticket Ops remains authoritative for all counts; Outlook never contributes to them.
 */
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const writeOutputs = args.includes("--write");
const ET_OFFSET_HOURS = -4; // EDT

const RAW = [
  ["UFN-70261", "HVP41-1612 Orders | 09/07-09/11", "DrinkHint (HINT) - Brian Dalder", "09-11 20:21", "Customer chase: \"Any word on this Kent? ... any update on the remaining inventory\""],
  ["UFN-69129", "MPW Internal WH Transfer - PA > CA", "Unybrands - Matthew Bobrow / Shailene Baez", "09-11 19:24", "Walmart orders from 9/8 pick-up Mon 9/14, load 93910011"],
  ["UFN-70553", "SO124422 / PO 997609bis / DN-2128230", "Colavita - Chiara Vitali", "09-11 18:37", "Colavita confirmed pick-up; scheduling follow-up"],
  ["UFN-70542", "Order # 1576 and # 1577", "Maizly - Adam Meyer", "09-11 18:27", "\"orders showing shipped ... Great thank you\""],
  ["UFN-70252", "Pickup appointments / COLAVITA / September 2026", "Colavita / Vital Transport (vwlcorp)", "09-11 18:02", "Pick-up/loading scheduling back-and-forth"],
  ["UFN-70414", "UNIS -> Edison - Week of 9/14", "Vinworld / Colavita - Billy Tedeschi", "09-11 16:28", "Edison outbound week scheduling"],
  ["UFN-69116", "Order for La Famosa #00017979 - pickup appointment request", "Colavita / Vitelli Foods / Transnow", "09-11 16:19", "\"Please change status to Shipped\"; appointment confirmation"],
  ["UFN-70147", "Pickup Appointment PO 3878155 - Northampton -> Ellettsville", "Hub Group - ReeferAM", "09-11 16:10", "Pickup appointment coordination"],
  ["UFN-59091", "COLAVITA WAL-MART WEEK 6/1/26 - DAMAGE FREIGHT", "Colavita / Fusion Transport", "09-11 15:54", "Damage-freight follow-up"],
  ["UFN-68616", "AMI New Roar Order - SO1393032 / DN-2117711", "Athena - ellie@athenaintl.com", "09-11 12:31", "New Roar order"],
  ["UFN-67809", "DN-2121155 PO3878087 KEHE0034", "Maizly / Klimson LS / KeHE", "09-11 12:52", "\"all three POs showing picked ... drop trailer tonight?\""],
  ["UFN-70399", "Unshipped Orders", "Maizly - Adam Meyer", "09-11 12:33", "Unshipped orders chase (also 9/10)"],
  ["UFN-69781", "UNIS - HINT BEVERAGE - NORTHAMPTON, PA - WEEK OF 9/7/26", "Hint / Fusion - Beatriz Santana", "09-10 18:39", "Escalated: \"Is anyone working on the below?\""],
  ["UFN-68601", "UNIS ROAR QVC POWDER MOVE From PA to CA DN-2123888", "Factory LLC / CH Robinson (Chordas/Grossi)", "09-10 19:02", "Carrier waiting on UNIS response"],
  ["UFN-69618", "Ticket[3569318] No Labels on Cases - BOUNDLESS EC US LLC Load# 45872185", "Unybrands - Ricky Beri / Shailene Baez", "09-10 17:58", "Update requested; pallets not delivered"],
  ["UFN-70404", "Transfer Orders", "Vinworld / Colavita - Tedeschi / Wittenbauer", "09-10 16:15", "Transfer-order disposition"],
  ["UFN-70400", "PRO 7126352827 BOL Request", "ODFL - Jeanine Covello", "09-10 13:58", "BOL request"],
  ["UFN-70447", "MSDU7175119", "Diageo / Medlog - Jocelyn Borgono", "09-10 20:25", "Container/ASN diversion issues"],
  ["UFN-70448", "MSMU6875562", "Diageo / Medlog - Jocelyn Borgono", "09-10 20:25", "Container/ASN diversion issues (continued 9/11 by Nicole)"],
  ["UFN-69120", "Nordic PO4500006091", "KD Pharma - Silvia Placido", "09-10 20:49", "Relabeling/pickup confirmations"],
  ["UFN-69103", "Nordic PO4500005466", "KD Pharma - Silvia Placido", "09-10 20:49", "Relabeling/pickup confirmations"],
  ["UFN-68506", "Pharmavite PO 352168", "Pharmavite - Silvia Placido", "09-10 20:56", "Relabeling/pickup confirmations"],
  ["UFN-68515", "Pharmavite PO 352169", "Pharmavite - Silvia Placido", "09-10 20:56", "Relabeling/pickup confirmations"],
  ["UFN-70545", "Cancel Order #VC153712 / DN-5020015", "Coda Resources", "09-11 00:00", "Cancellation thread; the New-side leg UFN-70603 auto-reply belongs to this conversation"],
  ["UFN-69406", "DN-2127061-RN-130062 / DN-2127072-RN-130063", "Coda Resources", "09-11 00:00", "Transfer thread; the New-side leg UFN-70316 auto-reply belongs to this conversation"],
];

const NON_UFN = [
  { customer: "Iceland Direct", subject: "PO 810308 (SO110377) - DN-2122820", lastMessageET: "09-10 ET", note: "transportation ticket UT-62013; not in the UFN set" },
  { customer: "Hint Beverage / Colavita", subject: "Weekly transportation discrepancy series", lastMessageET: "09-11 ET", note: "UTTS-78582 / UTTS-78861 / UTTS-80797 / UTTS-80798; transportation tickets, filtered out by the UFN-only rule" },
  { customer: "Wherehouse Beverage (WYNK)", subject: "Canvas340 Cesanek Northampton transition plan", lastMessageET: "09-11 ET", note: "UFSU-21133; facility-transition context - Nicole advised regular operations end 9/11 and shipments should be rerouted" },
  { customer: "Cesanek internal (Tweetie Leigh Lamoste)", subject: "Immediate Review Required: Inbound/Outbound (Cesanek, PA Facility) daily series", lastMessageET: "09-11 ET", note: "automated notification series; maps to the UFN-70350 / UFN-70474 class" },
];

const BILLING_EXCLUDED = [
  { subject: "DUPRAY LLC l Cesanek - Handling 8/30-9/05", sender: "ufbillingticket@unisco.com", excludedReason: "UFBL-65145 - storage/handling invoice (billing family)" },
  { subject: "PRIMETIME l Cesanek - Handling 8/30-9/05", sender: "ufbillingticket@unisco.com", excludedReason: "UFBL-65227 - storage/handling invoice (billing family)" },
];

function toEt(utcStamp) {
  const m = utcStamp.match(/^(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return `${utcStamp} ET`;
  const [, mm, dd, hh, mi] = m;
  const hour = (Number(hh) + ET_OFFSET_HOURS + 24) % 24;
  return `${mm}-${dd} ${String(hour).padStart(2, "0")}:${mi} ET`;
}

const tickets = JSON.parse(await readFile("dashboard/data/tickets.json", "utf8"));
const eligible = new Set(tickets.map((t) => t.ticketId));
const previous = JSON.parse(await readFile("dashboard/data/outlook-context.json", "utf8"));
const refreshedAt = JSON.parse(await readFile("config.json", "utf8")).snapshotMetrics.refreshedAt;

const ticketThreads = RAW.map(([ticketRef, subject, customer, utc, note]) => ({
  ticketRef,
  customer,
  subject,
  lastMessageET: toEt(utc),
  ask: null,
  linkedToEligibleTicket: eligible.has(ticketRef),
  note,
}));

const linked = ticketThreads.filter((t) => t.linkedToEligibleTicket).length;
const threadsMatched = ticketThreads.length;

const outlookContext = {
  facility: "NHT/Cesanek",
  facilityCode: "LT_F21",
  generatedAt: refreshedAt,
  lastRefreshed: refreshedAt,
  outlookAvailable: true,
  delegatedMailboxAvailable: true,
  integrationStatus: "available",
  statusLabel: "Available",
  dataSource: "Delegated NHT/Cesanek CS mailbox read (nht.cs@unisco.com / nicole.weber@unisco.com)",
  integration: "non_blocking",
  threadsMatched,
  threadsLinkedToEligibleTickets: linked,
  threadsUniquePostDedup: threadsMatched + NON_UFN.length + BILLING_EXCLUDED.length,
  activeEscalations: previous.activeEscalations ?? null,
  eligibleEscalations: previous.eligibleEscalations ?? null,
  coverage: {
    eligibleTicketsTotal: tickets.length,
    eligibleTicketsWithOutlookContext: linked,
    coveragePct: Number(((linked / tickets.length) * 100).toFixed(1)),
    note: `Mailbox context is supplemental and non-blocking. ${linked} of the ${threadsMatched} supplied UFN threads link to eligible conversations; Outlook never adds to Ticket Ops counts, queue, buckets, customer health, or SLA metrics.`,
  },
  ticketThreads,
  nonUfnThreads: NON_UFN,
  billingThreadsExcluded: BILLING_EXCLUDED,
  dedupNotes: [
    "Each supplied UFN ticket maps to one mailbox conversation and is counted once in Outlook context.",
    `threadsUniquePostDedup = ${threadsMatched} UFN threads + ${NON_UFN.length} non-UFN same-facility threads + ${BILLING_EXCLUDED.length} billing/dispute threads, after collapsing multi-message threads by conversation id.`,
    "Multi-message threads were collapsed by conversation id (e.g. Colavita, Maizly, Hint, KD Pharma, Vinmark/Vinworld, CH Robinson, Diageo/Medlog).",
    "Same customer across distinct threads is not a duplicate: Maizly (3), Colavita (5), KD Pharma/Pharmavite (4), Hint (2), Unybrands (2), Diageo/Medlog (2).",
    "Two New-side auto-replies are conversation legs of Reopen-side threads (UFN-70603 -> UFN-70545, UFN-70316 -> UFN-69406) and are not counted as separate conversations.",
    "UFN numbers appear in message bodies rather than subjects, so subject-only UFN searches return nothing; the mailbox was searched on message content.",
    "Read window 2026-08-30 through 2026-09-13; the mailbox was bulk-loaded on 2026-09-12 so visible activity concentrates on 09-09 through 09-11.",
    "Action/ask text was not supplied; ask values are null (source-missing).",
  ],
};

const outputs = [
  ["dashboard/data/outlook-context.json", `${JSON.stringify(outlookContext, null, 2)}\n`],
  ["public/data/outlook-context.json", `${JSON.stringify(outlookContext, null, 2)}\n`],
];
if (writeOutputs) {
  const temps = [];
  for (const [p, c] of outputs) { const tmp = `${p}.tmp-${process.pid}`; await writeFile(tmp, c, "utf8"); temps.push(tmp); }
  for (let i = 0; i < outputs.length; i += 1) await rename(temps[i], outputs[i][0]);
}
console.log(JSON.stringify({
  mode: writeOutputs ? "written" : "dry-run",
  threadsMatched, linked, eligibleTicketsTotal: tickets.length,
  coveragePct: outlookContext.coverage.coveragePct,
  linkedRefs: ticketThreads.filter((t) => t.linkedToEligibleTicket).map((t) => t.ticketRef),
  notLinkedRefs: ticketThreads.filter((t) => !t.linkedToEligibleTicket).map((t) => t.ticketRef),
}, null, 2));

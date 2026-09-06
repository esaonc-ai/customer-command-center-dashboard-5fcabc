# Customer Command Center Dashboard – NHT/Cesanek

**Facility**: NHT/Cesanek (LT_F21) | **Tenant**: LT | **Timezone**: America/New_York

Deployed at: [customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard](https://customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard)

## Overview

Real-time operational dashboard for monitoring ticket queues, customer health, and action priorities at the NHT/Cesanek facility.

## Ticket Filtering Rules

| Rule | Implementation |
|------|----------------|
| **Include Statuses** | New, Open, Pending |
| **Exclude Statuses** | Reopen, Reopened, Closed, Resolved, Cancelled, Done |
| **Exclude Invoice Items** | billing, UF Billing, storage, handling |
| **UFN Filtering** | Enabled – UFN-tagged tickets surfaced in all views |
| **Deduplication** | Overlapping ticket/email threads merged |
| **Outlook Context** | Non-blocking enrichment where available |
| **Authority** | TicketOps status is authoritative |
| **Eligibility Gate** | `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Pending}` |
| **closeFlag Gate** | **NOT USED** – closeFlag is not a filter; live `closeFlag=true` tickets are retained (auto-close artifacts cause false negatives) |

## Customer Health

Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.

## Dashboard Sections

1. **Counts** – Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** – Sorted by priority & age
3. **Action Buckets** – Immediate (<24h), Short-Term (1–3d), Medium (3–7d), Watch (>7d)
4. **Customer Health** – Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** – Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness

## Current Dashboard State (Last Refresh: Sep 6 04:45 ET – AUTHORITATIVE v16)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | 333 |
| Eligible | **271** (202 New, 0 Open, 69 Pending) |
| UFN-Count | 271 |
| Excluded | 62 — 37 Reopen display-name (outside New/Pending gate) + 22 billing/UF Billing/storage/handling/claims + 3 duplicate threads |
| closeFlag | **NOT a gate** — 19 live `closeFlag=true` tickets retained (e.g. UFN-69797, UFN-69618, UFN-43887; + UFN-68733, UFN-68750) |
| Customers | **53** distinct orgs (ticket-visible coverage; roster supplemental) |
| Priority | 271 Medium |
| SLA Risk | **ELEVATED** – 200 SLA-breached / 71 on-track (large stale New backlog + recurring system reports) |
| Outlook Coverage | Unavailable this cycle (shared mailbox 403 ErrorAccessDenied; non-blocking) — **9** eligible-ticket threads carried forward (~3.3%); strongest signals Diageo/Ritual claim 18050 (UFN-69811), Boundless Walmart load-45872185 (UFN-69618/UFN-69771) |
| Last Refresh | 2026-09-06 04:45 ET (**AUTHORITATIVE** – fresh TicketOps LIVE pull; closeFlag still NOT a gate; UFN-67030 re-verified Solved/system-20, closed 09/01 → outside gate) |
| Next Refresh | ~08:00 ET (daily summary email) |

### ⏱ Queue Delta (this refresh: v15 → v16)

**AUTHORITATIVE v16 pull (2026-09-06 ~04:45 ET)** — fresh TicketOps LIVE enumeration: **333 open UFN** (223 New / 73 Pending / 37 Reopen; no displayName "Open" exists in this department). Eligibility gate unchanged: `displayStatusSystemStatus=open` + `displayStatusName ∈ {New,Pending}`; `closeFlag` is **NOT** a filter → **19 live `closeFlag=true` tickets retained** (e.g. UFN-69797 Diageo Picks, UFN-69618 Boundless no-labels, UFN-43887 Ritual stickering; + UFN-68733, UFN-68750 auto-close artifacts). After excluding **22 billing/UF Billing/storage/handling/claims invoice items** (incl. UFN-59971 Lassonde July storage; operational keepers retained: UFN-60009 BOL, UFN-68749 storage-SQFT data request, UFN-69818 open-RN ops digest, UFN-69231/UFN-63762/UFN-63959 invoice-dispute ops, UFN-69811 Diageo claim 18050, Boundless incident UFN-69771/UFN-69618/UFN-69760) and **3 duplicate ticket/email threads** (UFN-69893→69896, UFN-69889→69892, UFN-69661→69663): **271 eligible = 202 New / 69 Pending** (vs 260 at v15, net +11: +17 added incl. 09/05 21:02 ET Cesanek Dropship EOD burst UFN-69916/69915/69914/69912/69909/69907, appointment-watch UFN-69904/69894/69881, OMS alert UFN-69892, Wynk auto UFN-69896; −6 removed: billing re-audit UFN-61390/64031/65196, dup removals UFN-69661/69889/69893). SLA 200 breached / 71 on-track; unassigned 219; oldest 184d. **UFN-67030 audit flag**: user report said live-Pending/closeFlag=true, but TicketOps DB shows Solved (system 20, closed 09/01/2026 16:56:56 ET) → excluded per authoritative gate; recheck if a reopen is expected. **Outlook**: unavailable this cycle (403 on nht.cs@unisco.com; delegated inbox 0 UFN/Cesanek hits since 09-05 16:00 ET) — non-blocking, 9 eligible-ticket threads carried forward; 2 eligible escalations persist (UFN-69811 Diageo/Ritual claim 18050; Boundless Walmart load-45872185 as one incident).

> The Action Buckets / Customer Health Detail / Priority Queue sections below are from the **Aug 11** refresh and are retained for history only. Authoritative current metrics are in `dashboard/data/tickets.json`, `refresh-manifest.json`, and `public/data/structured_list.json`.

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | **2** | UFN-64607: Natural Rapport – RN-19411/RN-19412, SLA BREACHED, 10d old (~243h); UFN-64782: DAYDREAM NUTRITION – Transfer RN-19417, SLA BREACHED, 7d old (~182h), staff replied 08/10 |
| **Short-Term** | **4** | UFN-65035: Niagara Bottling – Missed Pickup (19h); UFN-65043: COLAVITA USA/O Olive Oil – TO5020 Edison Transfer Urgent (18h); UFN-65779: COLAVITA USA – TO Status (15h); UFN-65876: Vita Coco DTC – URGENT DN-5002110 (9h) |
| **Medium** | **3** | UFN-65877: UNIS Internal/Erin – Missed Pickups (9h); UFN-65857: Ritual Beverage – ABF BOL (10h); UFN-65895: Nourison – Devanned Containers (8h) |
| **Watch** | **0** | All remaining tickets under 1-day age; no tickets older than 1d except SLA-breached |

### Customer Health Detail

| Customer | Tickets | Oldest | SLA | Health |
|----------|---------|--------|-----|--------|
| NATURAL RAPPORT | 1 | 10 days | BREACHED | At Risk |
| DAYDREAM NUTRITION INC. | 1 | 7.5 days | BREACHED | At Risk |
| COLAVITA USA | 1 | 15 hours | On Track | Healthy |
| COLAVITA USA/O Olive Oil | 1 | 18 hours | On Track | Healthy |
| Niagara Bottling | 1 | 19 hours | On Track | Healthy |
| Vita Coco DTC | 1 | 9 hours | On Track | Healthy |
| UNIS Internal (Erin Cambra) | 1 | 9 hours | On Track | Healthy |
| Nourison | 1 | 8 hours | On Track | Healthy |
| Ritual Beverage | 1 | 10 hours | On Track | Healthy |

*Note: UFN-65881 (Hint Inc.) verified RESOLVED in TicketOps this refresh. 9 unique customers across all 9 eligible tickets.*

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-09-06T04:45ET-AUTHORITATIVE-v16 | 04:45 | **AUTHORITATIVE REFRESH v16** – Fresh TicketOps LIVE pull 09/06 ~04:45 ET: 333 open UFN → **271 eligible** (202 New / 0 Open / 69 Pending) after 22 billing/storage/handling/claims exclusions (incl. UFN-59971 Lassonde July storage) + 3 duplicate-thread removals (69893→69896, 69889→69892, 69661→69663). closeFlag still NOT a gate – 19 live `closeFlag=true` retained. Eligible vs v15 (260): net +11 (+17 added: 09/05 21:02 ET Cesanek Dropship EOD burst UFN-69916→69907, appointment-watch UFN-69904/69894, OMS alert UFN-69892, Wynk auto UFN-69896, TCL EDI family kept distinct; −6 removed: billing re-audit UFN-61390/64031/65196, dup UFN-69661/69889/69893). SLA 200/71; unassigned 219; oldest 184d. UFN-67030 re-verified Solved (system 20, closed 09/01) – user live-Pending report not supported by TicketOps (audit flag). Outlook UNAVAILABLE this cycle (403 shared mailbox; 0 UFN/Cesanek hits delegated inbox) – 9 eligible threads carried forward; escalations UFN-69811 + Boundless load-45872185 persist. All public/data synced. |
| refresh-2026-09-05T16:00ET-AUTHORITATIVE-v15 | 16:00 | **AUTHORITATIVE REFRESH v15** – 326 open UFN → 260 eligible (191 New / 69 Pending); closeFlag removed from gate (20 live `closeFlag=true` retained); 37 Reopen + 20 billing + 9 dup excluded; SLA 202/58; unassigned 210; oldest 184d; UFN-67030 verified Solved (system 20, closed 09/01); Outlook window 09/05 02:39–16:00 ET (0 new UFN msgs, 9 threads carried). |
| refresh-2026-08-11T05:07ET-AUTHORITATIVE | 05:07 | **AUTHORITATIVE REFRESH** – Fresh TicketOps LIVE connection. 48 stale → **9 verified eligible** (81% reduction). 39 tickets resolved/closed during ~8h gap. UFN-65881 (Hint Inc.) resolved. UFN-64607: 243h/10d. UFN-64782: 182h/7d. All 9 Unassigned. 5/9 Outlook matches (56%). Watch bucket cleared to 0. All public/data synced. |
| refresh-2026-08-11T05:03ET-FRESHNESS | 05:03 | FRESHNESS REFRESH – Ages recalculated (+1h43m since 03:20 ET). Data preserved from authoritative baseline. |
| refresh-2026-08-11T03:20ET-AUTHORITATIVE | 03:20 | AUTHORITATIVE REFRESH – Fresh TicketOps LIVE connection. 48 stale → 9 verified. 39 resolved/closed. |
| refresh-2026-08-11T03:15ET-FRESHNESS | 03:15 | FRESHNESS REFRESH – Ages recalculated. UFN-64607 crossed 10-day threshold. |
| refresh-2026-08-10T23:20ET | 23:20 | LIVE FULL REFRESH – Reconnected to TicketOps API and Outlook. 5 → 48 tickets. |
| refresh-2026-08-10T23:10ET | 23:10 | FULL LIVE REFRESH – Fresh TicketOps. 1 → 5 eligible. Discovered UFN-64607, UFN-65779. |
| refresh-2026-08-09T21:30ET | 21:30 | ACTION BUCKET CORRECTION – All 3 tickets incorrectly Immediate. |
| refresh-2026-08-09T20:43ET | 20:43 | SWEEP CORRECTION – UFN-65592 re-verified (closeFlag=false). |
| refresh-2026-08-09T19:30ET | 19:30 | CORRECTED – UFN-64843/UFN-64544 excluded (closeFlag=true). |

### Priority Queue

| Rank | Ticket | Customer | Reason | Action |
|------|--------|----------|--------|--------|
| 1 | UFN-64607 | NATURAL RAPPORT | Oldest active (10 days, ~243h); SLA BREACHED; RN-19411 & RN-19412 – two open RNs; no visible activity. | Assign immediately; verify RN status in WISE; contact Jessi at Natural Rapport |
| 2 | UFN-64782 | DAYDREAM NUTRITION INC. | SLA BREACHED (7.5 days, ~182h); Transfer RN-19417; staff replied 08/10 but unresolved. | Assign immediately; verify RN-19417 transfer; contact randy@yourdaydream.com |
| 3 | UFN-65035 | Niagara Bottling | Missed pickup PIT-0811-DUYTAN + load cancellations. 19h old. DIRECT Outlook match. | Assign; review missed pickup schedule; coordinate ops |
| 4 | UFN-65043 | COLAVITA USA/O Olive Oil | TO5020 Edison Transfer – Urgent. Paolo Colavita following up. No delivery date. 18h old. DIRECT Outlook match. HIGH escalation. | Assign immediately; escalate TO5020/TO5022 transfer |
| 5 | UFN-65779 | COLAVITA USA | Active Outlook thread with Kyle Wittenbauer – TO Status inquiry. 15h old. DIRECT Outlook match. | Assign; respond leveraging active thread with Maria Mateo |
| 6 | UFN-65857 | Ritual Beverage | ABF BOL Request. Nina Weiss (ABF) on thread. 10h old. DIRECT Outlook match. | Assign; process BOL request |
| 7 | UFN-65876 | Vita Coco DTC | URGENT DN-5002110. 9h old. | Assign immediately; verify DN status |
| 8 | UFN-65877 | UNIS Internal (Erin Cambra) | Erin EOD – Missed Pickups for PE/Niagara, Rise, Smeg. CKNAPP 3 DNs COMMIT FAILED. 9h old. | Review missed pickups; investigate CKNAPP commit failure |
| 9 | UFN-65895 | Nourison | Containers Devanned TRKU4487366. Ready for pickup. 8h old. DIRECT Outlook match. | Assign; schedule pickup |

## 🚨 Data Freshness Notice

**This refresh (Sep 6 04:45 ET) is an AUTHORITATIVE refresh (v16)** with a fresh TicketOps LIVE connection (dept 323826714354839552, system status 10, UFN prefix). All statuses verified directly against TicketOps. The eligibility gate is `displayStatusSystemStatus=open` + `displayStatusName ∈ {New,Pending}`; `closeFlag` is not a filter (19 live `closeFlag=true` tickets retained — auto-close artifacts must not cause false negatives). Billing/UF Billing/storage/handling/claims invoice items and duplicate ticket/email threads are excluded per the audited rule set in `refresh-manifest.json`.

**Queue health**: 271 verified eligible tickets (202 New / 69 Pending). 200 SLA-breached / 71 on-track; 219 unassigned; oldest 184d. Stale backlog is dominated by recurring New automated/system reports (dropship EOD, appointment-watch, Amazon Freight LTL alerts, Advanced Report – Dock Activity) and older New tickets awaiting assignment. Outlook enrichment was unavailable this cycle (shared mailbox 403 ErrorAccessDenied; non-blocking) — 9 active eligible-ticket threads carried forward. Data is authoritative in `dashboard/data/` and `public/data/`.

## Data Files

- `config.json` – Dashboard configuration & filter rules
- `dashboard/data/tickets.json` – Current eligible ticket data (TicketOps source)
- `dashboard/data/outlook-context.json` – Outlook email thread context (non-blocking)
- `dashboard/data/refresh-manifest.json` – Complete refresh audit with rules applied and evidence metrics
- `public/data/tickets.json` – Public-facing tickets (synced)
- `public/data/structured_list.json` – Public-facing structured dashboard data
- `public/data/outlook-context.json` – Public-facing Outlook context (synced)
- `public/data/refresh-manifest.json` – Public-facing refresh summary

## Repository

- **Owner**: nweber00
- **Repo**: customer-command-center-dashboard-5fcabc
- **URL**: https://github.com/nweber00/customer-command-center-dashboard-5fcabc

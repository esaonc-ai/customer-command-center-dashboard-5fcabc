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

## Current Dashboard State (Last Refresh: Sep 6 13:56 ET – AUTHORITATIVE v19)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | 344 |
| Eligible | **280** (211 New, 0 Open, 69 Pending) |
| UFN-Count | 280 |
| Excluded | 64 — 37 Reopen display-name (outside New/Pending gate) + 22 billing/UF Billing/storage/handling/claims + 5 duplicate threads (3 prior + kept 69946 dropped 69943 / kept 69942 dropped 69941) |
| closeFlag | **NOT a gate** — 19 live `closeFlag=true` tickets retained (e.g. UFN-68733/UFN-68750 auto-close artifacts, UFN-69797, UFN-69618, UFN-43887, UFN-59720) |
| Customers | **53** distinct orgs (ticket-visible coverage; roster supplemental) |
| Priority | 280 Medium |
| SLA Risk | **ELEVATED** – 200 SLA-breached / 80 on-track (large stale New backlog + recurring system reports) |
| Action Buckets | Immediate **24** / Short-Term **49** / Medium-Term **30** / Watch **177** |
| Outlook Coverage | Unavailable this cycle (shared mailbox 403 ErrorAccessDenied; delegated inbox scanned 08:19→13:56 ET, 0 new hits; non-blocking) — **9** eligible-ticket threads carried forward (~3.2%); strongest signals Diageo/Ritual claim 18050 (UFN-69811), Boundless Walmart load-45872185 (UFN-69618/UFN-69771 + new UFN-69942) |
| Last Refresh | 2026-09-06 13:56 ET (**AUTHORITATIVE** – fresh TicketOps LIVE pull; 344 open UFN = 234 New/73 Pending/37 Reopen; **+11 New** since v18 08:19 ET, 0 closed / 0 status / 0 assignment / 0 SLA changes; eligible **280 = +9 net** – 11 arrivals minus 2 regenerated twin threads; closeFlag still NOT a gate (19 retained); UFN-67030 remains Solved/system-20, closed 09/01 → outside gate) |
| Next Refresh | ~08:00 ET (daily summary email; next scheduled task 2026-09-07T08:00:00-04:00); hourly dashboard refresh continues |

### ⏱ Queue Delta (this refresh: v18 → v19)

**AUTHORITATIVE v19 pull (2026-09-06 ~13:56 ET / 17:56Z)** — fresh TicketOps LIVE enumeration (dept 323826714354839552, `POST /v1/iam/tickets/page`, `input{departmentIds:[323826714354839552], displayStatusSystemStatus:[10]}`, UFN prefix client-side): **344 open UFN** (234 New / 73 Pending / 37 Reopen) — server status-statistics verified. **+11 New arrivals since v18 (08:19 ET)**: UFN-69937…UFN-69949 created 09-06 12:54Z–17:20Z (appointment-watch, dropship daily reports, FBM outbound, OMS order-processing alerts, Amazon EDI monitoring, Boundless Ticket[3569318] updates); **0 closed and 0 status/assignment/SLA changes** (Pending 73 and Reopen 37 exactly equal v18; newest UFN-69949 created 17:20:50Z, oldest UFN-33604 created 2026-03-05T14:00:38Z). Eligibility gate unchanged: `displayStatusSystemStatus=open` + `displayStatusName ∈ {New,Pending}`; `closeFlag` is **NOT** a filter → **19 live `closeFlag=true` tickets retained** (UFN-68733/UFN-68750 auto-close artifacts; UFN-69797 Diageo Picks, UFN-69618 Boundless no-labels, UFN-43887 Ritual stickering, UFN-59720). After the same audit exclusions — **37 Reopen**, **22 billing/UF Billing/storage/handling/claims invoice items** (v18 audit ids re-verified; operational keepers retained: UFN-60009 BOL, UFN-68749 storage-SQFT data request, UFN-69818 open-RN ops digest, UFN-69231/UFN-63762/UFN-63959 invoice-dispute ops, UFN-69811 Diageo claim 18050, Boundless incident UFN-69771/UFN-69618/UFN-69942) and **5 duplicate ticket/email threads** (v18's 3: kept 69896 dropped 69893 / kept 69892 dropped 69889 / kept 69663 dropped 69661; **new 2**: kept UFN-69946 dropped UFN-69943 and kept UFN-69942 dropped UFN-69941 — regenerated twin emails, same emailId seconds apart) — **280 eligible = 211 New / 69 Pending** (271 carried + 9 net-new; every v18 eligible ticket still open). Per-row ages advanced to the 13:56 ET anchor (delta +5h37m; floored +5h on carried rows; new rows computed exactly from live UTC createTime → ET; oldest UFN-33604 exact 4443h / 185d). SLA 200 breached / 80 on track; unassigned 226; oldest 185d; customers 53 (no new orgs this cycle; MODERN INFUSIONS LLC 3→5 tickets flips Healthy→Warning); buckets Immediate 24 / Short-Term 49 / Medium-Term 30 / Watch 177. **UFN-67030** verified absent from the open set (remains Solved/system-20, closed 09/01) → outside gate. **Outlook**: delegated mailbox accessible via Graph but shared mailbox nht.cs@unisco.com still 403 ErrorAccessDenied; window 09-06 08:19 ET → 13:56 ET: 0 UFN/Cesanek hits (newest mailbox item remains 09-04T20:30:47Z, pre-window) — non-blocking, 9 eligible-ticket threads carried forward unchanged (3.2% of 280); 2 eligible escalations persist (UFN-69811 Diageo/Ritual claim 18050; Boundless Walmart load-45872185 as one incident). Watermark advanced to 2026-09-06T17:56:00Z (13:56 ET).

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
| refresh-2026-09-06T13:56ET-AUTHORITATIVE-v19 | 13:56 | **AUTHORITATIVE REFRESH v19** – Fresh TicketOps LIVE pull 09/06 ~13:56 ET (dept 323826714354839552, `input{departmentIds,displayStatusSystemStatus:[10]}`, UFN prefix): 344 open UFN = 234 New/73 Pending/37 Reopen — +11 New arrivals since v18 (08:19 ET), 0 closed / 0 status / 0 assignment / 0 SLA changes (server status-statistics verified). → **280 eligible = 211 New / 0 Open / 69 Pending** (+9 net: 11 arrivals − 2 regenerated twin threads kept 69946-dropped-69943, kept 69942-dropped-69941; every v18 eligible ticket still open). closeFlag still NOT a gate – 19 live `closeFlag=true` retained (incl. auto-close artifacts UFN-68733/UFN-68750). Excluded 37 Reopen + 22 billing/storage/handling/claims (v18 audit ids re-verified; operational keepers retained) + 5 dup threads total. Per-row ages advanced to 13:56 ET anchor (+5h37m; new rows exact from live createTime UTC→ET; oldest UFN-33604 exact 185d). SLA 200/80; unassigned 226; oldest 185d; customers 53 (MODERN INFUSIONS LLC Healthy→Warning at 5 tickets); buckets 24/49/30/177. UFN-67030 remains Solved (system 20, closed 09/01). Outlook: delegated OK, shared 403; 0 UFN hits 08:19→13:56 ET – 9 eligible threads carried forward; escalations UFN-69811 + Boundless load-45872185 persist; watermark 13:56 ET. All public/data synced. |
| refresh-2026-09-06T08:19ET-AUTHORITATIVE-v18 | 08:19 | **AUTHORITATIVE REFRESH v18** – Fresh TicketOps LIVE pull 09/06 ~08:19 ET (dept 323826714354839552, `input{departmentIds,displayStatusSystemStatus:[10]}`, UFN prefix): 333 open UFN = 223 New/73 Pending/37 Reopen — population & display-status distribution IDENTICAL to v17 (07:28 ET), server status-statistics verified; no tickets opened/closed/status-changed in the ~51-min window. → **271 eligible = 202 New / 0 Open / 69 Pending** (identical set; net 0 vs v17). closeFlag still NOT a gate – 19 live `closeFlag=true` retained in the eligible set (incl. auto-close artifacts UFN-68733/UFN-68750; + UFN-59720). Excluded 37 Reopen + 22 billing/storage/handling/claims (all 22 v17 audit ids re-verified present; operational keepers retained 10) + 3 dup threads (kept 69896 dropped 69893; kept 69892 dropped 69889; kept 69663 dropped 69661). Per-row refresh anchored 08:19 ET: ages recomputed from live created timestamps; 0 status/assignment/SLA changes; 0 createdDate/lastUpdated changes vs v17 file. SLA 200/71; unassigned 219; oldest 184d; customers 53; buckets 18/46/30/177 — all identical to v17. UFN-67030 verified absent from open set (Solved, system 20, closed 09/01). Outlook: delegated mailbox OK but shared mailbox 403; 0 UFN hits 07:28→08:19 ET – 9 eligible threads carried forward; escalations UFN-69811 + Boundless load-45872185 persist; watermark 08:19 ET. All public/data synced. |
| refresh-2026-09-06T07:28ET-AUTHORITATIVE-v17 | 07:28 | **AUTHORITATIVE REFRESH v17** – Fresh TicketOps LIVE pull 09/06 ~07:28 ET (dept 323826714354839552, displayStatusSystemStatus=[10], UFN prefix): 333 open UFN = 223 New/73 Pending/37 Reopen — population & display-status distribution IDENTICAL to v16 (04:45 ET); no tickets opened/closed/status-changed in window. → **271 eligible = 202 New / 0 Open / 69 Pending** (identical set; net 0 vs v16). closeFlag still NOT a gate – 19 live `closeFlag=true` retained (incl. UFN-68733/UFN-68750). Excluded 37 Reopen + 22 billing/storage/handling/claims (same audit ids; operational keepers retained 10) + 3 dup threads (69893→69896, 69889→69892, 69661→69663). Per-row refresh to 07:28 ET: ages recomputed (+6–7h vs v16 anchor); UFN-41878 createdDate corrected 04-06→04-05; 6 lastUpdated-date refreshes; 0 status/assignment/SLA changes. SLA 200/71; unassigned 219; oldest 184d; customers 53; buckets 18/46/30/177. UFN-67030 remains Solved (system 20, closed 09/01). Outlook UNAVAILABLE (403 shared mailbox; 0 UFN hits delegated inbox) – 9 eligible threads carried forward; escalations UFN-69811 + Boundless load-45872185 persist. All public/data synced. |
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

**This refresh (Sep 6 13:56 ET) is an AUTHORITATIVE refresh (v19)** with a fresh TicketOps LIVE connection (dept 323826714354839552, `POST /v1/iam/tickets/page` with `input{departmentIds:[323826714354839552], displayStatusSystemStatus:[10]}`, UFN prefix applied client-side). All statuses verified directly against TicketOps; the open population is **344 = 234 New / 73 Pending / 37 Reopen** (+11 New arrivals since the v18 08:19 ET pull; 0 closed, 0 status/assignment/SLA changes — server status-statistics confirmed). The eligibility gate is `displayStatusSystemStatus=open` + `displayStatusName ∈ {New,Pending}`; `closeFlag` is not a filter (19 live `closeFlag=true` tickets retained in the eligible set — auto-close artifacts must not cause false negatives). Billing/UF Billing/storage/handling/claims invoice items and duplicate ticket/email threads are excluded per the audited rule set in `refresh-manifest.json` (5 duplicate threads total this cycle, including new twin pairs 69943→69946 and 69941→69942).

**Queue health**: 280 verified eligible tickets (211 New / 69 Pending) — the full v18 eligible set plus 9 net-new arrivals; no eligible ticket left the open set this cycle. 200 SLA-breached / 80 on-track; 226 unassigned; oldest 185d (UFN-33604). Stale backlog remains dominated by recurring New automated/system reports (dropship EOD, appointment-watch, Amazon Freight LTL alerts, Advanced Report – Dock Activity) and older New tickets awaiting assignment. Per-row ages advanced to the 13:56 ET anchor (new rows computed exactly from live created timestamps, UTC→ET). Outlook enrichment was unavailable this cycle (shared mailbox 403 ErrorAccessDenied; delegated inbox scanned 08:19→13:56 ET with 0 UFN/Cesanek hits; non-blocking) — 9 active eligible-ticket threads carried forward unchanged; watermark advanced to 13:56 ET (2026-09-06T17:56:00Z). Data is authoritative in `dashboard/data/` and `public/data/`.

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

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

## Current Dashboard State (Last Refresh: Sep 7 19:38 ET – AUTHORITATIVE v23)

| Total Raw (open UFN, dept-gate) | 383 |
| Eligible | **311** (242 New, 0 Open, 69 Pending) |
| UFN-Count | 311 |
| Excluded | 72 — 41 Reopen display-name (outside New/Pending gate) + 22 billing/UF Billing/storage/handling/claims + 9 duplicate threads (5 v22 pairs re-verified: kept 69946 dropped 69943 / kept 69942 dropped 69941 / kept 69896 dropped 69893 / kept 69892 dropped 69889 / kept 69663 dropped 69661; + 4 NEW twins: kept 70010 dropped 70009 / kept 70002 dropped 70001 / kept 69987 dropped 69986 / kept 70008 dropped 70005) |
| closeFlag | **NOT a gate** — 19 live `closeFlag=true` tickets retained (e.g. UFN-68733/UFN-68750 auto-close artifacts, UFN-69797, UFN-69618, UFN-43887, UFN-59720) |
| Customers | **55** distinct orgs (ticket-visible coverage; roster supplemental; +2 Autoempick, ETCC Reg4 Scheduling) |
| Priority | 311 Medium |
| SLA Risk | **ELEVATED** – 200 SLA-breached / 111 on-track (carried 200/87 + 24 new rows On Track) |
| Action Buckets | Immediate **24** / Short-Term **52** / Medium-Term **55** / Watch **180** (+13h age advance; all 24 new arrivals <24h in Immediate) |
| Outlook Coverage | Partial this cycle (shared mailbox 403 ErrorAccessDenied; delegated inbox scanned 09-07 06:13 ET → 19:29 ET, **0 new unique eligible threads**; Boundless Walmart load-45872185 incident refreshed 17:30Z) — **10** eligible-ticket threads carried forward (3.2%); strongest signals Diageo/Ritual claim 18050 (UFN-69811), Boundless Walmart load-45872185 (UFN-69618/UFN-69771/UFN-69942) |
| Last Refresh | 2026-09-07 19:38 ET (**AUTHORITATIVE** – fresh TicketOps LIVE pull; server total 383 open UFN = 269 New/73 Pending/41 Reopen; all 287 v22 eligible rows still open (0 removals) + **24 new eligible arrivals**; eligible **311** = 242 New/69 Pending (+24 net); closeFlag still NOT a gate (19 retained); UFN-67030 remains closed 09/01 → outside gate) |
| Next Refresh | ~08:00 ET (daily summary email; next scheduled task 2026-09-08T08:00:00-04:00); hourly dashboard refresh continues |

### ⏱ Queue Delta (this refresh: v22 → v23)

**AUTHORITATIVE v23 pull (2026-09-07 ~19:38 ET / 23:38Z)** — fresh TicketOps LIVE enumeration (dept 323826714354839552, `POST /v1/iam/tickets/page`, `input{departmentIds:[323826714354839552], displayStatusSystemStatus:[10], displayStatusIds:[11,6]}` — displayStatusIds honored server-side): server total **383 open UFN** = New 269 + Pending 73 + Reopen 41 (+31 vs v22 352: +28 New, +3 Reopen, Pending flat). Eligible base (New+Pending) **342** = **ALL 287 v22 eligible rows still present (0 removals** — every v22 eligible id re-verified open New/Pending) **+ 55 base additions**. Audits: **41 Reopen** excluded (display name, outside gate); **22 billing/UF Billing/storage/handling/claims invoice items** (v22 audit ids re-verified present; operational keepers retained incl. UFN-60009 BOL, UFN-68749 storage-SQFT request, UFN-69818/UFN-70016 open-RN ops digests, UFN-69231/UFN-63762/UFN-63959 invoice-dispute ops, UFN-69811 Diageo claim 18050, Boundless incident UFN-69771/UFN-69618/UFN-69942); **9 duplicate threads** (5 v22 pairs re-verified: kept 69946 dropped 69943 / kept 69942 dropped 69941 / kept 69896 dropped 69893 / kept 69892 dropped 69889 / kept 69663 dropped 69661; + 4 NEW regenerated twins: kept 70010 dropped 70009 / kept 70002 dropped 70001 / kept 69987 dropped 69986 / kept 70008 dropped 70005; dropship daily reports 69990/69991-type retained — different orgs, not twins). → Final eligible **311 = 242 New / 0 Open / 69 Pending** (+24 net eligible arrivals: UFN-69985…70035 range, all New — EOD batch, appointment watch, CH Robinson/Uber pickup appts, OMS/dropship reports, Aviron cancel DN, Boundless load updates). Per-row ages advanced +13 whole hours from the v22 exact anchor 2026-09-07T10:20:00Z (measured delta 13h18m); ageDays = floor(ageHours/24); oldest UFN-33604 4460h→**4473h / 186d**; buckets recomputed **Immediate 24 / Short-Term 52 / Medium-Term 55 / Watch 180** (all 24 new arrivals <24h land in Immediate; +13h moved rows Short→Medium / Medium→Watch). SLA 200 breached / 111 on track (carried 200/87 — no state change among continuing rows: 0 removals/0 arrivals in that set, due windows future — plus 24 new rows On Track); unassigned 253 (231 carried + 22 new; new assigned UFN-69998/UFN-70013 Kent Joseph Lim); customers 55 (+2: Autoempick, ETCC Reg4 Scheduling; roster supplemental; tier split recomputed deterministic **37 Critical / 10 Warning / 8 Healthy**). **UFN-67030** remains closed (09/01) → outside gate. **Outlook**: delegated mailbox accessible via Graph, shared mailbox nht.cs@unisco.com still 403 ErrorAccessDenied; window 06:13 ET → 19:29 ET (10:13Z→23:29Z): 6 msgs / 4 conversations — Boundless Walmart load-45872185 incident refreshed 17:30Z (same incident, no new unique thread); AMI/Roar SO1393032/DN-2117711 context (UFN-68616, outside eligible set) recorded as excluded-context; 2 Tweetie billing digests (no UFN mapping) not counted — 10 eligible-ticket threads carried forward unchanged (3.2% of 311); 2 eligible escalations persist (UFN-69811 Diageo/Ritual claim 18050; Boundless Walmart load-45872185 as one incident). Watermark advanced to 2026-09-07T23:29:00Z (19:29 ET).

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
| refresh-2026-09-07T19:38ET-AUTHORITATIVE-v23 | 19:38 | **AUTHORITATIVE REFRESH v23** – Fresh TicketOps LIVE pull 09/07 ~19:38 ET (dept 323826714354839552; displayStatusIds [11,6] verified honored server-side): **383 open UFN = 269 New/73 Pending/41 Reopen** (+31 vs v22 352: +28 New, +3 Reopen; Pending flat). Eligible base 342 = ALL 287 v22 rows still present (**0 removals**) + 55 base additions → after audits **311 eligible = 242 New / 0 Open / 69 Pending (+24 net)**. Excluded 41 Reopen + 22 billing/storage/handling/claims (v22 audit ids re-verified; operational keepers retained incl. UFN-69818/UFN-70016 RN ops digests) + **9 dup threads** (5 v22 pairs re-verified + 4 NEW twins: kept 70010 dropped 70009 / kept 70002 dropped 70001 / kept 69987 dropped 69986 / kept 70008 dropped 70005). closeFlag still NOT a gate – 19 live `closeFlag=true` retained. Ages +13 whole hours from v22 anchor 10:20Z; oldest UFN-33604 4473h/**186d**; buckets **24/52/55/180** (all 24 new arrivals Immediate). SLA **200/111** (200/87 carried + 24 new On Track); unassigned 253; customers **55** (+2: Autoempick, ETCC Reg4 Scheduling; tiers recomputed 37 Critical/10 Warning/8 Healthy). UFN-67030 remains closed (09/01). Outlook: delegated OK, shared 403; Boundless Walmart load-45872185 refreshed 17:30Z (same incident); AMI/Roar UFN-68616 excluded-context; 0 new unique eligible threads – 10 carried (3.2%); watermark 2026-09-07T23:29:00Z. All public/data synced. |
| refresh-2026-09-07T06:20ET-AUTHORITATIVE-v22 | 06:20 | **AUTHORITATIVE REFRESH v22** – Fresh TicketOps LIVE pull 09/07 ~06:20 ET (dept 323826714354839552): 352 open UFN total (server total unchanged vs v21). Population IDENTICAL to v21 (01:00:41Z anchor) – newest open UFN-69967 (created 09-06 20:51Z) == v21 max ⇒ 0 arrivals / 0 removals in the ~9h19m window. → **287 eligible = 218 New / 0 Open / 69 Pending** (identical set; net 0). closeFlag still NOT a gate – 19 live `closeFlag=true` retained (incl. auto-close artifacts UFN-68733/UFN-68750). Excluded 38 Reopen + 22 billing/storage/handling/claims (v21 audit ids re-verified; operational keepers retained) + 5 dup threads (same 5 pairs). Per-row ages advanced +9 whole hours from v21 exact anchor 01:00:41Z (delta +9h19m); oldest UFN-33604 4460h/185d. SLA 200/87 (carried – no state change); unassigned 231; oldest 185d; customers 53 (tiers 36/6/11 unchanged); buckets 17/55/38/177 (1 row Short→Medium on age advance). UFN-67030 remains closed (09/01). Outlook: delegated OK, shared 403; 0 new hits 21:00 ET→06:13 ET – 10 threads carried (3.5%); escalations UFN-69811 + Boundless load-45872185 persist; watermark 2026-09-07T10:13:00Z. All public/data synced. |
| refresh-2026-09-06T21:00ET-AUTHORITATIVE-v21 | 21:00 | **AUTHORITATIVE REFRESH v21** – Fresh TicketOps LIVE pull 09/06 ~21:00 ET (dept 323826714354839552, status-statistics verified): 352 open UFN = 241 New/73 Pending/38 Reopen (+0 vs v20 20:33 ET — population & display-status distribution identical; no arrivals/removals/status changes in the ~27-min window). → **287 eligible = 218 New / 0 Open / 69 Pending** (identical set to v20; net 0). closeFlag still NOT a gate – 19 live `closeFlag=true` retained (incl. auto-close artifacts UFN-68733/UFN-68750). Excluded 38 Reopen + 22 billing/storage/handling/claims (v20 audit ids re-verified; operational keepers retained) + 5 dup threads (same 5 pairs). Per-row ages recomputed to 21:00:41 ET anchor (exact from live createTime UTC→ET; +27m09s; +1h on 111 rows, 3 rows +1 age-day; oldest UFN-33604 exact 4451h/185d). SLA 200/87 (0 flips); unassigned 231; oldest 185d; customers 53 (DAYDREAM NUTRITION oldestBreachedAgeDays 23→24 only change; tiers 36/6/11 unchanged); buckets 17/56/37/177 (unchanged). UFN-67030 remains Solved (system 20, closed 09/01). Outlook: delegated OK, shared 403; 0 new hits 20:33→21:00 ET – 10 threads carried (3.5%); escalations UFN-69811 + Boundless load-45872185 persist; watermark 21:00 ET (2026-09-07T01:00:41Z). All public/data synced. |
| refresh-2026-09-06T20:33ET-AUTHORITATIVE-v20 | 20:33 | **AUTHORITATIVE REFRESH v20** – Fresh TicketOps LIVE pull 09/06 ~20:33 ET (dept 323826714354839552, status-statistics verified): 352 open UFN = 241 New/73 Pending/38 Reopen (+8 vs v19: +7 New, +1 Reopen). → **287 eligible = 218 New / 0 Open / 69 Pending** (+7 net: 8 new arrivals − UFN-69953 Colavita pending orders, UFN-69955 Appointment Watch, Cesanek Dropship EOD UFN-69960/61/62/64/65/67 − minus 1 closed UFN-69862 Amazon Freight LTL Pickup Schedule; every other v19 eligible ticket still open). closeFlag still NOT a gate – 19 live `closeFlag=true` retained (incl. auto-close artifacts UFN-68733/UFN-68750). Excluded 38 Reopen + 22 billing/storage/handling/claims (v19 audit ids re-verified; operational keepers retained) + 5 dup threads (same 5 pairs). Per-row ages recomputed to 20:33 ET anchor (exact from live createTime UTC→ET; oldest UFN-33604 exact 4450h/185d). SLA 200/87; unassigned 231; oldest 185d; customers 53 (SMEG 27→26 on 69862 closure; EOD orgs +1 each; tiers 36/6/11); buckets 17/56/37/177. UFN-67030 remains Solved (system 20, closed 09/01). Outlook: delegated OK, shared 403; 1 new Colavita/Fusion hit 19:25:11Z → UFN-69953 (DIRECT match) – 10 threads carried (3.5%); escalations UFN-69811 + Boundless load-45872185 persist; watermark 20:33 ET. All public/data synced. |
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

**This refresh (Sep 6 21:00 ET) is an AUTHORITATIVE refresh (v21)** with a fresh TicketOps LIVE connection (dept 323826714354839552, `POST /v1/iam/tickets/page` with `input{departmentIds:[323826714354839552], displayStatusSystemStatus:[10]}`, UFN prefix applied client-side; server status-statistics cross-checked via `POST /v1/iam/report/ticket/status`). All statuses verified directly against TicketOps; the open population is **352 = 241 New / 73 Pending / 38 Reopen** (+0 since the v20 20:33 ET pull — population & display-status distribution identical; no tickets opened/closed/status-changed in the ~27-min window). The eligibility gate is `displayStatusSystemStatus=open` + `displayStatusName ∈ {New,Pending}`; `closeFlag` is not a filter (19 live `closeFlag=true` tickets retained in the eligible set — auto-close artifacts must not cause false negatives). Billing/UF Billing/storage/handling/claims invoice items and duplicate ticket/email threads are excluded per the audited rule set in `refresh-manifest.json` (22 invoice items + 5 duplicate threads, all same audit sets as v20, re-verified against the live pull).

**Queue health**: 287 verified eligible tickets (218 New / 69 Pending) — identical set to v20 (0 new arrivals, 0 removals, 0 status/assignment/SLA changes in the window). 200 SLA-breached / 87 on-track; 231 unassigned; oldest 185d (UFN-33604, exact 4451h). Stale backlog remains dominated by recurring New automated/system reports (dropship EOD, appointment-watch, Amazon EDI alerts, Advanced Report – Dock Activity) and older New tickets awaiting assignment. Per-row ages recomputed exactly from live created timestamps anchored 21:00:41 ET (UTC→ET; +27m09s vs v20; +1h on 111 rows, 3 rows +1 age-day). Outlook enrichment was partial this cycle (shared mailbox 403 ErrorAccessDenied; delegated inbox scanned 20:33→21:00 ET with **0 new hits**; non-blocking) — 10 active eligible-ticket threads carried forward; watermark advanced to 21:00 ET (2026-09-07T01:00:41Z). Data is authoritative in `dashboard/data/` and `public/data/`.

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

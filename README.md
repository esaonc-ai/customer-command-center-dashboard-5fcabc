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

## Current Dashboard State (Last Refresh: Sep 9 21:08 ET – AUTHORITATIVE v26)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | **347** (221 New / 84 Pending / 42 Reopen / 0 Open) |
| Eligible | **280** (201 New, 0 Open, 79 Pending) |
| UFN-Count | 280 |
| Excluded | 67 — 42 Reopen (outside New/Pending gate) + 24 billing/UF Billing/storage/handling invoice items + 9 duplicate threads in the rule set (1 applied this cycle; 8 twin drops already outside the gate) |
| closeFlag | **NOT a gate** — 25 live `closeFlag=true` tickets retained (auto-close artifacts incl. UFN-437, …) |
| Customers | **58** distinct orgs (ticket-visible coverage; roster/aliases supplemental; org names from TicketOps org records) |
| Priority | 280 Medium |
| SLA Risk | **ELEVATED** – 213 SLA-breached / 67 on-track |
| Action Buckets | Immediate **50** / Short-Term **16** / Medium-Term **15** / Watch **199** |
| Outlook Coverage | Delegated inbox nicole.weber@unisco.com scanned 09-08T07:16:33Z → 09-10T00:14:01Z: **11 new eligible ops threads** + 3 carried matched threads (14 total); shared mailbox nht.cs@unisco.com **403** (non-blocking); 6 active escalations (4 with eligible tickets) |
| Last Refresh | 2026-09-09 21:08 ET (**AUTHORITATIVE v26** – fresh TicketOps LIVE pull 09-10 01:04:56Z–01:08:38Z; dept 323826714354839552; dept totals re-verified per row: 347 open UFN = 221 New / 84 Pending / 42 Reopen / 0 Open) |
| Next Refresh | Hourly dashboard refresh continues; next daily summary email 2026-09-10T08:00:00-04:00 |

### ⏱ Queue Delta (this refresh: v25 → v26)

**AUTHORITATIVE v26 pull (2026-09-10 01:04:56Z–01:08:38Z / 2026-09-09 21:05–21:09 ET)** — department-scoped TicketOps LIVE enumeration (dept 323826714354839552, `POST /v1/iam/tickets/page`, `input{ticketNumber:"UFN-", displayStatusSystemStatus:[10], displayStatusIds:[11]/[6]}`, department asserted on every returned row): raw open UFN **347** = New 221 / Pending 84 / Reopen 42 / Open 0 (**−50 vs v25 397**; New −62, Pending +11, Reopen +1). Eligible base (New+Pending) 305 → after unchanged audits (24 invoice exclusions + 1 applicable duplicate-thread drop) **280 eligible = 201 New / 0 Open / 79 Pending (−45 net)**. Diff vs the 325-row v25 set: **207 rows retained, 118 departed (closed/solved), 73 new arrivals (UFN-70123…UFN-70350), 2 New→Pending flips** (UFN-69738, UFN-69745). closeFlag still **NOT a gate** — 25 live `closeFlag=true` retained. Ages recomputed at anchor 2026-09-09T21:08:38-04:00; oldest UFN-33604 **4523h / 188d**. Buckets recomputed Immediate **50** / Short-Term **16** / Medium-Term **15** / Watch **199**. SLA **213 breached / 67 on track**; unassigned **224**. Customers **58** (tiers **42 Critical / 6 Warning / 10 Healthy**; new orgs: ATERIAN GROUP, INC., CAMBRIDGE SLEEP SCIENCES, CERTIFIED ORIGINS, CODA RESOURCES, RISE BEVERAGES LLC dba RISE BREWING COMPANY, ROOM TO GROW NATIONAL INC, UNIVERA BRANDS; orgs no longer visible in eligible tickets: DUPRAY USA LLC, ETCC Reg4 Scheduling, MODERN INFUSIONS LLC, Wynk). **4 out-of-scope legacy-department UFN tickets excluded** (UFN-68732 / UFN-11704 / UFN-63189 / UFN-28037 — current departmentId 324119200704569344, initialDepartmentId 323826714354839552); **UFN-67030** remains Solved/closed → outside gate. Outlook: delegated inbox scanned (11 new eligible ops threads: Boundless/Walmart load-45872185, Diageo/Ritual commit-fail + claim 18050 context, Hint shortage/commit-fail, Colavita VWL carrier complaint, Martignetti PO 098087, Roar/AMI, KeHE–Uber pickup, Iceland Direct); shared mailbox 403; 3 carried matched threads (UFN-69723, UFN-69462, UFN-68714). All public/data synced.

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | **50** | Age <24h — newest arrivals (UFN-70350, UFN-70348, UFN-70338…UFN-70343 dropship EOD, UFN-70336 Appointment Watch, building-closure confirmations, Facility Closure notices) |
| **Short-Term** | **16** | 24–72h |
| **Medium-Term** | **15** | 72–168h |
| **Watch** | **199** | >168h — stale backlog (UFN-33604 188d, UFN-33722 185d, UFN-35588 179d, PRIME TIME/LASSONDE/SMEG cohorts) |

### Customer Health Detail (top risk)

| Customer | Tickets | Oldest Breached | Breached | Health |
|----------|---------|-----------------|----------|--------|
| Turtle Beach | 22 | 188d | 21 | Critical |
| ZEN BEVERAGE | 2 | 188d | 1 | Critical |
| ATERIAN INC | 1 | 181d | 1 | Critical |
| SMEG USA INC | 17 | 180d | 15 | Critical |
| WYNK BEVERAGE - Reverse | 1 | 172d | 1 | Critical |
| NIAGARA BOTTLING LLC | 14 | 166d | 13 | Critical |
| PRIME TIME PACKAGING LTD | 17 | 157d | 17 | Critical |
| THE LUCKY OX LLC | 1 | 156d | 1 | Critical |
| RITUAL BEVERAGE COMPANY | 10 | 149d | 7 | Critical |
| COOLERSBYU, LLC. | 1 | 135d | 1 | Critical |
| ROAR BEVERAGES INC | 2 | 131d | 1 | Critical |
| RECESS | 3 | 128d | 3 | Critical |
| DELMAR INTERNATIONAL INC | 3 | 86d | 2 | Critical |
| GOLDEN BULL MARKETING | 3 | 72d | 3 | Critical |
| SUMA BRANDS FUNDING I, LLC | 1 | 70d | 1 | Critical |
| LASSONDE PAPPAS AND COMPANY, INC. | 55 | 69d | 52 | Critical |
| UNIS Internal | 6 | 69d | 1 | Critical |
| LIFEPRO FITNESS LLC | 4 | 63d | 3 | Critical |
| CERTIFIED ORIGINS | 2 | 13d | 1 | Warning |
| UNIVERA BRANDS | 1 | 13d | 1 | Warning |
| Erica Stiles | 1 | 8d | 1 | Warning |
| ZEN BEVERAGE LLC | 2 | 6d | 1 | Warning |
| FXF-DCN | 1 | 5d | 1 | Warning |
| ATERIAN GROUP, INC. | 4 | 0d | 0 | Warning |
| CODA RESOURCES | 2 | 0d | 0 | Healthy |
| Autoempick | 1 | 0d | 0 | Healthy |
| ROOM TO GROW NATIONAL INC | 1 | 0d | 0 | Healthy |
| CAMBRIDGE SLEEP SCIENCES | 1 | 0d | 0 | Healthy |
| MAIZLY INC. | 1 | 0d | 0 | Healthy |
| RISE BREWING | 1 | 0d | 0 | Healthy |

*Coverage: all 58 customers visible in eligible tickets (42 Critical / 6 Warning / 10 Healthy). Escalation-driven Critical: BOUNDLESS EC US LLC, RITUAL BEVERAGE COMPANY, HINT INC., COLAVITA USA, LLC (active escalated threads with eligible tickets).*

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-09-09T21:08ET-AUTHORITATIVE-v26 | 21:08 | **AUTHORITATIVE REFRESH v26** – Fresh TicketOps LIVE department-scoped pull 09-10 01:04:56Z–01:08:38Z (dept 323826714354839552): raw open UFN **347** = 221 New / 84 Pending / 42 Reopen / 0 Open (−50 vs v25). Eligible base 305 → **280 eligible = 201 New / 0 Open / 79 Pending** after 24 invoice exclusions + 1 applicable dup drop. 207 v25 rows retained / 118 departed / 73 arrivals / 2 New→Pending flips. closeFlag not a gate (25 retained). Ages anchored 21:08 ET; oldest UFN-33604 4523h/188d; buckets 50/16/15/199; SLA 213/67; unassigned 224; customers 58 (42/6/10). 4 legacy-department UFN tickets excluded as out of scope. UFN-67030 remains Solved. Outlook: 11 new eligible threads + 3 carried; shared mailbox 403. All public/data synced. |
| refresh-2026-09-08T03:20ET-AUTHORITATIVE-v25 | 03:20 | **AUTHORITATIVE REFRESH v25** – Fresh TicketOps LIVE pull 09/08 07:16–07:22Z: 397 open UFN = 283 New/73 Pending/41 Reopen/0 Open (+14); eligible 325 = 256 New/69 Pending; +14 SMEG arrivals UFN-70047…70060; overdue-removal audits re-verified; Outlook 10 carried threads (3.1%); oldest 186d. |
| refresh-2026-09-07T22:53ET-AUTHORITATIVE-v24 | 22:53 | **AUTHORITATIVE REFRESH v24** – 383 open UFN = 269 New/73 Pending/41 Reopen (0 arrivals/0 removals/0 flips); eligible 311 = 242 New/69 Pending; oldest 186d. |
| refresh-2026-09-07T19:38ET-AUTHORITATIVE-v23 | 19:38 | **AUTHORITATIVE REFRESH v23** – 383 open UFN = 269 New/73 Pending/41 Reopen (+31 vs v22); eligible 311 = 242 New/69 Pending; +4 new duplicate twins collapsed; Outlook 10 carried. |

### Priority Queue

| Rank | Ticket | Customer | Subject | Reason | Action |
|------|--------|----------|---------|--------|--------|
| 1 | UFN-33604 | Turtle Beach | Pending/Overdue Tickets | 188d (4523h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 2 | UFN-33722 | ZEN BEVERAGE | 12x9x12 Boxes Needed | 188d (4516h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 3 | UFN-35588 | ATERIAN INC | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: VY8-M2X5 AT | 181d (4348h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 4 | UFN-35774 | SMEG USA INC | Commit Block Order - DN-1467983 | 180d (4328h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 5 | UFN-37858 | WYNK BEVERAGE - Reverse | welcome, spring 🌷🍋🪻🍓 | 172d (4138h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 6 | UFN-39065 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 168d (4043h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 7 | UFN-39403 | SMEG USA INC | Reminder following up! | 167d (4016h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 8 | UFN-39662 | NIAGARA BOTTLING LLC | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN | 166d (3992h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 9 | UFN-40213 | NIAGARA BOTTLING LLC | Re: QUANTIX SCHEDULE - 3/28 & 3/30 | 163d (3923h) old; SLA BREACHED | Assign immediately; investigate backlog |
| 10 | UFN-40654 | NIAGARA BOTTLING LLC | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 | 162d (3892h) old; SLA BREACHED | Assign immediately; investigate backlog |

## 🚨 Data Freshness Notice

**This refresh (Sep 9 21:08 ET) is an AUTHORITATIVE refresh (v26)** with a fresh TicketOps LIVE department-scoped connection (dept 323826714354839552, `POST /v1/iam/tickets/page` with `input{ticketNumber:"UFN-", displayStatusSystemStatus:[10], displayStatusIds:[11]/[6]}` and the department asserted on every returned row). The open population is **347 = 221 New / 84 Pending / 42 Reopen / 0 Open** (−50 vs v25). The eligibility gate is `displayStatusSystemStatus=open` + `displayStatusName ∈ {New,Pending}`; `closeFlag` is **not** a filter (25 live `closeFlag=true` tickets retained so auto-close artifacts cannot cause false negatives). Billing/UF Billing/storage/handling invoice items (24 audited ids incl. new arrivals UFN-70140 //BILLING and UFN-70303 Handling 8/30–9/05) and duplicate ticket/email threads (9 in the rule set; 1 applied this cycle) are excluded. Four UFN tickets whose **current** department is not the NHT/Cesanek UFN department (UFN-68732, UFN-11704, UFN-63189, UFN-28037 — current dept 324119200704569344) are excluded as out of scope and are listed for transparency; prefix-wide (non-department) enumeration would report 351 open UFN and 284 eligible including those four.

**Queue health**: **280 verified eligible tickets (201 New / 79 Pending)** — 207 of the v25 rows still open, 118 departed, 73 new arrivals, 2 New→Pending flips. **213 SLA-breached / 67 on-track; 224 unassigned**; oldest **188d** (UFN-33604, 4523h). Stale backlog remains dominated by recurring New automated/system reports (dropship EOD, appointment watch, Amazon/EDI and dock-activity digests) plus older New/Pending tickets awaiting assignment; the newest arrivals include the Sep 9 Cesanek dropship EOD set, building-closure confirmations, and facility-transition notices. Outlook enrichment: delegated inbox scanned to **2026-09-10T00:14:01Z** with **11 new eligible ops threads** (plus 3 carried matched threads); shared mailbox nht.cs@unisco.com returned **403** (non-blocking); 6 active escalations, 4 with eligible tickets. Data is authoritative in `dashboard/data/` and `public/data/`.

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

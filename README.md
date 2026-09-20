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

## Current Dashboard State (Last Refresh: Sep 20 2026 18:47 ET - AUTHORITATIVE)

| Metric | Value |
|--------|-------|
| Total Raw (systemStatus=open) | 349 = New 241 + Pending 70 + Reopen 38 |
| Gate matched | **311** (New 241, Pending 70) |
| Eligible | **283** (223 New, 0 Open, 60 Pending) |
| UFN-Count | 283 |
| Excluded | 21 billing/UF Billing/storage/handling + 7 overlapping-thread duplicates; Reopen 38 outside gate |
| closeFlag | **NOT a gate** - 22 live `closeFlag=true` tickets retained (auto-close artifacts) |
| Customers | **50** distinct orgs (all customers visible in eligible tickets; roster supplemental) |
| Customer Health tiers | Critical 28 / Warning 22 / Healthy 0 |
| SLA Risk | **HIGH** - 279 SLA-breached / 4 on-track; 235 unassigned |
| Oldest eligible | 199 days |
| Aging 15d+ | 176 tickets |
| Pending + breached | 56 |
| Outlook Coverage | **Unavailable this cycle** (non-blocking) - contributed 0 threads, changed no counts; prior context carried forward and labelled stale |
| Last Refresh | 2026-09-20 18:47 ET (**AUTHORITATIVE** - fresh TicketOps pull, 311/311 gate rows enumerated) |
| Next Refresh | ~08:00 ET (daily summary email) |

> **Premise correction (carried forward):** the instruction cites UFN-67030 as "live-Pending with closeFlag=true". Ticket Ops is authoritative and shows UFN-67030 = `displayStatusName=Solved`, `displayStatusSystemStatus=20`, `closeFlag=true`, staff-closed 2026-09-01. It is excluded **by status**, not by closeFlag. The rule still stands: `closeFlag` is **not** an eligibility gate - the correct counter-evidence is the 22 eligible live `closeFlag=true` New/Pending rows retained in this refresh.

### Status gate at a glance

| Display status | displayStatusId | systemStatus | Rows | In scope |
|----------------|-----------------|--------------|------|----------|
| New | 11 | open (10) | 241 | Yes |
| Pending | 6 | open (10) | 70 | Yes |
| Open (renders as Reopen at this department) | 1 | open (10) | 38 | No - excluded by status name |
| Closed / Resolved / Solved / Cancelled / Done | - | 20 / 30 / 40 | - | No |

### Action Buckets

| Bucket | Count | Example tickets |
|--------|-------|-----------------|
| Automated report / notification series | 118 | UFN-33604, UFN-39065, UFN-40670, UFN-40860, UFN-41878, UFN-42645 |
| Other customer service / ops | 85 | UFN-33719, UFN-33722, UFN-37858, UFN-39403, UFN-39662, UFN-40213 |
| Appointment / carrier pickup requests | 21 | UFN-35588, UFN-40969, UFN-46639, UFN-47786, UFN-51184, UFN-54684 |
| Order commit-blocked / failed & order-status exceptions | 21 | UFN-35774, UFN-57050, UFN-65951, UFN-67835, UFN-68017, UFN-68029 |
| Claims / damage / returns & inventory discrepancies | 19 | UFN-46564, UFN-56957, UFN-59238, UFN-59296, UFN-59777, UFN-61390 |
| Facility move-out / transfer | 19 | UFN-64739, UFN-67511, UFN-69148, UFN-70161, UFN-70246, UFN-70285 |

### Priority Queue (oldest eligible)

| # | Ticket | Customer | Age | SLA | Subject |
|---|--------|----------|-----|-----|---------|
| 1 | UFN-33604 | Turtle Beach | 199d | Breached | Pending/Overdue Tickets |
| 2 | UFN-33719 | WATER PLUS LLC | 198d | Breached | INVOICE UPDATE REQUIRED / UFN-32193 RE: 19298289 - WATER PL... |
| 3 | UFN-33722 | erin.cambra@unisco.com | 198d | Breached | 12x9x12 Boxes Needed |
| 4 | UFN-35588 | ATERIAN INC | 191d | Breached | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: ... |
| 5 | UFN-35774 | SMEG USA INC | 191d | Breached | Commit Block Order - DN-1467983 |
| 6 | UFN-37858 | WYNK BEVERAGE - Reverse | 183d | Breached | welcome, spring |
| 7 | UFN-39065 | Turtle Beach | 179d | Breached | Reminder: SEND VIVO DAMAGE REPORT |
| 8 | UFN-39403 | SMEG USA INC | 178d | Breached | Reminder following up! |
| 9 | UFN-39662 | NIAGARA BOTTLING LLC | 177d | Breached | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN |
| 10 | UFN-40213 | NIAGARA BOTTLING LLC | 174d | Breached | Re: QUANTIX SCHEDULE - 3/28 & 3/30 |
| 11 | UFN-40654 | NIAGARA BOTTLING LLC | 172d | Breached | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 |
| 12 | UFN-40670 | RITUAL BEVERAGE COMPANY | 172d | Breached | March F26 Month End Close Reminder |
| 13 | UFN-40860 | Turtle Beach | 172d | Breached | Reminder: SEND VIVO DAMAGE REPORT |
| 14 | UFN-40969 | SMEG USA INC | 172d | Breached | Schedule Appointment-Pickup(1) - BOL# 33604304 |
| 15 | UFN-41878 | PRIME TIME PACKAGING LTD | 167d | Breached | Drayage Assignments |

### Customer Health Detail (top 20 by volume)

| Customer | Tickets | Breached | Oldest breached | Health |
|----------|---------|----------|-----------------|--------|
| LASSONDE PAPPAS AND COMPANY, INC. | 63 | 63 | 80d | Critical |
| Turtle Beach | 23 | 23 | 199d | Critical |
| Midea America Corp | 19 | 19 | 50d | Critical |
| DAYDREAM NUTRITION INC. | 16 | 16 | 37d | Critical |
| PRIME TIME PACKAGING LTD | 16 | 16 | 167d | Critical |
| SMEG USA INC | 14 | 14 | 191d | Critical |
| NIAGARA BOTTLING LLC | 13 | 13 | 177d | Critical |
| CANVAS 340 LLC | 8 | 8 | 69d | Critical |
| COLAVITA USA, LLC | 8 | 5 | 10d | Warning |
| HINT INC. | 8 | 8 | 24d | Warning |
| MODERN INFUSIONS LLC | 8 | 8 | 6d | Warning |
| RITUAL BEVERAGE COMPANY | 8 | 8 | 172d | Critical |
| ATERIAN GROUP, INC. | 6 | 6 | 9d | Warning |
| MAIZLY INC. | 6 | 6 | 11d | Warning |
| NIAGARA BOTTLING LLC - RESIN | 4 | 4 | 11d | Warning |
| Natural Rapport (Q & C Products LLC) | 4 | 4 | 62d | Critical |
| RECESS | 4 | 4 | 139d | Critical |
| ZEN BEVERAGE LLC | 4 | 3 | 17d | Warning |
| BOUNDLESS EC US LLC | 3 | 3 | 3d | Warning |
| EMS MIND READER LLC | 3 | 3 | 37d | Critical |

*50 customers total. Tier rule: Critical = >=1 breached ticket older than 30d; Warning = breached <=30d; Healthy = no breaches*

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-09-20T18:47ET-AUTHORITATIVE | 18:47 | **AUTHORITATIVE REFRESH** - fresh TicketOps pull. Gate = 311 (New 241 / Pending 70). 311 - 21 billing/storage/handling - 7 overlapping-thread duplicates = **283 eligible**. Reopen 38 excluded by status name. 22 live `closeFlag=true` rows retained. Outlook unavailable (non-blocking). |
| refresh-2026-09-15T23:45ET-AUTHORITATIVE | 23:45 | Gate = 312 (New 234 / Pending 78); 16 billing + 5 dedup = **291 eligible**. |
| refresh-2026-08-11T05:07ET-AUTHORITATIVE | 05:07 | Fresh TicketOps pull; 48 stale -> 9 verified eligible. |

## 🚨 Data Freshness Notice

**This refresh (Sep 20 2026 18:47 ET) is an AUTHORITATIVE refresh** with a fresh TicketOps pull.
All 311 gate rows (New 241 + Pending 70) were enumerated directly from Ticket Ops department
`UNIS Fulfillment - Northampton` (departmentId 323826714354839552) and re-verified in-session.

**Eligibility gate applied:** `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Pending}`.
`closeFlag` is **not** an eligibility gate - auto-close artifacts cause false negatives, and
22 eligible rows carry `closeFlag=true`.

**Outlook was unavailable this cycle.** Email context is non-blocking; it contributed no threads and
changed no ticket counts. The prior cycle's context is retained under `carriedForward` in
`outlook-context.json` and is explicitly labelled stale.

**Scope note:** the high eligible count is dominated by UFN ticket numbers, which is the intended
`ufnFilterEnabled` scope. A large share of New rows are system-generated series (OMS Alert,
Dropship/Dock Activity reports, VIVO reminders, meeting notices) rather than unique human
conversations; they are retained because the rules define scope by status and UFN numbering, not by
sender type.

**This refresh (Aug 11 05:07 ET) is an AUTHORITATIVE refresh** with a fresh TicketOps LIVE connection. All statuses verified directly against TicketOps. 39 tickets that were previously assumed eligible (based on Aug 10 23:20 ET preserved state) were found to have moved to ineligible statuses (Closed/Resolved/Cancelled) in TicketOps.

**Queue health**: 81% reduction from stale state. Only 9 verified eligible tickets remain. SLA breach rate is now 22% (2/9), which is significantly elevated due to the smaller denominator.

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

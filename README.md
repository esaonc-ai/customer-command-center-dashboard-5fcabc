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

## Current Dashboard State (Last Refresh: Sep 17 2026 21:16 ET – AUTHORITATIVE)

| Metric | Value |
|--------|-------|
| Total Raw (systemStatus=open) | 335 = New 228 + Pending 67 + Reopen 40 |
| Gate matched | 295 (New 228, Pending 67) |
| Eligible | **260** (204 New, 0 Open, 56 Pending) |
| UFN-Count | 260 |
| Excluded | 21 billing/UF Billing/storage/handling + 14 overlapping-thread duplicates; Reopen 40 outside gate |
| closeFlag | **NOT a gate** — 19 live `closeFlag=true` tickets retained |
| Customers | **49** distinct orgs (all customers visible in eligible tickets; roster supplemental) |
| SLA Risk | **HIGH** – 231 SLA-breached / 29 on-track; 216 unassigned |
| Outlook Coverage | 7 direct eligible matches (~2.7%) from 60 matched threads / 53 unique post-dedup; 3 active escalations — **carried forward, Outlook unavailable this cycle** |
| Last Refresh | 2026-09-17 21:16 ET (**AUTHORITATIVE** – fresh TicketOps pull, 295 gate rows → 260 eligible) |
| Next Refresh | 2026-09-18T08:00:00-04:00 (daily summary email) |

> **Premise correction (repeated):** the instruction cites UFN-67030 as "live-Pending with closeFlag=true". Ticket Ops is
> authoritative and shows UFN-67030 = `displayStatusName=Solved`, `displayStatusSystemStatus=20`, `closeFlag=true`,
> staff-closed 2026-09-01. It is excluded **by status**, not by closeFlag. The rule stands: `closeFlag` is not an
> eligibility gate. The tickets that exercise that rule are the 19 live `closeFlag=true`
> New/Pending rows retained in this snapshot.
>
> **Queue note:** this facility's display-status vocabulary contains **no `Open` row** — the New/Open/Pending union
> collapses to New + Pending. `flag=recurring` marks automated notification series (104 of
> 260 rows); they are included per the literal status rule and can be filtered by the dashboard.

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Other customer service / ops** | **45** | e.g. UFN-71093, UFN-71078, UFN-71067, UFN-71064, UFN-71031, UFN-70992 |
| **Automated report / notification series** | **104** | e.g. UFN-71068, UFN-71065, UFN-71055, UFN-71054, UFN-71053, UFN-71040 |
| **Appointment / carrier pickup requests** | **29** | e.g. UFN-71079, UFN-71072, UFN-71030, UFN-70984, UFN-70731, UFN-70596 |
| **Facility move-out / transfer** | **17** | e.g. UFN-70918, UFN-70825, UFN-70821, UFN-70800, UFN-70792, UFN-70576 |
| **Order commit-blocked / failed & order-status exceptions** | **52** | e.g. UFN-71085, UFN-71073, UFN-71059, UFN-70949, UFN-70934, UFN-70919 |
| **Claims / damage / returns** | **13** | e.g. UFN-70816, UFN-70513, UFN-69148, UFN-68741, UFN-68573, UFN-68149 |

### Customer Health Detail

Coverage rule: **all customers visible in eligible tickets** (configured roster/aliases supplemental only).
Tier rule: Critical = ≥1 breached ticket older than 30d; Warning = breached ≤30d; Healthy = no breaches.
Tiers: **Critical 27 / Warning 20 / Healthy 2** (of 49 customers).

| Customer | Tier | Eligible tickets | SLA-breached | Oldest breached age (d) |
|----------|------|------------------|--------------|--------------------------|
| LASSONDE PAPPAS AND COMPANY, INC. | Critical | 61 | 59 | 77 |
| Turtle Beach | Critical | 23 | 22 | 196 |
| PRIME TIME PACKAGING LTD | Critical | 16 | 16 | 164 |
| DAYDREAM NUTRITION INC. | Critical | 14 | 14 | 34 |
| SMEG USA INC | Critical | 14 | 14 | 188 |
| Midea America Corp | Critical | 19 | 13 | 48 |
| NIAGARA BOTTLING LLC | Critical | 13 | 13 | 174 |
| RITUAL BEVERAGE COMPANY | Critical | 10 | 8 | 170 |
| CANVAS 340 LLC | Critical | 6 | 6 | 66 |
| CKNAPP SALES INC | Warning | 5 | 5 | 27 |
| HINT INC. | Warning | 5 | 4 | 21 |
| Natural Rapport (Q & C Products LLC) | Critical | 4 | 4 | 59 |
| NIAGARA BOTTLING LLC - RESIN | Warning | 5 | 3 | 8 |
| EMS MIND READER LLC | Critical | 3 | 3 | 34 |
| GOLDEN BULL MARKETING | Critical | 3 | 3 | 80 |
| RECESS | Critical | 3 | 3 | 136 |
| THE ANDERSONS, INC. | Critical | 3 | 3 | 71 |
| COLAVITA USA, LLC | Warning | 7 | 2 | 7 |
| ATERIAN GROUP, INC. | Warning | 3 | 2 | 17 |
| DELMAR INTERNATIONAL INC | Warning | 2 | 2 | 7 |
| HISENSE USA CORPORATION | Critical | 2 | 2 | 44 |
| INNOVA SOFTGEL LLC DBA KD NUTRA | Warning | 2 | 2 | 3 |
| KARAKA, LLC | Warning | 2 | 2 | 9 |
| SPLENDOR WATER LLC | Warning | 2 | 2 | 20 |
| UPTIME ENERGY INC | Critical | 2 | 2 | 50 |

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-09-17T21:16ET-AUTHORITATIVE | 21:16 | **AUTHORITATIVE REFRESH** – Fresh TicketOps LIVE pull: gate (systemStatus=open, name in {New,Pending}) = 295 (New 228 / Pending 67); −21 billing/storage/handling −14 overlapping-thread duplicates = **260 eligible** (204 New / 56 Pending). Reopen 40 excluded by status. No `Open` display status exists in this queue (Open bucket 0). closeFlag still NOT a gate – 19 live closeFlag=true rows retained. 49 customers, 231 SLA-breached, 216 unassigned, oldest 196d (UFN-33722/UFN-33604). Outlook unavailable this cycle – Outlook context carried forward stale. Premise correction repeated: UFN-67030 = Solved/systemStatus 20 (closed 2026-09-01), excluded by status not closeFlag. |
| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-08-11T05:07ET-AUTHORITATIVE | 05:07 | **AUTHORITATIVE REFRESH** – Fresh TicketOps LIVE connection. 48 stale → **9 verified eligible** (81% reduction). 39 tickets resolved/closed during ~8h gap. UFN-65881 (Hint Inc.) resolved. UFN-64607: 243h/10d. UFN-64782: 182h/7d. All 9 Unassigned. 5/9 Outlook matches (56%). Watch bucket cleared to 0. All public/data synced. |
| refresh-2026-08-11T05:03ET-FRESHNESS | 05:03 | FRESHNESS REFRESH – Ages recalculated (+1h43m since 03:20 ET). Data preserved from authoritative baseline. |
| refresh-2026-08-11T03:20ET-AUTHORITATIVE | 03:20 | AUTHORITATIVE REFRESH – Fresh TicketOps LIVE connection. 48 stale → 9 verified. 39 resolved/closed. |
| refresh-2026-08-11T03:15ET-FRESHNESS | 03:15 | FRESHNESS REFRESH – Ages recalculated. UFN-64607 crossed 10-day threshold. |
| refresh-2026-08-10T23:20ET | 23:20 | LIVE FULL REFRESH – Reconnected to TicketOps API and Outlook. 5 → 48 tickets. |
| refresh-2026-08-10T23:10ET | 23:10 | FULL LIVE REFRESH – Fresh TicketOps. 1 → 5 eligible. Discovered UFN-64607, UFN-65779. |
| refresh-2026-08-09T21:30ET | 21:30 | ACTION BUCKET CORRECTION – All 3 tickets incorrectly Immediate. |
| refresh-2026-08-09T20:43ET | 20:43 | SWEEP CORRECTION – UFN-65592 re-verified (closeFlag=false). |
| refresh-2026-08-09T19:30ET | 19:30 | CORRECTED – UFN-64843/UFN-64544 excluded (closeFlag=true). |
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

### Priority Queue

| # | Ticket | Customer | Subject | Age | SLA |
|---|--------|----------|---------|-----|-----|
| 1 | UFN-33722 | ZEN BEVERAGE | 12x9x12 Boxes Needed | 196d / 4704h | Breached |
| 2 | UFN-33604 | Turtle Beach | Pending/Overdue Tickets | 196d / 4704h | Breached |
| 3 | UFN-35588 | ATERIAN INC | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: VY8-M2X5 AT | 189d / 4536h | Breached |
| 4 | UFN-35774 | SMEG USA INC | Committ failed | 188d / 4512h | Breached |
| 5 | UFN-37858 | WYNK BEVERAGE - Reverse | welcome, spring newsletter | 180d / 4320h | Breached |
| 6 | UFN-39065 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 176d / 4224h | Breached |
| 7 | UFN-39403 | SMEG USA INC | Reminder following up! | 175d / 4200h | Breached |
| 8 | UFN-39662 | NIAGARA BOTTLING LLC | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN | 174d / 4176h | Breached |
| 9 | UFN-40213 | NIAGARA BOTTLING LLC | Re: QUANTIX SCHEDULE - 3/28 & 3/30 | 171d / 4104h | Breached |
| 10 | UFN-40670 | RITUAL BEVERAGE COMPANY | March F26 Month End Close Reminder | 170d / 4080h | Breached |
| 11 | UFN-40654 | NIAGARA BOTTLING LLC | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 | 170d / 4080h | Breached |
| 12 | UFN-40969 | SMEG USA INC | Schedule Appointment-Pickup(1) - BOL# 33604304 | 169d / 4056h | Breached |
| 13 | UFN-40860 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 169d / 4056h | Breached |
| 14 | UFN-42031 | THE LUCKY OX LLC | FW: Santa LAST EOD 1/9 | 164d / 3936h | Breached |
| 15 | UFN-41878 | PRIME TIME PACKAGING LTD | Drayage Assignments | 164d / 3936h | Breached |

## 🚨 Data Freshness Notice

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

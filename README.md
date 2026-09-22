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

## Current Dashboard State (Last Refresh: Sep 22 2026 04:17 ET – AUTHORITATIVE)

| Metric | Value |
|--------|-------|
| Department total (all statuses) | 71,359 |
| Open system-status rows | 333 = New 232 + Pending 65 + Reopen 36 |
| Gate matched | **297** (New 232, Pending 65) |
| Eligible | **268** (208 New, 0 Open, 60 Pending) |
| Excluded | 21 billing/UF Billing/storage/handling/invoice items + 8 overlapping same-issue duplicates; Reopen 36 outside gate |
| closeFlag | **NOT a gate** — 23 live `closeFlag=true` rows retained |
| Customers | **54** distinct orgs (all customers visible in eligible tickets; roster supplemental) |
| Customer Health tiers | Critical 28 / Warning 14 / Healthy 12 |
| SLA Risk | **HIGH** – 231 SLA-breached / 37 on-track; 217 unassigned |
| Oldest ticket | 200 days |
| Outlook Coverage | **STALE** – no fresh Outlook pull this cycle; 2 direct refs carried forward from the 2026-09-15 window (~0.7%) |
| Last Refresh | 2026-09-22 04:17 ET (**AUTHORITATIVE** – fresh TicketOps pull, 297/297 rows enumerated over 3 pages) |
| Next Refresh | ~08:00 ET (daily summary email) |

> **Eligibility gate applied:** `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Pending}`. `closeFlag` is **not** a gate. Note there is **no "Open" display status** in this department — the third open-system-status state is **Reopen (36)**, which the rules exclude.
>
> **Premise note (recurring):** the instruction again cited UFN-67030 as "live-Pending with closeFlag=true". Ticket Ops is authoritative and shows UFN-67030 = `displayStatusName=Solved`, `displayStatusSystemStatus=20`, staff-closed 2026-09-01. It is excluded **by status**, not by `closeFlag`. The rule stands.

### Evidence Metrics

| Metric | Value |
|--------|-------|
| Total eligible | 268 |
| SLA breached / on-track | 231 / 37 |
| Unassigned | 217 |
| Aging 15d+ | 174 |
| Pending + SLA breached | 54 |
| Billing items excluded | 21 |
| Reopen excluded | 36 |
| Overlap duplicates removed | 8 |
| closeFlag=true retained | 23 |

### Action Buckets

| Bucket | Count | Examples |
|--------|-------|----------|
| **Other customer service / ops** | 107 | UFN-33722, UFN-37858, UFN-39403, UFN-39662, UFN-40654, UFN-41878 |
| **Automated report / notification series** | 94 | UFN-39065, UFN-40860, UFN-42645, UFN-44321, UFN-45763, UFN-47190 |
| **Appointment / carrier pickup requests** | 24 | UFN-35588, UFN-40213, UFN-40969, UFN-46639, UFN-47786, UFN-51184 |
| **Facility move-out / transfer** | 18 | UFN-64739, UFN-70161, UFN-70404, UFN-70572, UFN-70573, UFN-70732 |
| **Order commit-blocked / failed & order-status exceptions** | 12 | UFN-33604, UFN-35774, UFN-63212, UFN-64099, UFN-66004, UFN-68029 |
| **Claims / damage / returns** | 13 | UFN-46564, UFN-59238, UFN-59296, UFN-59777, UFN-61390, UFN-64031 |

### Customer Health (top 12 by breached volume)

| Customer | Tickets | Breached | Oldest breached | Tier |
|----------|---------|----------|-----------------|------|
| LASSONDE PAPPAS AND COMPANY, INC. | 64 | 62 | 81d | Critical |
| Turtle Beach | 23 | 23 | 200d | Critical |
| DAYDREAM NUTRITION INC. | 17 | 17 | 39d | Critical |
| PRIME TIME PACKAGING LTD | 16 | 16 | 169d | Critical |
| SMEG USA INC | 14 | 14 | 192d | Critical |
| NIAGARA BOTTLING LLC | 13 | 13 | 178d | Critical |
| Midea America Corp | 13 | 12 | 52d | Critical |
| ATERIAN GROUP, INC. | 10 | 8 | 21d | Warning |
| CANVAS 340 LLC | 8 | 7 | 70d | Critical |
| RITUAL BEVERAGE COMPANY | 6 | 6 | 161d | Critical |
| HINT INC. | 9 | 5 | 25d | Warning |
| Natural Rapport (Q & C Products LLC) | 5 | 4 | 63d | Critical |

### Priority Queue (top 10 by age)

| Rank | Ticket | Customer | Subject | Age | SLA | Owner |
|------|--------|----------|---------|-----|-----|-------|
| 1 | UFN-33604 | Turtle Beach | Pending/Overdue Tickets | 200d / 4814h | Breached | unassigned |
| 2 | UFN-33722 | ZEN BEVERAGE | 12x9x12 Boxes Needed | 200d / 4808h | Breached | unassigned |
| 3 | UFN-35588 | ATERIAN INC | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: VY8-M2X5 AT | 193d / 4639h | Breached | unassigned |
| 4 | UFN-35774 | SMEG USA INC | Commit Block Order - DN-1467983 | 192d / 4620h | Breached | Sittie Jhaila Sirad |
| 5 | UFN-37858 | WYNK BEVERAGE - Reverse | welcome, spring 🌷🍋🪴🍓 | 184d / 4426h | Breached | unassigned |
| 6 | UFN-39065 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 180d / 4334h | Breached | unassigned |
| 7 | UFN-39403 | SMEG USA INC | Reminder following up! | 179d / 4307h | Breached | unassigned |
| 8 | UFN-39662 | NIAGARA BOTTLING LLC | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN | 178d / 4283h | Breached | unassigned |
| 9 | UFN-40213 | NIAGARA BOTTLING LLC | Re: QUANTIX SCHEDULE - 3/28 & 3/30 | 176d / 4239h | Breached | unassigned |
| 10 | UFN-40654 | NIAGARA BOTTLING LLC | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 | 174d / 4184h | Breached | unassigned |

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-09-22T04:17ET-AUTHORITATIVE | 04:17 | **AUTHORITATIVE REFRESH** – Fresh TicketOps pull: gate 297 (New 232/Pending 65) → **268 eligible** after 21 billing/storage/handling/invoice exclusions and 8 overlap duplicates. closeFlag still not a gate (23 retained). Reopen 36 excluded. Outlook pull unavailable (non-blocking) – carried forward and labelled stale. |
| refresh-2026-09-15T23:45ET-AUTHORITATIVE | 23:45 | Gate 312 → 291 eligible. 16 billing + 5 duplicates excluded. |
| refresh-2026-09-15T12:36ET-AUTHORITATIVE | 12:36 | Gate 312 → 286 eligible 🄯 — superseded same day. |

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

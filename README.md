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
| **closeFlag Verification** | **REQUIRED** – closeFlag=false regardless of displayStatus (strengthened rule) |

## Customer Health

Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.

## Dashboard Sections

1. **Counts** – Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** – Sorted by priority & age
3. **Action Buckets** – Immediate (<24h), Short-Term (1–3d), Medium (3–7d), Watch (>7d)
4. **Customer Health** – Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** – Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness

## Current Dashboard State (Last Refresh: Aug 11 05:07 ET – AUTHORITATIVE)

| Metric | Value |
|--------|-------|
| Total Raw | 572 |
| Eligible | **9** (8 New, 0 Open, 1 Pending) |
| UFN-Count | 9 |
| Excluded | 563 (479 status, 8 invoice items, 0 closeFlag, 76 reopen/other) |
| Customers | **9** – 2 At Risk: NATURAL RAPPORT, DAYDREAM NUTRITION INC.; 7 Healthy |
| SLA Risk | **ELEVATED** – 2 of 9 eligible tickets SLA BREACHED (22%); 7 On-Track |
| Outlook Coverage | 56% direct (5/9); rich facility-level operational context |
| Last Refresh | 2026-08-11 05:07 ET (**AUTHORITATIVE** – fresh TicketOps LIVE connection verified actual statuses) |
| Next Refresh | ~08:00 ET (daily summary) |

### ⏱ Queue Delta: 48 → 9 (−81%)

**39 tickets verified resolved/closed in TicketOps** during the ~8-hour gap between the Aug 10 23:20 ET LIVE connection and this authoritative refresh. UFN-65881 (Hint Inc., 11 DNs Release) confirmed resolved. All ~38 previously truncated tickets verified non-eligible. **Only 9 verified eligible tickets remain.**

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

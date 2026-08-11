# Customer Command Center Dashboard — NHT/Cesanek

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
| **UFN Filtering** | Enabled — UFN-tagged tickets surfaced in all views |
| **Deduplication** | Overlapping ticket/email threads merged |
| **Outlook Context** | Non-blocking enrichment where available |
| **Authority** | TicketOps status is authoritative |
| **closeFlag Verification** | **REQUIRED** — closeFlag=false regardless of displayStatus (strengthened rule) |

## Customer Health

Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.

## Dashboard Sections

1. **Counts** — Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** — Sorted by priority & age
3. **Action Buckets** — Immediate (<24h), Short-Term (1–3d), Medium (3–7d), Watch (>7d)
4. **Customer Health** — Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** — Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness

## Current Dashboard State (Last Refresh: Aug 11 00:11 ET)

| Metric | Value |
|--------|-------|
| Total Raw | 572 |
| Eligible | **48** (33 New, 0 Open, 15 Pending) |
| UFN-Count | 48 |
| Excluded | 524 (440 status, 8 invoice items, 0 closeFlag, 76 reopen/other) |
| Customers | **27** — 2 At Risk: NATURAL RAPPORT, DAYDREAM NUTRITION INC.; 25 Healthy |
| SLA Risk | **ELEVATED** — 2 of 48 eligible tickets SLA BREACHED (4%); 46 On-Track |
| Outlook Coverage | 10% direct (5/48); rich facility-level operational context for all |
| Last Refresh | 2026-08-11 00:11 ET (freshness refresh; TicketOps data preserved from Aug 10 23:20 ET verified state) |
| Next Refresh | ~08:00 ET (daily summary) |

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | **2** | UFN-64607: Natural Rapport — RN-19411/RN-19412, SLA BREACHED, 9d old (~239h); UFN-64782: DAYDREAM NUTRITION — Transfer RN-19417, SLA BREACHED, 7d old (~177h), staff replied 08/10 |
| **Short-Term** | **4** | UFN-65035: Niagara Bottling — Missed Pickup (14h); UFN-65043: COLAVITA USA/O Olive Oil — TO5020 Edison Transfer Urgent (13h); UFN-65779: COLAVITA USA — TO Status (10h), active Outlook thread with Kyle Wittenbauer; UFN-65876: Vita Coco DTC — URGENT DN-5002110 (4h) |
| **Medium** | **5** | Includes UFN-65877: UNIS Internal/Erin — Missed Pickups (4h); UFN-65881: Hint Inc. — 11 DNs Release (3h); UFN-65857: Ritual Beverage — ABF BOL (5h); UFN-65895: Nourison — Devanned Containers (3h) |
| **Watch** | **37** | Remaining eligible tickets; ~50+ truncated from full result set |

> **NOTE**: Action bucket distribution preserved from Aug 10 23:20 ET full live refresh. Ages updated: UFN-64607 ~239h (was 238h), UFN-64782 ~177h (was 176h). Remaining named tickets +0–1h each.

### Customer Health Detail

| Customer | Tickets | Oldest | SLA | Health |
|----------|---------|--------|-----|--------|
| NATURAL RAPPORT | 1 | 9 days | BREACHED | At Risk |
| DAYDREAM NUTRITION INC. | 1 | 7 days | BREACHED | At Risk |
| COLAVITA USA, LLC | 1 | 10 hours | On Track | Healthy |
| COLAVITA USA/O Olive Oil | 1 | 13 hours | On Track | Healthy |
| Niagara Bottling | 1 | 14 hours | On Track | Healthy |
| Vita Coco DTC | 1 | 4 hours | On Track | Healthy |
| Hint Inc. | 1 | 3 hours | On Track | Healthy |
| Ritual Beverage | 1 | 5 hours | On Track | Healthy |
| Nourison | 1 | 3 hours | On Track | Healthy |
| UNIS Internal (Tweety/Erin) | 1 | 4 hours | On Track | Healthy |
| SPLENDOR WATER LLC | 0 | — | — | Healthy |
| DUPRAY USA LLC | 0 | — | — | Healthy |
| INNOVA/SOFTGEL/KD NUTRA | 0 | — | — | Healthy |
| SMEG USA | 0 | — | — | Healthy |
| RITUAL BEVERAGE | 0 | — | — | Healthy |
| NIAGARA BOTTLING | 0 | — | — | Healthy |
| ZEN BEVERAGE | 0 | — | — | Healthy |
| EMS MIND READER/BETESH | 0 | — | — | Healthy |
| NOURISSON | 0 | — | — | Healthy |
| GOLDEN BULL MARKETING | 0 | — | — | Healthy |

*Note: UFN-65882 is UNIS Internal (Tweety Leigh Lamoste) — not customer-facing. 27 unique customers across all 48 eligible tickets.*

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-08-11T00:11ET | 00:11 | **FRESHNESS REFRESH** — Ages recalculated for +51m elapsed. UFN-64607: 239h (was 238h), UFN-64782: 177h (was 176h). TicketOps data preserved from Aug 10 23:20 ET verified state. No live TicketOps connection. All public/data synced. |
| refresh-2026-08-10T23:20ET | 23:20 | **LIVE FULL REFRESH** — Reconnected to TicketOps API and Outlook. Ticket count surged from 5 (stale) → 48 (live). 5 direct Outlook matches (was 1). 27 unique customers (was 15). All 48 Unassigned. |
| refresh-2026-08-10T23:15ET | 23:15 | **FRESHNESS REFRESH** — Ages recalculated for +5min elapsed. TicketOps data preserved from Aug 10 23:04 ET verified state. UFN-64607: 237h (was 213h), UFN-64782: 176h (was 175h). No live TicketOps connection this refresh. |
| refresh-2026-08-10T23:10ET | 23:10 | **FULL LIVE REFRESH** — Fresh TicketOps connection Aug 10 23:04 ET. Expanded search beyond 'Cesanek' keyword to catch RN-/TO-titled tickets. 5 eligible (up from 1 stale). Discovered UFN-64607 (Natural Rapport, 9d, SLA BREACHED) and UFN-65779 (COLAVITA, TO Status). 2 new: UFN-65878 (CODA) and UFN-65882 (UNIS Internal). 2 SLA-breached (40%). All 5 Unassigned. Queue: 1→5 (+400%). |
| refresh-2026-08-10T05:53ET | 05:53 | **FRESHNESS REFRESH** — Ages updated for time elapsed. TicketOps data preserved from Aug 9 21:30 ET verified state. No live connection available. Public/data synced from verified dashboard/data. |
| refresh-2026-08-10T05:14ET | 05:14 | **FRESHNESS REFRESH** — Ages updated. Public/data zero-state (Aug 10 00:20 ET) REVERTED — was inconsistent with verified dashboard/data. |
| refresh-2026-08-09T21:30ET | 21:30 | **ACTION BUCKET CORRECTION** — All 3 tickets were incorrectly shown as Immediate. Corrected: Watch=2, Medium=1, Short-Term=0, Immediate=0. TicketOps data stable, no status changes. |
| refresh-2026-08-09T20:43ET | 20:43 | **SWEEP CORRECTION** — UFN-65592 re-verified (closeFlag=false). Had been incorrectly listed as closed in all prior refreshes. 3 eligible now. |
| refresh-2026-08-09T20:39ET | 20:39 | Confirmed stable — no changes from 19:30 ET. |
| refresh-2026-08-09T19:30ET | 19:30 | **CORRECTED** — UFN-64843/UFN-64544 excluded (closeFlag=true). Replaced with UFN-64870/UFN-64221. closeFlag rule strengthened. |
| refresh-2026-08-09T12:06ET | 12:06 | **CORRECTED** — Prior ZERO-STATE superseded. 2 eligible Pending tickets found via direct ID cross-check. |

### Priority Queue

| Rank | Ticket | Customer | Reason | Action |
|------|--------|----------|--------|--------|
| 1 | UFN-64607 | NATURAL RAPPORT | Oldest active (9 days, ~239h); SLA BREACHED; RN-19411 & RN-19412 — two open RNs; no visible activity. | Assign immediately; verify RN status in WISE; contact Jessi at Natural Rapport |
| 2 | UFN-64782 | DAYDREAM NUTRITION INC. | SLA BREACHED (7 days, ~177h); Transfer RN-19417; staff replied 08/10 but unresolved. | Assign immediately; verify RN-19417 transfer; contact randy@yourdaydream.com |
| 3 | UFN-65035 | Niagara Bottling | Missed pickup PIT-0811-DUYTAN + load cancellations. 14h old. | Assign; review missed pickup schedule; coordinate ops |
| 4 | UFN-65043 | COLAVITA USA/O Olive Oil | TO5020 Edison Transfer — Urgent. Paolo Colavita following up. No delivery date. 13h old. | Assign immediately; escalate TO5020/TO5022 transfer |
| 5 | UFN-65779 | COLAVITA USA | Active Outlook thread with Kyle Wittenbauer — TO Status inquiry. 10h old. | Assign; respond leveraging active thread with Maria Mateo |
| 6 | UFN-65857 | Ritual Beverage | ABF BOL Request. Nina Weiss (ABF) on thread. 5h old. | Assign; process BOL request |
| 7 | UFN-65876 | Vita Coco DTC | URGENT DN-5002110. 4h old. | Assign immediately; verify DN status |
| 8 | UFN-65877 | UNIS Internal (Erin Cambra) | Erin EOD — Missed Pickups for PE/Niagara, Rise, Smeg. CKNAPP 3 DNs COMMIT FAILED. 4h old. | Review missed pickups; investigate CKNAPP commit failure |
| 9 | UFN-65881 | Hint Inc. | 11 DNs Release Requested. 3h old. | Assign; coordinate release |
| 10 | UFN-65895 | Nourison | Containers Devanned TRKU4487366. Ready for pickup. 3h old. | Assign; schedule pickup |

## ⚠️ Data Freshness Notice

**This refresh (Aug 11 00:11 ET) is a freshness-only update.** The GitHub Specialist agent does not have direct access to TicketOps or Outlook APIs. Ticket statuses are preserved from the last verified TicketOps state (Aug 10 23:20 ET, confirmed via LIVE full refresh). Ages have been recalculated to current time. A live TicketOps connection is recommended for authoritative status verification.

**Previous discrepancy resolved (05:14 ET)**: The `public/data/` directory previously showed a zero-state (0 eligible, Aug 10 00:20 ET) claiming all 3 tickets resolved overnight. This was inconsistent with the authoritative `dashboard/data/` state and has been reverted. Root cause of the zero-state discrepancy is unknown — may indicate an automated sweep that incorrectly treated the tickets as resolved. No recurrence observed in subsequent refreshes.

**Search methodology gap closed (23:10 ET)**: Prior 'Cesanek'-keyword-only searches systematically missed tickets without facility keywords in the title (e.g., UFN-64607 with "RN-" title, UFN-65779 with "TO Status" title). Expanded search methodology now captures all UNIS Fulfillment - Northampton department tickets regardless of title keywords.

## Data Files

- `config.json` — Dashboard configuration & filter rules
- `dashboard/data/tickets.json` — Current eligible ticket data (TicketOps source)
- `dashboard/data/outlook-context.json` — Outlook email thread context (non-blocking)
- `dashboard/data/refresh-manifest.json` — Complete refresh audit with rules applied and evidence metrics
- `public/data/tickets.json` — Public-facing tickets (synced)
- `public/data/structured_list.json` — Public-facing structured dashboard data
- `public/data/outlook-context.json` — Public-facing Outlook context (synced)
- `public/data/refresh-manifest.json` — Public-facing refresh summary

## Refresh

Dashboard auto-refreshes every 15 minutes. See `dashboard/data/refresh-manifest.json` for the full audit trail of the most recent refresh.

## Repository

- **Owner**: nweber00
- **Repo**: customer-command-center-dashboard-5fcabc
- **URL**: https://github.com/nweber00/customer-command-center-dashboard-5fcabc

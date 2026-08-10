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

## Current Dashboard State (Last Refresh: Aug 10 05:53 ET)

| Metric | Value |
|--------|-------|
| Total Raw | 567 |
| Eligible | **3** (0 New, 0 Open, 3 Pending) |
| UFN-Count | 3 |
| Excluded | 564 (558 status, 4 invoice items, 2 closeFlag) |
| Customers | **11** — 2 At Risk: SPLENDOR WATER LLC, DUPRY USA LLC; 9 Healthy |
| SLA Risk | **ELEVATED** — 2 of 3 eligible tickets SLA BREACHED; 1 On-Track |
| Outlook Coverage | 33% direct (1/3); 100% partial operational context |
| Last Refresh | 2026-08-10 05:53 ET (freshness refresh; TicketOps data preserved from Aug 9 21:30 ET verified state) |
| Next Refresh | ~06:08 ET |

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | **0** | — |
| **Short-Term** | **0** | — |
| **Medium** | **1** | UFN-65592 (Tweety Lamoste — Monday 08/10 Inbounds, 25 appointments, ~78h, On-Track, due Aug 12) |
| **Watch** | **2** | UFN-64221 (DUPRY Greensboro rework, SLA BREACHED 12d, ~294h, Yang-Lhing out — backup Kent Joseph Lim) + UFN-64870 (SPLENDOR WATER OS&D, SLA BREACHED 7d, ~174h, Kent Claud Caballero) |

> **NOTE**: Action bucket distribution unchanged from Aug 9 21:30 ET correction. Ages updated: UFN-64221 ~294h, UFN-64870 ~174h, UFN-65592 ~78h.

### Customer Health Detail

| Customer | Tickets | Oldest | SLA | Health |
|-----------|---------|--------|-----|--------|
| DUPRY USA LLC | 1 | 12 days | BREACHED | At Risk |
| SPLENDOR WATER LLC | 1 | 7 days | BREACHED | At Risk |
| INNOVA/SOFTGEL/KD NUTRA | 0 | — | — | Healthy |
| SMEG USA | 0 | — | — | Healthy |
| RITUAL BEVERAGE | 0 | — | — | Healthy |
| COLAVITA USA, LLC | 0 | — | — | Healthy |
| NIAGARA BOTTLING | 0 | — | — | Healthy |
| ZEN BEVERAGE | 0 | — | — | Healthy |
| EMS MIND READER/BETESH | 0 | — | — | Healthy |
| NOURISON | 0 | — | — | Healthy |
| GOLDEN BULL MARKETING | 0 | — | — | Healthy |

*Note: UFN-65592 is UNIS Internal (Tweety Leigh Lamoste) — not customer-facing.*

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-08-10T05:53ET | 05:53 | **FRESHNESS REFRESH** — Ages updated for time elapsed. TicketOps data preserved from Aug 9 21:30 ET verified state. No live connection available. Public/data synced from verified dashboard/data. |
| refresh-2026-08-10T05:14ET | 05:14 | **FRESHNESS REFRESH** — Ages updated for time elapsed. TicketOps data preserved from Aug 9 21:30 ET verified state. No live connection available. Public/data zero-state (Aug 10 00:20 ET) REVERTED — was inconsistent with verified dashboard/data. |
| refresh-2026-08-09T21:30ET | 21:30 | **ACTION BUCKET CORRECTION** — All 3 tickets were incorrectly shown as Immediate. Corrected: Watch=2, Medium=1, Short-Term=0, Immediate=0. TicketOps data stable, no status changes. |
| refresh-2026-08-09T20:43ET | 20:43 | **SWEEP CORRECTION** — UFN-65592 re-verified (closeFlag=false). Had been incorrectly listed as closed in all prior refreshes. 3 eligible now. |
| refresh-2026-08-09T20:39ET | 20:39 | Confirmed stable — no changes from 19:30 ET. |
| refresh-2026-08-09T19:30ET | 19:30 | **CORRECTED** — UFN-64843/UFN-64544 excluded (closeFlag=true). Replaced with UFN-64870/UFN-64221. closeFlag rule strengthened. |
| refresh-2026-08-09T12:06ET | 12:06 | **CORRECTED** — Prior ZERO-STATE superseded. 2 eligible Pending tickets found via direct ID cross-check. |

### Priority Queue

| Rank | Ticket | Customer | Reason | Action |
|------|--------|----------|--------|--------|
| 1 | UFN-64221 | DUPRY USA LLC | Oldest active (12 days); SLA BREACHED; Greensboro rework | Verify Yang-Lhing coverage (backup: Kent Joseph Lim) |
| 2 | UFN-64870 | SPLENDOR WATER LLC | OS&D-RN-19245; SLA BREACHED (7 days) | Confirm resolution with Kent Claud Caballero |
| 3 | UFN-65592 | Tweety Leigh Lamoste (UNIS Internal) | Monday 08/10 Inbounds (25 appts); On-Track; due Aug 12 | Verify Monday readiness; assign |

## ⚠️ Data Freshness Notice

**This refresh (Aug 10 05:53 ET) is a freshness-only update.** The GitHub Specialist agent does not have direct access to TicketOps or Outlook APIs. Ticket statuses are preserved from the last verified TicketOps state (Aug 9 21:30 ET, confirmed via direct ID cross-check). Ages have been recalculated to current time. A live TicketOps connection is recommended for authoritative status verification.

**Discrepancy resolved (05:14 ET)**: The `public/data/` directory previously showed a zero-state (0 eligible, Aug 10 00:20 ET) claiming all 3 tickets resolved overnight. This was inconsistent with the authoritative `dashboard/data/` state and has been reverted. Root cause of the zero-state discrepancy is unknown — may indicate an automated sweep that incorrectly treated the tickets as resolved. No recurrence observed in this 05:53 ET refresh.

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

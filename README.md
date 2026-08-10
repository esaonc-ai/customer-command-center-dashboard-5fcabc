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

## Current Dashboard State (Last Refresh: Aug 9 21:30 ET)

| Metric | Value |
|--------|-------|
| Total Raw | 567 |
| Eligible | **3** (0 New, 0 Open, 3 Pending) |
| UFN-Count | 3 |
| Excluded | 564 (558 status, 4 invoice items, 2 closeFlag) |
| Customers | **11** — 2 At Risk: SPLENDOR WATER LLC, DUPRAY USA LLC; 9 Healthy |
| SLA Risk | **ELEVATED** — 2 of 3 eligible tickets SLA BREACHED; 1 On-Track |
| Outlook Coverage | 33% direct (1/3); 100% partial operational context |
| Last Refresh | 2026-08-09 21:30 ET (action bucket correction; TicketOps data stable since 20:43 ET sweep) |
| Next Refresh | ~21:45 ET |

### Action Buckets — CORRECTED

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | **0** | — |
| **Short-Term** | **0** | — |
| **Medium** | **1** | UFN-65592 (Tweety Lamoste — Monday 08/10 Inbounds, 25 appointments, ~73h, On-Track, due Aug 12) |
| **Watch** | **2** | UFN-64221 (DUPRAY Greensboro rework, SLA BREACHED 11d, ~289h, Yang-Lhing out — backup Kent Joseph Lim) + UFN-64870 (SPLENDOR WATER OS&D, SLA BREACHED 6d, ~169h, Kent Claud Caballero) |

> **CORRECTION**: All prior refreshes incorrectly showed all 3 tickets in Immediate. The dashboard.js code correctly calculates buckets by hours since creation. UFN-64221 (289h) and UFN-64870 (169h) are Watch; UFN-65592 (73h) is Medium. Corrected at 21:30 ET.

### Customer Health Detail

| Customer | Tickets | Oldest | SLA | Health |
|----------|---------|--------|-----|--------|
| DUPRAY USA LLC | 1 | 11 days | BREACHED | At Risk |
| SPLENDOR WATER LLC | 1 | 6 days | BREACHED | At Risk |
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
| refresh-2026-08-09T21:30ET | 21:30 | **ACTION BUCKET CORRECTION** — All 3 tickets were incorrectly shown as Immediate. Corrected: Watch=2, Medium=1, Short-Term=0, Immediate=0. TicketOps data stable, no status changes. |
| refresh-2026-08-09T20:43ET | 20:43 | **SWEEP CORRECTION** — UFN-65592 re-verified (closeFlag=false). Had been incorrectly listed as closed in all prior refreshes. 3 eligible now. |
| refresh-2026-08-09T20:39ET | 20:39 | Confirmed stable — no changes from 19:30 ET. |
| refresh-2026-08-09T19:30ET | 19:30 | **CORRECTED** — UFN-64843/UFN-64544 excluded (closeFlag=true). Replaced with UFN-64870/UFN-64221. closeFlag rule strengthened. |
| refresh-2026-08-09T12:06ET | 12:06 | **CORRECTED** — Prior ZERO-STATE superseded. 2 eligible Pending tickets found via direct ID cross-check. |
| refresh-2026-08-09T12:04ET | 12:04 | ZERO-STATE (invalid — superseded) |

### Priority Queue

| Rank | Ticket | Customer | Reason | Action |
|------|--------|----------|--------|--------|
| 1 | UFN-64221 | DUPRAY USA LLC | Oldest active (11 days); SLA BREACHED; Greensboro rework | Verify Yang-Lhing coverage (backup: Kent Joseph Lim) |
| 2 | UFN-64870 | SPLENDOR WATER LLC | OS&D-RN-19245; SLA BREACHED (6 days) | Confirm resolution with Kent Claud Caballero |
| 3 | UFN-65592 | Tweety Leigh Lamoste (UNIS Internal) | Monday 08/10 Inbounds (25 appts); On-Track; due Aug 12 | Verify Monday readiness; assign |

## Data Files

- `config.json` — Dashboard configuration & filter rules
- `data/tickets.json` — Current eligible ticket data (TicketOps source)
- `data/outlook-context.json` — Outlook email thread context (non-blocking)
- `data/refresh-manifest.json` — Complete refresh audit with rules applied and evidence metrics

## Refresh

Dashboard auto-refreshes every 15 minutes. See `data/refresh-manifest.json` for the full audit trail of the most recent refresh.

## Repository

- **Owner**: nweber00
- **Repo**: customer-command-center-dashboard-5fcabc
- **URL**: https://github.com/nweber00/customer-command-center-dashboard-5fcabc

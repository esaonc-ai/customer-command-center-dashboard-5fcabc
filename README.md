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
| **closeFlag Verification** ⚠️ | **REQUIRED** — closeFlag=false regardless of displayStatus (strengthened rule) |

## Customer Health

Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.

## Dashboard Sections

1. **Counts** — Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** — Sorted by priority & age
3. **Action Buckets** — Immediate (<24h), Short-Term (1–3d), Medium (3–7d), Watch (>7d)
4. **Customer Health** — Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** — Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness

## Current Dashboard State (Last Refresh)

| Metric | Value |
|--------|-------|
| Total Raw | 567 |
| Eligible | **2** (0 New, 0 Open, 2 Pending) |
| UFN-Count | 2 |
| Excluded | 565 (559 status, 4 invoice items, 2 closeFlag) |
| Customers | **11** — 2 At Risk 🔄: SPLENDOR WATER LLC, DUPRAY USA LLC; 9 Healthy ✅ |
| SLA Risk | **CRITICAL** — Both active tickets SLA BREACHED |
| Outlook Coverage | 0% direct; 100% partial operational context (0/2 direct matches) |
| Last Refresh | 2026-08-09 20:39 ET (TicketOps authoritative re-query; confirms 19:30 ET state stable) |
| Next Refresh | ~20:54 ET |

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | 2 | UFN-64221 (DUPRAY Greensboro rework, SLA BREACHED 11d, Yang-Lhing out — backup Kent Joseph Lim) + UFN-64870 (SPLENDOR WATER OS&D, SLA BREACHED 6d, Kent Claud Caballero) |
| **Short-Term** | 0 | — |
| **Medium** | 0 | — |
| **Watch** | 0 | — |

### Customer Health Detail

| Customer | Tickets | Oldest | SLA | Health |
|----------|---------|--------|-----|--------|
| DUPRAY USA LLC | 1 | 11 days | BREACHED | 🔄 At Risk |
| SPLENDOR WATER LLC | 1 | 6 days | BREACHED | 🔄 At Risk |
| INNOVA/SOFTGEL/KD NUTRA | 0 | — | — | ✅ Healthy |
| SMEG USA | 0 | — | — | ✅ Healthy |
| RITUAL BEVERAGE | 0 | — | — | ✅ Healthy |
| COLAVITA USA, LLC | 0 | — | — | ✅ Healthy |
| NIAGARA BOTTLING | 0 | — | — | ✅ Healthy |
| ZEN BEVERAGE | 0 | — | — | ✅ Healthy |
| EMS MIND READER/BETESH | 0 | — | — | ✅ Healthy |
| NOURISON | 0 | — | — | ✅ Healthy |
| GOLDEN BULL MARKETING | 0 | — | — | ✅ Healthy |

### Key Correction History

| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-08-09T20:39ET | 20:39 | **CONFIRMED STABLE** — No changes from 19:30 ET. State verified stable. |
| refresh-2026-08-09T19:30ET | 19:30 | **CORRECTED** — UFN-64843/UFN-64544 excluded (closeFlag=true). Replaced with UFN-64870/UFN-64221. closeFlag rule strengthened. |
| refresh-2026-08-09T12:06ET | 12:06 | **CORRECTED** — Prior ZERO-STATE superseded. 2 eligible Pending tickets found via direct ID cross-check. |
| refresh-2026-08-09T12:04ET | 12:04 | ZERO-STATE (invalid — superseded) |

### Priority Queue

| Rank | Ticket | Customer | Reason | Action |
|------|--------|----------|--------|--------|
| 1 | UFN-64221 | DUPRAY USA LLC | Oldest active (11 days); SLA BREACHED; Greensboro rework; Yang-Lhing out early 8/6 | Verify Yang-Lhing coverage (backup: Kent Joseph Lim) |
| 2 | UFN-64870 | SPLENDOR WATER LLC | OS&D-RN-19245; SLA BREACHED (6 days); created 08/03 | Check OS&D resolution with Kent Claud Caballero |

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

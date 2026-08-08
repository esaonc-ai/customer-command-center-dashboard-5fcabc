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
| Total Raw | 492 |
| Eligible | **3** (3 New, 0 Open, 0 Pending) |
| UFN-Count | 3 |
| Excluded | 489 (485 status, 4 invoice items) |
| Customers | **2** — DAYDREAM NUTRITION INC. ⚠️, Tweety Leigh Lamoste (UNIS Internal) ✅ |
| SLA Risk | **Active** — UFN-64782 breached since Aug 5 |
| Outlook Coverage | 66.7% (2/3 — UFN-64782 has no Outlook context) |
| Last Refresh | 2026-08-08 15:52 ET (TicketOps authoritative re-query) |
| Next Refresh | ~16:07 ET |

### Action Buckets

| Bucket | Count | Details |
|--------|-------|---------|
| **Immediate** | 2 | UFN-64782 (DAYDREAM, SLA-breached, unassigned) + UFN-65578 (open RNs) |
| **Short-Term** | 1 | UFN-65592 (inbounds for 08/10) |
| **Medium** | 0 | — |
| **Watch** | 0 | — |

### Customer Health Detail

| Customer | Tickets | Oldest | SLA | Health |
|----------|---------|--------|-----|--------|
| DAYDREAM NUTRITION INC. | 1 | 5 days | BREACHED | ⚠️ At Risk |
| Tweety Leigh Lamoste (UNIS Internal) | 2 | 1 day | On-Track | ✅ Healthy |

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

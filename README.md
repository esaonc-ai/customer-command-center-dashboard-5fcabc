# Customer Command Center Dashboard — NHT/Cesanek

**Facility**: NHT/Cesanek (LT_F21) | **Tenant**: LT | **Timezone**: America/New_York

Deployed at: [customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard](https://customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard)

## Overview

Real-time operational dashboard for monitoring ticket queues, customer health, and action priorities at the NHT/Cesanek facility.

## Ticket Filtering Rules

| Rule | Implementation |
|------|---------------|
| **Include Statuses** | New, Open, Pending |
| **Exclude Statuses** | Reopen, Reopened, Closed, Resolved, Cancelled, Done |
| **Exclude Invoice Items** | billing, UF Billing, storage, handling |
| **UFN Filtering** | Enabled — UFN-tagged tickets surfaced in all views |
| **Deduplication** | Overlapping ticket/email threads merged |
| **Outlook Context** | Non-blocking enrichment where available |
| **Authority** | Ticket Ops status is authoritative |

## Customer Health

Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.

## Dashboard Sections

1. **Counts** — Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** — Sorted by priority & age
3. **Action Buckets** — Immediate (&lt;24h), Short-Term (1–3d), Medium (3–7d), Watch (&gt;7d)
4. **Customer Health** — Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** — Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness

## Data Files

- `config.json` — Dashboard configuration & filter rules
- `data/tickets.json` — Current eligible ticket data (TicketOps source)
- `data/outlook-context.json` — Outlook email thread context (non-blocking)

## Refresh

Dashboard auto-refreshes every 15 minutes.

## Repository

- **Owner**: nweber00
- **Repo**: customer-command-center-dashboard-5fcabc
- **URL**: https://github.com/nweber00/customer-command-center-dashboard-5fcabc

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

## Current Dashboard State (Last Refresh: Sep 11 10:12 PM ET - AUTHORITATIVE v29)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | **378** (260 New / 66 Pending / 52 Reopen / 0 Open) |
| Eligible | **302** (243 New, 0 Open, 59 Pending) |
| UFN-Count | 302 |
| Excluded | 76 - 52 Reopen (outside New/Open/Pending gate) + 23 billing/UF Billing/storage/handling/service-type/invoice items + 1 overlapping ticket/email thread drop |
| closeFlag | **NOT a gate** - 19 live `closeFlag=true` tickets retained |
| Customers | **68** distinct customers (all ticket-visible customers; roster/aliases supplemental; TicketOps organization names used where present) |
| Priority | 297 Medium / 5 unspecified by TicketOps |
| SLA Risk | **ELEVATED** - 220 SLA-breached / 82 on-track; 254 unassigned |
| Action Buckets | Immediate **42** / Short-Term **56** / Medium-Term **8** / Watch **196** |
| Outlook Coverage | **1 matched eligible ticket thread**, 6 active escalations (1 with an eligible mapped ticket); Outlook remains non-blocking |
| UFN-67030 | **Solved** / `displayStatusSystemStatus=20` / `closeFlag=true` (directly rechecked; outside open eligibility gate) |
| Last Refresh | 2026-09-12T02:12:15Z (**AUTHORITATIVE v29** - fresh TicketOps LIVE pull; dept 323826714354839552; 378 system-open records returned and validated) |
| Next Refresh | Hourly dashboard refresh continues; next daily summary email 2026-09-12T08:00:00-04:00 |

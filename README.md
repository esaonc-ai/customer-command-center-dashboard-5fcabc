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

## Current Dashboard State (Last Refresh: Sep 11 5:41 AM ET - AUTHORITATIVE v28)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | **380** (250 New / 85 Pending / 45 Reopen / 0 Open) |
| Eligible | **306** (228 New, 0 Open, 78 Pending) |
| UFN-Count | 306 |
| Excluded | 74 - 45 Reopen (outside New/Open/Pending gate) + 27 billing/UF Billing/storage/handling invoice items + 2 overlapping ticket/email thread drops |
| closeFlag | **NOT a gate** - 31 live `closeFlag=true` tickets retained |
| Customers | **63** distinct customers (all ticket-visible customers; roster/aliases supplemental; TicketOps organization names used where present) |
| Priority | 306 Medium |
| SLA Risk | **ELEVATED** - 225 SLA-breached / 81 on-track; 248 unassigned |
| Action Buckets | Immediate **43** / Short-Term **46** / Medium-Term **10** / Watch **207** |
| Outlook Coverage | **15 matched ticket threads**, 6 active escalations (4 with eligible tickets); Outlook remains non-blocking |
| UFN-67030 | **Solved** / `displayStatusSystemStatus=20` / `closeFlag=true` (outside open eligibility gate) |
| Last Refresh | 2026-09-11T05:41:57-0400 (**AUTHORITATIVE v28** - fresh TicketOps LIVE pull; dept 323826714354839552; 380 records returned and validated) |
| Next Refresh | Hourly dashboard refresh continues; next daily summary email 2026-09-12T08:00:00-04:00 |
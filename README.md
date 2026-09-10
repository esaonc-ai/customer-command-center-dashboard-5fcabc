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

## Current Dashboard State (Last Refresh: Sep 10 12:46 AM ET – AUTHORITATIVE v27)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | **351** (225 New / 84 Pending / 42 Reopen / 0 Open) |
| Eligible | **283** (206 New, 0 Open, 77 Pending) |
| UFN-Count | 283 |
| Excluded | 68 — 42 Reopen (outside New/Pending gate) + 24 billing/UF Billing/storage/handling invoice items + 2 overlapping ticket/email thread drop(s) |
| closeFlag | **NOT a gate** — 25 live `closeFlag=true` tickets retained (auto-close artifacts; e.g. UFN-70252, UFN-70203, UFN-70123, UFN-69797, UFN-69739, UFN-69723, UFN-69409) |
| Customers | **63** distinct orgs (ticket-visible coverage; roster/aliases supplemental; org names from TicketOps org records) |
| Priority | 283 Medium |
| SLA Risk | **ELEVATED** – 213 SLA-breached / 70 on-track |
| Action Buckets | Immediate **53** / Short-Term **16** / Medium-Term **15** / Watch **199** |
| Outlook Coverage | Delegated inbox nicole.weber@unisco.com scanned (live): **13 matched ticket threads**, 3 active escalations (1 with eligible tickets); shared mailbox nht.cs@unisco.com **403** (non-blocking) |
| Last Refresh | 2026-09-10T00:46:07-0400 (**AUTHORITATIVE v27** – fresh TicketOps LIVE pull; dept 323826714354839552; dept totals re-verified per row: 351 open UFN = 225 New / 84 Pending / 42 Reopen / 0 Open) |
| Next Refresh | Hourly dashboard refresh continues; next daily summary email 2026-09-10T08:00:00-04:00 |

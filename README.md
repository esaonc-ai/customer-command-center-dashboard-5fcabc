# Customer Command Center Dashboard – NHT/Cesanek

**Facility**: NHT/Cesanek (LT_F21) | **Tenant**: LT | **Timezone**: America/New_York

Deployed at: [customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard](https://customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard)

Local dashboard preview: `node server.js` (binds to `0.0.0.0:4173`). The Evidence Guide remains part of the managed Next.js application at `/evidence`.

## Overview

Real-time operational dashboard for monitoring ticket queues, customer health, and action priorities at the NHT/Cesanek facility.

## Ticket Filtering Rules

| Rule | Implementation |
|------|----------------|
| **Include Statuses** | New, Open, Pending |
| **Exclude Statuses** | Reopen, Reopened, Closed, Resolved, Cancelled, Done |
| **Exclude Invoice Items** | billing, UF Billing, storage, handling |
| **UFN Filtering** | Enabled - only UFN-prefixed tickets pass eligibility |
| **Deduplication** | Overlapping ticket/email threads merged |
| **Outlook Context** | Non-blocking enrichment where available |
| **Authority** | TicketOps status is authoritative |
| **Eligibility Gate** | `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Pending}` |
| **closeFlag Gate** | **NOT USED** – closeFlag is not a filter; live `closeFlag=true` tickets are retained (auto-close artifacts cause false negatives) |

## Customer Health

Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.

## Dashboard Sections

1. **Counts** – Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** - Sorted by SLA breach, due date, then age
3. **Action Buckets** – Immediate (<24h), Short-Term (1–3d), Medium (3–7d), Watch (>7d)
4. **Customer Health** – Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** – Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness

## Current Dashboard State (Last Refresh: Sep 12 5:25 AM ET - AUTHORITATIVE v32)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept-gate) | **378** (260 New / 66 Pending / 52 Reopen / 0 Open) |
| Eligible | **297** unique conversations (238 New, 0 Open, 59 Pending) |
| UFN-Count | 297 |
| Excluded | 81 - 52 Reopen + 24 billing/UF Billing/storage/handling/invoice items + 5 confirmed overlapping conversations |
| closeFlag | **NOT a gate** - 19 live `closeFlag=true` tickets retained |
| Customers | **69** distinct customers (all ticket-visible customers; roster/aliases supplemental; Ticket Ops organization names used where present) |
| Priority | 292 Medium / 5 unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - 216 SLA-breached / 81 current; 249 unassigned |
| Action Buckets | Immediate **38** / Short-Term **58** / Medium-Term **9** / Watch **192** |
| Outlook Coverage | **Available this cycle** - 8 current UFN threads retrieved, 1 linked to an eligible ticket (UFN-70261); supplemental only, never counted in ticket totals |
| Last Refresh | 2026-09-12T09:25:21Z (**AUTHORITATIVE v32** - fresh Ticket Ops read; department 323826714354839552; 378 system-open records returned, 326 New+Pending server-verified) |

## Developer Reconciliation Note

The previously published Sep 11 daily summary reported 327 tickets (251 New / 76 Pending). It does not reconcile with the authoritative Ticket Ops result and is not surfaced in the business UI. The refreshed dashboard uses 378 system-open records, applies the authoritative New/Pending gate, and resolves to 297 eligible conversations after the audited exclusions above.

This refresh re-verified the eligible composition rather than carrying it forward blind: the same 326 New+Pending rows, the same 24 billing-family exclusions and the same 5 confirmed conversation overlaps resolve to the same working set, and the recomputed aggregates (238 New / 59 Pending, 216 SLA-breached / 81 current, 249 unassigned, 19 `closeFlag=true` retained, 69 customers) match the live read.

Notes for the next cycle:
- **UFN-67030** is no longer live-Pending. Ticket Ops now returns `displayStatusName = Solved` / `displayStatusSystemStatus = 20`, so it fails the gate on system status - not on `closeFlag`. The `closeFlag` rule is unchanged.
- **Two additional identity-backed overlaps** were surfaced in this read but were not auto-collapsed, because they fall outside the previously confirmed 5-row dedup set: UFN-59238 / UFN-59777 (order 112-4505161-2497057) and UFN-48670 / UFN-48777 (shipment YMJAE490405029_015445_01_US-PA-30001253). They are recorded in `refresh-manifest.json` under `exclusions.additionalCandidateOverlaps`; confirming them would move the working set from 297 to 295.
- Outlook context is now available and is recorded in `outlook-context.json` as supplemental only. Seven of the eight retrieved threads reference tickets already closed/Solved in Ticket Ops.

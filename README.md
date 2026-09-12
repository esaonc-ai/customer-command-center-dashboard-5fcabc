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

## Current Dashboard State (Last Refresh: Sep 12 12:10 PM ET - AUTHORITATIVE v33)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, dept scope) | **375** (260 New / 63 Pending / 52 Reopen / 0 Open) &middot; 382 open department-wide |
| Eligible | **296** conversations (239 New, 0 Open, 57 Pending) |
| UFN-Count | 296 |
| Excluded | 97 - 52 Reopen + 22 billing/UF Billing/storage/handling/billing-cycle items + 5 confirmed overlapping conversations |
| closeFlag | **NOT a gate** - 19 live `closeFlag=true` tickets retained |
| Customers | **57** distinct customers (all ticket-visible customers; roster/aliases supplemental; Ticket Ops organization names used where present) |
| Priority | 287 Medium / 9 unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - 213 SLA-breached / 83 current; 249 unassigned |
| Action Buckets | Immediate **32** / Short-Term **54** / Medium-Term **21** / Watch **189** |
| Outlook Coverage | **Available** - 11 current UFN threads and 23 customer threads retrieved; 1 links to an eligible ticket (UFN-70261); supplemental only, never counted in ticket totals |
| Last Refresh | 2026-09-12T12:10:00-04:00 (**AUTHORITATIVE v33** - fresh Ticket Ops read of department 323826714354839552, paged to exhaustion) |


## Developer Reconciliation Note

The v32 snapshot (Sep 12 5:25 AM ET) and this refresh (Sep 12 12:10 PM ET) were both built from a fresh Ticket Ops read of the same department and scope; the movement between them is operational, not methodological:

- **Departed the gate (5):** UFN-70512, UFN-70363, UFN-69751, UFN-69231, UFN-33722 - no longer New/Pending in Ticket Ops.
- **Arrived (4 new report tickets):** UFN-70642, UFN-70639, UFN-70638, UFN-70637.
- **Roster movement:** 69 customers to 57; the reduction is concentrated in single-ticket customers whose only conversation left the gate, plus the customers that dropped out with the departed tickets.
- **Tiering:** the Customer Health tier rule was recovered from the v32 line's own output and re-validated against it (Critical if SLA-breached>=1 AND (tickets>=3 OR oldestBreachedAgeDays>=14); Warning if SLA-breached>=1 OR tickets>=10; else Healthy). It reproduces the v32 tier counts exactly.

Notes for the next cycle:
- **UFN-67030** is no longer live-Pending, and neither is **UFN-70141**. Ticket Ops returns `displayStatusName = Solved` / `displayStatusSystemStatus = 20` for both, each closed by a named staff user. They fail the gate on system status - not on `closeFlag`. The `closeFlag` rule is unchanged and remains correct; only the stale example has been replaced.
- **Ten subject-identity duplicate pairs** are retained rather than collapsed (seven C.H. Robinson "Follow Up" load re-sends, UFN-70481/70594 and siblings, plus UFN-59238/59777 and UFN-48670/48777). They are listed in `refresh-manifest.json` under `exclusions.additionalCandidateOverlaps`. Confirming the seven load pairs would move the working set from 296 to 289.
- **UFN-70350** ("Open RN Items Impacting Billing") is an operational alert rather than an invoice line; it is excluded here to stay aligned with the v32 audited billing set. Surfacing it would move the working set to 297.
- **Client-side rendering note:** `js/dashboard.js` renders the priority-queue Status column from `t.status`, while `tickets.json` carries `opsStatus`/`displayStatusName`. Because no `status` key exists, every queue row renders the `New` badge regardless of its real status. The counts cards are unaffected. No code change was made in this data refresh.

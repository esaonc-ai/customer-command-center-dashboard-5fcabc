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

## Current Dashboard State (Last Refresh: Sep 21 2026 02:18 ET - AUTHORITATIVE)

| Metric | Value |
|--------|-------|
| Total Raw (systemStatus=open) | 349 = New 241 + Pending 70 + Reopen 38 |
| Gate matched | 311 (New 241, Pending 70) |
| Eligible | **288** (227 New, 0 Open, 61 Pending) |
| UFN-Count | 288 |
| Excluded | 23 billing/UF Billing/storage/handling; 38 Reopen outside gate; 0 dedup removals (thread relations not retrievable) |
| closeFlag | **NOT a gate** - 24 live `closeFlag=true` rows retained |
| Customers | **46** distinct orgs (all customers visible in eligible tickets; roster supplemental) |
| SLA Risk | **282 breached / 6 on-track** (provisional - see conflict note) |
| Unassigned | 238 of 288 |
| Outlook Coverage | **Unavailable this refresh** - 0 threads asserted |
| Last Refresh | 2026-09-21 02:18 ET (AUTHORITATIVE - full department enumeration) |
| Next Refresh | ~08:00 ET (daily summary email) |

### Action Buckets

Buckets are a rule-based classification of the ticket subject. No bucket field exists on the ticket, so treat the counts as derived, not sourced. Buckets are mutually exclusive and exhaustive over the 288 eligible rows.

| Bucket | Count | Examples |
|--------|-------|----------|
| **Automated report / notification series** | 116 | UFN-39065, UFN-40670, UFN-40860, UFN-42645 |
| **Claims / damage / returns** | 10 | UFN-46564, UFN-59238, UFN-59296, UFN-59777 |
| **Facility move-out / transfer** | 20 | UFN-70161, UFN-70246, UFN-70285, UFN-70287 |
| **Appointment / carrier pickup requests** | 23 | UFN-35588, UFN-40969, UFN-46639, UFN-47786 |
| **Order commit-blocked / failed & order-status exceptions** | 30 | UFN-33604, UFN-35774, UFN-48225, UFN-51749 |
| **Other customer service / ops** | 89 | UFN-33722, UFN-37858, UFN-39403, UFN-39662 |

### Customer Health (top 12 by ticket count)

Tier rule: Critical = at least one breached ticket older than 30d; Warning = breached <=30d; Healthy = no breaches.

| Customer | Tickets | Breached | Oldest breach (d) | Tier |
|----------|---------|----------|-------------------|------|
| LASSONDE PAPPAS | 63 | 63 | 80 | Critical |
| Turtle Beach | 23 | 23 | 199 | Critical |
| DAYDREAM NUTRITION | 19 | 19 | 38 | Critical |
| Midea America Corp | 19 | 19 | 51 | Critical |
| PRIME TIME PACKAGING | 16 | 16 | 168 | Critical |
| SMEG USA | 15 | 15 | 191 | Critical |
| NIAGARA BOTTLING | 13 | 13 | 177 | Critical |
| MODERN INFUSIONS | 9 | 6 | 6 | Warning |
| ATERIAN GROUP | 8 | 8 | 20 | Warning |
| CANVAS 340 | 8 | 8 | 69 | Critical |
| COLAVITA USA | 8 | 7 | 10 | Warning |
| HINT INC. | 8 | 8 | 24 | Warning |

### Priority Queue (top 10 by age)

| Rank | Ticket | Customer | Status | Age (d) | SLA | Subject |
|------|--------|----------|--------|---------|-----|---------|
| 1 | UFN-33604 | Turtle Beach | New | 199 | Breached | Pending/Overdue Tickets |
| 2 | UFN-33722 | ZEN BEVERAGE | Pending | 199 | Breached | 12x9x12 Boxes Needed |
| 3 | UFN-35588 | ATERIAN INC | Pending | 192 | Breached | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: V |
| 4 | UFN-35774 | SMEG USA | New | 191 | Breached | Commit Block Order - DN-1467983 |
| 5 | UFN-37858 | WYNK BEVERAGE | New | 184 | Breached | welcome, spring 🌷🍋🪻🍓 |
| 6 | UFN-39065 | Turtle Beach | New | 179 | Breached | Reminder: SEND VIVO DAMAGE REPORT |
| 7 | UFN-39403 | SMEG USA | New | 178 | Breached | Reminder following up! |
| 8 | UFN-39662 | NIAGARA BOTTLING | New | 177 | Breached | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN |
| 9 | UFN-40213 | NIAGARA BOTTLING | New | 174 | Breached | Re: QUANTIX SCHEDULE - 3/28 & 3/30 |
| 10 | UFN-40654 | NIAGARA BOTTLING | New | 173 | Breached | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 |

### Caveats and corrections (this refresh)

- **UFN-67030 premise corrected.** The instruction cited it as live-Pending with `closeFlag=true`. Two independent Ticket Ops lookups return `displayStatusName=Solved`, `displayStatusSystemStatus=20`, `closeFlag=true`, closed 2026-09-01 16:56:56. It is excluded by **status**, not by closeFlag. The closeFlag-not-a-gate rule still stands independently: 24 live Pending rows in this set genuinely carry `closeFlag=true`.
- **Deduplication not applied.** Thread relations (parent/child, merged, SHARE_THREAD) are not exposed on the IAM ticket surface - `/v1/staff/tickets/{id}/relations` and `/merged-tickets` return 401, and the IAM brief/page payloads omit `parentId`. No overlap removal could be verified, so 0 removals were made and same-title candidate clusters are flagged instead of silently dropped. This is a **change from the Sep 15 refresh, which removed 5**; that figure was not reproducible here.
- **SLA conflict (unresolved).** Published values are the source's per-row `slaStatus` and are reproducible from the published rows: 282 breached / 6 on-track. The same pull reported a summary of 240/48, and the currently deployed build carries 242 overdue-and-SLA-breached. The threshold difference has not been reconciled - treat the SLA panel as provisional.
- **Date semantics.** Ticket timestamps are rendered as UTC calendar dates. True America/New_York (EDT) dates would move 16 created rows and 5 lastUpdated rows back one day. The source-rendered date was kept for continuity with the existing dataset.
- **Outlook unavailable.** The Outlook agent returned no content on two attempts. `outlook-context.json` is reset to an explicit unavailable state rather than carrying the Sep 4-15 thread set forward as if current; that set remains in git history.
- **Delivery surface.** The production URL serves a managed Next.js app that reads live, authenticated `/api/tickets`. This repository's JSON is the audit/evidence mirror and is what this refresh updates. The authenticated production UI could not be exercised from this session, so this is data-layer validation only.

## Data Files

- `config.json` – Dashboard configuration & filter rules
- `dashboard/data/tickets.json` – Current eligible ticket data (TicketOps source)
- `dashboard/data/outlook-context.json` – Outlook email thread context (non-blocking)
- `dashboard/data/refresh-manifest.json` – Complete refresh audit with rules applied and evidence metrics
- `public/data/tickets.json` – Public-facing tickets (synced)
- `public/data/structured_list.json` – Public-facing structured dashboard data
- `public/data/outlook-context.json` – Public-facing Outlook context (synced)
- `public/data/refresh-manifest.json` – Public-facing refresh summary

## Repository

- **Owner**: nweber00
- **Repo**: customer-command-center-dashboard-5fcabc
- **URL**: https://github.com/nweber00/customer-command-center-dashboard-5fcabc

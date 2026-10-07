# Customer Command Center Dashboard – NHT/Cesanek
**Facility**: NHT/Cesanek (LT_F21) | **Tenant**: LT | **Timezone**: America/New_York
Deployed at: [customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard](https://customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard)
## Overview
Real-time operational dashboard for monitoring ticket queues, customer health, and action priorities at the NHT/Cesanek facility.
## Ticket Filtering Rules
| Rule | Implementation |
|------|----------------|
| **Include Statuses** | New, Open, Pending |
| **Exclude Statuses** | Reopen, Reopened, Closed, Resolved, Solved, Cancelled, Done |
| **Exclude Invoice Items** | billing, UF Billing, storage, handling |
| **UFN Filtering** | Enabled – only `UFN-` ticket numbers; department UNIS Fulfillment - Northampton (`323826714354839552`) |
| **Deduplication** | One row per ticket number; overlapping CASE-/DN- conversation threads collapsed |
| **Outlook Context** | Non-blocking enrichment where available |
| **Authority** | TicketOps status is authoritative |
| **Eligibility Gate** | `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Open, Pending}` |
| **closeFlag Gate** | **NOT USED** – closeFlag is not a filter; live `closeFlag=true` tickets are retained (auto-close artifacts cause false negatives) |
## Customer Health
Coverage rule: All customers visible in eligible NHT/Cesanek tickets. Configured roster/aliases are supplemental only.
## Dashboard Sections
1. **Counts** – Total eligible, by status, UFN-tagged, excluded
2. **Priority Queue** – Sorted by priority & age
3. **Action Buckets** – Immediate (<24h), Short-Term (1–3d), Medium (3–7d), Watch (>7d)
4. **Customer Health** – Per-customer ticket counts, aging, UFN exposure, health ratings
5. **Evidence & Metrics** – Outlook matches, dedup stats, invoice exclusions, SLA risk, freshness
## Current Dashboard State (Last Refresh: Oct 7 2026 09:18 ET – AUTHORITATIVE)
| Metric | Value |
|--------|-------|
| Open system-status bucket | 361 = New 293 + Pending 50 + Reopen 18 |
| Gate matched | **343** (New 293, Pending 50) |
| Eligible | **318** (271 New, 0 Open, 47 Pending) |
| Excluded | 25 billing/UF Billing/storage/handling/invoice items + 0 duplicate threads; Reopen 18 outside gate |
| closeFlag | **NOT a gate** — 12 live `closeFlag=true` rows retained |
| Customers | **40** distinct values incl. "(no customer listed)" rows (all customers visible in eligible tickets; roster supplemental) |
| Customer Health tiers | Critical 26 / Warning 11 / Healthy 3 |
| SLA Risk | **HIGH** – 246 SLA-breached / 72 on-track; 285 unassigned |
| Oldest ticket | 216 days |
| Action buckets (by age) | Immediate 21 / Short-Term 37 / Medium 46 / Watch 214 |
| Outlook Coverage | **Non-blocking, no fresh mailbox sweep this cycle** – 26 threads carried forward; 0 direct matches against the eligible set; 0 duplicates |
| Last Refresh | 2026-10-07 09:18 ET (**AUTHORITATIVE** – dashboard ticket snapshot, 318/318 rows enumerated) |
| Previous refresh | 2026-10-02 23:31 ET — 258 eligible |
| Next Refresh | ~08:00 ET (daily summary email) |
> **Eligibility gate applied:** `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Pending}`. `closeFlag` is **not** a gate. There is **no "Open" display status** in this department — the third open-system-status state is **Reopen (18)**, which the rules exclude.
> **Premise note (recurring):** the instruction again cited UFN-67030 as "live-Pending with closeFlag=true". UFN-67030 **is not present in this cycle's eligible set** and is **not** in the billing exclusion list, i.e. it is outside the `open` system-status bucket and excluded **by status, not by `closeFlag`**. The last authoritative Ticket Ops detail recorded for it (2026-09-24) was `displayStatusName=Solved` (staff-closed 2026-09-01). The rule stands: closeFlag is informational only.
### Evidence Metrics
| Metric | Value |
|--------|-------|
| Total eligible | 318 |
| SLA breached / on-track | 246 / 72 |
| Unassigned | 285 |
| Aging 15d+ | 185 |
| Billing items excluded | 25 |
| Reopen excluded | 18 |
| Overlap/repeat rows removed | 0 |
| closeFlag=true retained | 12 |
| Oldest ticket age | 216d |
### Action Buckets
**Primary (dashboard section – age-based, computed client-side):**
| Bucket | Count |
|--------|-------|
| Immediate (<24h) | 21 |
| Short-Term (1-3d) | 37 |
| Medium (3-7d) | 46 |
| Watch (>7d) | 214 |
**Derived ops view (subject-line pattern rules, first-match-wins; heuristic, not a TicketOps field):**
| Bucket | Count | Examples |
|--------|-------|----------|
| **Other customer service / ops** | 162 | UFN-33604, UFN-33722, UFN-37858, UFN-39662, UFN-40213, UFN-40654 |
| **Automated report / notification series** | 87 | UFN-39403, UFN-40670, UFN-53491, UFN-59915, UFN-60125, UFN-60348 |
| **Claims / damage / returns** | 28 | UFN-39065, UFN-40860, UFN-42645, UFN-44321, UFN-45763, UFN-46564 |
| **Appointment / carrier pickup requests** | 24 | UFN-35588, UFN-40969, UFN-46639, UFN-47786, UFN-55002, UFN-64590 |
| **Facility move-out / transfer** | 10 | UFN-64739, UFN-70161, UFN-70789, UFN-71446, UFN-71713, UFN-71830 |
| **Order commit-blocked / failed & order-status exceptions** | 7 | UFN-35774, UFN-67199, UFN-68233, UFN-70268, UFN-70971, UFN-71437 |
### Customer Health (top 12 by breached volume)
| Customer | Tickets | Breached | Oldest breached | Tier |
|----------|---------|----------|-----------------|------|
| LASSONDE PAPPAS AND COMPANY, INC. | 74 | 72 | 97d | Critical |
| Turtle Beach | 20 | 20 | 216d | Critical |
| Midea America Corp | 20 | 20 | 68d | Critical |
| (no customer listed) | 29 | 18 | 208d | Critical |
| PRIME TIME PACKAGING LTD | 16 | 15 | 185d | Critical |
| SMEG USA INC | 15 | 13 | 195d | Critical |
| NIAGARA BOTTLING LLC | 13 | 13 | 194d | Critical |
| TCL NORTH AMERICA | 19 | 11 | 16d | Warning |
| RITUAL BEVERAGE COMPANY | 15 | 11 | 190d | Critical |
| CANVAS 340 LLC | 19 | 9 | 86d | Critical |
| Natural Rapport (Q & C Products LLC) | 4 | 4 | 79d | Critical |
| RISE BEVERAGES LLC dba RISE BREWING COMPANY | 4 | 4 | 16d | Warning |
### Priority Queue (top 10 by age)
| Rank | Ticket | Customer | Subject | Age | SLA | Owner |
|------|--------|----------|---------|-----|-----|-------|
| 1 | UFN-33604 | Turtle Beach | Pending/Overdue Tickets | 216d | Breached | unassigned |
| 2 | UFN-33722 | ZEN BEVERAGE | 12x9x12 Boxes Needed | 215.7d | Breached | unassigned |
| 3 | UFN-35588 | ATERIAN INC | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: VY8-M2X5 | 208.7d | Breached | unassigned |
| 4 | UFN-35774 | (no customer listed) | Commit Block Order - DN-1467983 | 207.9d | Breached | Sittie Jhaila Sirad |
| 5 | UFN-37858 | WYNK BEVERAGE - Reverse | welcome, spring | 200.0d | Breached | unassigned |
| 6 | UFN-39065 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 196.0d | Breached | unassigned |
| 7 | UFN-39403 | SMEG USA INC | Reminder following up! | 194.9d | Breached | unassigned |
| 8 | UFN-39662 | NIAGARA BOTTLING LLC | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN | 193.8d | Breached | unassigned |
| 9 | UFN-40213 | NIAGARA BOTTLING LLC | Re: QUANTIX SCHEDULE - 3/28 & 3/30 | 191.0d | Breached | unassigned |
| 10 | UFN-40654 | NIAGARA BOTTLING LLC | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 | 189.7d | Breached | unassigned |
### Data Freshness Gaps
- `lastMessageAt`/`updatedAt` and `assigneeName` are carried on all 318 rows; `assigneeName = Unassigned` means unassigned at source (285 of 318).
- **No fresh Outlook mailbox sweep this cycle** (no mailbox tool in the refresh session). Non-blocking per the rules; `outlook-context.json` is carried forward and labelled. It contributes 0 rows to any ticket count and duplicates no eligible ticket.
- **Live Ticket Ops paging API was not reachable from the refresh session** (`401 Invalid authorization header` on every `/v1/iam/...` call). This refresh was therefore derived from the dashboard's own current authoritative ticket snapshot (2026-10-07 09:18 ET) and every count was recomputed client-side from the 318 enumerated rows under the rules above.
- Derived (not TicketOps-sourced) values: the ops-view action buckets above, and Customer Health tiers (rule: Critical = ≥1 breached ticket older than 30d; Warning = breached ≤30d; Healthy = no breaches).
### Key Correction History
| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-10-07T09:18ET-AUTHORITATIVE | 09:18 | **AUTHORITATIVE REFRESH** – 318 eligible (271 New / 47 Pending) from open bucket 361 (New 293 / Pending 50 / Reopen 18 excluded) minus 25 billing/storage/handling/invoice items; 0 duplicates; 12 closeFlag=true retained; 40 customers. UFN-67030 absent (excluded by status). |
| refresh-2026-10-02T23:31ET | 23:31 | Previous dashboard snapshot – 258 eligible. |
| refresh-2026-09-24T06:40ET-AUTHORITATIVE | 06:40 | Fresh TicketOps pull: gate 295 → 278 eligible; 17 billing exclusions; 14 closeFlag=true retained. |
| refresh-2026-09-22T04:17ET-AUTHORITATIVE | 04:17 | Fresh TicketOps pull: gate 297 → 268 eligible after 21 billing and 8 overlap duplicates. |
| refresh-2026-09-15T23:45ET-AUTHORITATIVE | 23:45 | Gate 312 → 291 eligible. 16 billing + 5 duplicates excluded. |
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

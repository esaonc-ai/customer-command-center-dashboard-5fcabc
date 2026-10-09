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
## Current Dashboard State (Last Refresh: Oct 9 2026 06:45 ET – AUTHORITATIVE)
| Metric | Value |
|--------|-------|
| Department total (all statuses) | 71,359 |
| Open system-status rows | 351 = New 284 + Pending 50 + Reopen 17 |
| Gate matched | **334** (New 284, Pending 50) |
| Eligible | **305** (259 New, 0 Open, 46 Pending) |
| Excluded | 29 billing/UF Billing/storage/handling/period-close invoice items + 0 overlapping duplicates; Reopen 17 outside gate |
| closeFlag | **NOT a gate** — 9 live `closeFlag=true` rows retained |
| Customers | **47** distinct values incl. contact-only rows (all customers visible in eligible tickets; roster supplemental) |
| Customer Health tiers | Critical 28 / Warning 14 / Healthy 5 |
| SLA Risk | **HIGH** – 267 SLA-breached / 38 on-track; 278 unassigned |
| Oldest ticket | 218 days |
| Action buckets (by age) | Immediate 15 / Short-Term 29 / Medium 44 / Watch 217 |
| Outlook Coverage | **UNAVAILABLE** – no fresh Outlook pull this cycle (non-blocking); 0 threads merged |
| Last Refresh | 2026-10-09 06:45 ET (**AUTHORITATIVE** – fresh TicketOps pull, 351/351 open rows enumerated, 334 gate rows) |
| Previous refresh | 2026-09-24 06:40 ET — 278 eligible |
| Next Refresh | ~08:00 ET (daily summary email) |
> **Eligibility gate applied:** `displayStatusSystemStatus = open` **AND** `displayStatusName ∈ {New, Pending}`. `closeFlag` is **not** a gate. Note there is **no "Open" display status** in this department — the third open-system-status state is **Reopen (17)**, which the rules exclude.
> **Premise note (recurring):** the instruction again cited UFN-67030 as "live-Pending with closeFlag=true". Ticket Ops is authoritative and shows UFN-67030 = `displayStatusName=Solved`, `displayStatusSystemStatus=20`, staff-closed 2026-09-01 (verified on both the list/search index and the live single-record endpoint). It is excluded **by status**, not by `closeFlag`. The rule stands.
### Evidence Metrics
| Metric | Value |
|--------|-------|
| Total eligible | 305 |
| SLA breached / on-track | 267 / 38 |
| Unassigned | 278 |
| Aging 15d+ | 192 |
| Aging 0-7d / 8-30d / 31-90d / 90d+ | 88 / 66 / 80 / 71 |
| Billing items excluded | 29 |
| Reopen excluded | 17 |
| Overlap duplicates removed | 0 |
| closeFlag=true retained | 9 |
| Reply answered / awaiting answer | 15 / 290 |
| Urgent / High priority in queue | 0 / 0 (all Medium) |
| Oldest ticket age | 218d |
| Gate-level SLA (334 rows, authoritative API) | 291 breached / 43 on-track / 300 unassigned |
### Action Buckets
**Primary (dashboard section – age-based, computed client-side):**
| Bucket | Count |
|--------|-------|
| Immediate (<24h) | 15 |
| Short-Term (1-3d) | 29 |
| Medium (3-7d) | 44 |
| Watch (>7d) | 217 |
**Derived ops view (subject-line pattern rules, first-match-wins; heuristic, not a TicketOps field):**
| Bucket | Count | Examples |
|--------|-------|----------|
| **Automated report / notification series** | 151 | UFN-39065, UFN-39403, UFN-40860, UFN-42645, UFN-44321, UFN-45763 |
| **Other customer service / ops** | 61 | UFN-33604, UFN-33722, UFN-37858, UFN-39662, UFN-40213, UFN-40654 |
| **Appointment / carrier pickup requests** | 48 | UFN-35588, UFN-40969, UFN-41878, UFN-43591, UFN-45186, UFN-46492 |
| **Order commit-blocked / failed & order-status exceptions** | 30 | UFN-35774, UFN-59296, UFN-65850, UFN-66004, UFN-66445, UFN-67835 |
| **Claims / damage / returns** | 10 | UFN-46564, UFN-59238, UFN-59777, UFN-64134, UFN-64607, UFN-68741 |
| **Facility move-out / transfer** | 5 | UFN-64739, UFN-70800, UFN-71446, UFN-71713, UFN-71839 |
### Customer Health (top 12 by breached volume)
| Customer | Tickets | Breached | Oldest breached | Tier |
|----------|---------|----------|-----------------|------|
| LASSONDE PAPPAS AND COMPANY, INC. | 77 | 74 | 99d | Critical |
| Turtle Beach | 20 | 20 | 218d | Critical |
| CANVAS 340 LLC | 19 | 19 | 88d | Critical |
| MIDEA AMERICA CORP | 19 | 19 | 69d | Critical |
| PRIME TIME PACKAGING LTD | 15 | 15 | 186d | Critical |
| SMEG USA INC | 13 | 13 | 210d | Critical |
| NIAGARA BOTTLING LLC | 13 | 13 | 196d | Critical |
| TCL NORTH AMERICA | 17 | 12 | 16d | Warning |
| MODERN INFUSIONS LLC | 18 | 10 | 6d | Warning |
| MAIZLY INC. | 10 | 8 | 9d | Warning |
| BOUNDLESS EC US LLC | 12 | 7 | 8d | Warning |
| RITUAL BEVERAGE COMPANY | 10 | 7 | 178d | Critical |
### Priority Queue (top 12 by age)
| Rank | Ticket | Customer | Subject | Age (d) | SLA | Owner |
|------|--------|----------|---------|---------|-----|-------|
| 1 | UFN-33604 | Turtle Beach | Pending/Overdue Tickets | 217.7 | Breached | UNASSIGNED |
| 2 | UFN-33722 | ZEN BEVERAGE | 12x9x12 Boxes Needed | 217.4 | Breached | UNASSIGNED |
| 3 | UFN-35588 | ATERIAN INC | Appointment Request :: PO: DN-1467998 RN-23177 Flock Ref#: V | 210.4 | Breached | UNASSIGNED |
| 4 | UFN-35774 | SMEG USA INC | Commit Block Order - DN-1467983 | 209.6 | Breached | Sittie Jhaila Sirad |
| 5 | UFN-37858 | WYNK BEVERAGE - Reverse | welcome, spring | 201.7 | Breached | UNASSIGNED |
| 6 | UFN-39065 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 197.7 | Breached | UNASSIGNED |
| 7 | UFN-39403 | SMEG USA INC | Reminder following up! | 196.6 | Breached | UNASSIGNED |
| 8 | UFN-39662 | NIAGARA BOTTLING LLC | NIAGARA//JEFF-0327-SRICHAKRA//JEFFERSONVILLE IN | 195.6 | Breached | UNASSIGNED |
| 9 | UFN-40213 | NIAGARA BOTTLING LLC | Re: QUANTIX SCHEDULE - 3/28 & 3/30 | 192.7 | Breached | UNASSIGNED |
| 10 | UFN-40654 | NIAGARA BOTTLING LLC | NIAGARA/PLAINFIELD/ DUYTAN/ 4.6- 4.12 | 191.4 | Breached | UNASSIGNED |
| 11 | UFN-40860 | Turtle Beach | Reminder: SEND VIVO DAMAGE REPORT | 190.7 | Breached | UNASSIGNED |
| 12 | UFN-40969 | SMEG USA INC | Schedule Appointment-Pickup(1) - BOL# 33604304 | 190.5 | Breached | Sittie Jhaila Sirad |
### Data Freshness Gaps
- All 305 eligible rows were enumerated from TicketOps (pages 1–4 of 351 open rows); subject = `title`, account = organization/customer, aging from `createTime`, last activity from `updateTime`.
- Per-row `isOverdue` came from the record payload and reconciles exactly to the authoritative aggregate (308 overdue / 43 on-track across the 351 open rows; New 245 / Pending 46 / Reopen 17).
- **Outlook context is unavailable this cycle** (no mailbox tool in the refresh session). Non-blocking per the rules; `outlook-context.json` is carried forward unchanged from the 2026-09-15 window and remains labelled stale.
- Derived (not TicketOps-sourced) values: the ops-view action buckets above, and Customer Health tiers (rule: Critical = ≥1 breached ticket older than 30d; Warning = breached ≤30d; Healthy = no breaches).
- Borderline items **kept** (invoice-flavoured but operational, not billing invoice items): UFN-68749 (TCL e-comm storage SQFT request), UFN-60009 (BOL request referencing an Amazon invoice), UFN-71498 (urgent payment request from customer), UFN-72198/UFN-72225 (DELMAR aging report correspondence).
- The department's open queue is dominated by recurring system notifications ("Advanced Report – Dock Activity", "OMS Alert", "Dropship Order Daily Report", "Ticket … was updated", "Reminder: SEND VIVO DAMAGE REPORT") — retained because they satisfy the stated rules; a content-only filter would be an additional unstated rule.
### Key Correction History
| Refresh | Time (ET) | Key Change |
|---------|-----------|------------|
| refresh-2026-10-09T06:45ET-AUTHORITATIVE | 06:45 | **AUTHORITATIVE REFRESH** – Fresh TicketOps pull: open 351 (New 284/Pending 50/Reopen 17) → gate **334** → **305 eligible** after 29 billing/storage/handling/period-close exclusions (Reopen 17 outside gate, 0 duplicates). closeFlag still not a gate (9 retained). Outlook pull unavailable (non-blocking). UFN-67030 re-confirmed Solved. |
| refresh-2026-09-24T06:40ET-AUTHORITATIVE | 06:40 | Fresh TicketOps pull: gate 295 (New 237/Pending 58) → **278 eligible** after 17 billing/storage/handling/invoice exclusions (Reopen 32 outside gate, 0 overlap duplicates). closeFlag still not a gate (14 retained). Outlook pull unavailable (non-blocking). UFN-67030 re-confirmed Solved. |
| refresh-2026-09-22T04:17ET-AUTHORITATIVE | 04:17 | Fresh TicketOps pull: gate 297 → 268 eligible after 21 billing and 8 overlap duplicates; 23 closeFlag=true retained. |
| refresh-2026-09-15T23:45ET-AUTHORITATIVE | 23:45 | Gate 312 → 291 eligible. 16 billing + 5 duplicates excluded. |
| refresh-2026-09-15T12:36ET-AUTHORITATIVE | 12:36 | Gate 312 → 286 eligible — superseded same day. |
## Data Files
- `config.json` – Dashboard configuration & filter rules
- `dashboard/data/tickets.json` – Current eligible ticket data (TicketOps source)
- `dashboard/data/outlook-context.json` – Outlook email thread context (non-blocking)
- `dashboard/data/refresh-manifest.json` – Complete refresh audit with rules applied and evidence metrics
- `public/data/tickets.json` – Public-facing tickets (synced)
- `public/data/structured_list.json` – Public-facing structured dashboard data

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

## Current Dashboard State (Last Refresh: Sep 20 1:26 PM ET - AUTHORITATIVE v52)

| Metric | Value |
|--------|-------|
| Total Raw (system-open UFN, department scope) | **349** = 241 New / 70 Pending / 38 Reopen; New/Open/Pending gate **311** |
| Eligible | **291** conversations (227 New, 0 Open, 64 Pending) - 2 arrivals / 0 departures vs v51 |
| Excluded | 20 billing-family; 38 Reopen rows outside the gate; 6 CASE/DN overlaps flagged but retained |
| closeFlag | **NOT a gate** - 24 live closeFlag=true tickets retained (25 gate-wide; UFN-65196 is billing-excluded) |
| Customers | **49** customer organizations (45 Critical / 4 Warning / 0 Healthy; every ticket-visible customer covered) |
| Priority | 287 Medium / 4 unavailable |
| SLA Risk | **ELEVATED** - 243 SLA-breached / 48 current; 237 unassigned |
| Action Buckets | Immediate **6** / Short-Term **33** / Medium-Term **36** / Watch **216** |
| Outlook Coverage | **Unavailable this cycle** - last observed (v42): 25 UFN messages / 9 distinct threads, latest 2026-09-14T21:46:00Z; stale and supplemental only |
| Last Refresh | 2026-09-20T13:26:00-04:00 (**AUTHORITATIVE v52**, department 323826714354839552) |

## Developer Reconciliation Note

### v51 -> v52 (Sep 20 11:32 AM ET -> Sep 20 1:26 PM ET)

- **Net movement: 2 in / 0 out.** The live read returns 349 system-open rows (241 New / 70 Pending / 38 Reopen) and a 311-row New/Open/Pending gate. Eligible: **291** conversations (227 New / 64 Pending).
- **Real gate arrivals:** UFN-71236, UFN-71233. No relative departures this cycle.
- **No method change vs v51.** The gate definition, the 20 billing-family exclusions, the flag-but-retain overlap handling, and the organization-keyed Customer Health grouping are all unchanged.
- **closeFlag is still not a gate.** 24 of 25 gate-wide `closeFlag=true` rows are eligible (UFN-65196 is billing-excluded); all sit on live system-OPEN New/Pending rows - the auto-close artifact.
- **UFN-67030 re-checked live.** `displayStatusName` "Solved" / `displayStatusSystemStatus` 20 (CLOSED) / `closeFlag` true. It is outside the gate on **authoritative status**, not on closeFlag; the circulated "live-Pending with closeFlag=true" premise is false and must not be reused.
- **Status-name audit.** No row in this queue is named "Open" (display-status id 1 resolves to Reopen, which is excluded by name), so New/Open/Pending is exactly New + Pending = 311.
- **Customer Health coverage unchanged.** 49 organizations (45 Critical / 4 Warning / 0 Healthy); every customer visible in eligible tickets is covered; roster/aliases supplemental only.
- **Age-derived sections recomputed** at 2026-09-20T13:26:00-04:00: SLA 243 breached / 48 current; buckets Immediate 6 / Short-Term 33 / Medium-Term 36 / Watch 216.
- **Outlook unavailable again this cycle** (delegated-mailbox read returned no result). v42 values are carried forward, labelled stale, and no operational metric depends on them.
- **Production rendering is not changed by this commit.** The deployed dashboard reads its own authenticated data route; this repo is the audit/evidence mirror.

### v50 -> v51 (Sep 20 8:16 AM ET -> Sep 20 11:32 AM ET)

- **Net movement: 13 in / 0 out.** The live read returns 347 system-open rows (239 New / 70 Pending / 38 Reopen) and a 309-row New/Open/Pending gate. Eligible: **289** conversations (225 New / 64 Pending).
- **Gate vs eligible movement is not the same thing.** Real gate arrivals: UFN-71232, UFN-71231, UFN-71230, UFN-71127, UFN-70352, UFN-69663, UFN-69661, UFN-69450, UFN-69447, UFN-68749, UFN-63762, UFN-53491, UFN-40670. Eligible movement also reflects four deliberate billing re-rulings (UFN-40670, UFN-53491, UFN-63762, UFN-68749 now eligible) and the overlap handling change below.
- **closeFlag is still not a gate.** 24 of 25 gate-wide `closeFlag=true` rows are eligible (UFN-65196 is billing-excluded); all sit on live system-OPEN Pending/New rows - the auto-close artifact.
- **UFN-67030 re-refuted live.** `displayStatusName` "Solved" / `displayStatusSystemStatus` 20 (CLOSED) / closedTime 2026-09-01 / `closeFlag` true. It is outside the gate on **authoritative status**, not on closeFlag.
- **Status-name audit.** No row in this queue is named "Open" (display-status id 1 resolves to Reopen, which is excluded by name), so New/Open/Pending is exactly New + Pending = 309.
- **Conversation-overlap handling changed and is disclosed.** v50 removed six rows by CASE/DN identity (UFN-69447/69450 -> UFN-69307, UFN-69661/69663 -> UFN-69511, UFN-70352 -> UFN-70351, UFN-71127 -> UFN-71073). They are still present in the gate; this cycle they are **flagged but retained** because the dashboard rule is one row per ticket number, distinct ticket numbers are never merged, and the IAM page surface returns no `conversationId` to prove double-sourcing. Effect: +6 eligible rows; one-line reversal documented in the manifest.
- **Customer Health label corrected.** Health is now keyed by the customer **organization** (the label the dashboard renders) instead of v50's requester name/email, which produced 123 person-level labels that did not match the rendered dashboard. Coverage rule unchanged: every customer visible in eligible tickets; roster/aliases supplemental. Result: 49 organizations (45 Critical / 4 Warning / 0 Healthy).
- **Age-derived sections recomputed** at 2026-09-20T11:32:00-04:00: SLA 243 breached / 46 current; buckets Immediate 6 / Short-Term 34 / Medium-Term 33 / Watch 216.
- **Outlook unavailable again this cycle** (delegated-mailbox read returned no result). v42 values are carried forward, labelled stale, and no operational metric depends on them.
- **Production rendering is not changed by this commit.** The deployed dashboard reads its own authenticated data route; this repo is the audit/evidence mirror.

## 🚨 Data Freshness Notice

**This refresh (Aug 11 05:07 ET) is an AUTHORITATIVE refresh** with a fresh TicketOps LIVE connection. All statuses verified directly against TicketOps. 39 tickets that were previously assumed eligible (based on Aug 10 23:20 ET preserved state) were found to have moved to ineligible statuses (Closed/Resolved/Cancelled) in TicketOps.

**Queue health**: 81% reduction from stale state. Only 9 verified eligible tickets remain. SLA breach rate is now 22% (2/9), which is significantly elevated due to the smaller denominator.

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

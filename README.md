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

## Current Dashboard State (Last Refresh: Sep 12 8:48 PM ET - AUTHORITATIVE v35)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **391** = 273 New / 66 Pending / 52 Reopen &middot; New+Pending gate **339** |
| Eligible | **310** conversations (251 New, 0 Open, 59 Pending) |
| UFN-Count | 310 |
| Excluded | 29 &mdash; 24 billing/UF Billing/storage/handling/invoice items + 5 confirmed overlapping conversations (+52 Reopen rows outside the gate) |
| closeFlag | **NOT a gate** - 19 live `closeFlag=true` tickets retained |
| Customers | **70** distinct customers (45 Critical / 25 Warning / 0 Healthy; all ticket-visible customers, roster/aliases supplemental) |
| Priority | 305 Medium / 5 unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - 216 SLA-breached / 94 current; 259 unassigned |
| Action Buckets | Immediate **13** / Short-Term **71** / Medium-Term **34** / Watch **192** |
| Outlook Coverage | **Available** - 25 UFN threads retrieved, 2 link to eligible tickets (0.6%); supplemental only, never counted in ticket totals |
| Last Refresh | 2026-09-12T20:48:59-04:00 (**AUTHORITATIVE v35** - fresh Ticket Ops read of department 323826714354839552, paged to exhaustion) |

## Developer Reconciliation Note

### v34 -> v35 (Sep 12 1:45 PM ET -> Sep 12 8:48 PM ET)

- **Net movement: +0.** The authoritative New/Pending gate moved from 332 to 339. Seven source-backed New tickets arrived (UFN-70664, UFN-70663, UFN-70662, UFN-70661, UFN-70660, UFN-70659, UFN-70652); no previously eligible v34 ticket left the gate.
- **Exclusions remain exact.** All 24 specialist-confirmed billing-family rows and all 5 duplicate-to-survivor rows were present in the live pull and excluded. No other topic, subject, date, closeFlag, or Outlook filter was applied.
- **closeFlag evidence.** 19 live `closeFlag=true` tickets remain in the eligible set; `closeFlag` is not a gate.
- **Flagged records remain retained.** UFN-69231 (ODFL PRO-number request in the billing-number series) still has no billing keyword and awaits a business ruling. UFN-60009 remains an operational BOL request despite referencing an Amazon Invoice.
- **Customer Health matches the rendered rule.** The eligible set covers every ticket-visible customer and yields 45 Critical / 25 Warning / 0 Healthy. Healthy remains structurally unreachable because every eligible ticket is UFN-tagged.

### v33 -> v34 (Sep 12 12:10 PM ET -> Sep 12 1:45 PM ET)

The movement is partly operational and partly a **methodology correction**:

- **Restored 6 records (methodology correction).** v33 applied a topic-scope filter that silently removed the six `General Inquiry` topic rows. They never left the New/Pending gate: UFN-70636, UFN-70512, UFN-70363, UFN-69751, UFN-69231, UFN-33722 were each re-verified live as `displayStatusSystemStatus=10` with `closeFlag=false`. v33's note that they "left the gate" was an artefact of that filter.
- **One arrival.** UFN-70643 (CESANEK APPOINTMENT WATCH, 09/12) is new in this window.
- **closeFlag.** 19 live `closeFlag=true` records are retained as evidence. An intermediate read claimed 24; that was a transcription error (it wrongly carried UFN-70559 plus two billing-excluded rows). 19 is confirmed live.
- **UFN-67030 stays out.** Re-verified: `displayStatusId` 2 / "Solved" / system status 20 / `closeFlag` true / closed 2026-09-01 16:56:56. It fails the gate on **system status, not on closeFlag** - the closeFlag rule is unchanged and remains correct.
- **Two records flagged rather than silently resolved.** UFN-69231 ("7126341408 SECOND REQUEST") has no billing keyword but is an Old Dominion PRO-number request in the same `7126341xxx` series as three explicitly billing-labelled tickets - retained, ruling requested. UFN-60009 references an Amazon Invoice but is a BOL request, not an invoice line - retained, consistent with the v33 audited set.
- **Subject-identity overlaps stay retained.** The seven C.H. Robinson " - Follow Up" re-sends and the duplicate Dropship/OMS report pairs are listed under `exclusions.additionalCandidateOverlaps`: only a source-backed conversation identifier may collapse a record.
- **Customer Health tiers now use the dashboard's own rule.** The evidence artefact previously reported tier counts from an undocumented rule that did not match what `js/dashboard.js` renders. It now uses that client rule directly (Critical when the >7-day share is >= 50% or the customer has 3+ tickets; Warning when the share is >= 25% or 1+ ticket). Because every eligible ticket is UFN-tagged, "Healthy" is structurally unreachable in this dataset - the tiers are 45 Critical / 25 Warning / 0 Healthy.

Everything else follows v32/v33 methodology: authoritative New/Pending gate, closeFlag non-gating, billing-family exclusions, conversation-identity dedup, customer-health coverage of every ticket-visible customer, Outlook as non-blocking context.

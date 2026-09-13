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

## Current Dashboard State (Last Refresh: Sep 13 6:36 AM ET - AUTHORITATIVE v37)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **392** = 274 New / 66 Pending / 52 Reopen &middot; New+Pending gate **340** |
| Eligible | **311** conversations (252 New, 0 Open, 59 Pending) |
| UFN-Count | 311 |
| Excluded | 29 &mdash; 24 billing/UF Billing/storage/handling/invoice items + 5 confirmed overlapping conversations (+52 Reopen rows outside the gate) |
| Flagged | 7 C.H. Robinson same-load overlap pairs retained pending a business ruling (would take eligible to 304) |
| closeFlag | **NOT a gate** - 19 live `closeFlag=true` tickets retained |
| Customers | **70** distinct customers (45 Critical / 25 Warning / 0 Healthy; all ticket-visible customers, roster/aliases supplemental) |
| Priority | 306 Medium / 5 unavailable from source; ranking does not depend on priority |
| SLA Risk | **ELEVATED** - 216 SLA-breached / 95 current; 260 unassigned |
| Action Buckets | Immediate **14** / Short-Term **69** / Medium-Term **36** / Watch **192** |
| Outlook Coverage | **Available** - 25 UFN threads retrieved, 2 link to eligible tickets; supplemental only, never counted in ticket totals |
| Last Refresh | 2026-09-13T06:36:00-04:00 (**AUTHORITATIVE v37** - live Ticket Ops gate read of department 323826714354839552, independent of the prior cycle) |

## Developer Reconciliation Note

### v36 -> v37 (Sep 13 12:33 AM ET -> Sep 13 6:36 AM ET)

- **Net movement: +1.** The authoritative New+Pending gate moved from 339 to 340 rows (274 New / 66 Pending) inside a 392-row open bucket that still holds 52 Reopen rows. One arrival (UFN-70676, "Re: Ecommerce Unis", UPTIME ENERGY INC, created 2026-09-13T05:22:57.000Z) and **zero departures**; per-record status, closeFlag, SLA and overdue flags matched v36 on all 310 previously eligible records.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All 24 billing-family rows and all 5 duplicate conversations were present in the live read, so the exclusion set is unchanged. No new CASE/DN identity collision arrived with UFN-70676.
- **closeFlag evidence unchanged.** 19 live `closeFlag=true` records remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). `closeFlag` is evidence only.
- **The UFN-67030 citation is stale.** Re-verified by ticket number this cycle: Solved / displayStatusId 2 / systemStatus 20 / closeFlag=true, last updated 2026-09-01 16:57 - i.e. closed on **authoritative status**, not on closeFlag. The closeFlag rule stands; the example should be re-pointed at a live closeFlag=true Pending ticket (for example UFN-70443 or UFN-70243).
- **Flagged records remain retained.** The 7 same-load C.H. Robinson pairs and UFN-69231 / UFN-60009 are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; 4 records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers remain 45 Critical / 25 Warning / 0 Healthy, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** The cycle re-read the most recent UFN page of the delegated CS mailbox: no new threads, 2 threads still link to eligible conversations (UFN-69781, UFN-70261). The nht.cs@unisco.com shared mailbox was not readable this cycle (access denied) and is disclosed as a limitation rather than silently dropped.

### v35 -> v36 (Sep 12 8:48 PM ET -> Sep 13 12:33 AM ET)

- **Net movement: +0.** The authoritative New+Pending gate is still 339 (273 New / 66 Pending) inside a 391-row open bucket with 52 Reopen rows. A full ticket-number set diff of all 339 gate rows against v35 returned **zero arrivals and zero departures**, and per-record status, closeFlag and SLA flags also matched with no movement.
- **Exclusions re-confirmed, not re-guessed.** All 24 billing-family rows were re-checked individually. Three of them - UFN-60573 (Prime Time Handling 6/28-7/4), UFN-53491 and UFN-40670 (F26 Month End Close Reminder series) - were disputed by an intermediate read and are confirmed billing-family, so the v35 exclusion count stands.
- **New overlap evidence, deliberately not applied.** Seven C.H. Robinson appointment pairs share an identical source load number (original request plus " - Follow Up" re-send): UFN-70594/70481, 70593/70480, 70588/70475, 70587/70473, 70586/70471, 70580/70465, 70579/70464. They are flagged under `exclusions.additionalCandidateOverlaps` and retained, because the dashboard's configured rule collapses only source-backed conversation identity (CASE/DN). Applying load-number identity would reduce eligible conversations from 310 to 303. Awaiting a business ruling.
- **Assignment field left as-is.** A delegate read reported 272 unassigned in the eligible set against 259 in the machine baseline. A targeted per-record re-read of the 13 conflicting tickets found a populated `staffName` on all 13, so the baseline assignment data is retained and the transcribed split was discarded.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; 13 records crossed a whole-day age boundary.
- **closeFlag evidence unchanged.** 19 live `closeFlag=true` tickets remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). UFN-67030 remains excluded on authoritative status (Solved / systemStatus 20), not on closeFlag.
- **Customer Health matches the rendered rule.** The eligible set covers every ticket-visible customer and yields 45 Critical / 25 Warning / 0 Healthy. Healthy remains structurally unreachable because every eligible ticket is UFN-tagged.

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

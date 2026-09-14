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

## Current Dashboard State (Last Refresh: Sep 13 10:31 PM ET - AUTHORITATIVE v41)

| Metric | Value |
|--------|-------|
| Total Raw (open UFN, department scope) | **406** = 286 New / 66 Pending / 54 Reopen &middot; New+Pending gate **352** |
| Eligible | **323** conversations (264 New, 0 Open, 59 Pending) |
| UFN-Count | 323 |
| Excluded | 29 &mdash; 24 billing/UF Billing/storage/handling/invoice items + 5 confirmed overlapping conversations (+54 Reopen rows outside the gate) |
| Arrivals this cycle | **+5** (UFN-70710, UFN-70711, UFN-70712, UFN-70713, UFN-70714) &middot; departures **0** |
| Flagged | 7 C.H. Robinson same-load overlap pairs retained pending a business ruling (would take eligible to 316) |
| closeFlag | **NOT a gate** - 19 live closeFlag=true tickets retained |
| Customers | **70** distinct customers (46 Critical / 24 Warning / 0 Healthy; all ticket-visible customers, roster/aliases supplemental) |
| Priority | 318 Medium / 5 unavailable from source (carried forward - not re-verified this cycle); ranking does not depend on priority |
| SLA Risk | **ELEVATED** - 214 SLA-breached / 109 current; 270 unassigned |
| Action Buckets | Immediate **13** / Short-Term **53** / Medium-Term **65** / Watch **192** |
| Outlook Coverage | **Available** - 25 UFN messages / 13 distinct threads retrieved, 2 link to eligible tickets; supplemental only, never counted in ticket totals |
| Last Refresh | 2026-09-13T22:31:00-04:00 (**AUTHORITATIVE v41** - live Ticket Ops gate read of department 323826714354839552, independent of the prior cycle) |

## Developer Reconciliation Note

### v40 -> v41 (Sep 13 5:05 PM ET -> Sep 13 10:31 PM ET)

- **Net movement: +5 eligible conversations.** The authoritative New+Pending gate moved 347 -> 352 rows (286 New / 66 Pending) inside a 406-row open bucket that still holds 54 Reopen rows.
- **Arrivals are exact and enumerated.** 5 tickets entered the gate: UFN-70710, UFN-70711, UFN-70712, UFN-70713, UFN-70714 (the Cesanek Dropship EOD batch created 2026-09-13 21:20 UTC). They resolve to 1 customer label: wilmer.benitez@unisco.com.
- **Departures: none.** Every one of the 318 v40 eligible tickets is still present in the v41 gate, so the working set moves only by the arrivals above. No record was removed by any exclusion rule.
- **Flag drift is small and enumerated.** A per-record comparison of opsStatus, closeFlag, isSlaBreached and isOverdue across every carried-forward eligible ticket returned 2 differences: UFN-57050 isSlaBreached true -> false; UFN-56957 isSlaBreached true -> false. No opsStatus or closeFlag movement.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All 24 billing-family rows (24/24) and all 5 duplicate conversations (5/5) were present in the live read, so the exclusion set is unchanged. UFN-60009 (Amazon Invoice reference on a BOL request) and UFN-69231 (ODFL PRO-number request) remain retained pending a business ruling.
- **closeFlag evidence unchanged and re-proven.** 19 live closeFlag=true records remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). They sit on Pending rows that are system-OPEN, which is the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **UFN-67030 remains out on status, not on closeFlag.** The flag is not used as a gate; the rule is better evidenced by the live closeFlag=true Pending rows (UFN-70443, UFN-70412, UFN-70304, UFN-70243, UFN-70130, UFN-69781).
- **Status-name audit.** The display-status dictionary in use here is New(11), Pending(6), Reopen(1), Solved(2) - there are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending with Reopen excluded by name. All 66 Pending rows carry a single status "Pending" (id 6).
- **Flagged records remain retained.** The 7 same-load C.H. Robinson pairs are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Field provenance.** Only gate fields left of the subject column (ticketNumber, displayStatusName, closeFlag, isSlaBreached, isOverdue) were taken from the raw export; 7 raw rows carry unquoted commas in subject/organization and shift their right-hand columns, so those columns were not trusted. Customer, priority, assignee, dates and channel are carried forward from v40; the raw export is retained as `scripts/gate-raw-delegate-2026-09-13-v41.csv`.
- **Priority not re-verified.** The raw export reported "Medium" on every row, conflicting with the v40 read where 5 records had priorityName absent (UFN-70304, UFN-70261, UFN-69781, UFN-68573, UFN-67775). v40 values are retained and the conflict is disclosed rather than silently overwritten.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; 46 existing records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers are 46 Critical / 24 Warning / 0 Healthy, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** The delegated CS mailbox was read for this cycle (25 UFN messages, 13 distinct threads, 2 linking to eligible conversations). Outlook never contributes to ticket counts, queue, buckets, customer health or SLA metrics. The shared nht.cs@unisco.com mailbox remained unreadable (403) and is disclosed as a limitation.

### v39 -> v40 (superseded by v41) (Sep 13 11:16 AM ET -> Sep 13 5:05 PM ET)

- **Net movement: -2 eligible conversations.** The authoritative New+Pending gate moved 349 -> 347 rows (281 New / 66 Pending) inside a 400-row open bucket that still holds 53 Reopen rows.
- **Arrivals are exact and enumerated.** 4 tickets entered the gate: UFN-70689, UFN-70692, UFN-70694, UFN-70703. They resolve to 2 customer labels: Kent Joseph Lim (kent.lim@unisco.com); MODERN INFUSIONS LLC.
- **Departures are exact and enumerated.** 6 tickets left the gate: UFN-70680, UFN-70681, UFN-70682, UFN-70683, UFN-70684, UFN-70685 (wilmer.benitez@unisco.com). These are the 2026-09-13 Appointment Watch / Dropship daily-report series that closed on authoritative status once their report cycle completed - they were not removed by any exclusion rule.
- **No flag or status drift on carried-forward records.** A per-record comparison of opsStatus, closeFlag, isSlaBreached and isOverdue across every v39 eligible ticket still present in the v40 gate returned 0 differences.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All 24 billing-family rows (24/24) and all 5 duplicate conversations (5/5) were present in the live read, so the exclusion set is unchanged. UFN-60009 (Amazon Invoice reference on a BOL request) and UFN-69231 (ODFL PRO-number request) remain retained pending a business ruling.
- **closeFlag evidence unchanged and re-proven.** 19 live \`closeFlag=true\` records remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). All 20 sit on Pending rows that are system-OPEN, which is exactly the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **The UFN-67030 citation is stale.** Authoritative Ticket Ops status for UFN-67030 is Solved (displayStatusSystemStatus 20, closedTime 09/01/2026, displayStatusName "Solved"), so it is excluded on **status**, not on closeFlag. The closeFlag rule stands and is better evidenced by the live closeFlag=true Pending rows (UFN-70443, UFN-70412, UFN-70304, UFN-70243, UFN-70130, UFN-69781).
- **Status-name audit.** The display-status dictionary in use here is New(11), Pending(6), Reopen(1), Solved(2) - there are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending with Reopen excluded by name. No Pending sub-status split is published, because all 66 Pending rows carry a single status "Pending" (id 6).
- **Flagged records remain retained.** The 7 same-load C.H. Robinson pairs are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; 120 existing records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers are 46 Critical / 24 Warning / 0 Healthy, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** The delegated CS mailbox was read for this cycle (25 UFN messages, 13 distinct threads, 2 linking to eligible conversations). Outlook never contributes to ticket counts, queue, buckets, customer health or SLA metrics. The shared nht.cs@unisco.com mailbox remained unreadable (403) and is disclosed as a limitation.

### v38 -> v39 (superseded by v40) (Sep 13 8:41 AM ET -> Sep 13 11:16 AM ET)

- **Net movement: +9 eligible conversations.** The authoritative New+Pending gate moved 340 -> 349 rows (283 New / 66 Pending) inside a 401-row open bucket that still holds 52 Reopen rows.
- **Arrivals are exact and enumerated.** 9 new tickets entered the gate and none departed: UFN-70688, UFN-70687, UFN-70686, UFN-70685, UFN-70684, UFN-70683, UFN-70682, UFN-70681, UFN-70680. They resolve to 4 customer labels: MAIZLY INC.; MODERN INFUSIONS LLC; RISE BEVERAGES LLC dba RISE BREWING COMPANY; wilmer.benitez@unisco.com. Nothing else in the gate moved in status.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All 24 billing-family rows and all 5 duplicate conversations were present in the live read, so the exclusion set is unchanged. UFN-60009 (Amazon Invoice reference on a BOL request) and UFN-69231 (ODFL PRO-number request) remain retained pending a business ruling.
- **closeFlag evidence unchanged and re-proven.** 19 live \`closeFlag=true\` records remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). All 20 sit on Pending rows that are system-OPEN, which is exactly the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **The UFN-67030 citation is stale.** Authoritative Ticket Ops status for UFN-67030 is Solved (displayStatusSystemStatus 20, closedTime 09/01/2026, displayStatusName "Solved"), so it is excluded on **status**, not on closeFlag. The closeFlag rule stands and is better evidenced by the live closeFlag=true Pending rows (UFN-70443, UFN-70412, UFN-70304, UFN-70243, UFN-70130, UFN-69781).
- **Status-name audit.** The display-status dictionary in use here is New(11), Pending(6), Reopen(1), Solved(2) - there are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending with Reopen excluded by name. No Pending sub-status split is published, because all 66 Pending rows carry a single status "Pending" (id 6).
- **Flagged records remain retained.** The 7 same-load C.H. Robinson pairs are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; 126 existing records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers remain 46 Critical / 24 Warning / 0 Healthy, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** Mailbox context was refreshed for this cycle and remains non-blocking: it never contributes to ticket counts, queue, buckets, customer health or SLA metrics.

### v37 -> v38 (Sep 13 6:36 AM ET -> Sep 13 8:41 AM ET)

- **Net movement: +0.** The authoritative New+Pending gate is unchanged at 340 rows (274 New / 66 Pending) inside a 392-row open bucket that still holds 52 Reopen rows. A full ticket-number set diff against v37 returned **zero arrivals and zero departures**, and a per-record comparison of status, closeFlag, SLA and overdue flags matched on all 311 eligible records.
- **Exclusions re-confirmed against the live gate, not re-guessed.** All 24 billing-family rows and all 5 duplicate conversations were present in the live read, so the exclusion set is unchanged. UFN-60009 (Amazon Invoice reference on a BOL request) and UFN-69231 (ODFL PRO-number request) remain retained pending a business ruling.
- **closeFlag evidence unchanged and re-proven.** 19 live `closeFlag=true` records remain in the eligible set (gate-wide 20; UFN-65196 is billing-excluded). All 20 sit on Pending rows that are system-OPEN, which is exactly the auto-close artifact that makes closeFlag unusable as an eligibility gate.
- **The UFN-67030 citation is stale.** It is not in this department's New/Pending or Reopen rows at this read - it closed on **authoritative status**, not on closeFlag. The rule stands and is better evidenced by the live closeFlag=true Pending rows (UFN-70443, UFN-70412, UFN-70243, UFN-69781).
- **Status-name audit.** The display-status dictionary in use here is New(11), Pending(6), Reopen(1), Solved(2) - there are no "Open"-named rows, so the "New / Open / Pending" inclusion rule resolves to New + Pending with Reopen excluded by name. No Pending sub-status split is published, because all 66 Pending rows carry a single status "Pending" (id 6).
- **Flagged records remain retained.** The 7 same-load C.H. Robinson pairs are still carried unchanged pending a business ruling; deduplication continues to collapse only CASE/DN conversation identity.
- **Time-derived fields refreshed.** ageHours/ageDays, action buckets and freshness were recomputed at the new refresh instant; 12 records crossed a whole-day age boundary.
- **Customer Health matches the rendered rule.** All customers visible in eligible tickets are covered (roster/aliases supplemental; the structured list carries an empty roster) and the tiers remain 45 Critical / 25 Warning / 0 Healthy, with Healthy structurally unreachable because every eligible ticket is UFN-tagged.
- **Outlook stayed supplemental.** The cycle re-read the most recent UFN page of the delegated CS mailbox: all 13 UFN threads returned were already in the carried-forward inventory, and 2 threads still link to eligible conversations (UFN-69781, UFN-70261). The nht.cs@unisco.com shared mailbox was not readable this cycle (access denied) and is disclosed as a limitation rather than silently dropped.

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

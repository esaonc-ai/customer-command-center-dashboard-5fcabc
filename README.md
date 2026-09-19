# Customer Command Center Dashboard – NHT/Cesanek

**Facility**: NHT/Cesanek (LT_F21) | **Tenant**: LT | **Timezone**: America/New_York

Deployed at: [customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard](https://customer-command-center-dashboard-5fcabc.coolify.item.pub/dashboard)

Local dashboard preview: `node server.js` (binds to `0.0.0.0:4173`). The same verified snapshot is served at `/dashboard` and `/evidence`.

## Overview

Real-time operational dashboard for monitoring ticket queues, customer health, and action priorities at the NHT/Cesanek facility.

## Ticket Filtering Rules

| Rule | Implementation |
|------|----------------|
| **Include Statuses** | New, Open, Pending |
| **Exclude Statuses** | Reopen, Reopened, Closed, Resolved, Solved, Cancelled, Done |
| **Exclude Invoice Items** | billing, UF Billing, storage, handling, invoice |
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

## Current Dashboard State (Last Refresh: Sep 19 2:26 PM ET - AUTHORITATIVE v47)

| Metric | Value |
|--------|-------|
| Total Raw (system-open UFN, department scope) | **345** = 236 New / 70 Pending / 39 Reopen; New+Pending gate **306** |
| Eligible | **277** conversations (216 New, 0 Open, 61 Pending) |
| Excluded | 29 = 24 billing-family + 5 overlapping conversations; 39 Reopen rows outside the gate |
| Eligible arrivals | **+29**: UFN-69811, UFN-70404, UFN-70980, UFN-71077, UFN-71112, UFN-71124, UFN-71126, UFN-71127, UFN-71131, UFN-71132, UFN-71134, UFN-71143, UFN-71146, UFN-71147, UFN-71148, UFN-71150, UFN-71152, UFN-71161, UFN-71162, UFN-71163, UFN-71164, UFN-71180, UFN-71182, UFN-71194, UFN-71195, UFN-71196, UFN-71197, UFN-71200, UFN-71201 |
| Eligible departures | **-20**: UFN-67551, UFN-68149, UFN-68951, UFN-69334, UFN-70244, UFN-70309, UFN-70413, UFN-70500, UFN-70513, UFN-70825, UFN-70919, UFN-70984, UFN-71027, UFN-71030, UFN-71035, UFN-71056, UFN-71059, UFN-71072, UFN-71079, UFN-71098 |
| closeFlag | **NOT a gate** - 24 live closeFlag=true tickets retained (25 gate-wide) |
| Customers | **123** distinct live customer labels (87 Critical / 36 Warning / 0 Healthy; every ticket-visible customer covered) |
| Priority | 273 Medium / 4 unavailable |
| SLA Risk | **ELEVATED** - 234 SLA-breached / 43 current; 226 unassigned |
| Action Buckets | Immediate **12** / Short-Term **31** / Medium-Term **28** / Watch **206** |
| Outlook Coverage | **Unavailable this cycle** - last observed (v42): 25 UFN messages / 9 distinct threads, latest 2026-09-14T21:46:00Z; stale and supplemental only |
| Last Refresh | 2026-09-19T14:26:00-04:00 (**AUTHORITATIVE v47**, department 323826714354839552) |

## Developer Reconciliation Note

### v46 -> v47 (Sep 19 2:26 PM ET)

- **Live gate.** 345 system-open rows = 236 New / 70 Pending / 39 Reopen. The exact New/Pending UFN gate contains 306 rows.
- **Gate arrivals (29).** UFN-69811, UFN-70404, UFN-70980, UFN-71077, UFN-71112, UFN-71124, UFN-71126, UFN-71127, UFN-71131, UFN-71132, UFN-71134, UFN-71143, UFN-71146, UFN-71147, UFN-71148, UFN-71150, UFN-71152, UFN-71161, UFN-71162, UFN-71163, UFN-71164, UFN-71180, UFN-71182, UFN-71194, UFN-71195, UFN-71196, UFN-71197, UFN-71200, UFN-71201.
- **Gate departures (21).** UFN-67551, UFN-68149, UFN-68951, UFN-69334, UFN-70244, UFN-70309, UFN-70413, UFN-70500, UFN-70513, UFN-70825, UFN-70919, UFN-70984, UFN-71027, UFN-71030, UFN-71035, UFN-71056, UFN-71059, UFN-71072, UFN-71079, UFN-71098, UFN-71107.
- **Eligible arrivals (29).** UFN-69811, UFN-70404, UFN-70980, UFN-71077, UFN-71112, UFN-71124, UFN-71126, UFN-71127, UFN-71131, UFN-71132, UFN-71134, UFN-71143, UFN-71146, UFN-71147, UFN-71148, UFN-71150, UFN-71152, UFN-71161, UFN-71162, UFN-71163, UFN-71164, UFN-71180, UFN-71182, UFN-71194, UFN-71195, UFN-71196, UFN-71197, UFN-71200, UFN-71201.
- **Eligible departures (20).** UFN-67551, UFN-68149, UFN-68951, UFN-69334, UFN-70244, UFN-70309, UFN-70413, UFN-70500, UFN-70513, UFN-70825, UFN-70919, UFN-70984, UFN-71027, UFN-71030, UFN-71035, UFN-71056, UFN-71059, UFN-71072, UFN-71079, UFN-71098.
- **Exclusions.** 24 live billing/UF Billing/storage/handling/invoice-family rows (including the carried-forward F26 Month End Close Reminder rows) and 5 overlapping CASE/DN rows were excluded, yielding 277 eligible conversations.
- **closeFlag evidence.** 24 closeFlag=true rows remain eligible (25 gate-wide); closeFlag was not used as a gate. UFN-67030 is Solved / systemStatus 20 and is outside the open bucket, so the gate is proven by the live closeFlag=true New/Pending rows instead.
- **Customer Health.** All 123 customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.
- **Outlook was unavailable this cycle.** No delegated-mailbox read was performed, so no Outlook value was refreshed. The v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale, and no operational metric depends on them.

### v45 -> v46 (superseded by v47) (Sep 18 5:35 AM ET)

- **Live gate.** 339 system-open rows = 229 New / 69 Pending / 41 Reopen. The exact New/Pending UFN gate contains 298 rows.
- **Gate arrivals (6).** UFN-68537, UFN-71035, UFN-71085, UFN-71093, UFN-71098, UFN-71107.
- **Gate departures (0).** None.
- **Eligible arrivals (5).** UFN-68537, UFN-71035, UFN-71085, UFN-71093, UFN-71098.
- **Eligible departures (0).** None.
- **Exclusions.** 25 live billing/UF Billing/storage/handling/invoice-family rows (including the carried-forward F26 Month End Close Reminder rows) and 5 overlapping CASE/DN rows were excluded, yielding 268 eligible conversations.
- **closeFlag evidence.** 23 closeFlag=true rows remain eligible (24 gate-wide); closeFlag was not used as a gate. UFN-67030 is Solved / systemStatus 20 and is outside the open bucket, so the gate is proven by the live closeFlag=true New/Pending rows instead.
- **Customer Health.** All 118 customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.
- **Outlook was unavailable this cycle.** No delegated-mailbox read was performed, so no Outlook value was refreshed. The v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale, and no operational metric depends on them.

### v44 -> v45 (superseded by v46) (Sep 17 4:05 PM ET)

- **Live gate.** 335 system-open rows = 226 New / 66 Pending / 43 Reopen. The exact New/Pending UFN gate contains 292 rows.
- **Gate arrivals (18).** UFN-70244, UFN-70572, UFN-70596, UFN-71039, UFN-71040, UFN-71053, UFN-71054, UFN-71055, UFN-71056, UFN-71059, UFN-71064, UFN-71065, UFN-71067, UFN-71068, UFN-71072, UFN-71073, UFN-71078, UFN-71079.
- **Gate departures (10).** UFN-63890, UFN-66870, UFN-68064, UFN-69471, UFN-69751, UFN-70774, UFN-70953, UFN-71029, UFN-71033, UFN-71034.
- **Eligible arrivals (17).** UFN-70244, UFN-70572, UFN-70596, UFN-71040, UFN-71053, UFN-71054, UFN-71055, UFN-71056, UFN-71059, UFN-71064, UFN-71065, UFN-71067, UFN-71068, UFN-71072, UFN-71073, UFN-71078, UFN-71079.
- **Eligible departures (10).** UFN-63890, UFN-66870, UFN-68064, UFN-69471, UFN-69751, UFN-70774, UFN-70953, UFN-71029, UFN-71033, UFN-71034.
- **Exclusions.** 24 live billing/UF Billing/storage/handling/invoice-family rows (including the carried-forward F26 Month End Close Reminder rows) and 5 overlapping CASE/DN rows were excluded, yielding 263 eligible conversations.
- **closeFlag evidence.** 21 closeFlag=true rows remain eligible (22 gate-wide); closeFlag was not used as a gate. UFN-67030 is Solved / systemStatus 20 and is outside the open bucket, so the gate is proven by the live closeFlag=true New/Pending rows instead.
- **Customer Health.** All 116 customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.
- **Outlook was unavailable this cycle.** No delegated-mailbox read was performed, so no Outlook value was refreshed. The v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale, and no operational metric depends on them.

### v43 -> v44 (superseded by v45) (Sep 17 10:24 AM ET)

- **Live gate.** 330 system-open rows = 217 New / 67 Pending / 46 Reopen. The exact New/Pending UFN gate contains 284 rows.
- **Gate arrivals (9).** UFN-70436, UFN-71026, UFN-71027, UFN-71029, UFN-71030, UFN-71031, UFN-71032, UFN-71033, UFN-71034.
- **Gate departures (11).** UFN-67452, UFN-68069, UFN-69409, UFN-70851, UFN-70872, UFN-70957, UFN-70973, UFN-70974, UFN-70975, UFN-70982, UFN-70990.
- **Eligible arrivals (9).** UFN-70436, UFN-71026, UFN-71027, UFN-71029, UFN-71030, UFN-71031, UFN-71032, UFN-71033, UFN-71034.
- **Eligible departures (9).** UFN-67452, UFN-68069, UFN-69409, UFN-70851, UFN-70872, UFN-70973, UFN-70974, UFN-70982, UFN-70990.
- **Exclusions.** 23 live billing/UF Billing/storage/handling/invoice-family rows (including the carried-forward F26 Month End Close Reminder rows) and 5 overlapping CASE/DN rows were excluded, yielding 256 eligible conversations.
- **closeFlag evidence.** 20 closeFlag=true rows remain eligible (21 gate-wide); closeFlag was not used as a gate. UFN-67030 is Solved / systemStatus 20 and is outside the open bucket, so the gate is proven by the live closeFlag=true New/Pending rows instead.
- **Customer Health.** All 112 customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.
- **Outlook was unavailable this cycle.** No delegated-mailbox read was performed, so no Outlook value was refreshed. The v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale, and no operational metric depends on them.

### v42 -> v43 (superseded by v44) (Sep 16 6:31 PM ET)

- **Live gate.** 329 system-open rows = 217 New / 69 Pending / 43 Reopen. The exact New/Pending UFN gate contains 286 rows.
- **Gate arrivals (36).** UFN-66934, UFN-68980, UFN-70161, UFN-70298, UFN-70385, UFN-70413, UFN-70753, UFN-70756, UFN-70851, UFN-70858, UFN-70863, UFN-70872, UFN-70873, UFN-70889, UFN-70895, UFN-70918, UFN-70919, UFN-70934, UFN-70946, UFN-70947, UFN-70948, UFN-70949, UFN-70950, UFN-70952, UFN-70953, UFN-70955, UFN-70957, UFN-70971, UFN-70973, UFN-70974, UFN-70975, UFN-70982, UFN-70984, UFN-70987, UFN-70990, UFN-70992.
- **Gate departures (73).** UFN-61170, UFN-67463, UFN-67930, UFN-68025, UFN-68714, UFN-68815, UFN-69462, UFN-69647, UFN-69738, UFN-69797, UFN-70156, UFN-70175, UFN-70184, UFN-70215, UFN-70220, UFN-70244, UFN-70262, UFN-70295, UFN-70302, UFN-70304, UFN-70310, UFN-70311, UFN-70316, UFN-70319, UFN-70350, UFN-70363, UFN-70399, UFN-70406, UFN-70428, UFN-70431, UFN-70466, UFN-70474, UFN-70512, UFN-70517, UFN-70532, UFN-70548, UFN-70556, UFN-70557, UFN-70559, UFN-70565, UFN-70570, UFN-70585, UFN-70595, UFN-70596, UFN-70614, UFN-70730, UFN-70735, UFN-70736, UFN-70745, UFN-70754, UFN-70760, UFN-70765, UFN-70766, UFN-70773, UFN-70776, UFN-70778, UFN-70780, UFN-70781, UFN-70782, UFN-70784, UFN-70790, UFN-70794, UFN-70795, UFN-70796, UFN-70802, UFN-70803, UFN-70805, UFN-70806, UFN-70810, UFN-70826, UFN-70827, UFN-70831, UFN-70840.
- **Eligible arrivals (30).** UFN-66934, UFN-68980, UFN-70161, UFN-70298, UFN-70385, UFN-70413, UFN-70753, UFN-70756, UFN-70851, UFN-70858, UFN-70863, UFN-70872, UFN-70873, UFN-70889, UFN-70895, UFN-70918, UFN-70919, UFN-70934, UFN-70946, UFN-70949, UFN-70953, UFN-70955, UFN-70971, UFN-70973, UFN-70974, UFN-70982, UFN-70984, UFN-70987, UFN-70990, UFN-70992.
- **Eligible departures (64).** UFN-61170, UFN-67463, UFN-68025, UFN-68714, UFN-68815, UFN-69462, UFN-69647, UFN-69738, UFN-69797, UFN-70175, UFN-70184, UFN-70215, UFN-70220, UFN-70244, UFN-70262, UFN-70295, UFN-70302, UFN-70304, UFN-70310, UFN-70311, UFN-70316, UFN-70319, UFN-70363, UFN-70399, UFN-70428, UFN-70431, UFN-70466, UFN-70474, UFN-70512, UFN-70517, UFN-70532, UFN-70548, UFN-70556, UFN-70557, UFN-70559, UFN-70565, UFN-70570, UFN-70585, UFN-70595, UFN-70596, UFN-70614, UFN-70730, UFN-70735, UFN-70736, UFN-70745, UFN-70754, UFN-70760, UFN-70765, UFN-70773, UFN-70776, UFN-70778, UFN-70782, UFN-70784, UFN-70790, UFN-70796, UFN-70802, UFN-70803, UFN-70805, UFN-70806, UFN-70810, UFN-70826, UFN-70827, UFN-70831, UFN-70840.
- **Exclusions.** 25 live billing/UF Billing/storage/handling/invoice-family rows (including the carried-forward F26 Month End Close Reminder rows) and 5 overlapping CASE/DN rows were excluded, yielding 256 eligible conversations.
- **closeFlag evidence.** 20 closeFlag=true rows remain eligible (21 gate-wide); closeFlag was not used as a gate. UFN-67030 is Solved / systemStatus 20 and is outside the open bucket, so the gate is proven by the live closeFlag=true New/Pending rows instead.
- **Customer Health.** All 110 customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.
- **Outlook was unavailable this cycle.** No delegated-mailbox read was possible, so no Outlook value was refreshed. The v42 values (25 messages / 9 threads, latest 2026-09-14T21:46:00Z) are carried forward and labelled stale, and no operational metric depends on them.

### v41 -> v42 (superseded by v43) (Sep 15 6:34 AM ET)

- **Live gate.** 376 system-open rows = 248 New / 75 Pending / 53 Reopen. The exact New/Pending UFN gate contains 323 rows.
- **Gate arrivals (47).** UFN-69409, UFN-69797, UFN-70184, UFN-70399, UFN-70730, UFN-70731, UFN-70732, UFN-70735, UFN-70736, UFN-70745, UFN-70754, UFN-70757, UFN-70760, UFN-70765, UFN-70766, UFN-70770, UFN-70773, UFN-70774, UFN-70776, UFN-70777, UFN-70778, UFN-70779, UFN-70780, UFN-70781, UFN-70782, UFN-70784, UFN-70786, UFN-70789, UFN-70790, UFN-70792, UFN-70794, UFN-70795, UFN-70796, UFN-70800, UFN-70802, UFN-70803, UFN-70805, UFN-70806, UFN-70810, UFN-70816, UFN-70821, UFN-70824, UFN-70825, UFN-70826, UFN-70827, UFN-70831, UFN-70840.
- **Gate departures (76).** UFN-67775, UFN-68537, UFN-68980, UFN-69781, UFN-70124, UFN-70130, UFN-70243, UFN-70333, UFN-70405, UFN-70412, UFN-70440, UFN-70443, UFN-70464, UFN-70465, UFN-70471, UFN-70472, UFN-70473, UFN-70475, UFN-70480, UFN-70481, UFN-70489, UFN-70492, UFN-70493, UFN-70494, UFN-70495, UFN-70496, UFN-70497, UFN-70503, UFN-70529, UFN-70537, UFN-70554, UFN-70572, UFN-70574, UFN-70579, UFN-70580, UFN-70584, UFN-70586, UFN-70587, UFN-70588, UFN-70593, UFN-70594, UFN-70599, UFN-70603, UFN-70605, UFN-70606, UFN-70607, UFN-70608, UFN-70609, UFN-70610, UFN-70613, UFN-70616, UFN-70636, UFN-70637, UFN-70638, UFN-70639, UFN-70642, UFN-70643, UFN-70652, UFN-70659, UFN-70660, UFN-70661, UFN-70662, UFN-70663, UFN-70664, UFN-70686, UFN-70687, UFN-70688, UFN-70689, UFN-70692, UFN-70694, UFN-70703, UFN-70710, UFN-70711, UFN-70712, UFN-70713, UFN-70714.
- **Eligible arrivals (42).** UFN-69409, UFN-69797, UFN-70184, UFN-70399, UFN-70730, UFN-70731, UFN-70732, UFN-70735, UFN-70736, UFN-70745, UFN-70754, UFN-70757, UFN-70760, UFN-70765, UFN-70770, UFN-70773, UFN-70774, UFN-70776, UFN-70777, UFN-70778, UFN-70779, UFN-70782, UFN-70784, UFN-70786, UFN-70789, UFN-70790, UFN-70792, UFN-70796, UFN-70800, UFN-70802, UFN-70803, UFN-70805, UFN-70806, UFN-70810, UFN-70816, UFN-70821, UFN-70824, UFN-70825, UFN-70826, UFN-70827, UFN-70831, UFN-70840.
- **Eligible departures (75).** UFN-67775, UFN-68537, UFN-68980, UFN-69781, UFN-70124, UFN-70130, UFN-70243, UFN-70333, UFN-70405, UFN-70412, UFN-70440, UFN-70443, UFN-70464, UFN-70465, UFN-70471, UFN-70472, UFN-70473, UFN-70475, UFN-70480, UFN-70481, UFN-70489, UFN-70492, UFN-70493, UFN-70494, UFN-70495, UFN-70496, UFN-70497, UFN-70503, UFN-70529, UFN-70537, UFN-70554, UFN-70572, UFN-70574, UFN-70579, UFN-70580, UFN-70584, UFN-70586, UFN-70587, UFN-70588, UFN-70593, UFN-70594, UFN-70599, UFN-70603, UFN-70605, UFN-70606, UFN-70607, UFN-70608, UFN-70609, UFN-70610, UFN-70616, UFN-70636, UFN-70637, UFN-70638, UFN-70639, UFN-70642, UFN-70643, UFN-70652, UFN-70659, UFN-70660, UFN-70661, UFN-70662, UFN-70663, UFN-70664, UFN-70686, UFN-70687, UFN-70688, UFN-70689, UFN-70692, UFN-70694, UFN-70703, UFN-70710, UFN-70711, UFN-70712, UFN-70713, UFN-70714.
- **Exclusions.** 23 live billing/UF Billing/storage/handling/invoice-family rows and 10 overlapping CASE/DN rows were excluded, yielding 290 eligible conversations.
- **closeFlag evidence.** 16 closeFlag=true rows remain eligible (17 gate-wide); closeFlag was not used as a gate. UFN-67030 was independently re-read as Solved / system 20 / closeFlag=true, so authoritative status keeps it out.
- **Customer Health.** All 125 customer labels visible in eligible live tickets are included; roster and aliases are supplemental only.
- **Outlook stayed supplemental.** 25 UFN messages, 9 distinct threads, latest 2026-09-14T21:46:00Z; only UFN-70731 is eligible. nht.cs@unisco.com returned 403 and requires Mail.Read.Shared; mirrored delegated traffic changed no operational metric.
- **Field availability.** Organization names were not returned by the live page response. Customer Health uses customerName/customerEmail and excludes no ticket-visible customer.

### v40 -> v41 (superseded by v42) (Sep 13 5:05 PM ET -> Sep 13 10:31 PM ET)

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

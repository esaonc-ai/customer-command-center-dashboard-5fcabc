#!/usr/bin/env python3
"""Build the NHT/Cesanek Customer Command Center refresh artifacts.

Authoritative source: _refresh/eligible-rows.json (row export from Ticket Ops,
dept 323826714354839552, gate = displayStatusSystemStatus open AND displayStatusName
in {New, Pending}; billing / UF Billing / storage / handling invoice items removed).
Derived sections are computed here so every published count is reproducible.
"""
import json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS = os.path.join(ROOT, "_refresh", "eligible-rows.json")

REFRESH_ID = "refresh-2026-09-21T02:18ET-AUTHORITATIVE"
TS = "2026-09-21T02:18:00-04:00"
PREV_ID = "refresh-2026-09-15T23:45ET-AUTHORITATIVE"

rows = json.load(open(ROWS))
ids = [r["ticketId"] for r in rows]
assert len(set(ids)) == len(ids), "duplicate ticketIds"
print("rows:", len(rows), "| unique:", len(set(ids)))

# ---------------- counts ----------------
by_status = collections.Counter(r["opsStatus"] for r in rows)
by_prio = collections.Counter(r["priority"] for r in rows)
breached = [r for r in rows if r["slaStatus"] == "Breached"]
ontrack = [r for r in rows if r["slaStatus"] == "On Track"]
unassigned = [r for r in rows if not r["assigned"].strip()]
aging15 = [r for r in rows if r["ageDays"] >= 15]
pending_breached = [r for r in rows if r["opsStatus"] == "Pending" and r["slaStatus"] == "Breached"]
closeflag_true = [r for r in rows if r["closeFlag"]]
no_org = [r for r in rows if not r["customer"].strip()]
oldest = max(r["ageDays"] for r in rows)

print("by status:", dict(by_status), "| by priority:", dict(by_prio))
print("breached:", len(breached), "ontrack:", len(ontrack), "unassigned:", len(unassigned))
print("aging15+:", len(aging15), "| pendingBreached:", len(pending_breached),
      "| closeFlagTrue:", len(closeflag_true), "| noOrg:", len(no_org), "| oldest:", oldest)

# ---------------- action buckets ----------------
BUCKETS = collections.OrderedDict()
BUCKETS["Automated report / notification series"] = [
    "advanced report - dock activity", "dropship order daily report", "oms alert",
    "reminder: send vivo damage report", "canceled: midea call", "backlog report",
    "business partner update", "lowe's vendor today",
    "packaging and packaging waste regulation", "vendor training hub",
    "month end close reminder", "vendor information review", "weekly stats",
    "shipping notice", "meeting report", "product identifier",
    "warehouse inbound report", "past pickup report", "visibility only",
    "corrugate procurement"]
BUCKETS["Claims / damage / returns"] = ["claim", "return authorization", "returns", "damage", "misship"]
BUCKETS["Facility move-out / transfer"] = ["move out", "facility closure", "building closure",
                                           "termination", "inventory transition", "transfer", "migrated"]
BUCKETS["Appointment / carrier pickup requests"] = ["appointment", "appt", "pickup", "pick up",
                                                    "pick-up", "p/u", "booking note",
                                                    "delivery request", "final pick-up"]
BUCKETS["Order commit-blocked / failed & order-status exceptions"] = [
    "commit block", "backlog", "order status", "not scanned", "overdue", "open orders",
    "open drop ship", "drop ship order", "uom issue", "short shipped", "no order",
    "expired inventory", "please dispose", "empty confirmation", "status update",
    "still on dock", "stock transfer", "shipped"]
CATCHALL = "Other customer service / ops"
BUCKETS[CATCHALL] = []


def classify(subject):
    s = subject.lower()
    for name, keys in BUCKETS.items():
        for k in keys:
            if k in s:
                return name
    return CATCHALL


hits = collections.defaultdict(list)
for r in rows:
    hits[classify(r["subject"])].append(r["ticketId"])

action_buckets = collections.OrderedDict()
for name in BUCKETS:
    got = hits.get(name, [])
    action_buckets[name] = {"count": len(got), "examples": got[:6], "ticketIds": got}
assert sum(v["count"] for v in action_buckets.values()) == len(rows), "bucket total mismatch"

# ---------------- customer health ----------------
cust = collections.defaultdict(lambda: {"tickets": 0, "breached": 0, "oldestBreachedAgeDays": 0})
for r in rows:
    key = r["customer"].strip() or "(no organization on ticket)"
    d = cust[key]
    d["tickets"] += 1
    if r["slaStatus"] == "Breached":
        d["breached"] += 1
        d["oldestBreachedAgeDays"] = max(d["oldestBreachedAgeDays"], r["ageDays"])
for key, d in cust.items():
    d["tier"] = "Healthy" if d["breached"] == 0 else (
        "Critical" if d["oldestBreachedAgeDays"] > 30 else "Warning")
cust_sorted = collections.OrderedDict(sorted(cust.items(), key=lambda kv: (-kv[1]["tickets"], kv[0])))
tiers = collections.Counter(d["tier"] for d in cust.values())
print("customers:", len(cust_sorted), "| tiers:", dict(tiers))

# ---------------- priority queue ----------------
pq_rows = sorted(rows, key=lambda r: (-r["ageDays"], -r["ageHours"]))[:15]
priority_queue = []
for r in pq_rows:
    priority_queue.append({
        "ticketId": r["ticketId"],
        "customer": r["customer"] or "(no organization on ticket)",
        "subject": r["subject"].strip(),
        "ageDays": r["ageDays"],
        "ageHours": r["ageHours"],
        "slaStatus": r["slaStatus"],
        "opsStatus": r["opsStatus"],
    })

# ---------------- evidence metrics ----------------
DEDUP_NOTE = ("No verifiable overlap removals this refresh. Thread relations are not exposed on the IAM "
              "ticket surface (staff-scoped /v1/staff/tickets/{id}/relations and /merged-tickets return 401; "
              "IAM brief/page omit parentId). Same-title candidate clusters, unverified as relations: "
              "UFN-70351/70352, UFN-59238/59777, UFN-69661/69663, UFN-69447/69307/69450, UFN-71194/71230, "
              "UFN-71195/71197/71200, UFN-71146/71143, UFN-71233/71236, UFN-71032/71031, UFN-70285/70308, "
              "UFN-67024/67031.")
PREMISE_NOTE = ("The refresh premise cited UFN-67030 as live-Pending with closeFlag=true. Two independent "
                "Ticket Ops lookups (brief + search) both return displayStatusName=Solved, "
                "displayStatusSystemStatus=20, closeFlag=true, closedTime 2026-09-01 16:56:56 - it is closed "
                "and excluded by STATUS, not by closeFlag. The closeFlag-not-a-gate rule still stands on its "
                "own: 24 live Pending rows in this set genuinely carry closeFlag=true "
                "(e.g. UFN-70980, 71077, 70821, 70756, 66934, 70161).")
DATE_NOTE = ("Ticket timestamps are rendered by the source as UTC calendar dates. Switching to true "
             "America/New_York (EDT) dates would shift 16 created rows and 5 lastUpdated rows back one day. "
             "Kept the source-rendered date for continuity with the existing baked dataset; not reconciled.")

evidence = collections.OrderedDict()
evidence["totalEligible"] = len(rows)
evidence["slaBreached"] = len(breached)
evidence["slaOnTrack"] = len(ontrack)
evidence["unassigned"] = len(unassigned)
evidence["oldestAgeDays"] = oldest
evidence["aging15Plus"] = len(aging15)
evidence["pendingSlaBreached"] = len(pending_breached)
evidence["billingExcluded"] = 23
evidence["reopenExcluded"] = 38
evidence["dedupRemovals"] = 0
evidence["closeFlagTrueRetained"] = len(closeflag_true)
evidence["highUrgentCount"] = 0
evidence["ticketsWithNoOrganization"] = len(no_org)
evidence["outlookStatus"] = "unavailable"
evidence["outlookThreadsMatched"] = 0
evidence["outlookThreadsUniquePostDedup"] = 0
evidence["outlookDirectEligibleMatches"] = 0
evidence["activeEscalations"] = 0
evidence["dedupNote"] = DEDUP_NOTE
evidence["premiseCorrectionNote"] = PREMISE_NOTE
evidence["dateSemanticsNote"] = DATE_NOTE
evidence["slaConflictNote"] = (
    "SLA verdicts in this dataset are the source's own per-row slaStatus, and are reproducible from the "
    "published rows: Breached 282 / On Track 6. They do NOT reconcile with two other figures seen for the same "
    "population: the same Ticket Ops pull reported a summary of 240 breached / 48 on-track, and the currently "
    "deployed dashboard build carries 242 overdue-and-SLA-breached. The discrepancy is a threshold/derivation "
    "difference that has NOT been resolved. Treat the SLA panel as provisional until the breach window is "
    "confirmed; every other count on this dashboard is directly reconciled to the 288 published rows.")

# ---------------- manifest ----------------
manifest = collections.OrderedDict()
manifest["refresh"] = collections.OrderedDict([
    ("id", REFRESH_ID),
    ("timestamp", TS),
    ("type", "AUTHORITATIVE"),
    ("previousRefreshId", PREV_ID),
    ("timezone", "America/New_York"),
    ("keyChange",
     "Fresh TicketOps department enumeration: gate (displayStatusSystemStatus=open AND displayStatusName in "
     "{New,Pending}) = 311 (New 241 / Pending 70). Minus 23 billing/storage/handling invoice items = 288 "
     "eligible (227 New / 61 Pending). Reopen (38, systemStatus open) excluded by status name. closeFlag NOT "
     "a gate: 24 live closeFlag=true rows retained. Zero dedup removals - thread relations are not exposed on "
     "the IAM ticket surface, so no overlap removal could be verified. Outlook context unavailable and recorded "
     "as such rather than carried forward."),
])
manifest["rulesApplied"] = [
    "displayStatusSystemStatus == open (10) - authoritative gate",
    "displayStatusName in {New, Pending} - Reopen/Reopened/Closed/Resolved/Cancelled/Done excluded (Reopen 38)",
    "closeFlag NOT used as an eligibility gate (24 live closeFlag=true rows retained; auto-close artifacts cause false negatives)",
    "exclude billing / UF Billing / storage / handling invoice items (23; matched on ticket title tokens billing|invoice|handling|storage, plus topicId=379244474622894080)",
    "UFN-prefix filter (department UNIS Fulfillment - Northampton, departmentId 323826714354839552 - the only department carrying UFN- tickets for LT_F21)",
    "Overlapping ticket/email threads: NOT deduped this refresh - relations not retrievable via IAM (401); candidate clusters flagged",
    "Customer Health coverage = all customers visible in eligible tickets; roster/aliases supplemental only",
]
manifest["dataSources"] = [
    {"name": "TicketOps",
     "endpoint": "POST /v1/iam/tickets/page",
     "note": ("displayStatusSystemStatus=[10]; departmentIds=[323826714354839552]; full department "
              "enumeration; 288 eligible rows with ticketId, customer, opsStatus, priority, subject(title), "
              "createdDate, lastUpdated, assigned, closeFlag, ageDays, ageHours, slaStatus")},
    {"name": "Outlook",
     "note": ("external app agent; non-blocking enrichment; UNAVAILABLE this refresh (no content returned on "
              "2 attempts). outlook-context.json reset to an explicit unavailable state; prior "
              "2026-09-04..09-15 thread set superseded and retained in git history only")},
]

dashboard_state = collections.OrderedDict()
dashboard_state["totalRaw"] = 349
dashboard_state["totalRawNote"] = "systemStatus=open rows = New 241 + Pending 70 + Reopen 38"
dashboard_state["reopenExcluded"] = 38
dashboard_state["gateMatched"] = 311
dashboard_state["billingExcluded"] = 23
dashboard_state["dedupRemovals"] = 0
dashboard_state["totalEligible"] = len(rows)
dashboard_state["closeFlagTrueRetained"] = len(closeflag_true)
dashboard_state["byStatus"] = {"New": by_status["New"], "Pending": by_status["Pending"], "Open": 0}
dashboard_state["byPriority"] = dict(by_prio)
dashboard_state["customerHealth"] = {
    "totalCustomers": len(cust_sorted),
    "tiers": {"Critical": tiers["Critical"], "Warning": tiers["Warning"], "Healthy": tiers["Healthy"]},
    "tierRule": ("Critical = >=1 breached ticket older than 30d; Warning = breached <=30d; "
                 "Healthy = no breaches"),
    "coverageRule": "all customers visible in eligible tickets; roster/aliases supplemental only",
    "customers": cust_sorted,
}
dashboard_state["priorityQueue"] = priority_queue
dashboard_state["actionBuckets"] = action_buckets
dashboard_state["actionBucketMethod"] = ("rule-based subject-keyword classification (no bucket field exists on "
                                         "the ticket); buckets are mutually exclusive and exhaustive over the "
                                         "eligible rows")
dashboard_state["evidenceMetrics"] = evidence
manifest["dashboardState"] = dashboard_state

manifest["delivery"] = collections.OrderedDict([
    ("surface", "static data mirror in nweber00/customer-command-center-dashboard-5fcabc"),
    ("note", ("The production URL serves a separate managed Next.js app that reads live, authenticated "
              "/api/tickets. This repository's baked JSON is the audit/evidence mirror and is what this refresh "
              "updates. Data-layer validation only; the authenticated production UI could not be exercised from "
              "this session.")),
])
manifest["nextScheduledRefresh"] = "2026-09-21T08:00:00-04:00"

# ---------------- structured list ----------------
structured = collections.OrderedDict()
structured["dashboard"] = "Customer Command Center Dashboard"
structured["facility"] = {"code": "LT_F21", "name": "NHT/Cesanek", "tenant": "LT",
                          "timezone": "America/New_York"}
structured["lastRefreshed"] = TS
structured["dataSource"] = "TicketOps (authoritative)"
structured["refreshType"] = "AUTHORITATIVE"
structured["totalRaw"] = 349
structured["gateMatched"] = 311
structured["totalEligible"] = len(rows)
structured["newCount"] = by_status["New"]
structured["openCount"] = 0
structured["pendingCount"] = by_status["Pending"]
structured["truncationNote"] = ("closeFlag not a gate (24 retained); Reopen (38) and billing/storage/handling "
                                "(23) excluded; dedup removals 0 (relations not retrievable via IAM)")
structured["slaHealth"] = {"breached": len(breached), "onTrack": len(ontrack),
                           "unassigned": len(unassigned)}
structured["evidenceMetrics"] = {"totalEligible": len(rows), "slaBreached": len(breached),
                                 "slaOnTrack": len(ontrack), "unassigned": len(unassigned),
                                 "oldestAgeDays": oldest, "outlookStatus": "unavailable",
                                 "outlookThreadsMatched": 0, "outlookDirectEligibleMatches": 0}

# ---------------- outlook: explicit unavailable ----------------
outlook = collections.OrderedDict()
outlook["refreshWindow"] = {"from": "2026-09-15", "to": "2026-09-21", "tz": "America/New_York"}
outlook["status"] = "unavailable"
outlook["note"] = ("Outlook enrichment unavailable this refresh (external app agent returned no content on two "
                   "attempts). No thread data is asserted for this window. The prior 2026-09-04..2026-09-15 "
                   "thread set (60 matched / 53 unique) is superseded and retained in git history only; coverage "
                   "metrics are zeroed rather than carried forward as current.")
outlook["threadsMatched"] = 0
outlook["threadsUniquePostDedup"] = 0
outlook["ticketThreads"] = []

# ---------------- write ----------------
written = []
for base in ("public/data", "dashboard/data"):
    d = os.path.join(ROOT, base)
    os.makedirs(d, exist_ok=True)
    targets = [("tickets.json", rows), ("refresh-manifest.json", manifest),
               ("outlook-context.json", outlook)]
    if base == "public/data":
        targets.append(("structured_list.json", structured))
    for fn, obj in targets:
        p = os.path.join(d, fn)
        with open(p, "w") as f:
            json.dump(obj, f, indent=1, ensure_ascii=False)
            f.write("\n")
        written.append(p)

print("\nwritten:")
for p in written:
    print("   %-34s %8d bytes" % (os.path.relpath(p, ROOT), os.path.getsize(p)))

# ---------------- README state section ----------------
L = []
L.append("## Current Dashboard State (Last Refresh: Sep 21 2026 02:18 ET - AUTHORITATIVE)\n")
L.append("| Metric | Value |")
L.append("|--------|-------|")
L.append("| Total Raw (systemStatus=open) | 349 = New 241 + Pending 70 + Reopen 38 |")
L.append("| Gate matched | 311 (New 241, Pending 70) |")
L.append("| Eligible | **%d** (%d New, 0 Open, %d Pending) |"
         % (len(rows), by_status["New"], by_status["Pending"]))
L.append("| UFN-Count | %d |" % len(rows))
L.append("| Excluded | 23 billing/UF Billing/storage/handling; 38 Reopen outside gate; "
         "0 dedup removals (thread relations not retrievable) |")
L.append("| closeFlag | **NOT a gate** - %d live `closeFlag=true` rows retained |" % len(closeflag_true))
L.append("| Customers | **%d** distinct orgs (all customers visible in eligible tickets; roster supplemental) |"
         % len(cust_sorted))
L.append("| SLA Risk | **%d breached / %d on-track** (provisional - see conflict note) |"
         % (len(breached), len(ontrack)))
L.append("| Unassigned | %d of %d |" % (len(unassigned), len(rows)))
L.append("| Outlook Coverage | **Unavailable this refresh** - 0 threads asserted |")
L.append("| Last Refresh | 2026-09-21 02:18 ET (AUTHORITATIVE - full department enumeration) |")
L.append("| Next Refresh | ~08:00 ET (daily summary email) |")
L.append("")
L.append("### Action Buckets\n")
L.append("Buckets are a rule-based classification of the ticket subject. No bucket field exists on the "
         "ticket, so treat the counts as derived, not sourced. Buckets are mutually exclusive and exhaustive "
         "over the %d eligible rows.\n" % len(rows))
L.append("| Bucket | Count | Examples |")
L.append("|--------|-------|----------|")
for name, v in action_buckets.items():
    L.append("| **%s** | %d | %s |" % (name, v["count"],
             ", ".join(v["examples"][:4]) if v["examples"] else "-"))
L.append("")
L.append("### Customer Health (top 12 by ticket count)\n")
L.append("Tier rule: Critical = at least one breached ticket older than 30d; Warning = breached <=30d; "
         "Healthy = no breaches.\n")
L.append("| Customer | Tickets | Breached | Oldest breach (d) | Tier |")
L.append("|----------|---------|----------|-------------------|------|")
for c, d in list(cust_sorted.items())[:12]:
    L.append("| %s | %d | %d | %d | %s |"
             % (c, d["tickets"], d["breached"], d["oldestBreachedAgeDays"], d["tier"]))
L.append("")
L.append("### Priority Queue (top 10 by age)\n")
L.append("| Rank | Ticket | Customer | Status | Age (d) | SLA | Subject |")
L.append("|------|--------|----------|--------|---------|-----|---------|")
for i, r in enumerate(pq_rows[:10], 1):
    L.append("| %d | %s | %s | %s | %d | %s | %s |"
             % (i, r["ticketId"], r["customer"] or "(no org)", r["opsStatus"], r["ageDays"],
                r["slaStatus"], r["subject"].strip()[:60]))
L.append("")
L.append("### Caveats and corrections (this refresh)\n")
L.append("- **UFN-67030 premise corrected.** The instruction cited it as live-Pending with "
         "`closeFlag=true`. Two independent Ticket Ops lookups return `displayStatusName=Solved`, "
         "`displayStatusSystemStatus=20`, `closeFlag=true`, closed 2026-09-01 16:56:56. It is excluded by "
         "**status**, not by closeFlag. The closeFlag-not-a-gate rule still stands independently: "
         "%d live Pending rows in this set genuinely carry `closeFlag=true`." % len(closeflag_true))
L.append("- **Deduplication not applied.** Thread relations (parent/child, merged, SHARE_THREAD) are not "
         "exposed on the IAM ticket surface - `/v1/staff/tickets/{id}/relations` and `/merged-tickets` return "
         "401, and the IAM brief/page payloads omit `parentId`. No overlap removal could be verified, so 0 "
         "removals were made and same-title candidate clusters are flagged instead of silently dropped. This "
         "is a **change from the Sep 15 refresh, which removed 5**; that figure was not reproducible here.")
L.append("- **SLA conflict (unresolved).** Published values are the source's per-row `slaStatus` and are "
         "reproducible from the published rows: %d breached / %d on-track. The same pull reported a summary of "
         "240/48, and the currently deployed build carries 242 overdue-and-SLA-breached. The threshold "
         "difference has not been reconciled - treat the SLA panel as provisional."
         % (len(breached), len(ontrack)))
L.append("- **Date semantics.** Ticket timestamps are rendered as UTC calendar dates. True "
         "America/New_York (EDT) dates would move 16 created rows and 5 lastUpdated rows back one day. The "
         "source-rendered date was kept for continuity with the existing dataset.")
L.append("- **Outlook unavailable.** The Outlook agent returned no content on two attempts. "
         "`outlook-context.json` is reset to an explicit unavailable state rather than carrying the Sep 4-15 "
         "thread set forward as if current; that set remains in git history.")
L.append("- **Delivery surface.** The production URL serves a managed Next.js app that reads live, "
         "authenticated `/api/tickets`. This repository's JSON is the audit/evidence mirror and is what this "
         "refresh updates. The authenticated production UI could not be exercised from this session, so this "
         "is data-layer validation only.")
L.append("")

readme_path = os.path.join(ROOT, "README.md")
readme = open(readme_path).read()
START = "## Current Dashboard State"
END = "## Data Files"
i, j = readme.index(START), readme.index(END)
new_readme = readme[:i] + "\n".join(L) + "\n" + readme[j:]
open(readme_path, "w").write(new_readme)
print("\nREADME.md rewritten: state section replaced (%d -> %d chars)" % (len(readme), len(new_readme)))

print("\n--- SUMMARY ---")
print("eligible:", len(rows), "| New", by_status["New"], "| Pending", by_status["Pending"])
print("breached:", len(breached), "| onTrack:", len(ontrack), "| unassigned:", len(unassigned))
print("customers:", len(cust_sorted), dict(tiers))
print("oldest:", oldest, "| aging15+:", len(aging15), "| closeFlagTrue:", len(closeflag_true))
print("buckets:")
for k, v in action_buckets.items():
    print("   %4d  %s" % (v["count"], k))
print("pq top5:", [(r["ticketId"], r["customer"], r["ageDays"]) for r in pq_rows[:5]])

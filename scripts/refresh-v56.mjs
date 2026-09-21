#!/usr/bin/env node
// v56 refresh - NHT/Cesanek Customer Command Center.
// Authoritative live Ticket Ops read 2026-09-21T19:37Z (department 323826714354839552,
// displayStatusSystemStatus=10) -> 329 distinct open-system rows:
//   228 New / 65 Pending / 36 Reopen.  New+Pending gate = 293.
// The gate was captured to scripts/gate-live-2026-09-21T1937Z-v56.tsv and set-compared
// against the persisted v55 capture. Every departure was independently re-verified on
// authoritative status via GET /v1/iam/tickets/brief/number/{ticket}.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const REFERENCE = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference')+1] : '2026-09-21T15:37:00-04:00';
const VERSION='v56', REFRESH_ID=`refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID='refresh-2026-09-21T14:00:00-04:00-AUTHORITATIVE-v55';
const DEPT='323826714354839552', READ_UTC='2026-09-21T19:37:00Z', REF_ET='Sep 21 3:37 PM ET';
const OPEN=329, OPEN_NEW=228, OPEN_PENDING=65, OPEN_REOPEN=36, GATE=293;
const API_TOTAL=329;
const BILLING=['UFN-33719','UFN-40670','UFN-41484','UFN-43725','UFN-45559','UFN-48436','UFN-53491','UFN-54721','UFN-55641','UFN-59971','UFN-60573','UFN-61451','UFN-62682','UFN-63762','UFN-63959','UFN-68749','UFN-69234','UFN-70140','UFN-70947','UFN-70950','UFN-70952'];
const DUPES=['UFN-69447','UFN-69450','UFN-69661','UFN-69663','UFN-70352','UFN-71127'];
const EXPECTED_DEPARTURES=['UFN-70596','UFN-70731','UFN-70779','UFN-71270','UFN-71283','UFN-71295','UFN-71298'];
const refMs=new Date(REFERENCE).getTime(); if(!Number.isFinite(refMs)) throw new Error('bad ref');
const hrs=iso=>(refMs-new Date(iso).getTime())/36e5;
const j=v=>`${JSON.stringify(v,null,2)}\n`;

const prev=JSON.parse(readFileSync('dashboard/data/tickets.json','utf8'));
const prevM=JSON.parse(readFileSync('dashboard/data/refresh-manifest.json','utf8'));
const live=readFileSync('scripts/gate-live-2026-09-21T1937Z-v56.tsv','utf8').trim().split('\n')
  .map(l=>{const [id,st]=l.split('\t');return {id:id.trim(),st:st.trim()};});
const stMap=new Map(); for(const r of live) stMap.set(r.id,r.st);
const gateSet=new Set(stMap.keys());
console.log('live gate rows',live.length,'unique',stMap.size);
if(stMap.size!==GATE) throw new Error('gate changed: '+stMap.size);
const stCount={}; for(const s of stMap.values()) stCount[s]=(stCount[s]||0)+1;
if(stCount.New!==OPEN_NEW||stCount.Pending!==OPEN_PENDING) throw new Error('status split changed: '+JSON.stringify(stCount));
for(const b of BILLING) if(!gateSet.has(b)) throw new Error('billing row missing: '+b);
for(const d of DUPES) if(!gateSet.has(d)) throw new Error('dupe missing: '+d);
if(!gateSet.has('UFN-35588')) throw new Error('UFN-35588 guard failed');

/* arrivals: full stored-shape records. Five brand-new 09/21 tickets (read directly from the live
   page response) plus UFN-70756, which re-entered the gate (it left at v55) and was recovered
   from the persisted v54 stored shape, with updatedAt refreshed from the authoritative read. */
const A=(id,created,updated,cust,mail,status,subject,due,staff,closeFlag,overdue,breached,conv)=>(
 {ticketId:id,customer:cust,customerEmail:mail,displayStatusName:status,sourceChannel:2,topicTitle:'UF General Inquiry',
  subject,createdAt:created,updatedAt:updated,dueDate:due,opsStatus:status,displayStatusSystemStatus:10,priority:'Medium',
  priorityNameSource:'ticket',prioritySourceMissing:false,createdDate:created.slice(0,10),lastUpdated:updated.slice(0,10),
  assigned:staff||'Unassigned',closeFlag, slaStatus:(breached||overdue)?'Breached':'On Track',isOverdue:overdue,isSlaBreached:breached,
  conversationId:conv||null});
const ARRIVALS=[
 A('UFN-71312','2026-09-21T19:22:26Z','2026-09-21T19:22:36Z','kyle.wittenbauer@colavita.com','kyle.wittenbauer@colavita.com','New','Transfers for 9/22 from UNIS','2026-09-24T16:23:00Z',null,false,false,false),
 A('UFN-71308','2026-09-21T18:55:41Z','2026-09-21T18:55:47Z','ting.d@tcl.com','ting.d@tcl.com','New','RE: Delivery cost inquiry','2026-09-24T15:56:00Z',null,false,false,false),
 A('UFN-71307','2026-09-21T18:49:45Z','2026-09-21T19:29:36Z','Shailene Baez (shailene.baez@unisco.com)','shailene.baez@unisco.com','New','TO626 - Central Transport','2026-09-24T15:50:00Z',null,false,false,false),
 A('UFN-71306','2026-09-21T18:47:24Z','2026-09-21T18:47:25Z','Tclna','tclna@arcb.com','New','801158169 Routing Notification','2026-09-24T15:48:00Z',null,false,false,false),
 A('UFN-71304','2026-09-21T18:26:24Z','2026-09-21T18:43:39Z','fernando@avironactive.com','fernando@avironactive.com','New','Aviron-UNIS Somerset go live: Thank You and Next Steps','2026-09-24T15:27:00Z',null,false,false,false),
 A('UFN-70756','2026-09-14T14:59:21Z','2026-09-21T13:10:44Z','rona.roopchand@smegusa.com','rona.roopchand@smegusa.com','Pending','RE: Almi Interiors ACC#10036032 PO#912026','2026-09-16T21:00:00Z','Erin Cambra',true,true,true),
];
const arrIds=ARRIVALS.map(a=>a.ticketId);
/* Live closeFlag drift, enumerated rather than silently overwritten. A targeted authoritative
   re-read (GET /v1/iam/tickets/brief/number/UFN-70992) confirmed the v55 snapshot stored
   closeFlag=false while the live row is closeFlag=true. Only this one carried-over row drifted. */
const LIVE_CLOSEFLAG_DRIFT={'UFN-70992':true};
const EXPECTED_CLOSEFLAG_TRUE=23;
const stayed=[]; for(const t of prev) if(gateSet.has(t.ticketId)&&!BILLING.includes(t.ticketId)&&!DUPES.includes(t.ticketId)) stayed.push(t);
for(const t of stayed) if(Object.prototype.hasOwnProperty.call(LIVE_CLOSEFLAG_DRIFT,t.ticketId)) t.closeFlag=LIVE_CLOSEFLAG_DRIFT[t.ticketId];
const dropped=prev.map(p=>p.ticketId).filter(id=>!stayed.some(s=>s.ticketId===id)&&!arrIds.includes(id));
const droppedSorted=dropped.slice().sort();
if(JSON.stringify(droppedSorted)!==JSON.stringify(EXPECTED_DEPARTURES.slice().sort())) throw new Error('unexpected departures: '+droppedSorted.join(','));
const tickets=[...stayed.map(t=>({...t, displayStatusName:stMap.get(t.ticketId)==='Pending'?'Pending':'New'})),...ARRIVALS]
  .map(t=>{const h=Math.max(0,hrs(t.createdAt));return {...t,ageHours:Math.floor(h),ageDays:Math.floor(h/24)};})
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const total=tickets.length;
if(total!==GATE-BILLING.length-DUPES.length) throw new Error('eligible total mismatch: '+total);
const byStatus={New:tickets.filter(t=>t.displayStatusName==='New').length,Open:0,Pending:tickets.filter(t=>t.displayStatusName==='Pending').length};
const breached=tickets.filter(t=>t.isSlaBreached||t.isOverdue||/breach/i.test(t.slaStatus||''));
const onTrack=tickets.filter(t=>!breached.includes(t));
const byPriority=tickets.reduce((a,t)=>{const k=t.priority||'unavailable';a[k]=(a[k]||0)+1;return a;},{});
const dueDerived=tickets.filter(t=>t.dueDate&&new Date(t.dueDate).getTime()<refMs).length;
const queue=[...tickets].sort((a,b)=>Number(breached.includes(b))-Number(breached.includes(a))||String(a.dueDate??'9999').localeCompare(String(b.dueDate??'9999'))||b.ageHours-a.ageHours).slice(0,15)
  .map(t=>({ticketId:t.ticketId,customer:t.customer,subject:t.subject,ageDays:t.ageDays,ageHours:t.ageHours,slaStatus:breached.includes(t)?'Breached':'On Track'}));
const bucket=h=>h<24?'Immediate':h<72?'Short-Term':h<168?'Medium-Term':'Watch';
const actionBuckets={Immediate:0,'Short-Term':0,'Medium-Term':0,Watch:0};
for(const t of tickets) actionBuckets[bucket(t.ageHours)]++;
const byC=new Map();
for(const t of tickets){const n=t.customer||t.customerEmail||'Unknown';const r=byC.get(n)||{tickets:0,breached:0,oldestBreachedAgeDays:0,olderThan7d:0};
 r.tickets++; if(breached.includes(t)){r.breached++; r.oldestBreachedAgeDays=Math.max(r.oldestBreachedAgeDays,t.ageDays);} if(t.ageDays>7)r.olderThan7d++; byC.set(n,r);}
const customers={},tiers={Critical:0,Warning:0,Healthy:0};
for(const [n,r] of byC){const share=r.tickets?r.olderThan7d/r.tickets:0;
 const tier=(share>=0.5||r.tickets>=3)?'Critical':(share>=0.25||r.tickets>=1)?'Warning':'Healthy';
 tiers[tier]++; customers[n]={tickets:r.tickets,breached:r.breached,oldestBreachedAgeDays:r.oldestBreachedAgeDays,tier};}
const sortedC=Object.fromEntries(Object.entries(customers).sort((a,b)=>b[1].tickets-a[1].tickets||a[0].localeCompare(b[0])));
const closeFlagTrueRetained=tickets.filter(t=>t.closeFlag===true).length;
const closeFlagTrueList=tickets.filter(t=>t.closeFlag===true).map(t=>t.ticketId).sort();
if(closeFlagTrueRetained!==EXPECTED_CLOSEFLAG_TRUE) throw new Error('closeFlag=true retained changed: '+closeFlagTrueRetained);
const unassigned=tickets.filter(t=>/unassigned/i.test(t.assigned||'')).length;
const oldestAgeDays=tickets.reduce((m,t)=>Math.max(m,t.ageDays),0);
const outlook={status:'unavailable',threadsMatched:25,distinctThreads:9,threadsLinkedToEligibleTickets:3,stale:true,lastObservedUtc:'2026-09-14T21:46:00Z'};
const summary={reference:REFERENCE,eligible:total,byStatus,gate:{total:GATE,New:OPEN_NEW,Pending:OPEN_PENDING},openBucket:OPEN,
 actionBuckets,customerHealth:{total:byC.size,tiers},priorityQueueTop:queue[0],sla:{breached:breached.length,current:onTrack.length},
 closeFlagTrueRetained,unassigned,oldestAgeDays,stayed:stayed.length,arrivals:arrIds.length,departures:dropped.length};
console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--write')){console.log('(dry run)');process.exit(0);}

writeFileSync('dashboard/data/tickets.json',j(tickets)); copyFileSync('dashboard/data/tickets.json','public/data/tickets.json');
const m=prevM;
m.refresh={id:REFRESH_ID,timestamp:REFERENCE,type:'AUTHORITATIVE',previousRefreshId:PREVIOUS_REFRESH_ID,status:'complete',
 keyChange:`Live Ticket Ops read returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) vs 332 at v55, and a ${GATE}-row New+Pending gate vs 294. Eligible conversations fall to ${total} (${byStatus.New} New / ${byStatus.Pending} Pending) = ${arrIds.length} arrivals / ${dropped.length} departures. 21 billing-family rows and 6 overlap losers remain excluded. closeFlag still not a gate (${closeFlagTrueRetained} retained). Outlook unavailable (non-blocking).`};
m.dataSources=[
 {name:'Ticket Ops',endpoint:'POST /v1/iam/tickets/page',query:{page:1,size:100,input:{departmentIds:[DEPT],displayStatusSystemStatus:[10]}},
  rawCapture:'scripts/gate-live-2026-09-21T1937Z-v56.tsv ('+GATE+' New/Pending gate rows with display status); scripts/gate-live-2026-09-21-v56.txt (gate ticket numbers)',
  note:`Authoritative paged read at ${READ_UTC}: ${OPEN} distinct open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. In this read the response total field (${API_TOTAL}) matched the distinct returned row count, so the v55 off-by-one did not reproduce; distinct rows are used regardless. All ${EXPECTED_DEPARTURES.length} gate departures were individually re-read via /v1/iam/tickets/brief/number/{ticket} and confirmed displayStatusSystemStatus 20 (CLOSED).`},
 {name:'Outlook',note:'Unavailable again this cycle (two read attempts returned no result); last observed v42 values (25 messages / 9 distinct threads) carried forward as stale context only. Outlook remains non-blocking.'}];
m.developerNotes=[
 `v56 live read: ${OPEN} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; UFN New/Pending gate ${GATE}. Movement vs v55 (-3 open rows, -1 gate row) is verified by set comparison, not asserted.`,
 `Gate membership was captured to scripts/gate-live-2026-09-21T1937Z-v56.tsv and set-compared against the persisted v55 capture (scripts/gate-live-2026-09-21-v55.txt): 6 arrivals, 7 departures, 0 status-drift on carried-over rows.`,
 `ARRIVALS to the gate (${arrIds.length}): ${arrIds.join(', ')} - five brand-new 09/21 tickets (UFN-71304, UFN-71306, UFN-71307, UFN-71308, UFN-71312) plus UFN-70756, which left the gate at v55 and returned live as Pending / displayStatusSystemStatus 10 / closeFlag true.`,
 `DEPARTURES from the gate (${droppedSorted.length}): ${droppedSorted.join(', ')}. Each one was individually re-read on authoritative status and confirmed CLOSED (displayStatusSystemStatus 20): UFN-70596 Solved 18:35, UFN-71283 "No Action Needed" 18:43, UFN-71295 Solved 18:11, UFN-71298 Solved 18:11, UFN-70779 Solved 19:02, UFN-70731 Solved 19:03, UFN-71270 Solved 19:11. None was a transcription gap.`,
 `Billing-family exclusions are unchanged at ${BILLING.length} and all ${BILLING.length} rows were re-verified present in the live gate. The 6 CASE/DN overlap losers (UFN-69447/69450 -> UFN-69307 CASE-21836552091; UFN-69661/69663 -> UFN-69511 CASE-21861000021; UFN-70352 -> UFN-70351 DN-2107462; UFN-71127 -> UFN-71073 DN-2131002) are all still present. Eligible = ${GATE} - ${BILLING.length} - ${DUPES.length} = ${total}.`,
 `closeFlag=true is STILL not an eligibility gate. ${closeFlagTrueRetained} live closeFlag=true rows are retained as eligible. Live evidence this cycle: UFN-70756 re-entered the gate as a Pending/system-open row carrying closeFlag=true with firstClosedTime 2026-09-14 20:33 - the textbook auto-close artifact this rule protects against. Full retained list: ${closeFlagTrueList.join(', ')}.`,
 `STATUS-PREMISE CONFLICT, re-disclosed rather than applied: the request again cites "UFN-67030 is live-Pending with closeFlag=true". Two independent authoritative reads this cycle do not support it. GET /v1/iam/tickets/brief/number/UFN-67030 returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), displayStatusId 2, closeFlag true, closedTime 2026-09-01 16:56:56, updateTime 2026-09-21 11:39:08. It is not returned by the displayStatusSystemStatus=[10] query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New,Pending}; closeFlag never a gate) is already exactly what this dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS. The correct closeFlag counter-evidence is the ${closeFlagTrueRetained} eligible live closeFlag=true rows.`,
 `Priority and assignee fields were NOT re-derived from the page response for carried-over rows: priorityName is "Medium" on every returned row (conflicting with the stored ${byPriority.Medium??0} Medium / ${byPriority.unavailable??0} unavailable split) and staffName is omitted on many rows the stored snapshot shows as assigned. Stored per-ticket values are retained; the 6 arrivals carry their observed values.`,
 `SLA/workload: carried-over rows keep their stored isSlaBreached/isOverdue flags (v55 methodology); the 6 arrivals add 1 breached row (UFN-70756). A dueDate-derived cross-check flags ${dueDerived} rows as past due vs ${breached.length} on stored flags - disclosed, not silently substituted.`,
 `Customer Health covers all ${byC.size} customer labels visible on the ${total} eligible records; roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.`,
 `Age-derived sections recomputed at the v56 reference time (${REFERENCE}): action buckets, Customer Health tiers, priority queue and SLA counts shown in dashboardState.`,
 `Outlook was unavailable again; carried-forward stale values were not used in any ticket, queue, bucket, health or SLA metric.`];
m.dashboardState={totalRaw:OPEN,totalRawDepartmentWide:OPEN,eligibleBeforeExclusions:GATE,reopenExcluded:OPEN_REOPEN,
 billingExcluded:BILLING.length,billingClosedSinceV55:[],
 eligibleBeforeDeduplication:GATE-BILLING.length,
 duplicatesRemoved:DUPES.length,totalEligible:total,closeFlagTrueRetained,closeFlagTrueRetainedList:closeFlagTrueList,byStatus,byPriority,
 workload:{overdueOrSlaBreached:breached.length,current:onTrack.length,dueDerivedBreached:dueDerived},actionBuckets,
 customerHealth:{totalCustomers:byC.size,tiers,tierRule:prevM.dashboardState.customerHealth.tierRule,customers:sortedC},
 priorityQueue:queue,
 evidenceMetrics:{totalEligible:total,slaBreached:breached.length,slaOnTrack:onTrack.length,unassigned,oldestAgeDays,
  outlookStatus:outlook.status,outlookThreadsMatched:outlook.threadsMatched,outlookDistinctThreads:outlook.distinctThreads,
  outlookThreadsLinkedToEligibleTickets:outlook.threadsLinkedToEligibleTickets,outlookStale:true,outlookLastObservedUtc:outlook.lastObservedUtc,
  invoiceItemsExcluded:BILLING.length,duplicatesRemoved:DUPES.length,closeFlagTrueRetained,arrivalsThisCycle:arrIds.length,departuresThisCycle:dropped.length}};
m.excludedThisCycle={reopenByStatusName:OPEN_REOPEN,billingFamily:BILLING,billingFamilyClosedSinceV55:[],duplicateConversations:DUPES,
 eligibleDepartures:droppedSorted,eligibleArrivals:arrIds.slice().sort()};
m.reconciliation={gate:{total:GATE,New:OPEN_NEW,Pending:OPEN_PENDING},openSystemBucket:OPEN,Reopen:OPEN_REOPEN,
 billingExcluded:BILLING.length,duplicateConversationsExcluded:DUPES.length,eligibleConversations:total,
 carriedOverFromV55:stayed.length,eligibleArrivals:arrIds.length,eligibleDepartures:dropped.length,
 apiTotalFieldOverReport:'None observed this cycle: the endpoint reported total='+API_TOTAL+' for '+OPEN+' distinct rows. Distinct row set used.',
 note:`Gate set-compared against the persisted v55 capture: 6 gate arrivals, 7 gate departures (all 7 CLOSED on authoritative status). Eligible = 267 - 7 + 6 = ${total}.`};
m.rulesApplied=m.rulesApplied.map(s=>/billing, UF Billing, storage/.test(s)?`${BILLING.length} live billing, UF Billing, storage, handling or invoice-family rows are excluded`:s);
m.exclusions.billingTicketIds=BILLING;
m.exclusions.billingClosedSinceV55=[];
if(m.exclusions.duplicateConversations) m.exclusions.duplicateConversations=DUPES;
m.verifiedAgainst=`Live Ticket Ops paged read ${READ_UTC} (department ${DEPT}, displayStatusSystemStatus=10), captured to scripts/gate-live-2026-09-21T1937Z-v56.tsv and set-compared against scripts/gate-live-2026-09-21-v55.txt; all 7 gate departures individually re-verified on authoritative status via GET /v1/iam/tickets/brief/number/{ticket}`;
m.nextScheduledRefresh='2026-09-21T22:00:00-04:00';
writeFileSync('dashboard/data/refresh-manifest.json',j(m)); copyFileSync('dashboard/data/refresh-manifest.json','public/data/refresh-manifest.json');

const snap={refreshId:REFRESH_ID,refreshedAt:REFERENCE,totalRaw:OPEN,totalGateRows:GATE,totalEligible:total,
 excludedCount:BILLING.length+DUPES.length,duplicatesRemoved:DUPES.length,invoiceItemsExcluded:BILLING.length,
 closeFlagTrueRetained,arrivalsThisCycle:arrIds.length,departuresThisCycle:dropped.length,outlookStatus:outlook.status,
 outlookThreadsMatched:outlook.threadsMatched,version:VERSION};
for(const p of ['config.json','dashboard/config.json','public/config.json']){const c=JSON.parse(readFileSync(p,'utf8'));c.snapshotMetrics=snap;
 c.outlook={integration:'non_blocking',useWhenAvailable:true,status:outlook.status,lastObservedUtc:outlook.lastObservedUtc,stale:true};
 c.ticketFilters.excludeInvoiceItems=['billing','UF Billing','storage','handling','invoice']; writeFileSync(p,j(c));}

const oc=JSON.parse(readFileSync('dashboard/data/outlook-context.json','utf8'));
oc.generatedAt=REFERENCE; oc.lastRefreshed=REFERENCE;
oc.staleness={reason:'No Outlook read was possible this cycle (two delegated-mailbox read attempts returned no result); last observed v42 values retained for context only.',lastObservedUtc:outlook.lastObservedUtc,lastObservedCycle:'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42'};
oc.coverage={eligibleTicketsTotal:total,eligibleTicketsWithOutlookContext:outlook.threadsLinkedToEligibleTickets,coveragePct:Number(((outlook.threadsLinkedToEligibleTickets/total)*100).toFixed(2)),note:'Stale context only; no Outlook read performed this cycle.'};
if(oc.thisCycleRead) oc.thisCycleRead.note='No Outlook read was possible this cycle.';
writeFileSync('dashboard/data/outlook-context.json',j(oc)); copyFileSync('dashboard/data/outlook-context.json','public/data/outlook-context.json');

const structured={dashboard:'Customer Command Center Dashboard',facility:{code:'LT_F21',name:'NHT/Cesanek',tenant:'LT',timezone:'America/New_York'},
 lastRefreshed:REFERENCE,dataSource:'Ticket Ops (authoritative); Outlook unavailable this cycle',refreshType:'AUTHORITATIVE',refreshId:REFRESH_ID,version:VERSION,
 totalRaw:OPEN,eligibleBeforeExclusions:GATE,eligibleBeforeDeduplication:GATE-BILLING.length,totalEligible:total,
 newCount:byStatus.New,openCount:0,pendingCount:byStatus.Pending,
 exclusionSummary:{reopen:OPEN_REOPEN,billingFamily:BILLING.length,overlappingConversations:DUPES.length},
 closeFlagTrueRetained,closeFlagTrueGate:null,
 slaHealth:{breached:breached.length,onTrack:onTrack.length,unassigned},
 actionBuckets,evidenceMetrics:m.dashboardState.evidenceMetrics,
 outlook:{status:outlook.status,stale:true,messagesRetrieved:outlook.threadsMatched,distinctThreads:outlook.distinctThreads,threadsLinkedToEligibleTickets:outlook.threadsLinkedToEligibleTickets,lastObservedUtc:outlook.lastObservedUtc},
 customers:{total:byC.size,tiers,tierRule:m.dashboardState.customerHealth.tierRule},
 excludedCount:BILLING.length+DUPES.length,duplicatesRemoved:DUPES.length,invoiceItemsExcluded:BILLING.length,
 customerCount:byC.size,customerHealthTiers:tiers,slaBreached:breached.length,slaOnTrack:onTrack.length,unassigned,oldestAgeDays,
 outlookStatus:outlook.status,outlookThreadsMatched:outlook.threadsMatched,outlookThreadsLinkedToEligibleTickets:outlook.threadsLinkedToEligibleTickets,
 arrivalsThisCycle:arrIds.length,departuresThisCycle:dropped.length,outlookDistinctThreads:outlook.distinctThreads,
 eligibleArrivals:arrIds.slice().sort(),eligibleDepartures:droppedSorted,
 billingFamilyExclusions:BILLING,billingFamilyClosedSinceV55:[],overlapLosers:DUPES};
writeFileSync('public/data/structured_list.json',j(structured));

let rm=readFileSync('README.md','utf8');
const tierText=`${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const state=`## Current Dashboard State (Last Refresh: ${REF_ET} - AUTHORITATIVE v56)\n\n| Metric | Value |\n|--------|-------|\n| Total Raw (system-open UFN, department scope) | **${OPEN}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate **${GATE}** (distinct rows used) |\n| Eligible | **${total}** conversations (${byStatus.New} New, 0 Open, ${byStatus.Pending} Pending) - ${arrIds.length} arrivals / ${dropped.length} departures vs v55 |\n| Excluded | ${BILLING.length+DUPES.length} = ${BILLING.length} billing-family + ${DUPES.length} overlapping conversations; ${OPEN_REOPEN} Reopen rows outside the gate |\n| Eligible arrivals | **${arrIds.length}** |\n| Eligible departures | **${dropped.length}** |\n| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained (incl. re-entering UFN-70756) |\n| Customers | **${byC.size}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |\n| Priority | ${byPriority.Medium??0} Medium / ${byPriority.unavailable??0} unavailable |\n| SLA Risk | **ELEVATED** - ${breached.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |\n| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |\n| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |\n| Last Refresh | ${REFERENCE} (**AUTHORITATIVE v56**, department ${DEPT}) |\n\n`;
rm=rm.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/,state);
const note=`### v55 -> v56 (Sep 21 2:00 PM ET -> ${REF_ET})\n\n- **Net movement: -1 eligible conversation (267 -> ${total}).** The live read returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen), down 3 from 332, and a ${GATE}-row gate, down 1 from 294. 6 arrivals vs 7 departures.\n- **Movement is verified, not asserted.** The ${GATE}-row gate is captured to scripts/gate-live-2026-09-21T1937Z-v56.tsv and set-compared against the persisted v55 capture; arrival/departure lists are computed, and the script aborts if the computed departures differ from the enumerated set.\n- **All 7 departures were individually re-verified CLOSED** (displayStatusSystemStatus 20) rather than assumed: UFN-70596 Solved 18:35, UFN-71283 "No Action Needed" 18:43, UFN-71295 Solved 18:11, UFN-71298 Solved 18:11, UFN-70779 Solved 19:02, UFN-70731 Solved 19:03, UFN-71270 Solved 19:11. No transcription gap was mistaken for a departure.\n- **6 arrivals:** five brand-new 09/21 tickets (UFN-71304 Aviron-UNIS Somerset go-live, UFN-71306 + UFN-71308 TCL, UFN-71307 TO626 Central Transport, UFN-71312 Colavita transfers) plus **UFN-70756**, which left the gate at v55 and returned live as Pending / system-open / closeFlag=true (firstClosedTime 09/14) - a clean example of the auto-close artifact.\n- **Billing exclusions stay at ${BILLING.length}** and all ${BILLING.length} were re-verified in the gate; the 6 CASE/DN overlap losers are unchanged.\n- **closeFlag is still not a gate.** ${closeFlagTrueRetained} live closeFlag=true rows are retained; UFN-70756 is the new arrival among them.\n- **Status premise re-disclosed:** "UFN-67030 is live-Pending with closeFlag=true" remains unsupported - UFN-67030 is Solved / displayStatusSystemStatus 20 (CLOSED), closed 09/01, and is not in the [10] population. The rule the request asks for is already what the dashboard does; UFN-67030 stays out on authoritative status.\n- **Endpoint note:** this cycle's page read reported total=${API_TOTAL} for ${OPEN} distinct rows, so the v55 off-by-one did not reproduce; distinct rows are used regardless.\n- **Age-derived sections recomputed** at ${REFERENCE}: SLA ${breached.length} breached / ${onTrack.length} current; buckets ${actionBuckets.Immediate}/${actionBuckets['Short-Term']}/${actionBuckets['Medium-Term']}/${actionBuckets.Watch}; Customer Health ${tierText} across ${byC.size} labels.\n- **Outlook unavailable again** (non-blocking; two attempts returned no result, stale v42 values only).\n\n`;
if(!rm.includes('### v55 -> v56 (')) rm=rm.replace('## Developer Reconciliation Note\n\n',`## Developer Reconciliation Note\n\n${note}`);
writeFileSync('README.md',rm);
writeFileSync('scripts/gate-live-2026-09-21-v56.txt',[...gateSet].sort().join('\n')+'\n');
console.log('WROTE v56 artifacts. eligible='+total);

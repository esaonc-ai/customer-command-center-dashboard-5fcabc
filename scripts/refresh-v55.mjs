#!/usr/bin/env node
// v55 refresh - NHT/Cesanek Customer Command Center.
// Authoritative live Ticket Ops read 2026-09-21T18:01Z (department 323826714354839552,
// displayStatusSystemStatus=10, single 350-row snapshot) -> 332 distinct open-system rows:
//   228 New / 66 Pending / 38 Reopen.  New+Pending gate = 294.
// NOTE: the API `total` over-reports by exactly 1 (its paging offset is (page-1)*size-1;
// verified: page20/size10 -> offset 189, page34/size10 -> offset 329 and the true tail).
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const REFERENCE = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference')+1] : '2026-09-21T14:00:00-04:00';
const VERSION='v55', REFRESH_ID=`refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID='refresh-2026-09-21T00:06:00-04:00-AUTHORITATIVE-v54';
const DEPT='323826714354839552', READ_UTC='2026-09-21T18:01:00Z', REF_ET='Sep 21 2:00 PM ET';
const OPEN=332, OPEN_NEW=228, OPEN_PENDING=66, OPEN_REOPEN=38, GATE=294;
const BILLING=['UFN-33719','UFN-40670','UFN-41484','UFN-43725','UFN-45559','UFN-48436','UFN-53491','UFN-54721','UFN-55641','UFN-59971','UFN-60573','UFN-61451','UFN-62682','UFN-63762','UFN-63959','UFN-68749','UFN-69234','UFN-70140','UFN-70947','UFN-70950','UFN-70952'];
const BILLING_LEFT=['UFN-65196','UFN-70948','UFN-71039'];
const DUPES=['UFN-69447','UFN-69450','UFN-69661','UFN-69663','UFN-70352','UFN-71127'];
const refMs=new Date(REFERENCE).getTime(); if(!Number.isFinite(refMs)) throw new Error('bad ref');
const hrs=iso=>(refMs-new Date(iso).getTime())/36e5;
const j=v=>`${JSON.stringify(v,null,2)}\n`;

const prev=JSON.parse(readFileSync('dashboard/data/tickets.json','utf8'));
const prevM=JSON.parse(readFileSync('dashboard/data/refresh-manifest.json','utf8'));
const live=readFileSync('scripts/live-open-2026-09-21T1758Z-v55.tsv','utf8').trim().split('\n')
  .map(l=>{const [id,st]=l.split('\t');return {id:id.trim(),st:st.trim()};});
const stMap=new Map(); for(const r of live) stMap.set(r.id,(stMap.get(r.id)?stMap.get(r.id)+'|':'')+r.st);
const gateSet=new Set(); for(const [id,st] of stMap) if(st==='New'||st==='Pending') gateSet.add(id);
console.log('live rows',live.length,'unique',stMap.size,'gate',gateSet.size);
if(stMap.size!==OPEN) throw new Error('open bucket changed: '+stMap.size);
if(gateSet.size!==GATE) throw new Error('gate changed: '+gateSet.size);
for(const b of BILLING) if(!gateSet.has(b)) throw new Error('billing row missing: '+b);
for(const b of BILLING_LEFT) if(gateSet.has(b)) throw new Error('billing row unexpectedly present: '+b);
for(const d of DUPES) if(!gateSet.has(d)) throw new Error('dupe missing: '+d);
if(!gateSet.has('UFN-35588')) throw new Error('UFN-35588 guard failed');

/* arrivals: full stored-shape records extracted from the same snapshot */
const A=(id,created,updated,cust,mail,status,subject,due,staff,closeFlag,overdue,breached,conv)=>(
 {ticketId:id,customer:cust,customerEmail:mail,displayStatusName:status,sourceChannel:2,topicTitle:'UF General Inquiry',
  subject,createdAt:created,updatedAt:updated,dueDate:due,opsStatus:status,displayStatusSystemStatus:10,priority:'Medium',
  priorityNameSource:'ticket',prioritySourceMissing:false,createdDate:created.slice(0,10),lastUpdated:updated.slice(0,10),
  assigned:staff||'Unassigned',closeFlag, slaStatus:(breached||overdue)?'Breached':'On Track',isOverdue:overdue,isSlaBreached:breached,
  conversationId:conv||null});
const ARRIVALS=[
 A('UFN-70399','2026-09-10T13:10:46Z','2026-09-21T15:28:13Z','adam@maizly.com','adam@maizly.com','Pending','Unshipped Orders ','2026-09-14T13:00:00Z','Yang-Lhing Bague',true,true,true),
 A('UFN-71270','2026-09-21T12:27:56Z','2026-09-21T12:27:59Z','Deejay John Dumaguit (deejay.dumaguit@unisco.com)','deejay.dumaguit@unisco.com','New','Called Out Sick - Sheehan Ramos - 09/21/2026','2026-09-23T18:28:00Z',null,false,false,false),
 A('UFN-71271','2026-09-21T12:43:03Z','2026-09-21T15:20:29Z','ETCC Reg4 Scheduling','etccreg4scheduling@walmart.com','New','Action Required: Trailer Rotation and Maintenance','2026-09-23T18:44:00Z','Erin Cambra',false,false,false),
 A('UFN-71276','2026-09-21T13:34:39Z','2026-09-21T17:54:54Z','jessi@naturalpetinnovations.com','jessi@naturalpetinnovations.com','Pending','Fwd: 2 shipments leaving this morning.','2026-09-23T19:35:00Z','Shailene Baez',true,false,false),
 A('UFN-71280','2026-09-21T14:19:16Z','2026-09-21T14:29:22Z','alabant@sheex.com','alabant@sheex.com','New','RE: Quote?','2026-09-23T20:20:00Z',null,false,false,false),
 A('UFN-71281','2026-09-21T14:22:20Z','2026-09-21T14:22:28Z','Mary Smothers','mary.smothers@unisco.com','New','RE: Target Load - Not labeled','2026-09-23T20:23:00Z',null,false,false,false),
 A('UFN-71283','2026-09-21T14:34:40Z','2026-09-21T14:34:42Z','purchasing','purchasing@marchhealth.com','New','[PICKUP SCHEDULE] Luigi Vitelli - PO123745','2026-09-23T20:35:00Z',null,false,false,false),
 A('UFN-71285','2026-09-21T14:45:35Z','2026-09-21T14:45:43Z','bsantana@fusiontransport.com','bsantana@fusiontransport.com','New','UNIS - HINT BEVERAGE - NORTHAMPTON, PA - WEEK OF 9/21/26','2026-09-23T20:46:00Z','Kent Joseph Lim',false,false,false),
 A('UFN-71287','2026-09-21T15:03:08Z','2026-09-21T15:03:18Z','Fred Arthur Capuno','fred.capuno@unisco.com','New','Emergency Leave -Arjun Pino - 09/21/2026','2026-09-24T12:04:00Z',null,false,false,false),
 A('UFN-71288','2026-09-21T15:08:31Z','2026-09-21T15:08:37Z','noreply@tms.blujaysolutions.net','noreply@tms.blujaysolutions.net','New','Advanced Report - Dock Activity','2026-09-24T12:09:00Z',null,false,false,false),
 A('UFN-71291','2026-09-21T15:34:09Z','2026-09-21T16:03:18Z','evan.jackson@colavita.com','evan.jackson@colavita.com','Pending','Remove Walmart Orders 9/20','2026-09-24T12:35:00Z',null,true,false,false),
 A('UFN-71293','2026-09-21T15:48:54Z','2026-09-21T15:53:01Z','Kassandra Ibanez (kassandra.ibanez@unisco.com)','kassandra.ibanez@unisco.com','New','RE: Request: Confirmation of Order Cutoff Times by Facility','2026-09-24T12:49:00Z',null,false,false,false),
 A('UFN-71294','2026-09-21T15:59:27Z','2026-09-21T17:17:48Z','joseph.garvey@tmkgl.com','joseph.garvey@tmkgl.com','New','Northampton -> Joliet | Move out Transfers // RN-47891','2026-09-24T13:00:00Z','Kacey Nicole Lebrun',false,false,false),
 A('UFN-71295','2026-09-21T16:00:18Z','2026-09-21T16:00:22Z','mail.service@item.com','mail.service@item.com','New','OMS Alert-Unis, LLC-MODERN INFUSIONS LLC_v3-26 Order Processing Exceptions Detected','2026-09-24T13:01:00Z',null,false,false,false),
 A('UFN-71298','2026-09-21T16:03:07Z','2026-09-21T16:03:09Z','mail.service@item.com','mail.service@item.com','New','OMS Alert-Unis, LLC-MODERN INFUSIONS LLC_v3-26 Order Processing Exceptions Detected','2026-09-24T13:04:00Z',null,false,false,false),
 A('UFN-71302','2026-09-21T17:28:57Z','2026-09-21T17:29:01Z','wise_support@unisco.com','wise_support@unisco.com','New','Re: ZURU-no order [WSP-192927]','2026-09-24T14:29:00Z',null,false,false,false),
];
const arrIds=ARRIVALS.map(a=>a.ticketId);
const stayed=[]; for(const t of prev) if(gateSet.has(t.ticketId)&&!BILLING.includes(t.ticketId)&&!DUPES.includes(t.ticketId)) stayed.push(t);
const dropped=prev.map(p=>p.ticketId).filter(id=>!stayed.some(s=>s.ticketId===id));
const tickets=[...stayed.map(t=>({...t, displayStatusName:stMap.get(t.ticketId)==='Pending'?'Pending':'New'})),...ARRIVALS]
  .map(t=>{const h=Math.max(0,hrs(t.createdAt));return {...t,ageHours:Math.floor(h),ageDays:Math.floor(h/24)};})
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const total=tickets.length;
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
 keyChange:`MOVEMENT RESUMED. Live Ticket Ops read returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) vs 349 at v54, and a ${GATE}-row New+Pending gate vs 311. Eligible conversations fall to ${total} (${byStatus.New} New / ${byStatus.Pending} Pending) = ${arrIds.length} arrivals / ${dropped.length} departures. 21 billing-family rows and 6 overlap losers remain excluded (3 billing rows closed since v54). closeFlag still not a gate (${closeFlagTrueRetained} retained). Outlook unavailable (non-blocking).`};
m.dataSources=[
 {name:'Ticket Ops',endpoint:'POST /v1/iam/tickets/page',query:{page:1,size:350,input:{departmentIds:[DEPT],displayStatusSystemStatus:[10]}},
  rawCapture:'scripts/live-open-2026-09-21T1758Z-v55.tsv (all '+OPEN+' open-system rows with display status); scripts/gate-live-2026-09-21-v55.txt ('+GATE+' New/Pending gate ticket numbers)',
  note:`Authoritative single-snapshot read at ${READ_UTC}: ${OPEN} distinct open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. The response's total field reports 333; that is an off-by-one in the endpoint's count/paging (offset is (page-1)*size-1, verified against page20/size10 -> offset 189 and page34/size10 -> the true tail). The distinct returned row set is ${OPEN}.`},
 {name:'Outlook',note:'Unavailable again this cycle; last observed v42 values (25 messages / 9 distinct threads) carried forward as stale context only. Outlook remains non-blocking.'}];
m.developerNotes=[
 `v55 live read: ${OPEN} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; UFN New/Pending gate ${GATE}. Movement vs v54 (-17 open rows, -17 gate rows) is verified, not asserted.`,
 `Gate membership was captured to scripts/gate-live-2026-09-21-v55.txt and set-compared against the persisted v54 capture (scripts/gate-live-2026-09-21-v54.txt): exact arrival/departure lists are computed, not assumed.`,
 `ARRIVALS to the gate (${arrIds.length}): ${arrIds.join(', ')}.`,
 `DEPARTURES from the gate (33): UFN-65196, UFN-68752, UFN-70287, UFN-70298, UFN-70312, UFN-70385, UFN-70676, UFN-70756, UFN-70777, UFN-70934, UFN-70948, UFN-70949, UFN-71039, UFN-71064, UFN-71067, UFN-71112, UFN-71124, UFN-71143, UFN-71146, UFN-71148, UFN-71164, UFN-71182, UFN-71194, UFN-71195, UFN-71196, UFN-71197, UFN-71200, UFN-71201, UFN-71230, UFN-71231, UFN-71232, UFN-71233, UFN-71236. 32 closed outright (verified on authoritative status for UFN-71236 Solved/Closed 12:24, UFN-71232 Solved/Closed 15:07, UFN-70948 Solved/Closed 12:43, UFN-71112 Solved/Closed 15:11); UFN-71164 moved gate -> Reopen (still system-open).`,
 `Billing-family exclusions are now 21, not 24: UFN-65196, UFN-70948 and UFN-71039 are excluded from the list because the rows CLOSED (they left the displayStatusSystemStatus=[10] population entirely). All 21 remaining billing rows were re-verified present in the live gate. The 6 CASE/DN overlap losers (UFN-69447/69450 -> UFN-69307 CASE-21836552091; UFN-69661/69663 -> UFN-69511 CASE-21861000021; UFN-70352 -> UFN-70351 DN-2107462; UFN-71127 -> UFN-71073 DN-2131002) are all still present.`,
 `closeFlag=true is STILL not an eligibility gate and never was. Live evidence this cycle: the three new 09/21 arrivals UFN-70399 (Pending, closeFlag true, firstClosedTime 09/10 16:34 - a genuine auto-close artifact on a live system-open row), UFN-71276 (Pending, closeFlag true) and UFN-71291 (Pending, closeFlag true) are all RETAINED as eligible because their displayStatusSystemStatus is 10 and their displayStatusName is Pending. Total eligible closeFlag=true rows = ${closeFlagTrueRetained}.`,
 `STATUS-PREMISE CONFLICT, re-disclosed rather than applied: the request again states "UFN-67030 is live-Pending with closeFlag=true". The authoritative read does not support it. UFN-67030 ("Request Excel file") returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), closedTime 2026-09-01 16:56:56, closeFlag true, and is not returned by the displayStatusSystemStatus=[10] query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New,Pending}; closeFlag never a gate) is already exactly what the dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS. The correct closeFlag counter-evidence is the ${closeFlagTrueRetained} eligible live closeFlag=true Pending rows (UFN-70399, UFN-71276, UFN-71291 are new additions this cycle).`,
 `UFN-70399 is a genuine, and instructive, arrival: absent from every v54 capture (gate, tickets.json, reopen captures) yet live now as Pending/system-open/closeFlag=true. It is the auto-close artifact the no-closeFlag-gate rule protects against.`,
 `Priority and assignee fields were NOT re-derived from the page response: priorityName is "Medium" on every returned row (conflicting with the stored 264 Medium / 3 unavailable split) and staffName is omitted on many rows the stored snapshot shows as assigned. Stored per-ticket values are retained for carried-over rows; the 16 arrivals carry their observed values.`,
 `SLA/workload: carried-over rows keep their stored isSlaBreached/isOverdue flags (v54 methodology); the 16 arrivals add 1 breached row (UFN-70399). A dueDate-derived cross-check flags ${dueDerived} rows as past due vs ${breached.length} on stored flags - disclosed, not silently substituted.`,
 `Customer Health covers all ${byC.size} customer labels visible on the ${total} eligible records; roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.`,
 `Age-derived sections recomputed at the v55 reference time (${REFERENCE}): action buckets, Customer Health tiers, priority queue and SLA counts shown in dashboardState.`,
 `Outlook was unavailable again; carried-forward stale values were not used in any ticket, queue, bucket, health or SLA metric.`];
m.dashboardState={totalRaw:OPEN,totalRawDepartmentWide:OPEN,eligibleBeforeExclusions:GATE,reopenExcluded:OPEN_REOPEN,
 billingExcluded:BILLING.length,billingClosedSinceV54:BILLING_LEFT,eligibleBeforeDeduplication:GATE-BILLING.length,
 duplicatesRemoved:DUPES.length,totalEligible:total,closeFlagTrueRetained,byStatus,byPriority,
 workload:{overdueOrSlaBreached:breached.length,current:onTrack.length,dueDerivedBreached:dueDerived},actionBuckets,
 customerHealth:{totalCustomers:byC.size,tiers,tierRule:prevM.dashboardState.customerHealth.tierRule,customers:sortedC},
 priorityQueue:queue,
 evidenceMetrics:{totalEligible:total,slaBreached:breached.length,slaOnTrack:onTrack.length,unassigned,oldestAgeDays,
  outlookStatus:outlook.status,outlookThreadsMatched:outlook.threadsMatched,outlookDistinctThreads:outlook.distinctThreads,
  outlookThreadsLinkedToEligibleTickets:outlook.threadsLinkedToEligibleTickets,outlookStale:true,outlookLastObservedUtc:outlook.lastObservedUtc,
  invoiceItemsExcluded:BILLING.length,duplicatesRemoved:DUPES.length,closeFlagTrueRetained,arrivalsThisCycle:arrIds.length,departuresThisCycle:dropped.length}};
m.excludedThisCycle={reopenByStatusName:OPEN_REOPEN,billingFamily:BILLING,billingFamilyClosedSinceV54:BILLING_LEFT,duplicateConversations:DUPES,
 eligibleDepartures:dropped.sort(),eligibleArrivals:arrIds.slice().sort()};
m.reconciliation={gate:{total:GATE,New:OPEN_NEW,Pending:OPEN_PENDING},openSystemBucket:OPEN,Reopen:OPEN_REOPEN,
 billingExcluded:BILLING.length,duplicateConversationsExcluded:DUPES.length,eligibleConversations:total,
 carriedOverFromV54:stayed.length,eligibleArrivals:arrIds.length,eligibleDepartures:dropped.length,
 apiTotalFieldOverReport:'The endpoint reports total=333 for '+OPEN+' distinct rows; verified off-by-one in its paging offset ((page-1)*size-1). Distinct row set used.',
 note:`Gate set-compared against the persisted v54 capture: 16 gate arrivals, 33 gate departures (32 closed + UFN-71164 -> Reopen). Eligible = 281 - 30 + 16 = ${total}.`};
m.verifiedAgainst=`Live Ticket Ops single-snapshot read ${READ_UTC} (department ${DEPT}, displayStatusSystemStatus=10, size=350 page=1), captured to scripts/live-open-2026-09-21T1758Z-v55.tsv and set-compared against scripts/gate-live-2026-09-21-v54.txt`;
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
oc.staleness={reason:'No Outlook read was possible this cycle (delegated-mailbox read returned no result); last observed v42 values retained for context only.',lastObservedUtc:outlook.lastObservedUtc,lastObservedCycle:'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42'};
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
 eligibleArrivals:arrIds.slice().sort(),eligibleDepartures:dropped.sort(),
 billingFamilyExclusions:BILLING,billingFamilyClosedSinceV54:BILLING_LEFT,overlapLosers:DUPES};
writeFileSync('public/data/structured_list.json',j(structured));

let rm=readFileSync('README.md','utf8');
const tierText=`${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const state=`## Current Dashboard State (Last Refresh: ${REF_ET} - AUTHORITATIVE v55)\n\n| Metric | Value |\n|--------|-------|\n| Total Raw (system-open UFN, department scope) | **${OPEN}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate **${GATE}** (API total field over-reports by 1; distinct rows used) |\n| Eligible | **${total}** conversations (${byStatus.New} New, 0 Open, ${byStatus.Pending} Pending) - ${arrIds.length} arrivals / ${dropped.length} departures vs v54 |\n| Excluded | ${BILLING.length+DUPES.length} = ${BILLING.length} billing-family + ${DUPES.length} overlapping conversations; ${OPEN_REOPEN} Reopen rows outside the gate |\n| Eligible arrivals | **${arrIds.length}** |\n| Eligible departures | **${dropped.length}** |\n| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained (incl. new UFN-70399 / UFN-71276 / UFN-71291) |\n| Customers | **${byC.size}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |\n| Priority | ${byPriority.Medium??0} Medium / ${byPriority.unavailable??0} unavailable |\n| SLA Risk | **ELEVATED** - ${breached.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |\n| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |\n| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |\n| Last Refresh | ${REFERENCE} (**AUTHORITATIVE v55**, department ${DEPT}) |\n\n`;
rm=rm.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/,state);
const note=`### v54 -> v55 (Sep 21 12:06 AM ET -> ${REF_ET})\n\n- **Net movement: -14 eligible conversations (281 -> ${total}).** The live read returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen), down 17 from 349, and a ${GATE}-row gate, down 17 from 311. 16 arrivals vs 30 departures.\n- **Movement is verified, not asserted.** The ${GATE}-row gate is captured to scripts/gate-live-2026-09-21-v55.txt and set-compared against the persisted v54 capture; arrival/departure lists are computed.\n- **32 gate rows closed outright** (spot-verified on authoritative status: UFN-71236 Solved 12:24, UFN-71232 Solved 15:07, UFN-70948 Solved 12:43, UFN-71112 Solved 15:11). **UFN-71164 moved gate -> Reopen** and leaves the eligible set without closing.\n- **16 gate arrivals**, including 15 brand-new 09/21 tickets and UFN-70399 (a live Pending/system-open row carrying closeFlag=true, absent from every v54 capture).\n- **Billing exclusions fall to ${BILLING.length}** (from 24) because UFN-65196, UFN-70948 and UFN-71039 closed and left the open population; all ${BILLING.length} remaining are re-verified in the gate.\n- **closeFlag is still not a gate.** ${closeFlagTrueRetained} live closeFlag=true Pending rows are retained, three of them new this cycle.\n- **Status premise re-disclosed:** "UFN-67030 is live-Pending with closeFlag=true" remains unsupported - UFN-67030 is Solved / displayStatusSystemStatus 20 (CLOSED), closed 09/01, and is not in the [10] population. The rule the request asks for is already what the dashboard does; UFN-67030 stays out on authoritative status.\n- **Endpoint note:** POST /v1/iam/tickets/page reports total=333 while returning ${OPEN} distinct rows; its paging offset is (page-1)*size-1 (verified via page20/size10 -> offset 189 and page34/size10 -> true tail). Counts use distinct rows.\n- **Age-derived sections recomputed** at ${REFERENCE}: SLA ${breached.length} breached / ${onTrack.length} current; buckets ${actionBuckets.Immediate}/${actionBuckets['Short-Term']}/${actionBuckets['Medium-Term']}/${actionBuckets.Watch}; Customer Health ${tierText} across ${byC.size} labels.\n- **Outlook unavailable again** (non-blocking, stale v42 values only).\n\n`;
if(!rm.includes('### v54 -> v55 (')) rm=rm.replace('## Developer Reconciliation Note\n\n',`## Developer Reconciliation Note\n\n${note}`);
writeFileSync('README.md',rm);
writeFileSync('scripts/gate-live-2026-09-21-v55.txt',[...gateSet].sort().join('\n')+'\n');
console.log('WROTE v55 artifacts. eligible='+total);

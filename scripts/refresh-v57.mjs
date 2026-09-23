#!/usr/bin/env node
// v57 refresh - NHT/Cesanek Customer Command Center.
// Authoritative live Ticket Ops read 2026-09-23T05:00Z (department 323826714354839552).
//   displayStatusSystemStatus=[10] with no display-status filter -> 331 distinct open-system rows:
//   237 New / 61 Pending / 33 Reopen.
//   displayStatusIds=[11,6] + displayStatusSystemStatus=[10] -> New+Pending gate = 298
//   (237 New / 61 Pending), stable total across pages 1/2/3 with page sizes 100/100/98.
// The gate was captured to scripts/gate-live-2026-09-23T0452Z-v57.psv and set-compared against the
// persisted v56 snapshot. Full live records for every gate row created >= 2026-09-20 were captured
// to scripts/arrivals-v57.psv so arrivals never depend on carried-forward field values.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const REFERENCE = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference')+1] : '2026-09-23T01:00:00-04:00';
const VERSION='v57', REFRESH_ID=`refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID='refresh-2026-09-21T15:37:00-04:00-AUTHORITATIVE-v56';
const DEPT='323826714354839552', READ_UTC='2026-09-23T05:00:00Z', REF_ET='Sep 23 1:00 AM ET';
const OPEN=331, OPEN_NEW=237, OPEN_PENDING=61, OPEN_REOPEN=33, GATE=298, GATE_NEW=237, GATE_PENDING=61, API_TOTAL=298;
/* Carried-forward billing family: the v56 list minus UFN-69234, which has since left the gate
   (closed). Every carried row is re-verified present in the live gate before it is applied. */
const BILLING_CARRIED=['UFN-33719','UFN-40670','UFN-41484','UFN-43725','UFN-45559','UFN-48436','UFN-53491','UFN-54721','UFN-55641','UFN-59971','UFN-60573','UFN-61451','UFN-62682','UFN-63762','UFN-63959','UFN-68749','UFN-70140','UFN-70947','UFN-70950','UFN-70952'];
const BILLING_NEW=['UFN-71388','UFN-71356','UFN-71313'];
const BILLING=[...BILLING_CARRIED,...BILLING_NEW];
const BILLING_CLOSED_SINCE_V56=['UFN-69234'];
const DUPES=['UFN-69447','UFN-69450','UFN-69661','UFN-69663','UFN-70352','UFN-71127'];
const CLOSEFLAG_TRUE_EXPECTED=18;
const refMs=new Date(REFERENCE).getTime(); if(!Number.isFinite(refMs)) throw new Error('bad ref');
const hrs=iso=>(refMs-new Date(iso).getTime())/36e5;
const j=v=>`${JSON.stringify(v,null,2)}\n`;
const b=v=>v==='true'||v===true;

const prev=JSON.parse(readFileSync('dashboard/data/tickets.json','utf8'));
const prevM=JSON.parse(readFileSync('dashboard/data/refresh-manifest.json','utf8'));
const prevBilling=prevM.exclusions.billingTicketIds;
const prevDupes=prevM.exclusions.duplicateConversations;

const live=readFileSync('scripts/gate-live-2026-09-23T0452Z-v57.psv','utf8').trim().split('\n')
  .map(l=>{const [id,st,cf,od]=l.split('|');return {id:id.trim(),st:st.trim(),closeFlag:b(cf),overdue:b(od)};});
const stMap=new Map(), cfMap=new Map(), odMap=new Map();
for(const r of live){ stMap.set(r.id,r.st); cfMap.set(r.id,r.closeFlag); odMap.set(r.id,r.overdue); }
const gateSet=new Set(stMap.keys());
console.log('live gate rows',live.length,'unique',stMap.size);
if(stMap.size!==GATE) throw new Error('gate changed: '+stMap.size);
const stCount={}; for(const s of stMap.values()) stCount[s]=(stCount[s]||0)+1;
if(stCount.New!==GATE_NEW||stCount.Pending!==GATE_PENDING) throw new Error('status split changed: '+JSON.stringify(stCount));
for(const x of BILLING_CARRIED) if(!gateSet.has(x)) throw new Error('billing row missing from gate: '+x);
for(const x of BILLING_NEW) if(!gateSet.has(x)) throw new Error('new billing row missing from gate: '+x);
for(const x of DUPES) if(!gateSet.has(x)) throw new Error('dupe missing from gate: '+x);
for(const x of BILLING_CLOSED_SINCE_V56) if(gateSet.has(x)) throw new Error('row expected to have closed is still in gate: '+x);
if(!gateSet.has('UFN-35588')) throw new Error('UFN-35588 guard failed');

/* Full live records for gate rows created >= 2026-09-20 (superset of new arrivals). */
const recs=new Map();
for(const l of readFileSync('scripts/arrivals-v57.psv','utf8').trim().split('\n')){
  const p=l.split('|'); if(p.length!==13) throw new Error('arrival field count '+p.length+' in '+p[0]);
  recs.set(p[0],{id:p[0],status:p[1],closeFlag:b(p[2]),overdue:b(p[3]),customer:p[4],email:p[5],
    createdAt:p[6],updatedAt:p[7],dueAt:p[8],assignee:p[9].trim(),priority:p[10],billing:b(p[11]),subject:p[12]});
}
const A=r=>({ticketId:r.id,customer:r.customer||r.email||'Unknown',customerEmail:r.email||'',displayStatusName:r.status,
  sourceChannel:2,topicTitle:'UF General Inquiry',subject:r.subject,createdAt:r.createdAt,updatedAt:r.updatedAt,dueDate:r.dueAt||null,
  opsStatus:r.status,displayStatusSystemStatus:10,priority:r.priority||'Medium',priorityNameSource:'ticket',prioritySourceMissing:false,
  createdDate:r.createdAt.slice(0,10),lastUpdated:(r.updatedAt||r.createdAt).slice(0,10),assigned:r.assignee||'Unassigned',
  closeFlag:r.closeFlag,slaStatus:(r.overdue?'Breached':'On Track'),isOverdue:r.overdue,isSlaBreached:r.overdue,conversationId:null});

const prevGateIds=new Set([...prev.map(t=>t.ticketId),...prevBilling,...prevDupes]);
const stayed=[]; for(const t of prev) if(gateSet.has(t.ticketId)&&!BILLING.includes(t.ticketId)&&!DUPES.includes(t.ticketId)) stayed.push(t);
const arrivalIds=live.map(r=>r.id).filter(id=>!prevGateIds.has(id)&&!BILLING.includes(id)&&!DUPES.includes(id));
for(const id of arrivalIds) if(!recs.has(id)) throw new Error('arrival without a live full record: '+id);
const dropped=prev.map(p=>p.ticketId).filter(id=>!gateSet.has(id));
const droppedSorted=dropped.slice().sort();

/* closeFlag drift on carried-over rows: enumerated, never silently overwritten except as recorded. */
const drift={}; for(const t of stayed){ if(t.closeFlag!==cfMap.get(t.ticketId)) drift[t.ticketId]=cfMap.get(t.ticketId); }

const tickets=[...stayed.map(t=>({...t,displayStatusName:stMap.get(t.ticketId)==='Pending'?'Pending':'New',opsStatus:stMap.get(t.ticketId)==='Pending'?'Pending':'New',closeFlag:cfMap.get(t.ticketId)})),
  ...arrivalIds.map(id=>A(recs.get(id)))]
  .map(t=>{const h=Math.max(0,hrs(t.createdAt));return {...t,ageHours:Math.floor(h),ageDays:Math.floor(h/24)};})
  .sort((a,b2)=>String(b2.createdAt).localeCompare(String(a.createdAt)));
const total=tickets.length;
if(total!==GATE-BILLING.length-DUPES.length) throw new Error('eligible total mismatch: '+total);
const byStatus={New:tickets.filter(t=>t.displayStatusName==='New').length,Open:0,Pending:tickets.filter(t=>t.displayStatusName==='Pending').length};
const breached=tickets.filter(t=>t.isSlaBreached||t.isOverdue||/breach/i.test(t.slaStatus||''));
const onTrack=tickets.filter(t=>!breached.includes(t));
const byPriority=tickets.reduce((a,t)=>{const k=t.priority||'unavailable';a[k]=(a[k]||0)+1;return a;},{});
const dueDerived=tickets.filter(t=>t.dueDate&&new Date(t.dueDate).getTime()<refMs).length;
const queue=[...tickets].sort((a,b2)=>Number(breached.includes(b2))-Number(breached.includes(a))||String(a.dueDate??'9999').localeCompare(String(b2.dueDate??'9999'))||b2.ageHours-a.ageHours).slice(0,15)
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
const sortedC=Object.fromEntries(Object.entries(customers).sort((a,b2)=>b2[1].tickets-a[1].tickets||a[0].localeCompare(b2[0])));
const closeFlagTrueRetained=tickets.filter(t=>t.closeFlag===true).length;
const closeFlagTrueList=tickets.filter(t=>t.closeFlag===true).map(t=>t.ticketId).sort();
if(closeFlagTrueRetained!==CLOSEFLAG_TRUE_EXPECTED) throw new Error('closeFlag=true retained changed: '+closeFlagTrueRetained);
const unassigned=tickets.filter(t=>/unassigned/i.test(t.assigned||'')).length;
const oldestAgeDays=tickets.reduce((m,t)=>Math.max(m,t.ageDays),0);
const outlook={status:'unavailable',threadsMatched:25,distinctThreads:9,threadsLinkedToEligibleTickets:3,stale:true,lastObservedUtc:'2026-09-14T21:46:00Z'};
const summary={reference:REFERENCE,eligible:total,byStatus,gate:{total:GATE,New:GATE_NEW,Pending:GATE_PENDING},openBucket:OPEN,openBucketSplit:{New:OPEN_NEW,Pending:OPEN_PENDING,Reopen:OPEN_REOPEN},
 actionBuckets,customerHealth:{total:byC.size,tiers},priorityQueueTop:queue[0],sla:{breached:breached.length,current:onTrack.length},
 closeFlagTrueRetained,unassigned,oldestAgeDays,stayed:stayed.length,arrivals:arrivalIds.length,departures:dropped.length,
 arrivalsList:arrivalIds.slice().sort(),departuresList:droppedSorted,closeFlagDrift:drift,billingExcluded:BILLING.length};
console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--write')){console.log('(dry run)');process.exit(0);}

writeFileSync('dashboard/data/tickets.json',j(tickets)); copyFileSync('dashboard/data/tickets.json','public/data/tickets.json');
const m=prevM;
m.refresh={id:REFRESH_ID,timestamp:REFERENCE,type:'AUTHORITATIVE',previousRefreshId:PREVIOUS_REFRESH_ID,status:'complete',
 keyChange:`Live Ticket Ops read returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and a ${GATE}-row New+Pending gate (${GATE_NEW} New / ${GATE_PENDING} Pending; total stable at ${API_TOTAL} across pages 1-3, sizes 100/100/98). Eligible conversations ${total} (${byStatus.New} New / ${byStatus.Pending} Pending) = ${arrivalIds.length} arrivals / ${dropped.length} departures vs v56. Billing-family exclusions move 21 -> ${BILLING.length} (3 new billing arrivals; UFN-69234 closed). 6 overlap losers unchanged. closeFlag still not a gate (${closeFlagTrueRetained} retained). Outlook unavailable (non-blocking).`};
m.dataSources=[
 {name:'Ticket Ops',endpoint:'POST /v1/iam/tickets/page',query:{page:1,size:100,input:{departmentIds:[DEPT],displayStatusSystemStatus:[10],displayStatusIds:[11,6]}},
  rawCapture:`scripts/gate-live-2026-09-23T0452Z-v57.psv (${GATE} New/Pending gate rows with display status + closeFlag + overdue); scripts/arrivals-v57.psv (full live records for gate rows created >= 2026-09-20)`,
  note:`Authoritative paged read at ${READ_UTC}: ${OPEN} distinct open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate ${GATE}. The endpoint reported total=${API_TOTAL} on pages 1, 2 and 3 with page sizes 100/100/98, matching the enumerated rows, so no off-by-one was observed. The Reopen bucket (${OPEN_REOPEN}) sits outside the gate per the status rules.`},
 {name:'Outlook',note:'Unavailable again this cycle (two delegated-mailbox read attempts returned no result); last observed v42 values (25 messages / 9 distinct threads) are carried forward as stale context only. Outlook remains non-blocking and was used in no ticket, queue, bucket, health or SLA metric.'}];
m.developerNotes=[
 `v57 live read: ${OPEN} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate ${GATE} (${GATE_NEW} New / ${GATE_PENDING} Pending). Gate membership is set-compared against the persisted v56 snapshot rather than asserted.`,
 `ARRIVALS to the eligible set (${arrivalIds.length}): ${arrivalIds.slice().sort().join(', ')}. Every arrival carries a full live record from scripts/arrivals-v57.psv (customer, customerEmail, createdAt/updatedAt, dueAt, assignee, closeFlag, SLA flags) - no arrival depends on carried-forward field values.`,
 `DEPARTURES from the gate (${droppedSorted.length}): ${droppedSorted.join(', ')}. These rows were in the v56 eligible set and are absent from the live gate; they are dropped because the authoritative gate no longer returns them.`,
 `Billing-family exclusions move 21 -> ${BILLING.length}: the ${BILLING_CARRIED.length} carried rows were re-verified present in the live gate, ${BILLING_NEW.length} new billing arrivals were added (${BILLING_NEW.join(', ')}: ufbillingticket/handling + CKNAPP billing-period rows), and ${BILLING_CLOSED_SINCE_V56.join(', ')} closed since v56 and is recorded under billingClosedSinceV56 rather than silently dropped from the audit trail. Eligible = ${GATE} - ${BILLING.length} - ${DUPES.length} = ${total}.`,
 `The 6 CASE/DN overlap losers (${DUPES.join(', ')}) are all still present in the live gate and are still excluded by source conversation identity, not by subject text.`,
 `closeFlag=true is STILL not an eligibility gate. ${closeFlagTrueRetained} live closeFlag=true rows are retained as eligible, and the gate capture records the live closeFlag value on all ${GATE} rows: ${closeFlagTrueList.join(', ')}. Drift on carried-over rows (stored vs live) is enumerated rather than silently overwritten: ${Object.keys(drift).length?Object.entries(drift).map(([k,v])=>k+' -> '+v).join(', '):'none this cycle'}.`,
 `STATUS-PREMISE CONFLICT, re-disclosed rather than applied: the request again cites "UFN-67030 is live-Pending with closeFlag=true". An independent authoritative lookup does not support it. GET /v1/iam/tickets/brief/number/UFN-67030 returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), displayStatusId 2, closeFlag true, closedTime 2026-09-01 16:56:56, closedBy staff; it is not returned by the system-open query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New,Pending}; closeFlag never a gate) is already exactly what this dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS. The correct closeFlag counter-evidence is the ${closeFlagTrueRetained} eligible live closeFlag=true rows above.`,
 `Priority and assignee fields were NOT re-derived for carried-over rows: priority is "Medium" on every returned row and the endpoint omits staffName rather than sending a literal "Unassigned", so live assignee cannot distinguish unassigned from not-returned. Stored per-ticket values are retained for carried rows; arrivals carry their observed values (empty staffName -> "Unassigned", the v5x convention).`,
 `SLA/workload: carried-over rows keep their stored isSlaBreached/isOverdue flags (v5x methodology); arrivals carry live isOverdue/isSlaBreached. A dueDate-derived cross-check flags ${dueDerived} rows as past due vs ${breached.length} on stored flags - disclosed, not silently substituted.`,
 `Customer Health covers all ${byC.size} customer labels visible on the ${total} eligible records; roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.`,
 `Age-derived sections recomputed at the v57 reference time (${REFERENCE}): action buckets, Customer Health tiers, priority queue and SLA counts shown in dashboardState. Agent-reported age columns were discarded because they did not resolve to a single reference time; ages are derived here from createdAt.`,
 `Outlook was unavailable again; carried-forward stale values were not used in any ticket, queue, bucket, health or SLA metric.`];
m.dashboardState={totalRaw:OPEN,totalRawDepartmentWide:OPEN,eligibleBeforeExclusions:GATE,reopenExcluded:OPEN_REOPEN,
 billingExcluded:BILLING.length,billingClosedSinceV56:BILLING_CLOSED_SINCE_V56,
 eligibleBeforeDeduplication:GATE-BILLING.length,
 duplicatesRemoved:DUPES.length,totalEligible:total,closeFlagTrueRetained,closeFlagTrueRetainedList:closeFlagTrueList,byStatus,byPriority,
 workload:{overdueOrSlaBreached:breached.length,current:onTrack.length,dueDerivedBreached:dueDerived},actionBuckets,
 customerHealth:{totalCustomers:byC.size,tiers,tierRule:prevM.dashboardState.customerHealth.tierRule,customers:sortedC},
 priorityQueue:queue,
 evidenceMetrics:{totalEligible:total,slaBreached:breached.length,slaOnTrack:onTrack.length,unassigned,oldestAgeDays,
  outlookStatus:outlook.status,outlookThreadsMatched:outlook.threadsMatched,outlookDistinctThreads:outlook.distinctThreads,
  outlookThreadsLinkedToEligibleTickets:outlook.threadsLinkedToEligibleTickets,outlookStale:true,outlookLastObservedUtc:outlook.lastObservedUtc,
  invoiceItemsExcluded:BILLING.length,duplicatesRemoved:DUPES.length,closeFlagTrueRetained,arrivalsThisCycle:arrivalIds.length,departuresThisCycle:dropped.length}};
m.excludedThisCycle={reopenByStatusName:OPEN_REOPEN,billingFamily:BILLING,billingFamilyClosedSinceV56:BILLING_CLOSED_SINCE_V56,duplicateConversations:DUPES,
 eligibleDepartures:droppedSorted,eligibleArrivals:arrivalIds.slice().sort()};
m.reconciliation={gate:{total:GATE,New:GATE_NEW,Pending:GATE_PENDING},openSystemBucket:OPEN,openSystemSplit:{New:OPEN_NEW,Pending:OPEN_PENDING,Reopen:OPEN_REOPEN},
 billingExcluded:BILLING.length,duplicateConversationsExcluded:DUPES.length,eligibleConversations:total,
 carriedOverFromV56:stayed.length,eligibleArrivals:arrivalIds.length,eligibleDepartures:dropped.length,
 apiTotalFieldOverReport:'None observed this cycle: the endpoint reported total='+API_TOTAL+' for '+GATE+' gate rows, stable across pages 1-3 (100/100/98). Distinct row set used.',
 note:`Gate set-compared against the v56 snapshot: ${arrivalIds.length} eligible arrivals, ${dropped.length} departures. Eligible = ${GATE} - ${BILLING.length} billing - ${DUPES.length} overlap = ${total}.`};
m.exclusions.billingTicketIds=BILLING;
m.exclusions.billingTicketReasons=Object.assign({},m.exclusions.billingTicketReasons,{
 'UFN-71388':'new billing arrival: Roar Beverage - Handling 9.13-9.19 / PA (handling invoice family)',
 'UFN-71356':'new billing arrival: DUPRAY LLC l Cesanek - Handling 9/13-9/19 (handling invoice family)',
 'UFN-71313':'new billing arrival: 19340875 - CKNAPP SALES INC - billing period (09/01/2026-09/18/2026)'});
m.exclusions.billingFamilyExcludedCount=BILLING.length;
m.exclusions.billingClosedSinceV56=BILLING_CLOSED_SINCE_V56;
if(m.exclusions.duplicateConversations) m.exclusions.duplicateConversations=DUPES;
m.verifiedAgainst=`Live Ticket Ops paged read ${READ_UTC} (department ${DEPT}, displayStatusSystemStatus=[10], displayStatusIds=[11,6]), captured to scripts/gate-live-2026-09-23T0452Z-v57.psv and set-compared against the v56 snapshot; full live records for gate rows created >= 2026-09-20 captured to scripts/arrivals-v57.psv`;
m.nextScheduledRefresh='2026-09-23T08:00:00-04:00';
writeFileSync('dashboard/data/refresh-manifest.json',j(m)); copyFileSync('dashboard/data/refresh-manifest.json','public/data/refresh-manifest.json');

const snap={refreshId:REFRESH_ID,refreshedAt:REFERENCE,totalRaw:OPEN,totalGateRows:GATE,totalEligible:total,
 excludedCount:BILLING.length+DUPES.length,duplicatesRemoved:DUPES.length,invoiceItemsExcluded:BILLING.length,
 closeFlagTrueRetained,arrivalsThisCycle:arrivalIds.length,departuresThisCycle:dropped.length,outlookStatus:outlook.status,
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
 arrivalsThisCycle:arrivalIds.length,departuresThisCycle:dropped.length,outlookDistinctThreads:outlook.distinctThreads,
 eligibleArrivals:arrivalIds.slice().sort(),eligibleDepartures:droppedSorted,
 billingFamilyExclusions:BILLING,billingFamilyClosedSinceV56:BILLING_CLOSED_SINCE_V56,overlapLosers:DUPES};
writeFileSync('public/data/structured_list.json',j(structured));

let rm=readFileSync('README.md','utf8');
const tierText=`${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy`;
const state=`## Current Dashboard State (Last Refresh: ${REF_ET} - AUTHORITATIVE v57)\n\n| Metric | Value |\n|--------|-------|\n| Total Raw (system-open UFN, department scope) | **${OPEN}** = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate **${GATE}** (distinct rows used) |\n| Eligible | **${total}** conversations (${byStatus.New} New, 0 Open, ${byStatus.Pending} Pending) - ${arrivalIds.length} arrivals / ${dropped.length} departures vs v56 |\n| Excluded | ${BILLING.length+DUPES.length} = ${BILLING.length} billing-family + ${DUPES.length} overlapping conversations; ${OPEN_REOPEN} Reopen rows outside the gate |\n| Eligible arrivals | **${arrivalIds.length}** |\n| Eligible departures | **${dropped.length}** |\n| closeFlag | **NOT a gate** - ${closeFlagTrueRetained} live closeFlag=true tickets retained |\n| Customers | **${byC.size}** distinct live customer labels (${tierText}; every ticket-visible customer covered) |\n| Priority | ${byPriority.Medium??0} Medium / ${byPriority.unavailable??0} unavailable |\n| SLA Risk | **ELEVATED** - ${breached.length} SLA-breached / ${onTrack.length} current; ${unassigned} unassigned |\n| Action Buckets | Immediate **${actionBuckets.Immediate}** / Short-Term **${actionBuckets['Short-Term']}** / Medium-Term **${actionBuckets['Medium-Term']}** / Watch **${actionBuckets.Watch}** |\n| Outlook Coverage | **Unavailable this cycle** - last observed (v42): ${outlook.threadsMatched} UFN messages / ${outlook.distinctThreads} distinct threads, latest ${outlook.lastObservedUtc}; stale and supplemental only |\n| Last Refresh | ${REFERENCE} (**AUTHORITATIVE v57**, department ${DEPT}) |\n\n`;
rm=rm.replace(/## Current Dashboard State \(Last Refresh:[\s\S]*?(?=## Developer Reconciliation Note)/,state);
const note=`### v56 -> v57 (Sep 21 3:37 PM ET -> ${REF_ET})\n\n- **Net movement: 266 -> ${total} eligible conversations (+${total-266}).** The live read returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and a ${GATE}-row New+Pending gate (${GATE_NEW} New / ${GATE_PENDING} Pending; total stable at ${API_TOTAL} across pages 1-3, page sizes 100/100/98). ${arrivalIds.length} arrivals vs ${dropped.length} departures.\n- **Movement is verified, not asserted.** The ${GATE}-row gate is captured to scripts/gate-live-2026-09-23T0452Z-v57.psv and set-compared against the v56 snapshot; arrival/departure lists are computed, and the script aborts if any arrival lacks a full live record.\n- **Billing family moves 21 -> ${BILLING.length}.** ${BILLING_CARRIED.length} carried rows were re-verified in the gate, ${BILLING_NEW.length} new billing arrivals were added (${BILLING_NEW.join(', ')}), and UFN-69234 closed since v56 and is recorded under \`billingClosedSinceV56\`.\n- **The 6 CASE/DN overlap losers are unchanged** (${DUPES.join(', ')}) and are still excluded by source conversation identity, not subject text.\n- **closeFlag is still not a gate.** ${closeFlagTrueRetained} live closeFlag=true rows are retained as eligible. Drift on carried rows is enumerated: ${Object.keys(drift).length?Object.entries(drift).map(([k,v])=>k+' -> '+v).join(', '):'none this cycle'}.\n- **Status premise re-disclosed:** "UFN-67030 is live-Pending with closeFlag=true" remains unsupported - UFN-67030 is Solved / displayStatusSystemStatus 20 (CLOSED), closed 09/01 by staff, and is not in the system-open population. The rule the request asks for is already what the dashboard does; UFN-67030 stays out on authoritative status.\n- **Age-derived sections recomputed** at ${REFERENCE}: SLA ${breached.length} breached / ${onTrack.length} current; buckets ${actionBuckets.Immediate}/${actionBuckets['Short-Term']}/${actionBuckets['Medium-Term']}/${actionBuckets.Watch}; Customer Health ${tierText} across ${byC.size} labels.\n- **Outlook unavailable again** (non-blocking; two attempts returned no result, stale v42 values only).\n\n`;
if(!rm.includes('### v56 -> v57 (')) rm=rm.replace('## Developer Reconciliation Note\n\n',`## Developer Reconciliation Note\n\n${note}`);
writeFileSync('README.md',rm);
writeFileSync('scripts/gate-live-2026-09-23-v57.txt',[...gateSet].sort().join('\n')+'\n');
console.log('WROTE v57 artifacts. eligible='+total);

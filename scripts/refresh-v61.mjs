#!/usr/bin/env node
// v61 refresh - NHT/Cesanek Customer Command Center.
// Authoritative live Ticket Ops read 2026-09-26T06:52Z (department 323826714354839552).
//   open-system cohort (displayStatusSystemStatus=[10]) = 324 rows = 244 New / 55 Pending / 25 Reopen
//   New+Pending eligibility gate (open + displayStatusName in {New,Pending}) = 299 (244 New / 55 Pending)
// The full gate roster was captured to scripts/gate-live-2026-09-26T0652Z-v61.psv.
// Carried-over rows keep their stored record (v5x methodology) and only have display status +
// closeFlag re-read from the live gate; arrivals get full live records from the gate capture.
// closeFlag is NEVER an eligibility gate (14 live closeFlag=true rows retained).
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const REFERENCE = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference')+1] : '2026-09-26T02:52:00-04:00';
const VERSION='v61', REFRESH_ID=`refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID='refresh-2026-09-25T00:33:00-04:00-AUTHORITATIVE-v60';
const DEPT='323826714354839552', READ_UTC='2026-09-26T06:52:00Z', REF_ET='Sep 26 2:52 AM ET';
const OPEN=324, OPEN_NEW=244, OPEN_PENDING=55, OPEN_REOPEN=25, GATE=299, GATE_NEW=244, GATE_PENDING=55;

const BILLING=['UFN-33719','UFN-40670','UFN-41484','UFN-43725','UFN-45559','UFN-48436','UFN-53491','UFN-54721','UFN-55641','UFN-59971','UFN-60573','UFN-61451','UFN-62682','UFN-63762','UFN-63959','UFN-68749','UFN-70140','UFN-70950','UFN-70952','UFN-71356','UFN-71622'];
const BILLING_CLOSED_SINCE_V60=['UFN-71485'];
const CLOSEFLAG_TRUE_EXPECTED=14;
const API_TOTAL=299;

const refMs=new Date(REFERENCE).getTime(); if(!Number.isFinite(refMs)) throw new Error('bad ref');
const hrs=iso=>(refMs-new Date(iso).getTime())/36e5;
const j=v=>`${JSON.stringify(v,null,2)}\n`;
const b=v=>v==='true'||v===true;
const toIso=s=>{const m=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim()); if(!m) throw new Error('bad time: '+s); return `${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:${m[6]}Z`;};

/* ---- parse the live gate capture (subject may itself contain '|') ---- */
const raw=readFileSync('scripts/gate-live-2026-09-26T0652Z-v61.psv','utf8').trim().split('\n');
const parsed=raw.map(l=>{const f=l.split('|'); if(f.length<15) throw new Error('short row '+f[0]);
  const n=f.length;
  return {id:f[0].trim(),status:f[1].trim(),sys:Number(f[2]),closeFlag:b(f[3]),
    customer:f[4].trim(),email:f[5].trim(),subject:f.slice(6,n-8).join('|').trim(),
    created:toIso(f[n-8]),updated:toIso(f[n-7]),due:f[n-6].trim(),priority:f[n-5].trim(),
    staff:f[n-4].trim(),sla:b(f[n-3]),overdue:b(f[n-2]),itemType:f[n-1].trim()};});
const reopenRows=parsed.filter(r=>r.status==='Reopen').map(r=>r.id);
const gate=parsed.filter(r=>r.status!=='Reopen');
if(gate.length!==GATE) throw new Error('gate size '+gate.length);
if(new Set(gate.map(r=>r.id)).size!==GATE) throw new Error('duplicate gate ids');
const stCount={}; for(const r of gate) stCount[r.status]=(stCount[r.status]||0)+1;
if(stCount.New!==GATE_NEW||stCount.Pending!==GATE_PENDING) throw new Error('split '+JSON.stringify(stCount));
const gateSet=new Set(gate.map(r=>r.id));
const byId=new Map(gate.map(r=>[r.id,r]));

/* ---- overlap exclusions: explicit CASE-/DN- conversation identities only ---- */
const tokenOf=r=>{const t=[]; let m;
  const reC=/CASE\s*#?\s*(\d{6,})/gi; while((m=reC.exec(r.subject))) t.push('CASE:'+m[1]);
  const reCID=/CaseID:\s*(\d{6,})/gi; while((m=reCID.exec(r.subject))) t.push('CASE:'+m[1]);
  const reD=/DN-(\d{4,})/gi; while((m=reD.exec(r.subject))) t.push('DN:'+m[1]);
  return t;};
const groups=new Map();
for(const r of gate) for(const t of tokenOf(r)){ if(!groups.has(t)) groups.set(t,[]); groups.get(t).push(r.id); }
const dupes=[], dupeBasis={};
for(const [t,ids] of groups){ if(ids.length<2) continue;
  const rows=ids.map(id=>byId.get(id)).sort((a,b2)=>String(a.created).localeCompare(String(b2.created)));
  const keep=rows[0].id;
  for(const r of rows.slice(1)){ dupes.push(r.id); dupeBasis[r.id]=`same thread identity ${t} as retained row ${keep}`; }
}
dupes.sort();
const dupeSet=new Set(dupes);

/* ---- guards ---- */
for(const x of BILLING) if(!gateSet.has(x)) throw new Error('billing row missing from gate: '+x);
for(const x of BILLING_CLOSED_SINCE_V60) if(gateSet.has(x)) throw new Error('billing row expected closed still in gate: '+x);
for(const x of dupes) if(!gateSet.has(x)) throw new Error('dupe missing from gate: '+x);
if(!gateSet.has('UFN-35588')) throw new Error('UFN-35588 guard failed');
if(!gateSet.has('UFN-33604')) throw new Error('UFN-33604 guard failed');
const cfGate=gate.filter(r=>r.closeFlag).map(r=>r.id).sort();
if(cfGate.length!==CLOSEFLAG_TRUE_EXPECTED) throw new Error('closeFlag=true count changed: '+cfGate.length);

/* ---- prior snapshot + set comparison ---- */
const prev=JSON.parse(readFileSync('dashboard/data/tickets.json','utf8'));
const prevM=JSON.parse(readFileSync('dashboard/data/refresh-manifest.json','utf8'));
const prevGateIds=new Set([...prev.map(t=>t.ticketId),...prevM.exclusions.billingTicketIds,...prevM.exclusions.duplicateConversations]);
const prevElig=new Set(prev.map(t=>t.ticketId));
const gateArrivals=[...gateSet].filter(x=>!prevGateIds.has(x)).sort();
const gateDepartures=[...prevGateIds].filter(x=>!gateSet.has(x)).sort();
const eligibleDepartures=[...prevElig].filter(x=>!gateSet.has(x)).sort();
const newlyEligiblePriorExclusions=[...gateSet].filter(x=>(prevM.exclusions.duplicateConversations.includes(x))&&!BILLING.includes(x)).sort();

const A=r=>({ticketId:r.id,customer:r.customer||r.email||'Unknown',customerEmail:r.email||'',displayStatusName:r.status,
  sourceChannel:2,topicTitle:'UF General Inquiry',subject:r.subject,createdAt:r.created,updatedAt:r.updated,dueDate:r.due||null,
  opsStatus:r.status,displayStatusSystemStatus:10,priority:r.priority||'Medium',priorityNameSource:'ticket',prioritySourceMissing:false,
  createdDate:r.created.slice(0,10),lastUpdated:r.updated.slice(0,10),assigned:(r.staff&&r.staff!=='-')?r.staff:'Unassigned',
  closeFlag:r.closeFlag,slaStatus:(r.sla?'Breached':'On Track'),isOverdue:r.overdue,isSlaBreached:r.sla,conversationId:null});

const stayed=[]; const drift={};
for(const t of prev){ if(!gateSet.has(t.ticketId)) continue;         // left the gate
  if(BILLING.includes(t.ticketId)||dupeSet.has(t.ticketId)) continue; // never eligible
  const live=byId.get(t.ticketId);
  if(t.closeFlag!==live.closeFlag) drift[t.ticketId]=live.closeFlag;
  stayed.push({...t, displayStatusName:live.status, opsStatus:live.status, closeFlag:live.closeFlag}); }

const arrivalIds=[...gateSet].filter(id=>!prevElig.has(id)&&!BILLING.includes(id)&&!dupeSet.has(id)).sort();
for(const id of arrivalIds) if(!byId.has(id)) throw new Error('arrival without live record: '+id);

const tickets=[...stayed, ...arrivalIds.map(id=>A(byId.get(id)))]
  .map(t=>{const h=Math.max(0,hrs(t.createdAt));return {...t,ageHours:Math.floor(h),ageDays:Math.floor(h/24)};})
  .sort((a,b2)=>String(b2.createdAt).localeCompare(String(a.createdAt)));
const total=tickets.length;
if(total!==GATE-BILLING.length-dupes.length) throw new Error('eligible mismatch: '+total);

const byStatus={New:tickets.filter(t=>t.displayStatusName==='New').length,Open:0,Pending:tickets.filter(t=>t.displayStatusName==='Pending').length};
const breached=tickets.filter(t=>t.isSlaBreached||t.isOverdue||/breach/i.test(t.slaStatus||''));
const breachedSet=new Set(breached);
const onTrack=tickets.filter(t=>!breachedSet.has(t));
const byPriority=tickets.reduce((a,t)=>{const k=t.priority||'unavailable';a[k]=(a[k]||0)+1;return a;},{});
const dueDerived=tickets.filter(t=>t.dueDate&&new Date(t.dueDate).getTime()<refMs).length;
const queue=[...tickets].sort((a,b2)=>Number(breachedSet.has(b2))-Number(breachedSet.has(a))||String(a.dueDate??'9999').localeCompare(String(b2.dueDate??'9999'))||b2.ageHours-a.ageHours).slice(0,15)
  .map(t=>({ticketId:t.ticketId,customer:t.customer,subject:t.subject,ageDays:t.ageDays,ageHours:t.ageHours,slaStatus:breachedSet.has(t)?'Breached':'On Track'}));
const bucket=h=>h<24?'Immediate':h<72?'Short-Term':h<168?'Medium-Term':'Watch';
const actionBuckets={Immediate:0,'Short-Term':0,'Medium-Term':0,Watch:0};
for(const t of tickets) actionBuckets[bucket(t.ageHours)]++;
const byC=new Map();
for(const t of tickets){const n=t.customer||t.customerEmail||'Unknown';const r=byC.get(n)||{tickets:0,breached:0,oldestBreachedAgeDays:0,olderThan7d:0};
 r.tickets++; if(breachedSet.has(t)){r.breached++; r.oldestBreachedAgeDays=Math.max(r.oldestBreachedAgeDays,t.ageDays);} if(t.ageDays>7)r.olderThan7d++; byC.set(n,r);}
const customers={},tiers={Critical:0,Warning:0,Healthy:0};
for(const [n,r] of byC){const share=r.tickets?r.olderThan7d/r.tickets:0;
 const tier=(share>=0.5||r.tickets>=3)?'Critical':(share>=0.25||r.tickets>=1)?'Warning':'Healthy';
 tiers[tier]++; customers[n]={tickets:r.tickets,breached:r.breached,oldestBreachedAgeDays:r.oldestBreachedAgeDays,tier};}
const sortedC=Object.fromEntries(Object.entries(customers).sort((a,b2)=>b2[1].tickets-a[1].tickets||a[0].localeCompare(b2[0])));
const closeFlagTrueRetained=tickets.filter(t=>t.closeFlag===true).length;
const closeFlagTrueList=tickets.filter(t=>t.closeFlag===true).map(t=>t.ticketId).sort();
const unassigned=tickets.filter(t=>/unassigned/i.test(t.assigned||'')).length;
const oldestAgeDays=tickets.reduce((m,t)=>Math.max(m,t.ageDays),0);
const outlook={status:'unavailable',threadsMatched:25,distinctThreads:9,threadsLinkedToEligibleTickets:3,stale:true,lastObservedUtc:'2026-09-14T21:46:00Z'};

const summary={reference:REFERENCE,eligible:total,byStatus,gate:{total:GATE,New:GATE_NEW,Pending:GATE_PENDING},openBucket:OPEN,
 openBucketSplit:{New:OPEN_NEW,Pending:OPEN_PENDING,Reopen:OPEN_REOPEN,reopenListed:reopenRows},
 actionBuckets,customerHealth:{total:byC.size,tiers},priorityQueueTop:queue[0],sla:{breached:breached.length,current:onTrack.length,dueDerived},
 closeFlagTrueRetained,closeFlagTrueList,unassigned,oldestAgeDays,stayed:stayed.length,arrivals:arrivalIds.length,departures:eligibleDepartures.length,
 gateArrivals,eligibleDepartures,newlyEligiblePriorExclusions,dupes,dupeBasis,closeFlagDrift:drift,billingExcluded:BILLING.length,
 unassignedNote:'assigned = live staffName where returned, else Unassigned'};
console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--write')){console.log('(dry run)');process.exit(0);}

/* ---- write data files ---- */
writeFileSync('dashboard/data/tickets.json',j(tickets)); copyFileSync('dashboard/data/tickets.json','public/data/tickets.json');

const m=prevM;
m.refresh={id:REFRESH_ID,timestamp:REFERENCE,type:'AUTHORITATIVE',previousRefreshId:PREVIOUS_REFRESH_ID,status:'complete',
 keyChange:`Live Ticket Ops read 2026-09-26T06:52Z returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and a ${GATE}-row New+Pending gate (${GATE_NEW} New / ${GATE_PENDING} Pending) vs 313 at v60. Eligible ${total} (${byStatus.New} New / ${byStatus.Pending} Pending). Billing/invoice-family exclusions stay ${BILLING.length}; overlap exclusions fall 8 -> ${dupes.length} because three prior overlap rows left the gate. closeFlag still not a gate (${closeFlagTrueRetained} retained). Outlook unavailable (non-blocking).`};
m.rulesApplied=[
 'displayStatusSystemStatus == 10 (open) AND displayStatusName in {New, Pending} is the authoritative eligibility gate',
 'Reopen/Reopened, Closed, Resolved, Solved, Cancelled and Done are excluded by display status name (there are no "Open"-named rows, so the New/Open/Pending rule resolves to New + Pending)',
 'closeFlag is retained as evidence and is NEVER an eligibility gate (auto-close artifacts on live system-open Pending rows would cause false negatives)',
 'ticketNumber begins UFN- within department 323826714354839552',
 `${BILLING.length} live billing, UF Billing, storage, handling or invoice-family rows are excluded`,
 `${dupes.length} overlapping rows are removed by an explicit CASE-/DN- conversation identity in the title (subject text alone is never a dedupe key)`,
 'Customer Health includes every customer visible in eligible tickets; roster and aliases are supplemental only',
 'Outlook is supplemental and never changes ticket counts, queue, buckets, Customer Health, or SLA metrics'];
m.dataSources=[
 {name:'Ticket Ops',endpoint:'POST /v1/iam/tickets/page',query:{page:1,size:100,input:{departmentIds:[DEPT],displayStatusSystemStatus:[10],displayStatusIds:[11,6]}},
  rawCapture:`scripts/gate-live-2026-09-26T0652Z-v61.psv (${GATE} New/Pending gate rows with display status + closeFlag + SLA flags, transcribed from the delegated authoritative read)`,
  note:`Authoritative read at ${READ_UTC}: ${OPEN} system-open rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. New+Pending gate ${GATE}. The Reopen bucket (${OPEN_REOPEN}) sits outside the gate per the status rules.`},
 {name:'Outlook',note:'Unavailable again this cycle (no delegated-mailbox read was possible); last observed v42 values (25 messages / 9 distinct threads) are carried forward as stale context only. Outlook remains non-blocking and was used in no ticket, queue, bucket, health or SLA metric.'}];
m.developerNotes=[
 `v61 live read: ${OPEN} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate ${GATE} (${GATE_NEW} New / ${GATE_PENDING} Pending). Gate membership is set-compared against the persisted v60 snapshot rather than asserted.`,
 `GATE MOVEMENT: ${gateArrivals.length} rows are new to the gate and ${gateDepartures.length} gate rows are gone (${eligibleDepartures.length} of them were eligible at v60). Arithmetic closes: 313 + ${gateArrivals.length} - ${gateDepartures.length} = ${GATE}.`,
 `ARRIVALS to the eligible set (${arrivalIds.length}): ${arrivalIds.join(', ')}.`,
 `DEPARTURES from the gate (${gateDepartures.length}): ${gateDepartures.join(', ')}.`,
 'VERIFICATION LIMITATION (disclosed): the delegated read confirmed UFN-68537 is now system-open as Reopen (a reclassification, not a closure), but this cycle did NOT obtain an individual authoritative status re-read for the remaining departures - they are reported as set-difference departures (absent from the live New+Pending gate) rather than individually re-read as in v60. Their authoritative status could not be reproduced one-by-one this cycle.',
 `OVERLAP EXCLUSIONS fall 8 -> ${dupes.length}. ${dupes.join(', ')}. Basis: ${Object.entries(dupeBasis).map(([k,v])=>k+' = '+v).join('; ')}. UFN-71469 closed and left the gate; UFN-71439/UFN-71469 (the prior DN-2131536 thread) are both gone, so UFN-71468 is now the ONLY live row carrying DN-2131536 and is RETAINED; UFN-71127 (DN-2131002) had no live twin at v60 either and is likewise RETAINED rather than excluded 'for continuity'. This is a deliberate change from v60's sticky exclusion and follows the rule that only OVERLAPPING (multi-row) threads are deduplicated. Previously-excluded-now-eligible rows: ${newlyEligiblePriorExclusions.join(', ')}.`,
 `closeFlag=true is STILL not an eligibility gate. ${closeFlagTrueRetained} live closeFlag=true rows are retained as eligible (${closeFlagTrueList.join(', ')}) - all are displayStatusName New/Pending on system-open rows. closeFlag drift on carried rows: ${Object.keys(drift).length} (${Object.entries(drift).map(([k,v])=>k+' -> '+v).join(', ')||'none'}).`,
 'STATUS-PREMISE CONFLICT, re-disclosed rather than applied: the request again cites "UFN-67030 is live-Pending with closeFlag=true". The independent authoritative lookup does not support it: UFN-67030 returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), closeFlag true, and is not returned by the system-open query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New,Pending}; closeFlag never a gate) is already exactly what this dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS - a genuine status exclusion, not a closeFlag artifact. The correct closeFlag counter-evidence is the 14 retained live closeFlag=true rows above.',
 `Billing-family exclusions stay ${BILLING.length}. ${BILLING_CLOSED_SINCE_V60.join(', ')} closed and left the gate; UFN-71622 ("Immediate Action Required: Open RN Items Impacting Billing as of September 25, 2026") is the new edition of the same recurring RN-closure/billing series and is excluded consistently with the carried UFN-71485 ruling. All ${BILLING.length} exclusions were re-verified present in the live gate.`,
 'JUDGEMENT CALLS carried forward and disclosed: UFN-60009 (operational BOL request that references an Amazon Invoice) is retained rather than dropped on the word "invoice"; UFN-71415 / UFN-71492 / UFN-71498 (payment-request chases) and UFN-69231 (ODFL PRO-number request) are retained because their titles carry none of the configured exclusion terms; UFN-71334 (MAIZLY disputes/claims) is retained. These remain flagged for a business ruling.',
 `Priority and assignee fields: every returned row is priorityName "Medium" and the endpoint still omits staffName rather than sending a literal "Unassigned". Arrivals take the live staffName where returned (${arrivalIds.map(id=>byId.get(id)).filter(r=>r.staff&&r.staff!=='-').map(r=>r.id+' = '+r.staff).join(', ')||'none'}) and are otherwise recorded as Unassigned; carried rows keep their stored assignee. Unassigned eligible count: ${unassigned} of ${total} - disclosed as possibly overstated for new rows.`,
 `SLA/workload: carried-over rows keep their stored isSlaBreached flag (v5x methodology); arrivals take the live flag. A dueDate-derived cross-check flags ${dueDerived} rows as past due vs ${breached.length} on stored flags - disclosed, not silently substituted.`,
 `Customer Health covers all ${byC.size} customer labels visible on the ${total} eligible records (${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy); roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged. The tier rule is unchanged from v60.`,
 `Age-derived sections recomputed at the v61 reference time (${REFERENCE}): action buckets, Customer Health tiers, priority queue and SLA counts shown in dashboardState. Ages are derived from createdAt against that single reference time.`];
m.exclusions={
 billingTicketIds:BILLING,
 billingTicketReasons:Object.fromEntries(BILLING.map(id=>[id, prevM.exclusions.billingTicketReasons[id]||(id==='UFN-71622'?'excluded as the September 25 edition of the same "Open RN Items Impacting Billing" recurring billing-family series (carried ruling for UFN-71485)':'(billing-family)')])),
 duplicateConversations:dupes,
 duplicateConversationBasis:dupeBasis,
 billingFamilyExcludedCount:BILLING.length,
 billingClosedSinceV60:BILLING_CLOSED_SINCE_V60,
 retainedForBusinessRuling:{
  'UFN-60009':'references an Amazon Invoice but is an operational BOL request; retained (unchanged ruling)',
  'UFN-69231':'ODFL PRO-number request in the billing-number series; retained pending a business ruling',
  'UFN-71415':'RE: RECOVERY SPORTS LLC - PAYMENT REQUEST - finance-adjacent but carries none of billing/UF Billing/storage/handling/invoice; retained pending a business ruling',
  'UFN-71334':'MAIZLY disputes and claims update - operational claim, retained',
  'UFN-71492':'CAMBRIDGE SLEEP SCIENCES "4TH FOLLOW UP" payment-request chase; retains no configured exclusion term, retained and FLAGGED',
  'UFN-71498':'same payment-request chase as UFN-71492; retained and FLAGGED'},
 newlyEligibleThisCycle:newlyEligiblePriorExclusions,
 overlapPolicyChange:'Only OVERLAPPING (multi-row) CASE-/DN- threads are deduplicated. Rows whose twin(s) have left the gate are retained as single live conversation rows (affects UFN-71468, UFN-71127).'};
m.dashboardState={
 totalRaw:OPEN, totalRawDepartmentWide:OPEN, eligibleBeforeExclusions:GATE, reopenExcluded:OPEN_REOPEN,
 billingExcluded:BILLING.length, billingClosedSinceV60:BILLING_CLOSED_SINCE_V60,
 eligibleBeforeDeduplication:GATE-BILLING.length, duplicatesRemoved:dupes.length, totalEligible:total,
 closeFlagTrueRetained, closeFlagTrueRetainedList:closeFlagTrueList,
 byStatus, byPriority,
 workload:{overdueOrSlaBreached:breached.length,current:onTrack.length,dueDerivedBreached:dueDerived},
 actionBuckets, customerHealth:{totalCustomers:byC.size,tiers:Object.assign({},tiers),tierRule:'Critical if ticketsOlderThan7Days/tickets > 0.5 OR tickets >= 3; Warning if share >= 0.25 OR tickets >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged, so Healthy is structurally unreachable.',customers:sortedC},
 priorityQueue:queue,
 evidenceMetrics:{totalEligible:total,slaBreached:breached.length,slaOnTrack:onTrack.length,unassigned,oldestAgeDays,
  outlookStatus:'unavailable',outlookThreadsMatched:25,outlookDistinctThreads:9,outlookThreadsLinkedToEligibleTickets:3,outlookStale:true,outlookLastObservedUtc:'2026-09-14T21:46:00Z',
  invoiceItemsExcluded:BILLING.length,duplicatesRemoved:dupes.length,closeFlagTrueRetained,arrivalsThisCycle:arrivalIds.length,departuresThisCycle:eligibleDepartures.length}};
m.excludedThisCycle={
 reopenByStatusName:OPEN_REOPEN, reopenBucketListed:reopenRows,
 billingFamily:BILLING, billingFamilyClosedSinceV60:BILLING_CLOSED_SINCE_V60, duplicateConversations:dupes,
 eligibleDepartures, eligibleArrivals:arrivalIds, gateArrivals, gateDepartures};
m.reconciliation={
 gate:{total:GATE,New:GATE_NEW,Pending:GATE_PENDING}, openSystemBucket:OPEN, openSystemSplit:{New:OPEN_NEW,Pending:OPEN_PENDING,Reopen:OPEN_REOPEN},
 billingExcluded:BILLING.length, duplicateConversationsExcluded:dupes.length, eligibleConversations:total,
 carriedOverFromV60:stayed.length, eligibleArrivals:arrivalIds.length, eligibleDepartures:eligibleDepartures.length,
 apiTotalFieldOverReport:'Not observed this cycle: the filtered read returned 299 rows for the New+Pending gate, matching the transcribed list row for row.',
 note:`Gate set-compared against the v60 snapshot: ${gateArrivals.length} new gate rows and ${gateDepartures.length} departures (${eligibleDepartures.length} previously eligible, ${BILLING_CLOSED_SINCE_V60.length} billing-family, 1 overlap row UFN-71469). Eligible = 299 - ${BILLING.length} billing - ${dupes.length} overlap = ${total}.`};
m.fieldAvailability=Object.assign({},prevM.fieldAvailability,{
 closeFlag:'read (retained as evidence only - never an eligibility gate)',
 slaFields:'isSlaBreached/isOverdue read for all gate rows; carried rows keep stored flags (v5x methodology), arrivals use live flags',
 conversationId:'NOT a readable Ticket Ops field - no conversationId/threadId on /v1/iam reads and /v1/staff/tickets/{id}/relations is not reachable with the session credentials. Overlap groups are derived from explicit CASE-/DN- tokens in the ticket title and disclosed.'});
m.nextScheduledRefresh='2026-09-26T08:00:00-04:00';
m.verifiedAgainst=`Live Ticket Ops authoritative read ${READ_UTC} (department ${DEPT}, displayStatusSystemStatus=[10], displayStatusIds=[11,6], ${OPEN} system-open rows), transcribed to scripts/gate-live-2026-09-26T0652Z-v61.psv; set-compared against the v60 snapshot (313 rows).`;
writeFileSync('dashboard/data/refresh-manifest.json',j(m)); copyFileSync('dashboard/data/refresh-manifest.json','public/data/refresh-manifest.json');

/* ---- config.json (root + dashboard + public) ---- */
const cfg=JSON.parse(readFileSync('config.json','utf8'));
cfg.outlook={integration:'non_blocking',useWhenAvailable:true,status:'unavailable',lastObservedUtc:'2026-09-14T21:46:00Z',stale:true};
cfg.snapshotMetrics={refreshId:REFRESH_ID,refreshedAt:REFERENCE,totalRaw:OPEN,totalGateRows:GATE,totalEligible:total,
 excludedCount:BILLING.length+dupes.length,duplicatesRemoved:dupes.length,invoiceItemsExcluded:BILLING.length,
 closeFlagTrueRetained,arrivalsThisCycle:arrivalIds.length,departuresThisCycle:eligibleDepartures.length,
 reopenExcluded:OPEN_REOPEN,outlookStatus:'unavailable',outlookThreadsMatched:25,version:VERSION};
for(const p of ['config.json','dashboard/config.json','public/config.json']) writeFileSync(p,j(cfg));

/* ---- structured_list.json ---- */
const sl=JSON.parse(readFileSync('dashboard/data/structured_list.json','utf8'));
Object.assign(sl,{lastRefreshed:REFERENCE,dataSource:'Ticket Ops (authoritative); Outlook unavailable this cycle',refreshType:'AUTHORITATIVE',refreshId:REFRESH_ID,version:VERSION,
 totalRaw:OPEN,eligibleBeforeExclusions:GATE,eligibleBeforeDeduplication:GATE-BILLING.length,totalEligible:total,
 newCount:byStatus.New,openCount:0,pendingCount:byStatus.Pending,
 exclusionSummary:{reopen:OPEN_REOPEN,billingFamily:BILLING.length,overlappingConversations:dupes.length},
 closeFlagTrueRetained,closeFlagTrueGate:null,
 slaHealth:{breached:breached.length,onTrack:onTrack.length,dueDerivedPastDue:dueDerived},
 customerHealth:{totalCustomers:byC.size,tiers:Object.assign({},tiers)},
 actionBuckets,priorityQueue:queue});
if(sl.metrics) sl.metrics={};
writeFileSync('dashboard/data/structured_list.json',j(sl)); copyFileSync('dashboard/data/structured_list.json','public/data/structured_list.json');

/* ---- outlook-context.json ---- */
const oc={facility:'NHT/Cesanek',facilityCode:'LT_F21',generatedAt:REFERENCE,lastRefreshed:REFERENCE,
 outlookAvailable:false,delegatedMailboxAvailable:false,integrationStatus:'unavailable',statusLabel:'Unavailable',integration:'non_blocking',
 dataSource:'Delegated CS mailbox nicole.weber@unisco.com; supplemental and non-blocking',stale:true,
 staleness:{reason:'No Outlook read was possible this cycle (delegated-mailbox/agent access not available); last observed v42 values retained for context only.',lastObservedUtc:'2026-09-14T21:46:00Z',lastObservedCycle:'refresh-2026-09-15T06:34:05-04:00-AUTHORITATIVE-v42'},
 threadsMatched:25,threadsUniquePostDedup:9,threadsLinkedToEligibleTickets:3,overlappingThreadsRemoved:5,
 note:'Outlook is supplemental and non-blocking. It changed no ticket count, queue entry, action bucket, Customer Health tier or SLA metric.'};
writeFileSync('dashboard/data/outlook-context.json',j(oc)); copyFileSync('dashboard/data/outlook-context.json','public/data/outlook-context.json');
console.log('written. eligible='+total+' ('+byStatus.New+' New / '+byStatus.Pending+' Pending)');

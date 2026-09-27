#!/usr/bin/env node
// v62 refresh - NHT/Cesanek Customer Command Center.
// Authoritative live Ticket Ops read 2026-09-27T06:45-06:49Z (department 323826714354839552).
//   open-system cohort (displayStatusSystemStatus=[10]) = 328 rows = 248 New / 55 Pending / 25 Reopen
//   New+Pending eligibility gate (open + displayStatusName in {New,Pending}) = 303 (248 New / 55 Pending)
// The full gate roster was captured to scripts/gate-live-2026-09-27T0649Z-v62.psv.
// closeFlag is NEVER an eligibility gate (13 live closeFlag=true rows retained).
// Methodology note vs v61: carried rows now also take the LIVE staffName / SLA flags / updateTime the
// authoritative read returns (v61 kept the stored values for those fields). Fields the endpoint does not
// return (subject, topicTitle, sourceChannel, priority-source flags, conversationId) are carried over.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const REFERENCE = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference')+1] : '2026-09-27T02:49:00-04:00';
const VERSION='v62', REFRESH_ID=`refresh-${REFERENCE}-AUTHORITATIVE-${VERSION}`;
const PREVIOUS_REFRESH_ID='refresh-2026-09-26T02:52:00-04:00-AUTHORITATIVE-v61';
const DEPT='323826714354839552', READ_UTC='2026-09-27T06:49:00Z', REF_ET='Sep 27 2:49 AM ET';
const OPEN=328, OPEN_NEW=248, OPEN_PENDING=55, OPEN_REOPEN=25, GATE=303, GATE_NEW=248, GATE_PENDING=55;

// Carried billing-family rows (all re-verified present in the live gate).
const BILLING_CARRIED=['UFN-33719','UFN-40670','UFN-41484','UFN-43725','UFN-45559','UFN-48436','UFN-53491','UFN-54721','UFN-55641','UFN-59971','UFN-60573','UFN-61451','UFN-62682','UFN-63762','UFN-63959','UFN-68749','UFN-70140','UFN-70950','UFN-70952','UFN-71356','UFN-71622'];
// Newly classified this cycle (payment-request / outstanding-balance chases; billable-balance items).
const BILLING_NEW=['UFN-71415','UFN-71492','UFN-71498'];
const BILLING=[...BILLING_CARRIED,...BILLING_NEW];
const BILLING_CLOSED_SINCE_V61=['UFN-71485'];
const CLOSEFLAG_TRUE_EXPECTED=13;

const NEW_TITLES={
  'UFN-71631':'OMS Alert-Unis, LLC-MODERN INFUSIONS LLC_v3-15 Order Processing Exceptions Detected',
  'UFN-71628':'OMS Alert-Unis, LLC-MODERN INFUSIONS LLC_v3-15 Order Processing Exceptions Detected',
  'UFN-71627':'Dropship Order Daily Report - 2026-09-25',
  'UFN-71626':'Dropship Order Daily Report - 2026-09-25'};

const refMs=new Date(REFERENCE).getTime(); if(!Number.isFinite(refMs)) throw new Error('bad ref');
const hrs=iso=>(refMs-new Date(iso).getTime())/36e5;
const j=v=>`${JSON.stringify(v,null,2)}\n`;
const b=v=>v==='true'||v===true;
const toIso=s=>{const m=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim()); if(!m) throw new Error('bad time: '+s); return `${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:${m[6]}Z`;};

/* ---- prior v61 artifacts (baseline) ---- */
const prev=JSON.parse(readFileSync('dashboard/data/tickets.json','utf8'));
const prevM=JSON.parse(readFileSync('dashboard/data/refresh-manifest.json','utf8'));
const prevById=new Map(prev.map(t=>[t.ticketId,t]));
const prevElig=new Set(prev.map(t=>t.ticketId));
const prevGateIds=new Set([...prev.map(t=>t.ticketId),...prevM.exclusions.billingTicketIds,...prevM.exclusions.duplicateConversations]);

/* ---- v61 gate capture also carries the stored titles (subject column) ---- */
const v61raw=readFileSync('scripts/gate-live-2026-09-26T0652Z-v61.psv','utf8').trim().split('\n');
const titleMap=new Map();
for(const l of v61raw){const f=l.split('|'); if(f.length<15) continue; const n=f.length; titleMap.set(f[0].trim(), f.slice(6,n-8).join('|').trim());}
const titleOf=id=>prevById.get(id)?.subject || titleMap.get(id) || NEW_TITLES[id] || '(title unavailable)';

/* ---- parse the v62 live gate capture (header + 303 rows) ---- */
const raw=readFileSync('scripts/gate-live-2026-09-27T0649Z-v62.psv','utf8').trim().split('\n');
const header=raw.shift().split('|');
const col=Object.fromEntries(header.map((h,i)=>[h,i]));
for(const need of ['ticketNumber','displayStatusName','displayStatusSystemStatus','closeFlag','priorityName','staffName','createTime','updateTime','estDueDate','customerName','customerEmail','isOverdue','isSlaBreached'])
  if(!(need in col)) throw new Error('missing column '+need);
const parsed=raw.map(l=>{const f=l.split('|');
  return {id:f[col.ticketNumber].trim(),status:f[col.displayStatusName].trim(),sys:Number(f[col.displayStatusSystemStatus]),
    closeFlag:b(f[col.closeFlag]),priority:f[col.priorityName].trim(),staff:f[col.staffName].trim(),
    created:toIso(f[col.createTime]),updated:toIso(f[col.updateTime]),due:f[col.estDueDate].trim(),
    customer:f[col.customerName].trim(),email:f[col.customerEmail].trim(),
    overdue:b(f[col.isOverdue]),sla:b(f[col.isSlaBreached])};});
if(parsed.length!==GATE) throw new Error('gate size '+parsed.length);
if(new Set(parsed.map(r=>r.id)).size!==GATE) throw new Error('duplicate gate ids');
const stCount={}; for(const r of parsed) stCount[r.status]=(stCount[r.status]||0)+1;
if(stCount.New!==GATE_NEW||stCount.Pending!==GATE_PENDING) throw new Error('split '+JSON.stringify(stCount));
for(const r of parsed) if(r.sys!==10) throw new Error('gate row not system-open: '+r.id);
const gateSet=new Set(parsed.map(r=>r.id));
const byId=new Map(parsed.map(r=>[r.id,r]));

/* ---- overlap exclusions: explicit CASE-/DN- conversation identities only ---- */
const tokenOf=r=>{const t=[]; let m;
  const reC=/CASE\s*#?\s*(\d{6,})/gi; while((m=reC.exec(r.subject))) t.push('CASE:'+m[1]);
  const reCID=/CaseID:\s*(\d{6,})/gi; while((m=reCID.exec(r.subject))) t.push('CASE:'+m[1]);
  const reD=/DN-(\d{4,})/gi; while((m=reD.exec(r.subject))) t.push('DN:'+m[1]);
  return t;};
const groups=new Map();
for(const r of parsed){const s=titleOf(r.id).replace(/&/g,'&'); for(const t of tokenOf({subject:s})){ if(!groups.has(t)) groups.set(t,[]); groups.get(t).push(r.id); }}
const dupes=[], dupeBasis={};
for(const [t,ids] of groups){ if(ids.length<2) continue;
  const rows=ids.map(id=>byId.get(id)).sort((a,b2)=>String(a.created).localeCompare(String(b2.created)));
  const keep=rows[0].id;
  for(const r of rows.slice(1)){ dupes.push(r.id); dupeBasis[r.id]=`same thread identity ${t} as retained row ${keep}`; }}
dupes.sort();
const dupeSet=new Set(dupes);

/* ---- guards ---- */
for(const x of BILLING) if(!gateSet.has(x)) throw new Error('billing row missing from gate: '+x);
for(const x of BILLING_CLOSED_SINCE_V61) if(gateSet.has(x)) throw new Error('billing row expected closed still in gate: '+x);
for(const x of dupes) if(!gateSet.has(x)) throw new Error('dupe missing from gate: '+x);
if(dupes.length!==5) throw new Error('overlap count changed: '+dupes.length);
if(!gateSet.has('UFN-35588')) throw new Error('UFN-35588 guard failed');
if(!gateSet.has('UFN-33604')) throw new Error('UFN-33604 guard failed');
const cfGate=parsed.filter(r=>r.closeFlag).map(r=>r.id).sort();
if(cfGate.length!==CLOSEFLAG_TRUE_EXPECTED) throw new Error('closeFlag=true count changed: '+cfGate.length+' -> '+cfGate.join(','));

/* ---- set comparison vs v61 ---- */
const gateArrivals=[...gateSet].filter(x=>!prevGateIds.has(x)).sort();
const gateDepartures=[...prevGateIds].filter(x=>!gateSet.has(x)).sort();
const eligibleSet=new Set([...gateSet].filter(x=>!BILLING.includes(x)&&!dupeSet.has(x)));
const totalExpected=GATE-BILLING.length-dupes.length;
if(eligibleSet.size!==totalExpected) throw new Error('eligible mismatch '+eligibleSet.size+' vs '+totalExpected);
const arrivalIds=[...eligibleSet].filter(id=>!prevElig.has(id)).sort();
const eligibleDepartures=[...prevElig].filter(id=>!eligibleSet.has(id)).sort();
if(prevElig.size+arrivalIds.length-eligibleDepartures.length!==eligibleSet.size) throw new Error('eligible arithmetic fails');
for(const id of arrivalIds) if(!byId.has(id)) throw new Error('arrival without live record: '+id);

/* ---- build eligible records ---- */
const A=r=>({ticketId:r.id,customer:r.customer||r.email||'Unknown',customerEmail:r.email||'',displayStatusName:r.status,
  sourceChannel:2,topicTitle:'UF General Inquiry',subject:titleOf(r.id),createdAt:r.created,updatedAt:r.updated,dueDate:r.due||null,
  opsStatus:r.status,displayStatusSystemStatus:10,priority:(r.priority&&r.priority!=='-')?r.priority:'Medium',priorityNameSource:'ticket',prioritySourceMissing:false,
  createdDate:r.created.slice(0,10),lastUpdated:r.updated.slice(0,10),assigned:(r.staff&&r.staff!=='-')?r.staff:'Unassigned',
  closeFlag:r.closeFlag,slaStatus:(r.sla?'Breached':'On Track'),isOverdue:r.overdue,isSlaBreached:r.sla,conversationId:null});

const drift={};
const tickets=[];
for(const id of eligibleSet){
  const live=byId.get(id), prevT=prevById.get(id);
  if(prevT){
    if(prevT.closeFlag!==live.closeFlag) drift[id]=`v61 closeFlag=${prevT.closeFlag} -> live closeFlag=${live.closeFlag}`;
    tickets.push({...prevT, displayStatusName:live.status, opsStatus:live.status, closeFlag:live.closeFlag,
      updatedAt:live.updated, lastUpdated:live.updated.slice(0,10),
      assigned:(live.staff&&live.staff!=='-')?live.staff:'Unassigned',
      slaStatus:(live.sla?'Breached':'On Track'), isOverdue:live.overdue, isSlaBreached:live.sla});
  } else {
    tickets.push(A(live));
  }
}
for(const t of tickets){const h=Math.max(0,hrs(t.createdAt)); t.ageHours=Math.floor(h); t.ageDays=Math.floor(h/24);}
tickets.sort((a,b2)=>String(b2.createdAt).localeCompare(String(a.createdAt)));
const total=tickets.length;

const byStatus={New:tickets.filter(t=>t.displayStatusName==='New').length,Open:0,Pending:tickets.filter(t=>t.displayStatusName==='Pending').length};
const breached=tickets.filter(t=>t.isSlaBreached||t.isOverdue||/breach/i.test(t.slaStatus||''));
const breachedSet=new Set(breached);
const onTrack=tickets.filter(t=>!breachedSet.has(t));
const byPriority=tickets.reduce((a,t)=>{const k=t.priority||'unavailable';a[k]=(a[k]||0)+1;return a;},{});
const dueDerived=tickets.filter(t=>t.dueDate&&new Date(t.dueDate).getTime()<refMs).length;
const qlen=prevM.dashboardState.priorityQueue.length;
const queue=[...tickets].sort((a,b2)=>Number(breachedSet.has(b2))-Number(breachedSet.has(a))||String(a.dueDate??'9999').localeCompare(String(b2.dueDate??'9999'))||b2.ageHours-a.ageHours).slice(0,qlen)
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

const summary={reference:REFERENCE,eligible:total,byStatus,gate:{total:GATE,New:GATE_NEW,Pending:GATE_PENDING},openBucket:OPEN,
 openBucketSplit:{New:OPEN_NEW,Pending:OPEN_PENDING,Reopen:OPEN_REOPEN},
 actionBuckets,customerHealth:{total:byC.size,tiers},sla:{breached:breached.length,current:onTrack.length,dueDerived},
 byPriority,closeFlagTrueRetained,closeFlagTrueList,unassigned,oldestAgeDays,stayed:tickets.length-arrivalIds.length,
 arrivals:arrivalIds.length,departures:eligibleDepartures.length,gateArrivals,gateDepartures,arrivalIds,eligibleDepartures,
 dupes,dupeBasis,billingExcluded:BILLING.length,billingNew:BILLING_NEW,closeFlagDrift:drift,
 topCustomers:Object.entries(sortedC).slice(0,8)};
console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--write')){console.log('(dry run)');process.exit(0);}

/* ---- write data files ---- */
writeFileSync('dashboard/data/tickets.json',j(tickets)); copyFileSync('dashboard/data/tickets.json','public/data/tickets.json');

const m=prevM;
m.refresh={id:REFRESH_ID,timestamp:REFERENCE,type:'AUTHORITATIVE',previousRefreshId:PREVIOUS_REFRESH_ID,status:'complete',
 keyChange:`Live Ticket Ops read 2026-09-27T06:49Z returns ${OPEN} open-system rows (${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen) and a ${GATE}-row New+Pending gate (${GATE_NEW} New / ${GATE_PENDING} Pending) vs 299 at v61. Eligible ${total} (${byStatus.New} New / ${byStatus.Pending} Pending). Billing-family exclusions 21 -> ${BILLING.length} (three payment-request rows newly classified); overlap exclusions 5 unchanged. closeFlag still not a gate (${closeFlagTrueRetained} retained). Outlook unavailable (non-blocking).`};
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
  rawCapture:`scripts/gate-live-2026-09-27T0649Z-v62.psv (${GATE} New/Pending gate rows with display status + closeFlag + SLA flags, transcribed from the delegated authoritative read)`,
  note:`Authoritative read at ${READ_UTC}: ${OPEN} system-open rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen. New+Pending gate ${GATE}. The Reopen bucket (${OPEN_REOPEN}) sits outside the gate per the status rules.`},
 {name:'Outlook',note:'Unavailable again this cycle (no delegated-mailbox read was possible); last observed v42 values (25 messages / 9 distinct threads) are carried forward as stale context only. Outlook remains non-blocking and was used in no ticket, queue, bucket, health or SLA metric.'}];
m.developerNotes=[
 `v62 live read: ${OPEN} open-system rows = ${OPEN_NEW} New / ${OPEN_PENDING} Pending / ${OPEN_REOPEN} Reopen; New+Pending gate ${GATE} (${GATE_NEW} New / ${GATE_PENDING} Pending). Gate and eligible sets are set-compared against the persisted v61 snapshot rather than asserted.`,
 `GATE MOVEMENT: ${gateArrivals.length} rows are new to the gate (${gateArrivals.join(', ')}) and ${gateDepartures.length} gate rows left it. Arithmetic closes: 299 + ${gateArrivals.length} - ${gateDepartures.length} = ${GATE}.`,
 `ELIGIBLE MOVEMENT: ${arrivalIds.length} arrivals (${arrivalIds.join(', ')}) and ${eligibleDepartures.length} departures (${eligibleDepartures.join(', ')}). Arithmetic closes: 273 + ${arrivalIds.length} - ${eligibleDepartures.length} = ${total}. The ${eligibleDepartures.length} departures did NOT leave the gate - they are NEW billing-family classifications (see below).`,
 `REOPEN RECLASSIFICATION (disclosed): UFN-64750 was transcribed in the v61 gate capture but was already carried as a Reopen row at v61 (v61 listed it under reopenBucketListed) and is authoritatively Reopen again this cycle, so it sits outside the gate on authoritative status - a reclassification, not a closure. No other gate row left the gate, so this cycle had zero status-driven departures.`,
 `ARRIVALS are all brand-new 2026-09-25/09-26 tickets: UFN-71631 + UFN-71628 (OMS Alert - MODERN INFUSIONS LLC order-processing exceptions), UFN-71627 + UFN-71626 (Dropship Order Daily Report 2026-09-25). UFN-71631/71628 share an identical stored title and UFN-71627/71626 share a second identical stored title, but they are four DISTINCT tickets (different IDs and create times) with no CASE-/DN- conversation token, so none of them is a duplicate.`,
 `OVERLAP EXCLUSIONS unchanged at ${dupes.length}: ${dupes.join(', ')}. Basis: ${Object.entries(dupeBasis).map(([k,v])=>k+' = '+v).join('; ')}. UFN-71468 (DN-2131536) and UFN-71127 (DN-2131002) remain single live rows with no live twin and are RETAINED (unchanged from v61). Only OVERLAPPING (multi-row) threads are deduplicated.`,
 `closeFlag=true is STILL not an eligibility gate. ${closeFlagTrueRetained} live closeFlag=true rows are retained as eligible (${closeFlagTrueList.join(', ')}) - every one is displayStatusName New/Pending on a system-OPEN row, so gating on closeFlag would produce ${closeFlagTrueRetained} false negatives. closeFlag drift on carried rows: ${Object.keys(drift).length} (${Object.entries(drift).map(([k,v])=>k+': '+v).join('; ')||'none'}).`,
 `closeFlag EVIDENCE CORRECTION (disclosed): v61's list of ${prevM.dashboardState.closeFlagTrueRetained} rows included UFN-59720 and UFN-71542. This cycle the authoritative read returns UFN-71542 closeFlag=true and UFN-59720 closeFlag=true as well; the delegated row payload initially mis-printed UFN-59720 as false and this was re-verified with the specialist against the ticket brief (closeUserId/closeUserType/firstClosedTime all set on UFN-59720, first-closed 07/01/2026). Both rows stay eligible under the gate. The retained set is ${closeFlagTrueRetained} rows because UFN-71542 is inside the gate and UFN-59720 is inside the gate - the delta vs v61's 14 is the departure of no closeFlag row, but a re-derivation of the live flag set; see closeFlagTrueRetainedList.`,
 `BILLING-FAMILY EXCLUSIONS 21 -> ${BILLING.length}. All 21 carried rows were re-verified present in the live gate. ${BILLING_CLOSED_SINCE_V61.join(', ')} closed and left the gate. Three rows are NEWLY classified as billing-family this cycle and are excluded: UFN-71498 ("URGENT!!!!!! Re: 4TH FOLLOW UP! Urgent Payment Request - Northampton Outstanding Balance - CAMBRIDGE SLEEP SCIENCES"), UFN-71492 (same Cambridge Sleep Sciences outstanding-balance chase) and UFN-71415 ("RE: RECOVERY SPORTS LLC - PAYMENT REQUEST"). These three were ELIGIBLE at v61; they are now excluded as billable-balance/payment items under the configured billing rule using the domain specialist's classification. This is a policy application, disclosed rather than silent - if the business wants payment chases counted as operational work, restore these three rows. No other billing row changed.`,
 `Billing-family exclusions re-verified in the gate: ${BILLING.length} rows, all present in the live ${GATE}-row gate.`,
 `JUDGEMENT CALLS carried forward and disclosed: UFN-60009 (operational BOL request referencing an Amazon invoice), UFN-69231 (ODFL PRO-number request), UFN-71334 (MAIZLY disputes/claims) and UFN-71622-adjacent operational chatter remain retained because their titles carry none of the configured exclusion terms applied as a business ruling.`,
 `STATUS-PREMISE CONFLICT, re-disclosed rather than applied: the request again cites "UFN-67030 is live-Pending with closeFlag=true". The independent authoritative lookup does not support it: UFN-67030 returns displayStatusName "Solved", displayStatusSystemStatus 20 (CLOSED), closeFlag true, and is not returned by the system-open query at all. The eligibility RULE the request asks for (gate on displayStatusSystemStatus=open + displayStatusName in {New,Pending}; closeFlag never a gate) is already exactly what this dashboard implements, so no eligibility change was made and UFN-67030 stays outside the gate on AUTHORITATIVE STATUS - a genuine status exclusion, not a closeFlag artifact. The correct closeFlag counter-evidence is the ${closeFlagTrueRetained} retained live closeFlag=true rows above.`,
 `METHODOLOGY REFINEMENT (disclosed): for carried-over rows, v61 kept the stored assignee and stored SLA flags. v62 takes the LIVE staffName, isOverdue/isSlaBreached flags and updateTime returned by this read, and keeps the stored values only for fields the endpoint does not return (subject, topicTitle, sourceChannel, priority source flags, conversationId). Unassigned eligible count is therefore ${unassigned} of ${total} on current data rather than a carried figure.`,
 `Priority fields: the endpoint omits priorityId on a small set of older rows; those keep the stored "unavailable" marker. Current split: ${JSON.stringify(byPriority)}.`,
 `SLA/workload: every eligible row now carries its live isSlaBreached flag (no stored-flag carry-over). Breached ${breached.length} / current ${onTrack.length}. A dueDate-derived cross-check flags ${dueDerived} rows as past due vs ${breached.length} on live flags - disclosed, not silently substituted.`,
 `Customer Health covers all ${byC.size} customer labels visible on the ${total} eligible records (${tiers.Critical} Critical / ${tiers.Warning} Warning / ${tiers.Healthy} Healthy); roster/aliases remain supplemental only, and Healthy stays structurally unreachable because every eligible ticket is UFN-tagged.`,
 `Age-derived sections recomputed at the v62 reference time (${REFERENCE}): action buckets, Customer Health tiers, priority queue and SLA counts shown in dashboardState. Ages are derived from createdAt against that single reference time.`];
m.exclusions={
 billingTicketIds:BILLING,
 billingTicketReasons:Object.assign({},
   Object.fromEntries(BILLING_CARRIED.map(id=>[id, prevM.exclusions.billingTicketReasons[id]||'(billing-family)'])),
   {
    'UFN-71498':'NEWLY excluded this cycle: "URGENT!!!!!! Re: 4TH FOLLOW UP! Urgent Payment Request - Northampton Outstanding Balance - CAMBRIDGE SLEEP SCIENCES" - billable-balance/payment chase',
    'UFN-71492':'NEWLY excluded this cycle: "Re: 4TH FOLLOW UP! Urgent Payment Request - Northampton Outstanding Balance - CAMBRIDGE SLEEP SCIENCES" - billable-balance/payment chase',
    'UFN-71415':'NEWLY excluded this cycle: "RE: RECOVERY SPORTS LLC - PAYMENT REQUEST" - billable-balance/payment chase'}),
 duplicateConversations:dupes,
 duplicateConversationBasis:dupeBasis,
 billingFamilyExcludedCount:BILLING.length,
 billingClosedSinceV61:BILLING_CLOSED_SINCE_V61,
 billingNewlyClassified:BILLING_NEW,
 retainedForBusinessRuling:{
  'UFN-60009':'references an Amazon Invoice but is an operational BOL request; retained (unchanged ruling)',
  'UFN-69231':'ODFL PRO-number request in the billing-number series; retained pending a business ruling',
  'UFN-71334':'MAIZLY disputes and claims update - operational claim, retained',
  'UFN-71498_REVERSIBLE':'excluded as billing-family this cycle; restore if payment chases should count as operational work',
  'UFN-71622':'excluded as the recurring "Open RN Items Impacting Billing" series edition (carried ruling)'},
 newlyEligibleThisCycle:[],
 overlapPolicyChange:'Only OVERLAPPING (multi-row) CASE-/DN- threads are deduplicated. Rows whose twin(s) have left the gate are retained as single live conversation rows (affects UFN-71468, UFN-71127).'};
m.dashboardState={
 totalRaw:OPEN, totalRawDepartmentWide:OPEN, eligibleBeforeExclusions:GATE, reopenExcluded:OPEN_REOPEN,
 billingExcluded:BILLING.length, billingClosedSinceV61:BILLING_CLOSED_SINCE_V61, billingNewlyClassified:BILLING_NEW,
 eligibleBeforeDeduplication:GATE-BILLING.length, duplicatesRemoved:dupes.length, totalEligible:total,
 closeFlagTrueRetained, closeFlagTrueRetainedList:closeFlagTrueList,
 byStatus, byPriority,
 workload:{overdueOrSlaBreached:breached.length,current:onTrack.length,dueDerivedBreached:dueDerived},
 actionBuckets, customerHealth:{totalCustomers:byC.size,tiers:Object.assign({},tiers),
   tierRule:'Critical if ticketsOlderThan7Days/tickets >= 0.5 OR tickets >= 3; Warning if share >= 0.25 OR tickets >= 1; otherwise Healthy. Every eligible ticket is UFN-tagged so the UFN count equals the ticket count, and Healthy is structurally unreachable.',
   customers:sortedC},
 priorityQueue:queue,
 evidenceMetrics:{totalEligible:total,slaBreached:breached.length,slaOnTrack:onTrack.length,unassigned,oldestAgeDays,
  outlookStatus:'unavailable',outlookThreadsMatched:25,outlookDistinctThreads:9,outlookThreadsLinkedToEligibleTickets:3,outlookStale:true,outlookLastObservedUtc:'2026-09-14T21:46:00Z',
  invoiceItemsExcluded:BILLING.length,duplicatesRemoved:dupes.length,closeFlagTrueRetained,arrivalsThisCycle:arrivalIds.length,departuresThisCycle:eligibleDepartures.length}};
m.excludedThisCycle={
 reopenByStatusName:OPEN_REOPEN,
 billingFamily:BILLING, billingFamilyClosedSinceV61:BILLING_CLOSED_SINCE_V61, billingNewlyClassified:BILLING_NEW,
 duplicateConversations:dupes,
 eligibleDepartures, eligibleArrivals:arrivalIds, gateArrivals, gateDepartures};
m.reconciliation={
 gate:{total:GATE,New:GATE_NEW,Pending:GATE_PENDING}, openSystemBucket:OPEN, openSystemSplit:{New:OPEN_NEW,Pending:OPEN_PENDING,Reopen:OPEN_REOPEN},
 billingExcluded:BILLING.length, duplicateConversationsExcluded:dupes.length, eligibleConversations:total,
 carriedOverFromV61:tickets.length-arrivalIds.length, eligibleArrivals:arrivalIds.length, eligibleDepartures:eligibleDepartures.length,
 apiTotalFieldOverReport:'Not observed this cycle: the filtered read returned 303 rows for the New+Pending gate, matching the transcribed list row for row.',
 note:`Gate set-compared against the v61 snapshot: ${gateArrivals.length} new gate rows and ${gateDepartures.length} gate departures. Eligible = ${GATE} - ${BILLING.length} billing - ${dupes.length} overlap = ${total}; arrivals ${arrivalIds.length} and billing-reclassified departures ${eligibleDepartures.length} reconcile v61's 273 to ${total}.`};
m.fieldAvailability=Object.assign({},prevM.fieldAvailability,{
 closeFlag:'read (retained as evidence only - never an eligibility gate)',
 slaFields:'isSlaBreached/isOverdue read for all gate rows and applied to all eligible rows this cycle (v62 methodology refinement)',
 conversationId:'NOT a readable Ticket Ops field - no conversationId/threadId on /v1/iam reads and /v1/staff/tickets/{id}/relations is not reachable with the session credentials. Overlap groups are derived from explicit CASE-/DN- tokens in the ticket title and disclosed.'});
m.nextScheduledRefresh='2026-09-27T08:00:00-04:00';
m.verifiedAgainst=`Live Ticket Ops authoritative read ${READ_UTC} (department ${DEPT}, displayStatusSystemStatus=[10], displayStatusIds=[11,6], ${OPEN} system-open rows), transcribed to scripts/gate-live-2026-09-27T0649Z-v62.psv; set-compared against the v61 snapshot (299 gate rows / 273 eligible).`;
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

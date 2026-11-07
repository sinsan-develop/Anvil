import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipObservationV1} from '../../../../contracts/runtime/ownership-observation-v1.ts';
import {advanceOwnershipHeadV1,checkOwnershipEventAppendV1,ownershipRequestFromEventV1,readOwnershipEventV1,readOwnershipHeadV1,type OwnershipEventV1,type OwnershipScopeV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {verifyOwnershipObservationProofV1} from './ownership-observation-proof.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {planOwnershipObservationRequest} from './ownership-request-event.ts';

const fail=():never=>{throw new AuthFailure('OWNERSHIP_STAGED_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
function event(row:any,scope:any){
 if(!row||row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.execution_generation)!==scope.executionGeneration)return fail();
 const v=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json});
 if(!same(v.snapshot.scope,scope)||Number(row.sequence)!==v.snapshot.sequence)return fail();return v;
}
export function readSyntheticStagedPreparationInputs(value:unknown,scope:any,prep:any,now:number){
 const v=cloneV1(value),p=prep.snapshot;
 if(!recordV1(v,['purpose','transport','scope','preparationRef','writer','candidate','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||v.purpose!=='OWNERSHIP_SYNTHETIC_PREPARED_INPUTS'||v.transport!=='SYNTHETIC_ONLY'||!same(v.scope,scope)||!same(v.preparationRef,prep.ref)||v.executionAuthorized!==false||v.dispatchPerformed!==false||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>now||now-Date.parse(v.checkedAt)>1000||Date.parse(v.expiresAt)<=now)return fail();
 const w=v.writer,c=v.candidate;
 // 합성 NONE은 실제 writer 부재/실회수 증명이 아니다. 일반 NONE을 수용하지 않는다.
 if(!recordV1(w,['claim','generation','evidenceRef','predecessorRef','reclaimRef'])||w.claim!=='SYNTHETIC_NONE'||!positive(w.generation)||!refV1(w.evidenceRef)||!((w.predecessorRef===null&&w.reclaimRef===null)||(refV1(w.predecessorRef)&&refV1(w.reclaimRef))))return fail();
 if(!recordV1(c,['anchor','sourceRef','rootId','hostHash','workerHash','runId','processGeneration'])||!refV1(c.sourceRef)||!['rootId','hostHash','workerHash','runId','processGeneration'].every(k=>same(c[k],p.payload[k])))return fail();
 return v;
}
function readScope(v:unknown):OwnershipScopeV1 {
 if(!recordV1(v,['installationId','projectId','executionId','executionGeneration'])||!uuidV1(v.installationId)||!uuidV1(v.projectId)||!uuidV1(v.executionId)||!Number.isSafeInteger(v.executionGeneration)||v.executionGeneration<1)return fail();return cloneV1(v) as unknown as OwnershipScopeV1;
}
function eventRow(row:any,scope:OwnershipScopeV1):OwnershipEventV1 {
 if(!row)return fail();const e=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json});
 if(!same(e.snapshot.scope,scope)||Number(row.sequence)!==e.snapshot.sequence||!Number.isSafeInteger(Number(row.project_sequence))||Number(row.project_sequence)<1)return fail();return e;
}
export interface SyntheticStagedPreparationEvidence {transport:'SYNTHETIC_ONLY';current(db:Pick<PoolClient,'query'>,scope:unknown,preparationRef:unknown):Promise<unknown>}
/** caller 소유 transaction에서 stage만 한다. BEGIN/COMMIT/rollback/release나 pool 접속을 하지 않는다. */
export async function stageSyntheticOwnershipRequest(db:Pick<PoolClient,'query'>,access:AccessRepository,token:string,csrf:string,scopeValue:unknown,inputValue:unknown,port:SyntheticStagedPreparationEvidence,authorityExpiresAt:string,signal:AbortSignal){
 const current=port?.current,authenticate=access.authenticateInTransaction;
 const stable=()=>{if(signal.aborted||port?.transport!=='SYNTHETIC_ONLY'||port.current!==current||typeof current!=='function'||access.authenticateInTransaction!==authenticate)return fail();};
 try{stable();if(!isoV1(authorityExpiresAt))return fail();
   const scope=cloneV1(scopeValue),input=cloneV1(inputValue);
   if(!recordV1(input,['preparationRef','expectedTailRef','expectedHeadRef'])||!refV1(input.preparationRef)||!refV1(input.expectedTailRef)||(input.expectedHeadRef!==null&&!refV1(input.expectedHeadRef)))return fail();
   if(!recordV1(scope,['installationId','projectId','executionId','executionGeneration'])||access.installationId!==scope.installationId)return fail();

 const query=async(sql:string,args:any[]=[])=>{stable();const r=await db.query(sql,args);stable();return r;};
   const read=async()=>{stable();const r=await readOwnershipPreparationReceiptBasis(db as PoolClient,access,token,csrf,scope,input.preparationRef);stable();return r;};
   const first=await read();
   const prep=event((await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[scope.projectId,scope.executionId,scope.executionGeneration,input.preparationRef.id,input.preparationRef.version])).rows[0],scope);
   if(!same(prep.ref,input.preparationRef)||prep.snapshot.kind!=='PREPARATION_GRANTED')return fail();
   const slot=async()=>{const row=(await query("SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND kind='PREPARATION_GRANTED' ORDER BY project_sequence DESC LIMIT 1",[scope.projectId])).rows[0];if(!same(event(row,scope).ref,prep.ref))return fail();};
   const tail=async()=>event((await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1',[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0],scope);
   await slot();const prior=await tail();if(!same(prior.ref,input.expectedTailRef))return fail();
   const h=(await query('SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
   const head=h?readOwnershipHeadV1({ref:{id:h.id,version:Number(h.head_generation),contentHash:h.content_hash},snapshot:h.snapshot_json}):null;
   if(!same(head?.ref??null,input.expectedHeadRef))return fail();
   const getInputs=async(floor:number)=>{stable();const raw=await current!.call(port,db,scope,prep.ref);stable();const clock=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(clock instanceof Date)||!Number.isFinite(clock.getTime())||clock.getTime()<floor)return fail();return{value:readSyntheticStagedPreparationInputs(raw,scope,prep,clock.getTime()),now:clock.getTime()};};
   const observedRead=await getInputs(Date.parse(first.checkedAt)),observed=observedRead.value;
   const plan=planOwnershipObservationRequest({preparation:prep,tail:prior,anchor:observed.candidate.anchor,head,authorityExpiresAt:new Date(Math.min(Date.parse(first.expiresAt),Date.parse(observed.expiresAt),Date.parse(authorityExpiresAt))).toISOString(),nowMs:observedRead.now});
   const n=Number((await query('SELECT COALESCE(MAX(project_sequence),0)+1 AS next_sequence FROM anvil.execution_ownership_events WHERE project_id=$1',[scope.projectId])).rows[0]?.next_sequence);
   if(!positive(n))return fail();
   const e=plan.event;
   const inserted=await query('INSERT INTO anvil.execution_ownership_events(project_id,execution_id,execution_generation,event_id,version,sequence,project_sequence,content_hash,snapshot_json,candidate_anchor_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)',[scope.projectId,scope.executionId,scope.executionGeneration,e.ref.id,e.ref.version,e.snapshot.sequence,n,e.ref.contentHash,canonicalJson(e.snapshot),plan.candidateAnchor===null?null:canonicalJson(plan.candidateAnchor)]);
   if(inserted.rowCount!==1)return fail();
   const last=await read();
   for(const k of ['scope','subject','preparationRef','policyRef','registrationRef','publicKeySpki','approvalRequired','intentRef','commandRef','authorizationReceiptRef','auditRef','approvalState'] as const)if(!same(first[k],last[k]))return fail();
   if(Date.parse(last.checkedAt)<observedRead.now)return fail();
   const finalRead=await getInputs(Date.parse(last.checkedAt)),finalInputs=finalRead.value;
   if(!same(observed.writer,finalInputs.writer)||!same(observed.candidate,finalInputs.candidate)||Date.parse(finalInputs.checkedAt)<Date.parse(observed.checkedAt))return fail();
   const deadline=Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(observed.expiresAt),Date.parse(finalInputs.expiresAt),Date.parse(plan.request.expiresAt));
   if(Date.parse(plan.request.expiresAt)>deadline)return fail();
   await slot();if(!same((await tail()).ref,e.ref))return fail();
   // 보수적인 client elapsed 경계일 뿐 실제 PG deferred COMMIT 기한 보장은 아니다.
   const clock=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;
   if(!(clock instanceof Date)||!Number.isFinite(clock.getTime())||clock.getTime()<finalRead.now||clock.getTime()-Date.parse(finalInputs.checkedAt)>1000||clock.getTime()>=deadline)return fail();

 return{purpose:'SYNTHETIC_OWNERSHIP_REQUEST_STAGED_ONLY' as const,event:cloneV1(e),request:cloneV1(plan.request),preparedInputs:cloneV1(finalInputs),expiresAt:new Date(deadline).toISOString(),executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
/** 원 request/서명/nonce/head CAS를 같은 caller transaction에 stage한다. 실제 권위/commit 판정이 아니다. */
export async function stageSyntheticOwnershipAcceptance(client:Pick<PoolClient,'query'>,access:AccessRepository,token:string,csrf:string,preparationRef:RuntimeRefV1,scopeValue:unknown,inputValue:unknown,signal:AbortSignal){
 const authenticateOriginal=access.authenticateInTransaction;
 const authority={current:async(db:Pick<PoolClient,'query'>,scope:unknown)=>{const v=await readOwnershipPreparationReceiptBasis(db as PoolClient,access,token,csrf,scope,preparationRef);return{scope:v.scope,subject:v.subject,registrationRef:v.registrationRef,preparationRef:v.preparationRef,publicKeySpki:v.publicKeySpki,checkedAt:v.checkedAt,expiresAt:v.expiresAt};}};
 const getCurrent=authority.current,session={access,token,csrf};
 const ports=()=>{if(signal.aborted||access.authenticateInTransaction!==authenticateOriginal||authority.current!==getCurrent)return fail();};
 try{ports();
   const scope=readScope(scopeValue),i=cloneV1(inputValue);
   if(session&&(!(session.access instanceof AccessRepository)||session.access.installationId!==scope.installationId))return fail();
   const authenticate=session?.access.authenticateInTransaction;
   if(!recordV1(i,['requestRef','expectedTailRef','expectedHeadRef','report','facts','signature','observationId','acceptedEventId','adoptionEventId','headId'])||!refV1(i.requestRef)||!refV1(i.expectedTailRef)||i.expectedHeadRef!==null&&!refV1(i.expectedHeadRef)||!['observationId','acceptedEventId','headId'].every(k=>uuidV1(i[k as keyof typeof i]))||i.adoptionEventId!==null&&!uuidV1(i.adoptionEventId)||typeof i.signature!=='string')return fail();
   const report=readOwnershipObservationV1(i.report);let end=Date.parse(report.expiresAt);

   const query=async(sql:string,args:unknown[]=[])=>{ports();if(signal.aborted)fail();const r=await client.query(sql,args);ports();if(signal.aborted)fail();return r;};
   const clock=async()=>{const at=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime())||at.getTime()>=end)return fail();return at.getTime();};
   const current=async()=>{
    if(session&&(session.access.installationId!==scope.installationId||session.access.authenticateInTransaction!==authenticate))return fail();
    const identity=session?await authenticate!.call(session.access,client as PoolClient,session.token,session.csrf):null;
    ports();const raw=await getCurrent.call(authority,client,cloneV1(scope));ports();const value=cloneV1(raw),now=await clock();
    if(!recordV1(value,['scope','subject','registrationRef','preparationRef','publicKeySpki','checkedAt','expiresAt'])||!same(value.scope,scope)||!refV1(value.registrationRef)||!refV1(value.preparationRef)||typeof value.publicKeySpki!=='string'||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>now||now-Date.parse(value.checkedAt)>1000||Date.parse(value.expiresAt)<=now)return fail();
    if(session){
     if(session.access.installationId!==scope.installationId||session.access.authenticateInTransaction!==authenticate||!identity?.authSession||!recordV1(value.subject,['userId','clientId','humanSessionId','controlGeneration','credentialGeneration'])||identity.actorId!==value.subject.userId||identity.clientId!==value.subject.clientId||identity.authSession.id!==value.subject.humanSessionId||identity.credentialGeneration!==value.subject.credentialGeneration||!(identity.reauthUntil instanceof Date)||!Number.isFinite(identity.reauthUntil.getTime()))return fail();
     const sessionEnd=Math.min(Date.parse(identity.authSession.idleExpiresAt),Date.parse(identity.authSession.absoluteExpiresAt),identity.reauthUntil.getTime());
     if(!Number.isFinite(sessionEnd)||sessionEnd<=now)return fail();end=Math.min(end,sessionEnd);
    }
    end=Math.min(end,Date.parse(value.expiresAt));return value;
   };
   const first=await current();
   if(!(await query('SELECT id FROM anvil.projects WHERE id=$1 FOR UPDATE',[scope.projectId])).rows[0])return fail();
   const args=[scope.projectId,scope.executionId,scope.executionGeneration];
   const selectEvent='SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5';
   const requestRow=(await query(selectEvent,[...args,i.requestRef.id,i.requestRef.version])).rows[0],requestEvent=eventRow(requestRow,scope),request=ownershipRequestFromEventV1(requestEvent);
   if(!same(requestEvent.ref,i.requestRef)||!same(request.requestRef,i.requestRef)||!same(first.preparationRef,request.preparationRef)||!same(first.registrationRef,request.registrationRef))return fail();
   const tail=eventRow((await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1',args)).rows[0],scope);
   if(!same(tail.ref,i.expectedTailRef)||!same(tail.ref,requestEvent.ref))return fail();
   const prep=eventRow((await query(selectEvent,[...args,request.preparationRef.id,request.preparationRef.version])).rows[0],scope);
   if(prep.snapshot.kind!=='PREPARATION_GRANTED'||!same(prep.ref,request.preparationRef)||!same(prep.snapshot.subject,first.subject)||!same(requestEvent.snapshot.subject,first.subject)||!same(prep.snapshot.registrationRef,first.registrationRef)||!same(requestEvent.snapshot.registrationRef,first.registrationRef)||publicKeyFingerprint(first.publicKeySpki)!==prep.snapshot.payload.publicKeyFingerprint||request.publicKeyFingerprint!==prep.snapshot.payload.publicKeyFingerprint)return fail();
   const slot=eventRow((await query("SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND kind='PREPARATION_GRANTED' ORDER BY project_sequence DESC LIMIT 1",[scope.projectId])).rows[0],scope);
   if(!same(slot.ref,prep.ref))return fail();end=Math.min(end,Date.parse(prep.snapshot.expiresAt));
   const previous=eventRow((await query(selectEvent,[...args,requestEvent.snapshot.previousRef!.id,requestEvent.snapshot.previousRef!.version])).rows[0],scope);
   checkOwnershipEventAppendV1(previous,requestEvent,await clock());
   const headRow=(await query('SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',args)).rows[0];
   const head=headRow?readOwnershipHeadV1({ref:{id:headRow.id,version:Number(headRow.head_generation),contentHash:headRow.content_hash},snapshot:headRow.snapshot_json}):null;
   if(!same(head?.ref??null,i.expectedHeadRef)||!same(request.expectedHeadRef,i.expectedHeadRef)||head&&(!same(head.snapshot.scope,scope)||head.snapshot.state!=='ACTIVE'||!same(head.snapshot.anchorRef,request.anchorRef)))return fail();
   if((request.phase==='BOOTSTRAP_PREPARED')!==(head===null)||(request.phase==='BOOTSTRAP_PREPARED')!==(i.adoptionEventId!==null))return fail();if(head)end=Math.min(end,Date.parse(head.snapshot.expiresAt));
   if((await query('SELECT request_id FROM anvil.execution_ownership_observations WHERE project_id=$1 AND request_id=$2',[scope.projectId,i.requestRef.id])).rows.length)return fail();
   let anchor:any;
   if(head){const r=(await query('SELECT * FROM anvil.execution_ownership_anchors WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND anchor_id=$4 AND version=$5',[...args,request.anchorRef.id,request.anchorRef.version])).rows[0];if(!r||!same(r.preparation_event_ref,prep.ref))return fail();anchor={ref:{id:r.anchor_id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json};}
   else anchor=cloneV1(requestRow.candidate_anchor_json);
   if(!recordV1(anchor,['ref','snapshot'])||!same(anchor.ref,request.anchorRef)||!recordV1(anchor.snapshot,['schemaVersion','purpose','transport','scope','processRef','observerRef','recordedAt','expiresAt','state','fileSandboxVerified','executionAuthorized','dispatchPerformed'])||hash(anchor.snapshot)!==anchor.ref.contentHash)return fail();
   const a=anchor.snapshot;
   if(a.schemaVersion!==1||a.purpose!=='PROCESS_OWNERSHIP_ANCHOR'||a.transport!=='SYNTHETIC_ONLY'||a.state!=='BOUND'||a.fileSandboxVerified!==false||a.executionAuthorized!==false||a.dispatchPerformed!==false||!recordV1(a.scope,['projectId','executionId','executionGeneration','sessionBindingRef','roleBindingRef','executorRegistrationRef'])||a.scope.projectId!==scope.projectId||a.scope.executionId!==scope.executionId||a.scope.executionGeneration!==scope.executionGeneration||!refV1(a.scope.sessionBindingRef)||!refV1(a.scope.roleBindingRef)||!same(a.scope.executorRegistrationRef,request.registrationRef)||!same(a.processRef,requestEvent.snapshot.payload.processRef)||!same(a.observerRef,request.observerRef)||!isoV1(a.recordedAt)||!isoV1(a.expiresAt)||Date.parse(a.recordedAt)<Date.parse(prep.snapshot.at)||Date.parse(a.recordedAt)>Date.parse(request.requestedAt)||Date.parse(a.expiresAt)>Date.parse(prep.snapshot.expiresAt))return fail();
   end=Math.min(end,Date.parse(a.expiresAt));
   const now=await clock(),proof=verifyOwnershipObservationProofV1(first.publicKeySpki,i.signature,report,request,i.facts,a.processRef,now);
   const observationSnapshot={schemaVersion:1,purpose:'OWNERSHIP_OBSERVATION_RECORD',report:proof.report,signature:i.signature,facts:proof.facts},observationRef={id:i.observationId,version:1,contentHash:hash(observationSnapshot)};
   const event=(id:string,kind:OwnershipEventV1['snapshot']['kind'],payload:Record<string,unknown>,previousEvent:OwnershipEventV1):OwnershipEventV1=>{
    const snapshot={...cloneV1(requestEvent.snapshot),sequence:previousEvent.snapshot.sequence+1,previousRef:previousEvent.ref,kind,payload,at:new Date(now).toISOString(),expiresAt:new Date(end).toISOString()};
    return checkOwnershipEventAppendV1(previousEvent,{ref:{id,version:1,contentHash:hash(snapshot)},snapshot},now);
   };
   const accepted=event(i.acceptedEventId,'OBSERVATION_ACCEPTED',{requestRef:requestEvent.ref,observationRef,phase:request.phase,expectedHeadRef:head?.ref??null,anchorRef:anchor.ref,preparationRef:prep.ref},requestEvent);
   const adopted=i.adoptionEventId?event(i.adoptionEventId,'ANCHOR_ADOPTED',{anchorRef:anchor.ref,preparationRef:prep.ref,observationEventRef:accepted.ref,expectedHeadRef:null},accepted):null;
   const nextHead=advanceOwnershipHeadV1(head,adopted??accepted,i.headId,now);
   let projectSequence=Number((await query('SELECT COALESCE(MAX(project_sequence),0) AS value FROM anvil.execution_ownership_events WHERE project_id=$1',[scope.projectId])).rows[0]?.value);
   if(!Number.isSafeInteger(projectSequence)||projectSequence<1||!Number.isSafeInteger(projectSequence+2))return fail();
   await query('INSERT INTO anvil.execution_ownership_observations(project_id,execution_id,execution_generation,observation_id,request_id,content_hash,snapshot_json,accepted_event_ref,nonce_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...args,observationRef.id,requestEvent.ref.id,observationRef.contentHash,canonicalJson(observationSnapshot),canonicalJson(accepted.ref),contentHash(Buffer.from(request.nonce,'base64url'))]);
   for(const e of [accepted,...(adopted?[adopted]:[])])await query('INSERT INTO anvil.execution_ownership_events(project_id,execution_id,execution_generation,event_id,sequence,project_sequence,content_hash,snapshot_json,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...args,e.ref.id,e.snapshot.sequence,++projectSequence,e.ref.contentHash,canonicalJson(e.snapshot),e.snapshot.kind==='OBSERVATION_ACCEPTED'?requestEvent.ref.id:null]);
   if(adopted)await query('INSERT INTO anvil.execution_ownership_anchors(project_id,execution_id,execution_generation,anchor_id,content_hash,snapshot_json,preparation_event_ref,adoption_event_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[...args,anchor.ref.id,anchor.ref.contentHash,canonicalJson(anchor.snapshot),canonicalJson(prep.ref),canonicalJson(adopted.ref)]);
   const changed=head?await query('UPDATE anvil.execution_ownership_heads SET head_generation=$6,content_hash=$7,snapshot_json=$8 WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND content_hash=$4 AND head_generation=$5',[...args,head.ref.contentHash,head.ref.version,nextHead.ref.version,nextHead.ref.contentHash,canonicalJson(nextHead.snapshot)]):await query('INSERT INTO anvil.execution_ownership_heads(project_id,execution_id,execution_generation,id,head_generation,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7)',[...args,nextHead.ref.id,nextHead.ref.version,nextHead.ref.contentHash,canonicalJson(nextHead.snapshot)]);
   if(changed.rowCount!==1)return fail();
   const last=await current();if(!same(last.scope,first.scope)||!same(last.subject,first.subject)||!same(last.registrationRef,first.registrationRef)||!same(last.preparationRef,first.preparationRef)||last.publicKeySpki!==first.publicKeySpki)return fail();await clock();

 return{purpose:'SYNTHETIC_OWNERSHIP_ACCEPTANCE_STAGED_ONLY' as const,observationRef,head:nextHead,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}

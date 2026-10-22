import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {advanceOwnershipHeadV1,checkOwnershipEventAppendV1,ownershipRequestFromEventV1,readOwnershipEventV1,readOwnershipHeadV1,type OwnershipHeadV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {verifyOwnershipObservationProofV1} from './ownership-observation-proof.ts';

/** 미등록 합성 연결 계약. 같은 client의 열린 transaction을 사용하며 자체 BEGIN/COMMIT을 하지 않는다.
 * 실제 새 관측/발행/수용 producer는 아직 없다. 실제 OS/helper/Agent 포트로 사용하지 않는다. */
export interface SyntheticOwnershipFreshObservation {
 transport:'SYNTHETIC_ONLY';observeAndAccept(db:Pick<PoolClient,'query'>,window:unknown,signal:AbortSignal):Promise<unknown>;
}
const fail=():never=>{throw new AuthFailure('OWNERSHIP_CURRENT_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function rowEvent(row:any,scope:any){
 if(!row||row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.execution_generation)!==scope.executionGeneration||!Number.isSafeInteger(Number(row.project_sequence))||Number(row.project_sequence)<1)return fail();
 const e=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json});
 if(!same(e.snapshot.scope,scope)||e.snapshot.sequence!==Number(row.sequence))return fail();return e;
}
function record(value:any,keys:string[]){if(!recordV1(value,['ref','snapshot'])||!refV1(value.ref)||value.ref.version!==1||!recordV1(value.snapshot,keys)||hash(value.snapshot)!==value.ref.contentHash)return fail();return value;}
/** 읽은 새 원기록의 합성 BASIS_ONLY다. readCurrent라는 이름만으로 기존 7필드 archive 포트나
 * osFence VERIFIED_CURRENT에 자동 연결하지 않는다. 실제 writer/출처/OS 권위는 미확인이다. */
export class SyntheticPgOwnershipCurrentResolver {
 #pool:Pick<Pool,'connect'>;#access:AccessRepository;#token:string;#csrf:string;#fresh:SyntheticOwnershipFreshObservation|null;#timeout:number;
 constructor(pool:Pick<Pool,'connect'>,access:AccessRepository,token:string,csrf:string,fresh:SyntheticOwnershipFreshObservation|null=null,options:{timeoutMs:number}={timeoutMs:10000}){this.#pool=pool;this.#access=access;this.#token=token;this.#csrf=csrf;this.#fresh=fresh;this.#timeout=options.timeoutMs;if(!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)return fail();}
 async readCurrent(scopeValue:unknown,inputValue:unknown,signal:AbortSignal){
  let db:PoolClient|undefined,begun=false,commitAttempted=false,discard=false;
  try{
   const port=this.#fresh,observe=port?.observeAndAccept,authenticate=this.#access.authenticateInTransaction,installation=this.#access.installationId;
   if(!port||port.transport!=='SYNTHETIC_ONLY'||typeof observe!=='function'||!(signal instanceof AbortSignal)||signal.aborted)return fail();
   const stable=()=>{if(signal.aborted||this.#fresh!==port||port.transport!=='SYNTHETIC_ONLY'||port.observeAndAccept!==observe||this.#access.authenticateInTransaction!==authenticate||this.#access.installationId!==installation)return fail();};
   const scope=cloneV1(scopeValue),input=cloneV1(inputValue);
   if(!recordV1(scope,['installationId','projectId','executionId','executionGeneration'])||!['installationId','projectId','executionId'].every(k=>uuidV1(scope[k]))||!Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1||scope.installationId!==this.#access.installationId||!recordV1(input,['preparationRef','selection'])||!refV1(input.preparationRef))return fail();
   const s=input.selection;
   if(!recordV1(s,['envelope','parentThreadClaimRef','attemptRef','permitRef','ownershipEvidenceRef','instructionContentHash','preSendBindingHash'])||!['parentThreadClaimRef','attemptRef','permitRef','ownershipEvidenceRef'].every(k=>refV1(s[k]))||!hashV1(s.instructionContentHash)||!hashV1(s.preSendBindingHash))return fail();
   db=await this.#pool.connect();stable();const query=async(sql:string,args:any[]=[])=>{stable();const r=await db!.query(sql,args);stable();return r;};
   begun=true;await query('BEGIN');await query("SET LOCAL statement_timeout='10000ms'");await query("SET LOCAL lock_timeout='2000ms'");
   const basis=async()=>{stable();const v=await readOwnershipPreparationReceiptBasis(db!,this.#access,this.#token,this.#csrf,scope,input.preparationRef);stable();return v;};
   const first=await basis();
   let lastClock=Date.parse(first.checkedAt);
   const clock=async()=>{const at=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime())||at.getTime()<lastClock)return fail();lastClock=at.getTime();return lastClock;};
   const started=await clock(),envelope=readDispatchEnvelopeV1(s.envelope,started);
   if(envelope.operation!=='SEND_INSTRUCTION'||envelope.context.projectId!==scope.projectId||envelope.context.executionId!==scope.executionId||envelope.context.executionGeneration!==scope.executionGeneration||!same(envelope.executorRegistrationRef,first.registrationRef))return fail();
   const window={purpose:'SYNTHETIC_OWNERSHIP_READ_WINDOW',readId:randomUUID(),scope:cloneV1(scope),preparationRef:cloneV1(input.preparationRef),selection:cloneV1(s),selectionHash:hash(s),notBefore:new Date(started).toISOString(),expiresAt:new Date(Math.min(started+this.#timeout,Date.parse(first.expiresAt),Date.parse(envelope.expiresAt))).toISOString(),executionAuthorized:false,dispatchPerformed:false};
   if(Date.parse(window.expiresAt)<=started)return fail();
   let open=true,pending=0,timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};const controller=new AbortController();
   const facade={query:async(sql:string,args:any[]=[])=>{if(!open||controller.signal.aborted||typeof sql!=='string'||!/^\s*(SELECT|INSERT|UPDATE)\b/i.test(sql)||/[;\x00]/.test(sql))return fail();pending++;try{return await query(sql,args);}finally{pending--;}}} as Pick<PoolClient,'query'>;
   let rawFresh:unknown;
   try{
    const stopped=new Promise<never>((_,reject)=>{abort=()=>{open=false;discard=true;controller.abort();reject(new AuthFailure('OWNERSHIP_CURRENT_UNAVAILABLE',412));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,Math.max(1,Date.parse(window.expiresAt)-started));});
    stable();rawFresh=await Promise.race([Promise.resolve().then(()=>observe.call(port,facade,cloneV1(window),controller.signal)),stopped]);
    if(pending){discard=true;return fail();}
   }finally{if(pending)discard=true;open=false;controller.abort();if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);}
   const fresh=cloneV1(rawFresh);stable();
   if(!recordV1(fresh,['purpose','readId','requestRef','observationRef','executionAuthorized','dispatchPerformed'])||fresh.purpose!=='SYNTHETIC_NEW_OBSERVATION'||fresh.readId!==window.readId||!refV1(fresh.requestRef)||!refV1(fresh.observationRef)||fresh.executionAuthorized!==false||fresh.dispatchPerformed!==false)return fail();
   const args=[scope.projectId,scope.executionId,scope.executionGeneration];
   const rows=(await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence ASC LIMIT 201',args)).rows;
   if(!rows.length||rows.length>200)return fail();const events=rows.map(row=>rowEvent(row,scope)),prep=events[0]!;
   if(!same(prep.ref,input.preparationRef))return fail();
   const h=(await query('SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',args)).rows[0];if(!h)return fail();
   const head=readOwnershipHeadV1({ref:{id:h.id,version:Number(h.head_generation),contentHash:h.content_hash},snapshot:h.snapshot_json});
   if(!same(head.snapshot.scope,scope)||head.snapshot.state!=='ACTIVE'||!same(head.snapshot.anchorRef,s.ownershipEvidenceRef))return fail();
   let reconstructed:OwnershipHeadV1|null=null;
   for(let n=0;n<events.length;n++){
    const e=events[n]!,at=Date.parse(e.snapshot.at);checkOwnershipEventAppendV1(n?events[n-1]:null,e,at);
    if(n&&Number(rows[n]!.project_sequence)<=Number(rows[n-1]!.project_sequence))return fail();
    if(['REVOKED','EXPIRED','UNKNOWN'].includes(e.snapshot.kind))return fail();
    if(e.snapshot.kind==='OBSERVATION_REQUESTED'){const q=ownershipRequestFromEventV1(e);if(!same(q.expectedHeadRef,reconstructed?.ref??null)||!same(q.preparationRef,prep.ref)||!same(q.anchorRef,s.ownershipEvidenceRef))return fail();}
    if(e.snapshot.kind==='ANCHOR_ADOPTED'||e.snapshot.kind==='BINDING_RECORDED'||e.snapshot.kind==='OBSERVATION_ACCEPTED'&&e.snapshot.payload.phase==='CURRENT')reconstructed=advanceOwnershipHeadV1(reconstructed,e,head.ref.id,at);
   }
   if(!same(reconstructed,head))return fail();
   const accepted=events.at(-1)!,a=accepted.snapshot.payload;
   if(accepted.snapshot.kind!=='OBSERVATION_ACCEPTED'||a.phase!=='CURRENT'||!same(accepted.ref,head.snapshot.currentEventRef)||!same(a.requestRef,fresh.requestRef)||!same(a.observationRef,fresh.observationRef)||!same(a.preparationRef,prep.ref))return fail();
   const requested=events.at(-2)!,request=ownershipRequestFromEventV1(requested);
   if(request.phase!=='CURRENT'||Date.parse(request.requestedAt)<=started||Date.parse(request.expiresAt)>Date.parse(window.expiresAt)||!same(request.requestRef,fresh.requestRef)||!same(request.registrationRef,first.registrationRef)||!same(requested.snapshot.subject,first.subject))return fail();
   const ar=(await query('SELECT * FROM anvil.execution_ownership_anchors WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND anchor_id=$4 AND version=$5',[...args,s.ownershipEvidenceRef.id,s.ownershipEvidenceRef.version])).rows[0];
   if(!ar||!same(ar.preparation_event_ref,prep.ref))return fail();
   const anchor=record({ref:{id:ar.anchor_id,version:Number(ar.version),contentHash:ar.content_hash},snapshot:ar.snapshot_json},['schemaVersion','purpose','transport','scope','processRef','observerRef','recordedAt','expiresAt','state','fileSandboxVerified','executionAuthorized','dispatchPerformed']),as=anchor.snapshot;
   const fullScope={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,sessionBindingRef:envelope.payload.sessionBindingRef,roleBindingRef:as.scope?.roleBindingRef,executorRegistrationRef:first.registrationRef};
   if(!same(anchor.ref,s.ownershipEvidenceRef)||as.schemaVersion!==1||as.purpose!=='PROCESS_OWNERSHIP_ANCHOR'||as.transport!=='SYNTHETIC_ONLY'||as.state!=='BOUND'||as.fileSandboxVerified!==false||as.executionAuthorized!==false||as.dispatchPerformed!==false||!refV1(fullScope.roleBindingRef)||!same(as.scope,fullScope)||!same(as.processRef,requested.snapshot.payload.processRef)||!same(as.observerRef,request.observerRef)||!isoV1(as.recordedAt)||!isoV1(as.expiresAt)||as.processRef.runId!==prep.snapshot.payload.runId||as.processRef.generation!==prep.snapshot.payload.processGeneration||as.processRef.executableHash!==prep.snapshot.payload.workerHash)return fail();
   const adopted=events.find(e=>same(e.ref,ar.adoption_event_ref));if(!adopted||adopted.snapshot.kind!=='ANCHOR_ADOPTED'||!same(adopted.snapshot.payload.anchorRef,anchor.ref))return fail();
   const bs=(await query('SELECT * FROM anvil.execution_ownership_bindings WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND command_id=$4 AND attempt_id=$5 AND permit_id=$6',[...args,envelope.commandId,s.attemptRef.id,s.permitRef.id])).rows;if(bs.length!==1)return fail();const b=bs[0];
   const binding=record({ref:{id:b.binding_id,version:Number(b.version),contentHash:b.content_hash},snapshot:b.snapshot_json},['schemaVersion','purpose','transport','ownershipEvidenceRef','scope','commandId','envelopeHash','parentThreadClaimRef','attemptRef','permitRef','instructionContentHash','preSendBindingHash','recordedAt','expiresAt']),t=binding.snapshot;
   const bindingEvent=events.find(e=>same(e.ref,b.binding_event_ref));
   if(!bindingEvent||bindingEvent.snapshot.kind!=='BINDING_RECORDED'||!same(bindingEvent.snapshot.payload.bindingRef,binding.ref)||!same(bindingEvent.snapshot.payload.anchorRef,anchor.ref)||!same(b.anchor_ref,anchor.ref)||!same(b.attempt_ref,s.attemptRef)||!same(b.permit_ref,s.permitRef)||b.command_id!==envelope.commandId||t.schemaVersion!==1||t.purpose!=='SENT_PROCESS_BINDING'||t.transport!=='SYNTHETIC_ONLY'||!same(t.scope,fullScope)||!same(t.ownershipEvidenceRef,anchor.ref)||t.commandId!==envelope.commandId||t.envelopeHash!==envelope.envelopeHash||!same(t.parentThreadClaimRef,s.parentThreadClaimRef)||!same(t.attemptRef,s.attemptRef)||!same(t.permitRef,s.permitRef)||t.instructionContentHash!==s.instructionContentHash||t.preSendBindingHash!==s.preSendBindingHash||!isoV1(t.recordedAt)||!isoV1(t.expiresAt)||Date.parse(t.recordedAt)<Date.parse(as.recordedAt))return fail();
   const o=(await query('SELECT * FROM anvil.execution_ownership_observations WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND observation_id=$4 AND version=$5',[...args,fresh.observationRef.id,fresh.observationRef.version])).rows[0];
   if(!o||!same({id:o.observation_id,version:Number(o.version),contentHash:o.content_hash},fresh.observationRef)||hash(o.snapshot_json)!==fresh.observationRef.contentHash||!recordV1(o.snapshot_json,['schemaVersion','purpose','report','signature','facts'])||o.snapshot_json.schemaVersion!==1||o.snapshot_json.purpose!=='OWNERSHIP_OBSERVATION_RECORD'||!same(o.accepted_event_ref,accepted.ref)||o.request_id!==request.requestRef.id||o.nonce_digest!==contentHash(Buffer.from(request.nonce,'base64url')))return fail();
   const proof=verifyOwnershipObservationProofV1(first.publicKeySpki,o.snapshot_json.signature,o.snapshot_json.report,request,o.snapshot_json.facts,as.processRef,await clock());
   if(Date.parse(proof.report.observedAt)<=started||Date.parse(accepted.snapshot.at)<Date.parse(proof.report.observedAt))return fail();
   const slot=rowEvent((await query("SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND kind='PREPARATION_GRANTED' ORDER BY project_sequence DESC LIMIT 1",[scope.projectId])).rows[0],scope);if(!same(slot.ref,prep.ref))return fail();
   const last=await basis();for(const k of ['scope','subject','preparationRef','policyRef','registrationRef','publicKeySpki','commandRef','authorizationReceiptRef','auditRef'] as const)if(!same(first[k],last[k]))return fail();
   const end=Math.min(Date.parse(window.expiresAt),Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(head.snapshot.expiresAt),Date.parse(as.expiresAt),Date.parse(t.expiresAt),Date.parse(request.expiresAt));
   const mark=performance.now(),readAt=await clock();if(readAt>=end||Date.parse(as.recordedAt)>readAt||Date.parse(t.recordedAt)>readAt)return fail();
   commitAttempted=true;await query('COMMIT');begun=false;if(readAt+Math.ceil(performance.now()-mark)>=end){discard=true;throw Error();}
   return{purpose:'SYNTHETIC_OWNERSHIP_CURRENT_BASIS_ONLY' as const,transport:'SYNTHETIC_ONLY' as const,archive:{anchor:cloneV1(anchor),binding:cloneV1(binding),anchorHeadRef:cloneV1(anchor.ref),bindingHeadRef:cloneV1(binding.ref),revoked:false,readAt:new Date(readAt).toISOString(),expiresAt:new Date(end).toISOString()},requestRef:cloneV1(request.requestRef),observationRef:cloneV1(fresh.observationRef),headRef:cloneV1(head.ref),missingEvidence:['ACTUAL_CURRENT_AUTHORITY_PROVIDER','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE','SOURCE_WRITE_SANDBOX'] as const,currentAuthorityVerified:false as const,writerReleaseVerified:false as const,fileSandboxVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch{
   if(commitAttempted){discard=true;throw new AuthFailure('OWNERSHIP_CURRENT_COMMIT_UNKNOWN',412);}
   if(db&&begun&&!discard)try{await db.query('ROLLBACK');}catch{discard=true;throw new AuthFailure('OWNERSHIP_CURRENT_ROLLBACK_UNCONFIRMED',412);}return fail();
  }finally{if(db)try{db.release(discard);}catch{throw new AuthFailure(commitAttempted?'OWNERSHIP_CURRENT_COMMIT_UNKNOWN':'OWNERSHIP_CURRENT_RELEASE_UNCONFIRMED',412);}}
 }
}

import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipEventV1,readOwnershipHeadV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import type {SyntheticOwnershipFreshObservation} from './ownership-current-resolver.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {readSyntheticStagedPreparationInputs,stageSyntheticOwnershipRequest,stageSyntheticOwnershipAcceptance,type SyntheticStagedPreparationEvidence} from './ownership-observation-staged.ts';

export interface SyntheticOwnershipObserver {transport:'SYNTHETIC_ONLY';observe(request:unknown,processRef:unknown,signal:AbortSignal):Promise<unknown>}
const fail=():never=>{throw new AuthFailure('OWNERSHIP_FRESH_PRODUCER_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
/** 내부 합성 producer만 연결한다. observer/evidence 기본 부재이며 실제 OS·키·Agent 호출을 등록하지 않는다.
 * 같은 caller-owned query facade만 사용한다. 성공은 STAGED이며 외부 resolver의 검증/COMMIT 전 확정이 아니다. */
export class SyntheticOwnershipFreshProducer implements SyntheticOwnershipFreshObservation {
 readonly transport='SYNTHETIC_ONLY' as const;
 #access:AccessRepository;#token:string;#csrf:string;#inputs:SyntheticStagedPreparationEvidence|null;#observer:SyntheticOwnershipObserver|null;
 constructor(access:AccessRepository,token:string,csrf:string,inputs:SyntheticStagedPreparationEvidence|null=null,observer:SyntheticOwnershipObserver|null=null){this.#access=access;this.#token=token;this.#csrf=csrf;this.#inputs=inputs;this.#observer=observer;}
 async observeAndAccept(db:Pick<PoolClient,'query'>,windowValue:unknown,signal:AbortSignal){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
  try{
   const inputs=this.#inputs,current=inputs?.current,observer=this.#observer,observe=observer?.observe,access=this.#access,authenticate=access.authenticateInTransaction;
   if(!inputs||!observer||inputs.transport!=='SYNTHETIC_ONLY'||observer.transport!=='SYNTHETIC_ONLY'||typeof current!=='function'||typeof observe!=='function'||!(signal instanceof AbortSignal)||signal.aborted)return fail();
   const stable=()=>{if(signal.aborted||controller.signal.aborted||this.#inputs!==inputs||this.#observer!==observer||inputs.transport!=='SYNTHETIC_ONLY'||observer.transport!=='SYNTHETIC_ONLY'||inputs.current!==current||observer.observe!==observe||this.#access!==access||access.authenticateInTransaction!==authenticate)return fail();};
   const w=cloneV1(windowValue);
   if(!recordV1(w,['purpose','readId','scope','preparationRef','selection','selectionHash','notBefore','expiresAt','executionAuthorized','dispatchPerformed'])||w.purpose!=='SYNTHETIC_OWNERSHIP_READ_WINDOW'||!uuidV1(w.readId)||!refV1(w.preparationRef)||!isoV1(w.notBefore)||!isoV1(w.expiresAt)||w.selectionHash!==hash(w.selection)||w.executionAuthorized!==false||w.dispatchPerformed!==false||!recordV1(w.scope,['installationId','projectId','executionId','executionGeneration'])||w.scope.installationId!==access.installationId)return fail();
   const ttl=Date.parse(w.expiresAt)-Date.parse(w.notBefore);if(ttl<=0||ttl>10000)return fail();
   const stopped=new Promise<never>((_,reject)=>{abort=()=>{controller.abort();reject(new AuthFailure('OWNERSHIP_FRESH_PRODUCER_UNAVAILABLE',412));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,ttl);});
   const query=async(sql:string,args:any[]=[])=>{stable();const r=await db.query(sql,args);stable();return r;};
   const tx={query} as Pick<PoolClient,'query'>;
   const work=async()=>{
    stable();let lastClock=Date.parse(w.notBefore);
    const clock=async()=>{const at=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime())||at.getTime()<lastClock||at.getTime()>=Date.parse(w.expiresAt))return fail();lastClock=at.getTime();return lastClock;};
    const first=await readOwnershipPreparationReceiptBasis(tx as PoolClient,access,this.#token,this.#csrf,w.scope,w.preparationRef);stable();
    const s=w.selection;if(!recordV1(s,['envelope','parentThreadClaimRef','attemptRef','permitRef','ownershipEvidenceRef','instructionContentHash','preSendBindingHash'])||!refV1(s.ownershipEvidenceRef))return fail();
    const e=readDispatchEnvelopeV1(s.envelope,await clock());if(e.operation!=='SEND_INSTRUCTION'||e.context.projectId!==w.scope.projectId||e.context.executionId!==w.scope.executionId||e.context.executionGeneration!==w.scope.executionGeneration)return fail();
    const args=[w.scope.projectId,w.scope.executionId,w.scope.executionGeneration];
    const h=(await query('SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',args)).rows[0];if(!h)return fail();
    const head=readOwnershipHeadV1({ref:{id:h.id,version:Number(h.head_generation),contentHash:h.content_hash},snapshot:h.snapshot_json});
    if(head.snapshot.state!=='ACTIVE'||!same(head.snapshot.scope,w.scope)||!same(head.snapshot.anchorRef,s.ownershipEvidenceRef))return fail();
    const t=(await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1',args)).rows[0];if(!t)return fail();
    const tail=readOwnershipEventV1({ref:{id:t.event_id,version:Number(t.version),contentHash:t.content_hash},snapshot:t.snapshot_json});if(!same(tail.ref,head.snapshot.currentEventRef)||!same(tail.snapshot.scope,w.scope))return fail();
    // 별도 관측을 요청하기 전에 원 SEND 사건의 선택을 검사한다. 사후 resolver 거절로 대신하지 않는다.
    const bindings=(await query('SELECT * FROM anvil.execution_ownership_bindings WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND command_id=$4 AND attempt_id=$5 AND permit_id=$6',[...args,e.commandId,s.attemptRef?.id,s.permitRef?.id])).rows;
    if(bindings.length!==1)return fail();const b=bindings[0],br={id:b.binding_id,version:Number(b.version),contentHash:b.content_hash},bs=b.snapshot_json;
    if(!refV1(br)||br.version!==1||hash(bs)!==br.contentHash||!recordV1(bs,['schemaVersion','purpose','transport','ownershipEvidenceRef','scope','commandId','envelopeHash','parentThreadClaimRef','attemptRef','permitRef','instructionContentHash','preSendBindingHash','recordedAt','expiresAt'])||bs.schemaVersion!==1||bs.purpose!=='SENT_PROCESS_BINDING'||bs.transport!=='SYNTHETIC_ONLY'||!recordV1(bs.scope,['projectId','executionId','executionGeneration','sessionBindingRef','roleBindingRef','executorRegistrationRef'])||bs.scope.projectId!==w.scope.projectId||bs.scope.executionId!==w.scope.executionId||bs.scope.executionGeneration!==w.scope.executionGeneration||!same(bs.scope.sessionBindingRef,e.payload.sessionBindingRef)||!refV1(bs.scope.roleBindingRef)||!same(bs.scope.executorRegistrationRef,e.executorRegistrationRef)||!same(bs.ownershipEvidenceRef,head.snapshot.anchorRef)||bs.commandId!==e.commandId||bs.envelopeHash!==e.envelopeHash||!same(bs.parentThreadClaimRef,s.parentThreadClaimRef)||!same(bs.attemptRef,s.attemptRef)||!same(bs.permitRef,s.permitRef)||bs.instructionContentHash!==s.instructionContentHash||bs.preSendBindingHash!==s.preSendBindingHash||!isoV1(bs.recordedAt)||!isoV1(bs.expiresAt)||!same(b.anchor_ref,head.snapshot.anchorRef)||!same(b.attempt_ref,s.attemptRef)||!same(b.permit_ref,s.permitRef)||b.command_id!==e.commandId||!refV1(b.binding_event_ref))return fail();
    const boundRow=(await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[...args,b.binding_event_ref.id,b.binding_event_ref.version])).rows[0];if(!boundRow)return fail();
    const bound=readOwnershipEventV1({ref:{id:boundRow.event_id,version:Number(boundRow.version),contentHash:boundRow.content_hash},snapshot:boundRow.snapshot_json});
    if(!same(bound.ref,b.binding_event_ref)||bound.snapshot.kind!=='BINDING_RECORDED'||!same(bound.snapshot.scope,w.scope)||!same(bound.snapshot.subject,first.subject)||!same(bound.snapshot.payload.bindingRef,br)||!same(bound.snapshot.payload.anchorRef,head.snapshot.anchorRef)||Date.parse(bs.recordedAt)>await clock()||Date.parse(bs.expiresAt)<=await clock())return fail();
    const staged=await stageSyntheticOwnershipRequest(tx,access,this.#token,this.#csrf,w.scope,{preparationRef:w.preparationRef,expectedTailRef:tail.ref,expectedHeadRef:head.ref},inputs,w.expiresAt,controller.signal);stable();
    const request=staged.request;if(request.phase!=='CURRENT'||Date.parse(request.requestedAt)<=Date.parse(w.notBefore)||Date.parse(request.expiresAt)>Date.parse(w.expiresAt)||!same(request.expectedHeadRef,head.ref))return fail();
    await clock();const reply=cloneV1(await observe.call(observer,cloneV1(request),cloneV1(staged.event.snapshot.payload.processRef),controller.signal));stable();await clock();
    if(!recordV1(reply,['report','facts','signature'])||typeof reply.signature!=='string')return fail();
    const preparedRaw=await current.call(inputs,tx,w.scope,w.preparationRef);stable();
    const prepRow=(await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[...args,w.preparationRef.id,w.preparationRef.version])).rows[0];if(!prepRow)return fail();
    const prep=readOwnershipEventV1({ref:{id:prepRow.event_id,version:Number(prepRow.version),contentHash:prepRow.content_hash},snapshot:prepRow.snapshot_json});
    const prepared=readSyntheticStagedPreparationInputs(preparedRaw,w.scope,prep,await clock());if(!same(prepared.writer,staged.preparedInputs.writer)||!same(prepared.candidate,staged.preparedInputs.candidate)||Date.parse(prepared.expiresAt)<Date.parse(request.expiresAt))return fail();
    const accepted=await stageSyntheticOwnershipAcceptance(tx,access,this.#token,this.#csrf,w.preparationRef,w.scope,{requestRef:request.requestRef,expectedTailRef:request.requestRef,expectedHeadRef:head.ref,report:reply.report,facts:reply.facts,signature:reply.signature,observationId:randomUUID(),acceptedEventId:randomUUID(),adoptionEventId:null,headId:head.ref.id},controller.signal);stable();await clock();
    if(accepted.purpose!=='SYNTHETIC_OWNERSHIP_ACCEPTANCE_STAGED_ONLY'||accepted.head.snapshot.state!=='ACTIVE'||accepted.head.ref.id!==head.ref.id||accepted.head.ref.version!==head.ref.version+1)return fail();
    return{purpose:'SYNTHETIC_NEW_OBSERVATION' as const,readId:w.readId,requestRef:cloneV1(request.requestRef),observationRef:cloneV1(accepted.observationRef),executionAuthorized:false as const,dispatchPerformed:false as const};
   };
   return await Promise.race([work(),stopped]);
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);signal instanceof AbortSignal&&signal.removeEventListener('abort',abort);}
 }
}

import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {executionFactChecks,readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {executionTarget} from './execution-proof.ts';
type Scope={mode:'EXECUTION';projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:RuntimeRefV1;credentialGeneration:number};
type Request={envelopeHash:string;localAttemptRef:RuntimeRefV1;sourceObservationRefs:RuntimeRefV1[];osOwnershipRef:RuntimeRefV1};
type Permit={ref:RuntimeRefV1;snapshot:{scope:Scope;commandId:string;commandRef:RuntimeRefV1;request:Request;requestHash:string;proofRef:RuntimeRefV1;bindingHash:string;currentFact:ReturnType<typeof readServerExecutionFactV1>;state:'SYNTHETIC_CONSUMED_NO_AUTHORITY';issuedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false}};
export interface SyntheticPermitTransaction{
 clock():Promise<string>;
 /** 내부 current resolver만 공급한다. HTTP 입력/등록 지문만을 현재 fact·proof로 채택하지 않는다. */
 current(commandId:string):Promise<unknown>;
 read():Promise<{complete:boolean;permits:Permit[]}>;
 append(value:Permit):Promise<void>;
}
export interface SyntheticPermitStore{
 transport:'SYNTHETIC_ONLY';
 /** 같은 실행/세대의 모든 grant를 잠그고 proof nonce/permit 결과를 함께 COMMIT/rollback한다. */
 transaction<T>(scope:Scope,body:(tx:SyntheticPermitTransaction)=>Promise<T>):Promise<T>;
}
class PermitFailure extends Error{}
const fail=(code:string):never=>{throw new PermitFailure(code);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
function readScope(raw:unknown):Scope{
 if(!recordV1(raw,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||raw.mode!=='EXECUTION'||!uuidV1(raw.projectId)||!uuidV1(raw.connectorId)||!uuidV1(raw.executionId)||!positive(raw.executionGeneration)||!refV1(raw.grantRef)||!positive(raw.credentialGeneration))return fail('PERMIT_SCOPE_INVALID');return cloneV1(raw) as unknown as Scope;
}
function readRequest(raw:unknown):Request{
 if(!recordV1(raw,['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])||!hashV1(raw.envelopeHash)||!refV1(raw.localAttemptRef)||!refV1(raw.osOwnershipRef)||!arrayV1(raw.sourceObservationRefs,200)||!raw.sourceObservationRefs.length||!raw.sourceObservationRefs.every(refV1)||new Set(raw.sourceObservationRefs.map(canonicalJson)).size!==raw.sourceObservationRefs.length)return fail('PERMIT_REQUEST_INVALID');return cloneV1(raw) as unknown as Request;
}
const queueKeys=['transport','executionId','executionGeneration','state','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed'];
/** P1 합성 START_SESSION 일회 소비 결과. 실제 실행 credential/OS permit·HTTP endpoint를 만들지 않는다.
 * 현재 proof와 원자적 nonce/저장은 mandatory store 계약이며 fake 검수는 실제 인증/PG COMMIT 증거가 아니다. */
export class SyntheticCommandPermits{
 readonly store:SyntheticPermitStore;
 constructor(store:SyntheticPermitStore){if(!store||store.transport!=='SYNTHETIC_ONLY'||typeof store.transaction!=='function')fail('SYNTHETIC_PERMIT_STORE_REQUIRED');this.store=store;}
 async #current(tx:SyntheticPermitTransaction,scope:Scope,commandId:string,request:Request){
  const c=cloneV1(await tx.current(commandId)),now=await tx.clock();
  if(!isoV1(now)||!recordV1(c,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','proof'])||!same(c.grantRef,scope.grantRef)||!isoV1(c.grantExpiresAt)||!refV1(c.commandRef)||!refV1(c.authorizationReceiptRef)||!recordV1(c.commandSnapshot,[...queueKeys,'envelope']))return fail('PERMIT_CURRENT_BINDING_INVALID');
  const f=readServerExecutionFactV1(c.fact),{envelope:rawEnvelope,...q}=c.commandSnapshot,e=readDispatchEnvelopeV1(rawEnvelope,Date.parse(now)),proof=c.proof;
  if(f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.registration.connectorId!==scope.connectorId||f.writerState!=='OWNED'
   ||executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||Date.parse(f.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(f.checkedAt)>30000
   ||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ')))return fail('PERMIT_CURRENT_AUTHORITY_REQUIRED');
  if(c.commandRef.contentHash!==hash(q)||q.transport!=='SYNTHETIC_ONLY'||q.state!=='SYNTHETIC_QUEUED'||q.executionAuthorized!==false||q.dispatchPerformed!==false
   ||q.executionId!==scope.executionId||q.executionGeneration!==scope.executionGeneration||!same(q.grantRef,scope.grantRef)||!same(q.reservationRef,f.budgetReservationRef)||!same(q.executorRegistrationRef,f.registration.ref)
   ||q.operation!=='START_SESSION'||e.operation!=='START_SESSION'||e.commandId!==commandId||e.envelopeHash!==request.envelopeHash||!same(q.payload,e.payload)||q.humanSessionId!==f.subject.humanSessionId
   ||!same(q.sourceScopes,f.intent.sourceScopes)||!same(q.budgetPolicyRef,f.intent.budgetPolicyRef)||q.queuedAt!==e.issuedAt||!same(e.executorRegistrationRef,f.registration.ref)
   ||!same(e.context,{projectId:f.projectId,assignmentId:f.intent.assignmentRef.id,executionId:f.executionId,executionGeneration:f.executionGeneration,connectionRef:f.intent.connectionRef,environmentRef:f.intent.environmentRef,authorizationReceiptRef:c.authorizationReceiptRef,capabilityRef:f.intent.capabilityRef,budgetRef:f.budgetReservationRef,sourceScopes:f.intent.sourceScopes})||!same(e.payload.contextBundleRef,f.intent.contextBundleRef))return fail('PERMIT_COMMAND_BINDING_INVALID');
  const sourceRefs=[...new Map(f.intent.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()];
  if(!same(sourceRefs,request.sourceObservationRefs)||!f.checks.osFence.evidenceRefs.some(r=>same(r,request.osOwnershipRef)))return fail('PERMIT_SOURCE_OS_MISMATCH');
  const target=executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+commandId+'/permit',[],canonicalJson(request));
  if(!recordV1(proof,['kind','ref','target','grantRef','credentialGeneration','publicKeyFingerprint','verifiedAt','challengeExpiresAt'])||proof.kind!=='SYNTHETIC_VERIFIED_REQUEST_PROOF'||!refV1(proof.ref)||!same(proof.target,target)||!same(proof.grantRef,scope.grantRef)||proof.credentialGeneration!==scope.credentialGeneration||proof.publicKeyFingerprint!==f.registration.hostPublicKeyFingerprint||!isoV1(proof.verifiedAt)||!isoV1(proof.challengeExpiresAt)||Date.parse(proof.verifiedAt)>Date.parse(now)||Date.parse(proof.challengeExpiresAt)<=Date.parse(proof.verifiedAt))return fail('PERMIT_EXACT_PROOF_REQUIRED');
  const deadline=Math.min(Date.parse(c.grantExpiresAt),Date.parse(e.expiresAt),...Object.values(f.expires).map(Date.parse));if(deadline<=Date.parse(now))return fail('PERMIT_GRANT_EXPIRED');
  const {checkedAt:_,...factBinding}=f;return{now,envelope:e,proof:cloneV1(proof),deadline,bindingHash:hash({scope,commandRef:c.commandRef,authorizationReceiptRef:c.authorizationReceiptRef,fact:factBinding}),commandRef:cloneV1(c.commandRef),fact:cloneV1(f)};
 }
 #ledger(raw:unknown,scope:Scope,now:string):Permit[]{
  if(!recordV1(raw,['complete','permits'])||raw.complete!==true)return fail('PERMIT_LEDGER_INCOMPLETE');if(!arrayV1(raw.permits,50)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)return fail('PERMIT_LEDGER_INVALID');const records:Permit[]=cloneV1(raw.permits),commands=new Set<string>(),proofs=new Set<string>();
  for(const r of records){const s=r?.snapshot;if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||!recordV1(s,['scope','commandId','commandRef','request','requestHash','proofRef','bindingHash','currentFact','state','issuedAt','expiresAt','executionAuthorized','dispatchPerformed'])||r.ref.contentHash!==hash(s)||!uuidV1(s.commandId)||!refV1(s.commandRef)||!refV1(s.proofRef)||!hashV1(s.bindingHash)||s.state!=='SYNTHETIC_CONSUMED_NO_AUTHORITY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!isoV1(s.issuedAt)||!isoV1(s.expiresAt)||Date.parse(s.issuedAt)>Date.parse(now)||Date.parse(s.expiresAt)<=Date.parse(s.issuedAt)||Date.parse(s.expiresAt)>Date.parse(s.issuedAt)+30000||commands.has(s.commandId)||proofs.has(canonicalJson(s.proofRef)))return fail('PERMIT_LEDGER_INVALID');
   try{readScope(s.scope);readRequest(s.request);const f=readServerExecutionFactV1(s.currentFact);if(f.projectId!==s.scope.projectId||f.executionId!==s.scope.executionId||f.executionGeneration!==s.scope.executionGeneration||f.writerState!=='OWNED'||Date.parse(f.checkedAt)>Date.parse(s.issuedAt)||Date.parse(s.issuedAt)-Date.parse(f.checkedAt)>30000)fail('PERMIT_LEDGER_INVALID');}catch{return fail('PERMIT_LEDGER_INVALID');}if(s.scope.projectId!==scope.projectId||s.scope.executionId!==scope.executionId||s.scope.executionGeneration!==scope.executionGeneration||s.scope.connectorId!==scope.connectorId||s.requestHash!==hash(s.request))return fail('PERMIT_LEDGER_INVALID');commands.add(s.commandId);proofs.add(canonicalJson(s.proofRef));
  }return records;
 }
 #result(r:Permit,e:any){return{transport:'SYNTHETIC_ONLY' as const,key:receiptKeyV1(e),envelopeHash:r.snapshot.request.envelopeHash,grantRef:cloneV1(r.snapshot.scope.grantRef),permitRef:cloneV1(r.ref),checkedAt:r.snapshot.issuedAt,expiresAt:r.snapshot.expiresAt,executionAuthorized:false,dispatchPerformed:false};}
 /** 기존 receiver의 정확한 7필드 port로만 투영한다. false 권한 필드를 true로 바꾸거나 검사를 완화하지 않는다. */
 async consumeForReceiver(scope:unknown,commandId:string,request:unknown){const {executionAuthorized,dispatchPerformed,...permit}=await this.consume(scope,commandId,request);if(executionAuthorized!==false||dispatchPerformed!==false)fail('PERMIT_AUTHORITY_PROJECTION_INVALID');return permit;}
 async consume(rawScope:unknown,commandId:string,rawRequest:unknown){
  try{const scope=readScope(rawScope),request=readRequest(rawRequest);if(!uuidV1(commandId))fail('PERMIT_COMMAND_ID_INVALID');if(this.store.transport!=='SYNTHETIC_ONLY')fail('SYNTHETIC_PERMIT_STORE_REQUIRED');
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const current=await this.#current(tx,scope,commandId,request),records=this.#ledger(await tx.read(),scope,current.now),existing=records.find(r=>r.snapshot.commandId===commandId);
    if(existing){if(!same(existing.snapshot.request,request)||!same(existing.snapshot.scope,scope)||!same(existing.snapshot.commandRef,current.commandRef)||existing.snapshot.bindingHash!==current.bindingHash)fail('PERMIT_COMMAND_ATTEMPT_CONFLICT');const again=await this.#current(tx,scope,commandId,request);if(again.bindingHash!==current.bindingHash||Date.parse(existing.snapshot.expiresAt)>Math.min(current.deadline,again.deadline,Date.parse(current.proof.challengeExpiresAt),Date.parse(again.proof.challengeExpiresAt)))fail('PERMIT_CURRENT_BINDING_CHANGED');return this.#result(existing,current.envelope);}
    if(records.length)fail('PERMIT_START_ALREADY_RESERVED');
    const before=await this.#current(tx,scope,commandId,request);if(current.bindingHash!==before.bindingHash||!same(current.proof,before.proof))fail('PERMIT_CURRENT_BINDING_CHANGED');
    const deadline=Math.min(Date.parse(before.now)+30000,current.deadline,before.deadline,Date.parse(before.proof.challengeExpiresAt));
    if(deadline<=Date.parse(before.now)||Date.parse(before.now)-Date.parse(before.proof.verifiedAt)>30000)fail('PERMIT_PROOF_EXPIRED');
    const snapshot:Permit['snapshot']={scope,commandId,commandRef:before.commandRef,request,requestHash:hash(request),proofRef:before.proof.ref,bindingHash:before.bindingHash,currentFact:cloneV1(before.fact),state:'SYNTHETIC_CONSUMED_NO_AUTHORITY',issuedAt:before.now,expiresAt:new Date(deadline).toISOString(),executionAuthorized:false,dispatchPerformed:false};
    const permit:Permit={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};await tx.append(cloneV1(permit));
    const final=await this.#current(tx,scope,commandId,request);if(final.bindingHash!==before.bindingHash||!same(final.proof,before.proof)||deadline>Math.min(final.deadline,Date.parse(final.proof.challengeExpiresAt))||Date.parse(final.now)>=deadline)fail('PERMIT_CURRENT_BINDING_CHANGED');return this.#result(permit,final.envelope);
   });
  }catch(error){if(error instanceof PermitFailure)throw error;return fail('PERMIT_STORAGE_UNAVAILABLE');}
 }
}

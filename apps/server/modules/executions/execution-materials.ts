import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {executionFactChecks,readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,recordV1,refV1,uuidV1,isoV1,hashV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {executionTarget} from './execution-proof.ts';
import type {SyntheticChallengeScope} from './execution-challenges.ts';
import {readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';
export interface SyntheticMaterialTransaction{
 clock():Promise<string>;
 /** 현재 저장 명령·등록 부분·원문 접근/격리/정정/제외/basis와 검증 proof를 같은 tx에서 결박한다.
  * HTTP 입력이나 정적 등록 지문으로 current/proof를 대신하지 않는다. */
 current(commandId:string,materialId:string):Promise<unknown>;
 readPart(registeredMaterialRef:RuntimeRefV1):Promise<Uint8Array>;
}
export interface SyntheticMaterialStore{transport:'SYNTHETIC_ONLY';transaction<T>(scope:SyntheticChallengeScope,body:(tx:SyntheticMaterialTransaction)=>Promise<T>):Promise<T>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
class MaterialFailure extends Error{}
const fail=(code:string):never=>{throw new MaterialFailure(code);};
const queueKeys=['transport','executionId','executionGeneration','state','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed'];
/** P1 내부 합성 자료 resolver. 실제 원문 provider/HTTP/credential을 만들지 않으며
 * 이 결과는 전체 맥락 수신·이해 검토·WORK/실행 허가가 아니다. nonce 소비는 상위 인증 tx의 책임이다. */
export class SyntheticExecutionMaterials{
 readonly store:SyntheticMaterialStore;
 constructor(store:SyntheticMaterialStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')fail('SYNTHETIC_MATERIAL_STORE_REQUIRED');}
 async #current(tx:SyntheticMaterialTransaction,scope:SyntheticChallengeScope,commandId:string,materialId:string){
  this.#port();const c=cloneV1(await tx.current(commandId,materialId)),now=await tx.clock();
  if(!isoV1(now)||!recordV1(c,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','material','sourceState','proof'])||!same(c.grantRef,scope.grantRef)||!isoV1(c.grantExpiresAt)||!refV1(c.commandRef)||!refV1(c.authorizationReceiptRef)||c.sourceState!=='AVAILABLE')return fail('MATERIAL_CURRENT_REQUIRED');
  const snapshot:any=c.commandSnapshot,instruction=snapshot?.state==='SYNTHETIC_INSTRUCTION_QUEUED'?readSyntheticInstructionQueueRecord({ref:c.commandRef,snapshot},{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration}):null;
  if(!instruction&&!recordV1(snapshot,[...queueKeys,'envelope']))return fail('MATERIAL_CURRENT_REQUIRED');
  const fact=readServerExecutionFactV1(c.fact),{envelope:raw,...queue}=snapshot,envelope=readDispatchEnvelopeV1(raw,Date.parse(now)),material=c.material,proof=c.proof;
  if(!instruction&&envelope.operation!=='START_SESSION')return fail('MATERIAL_COMMAND_MISMATCH');
  if(fact.projectId!==scope.projectId||fact.executionId!==scope.executionId||fact.executionGeneration!==scope.executionGeneration||fact.registration.connectorId!==scope.connectorId||!['NONE','OWNED'].includes(fact.writerState)||Date.parse(fact.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(fact.checkedAt)>30000
   ||executionFactChecks.some(n=>n!=='understanding'&&fact.checks[n].state!=='VERIFIED_CURRENT')||fact.intent.mode==='WORK'&&(fact.understandingReviewRef===null||fact.checks.understanding.state!=='VERIFIED_CURRENT')||fact.intent.mode==='CONTEXT_REVIEW'&&fact.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ')))fail('MATERIAL_CURRENT_REQUIRED');
  if(!instruction&&(c.commandRef.contentHash!==hash(queue)||queue.transport!=='SYNTHETIC_ONLY'||queue.state!=='SYNTHETIC_QUEUED'||queue.executionAuthorized!==false||queue.dispatchPerformed!==false||queue.executionId!==scope.executionId||queue.executionGeneration!==scope.executionGeneration||!same(queue.grantRef,scope.grantRef)||!same(queue.reservationRef,fact.budgetReservationRef)||!same(queue.executorRegistrationRef,fact.registration.ref)||queue.operation!==envelope.operation||!same(queue.payload,envelope.payload)||queue.humanSessionId!==fact.subject.humanSessionId||!same(queue.sourceScopes,fact.intent.sourceScopes)||!same(queue.budgetPolicyRef,fact.intent.budgetPolicyRef)||queue.queuedAt!==envelope.issuedAt||envelope.commandId!==commandId||envelope.operation==='REQUEST_STOP'||!same(envelope.executorRegistrationRef,fact.registration.ref)
   ||!same(envelope.context,{projectId:fact.projectId,assignmentId:fact.intent.assignmentRef.id,executionId:fact.executionId,executionGeneration:fact.executionGeneration,connectionRef:fact.intent.connectionRef,environmentRef:fact.intent.environmentRef,authorizationReceiptRef:c.authorizationReceiptRef,capabilityRef:fact.intent.capabilityRef,budgetRef:fact.budgetReservationRef,sourceScopes:fact.intent.sourceScopes})||envelope.operation==='START_SESSION'&&!same(envelope.payload.contextBundleRef,fact.intent.contextBundleRef)))fail('MATERIAL_COMMAND_MISMATCH');
  if(instruction){
   const s=instruction.snapshot,b=s.currentBinding,{checkedAt:_,expires:__,...currentFact}=fact,{expires:___,...savedFact}=b.fact;
   if(!same(currentFact,savedFact)||fact.writerState!=='OWNED'||!same(b.grantRef,scope.grantRef)||b.grantExpiresAt!==c.grantExpiresAt||envelope.commandId!==commandId||envelope.operation!=='SEND_INSTRUCTION'||!same(c.authorizationReceiptRef,envelope.context.authorizationReceiptRef)||!same(envelope.context.budgetRef,s.reservationRef))fail('MATERIAL_COMMAND_MISMATCH');
  }
  const target=executionTarget('GET','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+commandId+'/materials/'+materialId,[],null);
  if(!recordV1(proof,['kind','ref','target','grantRef','credentialGeneration','publicKeyFingerprint','verifiedAt','challengeExpiresAt'])||proof.kind!=='SYNTHETIC_VERIFIED_REQUEST_PROOF'||!refV1(proof.ref)||!same(proof.target,target)||!same(proof.grantRef,scope.grantRef)||proof.credentialGeneration!==scope.credentialGeneration||proof.publicKeyFingerprint!==fact.registration.hostPublicKeyFingerprint||!isoV1(proof.verifiedAt)||!isoV1(proof.challengeExpiresAt)||Date.parse(proof.verifiedAt)>Date.parse(now)||Date.parse(now)-Date.parse(proof.verifiedAt)>30000||Date.parse(proof.challengeExpiresAt)<=Date.parse(now))fail('MATERIAL_EXACT_PROOF_REQUIRED');
  const d=material?.snapshot;
  if(!recordV1(material,['ref','snapshot'])||!refV1(material.ref)||material.ref.id!==materialId||material.ref.contentHash!==hash(d)||!recordV1(d,['projectId','executionId','executionGeneration','commandId','envelopeHash','payloadRef','sourceRef','partIndex','partCount','byteOffset','sourceBytes','utf8Bytes','contentHash','mediaType'])||d.projectId!==scope.projectId||d.executionId!==scope.executionId||d.executionGeneration!==scope.executionGeneration||d.commandId!==commandId||d.envelopeHash!==envelope.envelopeHash||!refV1(d.payloadRef)||!Object.values(envelope.payload).some(r=>same(r,d.payloadRef))||envelope.operation==='SEND_INSTRUCTION'&&same(envelope.payload.sessionBindingRef,d.payloadRef)||!refV1(d.sourceRef)||!positive(d.partIndex)||!positive(d.partCount)||d.partCount>200||d.partIndex>d.partCount||!Number.isSafeInteger(d.byteOffset)||d.byteOffset<0||!positive(d.sourceBytes)||d.sourceBytes>2*1024*1024||!positive(d.utf8Bytes)||d.utf8Bytes>2*1024*1024||d.byteOffset+d.utf8Bytes>d.sourceBytes||d.partIndex===1&&d.byteOffset!==0||d.partIndex===d.partCount&&d.byteOffset+d.utf8Bytes!==d.sourceBytes||!hashV1(d.contentHash)||!['text/plain','application/json'].includes(d.mediaType))fail('MATERIAL_BINDING_INVALID');
  const deadline=Math.min(Date.parse(c.grantExpiresAt),Date.parse(envelope.expiresAt),Date.parse(proof.challengeExpiresAt),...Object.values(fact.expires).map(Date.parse));if(deadline<=Date.parse(now))fail('MATERIAL_EXPIRED');
  const {checkedAt:_,...stableFact}=fact;return{material:cloneV1(material),now,deadline,binding:hash({scope,fact:stableFact,commandRef:c.commandRef,authorizationReceiptRef:c.authorizationReceiptRef,material,proof})};
 }
 async read(rawScope:unknown,commandId:unknown,materialId:unknown){return(await this.readWithDeadline(rawScope,commandId,materialId)).material;}
 /** 서버 내부 반환 장벽용 기한이며 기존 부분자료 wire 응답에는 필드를 추가하지 않는다. */
 async readWithDeadline(rawScope:unknown,commandId:unknown,materialId:unknown){
  try{
   this.#port();if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'||!uuidV1(rawScope.projectId)||!uuidV1(rawScope.connectorId)||!uuidV1(rawScope.executionId)||!positive(rawScope.executionGeneration)||!positive(rawScope.credentialGeneration)||!refV1(rawScope.grantRef)||!uuidV1(commandId)||!uuidV1(materialId))fail('MATERIAL_SCOPE_INVALID');const scope=cloneV1(rawScope) as unknown as SyntheticChallengeScope;
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const before=await this.#current(tx,scope,commandId as string,materialId as string),raw=await tx.readPart(cloneV1(before.material.ref));this.#port();if(!(raw instanceof Uint8Array)||raw.byteLength!==before.material.snapshot.utf8Bytes)fail('MATERIAL_BYTES_INVALID');const bytes=Buffer.from(raw);
    if(contentHash(bytes)!==before.material.snapshot.contentHash)fail('MATERIAL_BYTES_INVALID');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);assertKnowledgeTextSafe(text);
    const final=await this.#current(tx,scope,commandId as string,materialId as string);if(final.binding!==before.binding||Date.parse(final.now)>=Math.min(before.deadline,final.deadline))fail('MATERIAL_CURRENT_CHANGED');const d=final.material.snapshot;
return{validUntil:new Date(Math.min(before.deadline,final.deadline)).toISOString(),material:{transport:'SYNTHETIC_ONLY' as const,materialId,materialRef:cloneV1(final.material.ref),sourceRef:cloneV1(d.sourceRef),partIndex:d.partIndex,partCount:d.partCount,byteOffset:d.byteOffset,sourceBytes:d.sourceBytes,contentHash:d.contentHash,mediaType:d.mediaType,bytes:new Uint8Array(bytes),cacheControl:'no-store' as const,completeContextVerified:false,executionAuthorized:false,dispatchPerformed:false}};
   });
  }catch(error){if(error instanceof MaterialFailure)throw error;return fail('MATERIAL_UNAVAILABLE');}
 }
}

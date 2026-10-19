import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {executionFactChecks,readServerExecutionFactV1,type ServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {ProjectExecutionBudget,type BudgetClaim,type BudgetRecord} from './execution-budget.ts';
import {authorizeRuntimePolicy,ProjectLimitPolicies} from './runtime-policy.ts';
type Scope={projectId:string;executionId:string;executionGeneration:number};
type Subject=ServerExecutionFactV1['subject'];
interface Current {
 transport:'SYNTHETIC_ONLY';scope:Scope;grantRef:Ref;grantKind:'EXECUTION';grantState:'ACTIVE';grantExpiresAt:string;grantSubject:Subject;grantAllowedOperations:string[];
 sessionBindingRef:Ref;instructionRef:Ref;partsRef:Ref;materialManifestRef:Ref;turnState:'IDLE'|'BUSY';fact:ServerExecutionFactV1;checkedAt:string;expiresAt:string;
}
interface Input {grantRef:Ref;sessionBindingRef:Ref;instructionRef:Ref;partsRef:Ref;permissionPolicyRef:Ref;budgetPolicyRef:Ref;reason:string}
type Binding=Omit<Current,'checkedAt'|'expiresAt'|'fact'>&{fact:Omit<ServerExecutionFactV1,'checkedAt'>};
interface Intent {transport:'SYNTHETIC_ONLY';state:'SYNTHETIC_INSTRUCTION_QUEUED';scope:Scope;requestHash:string;currentBinding:Binding;reservationRef:Ref;reason:string;queuedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false}
export interface SyntheticInstructionQueueRecord {ref:Ref;snapshot:Intent&{request:ProjectCommand;envelope:DispatchEnvelopeV1}}
export interface SyntheticInstructionQueueStore {
 readonly transport:'SYNTHETIC_ONLY';
 /** 저장된 현재 grant/세션/자료/능력을 조회하며 caller 입력을 현재 사실로 채택하지 않는다. P1은 합성 제공자만 쓴다. */
 current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope):Promise<Current>;
 claim(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope,request:ProjectCommand):Promise<BudgetClaim>;
 /** 같은 인증 tx에서 새 예약·명령·HELD_SYNTHETIC_ONLY outbox를 함께 저장한다. 별도 pool/COMMIT/실전달은 금지한다. */
 append(db:PoolClient,scope:Scope,record:SyntheticInstructionQueueRecord,reservation:BudgetRecord,createdCommandId:string):Promise<void>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v)),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=(code:string,status=412):never=>{throw new AuthFailure(code,status);};
function readRequest(raw:unknown):ProjectCommand {
 if(!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||raw.schemaVersion!==1||![raw.projectId,raw.commandId,raw.clientId,raw.targetId].every(uuidV1)||!positive(raw.controlGeneration)||!positive(raw.expectedVersion)||raw.operation!=='queueExecutionCommand'||!arrayV1(raw.baselineRefs,0)||raw.approvalRef!==null||Buffer.byteLength(canonicalJson(raw))>2097152)return fail('INSTRUCTION_QUEUE_INPUT_INVALID',422);
 const p=raw.payload;if(!recordV1(p,['grantRef','sessionBindingRef','instructionRef','partsRef','permissionPolicyRef','budgetPolicyRef','reason'])||![p.grantRef,p.sessionBindingRef,p.instructionRef,p.partsRef,p.permissionPolicyRef,p.budgetPolicyRef].every(refV1)||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000)return fail('INSTRUCTION_QUEUE_INPUT_INVALID',422);assertKnowledgeTextSafe(p.reason);return cloneV1(raw) as unknown as ProjectCommand;
}
function readCurrent(raw:unknown,scope:Scope,request:ProjectCommand,actor:AuthenticatedIdentity,at:number,allowBusy=false) {
 if(!recordV1(raw,['transport','scope','grantRef','grantKind','grantState','grantExpiresAt','grantSubject','grantAllowedOperations','sessionBindingRef','instructionRef','partsRef','materialManifestRef','turnState','fact','checkedAt','expiresAt'])||raw.transport!=='SYNTHETIC_ONLY'||!same(raw.scope,scope)||raw.grantKind!=='EXECUTION'||raw.grantState!=='ACTIVE'||raw.turnState!=='IDLE'&&!(allowBusy&&raw.turnState==='BUSY')||![raw.grantRef,raw.sessionBindingRef,raw.instructionRef,raw.partsRef,raw.materialManifestRef].every(refV1)||!isoV1(raw.grantExpiresAt)||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>at||at-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=at||Date.parse(raw.grantExpiresAt)<=at||!arrayV1(raw.grantAllowedOperations,3)||!raw.grantAllowedOperations.includes('SEND_INSTRUCTION')||raw.grantAllowedOperations.some(o=>!['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'].includes(o))||new Set(raw.grantAllowedOperations).size!==raw.grantAllowedOperations.length||Buffer.byteLength(canonicalJson(raw))>2097152)return fail('INSTRUCTION_QUEUE_CURRENT_REQUIRED');
 const c=cloneV1(raw) as unknown as Current,f=readServerExecutionFactV1(c.fact),p=request.payload as unknown as Input,subject={userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession!.id,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration};
 if(!same(c.grantSubject,subject)||!same(f.subject,subject)||f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||!same(c.grantRef,p.grantRef)||!same(c.sessionBindingRef,p.sessionBindingRef)||!same(c.sessionBindingRef,f.agentSession.sessionRef)||!same(c.instructionRef,p.instructionRef)||!same(c.partsRef,p.partsRef)||!same(f.permissionPolicyRef,p.permissionPolicyRef)||!same(f.intent.budgetPolicyRef,p.budgetPolicyRef))return fail('INSTRUCTION_QUEUE_BINDING_MISMATCH');
 if(f.writerState!=='OWNED'||Date.parse(f.checkedAt)>at||at-Date.parse(f.checkedAt)>30000||Object.values(f.expires).some(v=>Date.parse(v)<=at)||executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ')))return fail('INSTRUCTION_QUEUE_FACT_REQUIRED');
 const{checkedAt:_,expiresAt:__,fact:___,...currentBinding}=c,{checkedAt:____,...factBinding}=f;return{c:{...c,fact:f},binding:{...currentBinding,fact:factBinding} as Binding};
}
// 저장 서비스와 permit basis가 같은 현재 문법/주체 검사를 소비한다. 실제 조회 권위를 대신하지 않는다.
export {readCurrent as readSyntheticInstructionCurrent};
/** 저장 당시의 exact 결박·문법만 판독한다. 현재 grant/자료·실제 영수증/outbox·전달 권위는 별도 제공자가 대조한다. */
export function readSyntheticInstructionQueueRecord(raw:unknown,scope:Scope):SyntheticInstructionQueueRecord {
 try{
  if(!recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||!positive(scope.executionGeneration)||!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!recordV1(raw.snapshot,['transport','state','scope','requestHash','currentBinding','reservationRef','reason','queuedAt','expiresAt','executionAuthorized','dispatchPerformed','request','envelope'])||Buffer.byteLength(canonicalJson(raw))>2097152)throw Error();
  const s=raw.snapshot;if(s.transport!=='SYNTHETIC_ONLY'||s.state!=='SYNTHETIC_INSTRUCTION_QUEUED'||!same(s.scope,scope)||!refV1(s.reservationRef)||s.reservationRef.version!==1||!isoV1(s.queuedAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.queuedAt)||Date.parse(s.expiresAt)>Date.parse(s.queuedAt)+30000||s.executionAuthorized!==false||s.dispatchPerformed!==false)throw Error();
  const request=readRequest(s.request),subject=s.currentBinding?.grantSubject,at=Date.parse(s.queuedAt);if(!recordV1(subject,['userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||![subject.userId,subject.clientId,subject.humanSessionId].every(uuidV1)||!positive(subject.credentialGeneration)||!positive(subject.controlGeneration))throw Error();
  const actor:AuthenticatedIdentity={actorId:subject.userId,clientId:subject.clientId,serverOwner:false,credentialGeneration:subject.credentialGeneration,reauthUntil:null,authSession:{id:subject.humanSessionId,idleExpiresAt:s.expiresAt,absoluteExpiresAt:s.expiresAt}},checked=readCurrent({...s.currentBinding,fact:{...s.currentBinding.fact,checkedAt:s.queuedAt},checkedAt:s.queuedAt,expiresAt:s.expiresAt},scope,request,actor,at),f=checked.c.fact,i=f.intent,p=request.payload as unknown as Input,{request:_,envelope:__,...intent}=s;
  if(!same(s.currentBinding,checked.binding)||request.projectId!==scope.projectId||request.targetId!==scope.executionId||request.expectedVersion!==scope.executionGeneration||request.clientId!==subject.clientId||request.controlGeneration!==subject.controlGeneration||s.requestHash!==hash(request)||s.reason!==p.reason||raw.ref.contentHash!==hash(intent)||s.reservationRef.id===f.budgetReservationRef.id||Date.parse(s.expiresAt)>Math.min(Date.parse(checked.c.grantExpiresAt),...Object.values(f.expires).map(Date.parse)))throw Error();
  const e=readDispatchEnvelopeV1(s.envelope,at),expected={projectId:scope.projectId,assignmentId:i.assignmentRef.id,executionId:scope.executionId,executionGeneration:scope.executionGeneration,connectionRef:i.connectionRef,environmentRef:i.environmentRef,authorizationReceiptRef:e.context.authorizationReceiptRef,capabilityRef:i.capabilityRef,budgetRef:s.reservationRef,sourceScopes:i.sourceScopes};
  if(e.operation!=='SEND_INSTRUCTION'||e.commandId!==request.commandId||e.issuedAt!==s.queuedAt||e.expiresAt!==s.expiresAt||!same(e.executorRegistrationRef,f.registration.ref)||!same(e.context,expected)||!same(e.payload,{sessionBindingRef:p.sessionBindingRef,instructionRef:p.instructionRef,partsRef:p.partsRef}))throw Error();
  return cloneV1(raw) as unknown as SyntheticInstructionQueueRecord;
 }catch{return fail('INSTRUCTION_QUEUE_RECORD_INVALID',503);}
}
/** 기존 실행의 후속 지시 저장 소비자다. 새 grant/writer·credential·HTTP/OS/Agent를 만들지 않는다.
 * 현재 제공자/append는 필수 합성 port이며 실제 PG 구현/원자성은 별도 검증 대상이다. */
export class ProjectExecutionInstructionQueue {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly access:AccessRepository;readonly store:SyntheticInstructionQueueStore;readonly budgets:ProjectExecutionBudget;readonly policies:Pick<ProjectLimitPolicies,'resolveCurrent'>;
 constructor(access:AccessRepository,store:SyntheticInstructionQueueStore,budgets=new ProjectExecutionBudget(),policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()) {this.access=access;this.store=store;this.budgets=budgets;this.policies=policies;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.current!=='function'||typeof this.store.claim!=='function'||typeof this.store.append!=='function')fail('SYNTHETIC_INSTRUCTION_QUEUE_STORE_REQUIRED');}
 async #now(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('INSTRUCTION_QUEUE_CLOCK_INVALID',503);return at.getTime();}
 #human(actor:AuthenticatedIdentity,at:number){const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return fail('INSTRUCTION_QUEUE_HUMAN_REQUIRED');const end=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt));if(end<=at)return fail('INSTRUCTION_QUEUE_HUMAN_EXPIRED');return end;}
 async command(token:string,csrf:string,value:ProjectCommand){
  const request=readRequest(value),p=request.payload as unknown as Input,scope={projectId:request.projectId,executionId:request.targetId!,executionGeneration:request.expectedVersion};
  try{return await this.access.authenticated(token,csrf,async(db,actor)=>{
   this.#port();await currentProjectController(db,actor,request);this.#human(actor,await this.#now(db));const first=readCurrent(await this.store.current(db,actor,cloneV1(scope)),scope,request,actor,await this.#now(db),true);
   const policyInput={executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:p.permissionPolicyRef,budgetPolicyRef:p.budgetPolicyRef,sourceScopes:first.c.fact.intent.sourceScopes};let policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);const replay=await projectReplay(db,actor,request);if(replay!==undefined)return replay;
   // BUSY여도 원명령 영수증을 읽을 수 있지만 새 지시·예약은 IDLE 확인 뒤에만 만든다.
   if(first.c.turnState!=='IDLE')fail('INSTRUCTION_QUEUE_CURRENT_REQUIRED');
   const claim=cloneV1(await this.store.claim(db,actor,cloneV1(scope),cloneV1(request)));if(claim.projectId!==scope.projectId||claim.executionId!==scope.executionId||claim.executionGeneration!==scope.executionGeneration||claim.commandId!==request.commandId||claim.operation!=='SEND_INSTRUCTION'||!same(claim.assignmentRef,first.c.fact.intent.assignmentRef)||!same(claim.policyRef,p.budgetPolicyRef))fail('INSTRUCTION_QUEUE_CLAIM_MISMATCH');
   const planned=await this.budgets.planReservation(db,actor,claim),reservation=planned.record;if(reservation.snapshot.state!=='RESERVED'||reservation.ref.version!==1||!same(reservation.snapshot.claim,claim)||reservation.snapshot.executionAuthorized!==false||reservation.snapshot.dispatchPerformed!==false)fail('INSTRUCTION_QUEUE_RESERVATION_INVALID');
   const next=readCurrent(await this.store.current(db,actor,cloneV1(scope)),scope,request,actor,await this.#now(db));if(!same(first.binding,next.binding))fail('INSTRUCTION_QUEUE_CURRENT_CHANGED');policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);let at=await this.#now(db);
   const deadline=Math.min(at+30000,policy.validUntil,this.#human(actor,at),Date.parse(first.c.expiresAt),Date.parse(next.c.expiresAt),Date.parse(first.c.grantExpiresAt),...Object.values(next.c.fact.expires).map(Date.parse));if(deadline<=at)fail('INSTRUCTION_QUEUE_EXPIRED');
   const intent:Intent={transport:'SYNTHETIC_ONLY',state:'SYNTHETIC_INSTRUCTION_QUEUED',scope,requestHash:hash(request),currentBinding:first.binding,reservationRef:cloneV1(reservation.ref),reason:p.reason,queuedAt:new Date(at).toISOString(),expiresAt:new Date(deadline).toISOString(),executionAuthorized:false,dispatchPerformed:false},ref={id:randomUUID(),version:1,contentHash:hash(intent)};
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'SYNTHETIC_INSTRUCTION_QUEUE_STORED',snapshot:intent,executionAuthorized:false,dispatchPerformed:false},policy.policyRef,'EXPLICIT_SYNTHETIC_INSTRUCTION_ONLY'),f=first.c.fact,i=f.intent;
   const unsigned={schemaVersion:1,commandId:request.commandId,issuedAt:intent.queuedAt,expiresAt:intent.expiresAt,executorRegistrationRef:f.registration.ref,context:{projectId:scope.projectId,assignmentId:i.assignmentRef.id,executionId:scope.executionId,executionGeneration:scope.executionGeneration,connectionRef:i.connectionRef,environmentRef:i.environmentRef,authorizationReceiptRef:receipt.authorizationReceiptRef,capabilityRef:i.capabilityRef,budgetRef:reservation.ref,sourceScopes:i.sourceScopes},operation:'SEND_INSTRUCTION',payload:{sessionBindingRef:p.sessionBindingRef,instructionRef:p.instructionRef,partsRef:p.partsRef}},envelope=readDispatchEnvelopeV1({...unsigned,envelopeHash:hash(unsigned)},at),record={ref,snapshot:{...intent,request,envelope}};
   if(Buffer.byteLength(canonicalJson(record))>2097152)fail('INSTRUCTION_QUEUE_TOO_LARGE',422);const checkedRecord=readSyntheticInstructionQueueRecord(record,scope);this.#port();await this.store.append(db,cloneV1(scope),checkedRecord,cloneV1(reservation),receipt.id);this.#port();const final=readCurrent(await this.store.current(db,actor,cloneV1(scope)),scope,request,actor,await this.#now(db));if(!same(first.binding,final.binding)||Date.parse(final.c.expiresAt)<deadline)fail('INSTRUCTION_QUEUE_CURRENT_CHANGED');const lastPolicy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);at=await this.#now(db);this.#port();readCurrent(final.c,scope,request,actor,at);if(lastPolicy.validUntil<deadline||at>=Math.min(deadline,this.#human(actor,at)))fail('INSTRUCTION_QUEUE_EXPIRED');return receipt.result;
  });}catch(error){await recordProjectDenial(this.access,token,request.projectId,error);throw error;}
 }
}

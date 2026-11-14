import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {executionFactChecks,readServerExecutionFactV1,type ServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {ProjectExecutionBudget,readExecutionBudgetClaim,type BudgetClaim,type BudgetRecord} from './execution-budget.ts';
import {authorizeRuntimePolicy,ProjectLimitPolicies} from './runtime-policy.ts';
import {assertNoStoredExecutionStop} from './execution-stop-fence.ts';
import {readCurrent as readGrantCurrent} from './normal-exchange-challenge.ts';
import {assertMaterialCapacity} from './execution-material-registration-input.ts';

export type NormalInstructionScope={projectId:string;executionId:string;executionGeneration:number};
export type NormalInstructionFact=Omit<ServerExecutionFactV1,'transport'|'agentSession'>&{
 transport:'NORMAL_PROTECTED';agentSession:{sessionRef:Ref;roleBindingRef:Ref;bindingGeneration:number};executionCredentialReservation:{id:string;generation:number}};
export interface NormalInstructionCurrentSource {
 /** 서버 소유 관측 포트. 원 DB 연결과 HTTP caller의 current 선언을 전달하지 않는다. */
 observe(scope:Readonly<NormalInstructionScope & {grantRef:Ref;instructionRef:Ref;partsRef:Ref}>,observedAt:string,signal:AbortSignal):Promise<unknown>;
}
export interface NormalInstructionOptions{mode:'NORMAL_PROTECTED';current?:NormalInstructionCurrentSource}
export function readNormalInstructionOptions(raw:unknown):NormalInstructionOptions {
 const bad=():never=>{throw Error('NORMAL_INSTRUCTION_CONFIGURATION_INVALID');};
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))return bad();
 const d=Object.getOwnPropertyDescriptors(raw),keys=Reflect.ownKeys(d);
 if(keys.some(k=>k!=='mode'&&k!=='current')||!d.mode||!('value'in d.mode)||!d.mode.enumerable||d.mode.value!=='NORMAL_PROTECTED'||keys.some(k=>typeof k!=='string'||!('value'in d[k]!)||!d[k]!.enumerable))return bad();
 if(d.current){const p=d.current.value;if(!p||typeof p!=='object'||types.isProxy(p))return bad();const m=Object.getOwnPropertyDescriptor(p,'observe')??Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p)??{},'observe');if(!m||!('value'in m)||typeof m.value!=='function')return bad();}
 return Object.freeze({mode:'NORMAL_PROTECTED',...(d.current?{current:d.current.value}:{})});
}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=(code='NORMAL_INSTRUCTION_REJECTED',status=412):never=>{throw new AuthFailure(code,status);};
export function readNormalInstructionRequest(raw:unknown):ProjectCommand{
 if(!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||raw.schemaVersion!==1||![raw.projectId,raw.commandId,raw.clientId,raw.targetId].every(uuidV1)||!positive(raw.controlGeneration)||!positive(raw.expectedVersion)||raw.operation!=='queueExecutionCommand'||!arrayV1(raw.baselineRefs,0)||raw.approvalRef!==null||Buffer.byteLength(canonicalJson(raw))>2097152)return fail('INSTRUCTION_QUEUE_INPUT_INVALID',422);
 const p=raw.payload;if(!recordV1(p,['grantRef','sessionBindingRef','instructionRef','partsRef','permissionPolicyRef','budgetPolicyRef','reason'])||![p.grantRef,p.sessionBindingRef,p.instructionRef,p.partsRef,p.permissionPolicyRef,p.budgetPolicyRef].every(refV1)||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000)return fail('INSTRUCTION_QUEUE_INPUT_INVALID',422);assertKnowledgeTextSafe(p.reason);return cloneV1(raw) as unknown as ProjectCommand;
}
/** normal 고유 세대/예약을 먼저 검사한다. 기존 검사기는 나머지 공유 문법에만 적용한다. */
export function readNormalInstructionFact(raw:unknown):NormalInstructionFact{
 let f:any;try{f=cloneV1(raw);}catch{return fail('NORMAL_INSTRUCTION_FACT_INVALID');}
 const ag=f?.agentSession,res=f?.executionCredentialReservation;
 if(f?.transport!=='NORMAL_PROTECTED'||!recordV1(ag,['sessionRef','roleBindingRef','bindingGeneration'])||!positive(ag.bindingGeneration)||!recordV1(res,['id','generation'])||!uuidV1(res.id)||!positive(res.generation))return fail('NORMAL_INSTRUCTION_FACT_INVALID');
 const {executionCredentialReservation:_,...shape}=f;
 try{readServerExecutionFactV1({...shape,transport:'SYNTHETIC_ONLY',agentSession:{sessionRef:ag.sessionRef,roleBindingRef:ag.roleBindingRef,credentialGeneration:ag.bindingGeneration}});}catch{return fail('NORMAL_INSTRUCTION_FACT_INVALID');}
 return f;
}
const stableFact=(f:NormalInstructionFact)=>{const {checkedAt:_,checks:__,expires:___,writerState:____,...rest}=f;return rest;};
type Parent={commandRef:Ref;envelopeHash:string;authorizationReceiptRef:Ref};
type Original={sourceRef:Ref;bodyRef:Ref;partsRef:Ref;originRef:Ref;contentHash:string;sourceBytes:number;mediaType:'text/plain;charset=utf-8'|'text/markdown;charset=utf-8';parts:{partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}[]};
export function readNormalInstructionOriginal(raw:unknown,request:ProjectCommand):Original{
 if(!recordV1(raw,['sourceRef','bodyRef','partsRef','originRef','contentHash','sourceBytes','mediaType','parts'])||![raw.sourceRef,raw.bodyRef,raw.partsRef,raw.originRef].every(refV1)||!same(raw.sourceRef,request.payload.instructionRef)||!same(raw.partsRef,request.payload.partsRef)||!same(raw.originRef,raw.sourceRef)||!hashV1(raw.contentHash)||!positive(raw.sourceBytes)||raw.sourceBytes>2097152||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(raw.mediaType)||!arrayV1(raw.parts,200)||!raw.parts.length) return fail('NORMAL_INSTRUCTION_SOURCE_INVALID');
 let offset=0;for(const [i,p]of raw.parts.entries()){if(!recordV1(p,['partIndex','byteOffset','utf8Bytes','contentHash'])||p.partIndex!==i+1||p.byteOffset!==offset||!positive(p.utf8Bytes)||p.utf8Bytes>2097152||!hashV1(p.contentHash))return fail('NORMAL_INSTRUCTION_SOURCE_INVALID');offset+=p.utf8Bytes;if(offset>raw.sourceBytes)return fail('NORMAL_INSTRUCTION_SOURCE_INVALID');}if(offset!==raw.sourceBytes)return fail('NORMAL_INSTRUCTION_SOURCE_INVALID');
 return cloneV1(raw) as unknown as Original;
}
/** 이 포트의 구현은 보호 원문/등록 계획을 같은 인증 거래에서 읽어야 한다. HTTP에 노출되지 않는다. */
export interface NormalInstructionOriginalSource{read(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand):Promise<Original>}
type Observation={fact:NormalInstructionFact;turnState:'IDLE'|'BUSY';stageRef:BudgetClaim['stageRef'];demand:BudgetClaim['demand'];checkedAt:string;expiresAt:string};
/** 저장 형식 판독은 현재 권위가 아니다. 보호 graph 조회와 함께 소비한다. */
export function readNormalInstructionRecord(raw:unknown,scope:NormalInstructionScope){
 try{
  if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!recordV1(raw.snapshot,['transport','state','scope','requestHash','currentBinding','reservationRef','reason','queuedAt','expiresAt','executionAuthorized','dispatchPerformed','request','envelope'])||Buffer.byteLength(canonicalJson(raw))>2097152)throw Error();
  const s=raw.snapshot,b=s.currentBinding;
  if(s.transport!=='NORMAL_PROTECTED'||s.state!=='NORMAL_INSTRUCTION_QUEUED'||!same(s.scope,scope)||s.executionAuthorized!==false||s.dispatchPerformed!==false||!refV1(s.reservationRef)||s.reservationRef.version!==1||!isoV1(s.queuedAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.queuedAt)||Date.parse(s.expiresAt)>Date.parse(s.queuedAt)+30000||!recordV1(b,['transport','scope','grantRef','grantKind','grantState','grantExpiresAt','grantSubject','grantAllowedOperations','sessionBindingRef','instructionRef','partsRef','materialManifestRef','turnState','fact','parentStart']))throw Error();
  if(b.transport!=='NORMAL_PROTECTED'||!same(b.scope,scope)||b.grantKind!=='EXECUTION'||b.grantState!=='ACTIVE'||b.turnState!=='IDLE'||!isoV1(b.grantExpiresAt)||Date.parse(s.expiresAt)>Date.parse(b.grantExpiresAt)||!same(b.grantAllowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||![b.grantRef,b.sessionBindingRef,b.instructionRef,b.partsRef,b.materialManifestRef].every(refV1)||!recordV1(b.parentStart,['commandRef','envelopeHash','authorizationReceiptRef'])||!refV1(b.parentStart.commandRef)||b.parentStart.commandRef.version!==1||!refV1(b.parentStart.authorizationReceiptRef)||!hashV1(b.parentStart.envelopeHash))throw Error();
  const request=readNormalInstructionRequest(s.request),p=request.payload,f=readNormalInstructionFact({...b.fact,checkedAt:s.queuedAt}),e=readDispatchEnvelopeV1(s.envelope,Date.parse(s.queuedAt)),i=f.intent;
  if(!same(b.fact,(({checkedAt:_,...rest})=>rest)(f))||!same(f.subject,b.grantSubject)||f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.writerState!=='OWNED'||executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||Object.values(f.expires).some(v=>Date.parse(v)<Date.parse(s.expiresAt))||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT'))throw Error();
  if(request.projectId!==scope.projectId||request.targetId!==scope.executionId||request.expectedVersion!==scope.executionGeneration||request.clientId!==f.subject.clientId||request.controlGeneration!==f.subject.controlGeneration||s.requestHash!==hash(request)||s.reason!==p.reason||!same(p.grantRef,b.grantRef)||!same(p.sessionBindingRef,b.sessionBindingRef)||!same(p.sessionBindingRef,f.agentSession.sessionRef)||!same(p.instructionRef,b.instructionRef)||!same(p.partsRef,b.partsRef)||!same(p.permissionPolicyRef,f.permissionPolicyRef)||!same(p.budgetPolicyRef,i.budgetPolicyRef)||s.reservationRef.id===f.budgetReservationRef.id)throw Error();
  const {request:_,envelope:__,...intent}=s;
  if(raw.ref.contentHash!==hash(intent)||e.operation!=='SEND_INSTRUCTION'||e.commandId!==request.commandId||e.issuedAt!==s.queuedAt||e.expiresAt!==s.expiresAt||!same(e.executorRegistrationRef,f.registration.ref)||!same(e.payload,{sessionBindingRef:p.sessionBindingRef,instructionRef:p.instructionRef,partsRef:p.partsRef})||!same(e.context,{projectId:scope.projectId,assignmentId:i.assignmentRef.id,executionId:scope.executionId,executionGeneration:scope.executionGeneration,connectionRef:i.connectionRef,environmentRef:i.environmentRef,authorizationReceiptRef:e.context.authorizationReceiptRef,capabilityRef:i.capabilityRef,budgetRef:s.reservationRef,sourceScopes:i.sourceScopes})||same(e.context.authorizationReceiptRef,b.parentStart.authorizationReceiptRef))throw Error();
  return cloneV1(raw) as {ref:Ref;snapshot:typeof s};
 }catch{return fail('NORMAL_INSTRUCTION_RECORD_INVALID',503);}
}

export class NormalInstructionCommands {
 readonly #access:AccessRepository;readonly #options:NormalInstructionOptions;readonly #observe:NormalInstructionCurrentSource['observe']|undefined;
 readonly #original:NormalInstructionOriginalSource;readonly #read:NormalInstructionOriginalSource['read'];readonly #policies:Pick<ProjectLimitPolicies,'resolveCurrent'>;
 constructor(access:AccessRepository,options:NormalInstructionOptions,original:NormalInstructionOriginalSource,policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()){
  this.#access=access;this.#options=readNormalInstructionOptions(options);this.#observe=this.#options.current?.observe;this.#original=original;this.#read=original.read;this.#policies=policies;
 }
 #ports(){if(!this.#options.current||!this.#observe||this.#options.current.observe!==this.#observe||this.#original.read!==this.#read)fail('NORMAL_INSTRUCTION_SOURCE_REQUIRED');}
 async #now(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('INSTRUCTION_QUEUE_CLOCK_INVALID',503);return at.getTime();}
 #human(actor:AuthenticatedIdentity,at:number){const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return fail('INSTRUCTION_QUEUE_HUMAN_REQUIRED');const end=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt));if(end<=at)fail('INSTRUCTION_QUEUE_HUMAN_EXPIRED');return end;}
 async #observeCurrent(scope:NormalInstructionScope,request:ProjectCommand,at:number):Promise<Observation>{
  this.#ports();const control=new AbortController(),started=performance.now(),end=started+2000;let timer:ReturnType<typeof setTimeout>|undefined;
  try{const p=request.payload;const raw:any=await Promise.race([this.#observe!.call(this.#options.current,Object.freeze(cloneV1({...scope,grantRef:p.grantRef,instructionRef:p.instructionRef,partsRef:p.partsRef})) as any,new Date(at).toISOString(),control.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AuthFailure('NORMAL_INSTRUCTION_CURRENT_TIMEOUT',503)),2000);})]);this.#ports();if(performance.now()>=end)fail('NORMAL_INSTRUCTION_CURRENT_TIMEOUT',503);
   if(!recordV1(raw,['fact','turnState','stageRef','demand','checkedAt','expiresAt'])||!['IDLE','BUSY'].includes(raw.turnState)||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>at+Math.floor(performance.now()-started)||at-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=at)return fail('NORMAL_INSTRUCTION_CURRENT_REQUIRED');
   const result=cloneV1(raw) as unknown as Observation;result.fact=readNormalInstructionFact(result.fact);return result;
  }finally{clearTimeout(timer);control.abort();}
 }
 async #grant(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,scope:NormalInstructionScope){
  const g=request.payload.grantRef as Ref,rows=(await db.query('SELECT g.*,c.id AS start_id,c.version AS start_version,c.content_hash AS start_hash,c.envelope_hash AS start_envelope_hash,c.snapshot_json AS start_snapshot FROM anvil.execution_grants g JOIN anvil.execution_commands c ON c.project_id=g.project_id AND c.created_command_id=g.command_id AND c.grant_id=g.id AND c.grant_version=g.version WHERE g.project_id=$1 AND g.execution_id=$2 AND g.generation=$3 AND g.id=$4 AND g.version=$5 AND anvil.normal_start_material_complete($1,g.command_id) LIMIT 2',[scope.projectId,scope.executionId,scope.executionGeneration,g.id,g.version])).rows;
  if(rows.length!==1)return fail('NORMAL_INSTRUCTION_START_PARENT_REQUIRED');const row=rows[0],s=row.snapshot_json,f=readNormalInstructionFact(s?.binding);
  if(row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.id!==g.id||Number(row.version)!==1||g.version!==1||row.content_hash!==g.contentHash||hash(s)!==g.contentHash||!recordV1(s,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed'])||s.transport!=='NORMAL_PROTECTED'||s.kind!=='EXECUTION'||s.state!=='GRANTED'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!same(s.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||s.factHash!==hash(f)||s.scopeDigest!==hash({binding:f,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt}))return fail('NORMAL_INSTRUCTION_GRANT_INVALID');
  const subject={userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession?.id,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration};
  if(!same(f.subject,subject)||!same(request.payload.sessionBindingRef,f.agentSession.sessionRef)||!same(request.payload.permissionPolicyRef,f.permissionPolicyRef)||!same(request.payload.budgetPolicyRef,f.intent.budgetPolicyRef))return fail('NORMAL_INSTRUCTION_SUBJECT_MISMATCH');
  const current=await readGrantCurrent(db,scope.projectId,f.registration.connectorId,scope.executionId,{grantRef:g,credentialGeneration:f.executionCredentialReservation.generation}),e=readDispatchEnvelopeV1(row.start_snapshot?.envelope,current.now.getTime());
  const {envelope:_,...startIntent}=row.start_snapshot;
  if(e.operation!=='START_SESSION'||e.envelopeHash!==row.start_envelope_hash||hash(startIntent)!==row.start_hash||Number(row.start_version)!==1||!uuidV1(row.start_id)||!same(startIntent.grantRef,g)||e.context.executionId!==scope.executionId||e.context.executionGeneration!==scope.executionGeneration||!same(e.executorRegistrationRef,f.registration.ref))return fail('NORMAL_INSTRUCTION_START_PARENT_REQUIRED');
  return {grant:s,fact:f,current,parentStart:{commandRef:{id:row.start_id,version:1,contentHash:row.start_hash},envelopeHash:e.envelopeHash,authorizationReceiptRef:e.context.authorizationReceiptRef} as Parent};
 }
 #checkObservation(o:Observation,original:NormalInstructionFact,at:number){
  const f=o.fact;if(!same(stableFact(f),stableFact(original))||f.writerState!=='OWNED'||Date.parse(o.checkedAt)>at||at-Date.parse(o.checkedAt)>30000||Date.parse(f.checkedAt)>at||at-Date.parse(f.checkedAt)>30000||Date.parse(o.expiresAt)<=at||Object.values(f.expires).some(v=>Date.parse(v)<=at)||executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT'))fail('NORMAL_INSTRUCTION_CURRENT_REQUIRED');
 }
 async command(token:string,csrf:string,value:ProjectCommand){
  const request=readNormalInstructionRequest(value),scope={projectId:request.projectId,executionId:request.targetId!,executionGeneration:request.expectedVersion},p=request.payload;
  try{
   // 외부 current 공급자는 인증/프로젝트 잠금과 연결을 반환한 뒤에만 호출한다.
   // 첫 거래의 권한은 저장 권한으로 이월하지 않고 두 번째 거래에서 전부 재검산한다.
   const prepared=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    this.#ports();await currentProjectController(db,actor,request);await db.query('SELECT id FROM anvil.projects WHERE id=$1::uuid FOR UPDATE',[scope.projectId]);
    const parent=await this.#grant(db,actor,request,scope);
    await authorizeRuntimePolicy(db,actor,request,{executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:p.permissionPolicyRef as Ref,budgetPolicyRef:p.budgetPolicyRef as Ref,sourceScopes:parent.fact.intent.sourceScopes},this.#policies);
    const at=await this.#now(db);this.#human(actor,at);return {parentStart:parent.parentStart,fact:parent.fact,at};
   });
   const observation=await this.#observeCurrent(scope,request,prepared.at);
   return await this.#access.authenticated(token,csrf,async(db,actor)=>{
   this.#ports();await currentProjectController(db,actor,request);await db.query('SELECT id FROM anvil.projects WHERE id=$1::uuid FOR UPDATE',[scope.projectId]);let at=await this.#now(db);this.#human(actor,at);
   const first=await this.#grant(db,actor,request,scope);at=await this.#now(db);
   if(at<prepared.at||!same(prepared.parentStart,first.parentStart)||!same(prepared.fact,first.fact))fail('NORMAL_INSTRUCTION_CURRENT_CHANGED');
   this.#checkObservation(observation,first.fact,at);
   const policyInput={executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:p.permissionPolicyRef as Ref,budgetPolicyRef:p.budgetPolicyRef as Ref,sourceScopes:first.fact.intent.sourceScopes};
   let policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.#policies);
   const original=readNormalInstructionOriginal(await this.#read.call(this.#original,db,actor,cloneV1(request)),request);this.#ports();
   const replay:any=await projectReplay(db,actor,request);
   if(replay!==undefined){
    const rows=(await db.query('SELECT * FROM anvil.normal_instruction_record($1,$2,$3,$4)',[scope.projectId,scope.executionId,scope.executionGeneration,request.commandId])).rows;
    if(rows.length!==1||rows[0].valid!==true||!same(rows[0].snapshot_json?.request,request)||!same(rows[0].original,original)||!same(rows[0].result_ref,replay))fail('NORMAL_INSTRUCTION_REPLAY_INVALID',503);
    const saved=readNormalInstructionRecord({ref:replay?.data?.ref,snapshot:rows[0].snapshot_json},scope),{request:_,envelope:__,...intent}=saved.snapshot;
    if(replay.status!=='APPLIED'||replay.projectId!==scope.projectId||replay.commandId!==request.commandId||replay.data.status!=='NORMAL_INSTRUCTION_QUEUE_STORED'||replay.data.executionAuthorized!==false||replay.data.dispatchPerformed!==false||!same(replay.data.snapshot,intent)||!same(saved.snapshot.currentBinding.parentStart,first.parentStart)||!same(stableFact({...saved.snapshot.currentBinding.fact,checkedAt:observation.checkedAt}),stableFact(first.fact)))fail('NORMAL_INSTRUCTION_REPLAY_INVALID',503);
    const last=await this.#grant(db,actor,request,scope);if(!same(last.parentStart,first.parentStart))fail('NORMAL_INSTRUCTION_CURRENT_CHANGED');await authorizeRuntimePolicy(db,actor,request,policyInput,this.#policies);const replayAt=await this.#now(db);this.#checkObservation(observation,first.fact,replayAt);this.#human(actor,replayAt);return replay;
   }
   await assertNoStoredExecutionStop(db,scope);if(observation.turnState!=='IDLE')fail('NORMAL_INSTRUCTION_BUSY');
   const claim=readExecutionBudgetClaim({...scope,commandId:request.commandId,assignmentRef:first.fact.intent.assignmentRef,stageRef:observation.stageRef,policyRef:p.budgetPolicyRef,operation:'SEND_INSTRUCTION',demand:observation.demand});
   const budgets=new ProjectExecutionBudget(),reservation=(await budgets.planReservation(db,actor,claim)).record;
   if(reservation.ref.version!==1||reservation.snapshot.state!=='RESERVED'||!same(reservation.snapshot.claim,claim)||same(reservation.ref,first.fact.budgetReservationRef))fail('NORMAL_INSTRUCTION_RESERVATION_INVALID');
   const next=await this.#grant(db,actor,request,scope),observed=observation;at=await this.#now(db);this.#checkObservation(observed,first.fact,at);
   if(!same(first.parentStart,next.parentStart)||!same(first.fact,next.fact)||observed.turnState!=='IDLE')fail('NORMAL_INSTRUCTION_CURRENT_CHANGED');
   policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.#policies);at=await this.#now(db);
   const until=Math.min(at+30000,this.#human(actor,at),policy.validUntil,first.current.deadline.getTime(),next.current.deadline.getTime(),Date.parse(observation.expiresAt),Date.parse(observed.expiresAt),...Object.values(observed.fact.expires).map(Date.parse));if(until<=at)fail('NORMAL_INSTRUCTION_EXPIRED');
   if(!same(original,await this.#read.call(this.#original,db,actor,cloneV1(request))))fail('NORMAL_INSTRUCTION_SOURCE_CHANGED');
   const manifestId=randomUUID(),manifestRefBase={id:manifestId,version:1};
   const manifest={schemaVersion:1,id:manifestId,sourceKind:'PROTECTED_INSTRUCTION_REFERENCE_V1',scope:{mode:'EXECUTION',...scope,connectorId:first.fact.registration.connectorId,grantRef:p.grantRef,credentialGeneration:first.fact.executionCredentialReservation.generation},commandId:request.commandId,source:(({parts:_,...s})=>s)(original),parts:original.parts.map(v=>({...v,materialId:randomUUID()})),expiresAt:new Date(until).toISOString()};
   const manifestRef={...manifestRefBase,contentHash:hash(manifest)},currentBinding={transport:'NORMAL_PROTECTED',scope,grantRef:p.grantRef,grantKind:'EXECUTION',grantState:'ACTIVE',grantExpiresAt:first.grant.expiresAt,grantSubject:first.fact.subject,grantAllowedOperations:first.grant.allowedOperations,sessionBindingRef:p.sessionBindingRef,instructionRef:p.instructionRef,partsRef:p.partsRef,materialManifestRef:manifestRef,turnState:'IDLE',fact:(({checkedAt:_,...rest})=>rest)(observed.fact),parentStart:first.parentStart};
   const intent={transport:'NORMAL_PROTECTED',state:'NORMAL_INSTRUCTION_QUEUED',scope,requestHash:hash(request),currentBinding,reservationRef:reservation.ref,reason:p.reason,queuedAt:new Date(at).toISOString(),expiresAt:manifest.expiresAt,executionAuthorized:false,dispatchPerformed:false},ref={id:randomUUID(),version:1,contentHash:hash(intent)};
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'NORMAL_INSTRUCTION_QUEUE_STORED',snapshot:intent,executionAuthorized:false,dispatchPerformed:false},policy.policyRef,'EXPLICIT_NORMAL_INSTRUCTION_QUEUE'),f=first.fact,i=f.intent;
   const unsigned={schemaVersion:1,commandId:request.commandId,issuedAt:intent.queuedAt,expiresAt:intent.expiresAt,executorRegistrationRef:f.registration.ref,context:{projectId:scope.projectId,assignmentId:i.assignmentRef.id,executionId:scope.executionId,executionGeneration:scope.executionGeneration,connectionRef:i.connectionRef,environmentRef:i.environmentRef,authorizationReceiptRef:receipt.authorizationReceiptRef,capabilityRef:i.capabilityRef,budgetRef:reservation.ref,sourceScopes:i.sourceScopes},operation:'SEND_INSTRUCTION',payload:{sessionBindingRef:p.sessionBindingRef,instructionRef:p.instructionRef,partsRef:p.partsRef}},envelope=readDispatchEnvelopeV1({...unsigned,envelopeHash:hash(unsigned)},at);
   await this.#append(db,scope,{ref,snapshot:{...intent,request,envelope}},reservation,manifest,receipt.id,first.grant.scopeDigest);
   const final=await this.#grant(db,actor,request,scope);at=await this.#now(db);this.#checkObservation(observation,first.fact,at);
   if(!same(first.parentStart,final.parentStart)||!same(first.fact,final.fact)||Date.parse(observation.expiresAt)<until||final.current.deadline.getTime()<until||!same(original,await this.#read.call(this.#original,db,actor,cloneV1(request))))fail('NORMAL_INSTRUCTION_CURRENT_CHANGED');
   const identity=await this.#access.authenticateInTransaction(db,token,csrf);if(identity.actorId!==actor.actorId||identity.clientId!==actor.clientId||identity.credentialGeneration!==actor.credentialGeneration||identity.authSession?.id!==actor.authSession?.id)fail('NORMAL_INSTRUCTION_CURRENT_CHANGED');
   await currentProjectController(db,identity,request);const lastPolicy=await authorizeRuntimePolicy(db,identity,request,policyInput,this.#policies);at=await this.#now(db);this.#ports();if(at>=Math.min(until,this.#human(identity,at))||lastPolicy.validUntil<until)fail('NORMAL_INSTRUCTION_EXPIRED');return receipt.result;
  });}catch(error){await recordProjectDenial(this.#access,token,request.projectId,error);throw error;}
 }
 async #append(db:PoolClient,scope:NormalInstructionScope,record:any,reservation:BudgetRecord,manifest:any,cid:string,scopeDigest:string){
  record=readNormalInstructionRecord(record,scope);
  const s=record.snapshot,e:DispatchEnvelopeV1=s.envelope,g=s.currentBinding.grantRef,gen=manifest.scope.credentialGeneration;
   const quota=(await db.query("SELECT count(*)::int AS count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',id,'version',version,'contentHash',content_hash),'snapshot',snapshot_json)))),0)::bigint+COALESCE((SELECT sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',u.reservation_id,'version',u.version,'contentHash',u.content_hash),'snapshot',u.snapshot_json)))) FROM anvil.usage_reservations u WHERE u.project_id=$1 AND u.snapshot_json->'claim'->>'executionId'=$2::uuid::text AND u.snapshot_json->'claim'->>'executionGeneration'=$3::bigint::text AND u.snapshot_json->'claim'->>'operation'='SEND_INSTRUCTION'),0)::bigint AS total FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->>'state'='NORMAL_INSTRUCTION_QUEUED'",[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
  if(!quota||!Number.isSafeInteger(Number(quota.count))||Number(quota.count)<0||Number(quota.count)>=100||!Number.isSafeInteger(Number(quota.total))||Number(quota.total)<0||Number(quota.total)+Buffer.byteLength(canonicalJson(record))+Buffer.byteLength(canonicalJson(reservation))>2097152)fail('NORMAL_INSTRUCTION_LIMIT');
  const materialRows=(await db.query('SELECT count(*)::bigint AS project_count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(snapshot_json))),0)::bigint AS project_bytes,count(*) FILTER (WHERE grant_id=$2::uuid)::bigint AS grant_count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(snapshot_json))) FILTER (WHERE grant_id=$2::uuid),0)::bigint AS grant_bytes FROM (SELECT grant_id,snapshot_json FROM anvil.execution_material_manifests WHERE project_id=$1::uuid UNION ALL SELECT grant_id,snapshot_json FROM anvil.execution_materials WHERE project_id=$1::uuid UNION ALL SELECT grant_id,snapshot_json FROM anvil.execution_material_proof_bindings WHERE project_id=$1::uuid) all_rows',[scope.projectId,g.id])).rows;
  if(materialRows.length!==1)fail('NORMAL_INSTRUCTION_STORAGE_FAILED',503);const capacity=materialRows[0];
  const materialSnapshots=manifest.parts.map((part:any)=>({...scope,commandId:e.commandId,envelopeHash:e.envelopeHash,payloadRef:manifest.source.partsRef,sourceRef:manifest.source.sourceRef,partIndex:part.partIndex,partCount:manifest.parts.length,byteOffset:part.byteOffset,sourceBytes:manifest.source.sourceBytes,utf8Bytes:part.utf8Bytes,contentHash:part.contentHash,mediaType:manifest.source.mediaType}));
  assertMaterialCapacity({projectCount:Number(capacity.project_count),projectBytes:Number(capacity.project_bytes),grantCount:Number(capacity.grant_count),grantBytes:Number(capacity.grant_bytes)},1+materialSnapshots.length,Buffer.byteLength(canonicalJson(manifest))+materialSnapshots.reduce((n:number,v:any)=>n+Buffer.byteLength(canonicalJson(v)),0));
  const write=async(sql:string,args:unknown[])=>{if((await db.query(sql,args)).rowCount!==1)fail('NORMAL_INSTRUCTION_STORAGE_FAILED',503);};
  await write('INSERT INTO anvil.usage_reservations(project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[scope.projectId,reservation.ref.id,1,reservation.snapshot.sequence,s.request.commandId,reservation.ref.contentHash,JSON.stringify(reservation.snapshot),cid]);
  await write('INSERT INTO anvil.execution_commands(project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[scope.projectId,record.ref.id,1,scope.executionId,scope.executionGeneration,g.id,g.version,record.ref.contentHash,e.envelopeHash,JSON.stringify(s),JSON.stringify(e.context.authorizationReceiptRef),cid]);
  await write('INSERT INTO anvil.delivery_outbox(id,project_id,command_id,kind,destination_ref,payload_ref,state,scope_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),scope.projectId,cid,'EXECUTION_NORMAL',JSON.stringify({transport:'NORMAL_PROTECTED',registrationRef:e.executorRegistrationRef,executionId:scope.executionId,generation:scope.executionGeneration}),JSON.stringify({commandRef:record.ref,grantRef:g,envelopeHash:e.envelopeHash}),'PENDING',scopeDigest]);
  await write('INSERT INTO anvil.execution_material_manifests(project_id,id,version,execution_id,generation,grant_id,grant_version,credential_generation,command_id,created_command_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[scope.projectId,manifest.id,scope.executionId,scope.executionGeneration,g.id,g.version,gen,s.request.commandId,cid,hash(manifest),JSON.stringify(manifest)]);
  for(const [index,part]of manifest.parts.entries()){const material=materialSnapshots[index];
   await write('INSERT INTO anvil.execution_materials(project_id,id,version,manifest_id,execution_id,generation,grant_id,grant_version,credential_generation,command_id,command_record_id,created_command_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[scope.projectId,part.materialId,manifest.id,scope.executionId,scope.executionGeneration,g.id,g.version,gen,e.commandId,record.ref.id,cid,hash(material),JSON.stringify(material)]);
  }
 }
}

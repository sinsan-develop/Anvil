import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,hashV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {readExecutionIntentV1} from '../../../../contracts/runtime/execution-intent-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,projectReplay,persistProjectReceipt,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {ProjectExecutionPreparations} from './project-execution-preparations.ts';
import {ProjectContexts} from '../context/project-contexts.ts';
import {ProjectConnectionDefinitions} from '../connections/project-connection-definitions.ts';
import {ProjectEnvironments} from '../connections/project-environments.ts';
import {ProjectRegistrationReads} from '../connections/project-registration-reads.ts';
import {ResponsibleSessions} from '../assignments/responsible-sessions.ts';
import {compileExecutionPreparationOptions} from './preparation-input.ts';
import {authorizeRuntimePolicy} from './runtime-policy.ts';
import {ProjectExecutionBudget,readExecutionBudgetClaim} from './execution-budget.ts';

const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=(code='NORMAL_START_CURRENT_REQUIRED',status=412):never=>{throw new AuthFailure(code,status);};

type Readers={preparations:ProjectExecutionPreparations;contexts:ProjectContexts;definitions:ProjectConnectionDefinitions;
  environments:ProjectEnvironments;sessions:ResponsibleSessions;registrations:ProjectRegistrationReads};
type RequestScope={requestHash:string;transactionId:string;projectId:string;executionId:string;executionGeneration:number;
  preparationRef:Ref;contextBundleRef:Ref;actorId:string;clientId:string;humanSessionId:string;controlGeneration:number;credentialGeneration:number};
/** 서버가 구성한 보호 관측 공급자. HTTP에는 이 인터페이스나 관측 입력을 노출하지 않는다. */
export interface NormalExecutionCurrentSource {
  observe(scope:Readonly<RequestScope>,observedAt:string,signal:AbortSignal):Promise<unknown>;
}
async function boundedObservation(source:NormalExecutionCurrentSource,scope:RequestScope,observedAt:string){
  const controller=new AbortController(),timeoutMs=2000,until=performance.now()+timeoutMs;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const timeout=new Promise<never>((_,fail)=>{timer=setTimeout(()=>fail(new AuthFailure('NORMAL_START_OBSERVATION_TIMEOUT',503)),timeoutMs);});
    const result=await Promise.race([timeout,source.observe(Object.freeze(cloneV1(scope)),observedAt,controller.signal)]);
    if(performance.now()>=until)return reject('NORMAL_START_OBSERVATION_TIMEOUT',503);
    return result;
  }finally{clearTimeout(timer);controller.abort();}
}
function observationBinding(value:ReturnType<typeof requireObservation>){
  const {checkedAt,expiresAt,...binding}=value;
  return binding;
}
const categories=['basis','capability','source','osFence','storage','understanding'] as const;
function requireObservation(value:unknown,scope:RequestScope,now:number) {
  const v=cloneV1(value);
  if(!recordV1(v,['scope','registrationRef','checkedAt','expiresAt','writerState','stageRef','demand','checks','understandingReviewRef'])
    ||!same(v.scope,scope)||!refV1(v.registrationRef)||v.writerState!=='NONE'||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)
    ||Date.parse(v.checkedAt)>now||Date.parse(v.checkedAt)<now-30000||Date.parse(v.expiresAt)<=now
    ||!recordV1(v.checks,categories)||v.understandingReviewRef!==null&&!refV1(v.understandingReviewRef))return reject();
  for(const name of categories){
    const check=v.checks[name];
    if(!recordV1(check,['state','evidenceRefs'])||!Array.isArray(check.evidenceRefs)||check.evidenceRefs.length>200
      ||!check.evidenceRefs.every(refV1)||new Set(check.evidenceRefs.map(canonicalJson)).size!==check.evidenceRefs.length)return reject();
    if(name==='understanding'&&check.state==='NOT_REQUIRED'&&!check.evidenceRefs.length&&v.understandingReviewRef===null)continue;
    if(check.state!=='VERIFIED_CURRENT'||!check.evidenceRefs.length)return reject();
  }
  return v;
}
function checkedInput(request:ProjectCommand){
  const p=request.payload;
  if(request.operation!=='queueExecutionCommand'||request.targetId!==null||request.expectedVersion!==0||request.approvalRef!==null
    ||request.baselineRefs.length||!recordV1(p,['operation','executionId','executionGeneration','preparationRef','permissionPolicyRef','budgetPolicyRef','payload'])
||p.operation!=='START_SESSION'||!uuidV1(p.executionId)||typeof p.executionGeneration!=='number'||!Number.isSafeInteger(p.executionGeneration)||p.executionGeneration<1
    ||!refV1(p.preparationRef)||!refV1(p.permissionPolicyRef)||!refV1(p.budgetPolicyRef)||!recordV1(p.payload,['contextBundleRef','optionsRef'])
    ||!refV1(p.payload.contextBundleRef)||!refV1(p.payload.optionsRef)||!same(p.preparationRef,p.payload.optionsRef)
    ||same(p.preparationRef,p.payload.contextBundleRef))return reject('NORMAL_START_INPUT_INVALID',422);
  return {executionId:p.executionId,executionGeneration:p.executionGeneration,preparationRef:p.preparationRef,permissionPolicyRef:p.permissionPolicyRef,
    budgetPolicyRef:p.budgetPolicyRef,payload:{contextBundleRef:p.payload.contextBundleRef,optionsRef:p.payload.optionsRef}};
}
async function clock(db:PoolClient) {
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return reject('NORMAL_START_CLOCK_INVALID',503);
  return at;
}
async function xid(db:PoolClient){
  const value=(await db.query('SELECT txid_current()::text AS transaction_id')).rows[0]?.transaction_id;
  if(typeof value!=='string'||!(/^[1-9][0-9]*$/).test(value))return reject();
  return value;
}
async function protectedBasis(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,
  readers:Readers,p:ReturnType<typeof checkedInput>){
  const pid=request.projectId,query=db.query;
  const {preparation:prep,assignment,binding}=await readers.preparations.readStartOriginSources(db,actor,pid,p.preparationRef,'FRESH',
    async()=>{if(db.query!==query)return reject();});
  const {connectionKind,optionsFormat,...raw}=prep.snapshot.intent;
  const intent=readExecutionIntentV1(raw);
  if(prep.projectId!==pid||!same(prep.ref,p.preparationRef)||digest(prep.snapshot)!==prep.ref.contentHash||connectionKind!=='REGISTERED_DEFINITION'
    ||intent.projectId!==pid||!same(intent.contextBundleRef,p.payload.contextBundleRef)||!same(intent.budgetPolicyRef,p.budgetPolicyRef)
    ||!same(prep.snapshot.preparedBy,{kind:'HUMAN',userId:actor.actorId}))return reject();
  const task=assignment.snapshot.definition.taskRef;
  const def=await readers.definitions.read(db,actor,pid,intent.connectionRef.id,intent.connectionRef.version);
  const env=await readers.environments.read(db,actor,pid,intent.environmentRef.id,intent.environmentRef.version);
  const opt=compileExecutionPreparationOptions(def.definition);
  if(!same(binding.ref,intent.roleBindingRef)||!same(binding.snapshot.assignmentRef,intent.assignmentRef)||!same(binding.snapshot.connectionRef,intent.connectionRef)
    ||!same(def.ref,intent.connectionRef)||!same(def.definition.environmentRef,intent.environmentRef)||!def.currentStatus.configurationCurrent
    ||!same(env.ref,intent.environmentRef)||env.current.configurationCurrentness!=='MATCHED'||optionsFormat!==opt.format||!same(opt,prep.snapshot.options))return reject();
  const ctx=await readers.contexts.readStartSource(db,actor,pid,intent.contextBundleRef);
  const body=startContextBody(ctx,intent);
  if(Buffer.byteLength(body)+opt.utf8Bytes>2097152||opt.utf8Bytes<1)return reject();
  const host=env.snapshot.executionHostRef;
  if(host.kind!=='CONNECTOR_STATUS')return reject();
  return {intent,host,stageRef:{applicationRef:task.applicationRef,nodeId:task.nodeId},sessionRef:binding.snapshot.sessionRef,bindingGeneration:binding.snapshot.generation,basisRefs:prep.snapshot.basisRefs,latestInstructionRefs:prep.snapshot.latestInstructionRefs,
    materials:[{kind:'CONTEXT_BUNDLE',ref:ctx.ref,contentHash:contentHash(body),bytes:Buffer.byteLength(body)},
      {kind:'START_OPTIONS',ref:prep.ref,contentHash:opt.contentHash,bytes:opt.utf8Bytes}]};
}
type StartContext=Awaited<ReturnType<ProjectContexts['readStartSource']>>;
/** 보호 reader가 돌려준 맥락에서 START 자료 원문을 만든다. 최초 등록과 이후 자료 전달이 같은 bytes를 내도록 한곳에 둔다.
 * 이 함수는 접근 권한이나 전달 허가를 만들지 않는다. */
export function startContextBody(ctx:StartContext,intent:{contextBundleRef:Ref;assignmentRef:Ref}):string{
  if(!same(ctx.ref,intent.contextBundleRef)||!same(ctx.manifest.assignmentRef,intent.assignmentRef)||!ctx.prepared.parts.length)return reject();
  const items=ctx.manifest.items.map(item=>{
    const bound=ctx.manifest.sourceBindings.find(b=>b.itemId===item.itemId);
    if(!bound?.bodyRef||!bound.selection||item.issue||item.includedState!=='INCLUDED')return reject();
    const parts=ctx.manifest.deliveryPlan.parts.filter(v=>v.itemId===item.itemId).map(v=>{
      const t=ctx.prepared.parts.find(x=>x.partId===v.partId&&x.itemId===item.itemId);
      if(!t||t.utf8Bytes!==v.utf8Bytes||t.contentHash!==v.contentHash||!t.text.length
        ||Buffer.byteLength(t.text)!==v.utf8Bytes||contentHash(t.text)!==v.contentHash)return reject();
      return {partId:v.partId,order:v.order,byteOffset:v.byteOffset,utf8Bytes:v.utf8Bytes,contentHash:v.contentHash,text:t.text};
    });
    if(!parts.length)return reject();
    return {itemId:item.itemId,category:item.category,sourceRef:item.sourceRef,selection:bound.selection,bodyRef:bound.bodyRef,
      sourceState:bound.sourceState,includedState:item.includedState,reason:item.reason,parts};
  });
  return canonicalJson({schemaVersion:1,purpose:'START_CONTEXT_BODY_V1',contextBundleRef:ctx.ref,assignmentRef:intent.assignmentRef,
    budgetRef:ctx.manifest.budgetRef,baselineRefs:ctx.manifest.baselineRefs,constitutionRef:ctx.manifest.constitutionRef,items,
    ready:false,executionAuthorized:false,dispatchPerformed:false});
}
const PRESENT='NORMAL_PROTECTED';
/** 보호 source와 저장소 reader는 서버 조립 때만 받는다. 읽기 성공이나 등록 자체는 실행 정책을 발급하지 않는다. */
export class NormalInitialExecution {
  #source:NormalExecutionCurrentSource;
  #access:AccessRepository;
  #readers:Readers;
  constructor(access:AccessRepository,readers:Readers,source:NormalExecutionCurrentSource){
    if(typeof source?.observe!=='function')reject('NORMAL_START_SOURCE_REQUIRED');
    this.#source=source;this.#access=access;this.#readers=readers;
  }
  async command(token:string,csrf:string,value:ProjectCommand){
    const request=cloneV1(value),p=checkedInput(request),pid=request.projectId;
    try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
      const auth=actor.authSession;
      if(!auth||!isoV1(auth.idleExpiresAt)||!isoV1(auth.absoluteExpiresAt))return reject();
      await currentProjectController(db,actor,request);
      const scope:RequestScope={requestHash:digest(request),transactionId:await xid(db),projectId:pid,
        executionId:p.executionId,executionGeneration:p.executionGeneration,preparationRef:p.preparationRef,
        contextBundleRef:p.payload.contextBundleRef,actorId:actor.actorId,clientId:actor.clientId,humanSessionId:auth.id,
        controlGeneration:request.controlGeneration,credentialGeneration:actor.credentialGeneration};
      const read=()=>protectedBasis(db,actor,request,this.#readers,p),basis=await read(),{intent}=basis;
      const policyArgs={executionId:p.executionId,executionGeneration:p.executionGeneration,
        permissionPolicyRef:p.permissionPolicyRef,budgetPolicyRef:p.budgetPolicyRef,sourceScopes:intent.sourceScopes};
      const policies=async()=>[await authorizeRuntimePolicy(db,actor,{...request,operation:'authorizeExecution'},policyArgs),
        await authorizeRuntimePolicy(db,actor,request,policyArgs)];
      await policies();
      const replay=await projectReplay(db,actor,request);
      if(replay!==undefined){
        if(replay.data?.status!=='NORMAL_QUEUE_STORED'||replay.data?.snapshot?.transport!==PRESENT)return reject('IDEMPOTENCY_CONFLICT',409);
        return replay;
      }
      if((await db.query('SELECT id FROM anvil.writer_claims WHERE project_id=$1 AND reclaimed_at IS NULL',[pid])).rows.length)return reject('EXECUTION_WRITER_UNAVAILABLE',409);
      if((await db.query('SELECT id FROM anvil.executions WHERE project_id=$1 AND id=$2',[pid,p.executionId])).rows.length)return reject('EXECUTION_ALREADY_EXISTS',409);
      const originalQuery=db.query;
      const checkTx=async()=>{if(db.query!==originalQuery||await xid(db)!==scope.transactionId||db.query!==originalQuery)return reject();};
      const observe=async()=>{
        await checkTx();
        const sampled=await clock(db);
        const raw=await boundedObservation(this.#source,scope,sampled.toISOString());
        return requireObservation(raw,scope,(await clock(db)).getTime());
      };
      const first=await observe(),obs=first.checks;
      const includes=(name:string,refs:Ref[])=>refs.every(ref=>obs[name].evidenceRefs.some((r:Ref)=>same(r,ref)));
      if(!includes('capability',[intent.capabilityRef])||!includes('source',intent.sourceScopes.map(s=>s.observationRef))
        ||!same(first.stageRef,basis.stageRef)||!same(first.registrationRef,basis.host.registrationRef)
        ||!includes('basis',basis.basisRefs)||!basis.basisRefs.length
        ||intent.mode==='WORK'&&(!refV1(first.understandingReviewRef)||!includes('understanding',[first.understandingReviewRef]))
        ||intent.mode==='CONTEXT_REVIEW'&&intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ')))return reject();
      const readRegistration=async()=>{
        const reg=await this.#readers.registrations.read(db,actor,pid,first.registrationRef.id);
        if(!same(reg.connectorRef,basis.host.connectorRef)||!same(reg.registrationRef,first.registrationRef)||!reg.basis.current||reg.state!=='ISSUED'||reg.connectorState!=='TRUSTED'
          ||reg.revokedAt!==null||reg.credential.status!=='ACTIVE_STATUS_ONLY'||!reg.credential.expiresAt||!isoV1(reg.credential.expiresAt)
          ||!hashV1(reg.observedHostFingerprint)||reg.observedHostFingerprint!==reg.expectedHostFingerprint)return reject();
        return {registration:{ref:reg.registrationRef,connectorId:reg.connectorRef.id,generation:reg.connectorRef.version,
          hostPublicKeyFingerprint:reg.observedHostFingerprint},until:Math.min(Date.parse(reg.expiresAt),Date.parse(reg.credential.expiresAt))};
      };
      const reg=await readRegistration();
      const claim=readExecutionBudgetClaim({projectId:pid,executionId:p.executionId,executionGeneration:p.executionGeneration,
        commandId:request.commandId,assignmentRef:intent.assignmentRef,stageRef:first.stageRef,policyRef:p.budgetPolicyRef,operation:'START_SESSION',demand:first.demand});
      const budgets=new ProjectExecutionBudget(),{record:b}=await budgets.planReservation(db,actor,claim);
      if(b.snapshot.sequence!==1)return reject('NORMAL_INITIAL_BUDGET_HISTORY_UNSUPPORTED');
      let priorAt=Date.parse(first.checkedAt);
      const inspect=async()=>{
        await checkTx();
        if(!same(basis,await read())||!same(reg,await readRegistration()))return reject();
        const current=await observe();
        if(!same(observationBinding(first),observationBinding(current))||Date.parse(current.checkedAt)<priorAt)return reject();
        priorAt=Date.parse(current.checkedAt);
        return current;
      };
      const latest=await inspect();
      const [allow,queue]=await policies(),at=await clock(db);
      const current=requireObservation(latest,scope,at.getTime());
      const expires={humanSession:new Date(Math.min(Date.parse(auth.idleExpiresAt),Date.parse(auth.absoluteExpiresAt))).toISOString(),
        permissionPolicy:new Date(Math.min(allow!.validUntil,queue!.validUntil)).toISOString(),budget:new Date(queue!.validUntil).toISOString(),
        registration:new Date(reg.until).toISOString(),automaticScope:new Date(Math.min(Date.parse(first.expiresAt),Date.parse(current.expiresAt))).toISOString()};
      const until=Math.min(at.getTime()+7200000,...Object.values(expires).map(Date.parse));
      if(until<=at.getTime())return reject();
      const expiresAt=new Date(until).toISOString(),verified=(evidenceRefs:Ref[])=>({state:'VERIFIED_CURRENT',evidenceRefs});
      // 최초 grant마다 실행 전용 세대 1을 예약한다. 재발급이나 token 발행은 여기서 수행하지 않는다.
      const executionCredentialReservation={id:randomUUID(),generation:1};
      const fact={schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:PRESENT,projectId:pid,executionId:p.executionId,
        executionGeneration:p.executionGeneration,subject:{userId:actor.actorId,clientId:actor.clientId,humanSessionId:auth.id,
          controlGeneration:request.controlGeneration,credentialGeneration:actor.credentialGeneration},
        agentSession:{sessionRef:basis.sessionRef,roleBindingRef:intent.roleBindingRef,bindingGeneration:basis.bindingGeneration},executionCredentialReservation,
        registration:reg.registration,intent,preparationRef:p.preparationRef,permissionPolicyRef:p.permissionPolicyRef,budgetReservationRef:b.ref,
        basisRefs:basis.basisRefs,latestInstructionRefs:basis.latestInstructionRefs,understandingReviewRef:first.understandingReviewRef,
        checks:{...obs,subject:verified([p.permissionPolicyRef]),session:verified([intent.roleBindingRef]),registration:verified([reg.registration.ref]),
          permissionPolicy:verified([p.permissionPolicyRef]),context:verified([intent.contextBundleRef]),budget:verified([b.ref])},
        writerState:current.writerState,checkedAt:current.checkedAt,expires,executionAuthorized:false,dispatchPerformed:false};
      const allowedOperations=['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'],scopeDigest=digest({binding:fact,allowedOperations,expiresAt});
      const grant={kind:'EXECUTION',state:'GRANTED',transport:PRESENT,binding:fact,allowedOperations,expiresAt,scopeDigest,
        factHash:digest(fact),plannedAt:at.toISOString(),executionAuthorized:false,dispatchPerformed:false};
      const grantRef={id:randomUUID(),version:1,contentHash:digest(grant)};
      const q={transport:PRESENT,state:'QUEUED',executionId:p.executionId,executionGeneration:p.executionGeneration,grantRef,
        reservationRef:b.ref,executorRegistrationRef:reg.registration.ref,operation:'START_SESSION',payload:p.payload,humanSessionId:auth.id,
        sourceScopes:intent.sourceScopes,budgetPolicyRef:p.budgetPolicyRef,queuedAt:at.toISOString(),executionAuthorized:false,dispatchPerformed:false};
      const ref={id:randomUUID(),version:1,contentHash:digest(q)},receipt=await persistProjectReceipt(db,actor,request,ref,{
        status:'NORMAL_QUEUE_STORED',snapshot:q,executionAuthorized:false,dispatchPerformed:false},queue!.policyRef,'EXPLICIT_NORMAL_QUEUE');
      const unsigned={schemaVersion:1,commandId:request.commandId,issuedAt:q.queuedAt,expiresAt,executorRegistrationRef:reg.registration.ref,
        context:{projectId:pid,assignmentId:intent.assignmentRef.id,executionId:p.executionId,executionGeneration:p.executionGeneration,
          connectionRef:intent.connectionRef,environmentRef:intent.environmentRef,authorizationReceiptRef:receipt.authorizationReceiptRef,
          capabilityRef:intent.capabilityRef,budgetRef:b.ref,sourceScopes:intent.sourceScopes},operation:'START_SESSION',payload:p.payload};
      const envelope=readDispatchEnvelopeV1({...unsigned,envelopeHash:digest(unsigned)},at.getTime());
      const {id:cid}=receipt,eid=p.executionId,gen=p.executionGeneration;
      await db.query('INSERT INTO anvil.executions(project_id,id,generation,transport,state,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [pid,eid,gen,PRESENT,q.state,actor.actorId,actor.clientId,cid]);
      await db.query('INSERT INTO anvil.execution_grants(project_id,id,version,execution_id,generation,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [pid,grantRef.id,1,eid,gen,grantRef.contentHash,JSON.stringify(grant),actor.actorId,actor.clientId,cid]);
      const credential={transport:PRESENT,state:'RESERVED_NO_TOKEN',grantRef,executionId:eid,executionGeneration:gen,
        credentialGeneration:executionCredentialReservation.generation,registrationRef:reg.registration.ref,
        commandId:request.commandId,scopeDigest,reservedAt:q.queuedAt,expiresAt,credentialIssued:false};
      await db.query('INSERT INTO anvil.execution_credentials(project_id,id,version,grant_id,grant_version,credential_generation,content_hash,snapshot_json) VALUES($1,$2,1,$3,1,$4,$5,$6)',
        [pid,executionCredentialReservation.id,grantRef.id,executionCredentialReservation.generation,digest(credential),JSON.stringify(credential)]);
      await db.query('INSERT INTO anvil.usage_reservations(project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [pid,b.ref.id,b.ref.version,b.snapshot.sequence,request.commandId,b.ref.contentHash,JSON.stringify(b.snapshot),cid]);
      await db.query('INSERT INTO anvil.writer_claims(project_id,id,execution_id,generation,grant_id,grant_version,scope_json,expires_at,ownership_state,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [pid,randomUUID(),eid,gen,grantRef.id,1,JSON.stringify(intent.sourceScopes),expiresAt,'RESERVED',cid]);
      await db.query('INSERT INTO anvil.execution_commands(project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [pid,ref.id,1,eid,gen,grantRef.id,1,ref.contentHash,envelope.envelopeHash,JSON.stringify({...q,envelope}),JSON.stringify(receipt.authorizationReceiptRef),cid]);
      await db.query('INSERT INTO anvil.delivery_outbox(id,project_id,command_id,kind,destination_ref,payload_ref,state,scope_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [randomUUID(),pid,cid,'EXECUTION_NORMAL',JSON.stringify({transport:PRESENT,registrationRef:reg.registration.ref,executionId:eid,generation:gen}),
          JSON.stringify({commandRef:ref,grantRef,envelopeHash:envelope.envelopeHash}),'PENDING',scopeDigest]);
      const groups=basis.materials.map(m=>({kind:m.kind,payloadRef:m.ref,source:{sourceRef:m.ref,bodyRef:m.ref,originRef:m.ref,
        contentHash:m.contentHash,sourceBytes:m.bytes,mediaType:'application/json'},
        parts:[{materialId:randomUUID(),partIndex:1,byteOffset:0,utf8Bytes:m.bytes,contentHash:m.contentHash}]}));
      const manifest={schemaVersion:1,purpose:'START_CONTEXT_OPTIONS_MATERIAL_V1',id:randomUUID(),sourceKind:'PROTECTED_START_REFERENCE_V1',
        scope:{mode:'EXECUTION',projectId:pid,connectorId:reg.registration.connectorId,executionId:eid,executionGeneration:gen,grantRef,
          credentialGeneration:executionCredentialReservation.generation},commandId:request.commandId,payload:p.payload,groups,expiresAt};
      await db.query('INSERT INTO anvil.execution_material_manifests(project_id,id,version,execution_id,generation,grant_id,grant_version,credential_generation,command_id,created_command_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [pid,manifest.id,eid,gen,grantRef.id,1,executionCredentialReservation.generation,request.commandId,cid,digest(manifest),JSON.stringify(manifest)]);
      for(const group of groups){
        const part=group.parts[0]!,material={projectId:pid,executionId:eid,executionGeneration:gen,commandId:request.commandId,envelopeHash:envelope.envelopeHash,
          payloadRef:group.payloadRef,sourceRef:group.source.sourceRef,partIndex:1,partCount:1,byteOffset:0,sourceBytes:group.source.sourceBytes,
          utf8Bytes:part.utf8Bytes,contentHash:part.contentHash,mediaType:'application/json'};
        await db.query('INSERT INTO anvil.execution_materials(project_id,id,version,manifest_id,execution_id,generation,grant_id,grant_version,credential_generation,command_id,command_record_id,created_command_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
          [pid,part.materialId,manifest.id,eid,gen,grantRef.id,1,executionCredentialReservation.generation,request.commandId,ref.id,cid,digest(material),JSON.stringify(material)]);
      }
      const reserved=(await db.query('SELECT id,credential_generation,content_hash FROM anvil.execution_credentials WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND credential_generation=$4 AND anvil.normal_credential_reservation_valid($1,$2,$3) AND snapshot_json->\'grantRef\'->>\'contentHash\'=$5',[pid,grantRef.id,grantRef.version,executionCredentialReservation.generation,grantRef.contentHash])).rows;
      if(reserved.length!==1||reserved[0]?.id!==executionCredentialReservation.id||Number(reserved[0].credential_generation)!==executionCredentialReservation.generation
        ||reserved[0].content_hash!==digest(credential))return reject('NORMAL_CREDENTIAL_RESERVATION_MISMATCH');
      const identity=await this.#access.authenticateInTransaction(db,token,csrf);
      if(identity.actorId!==scope.actorId||identity.clientId!==scope.clientId||identity.credentialGeneration!==scope.credentialGeneration
        ||identity.authSession?.id!==scope.humanSessionId||Math.min(Date.parse(identity.authSession.idleExpiresAt),Date.parse(identity.authSession.absoluteExpiresAt))<until)return reject();
      await currentProjectController(db,identity,request);
      const finalPolicies=await policies();
      if(finalPolicies.some(v=>!v||!same(v.policyRef,p.permissionPolicyRef)||!same(v.budgetPolicyRef,p.budgetPolicyRef)||v.validUntil<until))return reject();
      const currentBudget=await budgets.checkDelivery(db,identity,pid,b.ref);
      if(!same(currentBudget.record,b))return reject();
      const final=await inspect();
      await checkTx();
      const closingTime=(await clock(db)).getTime();
      requireObservation(final,scope,closingTime);
      if(Date.parse(final.expiresAt)<until||closingTime>=until)return reject();
      return receipt.result;
    });}catch(error){await recordProjectDenial(this.#access,token,pid,error);throw error;}
  }
}

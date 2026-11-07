import {currentOriginReuseStartLease,readOriginReuseStartBasis} from './execution-start-origin-reuse.ts';
import type {PoolClient} from 'pg';
import {types} from 'node:util';
import {contentHash} from '../../../../contracts/canonical.ts';
import {readExecutionIntentV1} from '../../../../contracts/runtime/execution-intent-v1.ts';
import {recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,projectMember,type ProjectCommand} from '../access/project-command.ts';
import {readExecutionBudgetClaim} from './execution-budget.ts';
import {copyStartOrigin,originActor,originFailure,originSame} from './execution-start-origin-input.ts';
import {ExecutionStartOriginSources,type OriginLifetimeObservation} from './execution-start-origin-sources.ts';
import {ExecutionStartOriginStore} from './execution-start-origin-store.ts';
import {readExecutionPreparationInput} from './preparation-input.ts';

type Ports=ConstructorParameters<typeof ExecutionStartOriginSources>[0];
type Call={expiresAt:number;signal?:AbortSignal};
const readStored=ExecutionStartOriginStore.prototype.read;
const readSource=ExecutionStartOriginSources.prototype.load;
const getAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted')!.get!;
const invalid=()=>originFailure('EXECUTION_QUEUE_INPUT_INVALID',422);
const mismatch=()=>originFailure('EXECUTION_BASIS_MISMATCH',409);
const currentRequired=()=>originFailure('EXECUTION_START_ORIGIN_CURRENT_REQUIRED',412);
const disconnected=()=>originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);

function readStartRequest(raw:unknown,reuse=false){
  const request=copyStartOrigin(raw);
  if(!recordV1(request,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
    ||request.schemaVersion!==1||!uuidV1(request.projectId)||!uuidV1(request.commandId)||!uuidV1(request.clientId)
    ||!Number.isSafeInteger(request.controlGeneration)||Number(request.controlGeneration)<1
    ||request.operation!=='queueExecutionCommand'||request.targetId!==null||request.expectedVersion!==0
    ||!Array.isArray(request.baselineRefs)||request.baselineRefs.length!==0)return invalid();
  const payload=request.payload;
  if(!recordV1(payload,['preparationRef','executionId','executionGeneration','permissionPolicyRef','budgetPolicyRef','operation','payload',...(reuse?['originReuse']:[])])
    ||!uuidV1(payload.executionId)||!Number.isSafeInteger(payload.executionGeneration)||Number(payload.executionGeneration)<1
    ||!refV1(payload.preparationRef)||!refV1(payload.permissionPolicyRef)||!refV1(payload.budgetPolicyRef)
    ||payload.operation!=='START_SESSION'||!recordV1(payload.payload,['contextBundleRef','optionsRef'])
    ||!refV1(payload.payload.contextBundleRef)||!refV1(payload.payload.optionsRef))return invalid();
  return {request:request as unknown as ProjectCommand,payload};
}

function signalAborted(signal:AbortSignal):boolean{
  let value:unknown;
  try{value=Reflect.apply(getAborted,signal,[]);}catch{return invalid();}
  if(typeof value!=='boolean')return invalid();
  return value;
}
function readCall(raw:Call){
  if(!raw||typeof raw!=='object'||types.isProxy(raw))return invalid();
  const descriptors=Object.getOwnPropertyDescriptors(raw);
  if(Reflect.ownKeys(descriptors).some(k=>k!=='signal'&&k!=='expiresAt'))return invalid();
  const expiry=descriptors.expiresAt;
  const abort=descriptors.signal;
  if(!expiry||!('value'in expiry)||!Number.isSafeInteger(expiry.value)
    ||abort&&!('value'in abort))return invalid();
  const signal=abort?.value as AbortSignal|undefined;
  if(signal!==undefined){
    if(types.isProxy(signal))return invalid();
    signalAborted(signal);
  }
  return {expiresAt:expiry.value as number,signal};
}

/** 기존 합성 START 호출의 읽기 전용 basis. 호출자가 같은 트랜잭션의 수명을 소유한다. */
export async function readOriginStartQueueBasis(
  db:PoolClient,actor:AuthenticatedIdentity,rawRequest:unknown,rawSelection:unknown,rawDemand:unknown,ports:Ports,rawCall:Call,
){
  const {expiresAt,signal}=readCall(rawCall);
  let wall=Date.now();
  let mark=performance.now();
  let until=mark+expiresAt-wall;
  const original=copyStartOrigin<ProjectCommand>(rawRequest),reuseLease=currentOriginReuseStartLease(db,actor,original);
  const {request,payload}=readStartRequest(original,!!reuseLease);
  if(reuseLease){if(!originSame(rawSelection,(request.payload as any).originReuse))return mismatch();return readOriginReuseStartBasis(reuseLease,db,actor,request,copyStartOrigin(rawDemand));}
  const selection=copyStartOrigin(rawSelection);
  const demand=copyStartOrigin(rawDemand);
  if(!recordV1(selection,['originRef','reservationRef'])||!refV1(selection.originRef)||!refV1(selection.reservationRef))return invalid();
  if(!ports||types.isProxy(ports))return disconnected();

  const store=new ExecutionStartOriginStore();
  const sources=new ExecutionStartOriginSources(ports);
  const query=db.query;
  const identity=originActor(actor);
  const session=actor.authSession;
  if(!session||!uuidV1(session.id)||request.clientId!==actor.clientId)return currentRequired();
  const sessionUntil=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));
  let tx='';
  let lastDatabaseTime=-Infinity;

  function check(){
    const now=Date.now(),currentMark=performance.now();
    if(signal!==undefined&&signalAborted(signal)||db.query!==query||originActor(actor)!==identity
      ||!Number.isFinite(currentMark)||currentMark<mark||now<wall||currentMark>=until)currentRequired();
    if(Object.getOwnPropertyDescriptor(ExecutionStartOriginStore.prototype,'read')?.value!==readStored
      ||Object.getOwnPropertyDescriptor(ExecutionStartOriginSources.prototype,'load')?.value!==readSource)disconnected();
    wall=now;
    mark=currentMark;
  }
  function limit(observation:OriginLifetimeObservation){
    const {startedAt,observedAt,until:bound}=observation;
    if(![startedAt,observedAt,bound].every(Number.isFinite)||startedAt>performance.now()||observedAt<lastDatabaseTime)currentRequired();
    lastDatabaseTime=observedAt;
    until=Math.min(until,startedAt+bound-observedAt);
    check();
  }
  async function clock(){
    check();
    const startedAt=performance.now();
    const {rows}=await db.query('SELECT txid_current()::text AS transaction_id,clock_timestamp() AS observed_at');
    check();
    const row=rows.length===1?rows[0]:null;
    if(!(row?.observed_at instanceof Date)||typeof row.transaction_id!=='string'
      ||!/^[1-9][0-9]{0,18}$/.test(row.transaction_id)||tx&&row.transaction_id!==tx)return currentRequired();
    const observedAt=row.observed_at.getTime();
    if(!Number.isFinite(observedAt)||observedAt<lastDatabaseTime)return currentRequired();
    tx=row.transaction_id;
    lastDatabaseTime=observedAt;
    limit({startedAt,observedAt,until:sessionUntil});
    return {startedAt,observedAt};
  }
  async function requireReadPolicy(){
    const at=await clock();
    const policy=await authorizeMaterial(db,actor,{...request,operation:'readExecutionStartOrigins',approvalRef:null,payload:{}},true);
    check();
    if(policy.approvalRequired)originFailure('PROJECT_OPERATION_DENIED',403);
    limit({...at,until:policy.validUntil});
    return policy.ref;
  }

  await clock();
  const member=await projectMember(db,actor,request.projectId,true);
  check();
  if(member.participation!=='OWNER')originFailure('PROJECT_READ_DENIED',403);
  const readPolicy=await requireReadPolicy();
  const at=await clock();
  const stored=await readStored.call(store,db,request.projectId,selection.originRef.id,selection.originRef.version);
  check();
  const {ref,snapshot:s,reservation}=stored.value;
  const q=reservation.snapshot;
  if(!originSame(ref,selection.originRef)||!originSame(reservation.ref,selection.reservationRef)
    ||q.state!=='RESERVED_NOT_ISSUED'||q.credentialIssued!==false||q.executionAuthorized!==false||q.dispatchPerformed!==false
    ||q.executionGeneration!==s.execution.executionGeneration||q.credentialGeneration!==s.executionCredential.credentialGeneration
    ||s.subject.userId!==actor.actorId||s.subject.clientId!==actor.clientId||s.subject.humanSessionId!==session.id
    ||s.subject.credentialGeneration!==actor.credentialGeneration||s.subject.controlGeneration!==request.controlGeneration
    ||s.execution.executionId!==payload.executionId||s.execution.executionGeneration!==payload.executionGeneration
    ||!originSame(s.preparationRef,payload.preparationRef)||!originSame(s.preparationRef,payload.payload.optionsRef)
    ||!originSame(s.contextBundleRef,payload.payload.contextBundleRef)||!originSame(s.observedPolicyRef,payload.permissionPolicyRef)
    ||!originSame(s.budgetPolicyRef,payload.budgetPolicyRef))return mismatch();
  limit({...at,until:Math.min(Date.parse(s.expiresAt),Date.parse(q.expiresAt))});

  await clock();
  const source=await readSource.call(sources,db,actor,stored.request,'FRESH',async observation=>{
    if(observation)limit(observation);
    else check();
  });
  check();
  if(source.transactionId!==tx)return currentRequired();
  limit({...source.lifetime,until:source.validUntil});
  const prepared=source.preparation.snapshot;
  const input=readExecutionPreparationInput(prepared.intent);
  if(!('connectionKind'in input))return mismatch();
  const {connectionKind,optionsFormat,...commonIntent}=input;
  const options=prepared.options;
  if(!originSame(source.preparation.ref,s.preparationRef)||!originSame(source.assignment.ref,s.assignmentRef)
    ||!originSame(source.binding.ref,s.roleBindingRef)||!originSame(source.binding.snapshot.sessionRef,s.sessionBindingRef)
    ||!originSame(source.stage.ref,s.stageRequestRef)||!originSame(source.assignment.snapshot.definition.taskRef,s.taskRef)
    ||!originSame(source.policyRef,s.observedPolicyRef)||!originSame(source.budget.ref,s.budgetPolicyRef)
    ||!originSame(input.connectionRef,s.connectionRef)||!originSame(input.environmentRef,s.environmentRef)
    ||!originSame(input.contextBundleRef,s.contextBundleRef)||!originSame(input.sourceScopes,s.sourceScopes)
    ||!originSame(prepared.basisRefs,s.basisRefs)||!originSame(prepared.latestInstructionRefs,s.latestInstructionRefs)
    ||connectionKind!=='REGISTERED_DEFINITION'||!recordV1(options,['format','mediaType','body','utf8Bytes','contentHash'])
    ||options.mediaType!=='application/json'||options.format!==optionsFormat||typeof options.body!=='string'
    ||!originSame(s.options,{preparationRef:s.preparationRef,format:options.format,utf8Bytes:options.utf8Bytes,contentHash:options.contentHash})
    ||Buffer.byteLength(options.body,'utf8')!==options.utf8Bytes||contentHash(options.body)!==options.contentHash)return mismatch();

  const intent=readExecutionIntentV1(commonIntent);
  const claim=readExecutionBudgetClaim({
    projectId:request.projectId,executionId:s.execution.executionId,executionGeneration:s.execution.executionGeneration,
    commandId:request.commandId,assignmentRef:source.assignment.ref,
    stageRef:{applicationRef:source.application.applicationRef,nodeId:s.taskRef.nodeId},
    policyRef:source.budget.ref,operation:'START_SESSION',demand,
  });
  const finalPolicy=await requireReadPolicy();
  if(!originSame(finalPolicy,readPolicy))return currentRequired();
  await clock();
  return {intent,claim};
}

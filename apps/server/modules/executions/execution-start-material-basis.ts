import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {readServerExecutionFactV1,executionFactChecks,type ServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {materialReject as reject,type MaterialScope} from './execution-material-registration-input.ts';
export interface StartQueueRecord {ref:Ref;snapshot:Record<string,any>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const keys=['transport','executionId','executionGeneration','state','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed'];
/** START 전용 원 저장 형상이다. SEND currentBinding parser를 전용하지 않는다. */
export function readStartQueueRecord(raw:unknown,s:MaterialScope,now:string):StartQueueRecord {
 if(!isoV1(now)||!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!recordV1(raw.snapshot,[...keys,'envelope']))return reject();
 const snapshot=raw.snapshot,{envelope:input,...q}=snapshot,e=readDispatchEnvelopeV1(input,Date.parse(now));
 if(raw.ref.contentHash!==hash(q)||q.transport!=='SYNTHETIC_ONLY'||q.state!=='SYNTHETIC_QUEUED'||q.executionAuthorized!==false||q.dispatchPerformed!==false||q.executionId!==s.executionId||q.executionGeneration!==s.executionGeneration||!same(q.grantRef,s.grantRef)||!refV1(q.reservationRef)||!refV1(q.executorRegistrationRef)||!uuidV1(q.humanSessionId)||!refV1(q.budgetPolicyRef)||q.operation!=='START_SESSION'||e.operation!=='START_SESSION'||!same(q.payload,e.payload)||q.queuedAt!==e.issuedAt||!same(q.executorRegistrationRef,e.executorRegistrationRef)||e.context.projectId!==s.projectId||e.context.executionId!==s.executionId||e.context.executionGeneration!==s.executionGeneration||!same(e.context.budgetRef,q.reservationRef)||!same(e.context.sourceScopes,q.sourceScopes))return reject();
 return cloneV1({ref:raw.ref,snapshot:{...q,envelope:e}});
}
export function assertStartFact(raw:unknown,scope:MaterialScope,record:StartQueueRecord,now:string):ServerExecutionFactV1{
 const f=readServerExecutionFactV1(raw),q=record.snapshot,e=q.envelope,at=Date.parse(now);
 if(f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.registration.connectorId!==scope.connectorId||f.subject.credentialGeneration!==scope.credentialGeneration||!['NONE','OWNED'].includes(f.writerState)||f.subject.humanSessionId!==q.humanSessionId||!same(f.registration.ref,q.executorRegistrationRef)||!same(f.budgetReservationRef,q.reservationRef)||!same(f.intent.budgetPolicyRef,q.budgetPolicyRef)||!same(f.intent.contextBundleRef,q.payload.contextBundleRef)||!same(f.intent.sourceScopes,q.sourceScopes)||Date.parse(f.checkedAt)>at||at-Date.parse(f.checkedAt)>30000||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||Math.min(Date.parse(e.expiresAt),...Object.values(f.expires).map(Date.parse))<=at||!same(e.context,{projectId:f.projectId,assignmentId:f.intent.assignmentRef.id,executionId:f.executionId,executionGeneration:f.executionGeneration,connectionRef:f.intent.connectionRef,environmentRef:f.intent.environmentRef,authorizationReceiptRef:e.context.authorizationReceiptRef,capabilityRef:f.intent.capabilityRef,budgetRef:f.budgetReservationRef,sourceScopes:f.intent.sourceScopes}))return reject('MATERIAL_REGISTRATION_CURRENT_REQUIRED');
 return f;
}
export interface StartRegisteredParts {
 readonly transport:'SYNTHETIC_ONLY';
 current(db:PoolClient,actor:AuthenticatedIdentity,scope:MaterialScope,commandId:string,materialId:string):Promise<{record:StartQueueRecord;fact:ServerExecutionFactV1;grantExpiresAt:string;material:{ref:Ref;snapshot:Record<string,any>};validUntil:string}>;
}
/** 공통 보호 wrapper의 proof 없는 exact8 basis만 공급한다. HUMAN 생성 함수를 다시 호출하지 않는다. */
export class SyntheticStartMaterialBasis {
 readonly transport='SYNTHETIC_ONLY' as const;readonly parts:StartRegisteredParts;
 constructor(parts:StartRegisteredParts){this.parts=parts;this.#port();}
 #port(){if(this.parts?.transport!=='SYNTHETIC_ONLY'||typeof this.parts.current!=='function')return reject();}
 async current(db:PoolClient,actor:AuthenticatedIdentity,scope:MaterialScope,commandId:string,materialId:string){
  this.#port();const raw=await this.parts.current(db,actor,cloneV1(scope),commandId,materialId);this.#port();
  if(!recordV1(raw,['record','fact','grantExpiresAt','material','validUntil'])||!isoV1(raw.validUntil)||!isoV1(raw.grantExpiresAt))return reject();
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime())||Date.parse(raw.validUntil)<=at.getTime())return reject();
  const record=readStartQueueRecord(raw.record,scope,at.toISOString()),fact=assertStartFact(raw.fact,scope,record,at.toISOString()),a=actor.authSession;
  if(!a||fact.subject.userId!==actor.actorId||fact.subject.clientId!==actor.clientId||fact.subject.humanSessionId!==a.id||fact.subject.credentialGeneration!==actor.credentialGeneration||!isoV1(a.idleExpiresAt)||!isoV1(a.absoluteExpiresAt)||Math.min(Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt))<=at.getTime())return reject();
  fact.expires.humanSession=new Date(Math.min(Date.parse(fact.expires.humanSession),Date.parse(raw.validUntil),Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt))).toISOString();
  return{fact,grantRef:cloneV1(scope.grantRef),grantExpiresAt:raw.grantExpiresAt,commandRef:record.ref,commandSnapshot:record.snapshot,authorizationReceiptRef:cloneV1(record.snapshot.envelope.context.authorizationReceiptRef),material:cloneV1(raw.material),sourceState:'AVAILABLE' as const};
 }
}

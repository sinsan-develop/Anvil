import { canonicalJson } from '../canonical.ts';
import { readExecutionIntentV1, type ExecutionIntentV1 } from './execution-intent-v1.ts';
import { arrayV1, cloneV1, hashV1, isoV1, recordV1, refV1, uuidV1, type RuntimeRefV1 } from './validation-v1.ts';

export const executionFactChecks = ['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'] as const;
export type ExecutionFactCheck = typeof executionFactChecks[number];
export interface ExecutionFactEvidence { state: 'VERIFIED_CURRENT'|'UNVERIFIED'|'STALE'|'CONFLICT'|'UNSUPPORTED'|'NOT_REQUIRED'; evidenceRefs: RuntimeRefV1[] }
export interface ServerExecutionFactV1 {
  schemaVersion: 1; purpose: 'SERVER_EXECUTION_CURRENTNESS'; transport: 'SYNTHETIC_ONLY'; projectId: string; executionId: string; executionGeneration: number;
  subject: { userId: string; clientId: string; humanSessionId: string; controlGeneration: number; credentialGeneration: number };
  agentSession: { sessionRef: RuntimeRefV1; roleBindingRef: RuntimeRefV1; credentialGeneration: number };
  registration: { ref: RuntimeRefV1; connectorId: string; generation: number; hostPublicKeyFingerprint: string };
  intent: ExecutionIntentV1; preparationRef: RuntimeRefV1; permissionPolicyRef: RuntimeRefV1; budgetReservationRef: RuntimeRefV1;
  basisRefs: RuntimeRefV1[]; latestInstructionRefs: { kind: 'CONVERSATION'; id: string; contentHash: string }[]; understandingReviewRef: RuntimeRefV1|null;
  checks: Record<ExecutionFactCheck,ExecutionFactEvidence>; writerState: 'NONE'|'OWNED'|'UNKNOWN'|'CONFLICT';
  expires: { humanSession: string; permissionPolicy: string; registration: string; budget: string; automaticScope: string };
  checkedAt: string; executionAuthorized: false; dispatchPerformed: false;
}
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const refs=(v:unknown):v is RuntimeRefV1[]=>arrayV1(v,200)&&v.every(refV1)&&new Set(v.map(canonicalJson)).size===v.length;
/** 문법과 상호 참조만 검사한다. 호출자가 보낸 구조를 서버 사실/현재 허가로 인증하는 함수가 아니다.
 * HTTP 입력으로 채택하지 않는다. 현재 DB/관측 resolver가 매 transaction 새로 만든 자료만 후속 소비자가 사용한다.
 */
export function readServerExecutionFactV1(value: unknown): ServerExecutionFactV1 {
  const fail=():never=>{throw Error('SERVER_EXECUTION_FACT_INVALID');};let input:any;
  try {const bytes=canonicalJson(value);if(Buffer.byteLength(bytes)>2*1024*1024)return fail();input=JSON.parse(bytes);}catch{return fail();}
  if(!recordV1(input,['schemaVersion','purpose','transport','projectId','executionId','executionGeneration','subject','agentSession','registration','intent','preparationRef','permissionPolicyRef','budgetReservationRef','basisRefs','latestInstructionRefs','understandingReviewRef','checks','writerState','expires','checkedAt','executionAuthorized','dispatchPerformed'])
    ||input.schemaVersion!==1||input.purpose!=='SERVER_EXECUTION_CURRENTNESS'||input.transport!=='SYNTHETIC_ONLY'||!uuidV1(input.projectId)||!uuidV1(input.executionId)||!positive(input.executionGeneration)
    ||input.executionAuthorized!==false||input.dispatchPerformed!==false||!isoV1(input.checkedAt)
    ||!recordV1(input.subject,['userId','clientId','humanSessionId','controlGeneration','credentialGeneration'])||!uuidV1(input.subject.userId)||!uuidV1(input.subject.clientId)||!uuidV1(input.subject.humanSessionId)||!positive(input.subject.controlGeneration)||!positive(input.subject.credentialGeneration)
    ||!recordV1(input.agentSession,['sessionRef','roleBindingRef','credentialGeneration'])||!refV1(input.agentSession.sessionRef)||!refV1(input.agentSession.roleBindingRef)||!positive(input.agentSession.credentialGeneration)
    ||!recordV1(input.registration,['ref','connectorId','generation','hostPublicKeyFingerprint'])||!refV1(input.registration.ref)||!uuidV1(input.registration.connectorId)||!positive(input.registration.generation)||!hashV1(input.registration.hostPublicKeyFingerprint)
    ||!refV1(input.preparationRef)||!refV1(input.permissionPolicyRef)||!refV1(input.budgetReservationRef)||!refs(input.basisRefs)||!input.basisRefs.length
    ||input.understandingReviewRef!==null&&!refV1(input.understandingReviewRef)||!recordV1(input.checks,executionFactChecks)
    ||!['NONE','OWNED','UNKNOWN','CONFLICT'].includes(input.writerState)
    ||!recordV1(input.expires,['humanSession','permissionPolicy','registration','budget','automaticScope'])||!Object.values(input.expires).every(isoV1)
    ||!arrayV1(input.latestInstructionRefs,200)||!input.latestInstructionRefs.every(v=>recordV1(v,['kind','id','contentHash'])&&v.kind==='CONVERSATION'&&uuidV1(v.id)&&hashV1(v.contentHash)))return fail();
  try{input.intent=readExecutionIntentV1(input.intent);}catch{return fail();}
  if(input.intent.projectId!==input.projectId||!same(input.intent.roleBindingRef,input.agentSession.roleBindingRef))return fail();
  for(const name of executionFactChecks){
    const check=input.checks[name];
    if(!recordV1(check,['state','evidenceRefs'])||!['VERIFIED_CURRENT','UNVERIFIED','STALE','CONFLICT','UNSUPPORTED','NOT_REQUIRED'].includes(check.state)||!refs(check.evidenceRefs)
      ||check.state==='VERIFIED_CURRENT'&&!check.evidenceRefs.length||check.state==='NOT_REQUIRED'&&(name!=='understanding'||check.evidenceRefs.length!==0))return fail();
  }
  const bindings:Partial<Record<ExecutionFactCheck,RuntimeRefV1[]>>={session:[input.agentSession.roleBindingRef],registration:[input.registration.ref],permissionPolicy:[input.permissionPolicyRef],
    basis:input.basisRefs,context:[input.intent.contextBundleRef],capability:[input.intent.capabilityRef],budget:[input.budgetReservationRef],
    source:input.intent.sourceScopes.map((scope:any)=>scope.observationRef),...(input.understandingReviewRef?{understanding:[input.understandingReviewRef]}:{})};
  for(const [name,expected]of Object.entries(bindings))if(input.checks[name].state==='VERIFIED_CURRENT'&&!expected!.every(ref=>input.checks[name].evidenceRefs.some((candidate:RuntimeRefV1)=>same(ref,candidate))))return fail();
  return cloneV1(input) as ServerExecutionFactV1;
}

import { randomUUID } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { cloneV1, isoV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { executionFactChecks, readServerExecutionFactV1 } from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import { AuthFailure } from '../access/repository.ts';

/** 승인 P1의 합성 계획만 만든다. DB 저장·현재 권한·실제 credential/Agent 실행 허가가 아니다.
 * 후속 서버 resolver/단일 writer/명령·예약 transaction 소비 전 HTTP나 실행기에 전달하지 않는다.
 */
export function planSyntheticExecutionGrant(value: unknown,now: string){
  const fact=readServerExecutionFactV1(value);
  if(!isoV1(now)||Date.parse(fact.checkedAt)>Date.parse(now))throw new AuthFailure('EXECUTION_FACT_TIME_INVALID',422);
  // 서버 내부 현재성 계획의 재사용 상한. 실제 wire는 이 원문 재사용이 아니라 새 현재 검사/launch fence를 요구한다.
  if(Date.parse(now)-Date.parse(fact.checkedAt)>30_000)throw new AuthFailure('EXECUTION_FACT_STALE',412);
  if(executionFactChecks.some(name=>name!=='understanding'&&fact.checks[name].state!=='VERIFIED_CURRENT'))throw new AuthFailure('EXECUTION_CURRENTNESS_REQUIRED',412);
  if(fact.writerState!=='NONE')throw new AuthFailure('EXECUTION_WRITER_UNAVAILABLE',409);
  if(fact.intent.mode==='WORK'&&(fact.understandingReviewRef===null||fact.checks.understanding.state!=='VERIFIED_CURRENT'))throw new AuthFailure('EXECUTION_UNDERSTANDING_REQUIRED',412);
  if(fact.intent.mode==='CONTEXT_REVIEW'&&fact.intent.sourceScopes.some(scope=>scope.targets.some(target=>target.access!=='READ')))throw new AuthFailure('EXECUTION_CONTEXT_READ_ONLY_REQUIRED',412);
  const deadline=Math.min(Date.parse(now)+7_200_000,...Object.values(fact.expires).map(Date.parse));
  if(deadline<=Date.parse(now))throw new AuthFailure('EXECUTION_SOURCE_EXPIRED',412);
  const binding=cloneV1(fact),allowedOperations=['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'] as const;
  const scopeDigest=contentHash(canonicalJson({binding,allowedOperations,expiresAt:new Date(deadline).toISOString()}));
  const snapshot={kind:'EXECUTION' as const,state:'SYNTHETIC_PLAN' as const,transport:'SYNTHETIC_ONLY' as const,binding,
    allowedOperations:[...allowedOperations],expiresAt:new Date(deadline).toISOString(),scopeDigest,factHash:contentHash(canonicalJson(fact)),
    plannedAt:now,executionAuthorized:false as const,dispatchPerformed:false as const};
  if(Buffer.byteLength(canonicalJson(snapshot))>2*1024*1024)throw new AuthFailure('EXECUTION_GRANT_PLAN_TOO_LARGE',422);
  return {ref:{id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};
}

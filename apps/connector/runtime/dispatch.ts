import {canonicalJson} from '../../../contracts/canonical.ts';
import {isVersionRef} from '../../../contracts/references.ts';
import {readSourceScopesV1} from '../../../contracts/runtime/source-scope-v1.ts';

// INTERFACES §12.3의 명시 필드만 대조한다. 공개 wire/실행 receipt가 아니다.
const fields=['projectId','assignmentId','executionId','executionGeneration','connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef','sourceScopes'] as const;
type ContextField=typeof fields[number];
type ReasonCode='CONTEXT_SHAPE_INVALID'|'EXPECTED_SNAPSHOT_SHAPE_INVALID'|'IDENTIFIER_INVALID'|'GENERATION_INVALID'|'REFERENCE_INVALID'|'SOURCE_SCOPE_INVALID'|'EXPECTED_SOURCE_SCOPE_INVALID'|'EXPECTED_SNAPSHOT_MISMATCH'|'SERVER_VERIFIERS_NOT_CONNECTED';
interface Reason{readonly code:ReasonCode;readonly field?:ContextField}
const unverifiedChecks=['AUTHORIZATION','CURRENT_CONTROL','SOURCE_SCOPE','OWNERSHIP','CAPABILITY','BUDGET','DURABLE_REPLAY'] as const;

/** 호출자가 넣은 snapshot/참조/성공 주장은 실제 서버·OS 검증이 아니다. */
export interface DispatchPreconditionReport{
 readonly kind:'INTERNAL_PRECONDITION_REPORT';
 readonly structuralChecksPassed:boolean;
 readonly executionAuthorized:false;
 readonly dispatchPerformed:false;
 readonly reasons:readonly Reason[];
 readonly unverifiedChecks:typeof unverifiedChecks;
}

function readContext(value:unknown,expected:boolean,reasons:Reason[]):Record<ContextField,unknown>|null{
 const invalid=()=>{reasons.push({code:expected?'EXPECTED_SNAPSHOT_SHAPE_INVALID':'CONTEXT_SHAPE_INVALID'});return null;};
 let context:Record<ContextField,unknown>;
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
  // canonicalJson은 getter/함수/비정상 Unicode를 실행·정규화하지 않고 거절한다.
  const serialized=canonicalJson(value),parsed=JSON.parse(serialized);
  if(Object.keys(parsed).sort().join(',')!==[...fields].sort().join(','))return invalid();
  context=parsed;
 }catch{return invalid();}
 let valid=true;
 for(const field of ['projectId','assignmentId','executionId'] as const){
  if(!isVersionRef({id:context[field],version:1,contentHash:'0'.repeat(64)})){reasons.push({code:'IDENTIFIER_INVALID',field});valid=false;}
 }
 if(!Number.isSafeInteger(context.executionGeneration)||(context.executionGeneration as number)<1){reasons.push({code:'GENERATION_INVALID',field:'executionGeneration'});valid=false;}
 for(const field of ['connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef'] as const){
  if(!isVersionRef(context[field])){reasons.push({code:'REFERENCE_INVALID',field});valid=false;}
 }
 // 공통 wire 문법만 검사한다. 실제 경로/관측·권한·OS 소유는 검사하지 않는다.
 try{readSourceScopesV1(context.sourceScopes);}catch{reasons.push({code:expected?'EXPECTED_SOURCE_SCOPE_INVALID':'SOURCE_SCOPE_INVALID',field:'sourceScopes'});valid=false;}
 return valid?context:null;
}

/**
 * 구조와 두 입력 snapshot의 일치 여부만 보고한다. 인증·현재 제어·실경로·소유·
 * 능력·예산·durable 중복검증 연결이 없으므로 항상 실행불가다.
 * 미래 실행기는 이 결과나 structuralChecksPassed를 실행허가로 사용하면 안 된다.
 */
export function inspectDispatchPreconditions(value:unknown,expectedSnapshot:unknown):DispatchPreconditionReport{
 const reasons:Reason[]=[];
 const context=readContext(value,false,reasons),expected=readContext(expectedSnapshot,true,reasons);
 if(context&&expected){
  for(const field of fields){
   if(canonicalJson(context[field])!==canonicalJson(expected[field]))reasons.push({code:'EXPECTED_SNAPSHOT_MISMATCH',field});
  }
 }
 const structuralChecksPassed=reasons.length===0;
 // 정확해 보이는 가짜 snapshot이라도 현재 제품의 실행 차단은 해제하지 않는다.
 reasons.push({code:'SERVER_VERIFIERS_NOT_CONNECTED'});
 return {kind:'INTERNAL_PRECONDITION_REPORT',structuralChecksPassed,executionAuthorized:false,dispatchPerformed:false,reasons,unverifiedChecks};
}

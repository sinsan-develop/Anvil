import { canonicalJson } from '../canonical.ts';
import { cloneV1, recordV1, refV1, uuidV1, type RuntimeRefV1 } from './validation-v1.ts';
import { readSourceScopesV1, type SourceScopeV1 } from './source-scope-v1.ts';

export interface ExecutionIntentV1 {
  projectId: string; assignmentRef: RuntimeRefV1; roleBindingRef: RuntimeRefV1; contextBundleRef: RuntimeRefV1;
  connectionRef: RuntimeRefV1; environmentRef: RuntimeRefV1; capabilityRef: RuntimeRefV1; budgetPolicyRef: RuntimeRefV1;
  sourceScopes: SourceScopeV1[]; mode: 'CONTEXT_REVIEW' | 'WORK'; reason: string;
}
/** 입력 문법만 확인한다. 참조의 존재·현재성·실행 허가는 서버가 별도로 검사한다. */
export function readExecutionIntentV1(value: unknown): ExecutionIntentV1 {
  const refs = ['assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef'];
  const fail = (): never => { throw Error('EXECUTION_INTENT_INVALID'); };
  if (!recordV1(value, ['projectId',...refs,'sourceScopes','mode','reason']) || !uuidV1(value.projectId) || refs.some(key => !refV1(value[key]))
    || !['CONTEXT_REVIEW','WORK'].includes(value.mode) || typeof value.reason !== 'string' || !value.reason.isWellFormed() || !value.reason.trim() || value.reason.length > 20000) return fail();
  try { readSourceScopesV1(value.sourceScopes); if (Buffer.byteLength(canonicalJson(value),'utf8') > 2*1024*1024) return fail(); return cloneV1(value) as unknown as ExecutionIntentV1; }
  catch { return fail(); }
}


/** 준비 저장 전용. 실행 권위 소비자는 기존 exact11 reader를 계속 사용한다. */
export interface RegisteredExecutionPreparationIntentV1 extends ExecutionIntentV1 {
  connectionKind: 'REGISTERED_DEFINITION'; optionsFormat: 'CLAUDE_QUERY_DATA_V1';
}
export type ExecutionPreparationIntentV1 = ExecutionIntentV1 | RegisteredExecutionPreparationIntentV1;
export function readExecutionPreparationIntentV1(value: unknown): ExecutionPreparationIntentV1 {
  const keys = ['projectId','assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef',
    'capabilityRef','budgetPolicyRef','sourceScopes','mode','reason','connectionKind','optionsFormat'];
  if (!recordV1(value, keys)) return readExecutionIntentV1(value);
  if (value.connectionKind !== 'REGISTERED_DEFINITION' || value.optionsFormat !== 'CLAUDE_QUERY_DATA_V1') throw Error('EXECUTION_INTENT_INVALID');
  const copied = cloneV1(value);
  if (Buffer.byteLength(canonicalJson(copied), 'utf8') > 2*1024*1024) throw Error('EXECUTION_INTENT_INVALID');
  const {connectionKind: _kind, optionsFormat: _format, ...base} = copied;
  return {...readExecutionIntentV1(base), connectionKind: 'REGISTERED_DEFINITION', optionsFormat: 'CLAUDE_QUERY_DATA_V1'};
}

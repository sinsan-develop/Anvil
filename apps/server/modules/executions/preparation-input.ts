import { readExecutionPreparationIntentV1, type ExecutionPreparationIntentV1 } from '../../../../contracts/runtime/execution-intent-v1.ts';
import { types } from 'node:util';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { recordV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';

export const executionPreparationOperations = ['prepareExecution'] as const;
export function readExecutionPreparationInput(value: unknown): ExecutionPreparationIntentV1 {
  let input: ExecutionPreparationIntentV1;
  try { input=readExecutionPreparationIntentV1(value); } catch { throw new AuthFailure('EXECUTION_INTENT_INVALID',422); }
  try { assertKnowledgeTextSafe(input.reason); } catch { throw new AuthFailure('EXECUTION_PREPARATION_SENSITIVE_CONTENT',412); }
  return input;
}


export interface ExecutionPreparationOptions {
  format: 'CLAUDE_QUERY_DATA_V1'; mediaType: 'application/json'; body: string; utf8Bytes: number; contentHash: string;
}
/** 보호 reader가 반환한 정의의 데이터만 변환한다. 현재 권위나 원문 접근 허가를 생산하지 않는다. */
export function compileExecutionPreparationOptions(raw: unknown): ExecutionPreparationOptions {
  const bad = (): never => { throw new AuthFailure('EXECUTION_PREPARATION_OPTIONS_INVALID',422); };
  try {
    if (!raw || typeof raw !== 'object' || types.isProxy(raw)) return bad();
    const d=Object.getOwnPropertyDescriptors(raw);
    for (const key of ['adapterKind','toolProduct','modelOptions']) {
      const p=d[key]; if (!p || !p.enumerable || !('value' in p)) return bad();
    }
    if (d.adapterKind!.value !== 'CLAUDE_AGENT_SDK' || d.toolProduct!.value !== 'Claude Code') return bad();
    const modelOptions=d.modelOptions!.value;
    if (!modelOptions || typeof modelOptions !== 'object' || types.isProxy(modelOptions) || !recordV1(modelOptions,['claudeQueryParams'])) return bad();
    const params=modelOptions.claudeQueryParams;
    if (!params || typeof params !== 'object' || types.isProxy(params) || Array.isArray(params)) return bad();
    const keys=Object.keys(Object.getOwnPropertyDescriptors(params));
    if (!keys.includes('model') || keys.some(key=>!['model','maxTurns','maxBudgetUsd'].includes(key)) || !recordV1(params,keys)) return bad();
    if (typeof params.model !== 'string' || !params.model.isWellFormed() || params.model.length<1 || params.model.length>200 || !params.model.trim() || /\p{Cc}/u.test(params.model)) return bad();
    if (Object.hasOwn(params,'maxTurns') && (!Number.isSafeInteger(params.maxTurns) || params.maxTurns<1)) return bad();
    if (Object.hasOwn(params,'maxBudgetUsd') && (typeof params.maxBudgetUsd !== 'number' || !Number.isFinite(params.maxBudgetUsd) || params.maxBudgetUsd<0 || params.maxBudgetUsd>Number.MAX_SAFE_INTEGER)) return bad();
    const body=canonicalJson(modelOptions),utf8Bytes=Buffer.byteLength(body,'utf8');
    if (utf8Bytes>2*1024*1024) return bad();
    return {format:'CLAUDE_QUERY_DATA_V1',mediaType:'application/json',body,utf8Bytes,contentHash:contentHash(body)};
  } catch { return bad(); }
}

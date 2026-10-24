import {ApiClient,ApiError} from '../../api/client.ts';
import {readProviderClaimReceiptHistory,type ProviderClaimPageHistory} from './provider-claim-receipt-api.ts';
import {validateUnderstandingHistory,type UnderstandingHistoryView} from '../session-detail/understanding-history-api.ts';
/** 제출 결과 없이, 선택된 보관 claim의 원결과가 존재할 때만 같은 실행의 검토 이력을 읽는다.
 * claim과 검토 응답의 직접 대응·현재 세션 가동/허가·의미 이해 수용은 검증하지 않는다. */
export async function readClaimUnderstandingHistory(client:ApiClient,projectId:string,sessionRef:ProviderClaimPageHistory['agentSessionRef'],raw:ProviderClaimPageHistory['items'][number],active:()=>boolean):Promise<UnderstandingHistoryView|null>{
 const selected=structuredClone(raw),session=structuredClone(sessionRef),q=selected?.query;
 if(!selected||Object.keys(selected).sort().join(',')!=='query,receipt'||!selected.receipt||!q||q.projectId!==projectId||q.agentSessionId!==session?.id||!Number.isSafeInteger(session.version)||session.version<1||typeof session.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(session.contentHash))throw new ApiError('UNDERSTANDING_CLAIM_BINDING_INVALID');
 if(!active())return null;
 const original=await readProviderClaimReceiptHistory(client,q,active,selected.receipt);if(!original||!active())return null;
 if(!original.found)throw new ApiError('UNDERSTANDING_CLAIM_NOT_FOUND',404);
 const scope={projectId:q.projectId,executionId:q.executionId,executionGeneration:q.generation},value=await client.get(`/api/v1/projects/${scope.projectId}/executions/${scope.executionId}/understanding-reviews?generation=${scope.executionGeneration}`);if(!active())return null;
 return validateUnderstandingHistory(value,scope,active);
}

import type { ApiError } from '../../api/client.ts';

export function isConfirmedArtifactQuarantine(error:{code:string;status:number;requestId?:string|null}){return error.code==='ARTIFACT_QUARANTINED'&&error.status===412&&typeof error.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(error.requestId);}
export function documentFailure(error:ApiError){return{code:error.code,status:error.status,...(isConfirmedArtifactQuarantine(error)?{quarantinedArtifactId:error.requestId!}:{})};}

export function isKnownDocumentRejection(error: { code: string; status: number } | null): boolean {
  return !!error && [400,401,403,404,409,412,413,415,422].includes(error.status) && /^[A-Z_]{1,64}$/.test(error.code) && !['RESPONSE_INVALID','REQUEST_FAILED'].includes(error.code);
}
export function documentMutationUncertain(previous: boolean | undefined, error: ApiError): boolean {
  if(isConfirmedArtifactQuarantine(error))return false;
  return !!previous || !isKnownDocumentRejection(error) && !['REVIEW_CONTINUATION_PAUSED','DOCUMENT_CONFIRMATION_PAUSED','DESIGN_INDEX_CONTINUATION_PAUSED','WORK_PLAN_CONTINUATION_PAUSED','TRACE_LINK_CONTINUATION_PAUSED'].includes(error.code);
}

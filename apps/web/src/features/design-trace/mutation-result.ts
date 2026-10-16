import type { ApiError } from '../../api/client.ts';

export function isKnownDocumentRejection(error: { code: string; status: number } | null): boolean {
  return !!error && [400,401,403,404,409,412,413,415,422].includes(error.status) && /^[A-Z_]{1,64}$/.test(error.code) && !['RESPONSE_INVALID','REQUEST_FAILED'].includes(error.code);
}
export function documentMutationUncertain(previous: boolean | undefined, error: ApiError): boolean {
  return !!previous || !isKnownDocumentRejection(error) && !['REVIEW_CONTINUATION_PAUSED','DOCUMENT_CONFIRMATION_PAUSED','DESIGN_INDEX_CONTINUATION_PAUSED','WORK_PLAN_CONTINUATION_PAUSED'].includes(error.code);
}

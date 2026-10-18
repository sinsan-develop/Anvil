import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { getPinnedForm, type FormVersion } from './forms-api.ts';

export type PinnedFormState = { status: 'LOADING' } | { status: 'READY'; data: FormVersion } | { status: 'ERROR'; error: ApiError };

// 취소는 응답의 화면 반영을 막는다. 이미 보낸 읽기 요청의 네트워크 중단을 뜻하지 않는다.
export function watchPinnedForm(client: ApiClient, ref: VersionRef, receive: (state: PinnedFormState) => void, onAuthenticationLost: () => void): () => void {
 let current = true;
 void getPinnedForm(client, { ...ref }).then(data => { if (current) receive({ status: 'READY', data }); })
  .catch((cause: unknown) => {
   if (!current) return;
   const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
   receive({ status: 'ERROR', error });
   if (error.status === 401) onAuthenticationLost();
  });
 return () => { current = false; };
}

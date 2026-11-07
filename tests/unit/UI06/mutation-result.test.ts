import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../../apps/web/src/api/client.ts';
import { documentMutationUncertain, isKnownDocumentRejection } from '../../../apps/web/src/features/design-trace/mutation-result.ts';

test('응답 단절·손상 뒤의 거절은 미확인을 해소하지 않고 명확한 첫 거절만 새 대상 준비를 허용한다', () => {
  const denied = new ApiError('VERSION_CONFLICT',409);
  assert.equal(isKnownDocumentRejection(denied),true); assert.equal(documentMutationUncertain(false,denied),false);
  for(const e of [new ApiError('CONNECTION_LOST'),new ApiError('RESPONSE_INVALID',409),new ApiError('REQUEST_FAILED',403),new ApiError('FAILED',500)]) {
    assert.equal(isKnownDocumentRejection(e),false); assert.equal(documentMutationUncertain(false,e),true);
    assert.equal(documentMutationUncertain(documentMutationUncertain(false,e),denied),true);
  }
  assert.equal(documentMutationUncertain(false,new ApiError('REVIEW_CONTINUATION_PAUSED')),false);
  assert.equal(documentMutationUncertain(true,new ApiError('REVIEW_CONTINUATION_PAUSED')),true);
});

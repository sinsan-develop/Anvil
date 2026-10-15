import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { getForm } from '../../../apps/web/src/features/methodologies/forms-api.ts';

test('공통 양식의 미완성 초안도 재조회하되 SYSTEM 형식 검사를 느슨하게 하지 않는다', async () => {
  const ref = { id: 'a6f30000-0000-4000-8000-000000000099', version: 1, contentHash: 'a'.repeat(64) };
  const standard = { id: 'a6f30000-0000-4000-8000-000000000100', version: 1, contentHash: 'b'.repeat(64) };
  const definition = { formCode: 'MY01', name: '작성 중 양식', scope: 'USER_COMMON', purpose: '', authorRole: '', reviewerRole: '', confirmerRole: '', requiredInputs: [], items: [], authoringStandardRef: standard };
  const body = { ref, definition, authoringStandard: { ref: standard, content: '공통 작성 기준' }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } };
  const client = new ApiClient(async () => Response.json(body));
  const result = await getForm(client, { ref, formCode: 'MY01', name: '작성 중 양식', scope: 'USER_COMMON' });
  assert.deepEqual(result.definition.items, []); assert.equal(result.definition.purpose, '');
  await assert.rejects(getForm(new ApiClient(async () => Response.json({ ...body, definition: { ...definition, scope: 'SYSTEM' } })), { ref, formCode: 'MY01', name: '작성 중 양식', scope: 'SYSTEM' }), (error: unknown) => error instanceof ApiError && error.code === 'RESPONSE_INVALID');
});

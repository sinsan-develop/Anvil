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
  const reviewRef = { id: 'a6f30000-0000-4000-8000-000000000088', criteriaVersion: 1, targetRef: ref, outcome: 'ACCEPTED' };
  const validDefinition = { ...definition, purpose: '사용자 요구 작성', authorRole: '작성자', reviewerRole: '검토자', confirmerRole: '소유자', requiredInputs: ['요구 원문'], items: [{ itemId: 'MY01-01', title: '목적', required: true, valueType: 'TEXT', repeated: false, fields: [], authoringRules: ['작성 이유를 기재'], reviewCriteria: ['목적의 명확성 확인'] }] };
  const reviewed = { ...body, definition: validDefinition, confirmation: { id: 'a6f30000-0000-4000-8000-000000000077', decidedBy: ref.id, decidedAt: '2026-10-16T00:00:00Z', reviewRefs: [reviewRef] }, validation: { formatOnly: true, contentReview: 'RECORDED', userAcceptance: 'CONFIRMED' } };
  assert.equal((await getForm(new ApiClient(async () => Response.json(reviewed)), { ref, formCode: 'MY01', name: '작성 중 양식', scope: 'USER_COMMON' })).validation.userAcceptance, 'CONFIRMED');
  await assert.rejects(getForm(new ApiClient(async () => Response.json({ ...reviewed, confirmation: null })), { ref, formCode: 'MY01', name: '작성 중 양식', scope: 'USER_COMMON' }), (error: unknown) => error instanceof ApiError && error.code === 'RESPONSE_INVALID');
  await assert.rejects(getForm(new ApiClient(async () => Response.json({ ...body, definition: { ...definition, scope: 'SYSTEM' } })), { ref, formCode: 'MY01', name: '작성 중 양식', scope: 'SYSTEM' }), (error: unknown) => error instanceof ApiError && error.code === 'RESPONSE_INVALID');
});

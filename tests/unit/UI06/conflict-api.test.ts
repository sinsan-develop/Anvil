import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { canCompareDocumentConflict, compareDocumentConflict, adoptDocumentConflict, canPrepareManualConflict } from '../../../apps/web/src/features/design-trace/conflict-api.ts';
import { prepareDocumentSave, type DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1', session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) };
async function conflicted(): Promise<DocumentBuffer> {
  const b: DocumentBuffer = { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, formRef: { id, version: 1, contentHash: 'a'.repeat(64) }, title: '보존', body: '# 실제 입력', mediaType: 'text/markdown;charset=utf-8', content: { attachments: [], sections: [], sourceRefs: [] }, criteria: [], reason: '명시 개정', controlGeneration: 4, dirty: true, pending: null, savedRef: null, failure: { code: 'VERSION_CONFLICT', status: 409 } };
  const pending = await prepareDocumentSave(b, session); b.pending = { ...pending, save: { ...pending.upload, commandId: pending.saveCommandId, operation: 'saveDocumentDraft', targetId: id, expectedVersion: 2, payload: {} } }; return b;
}
test('미확인 전송·다른 주체·제어 충돌은 버전 충돌로 바꿔 새 기준/명령을 만들지 않는다', async () => {
  const b = await conflicted(); let calls = 0; const client = new ApiClient(async () => { calls++; throw Error('unexpected'); });
  for (const item of [{ ...b, failure: { status: 0, code: 'CONNECTION_LOST' } }, { ...b, failure: { status: 409, code: 'CONTROL_GENERATION_CONFLICT' } }, { ...b, ownerUserId: project }, { ...b, pending: { ...b.pending!, save: null } }]) await assert.rejects(compareDocumentConflict(client, item, session), ApiError);
  assert.equal(calls, 0); assert.equal(canCompareDocumentConflict(b), true);
  const latest = { document: { id, version: 3, formRef: b.formRef, title: '서버', content: { body: { mediaType: b.mediaType }, attachments: [], sections: [], sourceRefs: [] }, stageNodeRef: null, contentReviewCriteria: { items: [] } }, body: '서버 본문' } as any;
  const comparison = { ownerUserId: id, projectId: project, rejectedCommandId: b.pending!.saveCommandId, baseVersion: 2, latest, controlGeneration: 4, compatible: true };
  assert.throws(() => adoptDocumentConflict(b, comparison, session, false), ApiError);
  assert.throws(() => adoptDocumentConflict(b, { ...comparison, compatible: false }, session, true), ApiError);
  const adopted = adoptDocumentConflict(b, comparison, session, true); assert.equal(adopted.body, b.body); assert.equal(adopted.baseVersion, 3); assert.equal(adopted.pending, null); assert.equal(adopted.dirty, true); assert.equal(b.pending!.save!.expectedVersion, 2);
});
test('비교 읽기는 최대4페이지에서 멈추고 찾지 못한 문서의 버전을 추측하지 않는다', async () => {
  const b = await conflicted(); let pages = 0;
  const client = new ApiClient(async input => {
    const path = String(input); let response: unknown;
    if (path === `/api/v1/projects/${project}`) response = { id: project, participation: 'OWNER', controlState: { actorId: id, clientId: id, generation: 4, status: 'HELD' } };
    else { assert.ok(path.startsWith(`/api/v1/projects/${project}/documents?`)); pages++; response = { items: [{ id: project, title: '다른 문서', headVersion: 1, confirmedVersion: null, updatedAt: '2026-10-16T05:00:00Z' }], hasMore: true, nextCursor: 'next-' + pages, observedAt: '2026-10-16T05:00:00Z' }; }
    return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
  });
  await assert.rejects(compareDocumentConflict(client, b, session), (e: unknown) => e instanceof ApiError && e.code === 'DOCUMENT_COMPARISON_WINDOW_EXCEEDED'); assert.equal(pages, 4); assert.equal(b.baseVersion, 2);
});

test('양식·첨부가 달라진 충돌은 별도 확인으로 최신 메타데이터와 내 원문을 수동 조정 초안에 보존한다', async () => {
  const b = await conflicted(), rejected = structuredClone(b.pending);
  const form = { id: project, version: 2, contentHash: 'b'.repeat(64) }, attachment = { artifactId: project, bytes: 3, contentHash: 'c'.repeat(64), mediaType: 'application/octet-stream' };
  const latest = { document: { id, version: 3, contentHash: 'd'.repeat(64), formRef: form, title: '서버', content: { body: { mediaType: 'text/plain;charset=utf-8' }, attachments: [attachment], sections: [{ itemId: 'LATEST', anchor: 'line:1' }], sourceRefs: [] }, stageNodeRef: null, contentReviewCriteria: { items: [{ criterionId: 'LATEST', title: '새 양식 항목', reviewCriteria: [] }] } }, body: '서버 본문' } as any;
  const comparison = { ownerUserId: id, projectId: project, rejectedCommandId: b.pending!.saveCommandId, baseVersion: 2, latest, controlGeneration: 4, compatible: false };
  assert.throws(() => (adoptDocumentConflict as any)(b, comparison, session, false, 'LATEST_METADATA'), ApiError);
  const adjusted = (adoptDocumentConflict as any)(b, comparison, session, true, 'LATEST_METADATA') as DocumentBuffer;
  assert.equal(adjusted.body, b.body); assert.equal(adjusted.title, b.title); assert.deepEqual(adjusted.formRef, form); assert.deepEqual(adjusted.content.attachments, [attachment]);
  assert.equal(adjusted.mediaType, 'text/plain;charset=utf-8'); assert.deepEqual(adjusted.content.sections, [], '원문이 달라진 항목 위치를 자동 승계하지 않는다'); assert.equal(adjusted.criteria[0]?.criterionId, 'LATEST');
  assert.equal(adjusted.pending, null); assert.equal(adjusted.baseVersion, 3); assert.equal(adjusted.dirty, true);
  assert.deepEqual((adjusted.reconciliation as any).rejectedSnapshot, rejected); assert.deepEqual(b.pending, rejected, '기존 거절 명령·입력은 변형하지 않는다');
  const newSave = await prepareDocumentSave(adjusted, session); assert.equal(newSave.baseVersion, 3); assert.notEqual(newSave.saveCommandId, b.pending!.saveCommandId);
  assert.throws(() => (adoptDocumentConflict as any)(b, { ...comparison, latest: { ...latest, document: { ...latest.document, stageNodeRef: { applicationId: project, nodeId: 'pending' } } } }, session, true, 'LATEST_METADATA'), ApiError);
  assert.throws(() => (adoptDocumentConflict as any)({ ...b, failure: { status: 0, code: 'CONNECTION_LOST' } }, comparison, session, true, 'LATEST_METADATA'), ApiError);
});

test('단계가 연결된 문서의 충돌 조정도 확인된 최신 단계를 보존하고 근거 없는 참조는 거절한다', async () => {
  const b = await conflicted(), selected = { applicationId: project, nodeId: 'REQUIREMENTS' };
  const latest = { document: { id, version: 3, contentHash: 'd'.repeat(64), formRef: b.formRef, title: '서버', content: { body: { mediaType: b.mediaType }, attachments: [], sections: [], sourceRefs: [] }, stageNodeRef: selected, stageBinding: { applicationRef: { id: project, version: 1, contentHash: 'f'.repeat(64) }, methodologyName: '구조적', nodeId: 'REQUIREMENTS', nodeName: '요구사항', uses: ['OUTPUT'] }, contentReviewCriteria: { items: [] } }, body: '서버 본문' } as any;
  const comparison = { ownerUserId: id, projectId: project, rejectedCommandId: b.pending!.saveCommandId, baseVersion: 2, latest, controlGeneration: 4, compatible: false };
  assert.equal(canPrepareManualConflict(comparison), true);
  const adjusted = adoptDocumentConflict(b, comparison, session, true, 'LATEST_METADATA');
  assert.deepEqual(adjusted.stageNodeRef, selected); assert.equal(adjusted.body, b.body);
  assert.deepEqual((await prepareDocumentSave(adjusted, session)).stageNodeRef, selected);
  assert.equal(canPrepareManualConflict({ ...comparison, latest: { ...latest, document: { ...latest.document, stageBinding: undefined } } }), false);
  assert.equal(canPrepareManualConflict({ ...comparison, latest: { ...latest, document: { ...latest.document, stageBinding: { ...latest.document.stageBinding, nodeId: 'OTHER' } } } }), false);
});

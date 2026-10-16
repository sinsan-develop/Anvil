import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { continueDocumentSave, documentDraftHash, prepareDocumentSave, type DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1';
const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) };
function buffer(): DocumentBuffer { return { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, formRef: { id, version: 1, contentHash: 'a'.repeat(64) }, title: '불변 원문', body: '\uFEFF# 원문\r\n', mediaType: 'text/markdown;charset=utf-8', content: { attachments: [], sections: [{ itemId: 'REQ', anchor: 'line:1' }], sourceRefs: [] }, criteria: [], reason: '명시 개정', controlGeneration: 4, dirty: true, pending: null, savedRef: null, failure: null }; }
test('중단된 화면의 저장은 업로드도 시작하지 않고 새 요청을 자동으로 만들지 않는다', async () => {
  const pending = await prepareDocumentSave(buffer(), session); let calls = 0;
  const client = new ApiClient(async () => { calls++; const ref = { artifactId: id, ...pending.upload.payload }; return new Response(JSON.stringify({ operationId: id, commandId: pending.upload.commandId, projectId: project, status: 'APPLIED', targetId: id, version: null, data: { artifactRef: ref, status: 'ARTIFACT_READY' }, serverReceivedAt: '2026-10-16T05:00:00.000Z' }), { headers: { 'content-type': 'application/json' } }); });
  await assert.rejects(continueDocumentSave(client, pending, session, () => {}, () => false), (error: unknown) => error instanceof ApiError && error.code === 'SAVE_CONTINUATION_PAUSED');
  assert.equal(calls, 0);
});
test('저장 클라이언트의 제한된 문서 hash는 서버 canonical 계약과 같고 잘못된 주체/버전은 전송하지 않는다', async () => {
  const work = buffer(), pending = await prepareDocumentSave(work, session), bytes = Buffer.from(work.body);
  assert.equal(pending.upload.payload.bytes, bytes.length); assert.equal(pending.upload.payload.contentHash, createHash('sha256').update(bytes).digest('hex'));
  const content = { body: { artifactId: id, bytes: bytes.length, contentHash: String(pending.upload.payload.contentHash), mediaType: 'text/markdown;charset=utf-8' }, ...work.content };
  assert.equal(await documentDraftHash(work.title, work.formRef, content), contentHash(canonicalJson({ title: work.title, formRef: work.formRef, stageNodeRef: null, content })));
  await assert.rejects(prepareDocumentSave({ ...work, ownerUserId: project }, session), ApiError);
  await assert.rejects(prepareDocumentSave({ ...work, body: '\uD800' }, session), ApiError);
  let calls = 0; const client = new ApiClient(async () => { calls++; return new Response('{}'); });
  await assert.rejects(continueDocumentSave(client, { ...pending, upload: { ...pending.upload, operation: 'executeAgent' as any } }, session, () => {}, () => true), ApiError);
  await assert.rejects(continueDocumentSave(client, { ...pending, upload: { ...pending.upload, clientId: project } }, session, () => {}, () => true), ApiError);
  assert.equal(calls, 0);
});
test('기존 일반 텍스트 문서를 편집해도 원문 형식을 Markdown으로 암묵 변경하지 않는다', async () => {
  const work = Object.assign(buffer(), { mediaType: 'text/plain;charset=utf-8' });
  const pending = await prepareDocumentSave(work, session);
  assert.equal(pending.upload.payload.mediaType, 'text/plain;charset=utf-8');
});

test('단계에 연결된 문서 저장은 선택 참조를 pending·본문 hash·재확인 명령에 고정한다', async () => {
  const stageNodeRef = { applicationId: project, nodeId: 'ANALYSIS-01' }, work = Object.assign(buffer(), { stageNodeRef });
  let pending = await prepareDocumentSave(work, session);
  assert.deepEqual((pending as any).stageNodeRef, stageNodeRef);
  const bytes = Buffer.from(work.body), artifact = { artifactId: id, bytes: bytes.length, contentHash: createHash('sha256').update(bytes).digest('hex'), mediaType: work.mediaType };
  const content = { body: artifact, ...work.content }, expectedHash = contentHash(canonicalJson({ title: work.title, formRef: work.formRef, stageNodeRef, content }));
  const commands: any[] = []; let lost = true;
  const client = new ApiClient(async (_url, init) => {
    if (init?.headers && new Headers(init.headers).get('content-type') === 'application/octet-stream') return Response.json({ operationId: id, commandId: pending.upload.commandId, projectId: project, status: 'APPLIED', targetId: id, version: null, data: { artifactRef: artifact, status: 'ARTIFACT_READY' }, serverReceivedAt: '2026-10-17T00:00:00.000Z' });
    const command = JSON.parse(String(init?.body)); commands.push(command);
    if (lost) { lost = false; throw Error('synthetic-stage-receipt-lost'); }
    return Response.json({ operationId: id, commandId: command.commandId, projectId: project, status: 'APPLIED', targetId: id, version: 3, data: { ref: { id, version: 3, contentHash: expectedHash }, status: 'DRAFT' }, serverReceivedAt: '2026-10-17T00:00:00.000Z' });
  });
  await assert.rejects(continueDocumentSave(client, pending, session, value => { pending = value; }, () => true), (e: unknown) => e instanceof ApiError && e.code === 'CONNECTION_LOST');
  const result = await continueDocumentSave(client, pending, session, () => {}, () => true);
  assert.equal(result.contentHash, expectedHash); assert.deepEqual(commands[0], commands[1]); assert.deepEqual(commands[0].payload.stageNodeRef, stageNodeRef);
  assert.notEqual(await documentDraftHash(work.title, work.formRef, content), expectedHash, '미연결 hash와 연결 hash를 혼동하지 않는다');
});

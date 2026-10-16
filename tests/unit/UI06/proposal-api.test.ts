import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import type { DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
import { continueDocumentProposal, prepareDocumentProposal, prepareProposalApplication, applyDocumentProposal } from '../../../apps/web/src/features/design-trace/proposal-api.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1';
test('제안의 다른 주체·중단 화면·선택 없는 반영은 어떤 쓰기 요청도 만들지 않는다', async () => {
  const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) }, buffer: DocumentBuffer = { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, baseHash: 'a'.repeat(64), baseTitle: '원본', title: '원본', formRef: { id, version: 1, contentHash: 'b'.repeat(64) }, body: '# 제안\n변경', mediaType: 'text/markdown;charset=utf-8', content: { attachments: [], sections: [], sourceRefs: [] }, criteria: [], reason: '별도 제안', controlGeneration: 1, dirty: true, pending: null, savedRef: null, failure: null };
  const state = await prepareDocumentProposal(buffer, session); let requests = 0; const client = new ApiClient(async () => { requests++; return new Response('{}'); });
  await assert.rejects(continueDocumentProposal(client, state, { ...session, user: { id: project } }, () => {}, () => true), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_INPUT_INVALID');
  await assert.rejects(continueDocumentProposal(client, state, session, () => {}, () => false), (e: unknown) => (e as { code: string }).code === 'SAVE_CONTINUATION_PAUSED');
  await assert.rejects(prepareProposalApplication(client, state, session, false), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_SELECTION_REQUIRED');
  assert.equal(requests, 0);
});

test('수정 제안 선택은 원 문서의 고정 단계를 보존하고 단계가 바뀐 반영 명령은 전송하지 않는다', async () => {
  const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) }, stageNodeRef = { applicationId: project, nodeId: 'REQUIREMENTS' };
  const formRef = { id, version: 1, contentHash: 'b'.repeat(64) }, body = { artifactId: id, bytes: 3, contentHash: 'c'.repeat(64), mediaType: 'text/plain;charset=utf-8' }, content = { body, attachments: [], sections: [], sourceRefs: [] };
  const buffer: DocumentBuffer = { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, baseHash: 'a'.repeat(64), baseTitle: '원본', title: '원본', formRef, body: '변경', mediaType: body.mediaType, content: { attachments: [], sections: [], sourceRefs: [] }, criteria: [], reason: '별도 제안', controlGeneration: 1, dirty: true, pending: null, savedRef: null, failure: null, stageNodeRef };
  Object.assign(buffer, { baseStageNodeRef: stageNodeRef });
  await assert.rejects(prepareDocumentProposal({ ...buffer, stageNodeRef: null }, session), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_BASE_REQUIRED');
  const state = await prepareDocumentProposal(buffer, session);
  state.proposal = { id: project, baseRef: state.baseRef, proposedContentRef: body, diffRef: { ...body, mediaType: 'application/json;charset=utf-8' }, status: 'PENDING' };
  state.comparison = { proposal: { ...state.proposal, proposedContent: content, selections: [], reason: buffer.reason, createdAt: '2026-10-17T00:00:00Z', proposedBy: id }, base: { document: { title: buffer.title, formRef, stageNodeRef }, body: '원문' }, proposedBody: buffer.body } as any;
  let writes = 0;
  const client = new ApiClient(async (url, init) => {
    if (init?.method !== 'POST') return new Response(JSON.stringify({ id: project, participation: 'OWNER', controlState: { actorId: id, clientId: id, generation: 1, status: 'HELD' } }), { headers: { 'content-type': 'application/json' } });
    writes++; const command = JSON.parse(String(init.body)), ref = { id, version: 3, contentHash: contentHash(canonicalJson({ title: buffer.title, formRef, stageNodeRef, content })) };
    return new Response(JSON.stringify({ commandId: command.commandId, projectId: project, status: 'APPLIED', operationId: id, targetId: id, version: 3, serverReceivedAt: '2026-10-17T00:00:00Z', data: { ref, status: 'DRAFT', proposalRef: project } }), { headers: { 'content-type': 'application/json' } });
  });
  state.applyCommand = await prepareProposalApplication(client, state, session, true);
  assert.deepEqual(state.applyCommand.payload.stageNodeRef, stageNodeRef);
  await assert.rejects(applyDocumentProposal(client, { ...state, applyCommand: { ...state.applyCommand, payload: { ...state.applyCommand.payload, stageNodeRef: null } } }, session, () => true));
  assert.equal(writes, 0);
  const result = await applyDocumentProposal(client, state, session, () => true);
  assert.equal(result.version, 3); assert.equal(writes, 1);
});

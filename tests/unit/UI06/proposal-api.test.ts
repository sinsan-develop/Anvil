import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import type { DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
import { continueDocumentProposal, prepareDocumentProposal, prepareProposalApplication } from '../../../apps/web/src/features/design-trace/proposal-api.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1';
test('제안의 다른 주체·중단 화면·선택 없는 반영은 어떤 쓰기 요청도 만들지 않는다', async () => {
  const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) }, buffer: DocumentBuffer = { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, baseHash: 'a'.repeat(64), baseTitle: '원본', title: '원본', formRef: { id, version: 1, contentHash: 'b'.repeat(64) }, body: '# 제안\n변경', mediaType: 'text/markdown;charset=utf-8', content: { attachments: [], sections: [], sourceRefs: [] }, criteria: [], reason: '별도 제안', controlGeneration: 1, dirty: true, pending: null, savedRef: null, failure: null };
  const state = await prepareDocumentProposal(buffer, session); let requests = 0; const client = new ApiClient(async () => { requests++; return new Response('{}'); });
  await assert.rejects(continueDocumentProposal(client, state, { ...session, user: { id: project } }, () => {}, () => true), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_INPUT_INVALID');
  await assert.rejects(continueDocumentProposal(client, state, session, () => {}, () => false), (e: unknown) => (e as { code: string }).code === 'SAVE_CONTINUATION_PAUSED');
  await assert.rejects(prepareProposalApplication(client, state, session, false), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_SELECTION_REQUIRED');
  assert.equal(requests, 0);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { runDraftAction } from '../../../apps/web/src/features/project-create/api.ts';

const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', other = '51c0439f-791e-4bb5-8471-70938d6afaf1';
test('생성/검토 클라이언트는 현재 초안과 다른 대상·임의 연산을 전송하지 않는다', async () => {
  let calls = 0;
  const client = new ApiClient(async () => { calls++; return new Response('{}', { headers: { 'content-type': 'application/json' } }); });
  const body = { schemaVersion: 1, commandId: id, clientId: id, draftId: other, draftVersion: 1 };
  const invalid = (error: unknown) => error instanceof ApiError && error.code === 'CLIENT_PATH_INVALID';
  await assert.rejects(runDraftAction(client, { kind: 'create', draftId: id, body }, 'C'.repeat(43), id), invalid);
  await assert.rejects(runDraftAction(client, { kind: 'review', draftId: id, body: { schemaVersion: 1, commandId: id, clientId: id, targetId: id, expectedVersion: 1, operation: 'executeAgent', payload: {} } }, 'C'.repeat(43), id), invalid);
  assert.equal(calls, 0);
});

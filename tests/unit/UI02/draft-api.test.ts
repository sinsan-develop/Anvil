import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { writeProjectDraft } from '../../../apps/web/src/features/project-create/api.ts';

test('초안 변경은 정확 상대 경로·명시 CSRF·동일 origin만 사용하며 잘못된 ID/비밀 없는 요청은 전송하지 않는다', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
  const result = { draftId: id, version: 1, step: 1, input: { name: 'QA', purpose: '', desiredOutcome: '', sourceMode: 'EMPTY', methodologySelection: null, artifactRefs: [] } };
  const client = new ApiClient(async (path, init) => { calls.push({ path: String(path), init: init! }); return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } }); });
  assert.deepEqual(await writeProjectDraft(client, null, { commandId: id }, 'C'.repeat(43)), result);
  assert.equal(calls[0]!.path, '/api/v1/project-drafts');
  assert.equal(calls[0]!.init.method, 'POST'); assert.equal(calls[0]!.init.credentials, 'same-origin');
  assert.equal(calls[0]!.init.redirect, 'error'); assert.equal(calls[0]!.init.cache, 'no-store');
  assert.equal((calls[0]!.init.headers as Record<string, string>)['X-Anvil-CSRF'], 'C'.repeat(43));
  await assert.rejects(writeProjectDraft(client, 'https://other.invalid', {}, 'C'.repeat(43)), /경로|처리/);
  await assert.rejects(writeProjectDraft(client, null, {}, ''), /로그인/);
  assert.equal(calls.length, 1);
});

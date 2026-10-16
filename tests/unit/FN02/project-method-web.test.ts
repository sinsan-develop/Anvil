import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { prepareProjectMethod, writeProjectMethod } from '../../../apps/web/src/features/methodology-editor/project-api.ts';
const pid = 'a6f20000-0000-4000-8000-000000000010', user = 'a6f20000-0000-4000-8000-000000000011', cid = 'a6f20000-0000-4000-8000-000000000012';
const session = { user: { id: user }, clientId: cid, csrfToken: 'A'.repeat(43) };
const command = { schemaVersion: 1 as const, commandId: 'a6f20000-0000-4000-8000-000000000013', clientId: cid, operation: 'copyMethodology' as const, targetId: null, expectedVersion: 0, payload: { sourceRef: { id: 'a6f20000-0000-4000-8000-000000000001', version: 2, contentHash: 'b'.repeat(64) }, name: '전용본', scope: 'PROJECT', reason: '원본 보존' } };
// 결함 검출: 옛 제어/다른 프로젝트로 전송, 응답 유실 뒤 새 명령 생성, 위장 성공 receipt 수용.
test('전용 방법론 명령은 현재 제어를 고정하고 유실 뒤 동일 명령만 재확인한다', async () => {
  const requests: any[] = []; let lost = true;
  const client = new ApiClient(async (url, init) => {
    if (init?.method === 'GET') return Response.json({ id: pid, participation: 'OWNER', controlState: { actorId: user, clientId: cid, generation: 7, status: 'HELD' } });
    assert.equal(url, '/api/v1/projects/' + pid + '/commands'); requests.push(JSON.parse(String(init?.body)));
    if (lost) { lost = false; throw Error('synthetic-receipt-lost'); }
    return Response.json({ operationId: cid, commandId: command.commandId, projectId: pid, status: 'APPLIED', targetId: user, version: 1, data: { ref: { id: user, version: 1, contentHash: 'b'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: '2026-10-17T00:00:00.000Z' });
  });
  const prepared = await prepareProjectMethod(client, pid, session, command);
  assert.equal(prepared.controlGeneration, 7); assert.equal(prepared.projectId, pid);
  await assert.rejects(writeProjectMethod(client, prepared, session.csrfToken), (e: unknown) => e instanceof ApiError && e.code === 'CONNECTION_LOST');
  assert.equal((await writeProjectMethod(client, prepared, session.csrfToken)).data.ref.version, 1);
  assert.deepEqual(requests[0], requests[1]);
  const wrong = new ApiClient(async () => Response.json({ status: 'APPLIED', projectId: cid }));
  await assert.rejects(writeProjectMethod(wrong, prepared, session.csrfToken));
});

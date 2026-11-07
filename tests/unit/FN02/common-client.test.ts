import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { writeCommonMethod, type MethodCommand } from '../../../apps/web/src/features/methodology-editor/common-api.ts';

const owner = 'a6f20000-0000-4000-8000-000000000001', target = 'a6f20000-0000-4000-8000-000000000099';
const command: MethodCommand = { schemaVersion: 1, commandId: 'a6f20000-0000-4000-8000-000000000002', clientId: owner, operation: 'saveMethodologyDraft', targetId: target, expectedVersion: 1, payload: {} };
const receipt = { scopeKind: 'USER_COMMON', ownerUserId: owner, operationId: 'a6f20000-0000-4000-8000-000000000088', commandId: command.commandId, status: 'APPLIED', targetId: target, version: 2,
  data: { ref: { id: target, version: 2, contentHash: 'a'.repeat(64) }, status: 'DRAFT' }, serverReceivedAt: '2026-10-16T00:00:00Z' };
test('공통본 쓰기는 상대 경로·명시 CSRF만 전송하고 정확 owner/명령/버전 receipt만 채택한다', async () => {
  const client = new ApiClient(async (url, init) => {
    assert.equal(url, '/api/v1/user-common/commands'); assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store');
    assert.equal((init?.headers as Record<string, string>)['X-Anvil-CSRF'], 'A'.repeat(43));
    assert.deepEqual(JSON.parse(String(init?.body)), command);
    return Response.json(receipt);
  });
  assert.deepEqual(await writeCommonMethod(client, command, 'A'.repeat(43), owner), { id: target, version: 2, contentHash: 'a'.repeat(64) });
  for (const body of [null, {}, { ...receipt, data: undefined }, { ...receipt, ownerUserId: target }, { ...receipt, commandId: target }, { ...receipt, version: 3 }, { ...receipt, data: { ...receipt.data, ref: { ...receipt.data.ref, version: 1 } } }]) {
    await assert.rejects(writeCommonMethod(new ApiClient(async () => Response.json(body)), command, 'A'.repeat(43), owner), (error: unknown) => error instanceof ApiError && error.code === 'RESPONSE_INVALID');
  }
});
test('응답 단절이나 HTML을 저장 성공으로 해석하거나 자동 재전송하지 않는다', async () => {
  let calls = 0;
  await assert.rejects(writeCommonMethod(new ApiClient(async () => { calls++; throw Error('network'); }), command, 'A'.repeat(43), owner), (error: unknown) => error instanceof ApiError && error.code === 'CONNECTION_LOST');
  assert.equal(calls, 1);
  await assert.rejects(writeCommonMethod(new ApiClient(async () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } })), command, 'A'.repeat(43), owner), (error: unknown) => error instanceof ApiError && error.code === 'RESPONSE_INVALID');
});

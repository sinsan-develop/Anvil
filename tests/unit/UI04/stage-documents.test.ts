import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { listDocuments } from '../../../apps/web/src/features/design-trace/api.ts';
const pid = 'a6f20400-0000-4000-8000-000000000201', aid = 'a6f20400-0000-4000-8000-000000000301';
test('선택 단계 목록은 정확 application/node와 cursor만 같은 origin GET에 넣는다', async () => {
  const urls: string[] = [], client = new ApiClient(async (url, init) => { assert.equal(init?.method, 'GET'); urls.push(String(url)); return Response.json({ items: [], hasMore: false, nextCursor: null, observedAt: '2026-10-17T01:02:03Z' }); });
  await listDocuments(client, pid, 'cursor-one', { applicationId: aid, nodeId: '요구 / 검토' });
  const url = new URL(urls[0]!, 'https://anvil.invalid'); assert.equal(url.pathname, `/api/v1/projects/${pid}/documents`); assert.deepEqual(Object.fromEntries(url.searchParams), { limit: '50', cursor: 'cursor-one', applicationId: aid, nodeId: '요구 / 검토' });
});
test('불완전 단계 참조는 API를 호출하지 않으며 기존 무필터는 유지한다', async () => {
  let calls = 0; const client = new ApiClient(async () => { calls++; return Response.json({ items: [], hasMore: false, nextCursor: null, observedAt: '2026-10-17T01:02:03Z' }); });
  await assert.rejects(listDocuments(client, pid, null, { applicationId: aid } as any), { code: 'CLIENT_PATH_INVALID' }); assert.equal(calls, 0);
  await listDocuments(client, pid, null); assert.equal(calls, 1);
});

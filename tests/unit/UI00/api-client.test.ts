import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';

test('same-origin API만 요청하고 cookie·redirect·cache 경계를 고정한다', async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  const client = new ApiClient(async (path, init) => {
    calls.push({ path: String(path), init });
    return new Response(JSON.stringify({ items: [] }), { headers: { 'content-type': 'application/json' } });
  });
  assert.deepEqual(await client.get('/api/v1/projects'), { items: [] });
  assert.equal(calls[0]?.path, '/api/v1/projects');
  assert.equal(calls[0]?.init?.credentials, 'same-origin');
  assert.equal(calls[0]?.init?.redirect, 'error');
  assert.equal(calls[0]?.init?.cache, 'no-store');
  for (const path of ['https://other.test/api/v1/projects', '//other.test/api', '/assets/x', '/api/v1/../secret', '/api/v1/%2e%2e/secret', '/api/v1/projects#token']) {
    await assert.rejects(client.get(path), (e: unknown) => e instanceof ApiError && e.code === 'CLIENT_PATH_INVALID');
  }
  assert.equal(calls.length, 1, '거절된 경로는 전송되지 않는다');
});

test('인증 만료·금지·버전충돌·저장 실패를 빈 성공으로 숨기지 않고 비밀 오류 원문을 노출하지 않는다', async () => {
  for (const [status, code] of [[401, 'AUTH_REQUIRED'], [403, 'FORBIDDEN'], [409, 'VERSION_CONFLICT'], [503, 'STORAGE_FAILED']] as const) {
    const client = new ApiClient(async () => new Response(JSON.stringify({ code, message: 'secret-value-and-internal-path', requestId: 'req-1' }), { status, headers: { 'content-type': 'application/json' } }));
    await assert.rejects(client.get('/api/v1/session'), (error: unknown) => {
      assert(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.requestId, 'req-1');
      assert(!error.message.includes('secret-value'));
      return true;
    });
  }
});

test('네트워크 실패를 자동 재전송하지 않고 HTML·잘못된 JSON을 성공 데이터로 쓰지 않는다', async () => {
  let attempts = 0;
  const client = new ApiClient(async () => { attempts++; throw new TypeError('private endpoint'); });
  await assert.rejects(client.get('/api/v1/session'), (e: unknown) => e instanceof ApiError && e.code === 'CONNECTION_LOST' && !e.message.includes('private'));
  assert.equal(attempts, 1);
  for (const response of [new Response('<html>not data</html>', { headers: { 'content-type': 'text/html' } }), new Response('{bad', { headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(new ApiClient(async () => response).get('/api/v1/session'), (e: unknown) => e instanceof ApiError && e.code === 'RESPONSE_INVALID');
  }
});

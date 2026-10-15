import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../../apps/server/app.ts';

test('health는 프로세스 확인이며 제품이나 DB ready로 응답하지 않는다', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ url: '/api/v1/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok', scope: 'process', version: '0.1.0' });
    assert.equal(response.headers['cache-control'], 'no-store');
  } finally { await app.close(); }
});

test('미구현 API를 HTML 또는 성공으로 숨기지 않고 구조화404를 반환한다', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ url: '/api/v1/projects' });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().code, 'NOT_FOUND');
    assert.equal(response.json().retryDisposition, 'not-retryable');
    assert.ok(response.json().requestId);
  } finally { await app.close(); }
});

test('파일 읽기 실패에서 서버 경로나 오류 원문을 노출하지 않는다', async () => {
  const app = buildApp({}, new URL('./not-present-web-root/', import.meta.url));
  try {
    const response = await app.inject({ url: '/' });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, 'STORAGE_FAILED');
    assert.doesNotMatch(response.body, /ENOENT|not-present|[A-Z]:\\/);
  } finally { await app.close(); }
});

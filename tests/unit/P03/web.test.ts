import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../../apps/server/app.ts';

test('실제 build 화면·동일 origin 자산을 제공하며 API/임의파일로 fallback하지 않는다', async () => {
  const app = buildApp({}, new URL('../../../apps/web/dist/', import.meta.url));
  try {
    const html = await app.inject({ url: '/', headers: { accept: 'text/html' } });
    assert.equal(html.statusCode, 200);
    assert.match(html.headers['content-type'] ?? '', /text\/html/);
    assert.match(html.headers['content-security-policy'] ?? '', /connect-src 'self'/);
    const script = html.body.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
    assert.ok(script);
    const js = await app.inject({ url: script });
    assert.equal(js.statusCode, 200);
    assert.match(js.headers['content-type'] ?? '', /javascript/);
    for (const url of ['/api/v1/missing', '/.git/config', '/assets/%2e%2e%2fpackage.json']) {
      assert.equal((await app.inject({ url })).statusCode, 404);
    }
  } finally { await app.close(); }
});

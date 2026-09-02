import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

test('public proxy forwards auth routes to the API upstream and preserves Host', async () => {
  let receivedHost;
  const upstream = http.createServer((request, response) => {
    receivedHost = request.headers.host;
    response.writeHead(200, {'content-type': 'application/json', connection: 'close'});
    response.end(JSON.stringify({ok: true, host: receivedHost}));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const address = upstream.address();
  process.env.ANVIL_API_UPSTREAM = `http://127.0.0.1:${address.port}`;
  const {startWorkbenchServer} = await import(`../server.mjs?auth-proxy=${Date.now()}`);
  const runtime = await startWorkbenchServer({host: '127.0.0.1', port: 0});
  try {
    const response = await new Promise((resolve, reject) => {
      const request = http.request(`${runtime.origin}/auth/session?scope=sse`, {
        headers: {host: 'public.example.test'},
      }, resolve);
      request.on('error', reject);
      request.end();
    });
    let body = '';
    for await (const chunk of response) body += chunk;
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(body), {ok: true, host: 'public.example.test'});
    assert.equal(receivedHost, 'public.example.test');
  } finally {
    await runtime.close();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

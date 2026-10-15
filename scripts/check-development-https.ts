import { get } from 'node:https';
import { readFileSync } from 'node:fs';

const ca = readFileSync('D:/Project/Anvil/.av3-data/dev-tls/ca.cert.pem');
await new Promise<void>(resolve => {
  const request = get({ hostname: '127.0.0.1', port: 3830, path: '/api/v1/health', ca, rejectUnauthorized: true, agent: false }, response => {
    let body = '';
    response.on('data', part => {
      body += part;
      if (body.length > 4096) request.destroy(new Error('HEALTH_RESPONSE_TOO_LARGE'));
    });
    response.on('end', () => {
      try {
        const value = JSON.parse(body);
        if (response.statusCode !== 200 || value.status !== 'ok' || value.scope !== 'process') throw Error('HEALTH_INVALID');
        console.log('DEVELOPMENT_HTTPS_PROBE_OK');
      } catch { process.exitCode = 1; }
      resolve();
    });
  });
  request.setTimeout(2000, () => request.destroy(new Error('LOCAL_TLS_TIMEOUT')));
  request.on('error', error => {
    process.exitCode = 'code' in error && error.code === 'ECONNREFUSED' ? 2 : 1;
    resolve();
  });
});

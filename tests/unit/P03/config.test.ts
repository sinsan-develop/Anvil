import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../../../apps/server/config.ts';

test('TLS 파일이나 보호된 DB 참조가 없으면 시작하지 않는다', () => {
  assert.throws(() => readConfig({}), /CONFIG_INVALID/);
});

test('공통 3830 외 임의 포트와 외부 바인딩을 거절한다', () => {
  const valid = { ANVIL_TLS_KEY: 'key.pem', ANVIL_TLS_CERT: 'cert.pem', ANVIL_DB_CONFIG: 'db.json' };
  assert.throws(() => readConfig({ ...valid, ANVIL_PORT: '3770' }), /CONFIG_INVALID/);
  assert.throws(() => readConfig({ ...valid, ANVIL_HOST: '0.0.0.0' }), /CONFIG_INVALID/);
  assert.equal(readConfig(valid).port, 3830);
  assert.equal(readConfig(valid).host, '127.0.0.1');
});

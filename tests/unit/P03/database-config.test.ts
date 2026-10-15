import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';

test('승인한 endpoint·DB·역할이 아닌 보호 설정은 쓰기 전에 거절한다', () => {
  const valid = { host: '127.0.0.1', port: 5546, database: 'anvil_v3_development', user: 'anvil_v3_app', password: 'a'.repeat(64), application_name: 'anvil-v3-development', connectionTimeoutMillis: 5000 };
  assert.equal(validateDevelopmentDbConfig(valid, 'app').port, 5546);
  for (const wrong of [null, {}, { ...valid, host: 'remote-server' }, { ...valid, port: undefined },
    { ...valid, database: 'another' }, { ...valid, user: 'anvil_v3_bootstrap' }, { ...valid, ssl: false }]) {
    assert.throws(() => validateDevelopmentDbConfig(wrong, 'app'), /DB_TARGET_INVALID/);
  }
  assert.throws(() => validateDevelopmentDbConfig(valid, 'migrator'), /DB_TARGET_INVALID/);
});

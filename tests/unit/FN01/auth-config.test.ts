import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAuthConfig } from '../../../apps/server/modules/access/config.ts';

test('독립 서버 보호 key·설치ID·정확 HTTPS Origin만 인증 실행 설정으로 받는다', () => {
  const sample = { kind: 'ANVIL_AUTH_KEY_V1', installationId: '32b5f276-13e6-4d8a-b93f-27a15d21c788', fingerprintKey: '12'.repeat(32), origin: 'https://localhost:3830' };
  const result = validateAuthConfig(sample);
  assert.equal(result.installationId, sample.installationId);
  assert.equal(result.key.length, 32);
  assert.equal(result.origin, 'https://localhost:3830');
  for (const input of [{ ...sample, origin: 'http://localhost:3830' }, { ...sample, origin: 'https://other.invalid' }, { ...sample, fingerprintKey: 'weak' }, { ...sample, bootstrapSecret: 'not a runtime field' }, { ...sample, installationId: '-'.repeat(36) }]) assert.throws(() => validateAuthConfig(input), /AUTH_CONFIG_INVALID/);
});

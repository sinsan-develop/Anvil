import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertResourceAbsent, assertNewResourceLabels } from '../../../scripts/development-resource-guards.ts';

test('기존 동명 자원과 소유 표식이 다른 생성 결과를 채택하지 않는다', () => {
  assert.doesNotThrow(() => assertResourceAbsent('other\n', 'anvil-v3-development-pgdata'));
  assert.throws(() => assertResourceAbsent('other\nanvil-v3-development-pgdata\n', 'anvil-v3-development-pgdata'), /RESOURCE_ALREADY_EXISTS/);
  assert.throws(() => assertResourceAbsent(undefined, 'target'), /RESOURCE_QUERY_INVALID/);
  assert.throws(() => assertNewResourceLabels({ 'anvil.project': 'v3', 'anvil.owner': 'P03', 'anvil.instance': 'old' }, 'new'), /RESOURCE_OWNERSHIP_MISMATCH/);
  assert.throws(() => assertNewResourceLabels(null, 'new'), /RESOURCE_OWNERSHIP_MISMATCH/);
});

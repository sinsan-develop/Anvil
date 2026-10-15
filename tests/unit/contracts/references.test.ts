import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVersionRef } from '../../../contracts/references.ts';

test('VersionRef의 잘못된 ID·hash·세대·추가 권한 필드를 거절한다', () => {
  const valid = { id: '10000000-0000-4000-8000-000000000001', version: 1, contentHash: 'a'.repeat(64) };
  assert.equal(isVersionRef(valid), true);
  for (const value of [null, {}, { ...valid, id: '../secret' }, { ...valid, version: 0 },
    { ...valid, contentHash: 'bad' }, { ...valid, approved: true }]) assert.equal(isVersionRef(value), false);
});

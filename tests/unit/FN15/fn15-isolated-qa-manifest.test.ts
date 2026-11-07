import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modulePath = '../../../scripts/fn15-isolated-qa-manifest.ts';
const manifestModule = await import(modulePath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
assert.equal(typeof manifestModule.buildFn15QaManifest, 'function', 'manifest export가 있어야 한다');
assert.equal(typeof manifestModule.readFn15QaManifest, 'function', '고정 source reader export가 있어야 한다');

function sourceBytes() {
  const names = [
    '0000_environment.sql', '0001_projects_access.sql',
    '0017_execution_authority.sql', '0025_result_submissions.sql',
    '0041_control_handoff_source.sql.pending',
  ] as const;
  const sources: Record<string, Buffer> = {};
  for (const name of names) {
    sources[name] = readFileSync(new URL(`../../../db/migrations/${name}`, import.meta.url));
  }
  return sources;
}

test('원본 바이트만 고정 manifest를 만들고 7 helper만 발췌한다', () => {
  const expected = manifestModule.buildFn15QaManifest(sourceBytes());
  const actual = manifestModule.readFn15QaManifest();
  assert.deepEqual(actual, expected);
  assert.equal(actual.helpers.status, 'PARTIAL_HELPERS_ONLY');
  assert.equal(actual.helpers.blocks.length, 7);
  assert.equal(actual.helpers.byteLength, 4250);
  assert.equal(actual.helpers.sha256, '282F65A34BEDE0D3A086307BBBC66A6C43C69AFA8CDDCDF1EF9AE8D8C9D71D0F');
  assert.equal(Buffer.byteLength(actual.helpers.sql, 'utf8'), 4250);
  assert.equal((actual.helpers.sql.match(/CREATE FUNCTION /g) ?? []).length, 7);
  assert.equal(actual.helpers.sql.includes('CREATE TABLE '), false);
  assert.deepEqual(actual.ledger.map((entry: { id: string }) => entry.id), [
    '0000_environment', '0001_projects_access', '0041_control_handoff_source',
  ]);
  assert.equal(actual.ledger.some((entry: { id: string }) => entry.id.startsWith('0017') || entry.id.startsWith('0025')), false);
});

test('원본 1바이트 변경과 함수 복제·누락은 통과하지 못한다', () => {
  const original = sourceBytes();
  for (const name of Object.keys(original)) {
    const bytes = original[name];
    assert.ok(bytes);
    const changedBytes = Buffer.from(bytes);
    const firstByte = changedBytes[0];
    if (firstByte === undefined) throw new Error('SOURCE_EMPTY');
    changedBytes[0] = firstByte ^ 1;
    const changed = { ...original, [name]: changedBytes };
    assert.throws(() => manifestModule.buildFn15QaManifest(changed), name);
  }
  const sourceBuffer = original['0017_execution_authority.sql'];
  assert.ok(sourceBuffer);
  const source = sourceBuffer.toString('utf8');
  const first = source.match(/CREATE FUNCTION anvil\.execution_authority_number[\s\S]*?\$\$;\n/);
  assert.ok(first);
  assert.ok(first[0]);
  assert.throws(() => manifestModule.buildFn15QaManifest({ ...original,
    '0017_execution_authority.sql': Buffer.from(source + first[0]) }));
  assert.throws(() => manifestModule.buildFn15QaManifest({ ...original,
    '0017_execution_authority.sql': Buffer.from(source.replace(first[0], '')) }));
});

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// 실제 metadata/FS fixture 없이 숫자 stream만 집계한다.
// 중복 inode 과대계산, 부분 성공, 잘못된 필드 수락을 잡는 행동 시험이다.
const bash = 'C:/Program Files/Git/bin/bash.exe';
const source = fileURLToPath(new URL('../../../scripts/pg-recovery-discovery-readonly.sh', import.meta.url));
const shellSource = source.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
const env = { SystemRoot: process.env.SystemRoot, PATH: 'C:/Program Files/Git/usr/bin;C:/Program Files/Git/bin', BASH_ENV: '', ENV: '', LC_ALL: 'C' };

function invoke(command: string, input = '') {
  assert.ok(existsSync(bash), 'LOCAL_GIT_BASH_REQUIRED_NOT_INSTALLED_BY_TEST');
  assert.ok(existsSync(source), 'PREPARATION_SOURCE_MISSING');
  const result = spawnSync(bash, ['--noprofile', '--norc', '-c', `source '${shellSource}'; ${command}`], {
    input, encoding: 'utf8', env, timeout: 15000, maxBuffer: 8192,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stderr, '');
  return result;
}
function aggregate(input: string) {
  const result = invoke('p03_aggregate', input);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.shift(), 'PREPARATION_ONLY');
  const value = JSON.parse(lines.join('\n'));
  return { status: result.status, value };
}
function fail(input: string, status: string) {
  const result = aggregate(input);
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.value, { status, complete: false });
}

test('import는 준비 상태만 출력하며 실제 조사를 시작하지 않는다', () => {
  const result = invoke(':');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'PREPARATION_ONLY\n');
});
test('종류별 entry와 고유 inode 및 regular 논리/할당 bytes를 구별한다', () => {
  const result = aggregate('d 1 1 1000 1000 700 4096 8\nf 1 2 1000 1000 600 10 8\nf 1 2 1000 1000 600 10 8\nl 1 3 1000 1000 777 7 0\np 1 4 1000 1000 600 0 0\nEND 0\n');
  assert.equal(result.status, 0);
  assert.deepEqual(result.value, { status: 'METADATA_COMPLETE', complete: true, entries: 5, uniqueInodes: 4,
    regularEntries: 2, directoryEntries: 1, symlinkEntries: 1, specialEntries: 1,
    regularUniqueInodes: 1, regularLogicalBytes: 10, regularAllocatedBytes: 4096 });
});
test('device가 다르면 같은 inode 숫자도 별개로 합산한다', () => {
  const result = aggregate('f 1 9 999 999 600 12 1\nf 2 9 999 999 600 8 2\nEND 0\n');
  assert.equal(result.value.uniqueInodes, 2);
  assert.equal(result.value.regularLogicalBytes, 20);
  assert.equal(result.value.regularAllocatedBytes, 1536);
});
test('순회실패·종결누락·종결뒤 자료는 부분 성공을 반환하지 않는다', () => {
  fail('f 1 2 999 999 600 5 1\nEND 1\n', 'TRAVERSAL_FAILED');
  fail('f 1 2 999 999 600 5 1\n', 'TRAVERSAL_FAILED');
  fail('END 0\nf 1 2 999 999 600 5 1\n', 'INVALID_METADATA');
});
test('파일명·명령문·음수·필드손상은 원문 출력 없이 거절한다', () => {
  for (const input of ['f 1 2 999 999 600 5 1 filename\nEND 0\n', 'f 1 2 999 999 600 $(id) 1\nEND 0\n',
    'f 1 2 999 999 600 -1 1\nEND 0\n', 'f 1 2 999 999 999 1 1\nEND 0\n', 'q 1 2 999 999 600 1 1\nEND 0\n']) fail(input, 'INVALID_METADATA');
});
test('hardlink의 상충 metadata는 실패한다', () => {
  fail('f 1 2 999 999 600 5 1\nf 1 2 999 999 600 6 1\nEND 0\n', 'INODE_METADATA_CONFLICT');
});
test('안전정수와 합산/blocks 곱 상한을 넘어가면 실패한다', () => {
  fail('f 1 2 999 999 600 9007199254740992 1\nEND 0\n', 'NUMERIC_LIMIT');
  fail('f 1 2 999 999 600 1 17592186044416\nEND 0\n', 'NUMERIC_LIMIT');
  fail('f 1 2 999 999 600 9007199254740991 0\nf 1 3 999 999 600 1 0\nEND 0\n', 'NUMERIC_LIMIT');
});
test('entry 100000까지 허용하되 초과는 부분 집계 없이 실패한다', () => {
  const row = 'f 1 2 999 999 600 1 0\n';
  const accepted = aggregate(row.repeat(100000) + 'END 0\n');
  assert.equal(accepted.status, 0);
  assert.equal(accepted.value.entries, 100000);
  assert.equal(accepted.value.regularLogicalBytes, 1);
  fail(row.repeat(100001) + 'END 0\n', 'ENTRY_LIMIT');
});

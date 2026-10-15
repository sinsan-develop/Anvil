import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPostgresReady } from '../../../scripts/development-resource-guards.ts';

test('초기화 중 socket-only 서버를 최종 TCP 서버 준비로 오인하지 않는다', () => {
  const temporarySocketOnly = (args: string[]) => {
    if (args.includes('-h')) throw Error('TCP_NOT_READY');
    return 'accepting connections';
  };
  assert.throws(() => checkPostgresReady(temporarySocketOnly, 'test-pg', 'test-db'), /TCP_NOT_READY/);
  assert.doesNotThrow(() => checkPostgresReady(() => 'accepting connections', 'test-pg', 'test-db'));
});

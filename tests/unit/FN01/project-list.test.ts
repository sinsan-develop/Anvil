import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { ProjectListCodec, projectListFilter } from '../../../apps/server/modules/projects/service.ts';

test('프로젝트 목록은 유한 페이지와 필터만 받고 cursor를 주체/필터/정확 시각에 결박한다', () => {
  assert.deepEqual(projectListFilter({}), { query: '', archived: false, limit: 50 });
  for (const input of [{ limit: '201' }, { limit: '0' }, { archived: 'yes' }, { archived: true }, { query: 'x'.repeat(201) }, { owner: 'someone' }]) assert.throws(() => projectListFilter(input), /INPUT_INVALID/);
  const sign = (value: string) => createHmac('sha256', Buffer.alloc(32, 12)).update(value).digest('hex');
  const codec = new ProjectListCodec(sign);
  const filter = projectListFilter({ query: 'Anvil', limit: '2' });
  const last = { at: '2026-10-16T01:02:03.456789Z', id: '32b5f276-13e6-4d8a-b93f-27a15d21c788' };
  const now = new Date('2026-10-16T01:02:04Z');
  const cursor = codec.create('owner-a', filter, last, now);
  assert.deepEqual(codec.read(cursor, 'owner-a', filter, now), last);
  assert.throws(() => codec.read(cursor, 'owner-b', filter, now), /CURSOR_INVALID/);
  assert.throws(() => codec.read(cursor, 'owner-a', { ...filter, query: 'other' }, now), /CURSOR_INVALID/);
  assert.throws(() => codec.read(cursor, 'owner-a', { ...filter, limit: 3 }, now), /CURSOR_INVALID/);
  assert.throws(() => codec.read(cursor + 'x', 'owner-a', filter, now), /CURSOR_INVALID/);
  assert.throws(() => codec.read(cursor, 'owner-a', filter, new Date('2026-10-17T01:02:04Z')), /CURSOR_INVALID/);
});

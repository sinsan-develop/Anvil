import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { methodListFilter, MethodListCodec } from '../../../apps/server/modules/methodologies/list-page.ts';

test('방법론 cursor는 사용자·이름/범위/상태/limit·기한·정확 정렬 위치에 결박된다', () => {
  const owner = 'a6f20000-0000-4000-8000-000000000001', other = 'a6f20000-0000-4000-8000-000000000002';
  assert.deepEqual(methodListFilter({}), { scope: null, name: '', status: null, limit: 50 });
  for (const value of [{ limit: '201' }, { limit: '0' }, { limit: 2 }, { scope: 'PROJECT' }, { status: 'FAKE' }, { owner }, { name: 'a'.repeat(201) }]) assert.throws(() => methodListFilter(value));
  const codec = new MethodListCodec(value => createHmac('sha256', Buffer.alloc(32, 5)).update('method-list:v1:' + value).digest('hex'));
  const filter = methodListFilter({ scope: 'SYSTEM', name: '방법론', status: 'DRAFT', limit: '2' }), last = { key: 'SYS-M02', id: other }, now = new Date('2026-10-16T01:02:03Z');
  const cursor = codec.create(owner, filter, last, now); assert.deepEqual(codec.read(cursor, owner, filter, now), last);
  assert.throws(() => codec.read(cursor, other, filter, now), /CURSOR_INVALID/);
  for (const changed of [{ ...filter, scope: null }, { ...filter, name: '' }, { ...filter, status: null }, { ...filter, limit: 3 }]) assert.throws(() => codec.read(cursor, owner, changed, now), /CURSOR_INVALID/);
  assert.throws(() => codec.read(cursor + 'x', owner, filter, now), /CURSOR_INVALID/);
  assert.throws(() => codec.read(cursor, owner, filter, new Date('2026-10-16T01:32:03Z')), /CURSOR_INVALID/);
  assert.throws(() => codec.create(owner, filter, { key: 'arbitrary', id: other }, now), /CURSOR_INVALID/);
});

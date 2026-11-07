import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const file = new URL('../../../apps/web/src/features/workspace/context-observation.ts', import.meta.url), module = existsSync(file) ? await import(file.href) : {};
test('새 관측 시작은 이전 metadata/목록을 지우고 실패 뒤 옛 관측 응답이 되살리지 못한다', () => {
 assert.equal(typeof module.contextObservation, 'function'); const initial = { sequence: 0, opened: null, page: null };
 const first = module.contextObservation(module.contextObservation(initial, { kind: 'BEGIN', sequence: 1 }), { kind: 'OPENED', sequence: 1, value: { ref: '과거 후보' } });
 assert.deepEqual(first.opened, { ref: '과거 후보' });
 const refreshing = module.contextObservation(first, { kind: 'BEGIN', sequence: 2 }); assert.equal(refreshing.opened, null); assert.equal(refreshing.page, null);
 assert.deepEqual(module.contextObservation(refreshing, { kind: 'OPENED', sequence: 1, value: { ref: '늦은 이전 결과' } }), refreshing);
 const listed = module.contextObservation(refreshing, { kind: 'LISTED', sequence: 2, value: { items: ['최근'] } });
 const failedNext = module.contextObservation(listed, { kind: 'BEGIN', sequence: 3 }); assert.equal(failedNext.page, null); assert.equal(failedNext.opened, null);
 assert.deepEqual(module.contextObservation(failedNext, { kind: 'BEGIN', sequence: 2 }), failedNext);
});

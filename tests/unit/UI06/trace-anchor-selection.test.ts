import { test } from 'node:test';
import assert from 'node:assert/strict';
const url = new URL('../../../apps/web/src/features/design-trace/trace-anchor-selection.ts', import.meta.url);
const implementation = await import(url.href).catch((cause: NodeJS.ErrnoException) => { if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause; return {}; });
const context = { projectId: '11111111-1111-4111-8111-111111111111', documentRef: { id: '22222222-2222-4222-8222-222222222222', version: 2, contentHash: 'a'.repeat(64) }, bodyHash: 'b'.repeat(64) };
const endpoint = { kind: 'DESIGN_ITEM', id: '33333333-3333-4333-8333-333333333333', versionRef: { ...context.documentRef }, localCode: 'D01', anchor: 'line:2' };
function select(ref: unknown, c: unknown = context) { assert.equal(typeof implementation.traceAnchorSelection, 'function', '업무 연결의 원문 위치 선택이 필요합니다'); return implementation.traceAnchorSelection(c, ref); }

// 업무 ref의 항목 id를 문서 id로 오인하거나 현재 본문 hash 없이 선택하면 실패한다.
test('같은 설계 문서의 정확 버전·hash인 항목만 현재 원문 선택으로 연결한다', () => {
  assert.deepEqual(select(endpoint), { ...context, documentRef: { ...context.documentRef }, anchor: 'line:2' });
  assert.equal(select({ ...endpoint, kind: 'SCREEN_REGION' }), null);
  assert.equal(select({ ...endpoint, kind: 'PLAN_TASK' }), null);
  assert.equal(select(endpoint, { ...context, bodyHash: '' }), null);
});

test('다른 설계 문서/버전/hash와 잘못된 줄은 현재 문서로 대신 이동하지 않는다', () => {
  for (const versionRef of [{ ...context.documentRef, id: endpoint.id }, { ...context.documentRef, version: 1 }, { ...context.documentRef, contentHash: 'c'.repeat(64) }]) assert.equal(select({ ...endpoint, versionRef }), null);
  for (const anchor of ['line:0', 'line:01', 'line:2x', '<script>', 'line:100000000']) assert.equal(select({ ...endpoint, anchor }), null);
  assert.equal(select(endpoint, { ...context, projectId: '다른 프로젝트' }), null);
});

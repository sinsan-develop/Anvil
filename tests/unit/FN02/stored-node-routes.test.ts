import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MethodologyGraph } from '../../../contracts/methodologies.ts';

const file = new URL('../../../apps/web/src/features/methodology-editor/StoredNodeRoutes.tsx', import.meta.url);
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/methodology-editor/StoredNodeRoutes.tsx') : {};
function graph(): MethodologyGraph {
 const node = (nodeId: string, name: string): MethodologyGraph['nodes'][number] => ({ nodeId, name, purpose: '절차 원본 조회', kind: 'HUMAN', role: 'USER', position: { x: 0, y: 0 }, inputs: [], outputs: [], taskScope: { included: [], excluded: [] }, completionCriteria: ['내용 확인'], approvalBoundary: [], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['확인 기록'] });
 return { nodes: [node('A', '설계'), node('B', '내용 검토'), node('C', '완료 판단')], entryNodeId: 'A', terminalNodeIds: ['C'],
  edges: [{ edgeId: 'A-B', fromNodeId: 'A', toNodeId: 'B', kind: 'BRANCH', reason: '검토 단계로 이동', condition: { all: [{ fieldRef: { nodeId: 'A', field: 'REVIEW_OUTCOME' }, operator: 'IN', value: ['ACCEPTED', 'REWORK'] }] } },
   { edgeId: 'B-A', fromNodeId: 'B', toNodeId: 'A', kind: 'REWORK', reason: '설계 보완', condition: { fieldRef: { nodeId: 'B', field: 'USER_DECISION' }, operator: 'EQ', value: 'REWORK' }, retryPolicy: { maxAttempts: 2, onExhausted: 'USER_DECISION', counting: 'SAME_FAILURE_FINGERPRINT' } }] };
}
function render(value: MethodologyGraph, nodeId: string) { assert.equal(typeof module.StoredNodeRoutes, 'function'); return renderToStaticMarkup(createElement(module.StoredNodeRoutes, { graph: value, nodeId })); }
test('선택 단계의 실제 연결만 종류·대상·이유·복합 조건 원문과 함께 읽기 표시한다', () => {
 const value = graph(), before = JSON.stringify(value), html = render(value, 'A');
 for (const text of ['A-B', 'B', '내용 검토', '검토 단계로 이동', '조건 분기', 'REVIEW_OUTCOME', 'ACCEPTED', 'REWORK']) assert.ok(html.includes(text), text);
 assert.equal(html.includes('B-A'), false); assert.doesNotMatch(html, /<(button|input|select|textarea)\b/); assert.equal(JSON.stringify(value), before);
});
test('재작업의 저장된 유한 횟수·같은실패 집계·소진행동을 표시하고 실행으로 해석하지 않는다', () => {
 const html = render(graph(), 'B');
 for (const text of ['B-A', '설계 보완', '최대 2회', '같은 실패 원인 기준', '사용자 판단 요청', '조건 평가·작업 시작·자동 재시작이 아닙니다']) assert.ok(html.includes(text), text);
 assert.equal(html.includes('A-B'), false);
});
test('없는 선택·연결·종료점·누락 조건과 한도를 서로 구분하며 기본값으로 채우지 않는다', () => {
 const value = graph(); assert.ok(render(value, 'missing').includes('선택 단계 미확인'));
 const end = render(value, 'C'); assert.ok(end.includes('방법론에 지정된 종료점')); assert.ok(end.includes('후속 연결 없음')); assert.ok(end.includes('실제 완료 판정이 아닙니다'));
 const retry = value.edges[1]!; retry.condition = null; delete retry.retryPolicy;
 const html = render(value, 'B'); assert.ok(html.includes('조건 미작성')); assert.ok(html.includes('재작업 한도 미작성')); assert.equal(html.includes('최대 3회'), false);
});
test('없는 연결 대상과 HTML 형태 원문은 사실대로 표시하며 평가·숨김·HTML 실행하지 않는다', () => {
 const value = graph(); value.edges[0]!.toNodeId = 'gone'; value.edges[0]!.reason = '<script>alert(1)</script>';
 const html = render(value, 'A'); assert.ok(html.includes('gone')); assert.ok(html.includes('대상 단계 미확인')); assert.ok(html.includes('&lt;script&gt;')); assert.equal(html.includes('<script>'), false);
});

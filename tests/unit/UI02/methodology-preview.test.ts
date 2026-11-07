import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MethodVersion } from '../../../apps/web/src/features/methodology-editor/api.ts';
import { getMethod } from '../../../apps/web/src/features/methodology-editor/api.ts';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
const file = new URL('../../../apps/web/src/features/project-create/MethodologyPreview.tsx', import.meta.url);
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/project-create/MethodologyPreview.tsx') : {};
const formRef = { id: '11111111-1111-4111-8111-111111111111', version: 4, contentHash: 'b'.repeat(64) };
const node = { nodeId: 'ANALYSIS', name: '요구 분석', purpose: '왜 만드는지 확인', kind: 'HUMAN' as const, position: { x: 0, y: 0 }, role: 'USER' as const, mode: 'CASE_BY_CASE' as const, inputs: [], outputs: [{ itemId: 'requirements', formRef, required: true, reviewCriteria: ['요구 원문과 대조'] }], taskScope: { included: ['요구 명세'], excluded: ['운영 실행'] }, completionCriteria: ['사용자 내용 확인'], approvalBoundary: ['USER_CONFIRM'], limitPolicyRef: null, recordRequirements: ['현재 위치'] };
const source: MethodVersion = { ref: { id: '22222222-2222-4222-8222-222222222222', version: 2, contentHash: 'a'.repeat(64) }, name: '고정 방법론', purpose: '절차를 사용자 시스템에 보관', scope: 'SYSTEM', systemCode: 'SYS-M01', confirmation: null, graph: { nodes: [node, { ...node, nodeId: 'DESIGN', name: '상세 설계', purpose: '새 상세 조건', outputs: [] }], edges: [{ edgeId: 'NEXT', fromNodeId: 'ANALYSIS', toNodeId: 'DESIGN', kind: 'BRANCH', reason: '사용자 확인 후', condition: { fieldRef: { nodeId: 'ANALYSIS', field: 'USER_DECISION' }, operator: 'EQ', value: 'CONTINUE' } }], entryNodeId: 'ANALYSIS', terminalNodeIds: ['DESIGN'] }, validation: { validForConfirmation: true, issues: [] }, runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
function component(nodeId: string, onSelect: (id: string) => void = () => {}) { assert.equal(typeof module.MethodologyPreviewDefinition, 'function'); return module.MethodologyPreviewDefinition({ source, nodeId, onSelect }); }
function buttons(tree: ReactNode): ReactElement<any>[] { if (Array.isArray(tree)) return tree.flatMap(buttons); if (!isValidElement<{ children?: ReactNode }>(tree)) return []; return [...(tree.type === 'button' ? [tree] : []), ...buttons(tree.props.children)]; }

test('선택 전 미리보기는 고정 버전·단계 목적·산출 양식/검수·분기 조건을 원본대로 표시한다', () => {
 const before = JSON.stringify(source), html = renderToStaticMarkup(component('ANALYSIS'));
 for (const text of ['고정 방법론', source.ref.id, 'v2', source.ref.contentHash, '요구 분석', '왜 만드는지 확인', '사용자 내용 확인', 'USER_CONFIRM', formRef.id, 'v4', '요구 원문과 대조', 'NEXT', 'CONTINUE', '연결·복사·저장하지 않습니다']) assert.ok(html.includes(text), text);
 assert.equal(JSON.stringify(source), before); assert.equal(html.includes('선택 단계 이동'), false);
});

test('읽기 단계 선택은 해당 ID만 전달하고 없는 단계의 내용을 대신 표시하지 않는다', () => {
 const calls: string[] = [], tree = component('ANALYSIS', id => calls.push(id));
 const choice = buttons(tree).find(button => button.props['aria-label'] === '미리보기 단계 DESIGN'); assert.ok(choice); choice.props.onClick(); assert.deepEqual(calls, ['DESIGN']);
 const html = renderToStaticMarkup(component('DESIGN')); assert.ok(html.includes('새 상세 조건')); assert.equal(html.includes('요구 원문과 대조'), false);
 const missing = renderToStaticMarkup(component('missing')); assert.ok(missing.includes('선택 단계 미확인')); assert.equal(missing.includes('요구 원문과 대조'), false);
});

test('흐름도의 단계·연결 설명은 조각 배열이 아닌 읽을 수 있는 단일 title 텍스트다', () => {
 const html = renderToStaticMarkup(component('ANALYSIS'));
 assert.ok(html.includes('<title>ANALYSIS 요구 분석: 왜 만드는지 확인</title>'));
 assert.ok(html.includes('<title>BRANCH: ANALYSIS → DESIGN 사용자 확인 후</title>'));
});

test('미리보기 추가 renderer의 필수 정의가 없거나 잘못된 응답은 READY로 채택하지 않는다', async () => {
 const selected = { ...source, scope: 'SYSTEM' as const, status: 'CONFIRMED' as const, sourceAvailable: true };
 const read = module.readMethodologyPreview ?? getMethod;
 const missing = structuredClone(source); delete (missing.graph.nodes[0] as any).taskScope;
 const invalid = [missing, ...[{ taskScope: { included: null, excluded: [] } }, { taskScope: { included: [], excluded: 'not-array' } }, { role: 'UNKNOWN' }, { mode: 'UNBOUNDED' }, { requirements: { capabilities: 'not-array', environment: [] } }, { outputs: [{ ...node.outputs[0], required: 'yes' }] }, { limitPolicyRef: { id: 'missing', version: 0, contentHash: 'invalid' } }, { joinRule: { mode: 'UNKNOWN' } }].map(patch => { const value = structuredClone(source); Object.assign(value.graph.nodes[0]!, patch); return value; })];
 const badRetry = structuredClone(source); (badRetry.graph.edges[0] as any).retryPolicy = { maxAttempts: 0, counting: 'ANY', onExhausted: 'AUTO_RETRY' }; invalid.push(badRetry);
 for (const value of invalid) await assert.rejects(read(new ApiClient(async () => Response.json(value)), selected), (error: any) => error.code === 'RESPONSE_INVALID');
 assert.deepEqual((await read(new ApiClient(async () => Response.json(source)), selected)).graph, source.graph);
});

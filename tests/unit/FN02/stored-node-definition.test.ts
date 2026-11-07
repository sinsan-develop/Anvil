import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MethodologyNode } from '../../../contracts/methodologies.ts';

const file = new URL('../../../apps/web/src/features/methodology-editor/StoredNodeDefinition.tsx', import.meta.url);
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/methodology-editor/StoredNodeDefinition.tsx') : {};
const inputRef = { id: '10000000-0000-4000-8000-000000000001', version: 3, contentHash: 'a'.repeat(64) };
const outputRef = { id: '20000000-0000-4000-8000-000000000002', version: 7, contentHash: 'b'.repeat(64) };
function fixture(): MethodologyNode {
 return { nodeId: 'DESIGN', name: '상세 설계', purpose: '구현 전 계약 확인', kind: 'AGENT', position: { x: 0, y: 0 }, role: 'STAGE_OWNER', mode: 'AUTO',
  inputs: [{ itemId: 'requirements', formRef: inputRef, required: true, sourceNodeId: 'ANALYSIS', reviewCriteria: ['원 요구 근거 확인'] }],
  outputs: [{ itemId: 'design', formRef: outputRef, required: false, reviewCriteria: ['화면과 처리 연결'] }],
  taskScope: { included: ['화면 상세 설계'], excluded: ['운영 배포'] }, completionCriteria: ['설계 내용 검토'], approvalBoundary: ['USER_DESIGN_CONFIRM'],
  limitPolicyRef: { ...inputRef, version: 5 }, recordRequirements: ['작업 위치와 오류 기록'], requirements: { capabilities: ['READ_PROJECT_FILES'], environment: ['Windows 개발환경'] } };
}
function render(node: MethodologyNode) {
 assert.equal(typeof module.StoredNodeDefinition, 'function');
 return renderToStaticMarkup(createElement(module.StoredNodeDefinition, { node }));
}

test('복사 전 공통 원본의 책임·범위·요구·한도·합류를 별도 읽기 표시한다', () => {
 assert.equal(typeof module.StoredNodeResponsibilities, 'function');
 const node = fixture(); node.kind = 'JOIN'; node.joinRule = { mode: 'ALL' };
 const html = renderToStaticMarkup(createElement(module.StoredNodeResponsibilities, { node }));
 for (const value of ['단계책임자', '허용 범위 안 자동', '화면 상세 설계', '운영 배포', 'READ_PROJECT_FILES', 'Windows 개발환경', 'v5', '모든 선행 결과']) assert.ok(html.includes(value), value);
 assert.doesNotMatch(html, /<(button|input|textarea|select)\b/);
});
test('저장된 단계의 책임·문서 exact 양식/검수·범위·기록/한도를 원본 그대로 읽기 표시한다', () => {
 const node = fixture(), before = JSON.stringify(node), html = render(node);
 for (const value of ['단계책임자', '허용 범위 안 자동', '화면 상세 설계', '운영 배포', '원 요구 근거 확인', '화면과 처리 연결', 'ANALYSIS', 'USER_DESIGN_CONFIRM', 'READ_PROJECT_FILES', 'Windows 개발환경', '작업 위치와 오류 기록', inputRef.id, outputRef.id, 'v3', 'v7', 'v5', 'a'.repeat(64), 'b'.repeat(64)]) assert.ok(html.includes(value), value);
 assert.ok(html.includes('필수')); assert.ok(html.includes('선택'));
 assert.doesNotMatch(html, /<(button|input|textarea|select)\b/); assert.equal(JSON.stringify(node), before);
});
test('다른 저장 원본/버전의 노드를 받으면 이전 단계 정의를 남기지 않는다', () => {
 const first = fixture(); assert.ok(render(first).includes('원 요구 근거 확인'));
 const next = fixture(); next.nodeId = 'TEST'; next.name = '검증 단계'; next.role = 'USER'; next.mode = 'CASE_BY_CASE'; next.inputs = []; next.outputs = []; next.taskScope = { included: ['새 검증 범위'], excluded: [] };
 const html = render(next); assert.ok(html.includes('검증 단계')); assert.ok(html.includes('사용자')); assert.ok(html.includes('건별')); assert.ok(html.includes('새 검증 범위'));
 for (const old of ['원 요구 근거 확인', '화면과 처리 연결', '화면 상세 설계', outputRef.id]) assert.equal(html.includes(old), false, old);
});
test('정의가 없는 항목을 실행 준비나 한도 검증 완료로 꾸미지 않는다', () => {
 const node = fixture(); node.inputs = []; node.outputs = []; node.limitPolicyRef = null; node.recordRequirements = []; delete node.requirements;
 const html = render(node); assert.ok(html.includes('입력 문서 미작성')); assert.ok(html.includes('산출 문서 미작성')); assert.ok(html.includes('기록 요구 미작성')); assert.ok(html.includes('연결된 한도 정책 없음'));
 assert.ok(html.includes('실제 도구 배정·권한·한도 검증이 아닙니다'));
});
test('합류 조건 원문과 사용자 작성 텍스트는 평가·HTML 실행 없이 표시한다', () => {
 const node = fixture(); node.kind = 'JOIN'; node.purpose = '<img src=x onerror=alert(1)>';
 node.joinRule = { mode: 'DECLARED_CONDITION', condition: { all: [{ fieldRef: { nodeId: 'REVIEW', field: 'USER_DECISION' }, operator: 'EQ', value: 'CONTINUE' }] } };
 const html = render(node); for (const text of ['명시한 결과 조건', 'USER_DECISION', 'CONTINUE', 'REVIEW']) assert.ok(html.includes(text), text);
 assert.ok(html.includes('&lt;img')); assert.equal(html.includes('<img'), false);
 delete node.joinRule.condition; assert.ok(render(node).includes('합류 조건 미작성'));
});

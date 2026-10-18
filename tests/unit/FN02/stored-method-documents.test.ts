import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MethodologyDocumentItem } from '../../../contracts/methodologies.ts';
const compiler = await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
after(async () => { await compiler.close(); });
const module = await compiler.ssrLoadModule('/src/features/methodology-editor/StoredNodeDefinition.tsx');
const ref = { id: '11111111-1111-4111-8111-111111111111', version: 6, contentHash: 'c'.repeat(64) };
function render(side: '입력' | '산출', items: MethodologyDocumentItem[]) { assert.equal(typeof module.StoredMethodDocuments, 'function'); return renderToStaticMarkup(createElement(module.StoredMethodDocuments, { side, items })); }
test('입력과 산출을 구분하고 필수·정확 양식·출처·문서별 검수 정의를 보존한다', () => {
 const input = [{ itemId: 'requirements', formRef: ref, required: true, sourceNodeId: 'ANALYSIS', reviewCriteria: ['요구 원문 대조'] }], output = [{ itemId: 'design', formRef: { ...ref, version: 8 }, required: false, reviewCriteria: ['구현 범위 검수'] }];
 const a = render('입력', input), b = render('산출', output);
 for (const text of ['입력 문서 정의', '필수', ref.id, 'v6', ref.contentHash, 'ANALYSIS', '요구 원문 대조']) assert.ok(a.includes(text), text);
 for (const text of ['산출 문서 정의', '선택', ref.id, 'v8', '구현 범위 검수']) assert.ok(b.includes(text), text);
 assert.equal(a.includes('구현 범위 검수'), false); assert.equal(b.includes('ANALYSIS'), false);
});
test('입력의 출처 미지정·빈 검수·문서 부재를 산출물 또는 확인완료로 대신 표시하지 않는다', () => {
 const html = render('입력', [{ itemId: 'external', formRef: ref, required: false, reviewCriteria: [] }]);
 assert.ok(html.includes('외부 입력·단계 미지정')); assert.ok(html.includes('문서 검수 조건 미작성')); assert.equal(html.includes('단계 산출물'), false);
 assert.ok(render('입력', []).includes('입력 문서 미작성')); assert.ok(render('산출', []).includes('산출 문서 미작성'));
});
test('저장 정의는 변경 없이 텍스트로만 표시하며 편집·실행 요소를 만들지 않는다', () => {
 const items = [{ itemId: '<img src=x>', formRef: ref, required: true, reviewCriteria: ['<script>alert(1)</script>'] }], before = JSON.stringify(items), html = render('입력', items);
 assert.equal(JSON.stringify(items), before); assert.ok(html.includes('&lt;img')); assert.ok(html.includes('&lt;script&gt;')); assert.doesNotMatch(html, /<(button|input|textarea|select|script|img)\b/);
});

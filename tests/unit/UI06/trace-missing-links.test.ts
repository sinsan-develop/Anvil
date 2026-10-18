import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TraceView } from '../../../apps/web/src/features/design-trace/trace-api.ts';
const file = new URL('../../../apps/web/src/features/design-trace/TraceMissingLinks.tsx', import.meta.url);
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/design-trace/TraceMissingLinks.tsx') : {};
const context = { projectId: '11111111-1111-4111-8111-111111111111', documentRef: { id: '22222222-2222-4222-8222-222222222222', version: 2, contentHash: 'a'.repeat(64) }, bodyHash: 'b'.repeat(64) };
const missing: TraceView['missingLinks'] = [{ ref: { kind: 'DESIGN_ITEM', id: '33333333-3333-4333-8333-333333333333', versionRef: { ...context.documentRef }, localCode: 'D01', anchor: 'line:2' }, code: 'PLAN_TASK_LINK_MISSING' }];
function component(props: any) { assert.equal(typeof module.TraceMissingLinks, 'function'); return module.TraceMissingLinks(props); }
function buttons(tree: ReactNode): ReactElement<any>[] {
 if (Array.isArray(tree)) return tree.flatMap(buttons);
 if (!isValidElement<{ children?: ReactNode }>(tree)) return [];
 return [...(tree.type === 'button' ? [tree] : []), ...buttons(tree.props.children)];
}
test('누락 항목을 클릭하면 같은 설계 원본의 정확 버전·bodyHash·줄로만 선택을 전달한다', () => {
 const calls: unknown[] = [], props = { ...context, missingLinks: structuredClone(missing), loading: false, onAnchorSelect: (v: unknown) => calls.push(v) }, before = JSON.stringify(props.missingLinks);
 const tree = component(props), html = renderToStaticMarkup(tree), button = buttons(tree)[0]!;
 assert.ok(html.includes('D01')); assert.ok(html.includes('PLAN_TASK_LINK_MISSING')); assert.ok(html.includes('누락 설계 원문 보기')); assert.equal(button.props.disabled, false);
 button.props.onClick(); assert.deepEqual(calls, [{ ...context, documentRef: { ...context.documentRef }, anchor: 'line:2' }]); assert.equal(JSON.stringify(props.missingLinks), before);
});
test('다른 문서·버전·hash·잘못된줄·본문미확인·조회중은 이동handler에서도 거절한다', () => {
 const calls: unknown[] = [], base = { ...context, missingLinks: structuredClone(missing), loading: false, onAnchorSelect: (v: unknown) => calls.push(v) };
 const mismatches = [{ ...context.documentRef, id: missing[0]!.ref.id }, { ...context.documentRef, version: 3 }, { ...context.documentRef, contentHash: 'c'.repeat(64) }];
 const invalid = [...mismatches.map(versionRef => ({ ...base, missingLinks: [{ ...missing[0]!, ref: { ...missing[0]!.ref, versionRef } }] })), { ...base, bodyHash: undefined }, { ...base, loading: true }, { ...base, missingLinks: [{ ...missing[0]!, ref: { ...missing[0]!.ref, anchor: 'line:0' } }] }];
 for (const props of invalid) { const button = buttons(component(props))[0]!; assert.equal(button.props.disabled, true); button.props.onClick(); }
 assert.deepEqual(calls, []);
});
test('이동callback이 없으면 읽기 목록만 유지하고 빈 목록을 오류나 누락으로 꾸미지 않는다', () => {
 const tree = component({ ...context, missingLinks: missing, loading: false }); const button = buttons(tree)[0]!; assert.equal(button.props.disabled, true); assert.doesNotThrow(() => button.props.onClick()); assert.ok(renderToStaticMarkup(tree).includes('D01'));
 assert.equal(renderToStaticMarkup(component({ ...context, missingLinks: [], loading: false })), '');
});

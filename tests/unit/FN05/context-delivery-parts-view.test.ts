import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compiler = await createServer({ configFile: false, root: fileURLToPath(new URL('../../../apps/web/', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
after(async () => { await compiler.close(); });
const componentUrl = new URL('../../../apps/web/src/features/workspace/ContextDeliveryParts.tsx', import.meta.url);
const module = existsSync(componentUrl) ? await compiler.ssrLoadModule('/src/features/workspace/ContextDeliveryParts.tsx') : {};
const sourceRef = { id: '10000000-0000-4000-8000-000000000001', version: 2, contentHash: 'a'.repeat(64) };
const bodyRef = { artifactId: '20000000-0000-4000-8000-000000000002', bytes: 10, contentHash: 'b'.repeat(64), mediaType: 'text/plain;charset=utf-8' };
const parts = [
 { partId: 'PURPOSE_REASON_1:1', itemId: 'PURPOSE_REASON_1', sourceRef, bodyRef, order: 1, byteOffset: 0, utf8Bytes: 6, contentHash: 'c'.repeat(64) },
 { partId: 'PURPOSE_REASON_1:2', itemId: 'PURPOSE_REASON_1', sourceRef, bodyRef, order: 2, byteOffset: 6, utf8Bytes: 4, contentHash: 'd'.repeat(64) }
];
function render(value: unknown) {
 assert.equal(typeof module.ContextDeliveryParts, 'function', '저장 후보의 부분 metadata 표시가 필요합니다');
 return renderToStaticMarkup(createElement(module.ContextDeliveryParts, { parts: value }));
}

test('검증된 저장 후보의 한글 UTF8 부분 metadata를 순서대로 읽기 전용 표에 표시한다', () => {
 const before = structuredClone(parts), html = render(parts);
 assert.match(html, /<details(?![^>]*\bopen\b)[^>]*><summary>/);
 assert.match(html, /<table[^>]*aria-label="저장 후보 부분 metadata"/);
 for (const label of ['partId', 'itemId', 'order', 'byteOffset', 'utf8Bytes', '부분 contentHash', '원참조 sourceRef', '본문참조 bodyRef']) assert.ok(html.includes(label), label);
 for (const value of ['PURPOSE_REASON_1:1', 'PURPOSE_REASON_1:2', '>0<', '>6<', '>4<', 'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)]) assert.ok(html.includes(value), value);
 assert.ok(html.indexOf('PURPOSE_REASON_1:1') < html.indexOf('PURPOSE_REASON_1:2'));
 assert.ok(html.includes('&quot;version&quot;:2') && html.includes('&quot;bytes&quot;:10'), '원참조와 본문참조의 원래 숫자형을 유지합니다');
 assert.ok(html.includes('준비 단계') && html.includes('실제 전달 0') && html.includes('부분 본문은 내려받지'));
 assert.equal(html.includes('<button'), false); assert.equal(html.includes('<a '), false);
 assert.deepEqual(parts, before);
});

test('빈 준비 계획은 빈 표로 감추지 않고 준비 상태와 부분 없음 문구를 표시한다', () => {
 const html = render([]);
 assert.ok(html.includes('계획된 부분이 없습니다'));
 assert.ok(html.includes('준비 단계') && html.includes('실제 전달 0'));
 assert.equal(html.includes('<tbody>'), false);
});

test('참조와 식별자에 섞인 HTML은 문자로만 보이고 원배열은 바뀌지 않는다', () => {
 const hostile = [{ ...parts[0], partId: '<script>private()</script>', sourceRef: { ...sourceRef, id: '<img src=x onerror=private()>' } }], before = structuredClone(hostile);
 const html = render(hostile);
 assert.ok(html.includes('&lt;script&gt;private()&lt;/script&gt;'));
 assert.ok(html.includes('&lt;img src=x onerror=private()&gt;'));
 assert.equal(html.includes('<script>'), false); assert.equal(html.includes('<img '), false);
 assert.deepEqual(hostile, before);
});

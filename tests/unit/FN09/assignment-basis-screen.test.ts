import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
const file = new URL('../../../apps/web/src/features/workspace/AssignmentBasisDocuments.ts', import.meta.url), module = existsSync(file) ? await import(file.href) : {};
const ref = { id: '10000000-0000-4000-8000-000000000001', version: 6, contentHash: 'a'.repeat(64) };
test('기준 문서는 명시 열기 전 본문·API 호출이 없고 작업 입력/명령에 쓰지 않는다', () => {
 assert.equal(typeof module.AssignmentBasisDocuments, 'function'); let calls = 0; const plan: any = { documentRef: ref, designRef: { ...ref, version: 4 } }, before = structuredClone(plan);
 const text = renderToStaticMarkup(createElement(module.AssignmentBasisDocuments, { client: new ApiClient(async () => { calls++; throw Error('호출하면 안 됨'); }), projectId: ref.id, plan, busy: false, run: () => { calls++; } }));
 assert.match(text, /작업계획서 고정 원문 열기/); assert.match(text, /설계서 고정 원문 열기/); assert.match(text, /v6/); assert.match(text, /v4/); assert.match(text, /실행 허가.*아님/);
 assert.equal(text.includes('<pre>'), false); assert.equal(calls, 0); assert.deepEqual(plan, before);
});
test('명령 진행 중에는 기준 조회도 잠가 같은 화면의 동시 요청을 만들지 않는다', () => {
 assert.equal(typeof module.AssignmentBasisDocuments, 'function'); const text = renderToStaticMarkup(createElement(module.AssignmentBasisDocuments, { client: new ApiClient(async () => { throw Error(); }), projectId: ref.id, plan: { documentRef: ref, designRef: ref }, busy: true, run: () => {} }));
 assert.equal((text.match(/<button disabled=""/g) ?? []).length, 2);
});

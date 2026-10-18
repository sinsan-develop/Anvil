import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { newDocument } from '../../../apps/web/src/features/design-trace/editor-api.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
const compiler = await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
after(async () => { await compiler.close(); });
const { DocumentEditor } = await compiler.ssrLoadModule('/src/features/design-trace/DocumentEditor.tsx');
const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const form = { ...catalog.forms[1]!, authoringStandard: { ref: catalog.standard.ref, content: catalog.standard.body.toString('utf8') }, validation: { formatOnly: true as const, contentReview: 'NOT_PERFORMED' as const, userAcceptance: 'NOT_PERFORMED' as const } };
const userId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222', clientId = '33333333-3333-4333-8333-333333333333';

test('현재 작성 문서에서 고정 양식 원문 열기를 제공하고 입력·명령을 바꾸거나 자동 조회하지 않는다', () => {
 const buffer = { ...newDocument(projectId, form, userId, 1), title: '진행 중 설계', body: '보존할 미저장 원문', dirty: true }, before = JSON.stringify(buffer); let calls = 0, changes = 0;
 const html = renderToStaticMarkup(createElement(DocumentEditor, { client: new ApiClient(async () => { calls++; throw Error('unexpected fetch'); }), session: { user: { id: userId }, clientId, csrfToken: 'c'.repeat(43) }, buffer, onChange: () => changes++, onSaved: () => changes++, onAuthenticationLost: () => changes++ }));
 assert.ok(html.includes('문서 작성 고정 양식')); assert.ok(html.includes('고정 양식 원문 보기')); assert.ok(html.includes(form.ref.id)); assert.ok(html.includes('v1')); assert.ok(html.includes(form.ref.contentHash));
 assert.ok(html.includes('보존할 미저장 원문')); assert.ok(html.includes('새 초안 버전 저장')); assert.equal(JSON.stringify(buffer), before); assert.equal(calls, 0); assert.equal(changes, 0);
});

test('다른 사용자 buffer에 새 고정 양식 조회 진입을 추가하지 않는다', () => {
 let calls = 0; const html = renderToStaticMarkup(createElement(DocumentEditor, { client: new ApiClient(async () => { calls++; throw Error('unexpected fetch'); }), session: { user: { id: '44444444-4444-4444-8444-444444444444' }, clientId, csrfToken: 'c'.repeat(43) }, buffer: newDocument(projectId, form, userId, 1), onChange: () => {}, onSaved: () => {}, onAuthenticationLost: () => {} }));
 assert.equal(html.includes('고정 양식 원문 보기'), false); assert.equal(calls, 0);
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiError } from '../../../apps/web/src/api/client.ts';
const file = new URL('../../../apps/web/src/features/methodologies/PinnedFormOriginal.tsx', import.meta.url);
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/methodologies/PinnedFormOriginal.tsx') : {};
const ref = { id: '11111111-1111-4111-8111-111111111111', version: 3, contentHash: 'a'.repeat(64) }, standard = { id: '22222222-2222-4222-8222-222222222222', version: 2, contentHash: 'b'.repeat(64) };
const data = { ref, definition: { formCode: 'AF02', name: '고정 설계서', purpose: '설계 목적', scope: 'SYSTEM', authorRole: 'STAGE_OWNER', reviewerRole: 'REVIEWER', confirmerRole: 'USER', requiredInputs: ['승인된 요구 원문'], authoringStandardRef: standard,
 items: [{ itemId: 'AF02-02', title: '기능 설계', required: true, valueType: 'RECORDS', repeated: true, fields: [{ fieldId: 'AF02-02-F01', title: 'D ID', required: true, valueType: 'TEXT' }, { fieldId: 'AF02-02-F02', title: '제외 이유', required: false, valueType: 'TEXT' }], authoringRules: ['처리·저장·조회를 명시'], reviewCriteria: ['실제 근거와 대조'] }] }, authoringStandard: { ref: standard, content: '<script>원문</script>' }, validation: { formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' } };
function render(state: any) { assert.equal(typeof module.PinnedFormResult, 'function'); return renderToStaticMarkup(createElement(module.PinnedFormResult, { state })); }

test('고정 원문의 항목/반복 필드 필수여부·작성/검수 규칙·역할·공통 기준을 읽기 표시한다', () => {
 const before = JSON.stringify(data), html = render({ status: 'READY', data });
 for (const text of ['고정 설계서', ref.id, 'v3', ref.contentHash, 'AF02-02', 'AF02-02-F01', 'D ID', '필수', '선택', '반복', 'TEXT', '처리·저장·조회를 명시', '실제 근거와 대조', 'STAGE_OWNER', 'REVIEWER', 'USER', '승인된 요구 원문', standard.contentHash, '&lt;script&gt;']) assert.ok(html.includes(text), text);
 assert.equal(JSON.stringify(data), before); assert.doesNotMatch(html, /<(input|textarea|select|script)\b/);
});

test('조회중/거절에는 앞선 원문을 숨기고 실패를 확정/적용 완료로 바꾸지 않는다', () => {
 const pending = render({ status: 'LOADING', data }), denied = render({ status: 'ERROR', error: new ApiError('FORBIDDEN', 403), data });
 assert.ok(pending.includes('role="status"')); assert.ok(denied.includes('role="alert"')); assert.ok(denied.includes('FORBIDDEN'));
 for (const html of [pending, denied]) { assert.equal(html.includes('고정 설계서'), false); assert.equal(html.includes(ref.contentHash), false); assert.equal(html.includes('AF02-02-F01'), false); }
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { newContextPreparation, prepareContextWrite } from '../../../apps/web/src/features/workspace/context-api.ts';
const file = new URL('../../../apps/web/src/features/workspace/WorkspaceContextPreparation.tsx', import.meta.url);
// JSX 정적 렌더용 메모리 compiler다. HTTP/HMR listener·watcher·DB·브라우저를 만들지 않고 종료한다.
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/workspace/WorkspaceContextPreparation.tsx') : {};
const pid = '10000000-0000-4000-8000-000000000001', uid = '20000000-0000-4000-8000-000000000002';
const ref = { id: uid, version: 1, contentHash: 'a'.repeat(64) }, session = { user: { id: uid }, clientId: uid, csrfToken: 'C'.repeat(43) };
const confirmed: any = { projectId: pid, ref, snapshot: { definition: { budgetRef: null }, contentConfirmed: true, ready: false, executionAuthorized: false, dispatchPerformed: false } };
const client = new ApiClient(async () => { throw Error('정적 표시에서 조회/명령을 실행하면 안 됨'); });
function render(buffer: any, activeSession = session) { assert.equal(typeof module.WorkspaceContextPreparation, 'function'); return renderToStaticMarkup(createElement(module.WorkspaceContextPreparation, { client, confirmed, session: activeSession, buffer, onChange: () => {}, owner: true, busy: false, run: () => {} })); }
test('맥락 준비 화면은 필수7슬롯·명시 원문 선택/누락과 준비 저장·실행 미허가를 구분한다', () => {
 const b = newContextPreparation(confirmed, session, 1), html = render(b);
 for (const label of ['목적과 이유', '헌법과 범위', '최신 관련 지시', '결정과 이유', '현재 위치', '실제 공백', '다음 행동', '준비 저장', 'Agent 전달·실행 허가 아님']) assert.ok(html.includes(label), label);
 assert.equal((html.match(/원문 미선택/g) ?? []).length, 7);
});
test('미확인 명령은 입력 잠금·같은 명령 결과 확인으로 표시하고 자동 재발행하지 않는다', () => {
 const b = newContextPreparation(confirmed, session, 1); b.input.reason = '보존할 준비 이유'; b.pending = prepareContextWrite(b, session); b.uncertain = true;
 const html = render(b); assert.ok(html.includes('같은 준비 명령 결과 확인')); assert.ok(html.includes('fieldset disabled')); assert.ok(html.includes('보존할 준비 이유')); assert.ok(html.includes('미확인 명령'));
});
test('다른 사용자·기기의 보관 버퍼를 입력이나 결과로 노출하지 않는다', () => {
 const b = newContextPreparation(confirmed, session, 1); b.input.reason = '다른 사용자 전용 이유';
 const html = render(b, { ...session, clientId: pid }); assert.equal(html.includes('다른 사용자 전용 이유'), false); assert.ok(html.includes('보관 입력의 사용자·기기가 다릅니다'));
});
test('선택한 원문의 종류·정확 버전·hash를 임무 ref와 구별해 표시한다', () => {
 const b = newContextPreparation(confirmed, session, 1); b.input.slots[0]!.sources = [{ kind: 'KNOWLEDGE_VERSION', versionRef: { ...ref, version: 12, contentHash: 'c'.repeat(64) } }];
 const html = render(b); assert.ok(html.includes('v12')); assert.ok(html.includes('c'.repeat(64)));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { buildContextManifest } from '../../../apps/server/modules/context/context-manifest.ts';
import { planContextText } from '../../../apps/server/modules/context/context-text-plan.ts';
const file = new URL('../../../apps/web/src/features/workspace/context-api.ts', import.meta.url), module = existsSync(file) ? await import(file.href) : {};
const fn = (name: string) => { assert.equal(typeof module[name], 'function'); return module[name]; };
const pid = '10000000-0000-4000-8000-000000000001', uid = '20000000-0000-4000-8000-000000000002';
const ref = { id: uid, version: 1, contentHash: 'a'.repeat(64) }, session = { user: { id: uid }, clientId: uid, csrfToken: 'C'.repeat(43) };
const confirmed: any = { projectId: pid, ref, snapshot: { definition: { budgetRef: null }, contentConfirmed: true, ready: false, executionAuthorized: false, dispatchPerformed: false } };
function buffer() { const b = fn('newContextPreparation')(confirmed, session, 1); b.input.reason = '사용자 명시 준비'; return b; }
function saved(b: any) {
 const planned = planContextText(b.input.slots.map((slot: any) => ({ itemId: slot.code, category: slot.code, required: true, sourceRef: null, reason: slot.reason, state: 'MISSING', bodyRef: null, body: null })), b.input.limits);
 const prepared: any = { preparationInput: b.input, assignmentRef: ref, baselineRefs: [ref], constitutionRef: null, budgetRef: null, bindings: b.input.slots.map((slot: any) => ({ itemId: slot.code, selection: null, bodyRef: null, sourceState: 'NOT_SELECTED' })), ...planned, unverified: [] };
 const value = buildContextManifest(pid, pid, prepared); return { projectId: pid, ...value, currentCheck: { state: 'MATCHED_METADATA', issues: [] }, ready: false, executionAuthorized: false, dispatchPerformed: false, observedAt: '2026-10-18T07:00:00Z' };
}
test('확정 임무의 준비 입력은 세션/제어·예산에 결박하고 미확인 명령은 같은 ID·내용만 재사용한다', () => {
 const b = buffer(); assert.equal(b.input.slots.length, 7); assert.ok(b.input.slots.every((slot: any) => slot.sources.length === 0)); assert.equal(b.input.budgetRef, null);
 const command = fn('prepareContextWrite')(b, session); assert.equal(command.operation, 'buildTaskContext'); assert.equal(command.targetId, null); assert.equal(command.expectedVersion, 0);
 b.pending = command; b.uncertain = true; assert.deepEqual(fn('prepareContextWrite')(b, session), command);
 b.result = { historicReadOnly: true }; assert.deepEqual(fn('prepareContextWrite')(b, session), command); b.result = null;
 b.input.reason = '다른 입력'; assert.throws(() => fn('prepareContextWrite')(b, session));
 const other = buffer(); assert.throws(() => fn('prepareContextWrite')(other, { ...session, clientId: pid })); other.input.budgetRef = ref; assert.throws(() => fn('prepareContextWrite')(other, session));
 const missing = buffer(); missing.input.slots.pop(); assert.throws(() => fn('prepareContextWrite')(missing, session));
});
test('준비 저장은 same-origin 원 명령으로 보내며 영수증 확인을 실행·본문 재조회로 승격하지 않는다', async () => {
 const b = buffer(), command = fn('prepareContextWrite')(b, session); let sent: any;
 const client = new ApiClient(async (url, init) => { assert.equal(url, `/api/v1/projects/${pid}/commands`); assert.equal(new Headers(init?.headers).get('idempotency-key'), command.commandId); sent = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ projectId: pid, commandId: command.commandId, operationId: pid, status: 'APPLIED', targetId: pid, version: 1, data: { status: 'CONTEXT_PREPARED', ref: { ...ref, id: pid }, ready: false, executionAuthorized: false, dispatchPerformed: false }, evidenceRefs: [], warnings: [], serverReceivedAt: '2026-10-18T07:00:00Z' }), { status: 200, headers: { 'content-type': 'application/json' } }); });
 const result = await fn('sendContextPreparation')(client, command, session.csrfToken); assert.equal(result.id, pid); assert.deepEqual(sent, command); assert.equal(b.resultRef, null);
});
test('보호 재조회는 정확 manifest hash/false 상태만 받아들이고 변조·다른 ref·거짓READY를 거절한다', async () => {
 const b = buffer(), value = saved(b); const client = (body: any) => new ApiClient(async url => { assert.equal(url, `/api/v1/projects/${pid}/context/${value.ref.id}/versions/1`); return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }); });
 const read = await fn('readContextPreparation')(client(value), pid, value.ref); assert.equal(read.manifest.missingRequired.length, 7); assert.equal(read.ready, false);
 for (const mutate of [(v: any) => { v.manifest.items[0].reason = '바뀐 이유'; }, (v: any) => { v.ready = true; }, (v: any) => { v.ref.contentHash = 'f'.repeat(64); }]) { const changed = structuredClone(value); mutate(changed); await assert.rejects(fn('readContextPreparation')(client(changed), pid, value.ref)); }
});
test('위조 경로·다른 승인/기준·명령 형태는 transport 호출 전에 거절한다', async () => {
 let calls = 0; const client = new ApiClient(async () => { calls++; throw Error('호출되면 안 됨'); });
 for (const mutate of [(c: any) => { c.projectId = '../other'; }, (c: any) => { c.commandId = '잘못됨'; }, (c: any) => { c.approvalRef = {}; }, (c: any) => { c.baselineRefs = [ref]; }]) { const command = fn('prepareContextWrite')(buffer(), session); mutate(command); await assert.rejects(fn('sendContextPreparation')(client, command, session.csrfToken)); }
 assert.equal(calls, 0);
});
test('후보 목록은 정확 확정 임무와 유한 최근 한도를 대조하고 더 있음·현재 미확인을 보존한다', async () => {
 const value = saved(buffer()); const page: any = { projectId: pid, assignmentRef: ref, items: [{ ref: value.ref, missingRequired: value.manifest.missingRequired, excluded: [], currentCheck: { state: 'UNAVAILABLE', issues: ['CURRENT_SOURCE_OR_BASIS_UNAVAILABLE'] } }], hasMore: true, limit: 50, ready: false, executionAuthorized: false, dispatchPerformed: false, observedAt: value.observedAt };
 const client = new ApiClient(async url => { const query = new URL(String(url), 'https://anvil.invalid').searchParams; assert.equal(query.get('assignmentId'), ref.id); assert.equal(query.get('assignmentHash'), ref.contentHash); assert.equal(query.get('limit'), '50'); return new Response(JSON.stringify(page), { headers: { 'content-type': 'application/json' } }); });
 assert.equal((await fn('listContextPreparations')(client, pid, ref)).hasMore, true);
 page.assignmentRef = { ...ref, version: 2 }; await assert.rejects(fn('listContextPreparations')(client, pid, ref));
});

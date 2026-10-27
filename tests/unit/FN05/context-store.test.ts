import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { contextSlotCodes } from '../../../apps/server/modules/context/context-input.ts';
import { planContextText } from '../../../apps/server/modules/context/context-text-plan.ts';
import { ProjectPolicyRepository } from '../../../apps/server/modules/access/project-command.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
const file = new URL('../../../apps/server/modules/context/project-contexts.ts', import.meta.url);
const module = existsSync(file) ? await import(file.href) : {};
const pid = '10000000-0000-4000-8000-000000000001', uid = '20000000-0000-4000-8000-000000000002';
const ref = { id: uid, version: 1, contentHash: 'a'.repeat(64) };
const actor: any = { actorId: uid, clientId: uid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
function setup() {
 assert.equal(typeof module.ProjectContexts, 'function');
 const payload: any = { assignmentRef: ref, budgetRef: null, slots: contextSlotCodes.map(code => ({ code, sources: [], reason: '명시 미선택' })), limits: { maxPartBytes: 4096, maxParts: 200 }, reason: '준비 후보' };
 const prepared: any = { preparationInput: payload, assignmentRef: ref, baselineRefs: [ref], constitutionRef: null, budgetRef: null, bindings: contextSlotCodes.map(itemId => ({ itemId, selection: null, bodyRef: null, sourceState: 'NOT_SELECTED' })), ...planContextText(contextSlotCodes.map(code => ({ itemId: code, category: code, required: true, sourceRef: null, reason: '명시 미선택', state: 'MISSING', bodyRef: null, body: null })), payload.limits), unverified: [] };
 const commands = new Map<string, any>(), bundles: any[] = [], items: any[] = []; let resolveCalls = 0, sourceError: Error | null = null, member = true, generation = 1, disposition = 'AUTO';
 const db: any = { query: async (sql: string, p: any[] = []) => {
  if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: member && p[0] === pid ? [{ id: pid, participation: 'OWNER', archived_at: null }] : [] };
  if (sql.includes('FROM anvil.project_control')) return { rows: [{ actor_id: uid, client_id: uid, generation, revoked_at: null }] };
  if (sql.includes('FROM anvil.permission_policies')) { const rules = [{ ruleId: 'context', subjectRef: { kind: 'HUMAN', userId: uid }, operations: ['buildTaskContext'], targetScopes: [{ kind: 'PROJECT', projectId: pid }], disposition, expiresAt: '2099-01-01T00:00:00.000Z' }]; return { rows: [{ id: uid, head_version: 1, rules_json: rules, reason: '명시 정책', review_refs: [], content_hash: contentHash(canonicalJson({ rules, reason: '명시 정책', reviewRefs: [] })), created_at: new Date() }] }; }
  if (sql.startsWith('SELECT operation,request_hash,result_ref')) return { rows: [...commands.values()].filter(c => c.command_id === p[2]) };
  if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-18T07:00:00Z') }] };
  if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { id: p[0], project_id: p[1], command_actor: p[2], command_client: p[3], operation: p[4], command_id: p[5], request_hash: p[6], operation_id: p[7], expected_version: p[10], control_generation: p[11], policy_ref: JSON.parse(p[12]), payload_ref: p[13], result_ref: JSON.parse(p[14]), state: 'APPLIED', approval_consumption_id: p[9], command_scope_kind: 'PROJECT', command_scope_id: p[1] }); return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith('SELECT set_config')) return { rows: [] };
  if (sql.startsWith('INSERT INTO anvil.context_bundles')) { bundles.push({ project_id: p[0], id: p[1], version: 1, assignment_id: p[2], assignment_version: p[3], assignment_hash: p[4], assignment_ref: JSON.parse(p[5]), baseline_refs: JSON.parse(p[6]), budget_ref: JSON.parse(p[7]), manifest_json: JSON.parse(p[8]), content_hash: p[9], created_by: p[10], client_id: p[11], command_id: p[12], request_payload: JSON.parse(p[13]) }); return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.context_items')) { items.push(p); return { rows: [] }; }
  if (sql.startsWith('SELECT item_id,category,required,source_ref')) return { rows: items.filter(item => item[0] === p[0] && item[1] === p[1]).map(item => ({ item_id: item[2], category: item[3], required: true, source_ref: JSON.parse(item[4]), source_hash: item[5], included_state: item[6], reason: item[7], delivery_parts: JSON.parse(item[8]), issue: item[9] })) };
  if (sql.startsWith('SELECT id,version FROM anvil.context_bundles')) return { rows: bundles.filter(b => b.project_id === p[0] && b.assignment_id === p[1] && b.assignment_version === p[2] && b.assignment_hash === p[3]).map(b => ({ id: b.id, version: b.version })) };
  if (sql.includes('FROM anvil.context_bundles b')) return { rows: bundles.filter(b => b.project_id === p[0] && b.id === p[1] && b.version === p[2]).map(b => { const c = commands.get(b.command_id); return { ...b, ...c, id: b.id, command_id: b.command_id, command_external_id: c.command_id, authorization_subject_ref: { kind: 'HUMAN', userId: uid, clientId: uid }, authorization_policy_ref: c.policy_ref, audit_scope_digest: contentHash(canonicalJson({ projectId: pid, actorId: uid, clientId: uid, controlGeneration: 1, requestHash: c.request_hash, policyRef: c.policy_ref, targetRef: c.result_ref.data.ref })), audit_outcome: 'APPLIED', audit_source_kind: 'HUMAN_COMMAND' }; }) };
  throw Error('UNEXPECTED_CONTEXT_SQL: ' + sql.slice(0, 90));
 } };
 const sources: any = { resolve: async (_db: any, _actor: any, projectId: string, input: any) => { resolveCalls++; assert.equal(projectId, pid); assert.deepEqual(input, payload); if (sourceError) throw sourceError; return structuredClone(prepared); } };
 const assignments: any = { read: async (_db: any, _actor: any, projectId: string, id: string, version: number) => { if (projectId !== pid || id !== ref.id || version !== 1) throw new AuthFailure('NOT_FOUND', 404); return { projectId, ref }; } };
 const service = new module.ProjectContexts(sources, assignments), access: any = { authenticated: async (_t: string, _csrf: string | null, action: any) => action(db, actor) }, policies = new ProjectPolicyRepository(access);
 const command: any = { schemaVersion: 1, projectId: pid, commandId: randomUUID(), clientId: uid, controlGeneration: 1, operation: 'buildTaskContext', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload };
 const save = (request = command) => policies.command('synthetic', 'synthetic', request, (_db, _actor, policyRef) => service.save(_db, _actor, request, policyRef));
 return { service, save, command, db, bundles, items, commands, prepared, calls: () => resolveCalls, setError: (value: Error | null) => { sourceError = value; }, denyMember: () => { member = false; }, oldControl: () => { generation = 2; }, policy: (value: string) => { disposition = value; } };
}
test('준비 저장은 기존 명령·불변 manifest/items와 같은 명령 replay를 사용하며 실행 허가는 만들지 않는다', async () => {
 const f = setup(), saved: any = await f.save(); assert.equal(saved.data.status, 'CONTEXT_PREPARED'); assert.equal(saved.data.ready, false); assert.equal(saved.data.executionAuthorized, false); assert.equal(f.bundles.length, 1); assert.equal(f.items.length, 7);
 const again = await f.save(); assert.deepEqual(again, saved); assert.equal(f.calls(), 1); assert.equal(f.bundles.length, 1);
 const read = await f.service.read(f.db, actor, pid, saved.data.ref.id, 1); assert.deepEqual(read.ref, saved.data.ref); assert.equal(read.currentCheck.state, 'MATCHED_METADATA'); assert.equal(read.manifest.missingRequired.length, 7); assert.equal(read.ready, false);
 const list = await f.service.list(f.db, actor, pid, { assignmentId: ref.id, assignmentVersion: '1', assignmentHash: ref.contentHash }); assert.equal(list.items.length, 1); assert.equal(list.hasMore, false);
});
test('옛 제어·DENY·미지원 일회 승인·변조 재사용과 잘못된 새 후보 envelope는 거절한다', async () => {
 for (const change of [(f: any) => f.oldControl(), (f: any) => f.policy('DENY'), (f: any) => { f.command.targetId = uid; }, (f: any) => { f.command.expectedVersion = 1; }]) { const f = setup(); change(f); await assert.rejects(f.save()); assert.equal(f.bundles.length, 0); }
 const pending = setup(); pending.policy('REQUIRE_APPROVAL'); await assert.rejects(pending.save(), (e:unknown)=>e instanceof AuthFailure&&e.message==='APPROVAL_REQUIRED'&&e.statusCode===412); assert.equal(pending.bundles.length, 0);
 const extra = setup(); extra.command.approvalRef = {}; await assert.rejects(extra.save(), (e:unknown)=>e instanceof AuthFailure&&e.message==='APPROVAL_NOT_REQUIRED'&&e.statusCode===422);
 const replay = setup(); await replay.save(); replay.command.payload = { ...replay.command.payload, reason: '다른 내용' }; await assert.rejects(replay.save(), /IDEMPOTENCY_CONFLICT/); assert.equal(replay.bundles.length, 1);
});
test('보호 재조회는 현재 원문 불가·변경을 과거 INCLUDED로 덮지 않고 회원 부재·manifest 변조를 거절한다', async () => {
 const f = setup(), saved: any = await f.save(); f.setError(new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412));
 const unavailable = await f.service.read(f.db, actor, pid, saved.data.ref.id, 1); assert.equal(unavailable.currentCheck.state, 'UNAVAILABLE'); assert.equal(unavailable.ready, false);
 f.setError(null); f.prepared.constitutionRef = { ...ref, version: 2 };
 const changed = await f.service.read(f.db, actor, pid, saved.data.ref.id, 1); assert.equal(changed.currentCheck.state, 'CHANGED');
 f.setError(new AuthFailure('PROJECT_WRITE_DENIED', 403)); await assert.rejects(f.service.read(f.db, actor, pid, saved.data.ref.id, 1), /PROJECT_WRITE_DENIED/);
 f.setError(null); f.bundles[0].manifest_json.ready = true; await assert.rejects(f.service.read(f.db, actor, pid, saved.data.ref.id, 1), /CONTEXT_INTEGRITY_FAILED/);
 f.denyMember(); await assert.rejects(f.service.read(f.db, actor, pid, saved.data.ref.id, 1), /NOT_FOUND/);
});
test('분리 저장한 항목의 누락·정규 열 변조를 manifest와 대조해 거절한다', async () => {
 const f = setup(), saved: any = await f.save(); f.items[0][7] = '바뀐 이유';
 await assert.rejects(f.service.read(f.db, actor, pid, saved.data.ref.id, 1), /CONTEXT_INTEGRITY_FAILED/);
});
test('허용된 역순 슬롯의 원 명령 hash를 정규화 입력으로 바꾸지 않고 저장·재조회·replay한다', async () => {
 const f = setup(); f.command.payload = { ...f.command.payload, slots: [...f.command.payload.slots].reverse() };
 const saved: any = await f.save();
 const read = await f.service.read(f.db, actor, pid, saved.data.ref.id, 1); assert.deepEqual(read.ref, saved.data.ref); assert.equal(read.manifest.preparationInput.slots[0].code, 'PURPOSE_REASON');
 assert.deepEqual(await f.save(), saved); assert.equal(f.bundles.length, 1);
});

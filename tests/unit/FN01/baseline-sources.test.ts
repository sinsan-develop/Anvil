import assert from 'node:assert/strict';
import test from 'node:test';
import { contentHash } from '../../../contracts/canonical.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
import { sourceDeclarationView } from '../../../apps/server/modules/projects/source-declaration-records.ts';
const module = await import('../../../apps/server/modules/projects/baseline-sources.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const id = (n: number) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
const pid = id(1), actor = { actorId: id(2), clientId: id(3), serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const ref = (n: number) => ({ id: id(n), version: 1, contentHash: 'a'.repeat(64) });
function fixture() {
 const bytes = Buffer.from('합성 기능 근거'), artifact = { artifactId: id(4), bytes: bytes.length, contentHash: contentHash(bytes), mediaType: 'text/plain;charset=utf-8' };
 const declaration = sourceDeclarationView(id(5), 1, { hostLabel: '합성 PC', displayName: '기존 자료', pathHint: 'D:\\sample', reason: '사용자 선언뿐' });
 const binding: any = { project_id: pid, declaration_id: declaration.ref.id, declaration_version: 1, created_by: actor.actorId, client_id: actor.clientId, operation: 'createProject', command_state: 'APPLIED', command_actor: actor.actorId, command_client: actor.clientId, command_result: { id: pid }, receipt_command: id(8), command_id: id(8) };
 const row: any = { id: artifact.artifactId, project_id: pid, bytes: String(artifact.bytes), content_hash: artifact.contentHash, media_type: artifact.mediaType, storage_key: `blobs/${pid}/${artifact.artifactId}`, state: 'READY', inspection_json: null };
 const snapshot: any = { projectId: pid, snapshotRef: ref(6), sourceRootRef: ref(7), grantRef: ref(8), connectorRef: ref(9), observedSummary: { rootState: 'OBSERVED', total: 1, observed: 1, missing: 0, denied: 0, changed: 0, unverified: 0 }, observedAt: '2026-10-18T07:21:31.000Z', finishedAt: '2026-10-18T07:21:32.000Z', receivedAt: '2026-10-18T07:21:33.000Z', evidenceClass: 'CONNECTOR_REPORTED', osVerification: 'UNVERIFIED', executionAuthorized: false, agentDispatchPerformed: false, baselineConfirmed: false, rawAllowed: true, report: { mustNotEcho: 'D:\\raw-report-path' } };
 const input: any = { baseRef: null, source: { kind: 'NONE_SELECTED', declarationRef: null, sourceRootRef: null, snapshotRef: null, grantRef: null, unverifiedReason: '미선택' }, items: [{ itemId: 'FN01', title: '초안', designRef: null, featureState: 'PARTIAL', evidenceRefs: [artifact], limitations: '부분 후보', reason: '실제 완료 아님' }], coverageReason: '전체 기능 검토 전', reason: '보호 원문 대조' };
 let member: any = { id: pid, participation: 'OWNER', archived_at: null }, bound = false, artifactMissing = false, snapshotsCalled = 0, originalCalled = 0, artifactCalled = 0;
 let raw: Buffer = bytes;
 const db: any = { query: async (sql: string, params: any[]) => {
  assert(sql.startsWith('SELECT'), 'mutation은 이 resolver 범위 밖'); assert.equal(params[0], pid);
  if (sql.includes('project_members')) { assert.equal(params[1], actor.actorId); return { rows: member ? [member] : [] }; }
  if (sql.includes('project_source_declarations')) return { rows: bound ? [binding] : [] };
  if (sql.includes('anvil.artifacts')) { assert.equal(params[1], artifact.artifactId); return { rows: artifactMissing ? [] : [row] }; }
  throw Error('UNEXPECTED_QUERY');
 } };
 const ports: any = { snapshots: { readSnapshot: async (_db: any, a: any, p: string, key: string) => { assert.equal(a, actor); assert.equal(p, pid); assert.equal(key, snapshot.snapshotRef.id); snapshotsCalled++; return structuredClone(snapshot); } },
  declaration: async (_db: any, key: string, version: number) => { assert.equal(key, declaration.ref.id); assert.equal(version, 1); originalCalled++; return structuredClone(declaration); },
  artifacts: { read: async (p: string, key: string, expected: any) => { assert.equal(p, pid); assert.equal(key, artifact.artifactId); assert.deepEqual(expected, { bytes: artifact.bytes, contentHash: artifact.contentHash }); artifactCalled++; return raw; } } };
 const resolve = () => { assert.equal(typeof (module as any).ProjectBaselineSources, 'function'); return new (module as any).ProjectBaselineSources(ports).resolve(db, actor, pid, input); };
 return { input, binding, row, snapshot, declaration, ports, resolve, bound: () => { bound = true; }, member: (m: any) => { member = m; }, raw: (b: Buffer) => { raw = b; }, missing: () => { artifactMissing = true; }, calls: () => ({ snapshotsCalled, originalCalled, artifactCalled }) };
}
test('미선택은 빈 소스로 확정하지 않고 같은 프로젝트 근거의 실제 바이트를 읽어도 실행/완전성을 만들지 않는다', async () => {
 const f = fixture(), result = await f.resolve();
 assert.equal(result.sourceBinding.kind, 'NONE_SELECTED'); assert.equal(result.sourceBinding.declaration, null); assert.equal(result.sourceBinding.observation, null);
 assert.deepEqual(result.input, f.input); assert.deepEqual(result.evidenceBindings[0], { itemId: 'FN01', evidenceRefs: f.input.items[0].evidenceRefs });
 for (const flag of ['contentConfirmed', 'sourceAuthorizationVerified', 'coverageVerified', 'executionAuthorized', 'dispatchPerformed']) assert.equal(result[flag], false);
 assert.equal(f.calls().artifactCalled, 1); assert.equal(JSON.stringify(result).includes('합성 기능 근거'), false);
});
test('알려진 원 선언 누락·다른 참조/명령/프로젝트·현재 비회원/조회자는 원문 전에 거절한다', async () => {
 const omitted = fixture(); omitted.bound(); await assert.rejects(omitted.resolve(), /BASELINE_SOURCE_DECLARATION_REQUIRED/); assert.equal(omitted.calls().artifactCalled, 0);
 for (const mutate of [(f: any) => { f.input.source.declarationRef = ref(99); }, (f: any) => { f.binding.project_id = id(99); }, (f: any) => { f.binding.command_state = 'REJECTED'; }, (f: any) => { f.binding.command_client = id(99); }, (f: any) => { f.binding.receipt_command = null; }]) {
  const f = fixture(); f.bound(); f.input.source.kind = 'DECLARATION_ONLY'; f.input.source.declarationRef = f.declaration.ref; mutate(f); await assert.rejects(f.resolve()); assert.equal(f.calls().artifactCalled, 0);
 }
 for (const member of [null, { id: pid, participation: 'VIEWER', archived_at: null }]) { const f = fixture(); f.member(member); await assert.rejects(f.resolve()); assert.deepEqual(f.calls(), { snapshotsCalled: 0, originalCalled: 0, artifactCalled: 0 }); }
});
test('선언은 정확 원본hash·버전만 연결하고 속성보고의 과거 등급/시각·미확인을 보존한다', async () => {
 const f = fixture(); f.bound(); f.input.source = { ...f.input.source, kind: 'ATTRIBUTE_REPORT', declarationRef: f.declaration.ref, sourceRootRef: f.snapshot.sourceRootRef, snapshotRef: f.snapshot.snapshotRef, grantRef: f.snapshot.grantRef };
 const result = await f.resolve(); assert.deepEqual(result.sourceBinding.declaration.ref, f.declaration.ref); assert.equal(result.sourceBinding.declaration.authority, 'USER_DECLARED');
 assert.equal(result.sourceBinding.observation.evidenceClass, 'CONNECTOR_REPORTED'); assert.equal(result.sourceBinding.observation.osVerification, 'UNVERIFIED'); assert.equal(result.sourceBinding.observation.observedAt, f.snapshot.observedAt);
 assert.equal(result.sourceBinding.observation.executionAuthorized, false); assert.equal(Object.hasOwn(result.sourceBinding.observation, 'report'), false); assert.equal(JSON.stringify(result).includes('raw-report-path'), false);
 assert.equal(result.sourceBinding.declarationReportRelation, 'UNVERIFIED');
 f.ports.declaration = async () => ({ ...f.declaration, ref: { ...f.declaration.ref, contentHash: 'f'.repeat(64) } }); await assert.rejects(f.resolve(), /BASELINE_SOURCE_MISMATCH/);
});
test('다른 snapshot/root/grant·metadata 전용·잘못된 등급은 verified로 소비하지 않고 거절한다', async () => {
 for (const mutate of [(f: any) => { f.snapshot.projectId = id(99); }, (f: any) => { f.snapshot.sourceRootRef = ref(99); }, (f: any) => { f.snapshot.grantRef = ref(99); }, (f: any) => { f.snapshot.snapshotRef = { ...f.snapshot.snapshotRef, contentHash: 'f'.repeat(64) }; }, (f: any) => { f.snapshot.rawAllowed = false; }, (f: any) => { f.snapshot.osVerification = 'VERIFIED'; }, (f: any) => { f.snapshot.executionAuthorized = true; }]) {
  const f = fixture(); f.input.source = { ...f.input.source, kind: 'ATTRIBUTE_REPORT', sourceRootRef: structuredClone(f.snapshot.sourceRootRef), snapshotRef: structuredClone(f.snapshot.snapshotRef), grantRef: structuredClone(f.snapshot.grantRef) }; mutate(f); await assert.rejects(f.resolve(), /BASELINE_SOURCE_MISMATCH/); assert.equal(f.calls().artifactCalled, 0);
 }
});
test('다른 프로젝트/없는/변조·격리/민감 원문·미구성 보관소를 근거로 통과시키지 않는다', async () => {
 for (const mutate of [(f: any) => f.missing(), (f: any) => { f.row.project_id = id(99); }, (f: any) => { f.row.content_hash = 'f'.repeat(64); }, (f: any) => { f.row.media_type = 'image/png'; }, (f: any) => { f.row.storage_key = 'outside'; }, (f: any) => f.raw(Buffer.from('변조')), (f: any) => { f.row.state = 'QUARANTINED'; }, (f: any) => { f.ports.artifacts = null; }]) {
  const f = fixture(); mutate(f); await assert.rejects(f.resolve());
 }
 const denied = fixture(); denied.ports.artifacts.read = async () => { throw new AuthFailure('ARTIFACT_QUARANTINED', 412); }; await assert.rejects(denied.resolve(), /ARTIFACT_QUARANTINED/);
 const secret = fixture(), bytes = Buffer.from('token=SYNTHETIC_NOT_REAL'); secret.input.items[0].evidenceRefs[0].bytes = bytes.length; secret.input.items[0].evidenceRefs[0].contentHash = contentHash(bytes); secret.row.bytes = String(bytes.length); secret.row.content_hash = contentHash(bytes); secret.raw(bytes);
 await assert.rejects(secret.resolve(), /ARTIFACT_SENSITIVE_CONTENT_SUSPECTED/);
});

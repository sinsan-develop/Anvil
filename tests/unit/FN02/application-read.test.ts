import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { ProjectMethodologies } from '../../../apps/server/modules/methodologies/project-methodologies.ts';
import { AccessRepository, type AuthenticatedIdentity } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

const pid = 'a6f20000-0000-4000-8000-000000000010', aid = 'a6f20000-0000-4000-8000-000000000091', mid = 'a6f20000-0000-4000-8000-000000000021';
const actor: AuthenticatedIdentity = { actorId: mid, clientId: aid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const formRef = { id: aid, version: 1, contentHash: 'f'.repeat(64) };
function row() {
  const graph = { nodes: [{ nodeId: 'N1', name: '사람 검토', purpose: '원본 대조', kind: 'HUMAN', position: { x: 0, y: 0 }, role: 'USER', inputs: [],
    outputs: [{ itemId: 'result', formRef, required: true, reviewCriteria: ['검토 기록'] }], taskScope: { included: ['검토'], excluded: [] }, completionCriteria: ['검토 결과 저장'], approvalBoundary: ['사람 확인'], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['상황 기록'] }], edges: [], entryNodeId: 'N1', terminalNodeIds: ['N1'] };
  const snapshot = { name: '현재 고정본', purpose: '방법론 정의와 적용을 구분', graph, sourceRef: { id: mid, version: 3, contentHash: contentHash(canonicalJson(graph)) } };
  return { id: aid, project_id: pid, application_version: 2, source_definition_id: mid, source_version: 3, source_hash: snapshot.sourceRef.contentHash, snapshot_json: snapshot, snapshot_hash: contentHash(canonicalJson(snapshot)) };
}
function database(value: unknown, member = true) {
  const queries: string[] = [];
  const db = { query: async (sql: string, params: unknown[]) => {
    queries.push(sql); assert(!/\b(?:INSERT|UPDATE|DELETE|set_config)\b/i.test(sql));
    if (sql.includes('JOIN anvil.project_members')) { assert.deepEqual(params, [pid, actor.actorId]); return { rows: member ? [{ id: pid, archived_at: null, participation: 'VIEWER' }] : [] }; }
    assert(sql.includes('FROM anvil.project_methodologies')); assert.match(sql, /ORDER BY application_version DESC LIMIT 1/); assert.deepEqual(params, [pid]);
    return { rows: value === null ? [] : [structuredClone(value)] };
  } } as unknown as PoolClient;
  return { db, queries };
}
const read = (db: PoolClient, raw: Record<string, unknown> = {}) => new ProjectMethodologies().readApplication(db, actor, pid, raw);

test('적용 snapshot은 현재 회원만 읽고 정의 ID와 별개인 적용 ref·원 snapshot을 반환한다', async () => {
  const value = row(), { db, queries } = database(value), result = await read(db);
  assert.deepEqual(result.applicationRef, { id: aid, version: 2, contentHash: value.snapshot_hash });
  assert.deepEqual(result.snapshot, value.snapshot_json); assert.equal(result.projectId, pid); assert.equal(result.executionState, 'NOT_CONNECTED');
  assert(Number.isFinite(Date.parse(result.observedAt))); assert.equal(queries.length, 2);
});
test('미적용은 null 쌍이며 없는 회원·교차 프로젝트는 snapshot 조회 전 거절한다', async () => {
  assert.deepEqual((({ applicationRef, snapshot, executionState }) => ({ applicationRef, snapshot, executionState }))(await read(database(null).db)), { applicationRef: null, snapshot: null, executionState: 'NOT_CONNECTED' });
  const missing = database(row(), false); await assert.rejects(read(missing.db), { message: 'NOT_FOUND', statusCode: 404 }); assert.equal(missing.queries.length, 1);
});
test('query·행/소스/hash/추가 snapshot 필드가 어긋나면 읽기 성공으로 바꾸지 않는다', async () => {
  await assert.rejects(read(database(row()).db, { afterId: aid }), { message: 'INPUT_INVALID', statusCode: 400 });
  const value = row();
  for (const changed of [{ ...value, project_id: aid }, { ...value, source_version: 4 }, { ...value, source_hash: '0'.repeat(64) }, { ...value, snapshot_hash: '0'.repeat(64) }, { ...value, id: 'invalid' }, { ...value, application_version: 0 }, { ...value, snapshot_json: { ...value.snapshot_json, privateUnexpected: 'synthetic' } }])
    await assert.rejects(read(database(changed).db), { message: 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED', statusCode: 503 });
});
test('해시를 함께 바꿔도 잘못된 그래프 구조·단계 참조를 수용하지 않는다', async () => {
  for (const mutate of [(v: ReturnType<typeof row>) => { v.snapshot_json.graph.entryNodeId = 'MISSING'; }, (v: ReturnType<typeof row>) => { v.snapshot_json.graph.nodes.push(structuredClone(v.snapshot_json.graph.nodes[0]!)); }]) {
    const value = row(); mutate(value); value.source_hash = value.snapshot_json.sourceRef.contentHash = contentHash(canonicalJson(value.snapshot_json.graph)); value.snapshot_hash = contentHash(canonicalJson(value.snapshot_json));
    await assert.rejects(read(database(value).db), { message: 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED', statusCode: 503 });
  }
});
test('선택적 생성 초안 확정 참조도 정확 키·참조/hash를 요구한다', async () => {
  const value: any = row(); value.snapshot_json.draftConfirmationRef = { draftRef: { id: pid, version: 5, contentHash: value.source_hash }, confirmationId: aid }; value.snapshot_hash = contentHash(canonicalJson(value.snapshot_json));
  assert.deepEqual((await read(database(value).db)).snapshot, value.snapshot_json);
  value.snapshot_json.draftConfirmationRef.confirmationId = 'bad'; value.snapshot_hash = contentHash(canonicalJson(value.snapshot_json));
  await assert.rejects(read(database(value).db), { message: 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED', statusCode: 503 });
});
test('새 GET의 인증·Host·형식/query 거절과 no-store는 실제 Fastify 등록 경로에 연결된다', async () => {
  const pool = new Pool({ connectionTimeoutMillis: 1 });
  const app = buildApp({}, undefined, { repository: new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) }), origin: 'https://localhost:3830' });
  try {
    const url = `/api/v1/projects/${pid}/methodology-application`;
    const denied = await app.inject({ method: 'GET', url, headers: { host: 'localhost:3830' } }); assert.equal(denied.statusCode, 401); assert.equal(denied.headers['cache-control'], 'no-store');
    assert.equal((await app.inject({ method: 'GET', url, headers: { host: 'other.example' } })).statusCode, 403);
    for (const path of [url + '?unknown=1', '/api/v1/projects/invalid/methodology-application']) assert.equal((await app.inject({ method: 'GET', url: path, headers: { host: 'localhost:3830' } })).statusCode, 400);
  } finally { await app.close(); await pool.end(); }
});

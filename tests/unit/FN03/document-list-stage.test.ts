import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { ProjectDocuments } from '../../../apps/server/modules/documents/project-documents.ts';
import { ProjectListCodec } from '../../../apps/server/modules/projects/service.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

const pid = 'a6f20400-0000-4000-8000-000000000201', aid = 'a6f20400-0000-4000-8000-000000000301', uid = 'a6f20400-0000-4000-8000-000000000101';
const actor = { actorId: uid, clientId: uid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const codec = new ProjectListCodec(value => contentHash(value));
function application() {
  const graph = { nodes: [{ nodeId: 'N1', name: '정의', purpose: '필터', kind: 'HUMAN', position: { x: 0, y: 0 }, role: 'USER', inputs: [], outputs: [], taskScope: { included: ['검토'], excluded: [] }, completionCriteria: ['기록'], approvalBoundary: ['사람 확인'], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['상황'] }], edges: [], entryNodeId: 'N1', terminalNodeIds: ['N1'] };
  const sourceRef = { id: uid, version: 1, contentHash: contentHash(canonicalJson(graph)) }, snapshot = { name: '고정 절차', purpose: '조회', graph, sourceRef };
  return { id: aid, project_id: pid, application_version: 1, source_definition_id: uid, source_version: 1, source_hash: sourceRef.contentHash, snapshot_json: snapshot, snapshot_hash: contentHash(canonicalJson(snapshot)) };
}
const docs = [1, 2].map(index => ({ id: `a6f20400-0000-4000-8000-00000000040${index}`, title: '단계 문서 ' + index, head_version: 2, confirmed_version: null, updated_at: new Date('2026-10-17T01:02:03Z'), cursor_at: `2026-10-17T01:02:03.00000${index}Z` }));
function database(options: { member?: boolean; atomicMember?: boolean; applied?: ReturnType<typeof application> | null } = {}) {
  const queries: string[] = [];
  const db = { query: async (sql: string, params: unknown[]) => {
    queries.push(sql); assert(!/\b(?:INSERT|UPDATE|DELETE|set_config)\b/i.test(sql));
    if (!sql.startsWith('WITH member_scope') && sql.includes('JOIN anvil.project_members')) return { rows: options.member === false ? [] : [{ id: pid, archived_at: null, participation: 'VIEWER' }] };
    if (sql.startsWith('WITH member_scope')) {
      assert.deepEqual(params.slice(4), [aid, 'N1', uid]);
      return { rows: docs.map(row => ({ ...row, is_member: options.atomicMember !== false, application: options.applied === undefined ? application() : options.applied })) };
    }
    assert.equal(params[0], pid); return { rows: docs };
  } } as unknown as PoolClient;
  return { db, queries };
}
const list = (db: PoolClient, query: Record<string, unknown>, who = actor, project = pid) => new ProjectDocuments().list(db, who, project, query, codec);

// 결함 검출: 새query 무시·필터/actor간cursor재사용·확인후적용변경/회원회수의옛목록반환.
test('단계 목록은 단일 읽기 snapshot의 현재 적용본과 정확 노드·cursor를 결박한다', async () => {
  const fixture = database(), page = await list(fixture.db, { applicationId: aid, nodeId: 'N1', limit: '1' });
  assert.equal(page.items.length, 1); assert.equal(page.items[0]!.title, '단계 문서 1'); assert.equal(page.hasMore, true); assert(page.nextCursor);
  assert.equal(fixture.queries.filter(sql => sql.startsWith('WITH member_scope')).length, 1);
  assert.equal((await list(database().db, { applicationId: aid, nodeId: 'N1', limit: '1', cursor: page.nextCursor })).items.length, 1);
});
test('필터는 쌍·정확참조 입력만 받으며 비회원은 읽기 전에 404다', async () => {
  for (const query of [{ applicationId: aid }, { nodeId: 'N1' }, { applicationId: '../../bad', nodeId: 'N1' }, { applicationId: aid, nodeId: '\u0000' }, { applicationId: aid, nodeId: 'N1', extra: '1' }])
    await assert.rejects(list(database().db, query), { message: 'INPUT_INVALID', statusCode: 400 });
  const missing = database({ member: false }); await assert.rejects(list(missing.db, { applicationId: aid, nodeId: 'N1' }), { message: 'NOT_FOUND', statusCode: 404 }); assert.equal(missing.queries.length, 1);
});
test('같은 읽기 snapshot의 회원회수·옛적용·없는노드·변조는 문서목록을 내보내지 않는다', async () => {
  const query = { applicationId: aid, nodeId: 'N1' };
  await assert.rejects(list(database({ atomicMember: false }).db, query), { message: 'NOT_FOUND', statusCode: 404 });
  for (const applied of [null, { ...application(), id: pid }]) await assert.rejects(list(database({ applied }).db, query), { message: 'METHODOLOGY_APPLICATION_CHANGED', statusCode: 409 });
  const changed = application(); changed.snapshot_json.graph.nodes[0]!.nodeId = changed.snapshot_json.graph.entryNodeId = changed.snapshot_json.graph.terminalNodeIds[0] = 'N2'; changed.source_hash = changed.snapshot_json.sourceRef.contentHash = contentHash(canonicalJson(changed.snapshot_json.graph)); changed.snapshot_hash = contentHash(canonicalJson(changed.snapshot_json));
  await assert.rejects(list(database({ applied: changed }).db, query), { message: 'NOT_FOUND', statusCode: 404 });
  await assert.rejects(list(database({ applied: { ...application(), snapshot_hash: '0'.repeat(64) } }).db, query), { message: 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED', statusCode: 503 });
});
test('단계cursor를 무필터·다른node/project/actor에서 재사용하지 못한다', async () => {
  const first = await list(database().db, { applicationId: aid, nodeId: 'N1', limit: '1' }), cursor = first.nextCursor;
  for (const [query, who, project] of [[{ cursor, limit: '1' }, actor, pid], [{ applicationId: aid, nodeId: 'N2', cursor, limit: '1' }, actor, pid], [{ applicationId: aid, nodeId: 'N1', cursor, limit: '1' }, { ...actor, actorId: aid }, pid], [{ applicationId: aid, nodeId: 'N1', cursor, limit: '1' }, actor, uid]] as const)
    await assert.rejects(list(database().db, query, who, project), { message: 'CURSOR_INVALID', statusCode: 400 });
  const ordinary = await list(database().db, { limit: '1' });
  await assert.rejects(list(database().db, { applicationId: aid, nodeId: 'N1', limit: '1', cursor: ordinary.nextCursor }), { message: 'CURSOR_INVALID', statusCode: 400 });
});
test('기존 무필터 cursor와 DocumentPage 형식은 그대로다', async () => {
  const cursor = codec.create(actor.actorId, { query: pid, archived: false, limit: 1 }, { at: docs[0]!.cursor_at, id: docs[0]!.id });
  const page = await list(database().db, { limit: '1', cursor });
  assert.deepEqual(Object.keys(page).sort(), ['hasMore', 'items', 'nextCursor', 'observedAt']); assert.equal(page.items[0]!.headVersion, 2);
});

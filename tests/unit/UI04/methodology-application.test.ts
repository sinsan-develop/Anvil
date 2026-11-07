import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import * as workspace from '../../../apps/web/src/features/workspace/api.ts';
import { canonicalJson } from '../../../contracts/canonical.ts';
const pid = 'a6f20000-0000-4000-8000-000000000010', aid = 'a6f20000-0000-4000-8000-000000000091', mid = 'a6f20000-0000-4000-8000-000000000021';
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
function data() {
  const graph = { nodes: [{ nodeId: 'N1', name: '검토', purpose: '원본 검토', kind: 'HUMAN', position: { x: 0, y: 0 }, role: 'USER', inputs: [], outputs: [], taskScope: { included: ['검토'], excluded: [] }, completionCriteria: ['기록'], approvalBoundary: ['사람 승인'], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['상황 기록'] }], edges: [], entryNodeId: 'N1', terminalNodeIds: ['N1'] };
  const snapshot = { name: '실제 고정 적용 정의', purpose: '실행과 구분', graph, sourceRef: { id: mid, version: 3, contentHash: hash(graph) } };
  return { projectId: pid, applicationRef: { id: aid, version: 2, contentHash: hash(snapshot) }, snapshot, observedAt: '2026-10-17T21:11:46Z', executionState: 'NOT_CONNECTED' };
}
const client = (value: unknown) => new ApiClient((async () => Response.json(value)) as typeof fetch);
const read = (transport: ApiClient, expected: any) => workspace.readWorkspaceMethodology(transport, pid, expected);

test('새 적용 GET만 읽고 고정 ref·snapshot/graph hash를 검증해 그대로 반환한다', async () => {
  const value = data(), calls: unknown[] = [];
  const transport = new ApiClient((async (path, init) => { calls.push([path, init?.method, init?.credentials]); return Response.json(value); }) as typeof fetch);
  assert.deepEqual(await read(transport, value.applicationRef), value); assert.deepEqual(calls, [[`/api/v1/projects/${pid}/methodology-application`, 'GET', 'same-origin']]);
});
test('두 조회 사이 적용 ref 변경·적용/미적용 전환을 섞지 않고 재조회를 요구한다', async () => {
  const value = data(), empty = { ...value, applicationRef: null, snapshot: null };
  for (const expected of [null, { ...value.applicationRef, id: mid }, { ...value.applicationRef, version: 1 }, { ...value.applicationRef, contentHash: '0'.repeat(64) }])
    await assert.rejects(read(client(value), expected), { code: 'METHODOLOGY_APPLICATION_CHANGED' });
  await assert.rejects(read(client(empty), value.applicationRef), { code: 'METHODOLOGY_APPLICATION_CHANGED' });
  assert.deepEqual(await read(client(empty), null), empty);
});
test('교차 project·위장 실행 상태·추가 필드·부분 null·변조 본문을 거절한다', async () => {
  const value = data();
  for (const changed of [{ ...value, projectId: aid }, { ...value, executionState: 'RUNNING' }, { ...value, executionAuthorized: true }, { ...value, snapshot: null }, { ...value, snapshot: { ...value.snapshot, name: '변조된 이름' } }, { ...value, snapshot: { ...value.snapshot, sourceRef: { ...value.snapshot.sourceRef, contentHash: '0'.repeat(64) } } }])
    await assert.rejects(read(client(changed), value.applicationRef), { code: 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED' });
});
test('변조 해시가 아니라도 표시할 단계 필드·연결이 잘못되면 거절한다', async () => {
  for (const mutate of [(value: ReturnType<typeof data>) => { value.snapshot.graph.nodes[0]!.taskScope = null as any; }, (value: ReturnType<typeof data>) => { value.snapshot.graph.entryNodeId = 'MISSING'; }]) {
    const value = data(); mutate(value); value.snapshot.sourceRef.contentHash = hash(value.snapshot.graph); value.applicationRef.contentHash = hash(value.snapshot);
    await assert.rejects(read(client(value), value.applicationRef), { code: 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED' });
  }
});
test('로그인/권한/네트워크 실패를 미적용 성공으로 대체하지 않는다', async () => {
  for (const status of [401, 403, 404, 503]) await assert.rejects(read(new ApiClient((async () => Response.json({ code: 'DENIED' }, { status })) as typeof fetch), data().applicationRef), { status });
  await assert.rejects(read(new ApiClient((async () => { throw Error('synthetic'); }) as typeof fetch), data().applicationRef), { code: 'CONNECTION_LOST' });
});

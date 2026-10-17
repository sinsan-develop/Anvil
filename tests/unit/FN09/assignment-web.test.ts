import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
const module = await import('../../../apps/web/src/features/workspace/assignment-api.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const fn = (name: string) => { assert.equal(typeof (module as any)[name], 'function'); return (module as any)[name]; };
const pid = '11111111-1111-4111-8111-111111111111', cid = '22222222-2222-4222-8222-222222222222', session = { user: { id: pid }, clientId: cid, csrfToken: 'C'.repeat(43) };
const ref = { id: pid, version: 1, contentHash: 'a'.repeat(64) }, application = { ...ref, id: cid }, design = { ...ref, id: '33333333-3333-4333-8333-333333333333' };
const plan: any = { ref, designRef: design, tasks: [{ taskCode: 'FN01', purpose: '내 시스템에서 개발 통제', title: '임무 구현', inputs: ['요구'], outputs: ['코드'], acceptanceCriteria: ['동작'], included: ['구현'], excluded: ['운영'], testCases: [{ expected: '정상 확인' }], ownerRole: '책임자' }] };
const buffer = () => { const value = fn('newAssignmentDraft')(pid, session, 1, plan, 'FN01', application, 'N1'); value.input.reason = '사용자 초안 저장'; return value; };
function reply(command: any) {
  const snapshot = { definition: command.payload.definition, reason: command.payload.reason, previousRef: command.payload.baseRef, basis: { planRef: ref, applicationRef: application, designRef: design, taskCode: 'FN01', nodeId: 'N1', taskCardHash: 'b'.repeat(64) }, readinessIssues: [{ code: 'EXECUTION_NOT_CONNECTED', location: 'taskRef' }], status: 'DRAFT', ready: false, executionAuthorized: false, dispatchPerformed: false };
  const target = { id: '44444444-4444-4444-8444-444444444444', version: 1, contentHash: contentHash(canonicalJson(snapshot)) };
  return { operationId: pid, commandId: command.commandId, projectId: pid, status: 'APPLIED', targetId: target.id, version: 1, data: { ref: target, status: 'ASSIGNMENT_DRAFT_STORED', snapshot }, evidenceRefs: [], warnings: [], serverReceivedAt: '2026-10-17T23:00:00Z' };
}
test('임무 초안 명령은 사용자/client·제어세대에 묶이고 입력 편집과 분리한다', () => {
  const b = buffer(), pending = fn('prepareAssignmentWrite')(b, session);
  assert.equal(pending.operation, 'prepareAssignment'); assert.equal(pending.expectedVersion, 0); assert.equal(pending.targetId, null); assert.equal(pending.payload.definition.goal, '임무 구현');
  b.input.definition.goal = '수정'; assert.equal(pending.payload.definition.goal, '임무 구현');
  const prepare = fn('prepareAssignmentWrite'); assert.throws(() => prepare(buffer(), { ...session, clientId: pid }), error => error instanceof ApiError && error.code === 'ASSIGNMENT_BINDING_INVALID');
  const retry = buffer(); retry.pending = pending; assert.equal(prepare(retry, session).commandId, pending.commandId);
});
test('저장은 same-origin·같은 명령으로만 보내고 정확 snapshot hash/거짓READY를 거절한다', async () => {
  const b = buffer(), command = fn('prepareAssignmentWrite')(b, session), send = fn('sendAssignmentDraft'); let captured: RequestInit | undefined;
  const client = new ApiClient(async (path, init) => { assert.equal(path, `/api/v1/projects/${pid}/commands`); captured = init; return Response.json(reply(command)); });
  const value = await send(client, command, design, session.csrfToken); assert.equal(value.snapshot.ready, false); assert.equal(captured?.credentials, 'same-origin'); assert.equal(captured?.redirect, 'error'); assert.equal(captured?.cache, 'no-store');
  for (const mutate of [(v: any) => { v.data.snapshot.ready = true; }, (v: any) => { v.data.snapshot.definition.goal = '변조'; }, (v: any) => { v.commandId = pid; }]) { const response = structuredClone(reply(command)); mutate(response); await assert.rejects(send(new ApiClient(async () => Response.json(response)), command, design, session.csrfToken)); }
});
test('응답 유실 재확인은 같은 command/body이고 다른 hash/프로젝트의 읽기는 채택하지 않는다', async () => {
  const b = buffer(), command = fn('prepareAssignmentWrite')(b, session), send = fn('sendAssignmentDraft'), bodies: unknown[] = []; let attempt = 0;
  const client = new ApiClient(async (_path, init) => { bodies.push(init?.body); if (++attempt === 1) throw Error('network'); return Response.json(reply(command)); });
  await assert.rejects(send(client, command, design, session.csrfToken), error => error instanceof ApiError && error.code === 'CONNECTION_LOST'); await send(client, command, design, session.csrfToken); assert.equal(bodies[0], bodies[1]);
  const r = reply(command), read = fn('readAssignmentDraft'), view = { projectId: pid, ref: r.data.ref, snapshot: r.data.snapshot, headVersion: 1, sourceCurrentness: 'NOT_RECHECKED', observedAt: r.serverReceivedAt };
  assert.equal((await read(new ApiClient(async () => Response.json(view)), pid, r.data.ref)).ref.contentHash, r.data.ref.contentHash);
  await assert.rejects(read(new ApiClient(async () => Response.json({ ...view, projectId: cid })), pid, r.data.ref));
  await assert.rejects(read(new ApiClient(async () => Response.json(view)), pid, { ...r.data.ref, contentHash: 'f'.repeat(64) }));
});

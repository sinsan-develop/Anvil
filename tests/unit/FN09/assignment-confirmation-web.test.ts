import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
const module: any = await import('../../../apps/web/src/features/workspace/assignment-confirmation-api.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const fn = (name: string) => { assert.equal(typeof module[name], 'function'); return module[name]; };
const pid = '11111111-1111-4111-8111-111111111111', cid = '22222222-2222-4222-8222-222222222222';
const session = { user: { id: pid }, clientId: cid, csrfToken: 'C'.repeat(43) }, draft: any = { projectId: pid, ref: { id: pid, version: 1, contentHash: 'a'.repeat(64) }, snapshot: { definition: { goal: '원 임무' }, readinessIssues: [{ code: 'EXECUTION_NOT_CONNECTED', location: 'taskRef' }] } };
test('사람 검토 입력은 기본 미실행이며 명시판단·이유와 사용자/client 고정 없이는 보내지 않는다', () => {
  const b = fn('newAssignmentDecision')(draft, session, 1, 'REVIEW', []);
  assert(b.input.items.every((item: any) => item.outcome === 'NOT_EXECUTED' && item.reason === ''));
  assert.throws(() => fn('prepareAssignmentDecision')(b, session));
  b.input.items.forEach((item: any) => { item.outcome = 'ACCEPTED'; item.reason = '사람 검토'; }); b.input.outcome = 'ACCEPTED'; b.input.reason = '내용 검토'; b.acknowledged = true;
  const command = fn('prepareAssignmentDecision')(b, session); assert.equal(command.operation, 'reviewAssignmentContent'); assert.deepEqual(command.payload.draftRef, draft.ref);
  b.pending = command; assert.equal(fn('prepareAssignmentDecision')(b, session).commandId, command.commandId);
  assert.throws(() => fn('prepareAssignmentDecision')(b, { ...session, clientId: pid }));
  b.input.reason = '바뀐 입력'; assert.throws(() => fn('prepareAssignmentDecision')(b, session));
});
test('확정 원본은 전용 경로·전체ref·원초안 hash로 읽고 초안ref fallback은 없다', async () => {
  const snapshot = { draftRef: draft.ref, definition: draft.snapshot.definition, reviewRefs: [{ id: cid, version: 1, contentHash: 'b'.repeat(64) }], reason: '내용 확정', confirmedBy: { kind: 'HUMAN', userId: pid }, confirmedAt: '2026-10-18T01:50:00Z', contentConfirmed: true, readinessIssues: draft.snapshot.readinessIssues, ready: false, executionAuthorized: false, dispatchPerformed: false };
  const ref = { ...draft.ref, contentHash: contentHash(canonicalJson(snapshot)) }, view = { projectId: pid, ref, snapshot, observedAt: snapshot.confirmedAt }; const calls: string[] = [];
  const client = new ApiClient(async path => { calls.push(String(path)); return Response.json(view); });
  const result = await fn('readConfirmedAssignment')(client, pid, ref, draft); assert.equal(result.snapshot.ready, false); assert.deepEqual(calls, [`/api/v1/projects/${pid}/assignments/${pid}/versions/1`]);
  await assert.rejects(fn('readConfirmedAssignment')(client, pid, draft.ref, draft)); assert(calls.every(path => path.includes('/assignments/')));
  const wrong = structuredClone(view); wrong.snapshot.draftRef.contentHash = 'f'.repeat(64); wrong.ref.contentHash = contentHash(canonicalJson(wrong.snapshot));
  await assert.rejects(fn('readConfirmedAssignment')(new ApiClient(async () => Response.json(wrong)), pid, wrong.ref, draft));
});
test('저장 응답 유실은 성공으로 채택하지 않고 동일 원명령을 재확인한다', async () => {
  const b = fn('newAssignmentDecision')(draft, session, 1, 'CONFIRM', [{ id: cid, version: 1, contentHash: 'b'.repeat(64) }]); b.input.reason = '내용만 확정'; b.acknowledged = true;
  const command = fn('prepareAssignmentDecision')(b, session), bodies: unknown[] = [];
  const client = new ApiClient(async (_path, init) => { bodies.push(init?.body); throw Error('network'); });
  await assert.rejects(fn('sendAssignmentDecision')(client, command, draft, session)); await assert.rejects(fn('sendAssignmentDecision')(client, command, draft, session)); assert.equal(bodies[0], bodies[1]);
});
test('같은 해시를 다시 만든 ready 위조·다른 종류의 영수증도 확정으로 채택하지 않는다', async () => {
  const b = fn('newAssignmentDecision')(draft, session, 1, 'CONFIRM', [{ id: cid, version: 1, contentHash: 'b'.repeat(64) }]); b.input.reason = '내용만 확정'; b.acknowledged = true;
  const command = fn('prepareAssignmentDecision')(b, session);
  for (const kind of ['ready', 'receiptKind']) {
    const snapshot = { draftRef: draft.ref, definition: draft.snapshot.definition, reviewRefs: command.payload.reviewRefs, reason: command.payload.reason, confirmedBy: { kind: 'HUMAN', userId: pid }, confirmedAt: '2026-10-18T01:50:00Z', contentConfirmed: true, readinessIssues: draft.snapshot.readinessIssues, ready: kind === 'ready', executionAuthorized: false, dispatchPerformed: false };
    const reference = { ...draft.ref, contentHash: contentHash(canonicalJson(snapshot)) };
    const reply = { operationId: pid, commandId: command.commandId, projectId: pid, status: 'APPLIED', targetId: reference.id, version: 1, data: { status: kind === 'receiptKind' ? 'ASSIGNMENT_DRAFT_STORED' : 'ASSIGNMENT_CONTENT_CONFIRMED', ref: reference, snapshot, confirmationId: cid }, serverReceivedAt: snapshot.confirmedAt };
    await assert.rejects(fn('sendAssignmentDecision')(new ApiClient(async () => Response.json(reply)), command, draft, session));
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { emptyDraft, writeProjectDraft, runDraftAction, type DraftAction } from '../../../apps/web/src/features/project-create/api.ts';

const gateModule = '../../../apps/web/src/features/project-create/draft-mutation-gate.ts';
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

test('저장이 끝나기 전 같은 화면의 다른 변경은 진입·명령 생성·전송하지 않는다', async () => {
  const { createDraftMutationGate } = await import(gateModule);
  const gate = createDraftMutationGate(), wait = deferred(), calls: string[] = [];
  const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
  const input = { ...emptyDraft().input, name: '보존 입력' };
  const body = { schemaVersion: 1, commandId: id, clientId: id, expectedVersion: 2, step: 4, input };
  const client = new ApiClient(async (path, init) => {
    calls.push(String(path)); assert.equal(init!.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(init!.body)), body);
    await wait.promise;
    return Response.json({ draftId: id, version: 3, step: 4, input });
  });
  const saving = gate.run(async () => { await writeProjectDraft(client, id, body, 'C'.repeat(43)); });
  assert.equal(gate.isBusy(), true);
  let newCommands = 0;
  await gate.run(async () => { newCommands++; throw new Error('중복 진입'); });
  assert.equal(newCommands, 0); assert.equal(calls.length, 1);
  wait.resolve(); await saving; assert.equal(gate.isBusy(), false);
  await gate.run(async () => { newCommands++; });
  assert.equal(newCommands, 1); assert.deepEqual(input, body.input);
});

test('변경 뒤 후속 조회까지 잠금을 유지하고 중첩 호출도 대기열에 넣지 않는다', async () => {
  const { createDraftMutationGate } = await import(gateModule);
  const gate = createDraftMutationGate(), read = deferred(); const events: string[] = [];
  const action = gate.run(async () => {
    events.push('명령');
    await gate.run(async () => { events.push('중첩'); });
    await Promise.resolve(); events.push('조회 시작'); await read.promise; events.push('조회 끝');
  });
  await Promise.resolve(); assert.equal(gate.isBusy(), true);
  await gate.run(async () => { events.push('겹친 저장'); });
  assert.equal(events.includes('중첩'), false); assert.equal(events.includes('겹친 저장'), false);
  read.resolve(); await action; assert.equal(gate.isBusy(), false);
  assert.deepEqual(events, ['명령', '조회 시작', '조회 끝']);
});

test('실패는 원 오류를 보존하며 잠금만 해제하고 명시적 같은 명령 재확인만 허용한다', async () => {
  const { createDraftMutationGate } = await import(gateModule);
  const gate = createDraftMutationGate(), error = new Error('응답 미확인');
  const command = Object.freeze({ commandId: '고정 명령', input: '실패 전 입력' });
  const sent: unknown[] = [];
  await assert.rejects(gate.run(async () => { sent.push(command); throw error; }), failure => failure === error);
  assert.equal(gate.isBusy(), false); assert.equal(sent.length, 1);
  await Promise.resolve(); assert.equal(sent.length, 1);
  await gate.run(async () => { sent.push(command); });
  assert.equal(sent[0], sent[1]); assert.equal(command.input, '실패 전 입력');
});

test('기존 저장·생성 API는 어느 쪽이 먼저여도 진행 중인 한 요청만 전송한다', async () => {
  const { createDraftMutationGate } = await import(gateModule);
  const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
  const input = { ...emptyDraft().input, name: '원입력', purpose: '목적', desiredOutcome: '기대' };
  const action: DraftAction = { kind: 'create', draftId: id, body: { schemaVersion: 1, commandId: id, clientId: id, draftId: id, draftVersion: 2 } };
  for (const first of ['save', 'create'] as const) {
    const gate = createDraftMutationGate(), wait = deferred(), calls: string[] = [];
    const client = new ApiClient(async (path, init) => {
      calls.push(String(path)); await wait.promise;
      if (String(path) === '/api/v1/projects') {
        assert.equal(init!.method, 'POST'); assert.deepEqual(JSON.parse(String(init!.body)), action.body);
        return Response.json({ id, ...input, version: 1, participation: 'OWNER', currentMethodologyRef: { id, version: 1, contentHash: 'a'.repeat(64) }, baselineRef: null, readinessIssues: [{ code: 'ENVIRONMENT_UNVERIFIED' }], controlState: { actorId: id, clientId: id, generation: 1, status: 'HELD' } });
      }
      assert.equal(init!.method, 'PATCH');
      return Response.json({ draftId: id, version: 3, step: 4, input });
    });
    const save = () => writeProjectDraft(client, id, { schemaVersion: 1, commandId: id, clientId: id, expectedVersion: 2, step: 4, input }, 'C'.repeat(43));
    const create = () => runDraftAction(client, action, 'C'.repeat(43), id);
    const active = gate.run(first === 'save' ? save : create);
    await gate.run(first === 'save' ? create : save);
    assert.deepEqual(calls, [first === 'save' ? `/api/v1/project-drafts/${id}` : '/api/v1/projects']);
    wait.resolve(); await active;
    await gate.run(first === 'save' ? create : save);
    assert.equal(calls.length, 2); assert.equal(gate.isBusy(), false);
  }
});

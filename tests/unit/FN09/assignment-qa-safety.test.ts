import assert from 'node:assert/strict';
import test from 'node:test';
const load = () => import('../../integration/FN09/assignment-qa-safety.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
test('임무 QA는 원 실패·close 실패를 보존하면서 나머지 독립 정리를 모두 시도한다', async () => {
  const m: any = await load(); assert.equal(typeof m.finishAssignmentQa, 'function');
  const original = Error('PRIMARY_FAILURE'), close = Error('CLOSE_FAILED'), attempted: string[] = [];
  await assert.rejects(m.finishAssignmentQa(original, [async () => { attempted.push('close'); throw close; }, async () => { attempted.push('database'); }, async () => { attempted.push('keys'); }, async () => { attempted.push('pool'); throw Error('POOL_FAILED'); }, async () => { attempted.push('files'); }]), (e: any) => e instanceof AggregateError && e.errors.includes(original) && e.errors.includes(close) && e.errors.length === 3);
  assert.deepEqual(attempted, ['close', 'database', 'keys', 'pool', 'files']); await m.finishAssignmentQa(null, [async () => {}]);
});
test('임무 QA는 기한 만료 또는 test 취소 뒤 직접 변경 callback을 시작하지 않는다', async () => {
  const m: any = await load(); assert.equal(typeof m.assignmentQaMutation, 'function'); const controller = new AbortController(); let calls = 0, clock = 100;
  const write = () => m.assignmentQaMutation(200, controller.signal, async () => ++calls, () => clock);
  assert.equal(await write(), 1); clock = 200; await assert.rejects(write(), /FN09_QA_MUTATION_WINDOW_CLOSED/); assert.equal(calls, 1);
  clock = 100; controller.abort(); await assert.rejects(write(), /FN09_QA_MUTATION_WINDOW_CLOSED/); assert.equal(calls, 1);
});
test('임무 QA body 준비 중 취소·기한 만료되면 준비 후 실제 요청을 시작하지 않는다', async () => {
  const m: any = await load(); assert.equal(typeof m.assignmentQaPreparedMutation, 'function');
  for (const cancelled of [true, false]) {
    const controller = new AbortController(); let clock = 100, calls = 0, resume!: (value: string) => void;
    const body = new Promise<string>(resolve => { resume = resolve; });
    const request = m.assignmentQaPreparedMutation(200, controller.signal, () => body, async () => { calls++; }, () => clock), rejected = assert.rejects(request, /FN09_QA_MUTATION_WINDOW_CLOSED/);
    if (cancelled) controller.abort(); else clock = 200; resume('prepared'); await rejected; assert.equal(calls, 0);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

const manifestPath = '../../../scripts/fn15-isolated-qa-manifest.ts';
const qaPath = '../../../scripts/fn15-isolated-qa.ts';
const launchPath = '../../../scripts/fn15-isolated-qa-launch.ts';
const manifest = await import(manifestPath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const qa = await import(qaPath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const launch = await import(launchPath).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
assert.equal(typeof manifest.readFn15QaManifest, 'function', 'manifest reader가 있어야 한다');
assert.equal(typeof qa.createFn15QaPlan, 'function', 'plan export가 있어야 한다');
assert.equal(typeof qa.evaluateFn15QaReadiness, 'function', 'guard export가 있어야 한다');
assert.equal(typeof qa.eligibleFn15QaCleanup, 'function', 'cleanup guard export가 있어야 한다');
assert.equal(typeof launch.launchFn15Qa, 'function', 'launch export가 있어야 한다');
assert.equal(typeof launch.runFn15QaFake, 'function', 'fake 실행 export가 있어야 한다');

const plan = qa.createFn15QaPlan(manifest.readFn15QaManifest(), {
  sourceSha: 'f'.repeat(40), instanceId: 'fn15-01',
  expiresAt: '2026-10-26T12:30:00.000Z',
  imageId: 'sha256:' + 'a'.repeat(64), containerId: 'c'.repeat(64), networkId: 'b'.repeat(64),
});

test('고정 계획과 미관측 실행 거절은 CLI/ENV 자기 승인값으로 바뀌지 않는다', async () => {
  assert.equal(plan.resources.wslRoot, '/home/daon/deploy/anvil-v3-fn15-source-qa-01');
  assert.equal(plan.resources.container, 'anvil-v3-fn15-source-qa-pg-01');
  assert.equal(plan.resources.network, 'anvil-v3-fn15-source-qa-net-01');
  assert.equal(plan.resources.tmpfsMiB, 512);
  assert.equal(plan.resources.hostPortPublished, false);
  assert.equal(plan.resources.imagePull, false);
  assert.deepEqual(plan.timeBudgetMinutes, { total: 30, verify: 25, cleanup: 5 });
  const ready = qa.evaluateFn15QaReadiness(plan, {
    approval: true, sourceSha: plan.sourceSha, imageId: 'sha256:' + 'a'.repeat(64),
  });
  assert.equal(ready.executionAuthorized, false);
  assert.equal(ready.state, 'UNVERIFIED');
  assert.ok(ready.refusals.length > 0);
  const result = await launch.launchFn15Qa(plan, { argv: ['--execute'], env: { FN15_QA_APPROVED: 'true' } });
  assert.equal(result.effectPort, 'NOT_CONNECTED');
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.actualPgVerified, false);
  assert.equal(result.status, 'PLAN_ONLY');
});

test('정리 제안은 소유 literal·full ID·image·label·mount·network 일치 대상에만 한정한다', () => {
  const observed = {
    path: { realpath: plan.resources.wslRoot, owner: 'daon', link: false, mount: false, exists: true,
      onlyOwnedEntries: true, depsOriginalUntouched: true, activeProcessIds: [], instanceId: 'fn15-01' },
    container: { name: plan.resources.container, fullId: 'c'.repeat(64), imageId: 'sha256:' + 'a'.repeat(64),
      ownerLabel: 'AV3_FN15_SOURCE_QA', instanceId: 'fn15-01', sourceSha: plan.sourceSha,
      expiresAt: plan.expiresAt,
      mounts: ['tmpfs:/var/lib/postgresql/data:512MiB'], networks: [plan.resources.network], hostPorts: [], volumes: [] },
    network: { name: plan.resources.network, fullId: 'b'.repeat(64), ownerLabel: 'AV3_FN15_SOURCE_QA',
      instanceId: 'fn15-01', sourceSha: plan.sourceSha, expiresAt: plan.expiresAt,
      containers: [ 'c'.repeat(64) ], internal: true },
  };
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, observed).map((item: { kind: string }) => item.kind),
    ['container']);
  const networkOnly = { network: { ...observed.network, containers: [] }, containerAbsent: true };
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, networkOnly).map((item: { kind: string }) => item.kind),
    ['network']);
  const pathOnly = { path: { ...observed.path, ownerLabel: 'AV3_FN15_SOURCE_QA', sourceSha: plan.sourceSha },
    containerAbsent: true, networkAbsent: true };
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, pathOnly).map((item: { kind: string }) => item.kind),
    ['path']);
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, { ...networkOnly, containerAbsent: false }), []);
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, { ...pathOnly, networkAbsent: false }), []);
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, { ...pathOnly,
    path: { ...pathOnly.path, sourceSha: '0'.repeat(40) } }), []);
  assert.deepEqual(qa.eligibleFn15QaCleanup(plan, { ...observed,
    container: { ...observed.container, fullId: undefined },
    network: { ...observed.network, containers: ['other'] },
    path: { ...observed.path, link: true },
  }), []);
});

test('명시 메모리 fake는 단계/실패/정리 이력을 남겨도 실제 PG 성공을 주장하지 않는다', async () => {
  const calls: string[] = [];
  const result = await launch.runFn15QaFake(plan, {
    async inspect() { calls.push('inspect'); return { ok: true }; },
    async prepare() { calls.push('prepare'); return { ok: true }; },
    async verify() { calls.push('verify'); return { ok: false, code: 'SYNTHETIC_VERIFY_FAILED' }; },
    async cleanup() { calls.push('cleanup'); return { ok: false, code: 'SYNTHETIC_CLEANUP_FAILED' }; },
  });
  assert.deepEqual(calls, ['inspect', 'prepare', 'verify', 'cleanup']);
  assert.equal(result.status, 'SYNTHETIC_ONLY');
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.actualPgVerified, false);
  assert.equal(result.cleanup.status, 'FAILED');
  assert.ok(result.history.some((entry: { phase: string; code: string }) =>
    entry.phase === 'verify' && entry.code === 'SYNTHETIC_VERIFY_FAILED'));
  assert.ok(result.history.some((entry: { phase: string; code: string }) =>
    entry.phase === 'cleanup' && entry.code === 'SYNTHETIC_CLEANUP_FAILED'));
});

test('fake 오류 코드와 예외의 비밀처럼 보이는 원문은 이력에 남지 않는다', async () => {
  const secret = 'QA_PASSWORD_SECRET123';
  const result = await launch.runFn15QaFake(plan, {
    async inspect() { return { ok: true }; },
    async prepare() { return { ok: true }; },
    async verify() { return { ok: false, code: secret }; },
    async cleanup() { throw new Error(secret); },
  });
  assert.equal(result.history.find((entry: { phase: string }) => entry.phase === 'verify')?.code,
    'SYNTHETIC_PHASE_FAILED');
  assert.equal(result.history.find((entry: { phase: string }) => entry.phase === 'cleanup')?.code,
    'SYNTHETIC_PHASE_THROW');
  assert.equal(JSON.stringify(result).includes(secret), false);
});

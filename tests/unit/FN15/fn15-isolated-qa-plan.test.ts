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


test('plan은 전달 후 변조된 원본 지문·SQL·ledger·helper를 전부 거절한다', () => {
  const mutations: readonly ((value: import('../../../scripts/fn15-isolated-qa-manifest.ts').Fn15QaManifest) => void)[] = [
    (value) => { Reflect.set(value.sourceFiles[0]!, 'sha256', '0'.repeat(64)); },
    (value) => { Reflect.set(value.sourceFiles[1]!, 'byteLength', 1); },
    (value) => { Reflect.set(value.sourceFiles[2]!, 'name', '0025_result_submissions.sql'); },
    (value) => { Reflect.set(value.fullSql[0]!, 'sql', value.fullSql[0]!.sql + '\n'); },
    (value) => { Reflect.set(value.fullSql[1]!, 'sha256', '0'.repeat(64)); },
    (value) => { Reflect.set(value.fullSql[2]!, 'id', '0017_execution_authority'); },
    (value) => { Reflect.set(value.ledger[0]!, 'checksum', '0'.repeat(64)); },
    (value) => { Reflect.set(value.ledger[1]!, 'id', '0017_execution_authority'); },
    (value) => { Reflect.set(value.helpers, 'sql', value.helpers.sql + '\n'); },
    (value) => { Reflect.set(value.helpers, 'sha256', '0'.repeat(64)); },
    (value) => { Reflect.set(value.helpers.blocks[0]!, 'byteLength', 1); },
    (value) => { Reflect.set(value.helpers.blocks[1]!, 'name', 'execution_json_hash'); },
    (value) => { Reflect.set(value.helpers, 'status', 'FULL_0017_APPLIED'); },
    (value) => { Reflect.set(value.fullSql, '0', value.fullSql[1]); },
    (value) => { Reflect.set(value.helpers.blocks, '0', value.helpers.blocks[1]); },
    (value) => { Reflect.set(value, 'unknown', true); },
    (value) => { Reflect.set(value.helpers.blocks[0]!, 'unknown', true); },
    (value) => { Reflect.set(value.ledger, 'unknown', true); },
    (value) => { Reflect.set(value, 'cycle', value); },
    (value) => { Reflect.set(value.helpers, 'blocks', { length: 7 }); },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(manifest.readFn15QaManifest());
    mutate(input);
    assert.throws(() => qa.createFn15QaPlan(input), /FN15_QA_MANIFEST_NOT_VERIFIED/);
  }
  let getterCalls = 0;
  const accessor = structuredClone(manifest.readFn15QaManifest());
  Object.defineProperty(accessor.helpers, 'sql', { get() { getterCalls++; return ''; } });
  assert.throws(() => qa.createFn15QaPlan(accessor), /FN15_QA_MANIFEST_NOT_VERIFIED/);
  assert.equal(getterCalls, 0);
  const inherited = structuredClone(manifest.readFn15QaManifest());
  Object.setPrototypeOf(inherited.ledger[0], { hostile: true });
  assert.throws(() => qa.createFn15QaPlan(inherited), /FN15_QA_MANIFEST_NOT_VERIFIED/);
});

test('plan은 입력을 동결하지 않고 분리된 깊은 불변 manifest snapshot을 보관한다', () => {
  const input = structuredClone(manifest.readFn15QaManifest());
  const snapshotPlan = qa.createFn15QaPlan(input);
  const before = JSON.stringify(snapshotPlan);
  assert.notEqual(snapshotPlan.manifest, input);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(snapshotPlan), true);
  for (const item of [snapshotPlan.manifest, snapshotPlan.manifest.sourceFiles,
    ...snapshotPlan.manifest.sourceFiles, snapshotPlan.manifest.fullSql, ...snapshotPlan.manifest.fullSql,
    snapshotPlan.manifest.ledger, ...snapshotPlan.manifest.ledger, snapshotPlan.manifest.helpers,
    snapshotPlan.manifest.helpers.blocks, ...snapshotPlan.manifest.helpers.blocks]) assert.equal(Object.isFrozen(item), true);
  Reflect.set(input.fullSql[0], 'sql', 'changed');
  Reflect.set(input.ledger[0], 'id', 'changed');
  Reflect.set(input.helpers, 'sql', 'changed');
  Reflect.set(input.sourceFiles[0], 'sha256', 'changed');
  assert.equal(JSON.stringify(snapshotPlan), before);
  assert.equal(Reflect.set(snapshotPlan.manifest.helpers, 'sql', 'changed'), false);
});

test('compatibility 역할과 schema bootstrap은 새 빈 격리 PG 후보이며 실제 역할 검증을 뜻하지 않는다', () => {
  assert.deepEqual(plan.rolePlan.compatibility, {
    name: 'anvil_v3_app', login: false, superuser: false, createDb: false, createRole: false,
    inherit: false, bypassRls: false, memberships: [], setRoleGrants: [], verification: 'UNVERIFIED',
  });
  assert.deepEqual(plan.rolePlan.bootstrapSchemas, ['anvil', 'anvil_qa']);
  assert.equal(plan.rolePlan.bootstrapBeforeSql, true);
  assert.equal(plan.rolePlan.owner, 'NOLOGIN');
  assert.equal(plan.rolePlan.runtime, 'LOGIN');
  assert.equal(plan.rolePlan.publicGrant, false);
  const ready = qa.evaluateFn15QaReadiness(plan);
  assert.equal(ready.state, 'UNVERIFIED');
  assert.equal(ready.executionAuthorized, false);
  assert.equal(ready.actualPgVerified, false);
  assert.ok(ready.refusals.includes('SOURCE_ROLE_ANVIL_V3_APP_ACTUAL_ROLE_AND_GRANTS_UNVERIFIED'));
  assert.ok(ready.refusals.includes('EXTERNAL_EFFECT_PORT_NOT_CONNECTED'));
  assert.ok(ready.refusals.includes('SEPARATE_EXECUTION_DECISION_NOT_PRESENT'));
});

test('bounded PG handler는 기본 미연결과 TEST_FAKE에서 SQL 없이 거절한다', async () => {
  assert.equal(typeof launch.runFn15QaPreparedDatabase, 'function');
  const absent = await launch.runFn15QaPreparedDatabase(plan);
  assert.equal(absent.status, 'NOT_CONNECTED');
  assert.equal(absent.actualPgVerified, false);
  assert.equal(absent.executionAuthorized, false);
  let calls = 0;
  const fake = await launch.runFn15QaPreparedDatabase(plan, {
    sourceMode: 'TEST_FAKE',
    admin: { query() { calls++; throw Error('QA_SECRET_MUST_NOT_ESCAPE'); } },
  });
  assert.equal(calls, 0);
  assert.equal(fake.status, 'REFUSED');
  assert.equal(fake.actualPgVerified, false);
  assert.equal(fake.sourceMode, 'TEST_FAKE');
  assert.equal(JSON.stringify(fake).includes('QA_SECRET_MUST_NOT_ESCAPE'), false);
});

test('bounded PG handler는 전달된 manifest를 SQL 전에 재검증한다', async () => {
  assert.equal(typeof launch.runFn15QaPreparedDatabase, 'function');
  const forged = { ...plan, manifest: structuredClone(plan.manifest) };
  Reflect.set(forged.manifest.fullSql[0]!, 'sql', 'SELECT 1');
  let calls = 0;
  const result = await launch.runFn15QaPreparedDatabase(forged, {
    sourceMode: 'POSTGRES_SOURCE',
    admin: { query() { calls++; throw Error('QA_SECRET_MUST_NOT_ESCAPE'); } },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, 'REFUSED');
  assert.equal(result.code, 'FN15_QA_MANIFEST_NOT_VERIFIED');
  assert.equal(result.actualPgVerified, false);
});

test('신규 PG metadata 순수 guard는 정확 namespace·extension·public 객체 부재를 대조한다', () => {
  assert.equal(typeof launch.checkFn15QaFreshDatabase, 'function');
  const baseline = { db: 'anvil_v3_fn15_source_qa_01', role: 'postgres', session_role: 'postgres',
    version: 150000, superuser: true,
    namespace_names: ['public','pg_catalog','information_schema','pg_toast'],
    extension_names: ['plpgsql'], public_class_count: 0, public_function_count: 0,
    public_type_count: 0, fixed_roles_count: 0 };
  assert.equal(launch.checkFn15QaFreshDatabase(baseline, 'postgres'), true);
  const cases: readonly object[] = [
    { db: 'existing_formal_database' }, { role: 'unexpected_role' }, { session_role: 'another_role' },
    { version: 180000 }, { superuser: false }, { fixed_roles_count: 1 },
    { namespace_names: [...baseline.namespace_names, 'pg_like_unrelated_schema'] },
    { namespace_names: [...baseline.namespace_names, 'anvil'] },
    { namespace_names: ['public','pg_catalog','information_schema'] },
    { namespace_names: ['public','pg_catalog','information_schema','public'] },
    { public_class_count: 1 }, { public_function_count: 1 }, { public_type_count: 1 },
    { public_function_count: '0' }, { extension_names: ['plpgsql','pgcrypto'] },
    { extension_names: [] }, { extension_names: ['plpgsql','plpgsql'] },
  ];
  for (const delta of cases) assert.equal(launch.checkFn15QaFreshDatabase({ ...baseline, ...delta }, 'postgres'), false);
  for (const value of [null, undefined, [], 'metadata', {}])
    assert.equal(launch.checkFn15QaFreshDatabase(value, 'postgres'), false);
  assert.equal(launch.checkFn15QaFreshDatabase(baseline, 'anvil_fn15_qa_owner'), false);
});

test('runtime 준비 binding은 실행별 nonce·instance·source가 정확히 같아야 한다', () => {
  assert.equal(typeof launch.checkFn15QaDatabaseBinding, 'function');
  const expected = { nonce: 'a'.repeat(64), instanceId: 'fn15-binding-01', sourceSha: 'f'.repeat(40) };
  const payload = { schemaVersion: 1, ...expected };
  assert.equal(launch.checkFn15QaDatabaseBinding(payload, expected), true);
  for (const delta of [{ nonce: 'b'.repeat(64) }, { instanceId: 'fn15-another-run' },
    { sourceSha: 'e'.repeat(40) }, { schemaVersion: 2 }, { nonce: '' }, { nonce: undefined },
    { instanceId: undefined }, { sourceSha: undefined }])
    assert.equal(launch.checkFn15QaDatabaseBinding({ ...payload, ...delta }, expected), false);
  for (const value of [null, undefined, [], {}, 'binding'])
    assert.equal(launch.checkFn15QaDatabaseBinding(value, expected), false);
  assert.equal(launch.checkFn15QaDatabaseBinding({ ...payload, extra: true }, expected), false);
});

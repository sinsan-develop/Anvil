import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

// TEST_ONLY: 이 파일은 메모리 입력/포트만 사용한다. compiler/QA/소비파일 생성은 없다.
// 실제 사용자 결정 인증은 이 순수 binding 검사나 주입 포트가 대신하지 않는다.
const input = await import(new URL('../../../scripts/fn06-ownership-compile-only-input.ts', import.meta.url).href)
  .catch(error => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const runner = await import(new URL('../../../scripts/run-fn06-ownership-compile-only.ts', import.meta.url).href)
  .catch(error => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const manifestRaw = readFileSync(new URL('../../../docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027.json', import.meta.url));
const manifest = JSON.parse(manifestRaw.toString('utf8'));
const manifestHash = 'D6DE65F1226575736CCF65AC951C44FE632012D1EBA9D25D2CF276ACDFF08A57';
const checkpoint = '64bb7ab2db534e66d66bf150529df3017e4bd70e';
const qaRoot = 'D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01';
const decisionPath = 'docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_01.json';
const candidateId = 'FN06_OWNERSHIP_COMPILE_ONLY_20261027_01';
const sha = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex').toUpperCase();

function observations() {
  return {
    git: {branch: 'codex/av3-stage-b', sourceCheckpoint: checkpoint, actualHead: '1'.repeat(40), sourceUnchanged: true, privateRemoteVerified: true},
    sources: manifest.sources.map((file: any) => ({...file, regularFile: true, nonLink: true, ownerVerified: true})),
    tools: manifest.tools.map((file: any) => ({...file, regularFile: true, nonLink: true, ownerVerified: true, signatureVerified: true})),
    parent: {path: 'D:/Project/Anvil/.av3-data', resolvedPath: 'D:/Project/Anvil/.av3-data', nonLink: true, owner: 'SINSAN/cyhuh', aclPrincipals: ['SINSAN/cyhuh', 'SYSTEM'], aclVerified: true},
    qaRootExists: false,
    consumedMarkerExists: false,
  };
}

function build(raw: Uint8Array = manifestRaw, facts: any = observations()) {
  assert.equal(typeof input.buildOwnershipCompileOnlyPlan, 'function', '신규 순수 계획 builder가 필요하다');
  return input.buildOwnershipCompileOnlyPlan(raw, facts);
}

function binding() {
  return {
    candidateId, manifestHash, sourceCheckpoint: checkpoint, executionCommit: '1'.repeat(40),
    inputHash: 'A'.repeat(64), runnerHash: 'B'.repeat(64),
    qaRoot, output: 'bin/OwnershipEvidenceSource.dll',
    limits: {qaLifetimeMs: 1800000, compilerTimeoutMs: 15000, diagnosticBytes: 16384, compilerAttempts: 1},
    decisionPath,
    // 주입된 시간은 유효성 대조 자료일 뿐 허가나 시간창을 생성하지 않는다.
    observedAt: '2026-10-27T04:00:01.000Z', consumedMarkerExists: false,
  };
}

function syntheticDecision() {
  const b = binding();
  return {
    schemaVersion: 1, status: 'APPROVED_COMPILE_ONLY', approvalKind: 'DIRECT_USER_EXACT_EXECUTION',
    candidateId, manifestHash, sourceCheckpoint: checkpoint, executionCommit: b.executionCommit, inputHash: b.inputHash, runnerHash: b.runnerHash,
    qaRoot, output: b.output, limits: {...b.limits},
    approvedAt: '2026-10-27T04:00:00.000Z', expiresAt: '2026-10-27T04:30:00.000Z',
    runId: candidateId, maximumRuns: 1,
  };
}

function checkDecision(value: unknown, expected: any = binding()) {
  assert.equal(typeof input.validateOwnershipCompileOnlyDecision, 'function', '엄격한 결정 결박 검사가 필요하다');
  return input.validateOwnershipCompileOnlyDecision(value, expected);
}

function refusal(value: unknown, expected?: any) {
  assert.throws(() => checkDecision(value, expected), /OWNERSHIP_COMPILE_ONLY_/);
}

function fakePorts(decision: unknown = null) {
  const calls = {factory: 0, mutation: 0, metadata: 0, decision: 0, output: [] as unknown[]};
  const forbidden = () => { calls.mutation++; throw new Error('시험 중 쓰기 금지'); };
  const ports = {
    async readPreparation() { calls.metadata++; return {manifestRaw, observations: observations(), binding: binding()}; },
    async readDecision(path: string) { calls.decision++; assert.equal(path, decisionPath); return decision; },
    async createConsumedMarker() { return forbidden(); },
    async createQaRoot() { return forbidden(); },
    async copySource() { return forbidden(); },
    async writeDiagnostic() { return forbidden(); },
    async cleanup() { return forbidden(); },
    createCompilerProcess() { calls.factory++; throw new Error('시험 중 compiler 금지'); },
    report(value: unknown) { calls.output.push(value); },
  };
  return {ports, calls};
}

async function invoke(args: string[], f = fakePorts()) {
  assert.equal(typeof runner.runOwnershipCompileOnly, 'function', '신규 runner의 명시적 진입 함수가 필요하다');
  return {result: await runner.runOwnershipCompileOnly(args, f.ports), calls: f.calls};
}

test('고정 raw manifest/source12/tool4와 정확 library argv만 계획한다', () => {
  assert.equal(sha(manifestRaw), manifestHash);
  const plan = build();
  assert.equal(plan.candidateId, candidateId);
  assert.equal(plan.manifestHash, manifestHash);
  assert.equal(plan.sourceCheckpoint, checkpoint);
  assert.equal(plan.actualHead, '1'.repeat(40));
  assert.equal(plan.qaRoot, qaRoot);
  assert.equal(plan.executable, manifest.tools[0].path);
  assert.deepEqual(plan.argv, [
    ...manifest.compilerOptions,
    `/out:${qaRoot}/bin/OwnershipEvidenceSource.dll`,
    ...manifest.tools.slice(1).map((file: any) => `/reference:${file.path}`),
    ...manifest.sources.map((file: any) => `${qaRoot}/src/${file.path.split('/').at(-1)}`),
  ]);
  assert.deepEqual(plan.limits, manifest.proposedLimits);
  assert.equal(plan.useShellExecute, false);
  assert.equal(plan.createNoWindow, true);
  assert.equal(plan.actualCompilerExecuted, false);
  assert.equal(plan.executionAuthorized, false);
  assert.equal(plan.externalUserApprovalVerified, false);
  assert.deepEqual(plan.excluded, manifest.excluded);
});

test('manifest의 공백 포함 raw 변경·다른 root/출력/옵션·source 추가는 거절한다', () => {
  assert.throws(() => build(Buffer.concat([manifestRaw, Buffer.from(' ')])), /OWNERSHIP_COMPILE_ONLY_/);
  for (const change of [
    (m: any) => { m.proposedQaRoot += '-other'; },
    (m: any) => { m.proposedOutput = 'worker.exe'; },
    (m: any) => { m.compilerOptions.push('/warnaserror-'); },
    (m: any) => { m.compilerOptions.push('@other.rsp'); },
    (m: any) => { m.sources.push({...m.sources[0], path: '*.cs'}); },
    (m: any) => { m.proposedLimits.compilerAttempts = 2; },
  ]) { const m = structuredClone(manifest); change(m); assert.throws(() => build(Buffer.from(JSON.stringify(m))), /OWNERSHIP_COMPILE_ONLY_/); }
});

test('source/tool 지문·순서·서명과 부모/현재 Git의 불명 metadata는 실패로 닫힌다', () => {
  for (const change of [
    (f: any) => { f.sources[0].sha256 = '0'.repeat(64); },
    (f: any) => { f.sources[0].bytes++; },
    (f: any) => { f.sources.reverse(); },
    (f: any) => { f.sources[0].nonLink = null; },
    (f: any) => { f.sources[0].ownerVerified = false; },
    (f: any) => { f.tools[0].path = 'other/csc.exe'; },
    (f: any) => { f.tools[1].signatureVerified = null; },
    (f: any) => { f.tools.pop(); },
    (f: any) => { f.parent.aclPrincipals.push('Everyone'); },
    (f: any) => { f.parent.owner = 'other'; },
    (f: any) => { f.parent.resolvedPath += '/elsewhere'; },
    (f: any) => { f.parent.nonLink = null; },
    (f: any) => { f.git.sourceUnchanged = false; },
    (f: any) => { f.git.privateRemoteVerified = null; },
    (f: any) => { f.git.sourceCheckpoint = '0'.repeat(40); },
    (f: any) => { f.qaRootExists = true; },
    (f: any) => { f.consumedMarkerExists = true; },
  ]) { const f = observations(); change(f); assert.throws(() => build(manifestRaw, f), /OWNERSHIP_COMPILE_ONLY_/); }
});

test('순수 결정 binding 성공도 외부 사용자 승인 인증/실행 권한을 만들지 않는다', () => {
  const result = checkDecision(syntheticDecision());
  assert.equal(result.bindingMatches, true);
  assert.equal(result.externalUserApprovalVerified, false);
  assert.equal(result.executionAuthorized, false);
});

test('metadata/결정의 accessor와 proxy는 실행하지 않고 거절한다', () => {
  let called = 0;
  const facts = observations();
  Object.defineProperty(facts.parent, 'owner', {enumerable: true, get() { called++; return 'SINSAN/cyhuh'; }});
  assert.throws(() => build(manifestRaw, facts), /OWNERSHIP_COMPILE_ONLY_/);
  const d = syntheticDecision();
  Object.defineProperty(d, 'status', {enumerable: true, get() { called++; return 'APPROVED_COMPILE_ONLY'; }});
  refusal(d);
  refusal(new Proxy(syntheticDecision(), {ownKeys() { called++; return []; }}));
  assert.equal(called, 0);
});

test('늦은 read/stop 불명은 완료 전 zero·원 Process Dispose를 허용하지 않는다', () => {
  assert.equal(typeof input.ownershipCompileOnlyFinalization, 'function');
  const late = input.ownershipCompileOnlyFinalization(false, true, true);
  assert.equal(late.canClearBuffers, false);
  assert.equal(late.canDisposeProcess, false);
  assert.equal(late.handoffRequired, true);
  const unknownStop = input.ownershipCompileOnlyFinalization(true, true, false);
  assert.equal(unknownStop.processExited, false);
  assert.equal(unknownStop.canDisposeProcess, false);
  assert.equal(unknownStop.handoffRequired, true);
  const complete = input.ownershipCompileOnlyFinalization(true, true, true);
  assert.equal(complete.canClearBuffers, true);
  assert.equal(complete.canDisposeProcess, true);
  assert.equal(complete.handoffRequired, false);
  for (const [key, policy] of Object.entries(input.ownershipCompileOnlyFinalizationPolicies)) {
    assert.deepEqual(policy, input.ownershipCompileOnlyFinalization(key[0] === '1', key[1] === '1', key[2] === '1'));
  }
});

test('결정 부재/옛 D2/boolean·임의추가/변조 hash/root/한도/소진/만료는 거절한다', () => {
  for (const value of [null, undefined, true, {approved: true}, {candidateId: 'D2', status: 'APPROVED'}]) refusal(value);
  for (const change of [
    (d: any) => { d.status = 'PREPARATION_ONLY_NOT_EXECUTION_APPROVAL'; },
    (d: any) => { d.approvalKind = 'PMO_LIMITED_FN16_PG_SUPPORT'; },
    (d: any) => { d.candidateId = 'D2'; },
    (d: any) => { d.sourceCheckpoint = '0'.repeat(40); },
    (d: any) => { d.executionCommit = '2'.repeat(40); },
    (d: any) => { d.runnerHash = 'C'.repeat(64); },
    (d: any) => { d.inputHash = 'C'.repeat(64); },
    (d: any) => { d.manifestHash = 'C'.repeat(64); },
    (d: any) => { d.qaRoot += '/other'; },
    (d: any) => { d.output = 'other.dll'; },
    (d: any) => { d.maximumRuns = 2; },
    (d: any) => { d.runId = 'other'; },
    (d: any) => { d.limits.compilerTimeoutMs++; },
    (d: any) => { d.limits.diagnosticBytes++; },
    (d: any) => { d.expiresAt = '2026-10-27T04:30:00.001Z'; },
    (d: any) => { d.approved = true; },
  ]) { const d = syntheticDecision(); change(d); refusal(d); }
  for (const change of [
    (b: any) => { b.observedAt = '2026-10-27T04:30:00.000Z'; },
    (b: any) => { b.observedAt = '2026-10-27T03:59:59.999Z'; },
    (b: any) => { b.observedAt = 'invalid'; },
    (b: any) => { b.consumedMarkerExists = true; },
    (b: any) => { b.decisionPath = 'old-D2.json'; },
  ]) { const b = binding(); change(b); refusal(syntheticDecision(), b); }
});

test('기본/명시 plan은 metadata만 읽고 결정 소비·FS변경·compiler factory는 0이다', async () => {
  for (const args of [[], ['--plan']]) {
    const {result, calls} = await invoke(args);
    assert.equal(result.status, 'PLAN_ONLY');
    assert.equal(calls.metadata, 1);
    assert.equal(calls.decision, 0);
    assert.equal(calls.mutation, 0);
    assert.equal(calls.factory, 0);
  }
});

test('미결박 apply와 허가 boolean/임의 옵션은 실행/FS변경 전에 거절한다', async () => {
  for (const args of [['--apply'], ['--apply', '--approved'], ['--plan', '--apply'], ['--plan', '--root', qaRoot], ['--plan', '--timeout', '30000'], ['--plan', '--source', '*.cs']]) {
    const f = fakePorts();
    await assert.rejects(invoke(args, f), /OWNERSHIP_COMPILE_ONLY_/);
    assert.equal(f.calls.mutation, 0);
    assert.equal(f.calls.factory, 0);
  }
  const f = fakePorts({...syntheticDecision(), runnerHash: 'C'.repeat(64)});
  await assert.rejects(invoke(['--apply'], f), /OWNERSHIP_COMPILE_ONLY_/);
  assert.equal(f.calls.mutation, 0);
  assert.equal(f.calls.factory, 0);
});

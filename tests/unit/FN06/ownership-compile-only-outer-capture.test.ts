import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';

// TEST_ONLY: import는 CLI를 실행하지 않는다. 이 파일은 fake event/Buffer/timer만 사용한다.
const runner = await import(new URL('../../../scripts/run-fn06-ownership-compile-only.ts', import.meta.url).href);
const observedAt = '2026-10-27T07:00:00.000Z';
const prefix = 'OWNERSHIP_COMPILE_ONLY_';
const secret = 'SYNTHETIC_PRIVATE_CONTENT_DO_NOT_RETURN';

class FakePipe extends EventEmitter {
  destroyed = 0;
  destroy() { this.destroyed++; }
}
class FakeChild extends EventEmitter {
  pid: unknown = 9001;
  stdout = new FakePipe();
  stderr = new FakePipe();
  stdin = new FakePipe();
  unrefCalls = 0;
  killCalls = 0;
  unref() { this.unrefCalls++; }
  kill() { this.killCalls++; throw Error('실제 중단 권한 없음'); }
}

function harness() {
  assert.equal(typeof runner.collectOwnershipCompileOnlyResult, 'function', 'spawn과 분리된 명시인자 outer collector가 필요하다');
  const child = new FakeChild();
  let callback: (() => void) | null = null;
  let clears = 0;
  const clock = {
    now: () => observedAt,
    setTimeout(fn: () => void, ms: number) { assert.equal(ms, 60000); callback = fn; return 1; },
    clearTimeout(handle: number) { assert.equal(handle, 1); clears++; },
  };
  const promise = runner.collectOwnershipCompileOnlyResult(child, clock);
  let settlements = 0;
  void promise.then(() => { settlements++; });
  return {
    child, promise,
    stdout(raw: string | Buffer) { child.stdout.emit('data', Buffer.isBuffer(raw) ? raw : Buffer.from(raw)); },
    stderr(raw: string | Buffer) { child.stderr.emit('data', Buffer.isBuffer(raw) ? raw : Buffer.from(raw)); },
    close(code: number | null = 0, signal: string | null = null) { child.emit('close', code, signal); },
    timeout() { assert(callback, '주입 timer가 설치돼야 한다'); callback(); },
    get clears() { return clears; },
    get settlements() { return settlements; },
  };
}

function pass() {
  return {status: 'PASS_COMPILE_ONLY', failure: null, handoffRequired: false, processStarted: true, oneUseConsumed: true, actualCompilerExecuted: true, exitCode: 0};
}
function fail() {
  return {...pass(), status: 'FAIL_COMPILE_ONLY', failure: prefix + 'COMPILER_FAILED', exitCode: 1};
}
function handoff() {
  return {...fail(), status: 'HANDOFF_REQUIRED', handoffRequired: true,
    hostIdentity: {pid: 9002, startTicks: '639286750589768922', exe: 'C:/Program Files/PowerShell/7/pwsh.exe'}};
}
function safe(result: any) {
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
  assert(result.outerEvidence);
  const allowed = new Set(['stdoutBytes', 'stderrBytes', 'combinedBytes', 'overflow', 'closeCode', 'closeSignal', 'parseStage', 'parsedStatus', 'spawnError', 'stdinError', 'childPid', 'observedAt']);
  for (const key of Object.keys(result.outerEvidence)) assert(allowed.has(key), '유한 outerEvidence 외 필드 금지: ' + key);
  assert.equal(result.outerEvidence.observedAt, observedAt);
  assert(result.outerEvidence.combinedBytes >= 0 && result.outerEvidence.combinedBytes <= 16384);
  assert.equal(result.outerEvidence.combinedBytes, result.outerEvidence.stdoutBytes + result.outerEvidence.stderrBytes);
  assert.equal(result.externalUserApprovalVerified, false);
}

test('outer stdout 정상JSON+stderr는 채널을 구분하고 parsedStatus를 보존하되 PASS하지 않는다', async () => {
  const h = harness();
  const raw = JSON.stringify({...pass(), arbitraryInner: secret}) + '\n';
  h.stdout(raw); h.stderr(secret); h.close();
  const result = await h.promise;
  safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(result.failure, prefix + 'OUTER_STDERR_PRESENT');
  assert.equal(result.outerEvidence.parsedStatus, 'PASS_COMPILE_ONLY');
  assert.equal(result.outerEvidence.parseStage, 'VALID_JSON');
  assert.equal(result.outerEvidence.stdoutBytes, Buffer.byteLength(raw));
  assert.equal(result.outerEvidence.stderrBytes, Buffer.byteLength(secret));
  assert.equal(result.outerEvidence.closeCode, 0);
  assert.equal(result.outerEvidence.childPid, 9001);
  assert.equal(result.oneUseConsumed, true);
  assert.equal(result.actualCompilerExecuted, true);
  assert.equal(h.child.killCalls, 0);
  const whitespace = harness(); whitespace.stdout(JSON.stringify(pass())); whitespace.stderr(' \r\n'); whitespace.close();
  const whitespaceResult = await whitespace.promise; safe(whitespaceResult);
  assert.equal(whitespaceResult.status, 'FAIL_COMPILE_ONLY', '공백만 있는 stderr도 무시하지 않는다');
  assert.equal(whitespaceResult.failure, prefix + 'OUTER_STDERR_PRESENT');
  assert.equal(whitespaceResult.outerEvidence.stderrBytes, 3);
});

test('outer 분할된 단일 FAIL JSON+exit1은 정상 실패로 반환하고 임의inner객체는 내보내지 않는다', async () => {
  const h = harness();
  const raw = Buffer.from(JSON.stringify({...fail(), unknownPrivate: {text: secret}}));
  h.stdout(raw.subarray(0, 17)); h.stdout(raw.subarray(17)); h.close(1);
  const result = await h.promise;
  safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(result.failure, prefix + 'COMPILER_FAILED');
  assert.equal(result.exitCode, 1);
  assert.equal(result.outerEvidence.parsedStatus, 'FAIL_COMPILE_ONLY');
  assert.equal(result.outerEvidence.parseStage, 'VALID_JSON');
  assert.equal(result.outerEvidence.stderrBytes, 0);
  assert.equal(result.outerEvidence.closeCode, 1);
  assert.equal(h.clears, 1);
});

test('outer 빈stdout+stderr는 EMPTY_STDOUT와 채널 길이를 남기고 원문을 소거한다', async () => {
  const h = harness(); h.stderr(secret); h.close(1);
  const result = await h.promise; safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(result.outerEvidence.parseStage, 'EMPTY_STDOUT');
  assert.equal(result.outerEvidence.parsedStatus, null);
  assert.equal(result.outerEvidence.stdoutBytes, 0);
  assert.equal(result.outerEvidence.stderrBytes, Buffer.byteLength(secret));
});

test('outer PASS는 exit0에서만 채택하고 exit1·signal·종료불명은 FAIL이다', async () => {
  for (const [code, signal] of [[0, null], [1, null], [null, 'SIGTERM'], [null, null]] as const) {
    const h = harness(); h.stdout(JSON.stringify(pass())); h.close(code, signal);
    const result = await h.promise; safe(result);
    assert.equal(result.status, code === 0 && signal === null ? 'PASS_COMPILE_ONLY' : 'FAIL_COMPILE_ONLY');
    assert.equal(result.outerEvidence.parsedStatus, 'PASS_COMPILE_ONLY');
    assert.equal(result.outerEvidence.closeCode, code);
    assert.equal(result.outerEvidence.closeSignal, signal);
  }
});

test('outer 잡출력/빈본문/falsy/배열/문자열/알수없는status는 한JSON 정상결과로 채택하지 않는다', async () => {
  for (const raw of ['prefix\n' + JSON.stringify(pass()), JSON.stringify(pass()) + '\ntrailer', '', 'null', 'false', '0', '[]', '"PASS_COMPILE_ONLY"', '{"status":"UNKNOWN"}']) {
    const h = harness(); h.stdout(raw); h.close();
    const result = await h.promise; safe(result);
    assert.equal(result.status, 'FAIL_COMPILE_ONLY');
    assert.equal(result.outerEvidence.parsedStatus, null);
    assert(['EMPTY_STDOUT', 'INVALID_JSON', 'INVALID_SHAPE'].includes(result.outerEvidence.parseStage));
  }
});

test('outer 양채널 보존 합계16KiB를 넘으면 overflow FAIL이며 이후 내용은 보존하지 않는다', async () => {
  const h = harness(); h.stdout(Buffer.alloc(16380, 120)); h.stderr(Buffer.alloc(100000, 121)); h.stdout(secret); h.close(1);
  const result = await h.promise; safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(result.failure, prefix + 'OUTER_CAPTURE_UNKNOWN');
  assert.equal(result.outerEvidence.overflow, true);
  assert(result.outerEvidence.combinedBytes <= 16384);
  assert.equal(h.child.killCalls, 0);
});

test('outer spawn/stdin 오류는 유한종류만 보존하고 원오류message·임의code는 노출하지 않는다', async () => {
  for (const [surface, code, expected] of [['spawn', 'ENOENT', 'ENOENT'], ['stdin', 'EPIPE', 'EPIPE'], ['spawn', secret, 'OTHER']] as const) {
    const h = harness();
    const error = Object.assign(Error(secret), {code, privateValue: secret});
    if (surface === 'spawn') h.child.emit('error', error); else h.child.stdin.emit('error', error);
    h.close(1);
    const result = await h.promise; safe(result);
    assert.equal(result.status, 'FAIL_COMPILE_ONLY');
    assert.equal(result.outerEvidence[surface === 'spawn' ? 'spawnError' : 'stdinError'], expected);
    assert.equal(h.child.killCalls, 0);
  }
});

test('outer 주입60초 timeout은 강제kill 없이 UNKNOWN이며 늦은이벤트·중복종료는 재결과를 만들지 않는다', async () => {
  const h = harness(); h.stdout('{'); h.timeout();
  const result = await h.promise; safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(result.failure, prefix + 'OUTER_TIMEOUT_UNKNOWN');
  const before = JSON.stringify(result);
  h.stdout(JSON.stringify(pass())); h.stderr(secret); h.close(); h.child.emit('error', Error(secret)); h.timeout();
  await Promise.resolve();
  assert.equal(JSON.stringify(result), before);
  assert.equal(h.settlements, 1);
  assert.equal(h.child.killCalls, 0);
  assert(h.child.unrefCalls > 0);
});

test('outer HANDOFF 조기회신은 stdout정확구조·stderr없음일때만, NodePID와 원host관측은 별개다', async () => {
  const h = harness(); h.stdout(JSON.stringify(handoff()) + '\n');
  const result = await h.promise; safe(result);
  assert.equal(result.status, 'HANDOFF_REQUIRED');
  assert.equal(result.handoffRequired, true);
  assert.equal(result.outerEvidence.childPid, 9001);
  assert.equal(result.hostIdentity.pid, 9002);
  assert.equal(result.outerEvidence.closeCode, null);
  assert.equal(result.outerEvidence.parseStage, 'HANDOFF_STDERR_OPEN', '현재 stderr0은 미래 stderr 부재의 증거가 아니다');
  assert.equal(h.child.killCalls, 0);
  h.stdout(secret); h.stderr(secret); h.close(1); await Promise.resolve();
  assert.equal(h.settlements, 1);
  const denied = harness(); denied.stderr(secret); denied.stdout(JSON.stringify(handoff()) + '\n'); denied.close(1);
  const failure = await denied.promise; safe(failure);
  assert.equal(failure.status, 'FAIL_COMPILE_ONLY');
  assert.equal(failure.outerEvidence.parsedStatus, 'HANDOFF_REQUIRED');
  const eof = harness(); eof.child.stderr.emit('end'); eof.stdout(JSON.stringify(handoff()) + '\n');
  const ended = await eof.promise; safe(ended);
  assert.equal(ended.status, 'HANDOFF_REQUIRED');
  assert.equal(ended.outerEvidence.parseStage, 'HANDOFF_STDERR_EOF');
});

test('outer 부적합HANDOFF·pipe오류는 조기성공이 아니며 신원proof나 강제중단권한을 만들지 않는다', async () => {
  const h = harness(); h.child.pid = secret;
  h.stdout(JSON.stringify({...handoff(), hostIdentity: {pid: -1, startTicks: secret, exe: secret}}) + '\n');
  h.child.stdout.emit('error', Error(secret)); h.close(1);
  const result = await h.promise; safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(result.outerEvidence.childPid, null);
  assert.notEqual(result.handoffRequired, true);
  assert.equal(h.child.killCalls, 0);
  for (const change of [
    (value: any) => { value.handoffRequired = false; },
    (value: any) => { value.hostIdentity.exe = secret; },
    (value: any) => { value.hostIdentity.raw = secret; },
  ]) {
    const invalid = harness(), value = handoff(); change(value);
    invalid.stdout(JSON.stringify(value) + '\n'); invalid.close(1);
    const failed = await invalid.promise; safe(failed);
    assert.equal(failed.status, 'FAIL_COMPILE_ONLY');
    assert.equal(failed.outerEvidence.parseStage, 'INVALID_SHAPE');
    assert.equal(failed.outerEvidence.parsedStatus, null);
  }
});

test('outer 보존 필요 HANDOFF는 stderr/timeout/stream 실패에도 원true를 유지하고 미관측false를 합성하지 않는다', async () => {
  for (const boundary of ['stderr', 'timeout', 'stream'] as const) {
    const h = harness();
    // newline 없는 유효 stdout으로 조기 회신 전의 외부 오류만 재현한다.
    h.stdout(JSON.stringify({...handoff(), finalization: {handoffRequired: true, readsSettled: false, processExited: false}}));
    if (boundary === 'stderr') { h.stderr(secret); h.close(1); }
    else if (boundary === 'timeout') h.timeout();
    else h.child.stdout.emit('error', Error(secret));
    const result = await h.promise; safe(result);
    assert.equal(result.status, 'FAIL_COMPILE_ONLY');
    assert.equal(result.handoffRequired, true, boundary + ' 실패가 검사된 원 보존 필요를 부정하면 안 된다');
    assert.equal(result.finalization.handoffRequired, true);
    assert.equal(result.outerEvidence.parsedStatus, 'HANDOFF_REQUIRED');
    assert.equal(h.child.killCalls, 0);
  }
  const unknown = harness(); unknown.timeout();
  const result = await unknown.promise; safe(result);
  assert.equal(result.status, 'FAIL_COMPILE_ONLY');
  assert.equal(Object.hasOwn(result, 'handoffRequired'), false, '원 상태 미관측에서는 handoffRequired=false를 만들지 않는다');
  assert.equal(unknown.child.killCalls, 0);
});

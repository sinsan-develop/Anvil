import {createHash} from 'node:crypto';
import {types} from 'node:util';

export const ownershipCompileOnly = Object.freeze({
  candidateId: 'FN06_OWNERSHIP_COMPILE_ONLY_20261027_01',
  manifestPath: 'docs/work_packages/FN06_OWNERSHIP_COMPILE_ONLY_SOURCE_MANIFEST_20261027.json',
  manifestHash: 'D6DE65F1226575736CCF65AC951C44FE632012D1EBA9D25D2CF276ACDFF08A57',
  sourceCheckpoint: '64bb7ab2db534e66d66bf150529df3017e4bd70e',
  branch: 'codex/av3-stage-b',
  qaRoot: 'D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01',
  parent: 'D:/Project/Anvil/.av3-data',
  consumedMarker: 'D:/Project/Anvil/.av3-data/fn06-ownership-compile-20261027-01.consumed.json',
  output: 'bin/OwnershipEvidenceSource.dll',
  decisionPath: 'docs/approvals/FN06_OWNERSHIP_COMPILE_ONLY_20261027_01.json',
});
export const compileOnlyHash = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex').toUpperCase();
export function compileOnlyFail(code = 'INPUT_INVALID'): never { throw Error('OWNERSHIP_COMPILE_ONLY_' + code); }

/** accessor/proxy/비평문 객체를 실행하지 않고 값만 복사한다. 호출자 주장은 OS/승인 증명이 아니다. */
export function compileOnlyPlain(value: unknown, depth = 0): any {
  if (depth > 12) return compileOnlyFail();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) return compileOnlyFail();
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto)) return compileOnlyFail();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string')) return compileOnlyFail();
  if (array) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 128 || keys.length !== length + 1) return compileOnlyFail();
    return Array.from({length}, (_, n) => {
      const d = descriptors[String(n)];
      if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) return compileOnlyFail();
      return compileOnlyPlain(d.value, depth + 1);
    });
  }
  if (keys.length > 64) return compileOnlyFail();
  const out: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const d = descriptors[key]!;
    if (!Object.hasOwn(d, 'value') || !d.enumerable) return compileOnlyFail();
    out[key] = compileOnlyPlain(d.value, depth + 1);
  }
  return out;
}
function exact(value: any, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length || fields.some(k => !Object.hasOwn(value, k))) return compileOnlyFail();
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(k => Object.hasOwn(b, k) && same((a as any)[k], (b as any)[k]));
}
const shaPattern = /^[0-9A-F]{64}$/, commitPattern = /^[0-9a-f]{40}$/;
function instant(v: unknown): number {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return compileOnlyFail('TIME_INVALID');
  const n = Date.parse(v);
  if (!Number.isFinite(n) || new Date(n).toISOString() !== v) return compileOnlyFail('TIME_INVALID');
  return n;
}
const limits = Object.freeze({qaLifetimeMs: 1800000, compilerTimeoutMs: 15000, diagnosticBytes: 16384, compilerAttempts: 1});

/** 같은 read lease가 끝나기 전에는 공유 버퍼를 지우거나 Process handle을 처분하지 않는다. */
export function ownershipCompileOnlyFinalization(outSettled: boolean, errSettled: boolean, processExited: boolean) {
  if ([outSettled, errSettled, processExited].some(x => typeof x !== 'boolean')) return compileOnlyFail('FINALIZATION_UNKNOWN');
  const readsSettled = outSettled && errSettled;
  return Object.freeze({outReadSettled: outSettled, errReadSettled: errSettled, processExited, readsSettled, canClearBuffers: readsSettled, canDisposeProcess: readsSettled && processExited, handoffRequired: !readsSettled || !processExited});
}
export const ownershipCompileOnlyFinalizationPolicies = Object.freeze(Object.fromEntries(
  [false, true].flatMap(out => [false, true].flatMap(err => [false, true].map(exited => [
    `${Number(out)}${Number(err)}${Number(exited)}`, ownershipCompileOnlyFinalization(out, err, exited),
  ]))),
));

export function readOwnershipCompileOnlyManifest(raw: Uint8Array) {
  if (!(raw instanceof Uint8Array) || raw.byteLength > 32768 || compileOnlyHash(raw) !== ownershipCompileOnly.manifestHash) return compileOnlyFail('MANIFEST_MISMATCH');
  // 고정 raw 지문은 JSON의 중복키/추가필드/순서/공백 변경도 거절한다.
  const m = JSON.parse(Buffer.from(raw).toString('utf8'));
  if (m.sources.length !== 12 || m.tools.length !== 4 || !same(m.proposedLimits, limits)) return compileOnlyFail('MANIFEST_MISMATCH');
  return m as {sources: {path: string; bytes: number; sha256: string}[]; tools: {path: string; bytes: number; sha256: string}[]; compilerOptions: string[]; excluded: string[]};
}

export function buildOwnershipCompileOnlyPlan(manifestRaw: Uint8Array, observations: unknown) {
  const m = readOwnershipCompileOnlyManifest(manifestRaw), f = compileOnlyPlain(observations);
  exact(f, ['git', 'sources', 'tools', 'parent', 'qaRootExists', 'consumedMarkerExists']);
  exact(f.git, ['branch', 'sourceCheckpoint', 'actualHead', 'sourceUnchanged', 'privateRemoteVerified']);
  if (f.git.branch !== ownershipCompileOnly.branch || f.git.sourceCheckpoint !== ownershipCompileOnly.sourceCheckpoint || !commitPattern.test(f.git.actualHead) || f.git.sourceUnchanged !== true || f.git.privateRemoteVerified !== true) return compileOnlyFail('GIT_UNVERIFIED');
  if (f.qaRootExists !== false || f.consumedMarkerExists !== false) return compileOnlyFail('ALREADY_EXISTS');
  for (const [files, expected, tool] of [[f.sources, m.sources, false], [f.tools, m.tools, true]] as const) {
    if (!Array.isArray(files) || files.length !== expected.length) return compileOnlyFail('FILE_UNVERIFIED');
    expected.forEach((file, i) => {
      const found = files[i];
      exact(found, ['path', 'bytes', 'sha256', 'regularFile', 'nonLink', 'ownerVerified', ...(tool ? ['signatureVerified'] : [])]);
      if (found.path !== file.path || found.bytes !== file.bytes || found.sha256 !== file.sha256 || found.regularFile !== true || found.nonLink !== true || found.ownerVerified !== true || (tool && found.signatureVerified !== true)) return compileOnlyFail('FILE_UNVERIFIED');
    });
  }
  exact(f.parent, ['path', 'resolvedPath', 'nonLink', 'owner', 'aclPrincipals', 'aclVerified']);
  if (f.parent.path !== ownershipCompileOnly.parent || f.parent.resolvedPath !== ownershipCompileOnly.parent || f.parent.nonLink !== true || f.parent.owner !== 'SINSAN/cyhuh' || f.parent.aclVerified !== true || !Array.isArray(f.parent.aclPrincipals) || !same([...f.parent.aclPrincipals].sort(), ['SINSAN/cyhuh', 'SYSTEM'].sort())) return compileOnlyFail('PARENT_UNVERIFIED');
  const root = ownershipCompileOnly.qaRoot;
  return Object.freeze({
    ...ownershipCompileOnly, actualHead: f.git.actualHead, executable: m.tools[0]!.path,
    argv: Object.freeze([...m.compilerOptions, `/out:${root}/${ownershipCompileOnly.output}`, ...m.tools.slice(1).map(x => `/reference:${x.path}`), ...m.sources.map(x => `${root}/src/${x.path.split('/').at(-1)}`)]),
    limits, useShellExecute: false, createNoWindow: true,
    childEnvironment: Object.freeze({TEMP: root + '/temp', TMP: root + '/temp'}),
    excluded: Object.freeze([...m.excluded]), actualCompilerExecuted: false,
    executionAuthorized: false, externalUserApprovalVerified: false,
  });
}

/** binding 일치만 검사한다. 실제 사람의 원문/플랫폼 승인은 Main이 별도로 대조한다. */
export function validateOwnershipCompileOnlyDecision(decision: unknown, expected: unknown) {
  const d = compileOnlyPlain(decision), b = compileOnlyPlain(expected);
  exact(b, ['candidateId', 'manifestHash', 'sourceCheckpoint', 'executionCommit', 'inputHash', 'runnerHash', 'qaRoot', 'output', 'limits', 'decisionPath', 'observedAt', 'consumedMarkerExists']);
  exact(d, ['schemaVersion', 'status', 'approvalKind', 'candidateId', 'manifestHash', 'sourceCheckpoint', 'executionCommit', 'inputHash', 'runnerHash', 'qaRoot', 'output', 'limits', 'approvedAt', 'expiresAt', 'runId', 'maximumRuns']);
  if (d.schemaVersion !== 1 || d.status !== 'APPROVED_COMPILE_ONLY' || d.approvalKind !== 'DIRECT_USER_EXACT_EXECUTION' || d.runId !== ownershipCompileOnly.candidateId || d.maximumRuns !== 1 || b.consumedMarkerExists !== false || b.decisionPath !== ownershipCompileOnly.decisionPath || !commitPattern.test(b.executionCommit)) return compileOnlyFail('DECISION_INVALID');
  for (const key of ['candidateId', 'manifestHash', 'sourceCheckpoint', 'qaRoot', 'output'] as const) if (b[key] !== ownershipCompileOnly[key] || d[key] !== b[key]) return compileOnlyFail('BINDING_MISMATCH');
  for (const key of ['inputHash', 'runnerHash']) if (!shaPattern.test(b[key]) || d[key] !== b[key]) return compileOnlyFail('BINDING_MISMATCH');
  if (d.executionCommit !== b.executionCommit || !same(b.limits, limits) || !same(d.limits, limits)) return compileOnlyFail('BINDING_MISMATCH');
  const start = instant(d.approvedAt), end = instant(d.expiresAt), now = instant(b.observedAt);
  if (end <= start || end - start > limits.qaLifetimeMs || now < start || now >= end) return compileOnlyFail('WINDOW_INVALID');
  return Object.freeze({bindingMatches: true, externalUserApprovalVerified: false, executionAuthorized: false, approvedAt: d.approvedAt as string, expiresAt: d.expiresAt as string});
}

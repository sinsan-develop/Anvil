import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { readWorkspaceProject } from '../../../apps/web/src/features/workspace/api.ts';
import { createHash } from 'node:crypto';

const pid = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
const actor = '51c0439f-791e-4bb5-8471-70938d6afaf1';
const record = () => ({ id: pid, name: '사용자 소유 개발', purpose: 'Agent를 교체해도 프로젝트 유지', desiredOutcome: '정의한 절차로 작업', version: 2,
  createdAt: '2026-10-16T01:02:03Z', updatedAt: '2026-10-17T01:02:03Z', currentMethodologyRef: { id: actor, version: 1, contentHash: 'a'.repeat(64) }, baselineRef: null,
  sourceMode: 'EMPTY', sourceDeclaration: null, readinessIssues: [{ code: 'PERMISSION_POLICY_UNCONFIGURED' }], viewerPermissions: ['READ_PROJECT'], participation: 'OWNER',
  controlState: { actorId: actor, clientId: pid, generation: 1, status: 'HELD' } });
function clientFor(value: unknown, status = 200) { return new ApiClient((async () => Response.json(value, { status })) as typeof fetch); }
const declaredSource = () => {
  const declaration = { displayName: '기존 개발 소스', hostLabel: 'QA PC', pathHint: 'D:\\qa\\project', reason: '기존 프로젝트 이어가기' };
  return { ref: { id: actor, version: 3, contentHash: createHash('sha256').update(JSON.stringify(declaration)).digest('hex') }, authority: 'USER_DECLARED', readiness: 'UNVERIFIED', declaration };
};

test('기존 소스 소유자의 정확한 선언 원문과 불변 참조를 보존한다', async () => {
  const sourceDeclaration = declaredSource();
  const value = { ...record(), sourceMode: 'EXISTING', sourceDeclaration };
  assert.deepEqual(await readWorkspaceProject(clientFor(value), pid), value);
});

test('조회자·인계 참여자에게 원문이 섞이거나 소스 모드와 선언이 어긋나면 거절한다', async () => {
  for (const change of [
    { participation: 'VIEWER', sourceMode: 'EXISTING', sourceDeclaration: declaredSource() },
    { participation: 'HANDOFF_ELIGIBLE', sourceMode: 'EXISTING', sourceDeclaration: declaredSource() },
    { sourceMode: 'EMPTY', sourceDeclaration: declaredSource() },
    { sourceMode: 'EXISTING', sourceDeclaration: null },
  ]) await assert.rejects(readWorkspaceProject(clientFor({ ...record(), ...change }), pid), { code: 'RESPONSE_INVALID' });
  const viewer = { ...record(), participation: 'VIEWER', sourceMode: 'EXISTING', sourceDeclaration: null };
  assert.deepEqual(await readWorkspaceProject(clientFor(viewer), pid), viewer);
});

test('변조된 선언 해시·자동 검증 승격·잘못된 필드·참조는 거절한다', async () => {
  const source = declaredSource();
  for (const sourceDeclaration of [
    { ...source, declaration: { ...source.declaration, pathHint: 'D:\\qa\\other' } },
    { ...source, readiness: 'VERIFIED' }, { ...source, authority: 'SYSTEM_OBSERVED' },
    { ...source, declaration: { ...source.declaration, hostLabel: 'bad\nlabel' } },
    { ...source, ref: { ...source.ref, version: 0 } },
  ]) await assert.rejects(readWorkspaceProject(clientFor({ ...record(), sourceMode: 'EXISTING', sourceDeclaration }), pid), { code: 'RESPONSE_INVALID' });
});

test('기존 프로젝트 GET만 사용하고 서버 원본·고정 적용 참조를 보존한다', async () => {
  const requests: unknown[] = [];
  const client = new ApiClient((async (path, init) => { requests.push([path, init?.method, init?.credentials, init?.redirect, init?.cache]); return Response.json(record()); }) as typeof fetch);
  const result = await readWorkspaceProject(client, pid);
  assert.equal(result.name, '사용자 소유 개발'); assert.equal(result.desiredOutcome, '정의한 절차로 작업');
  assert.deepEqual(result.currentMethodologyRef, { id: actor, version: 1, contentHash: 'a'.repeat(64) });
  assert.deepEqual(requests, [[`/api/v1/projects/${pid}`, 'GET', 'same-origin', 'error', 'no-store']]);
});
test('잘못된 프로젝트 ID는 전송 전에 거절한다', async () => {
  let calls = 0; const client = new ApiClient((async () => { calls++; return Response.json(record()); }) as typeof fetch);
  await assert.rejects(readWorkspaceProject(client, '../other'), { code: 'CLIENT_PATH_INVALID' }); assert.equal(calls, 0);
});
test('다른 프로젝트의 응답을 표시할 원본으로 수용하지 않는다', async () => {
  await assert.rejects(readWorkspaceProject(clientFor({ ...record(), id: actor }), pid), { code: 'RESPONSE_INVALID' });
});
test('불완전한 HELD 제어와 알 수 없는 제어 상태를 거절한다', async () => {
  for (const controlState of [{ actorId: null, clientId: pid, generation: 1, status: 'HELD' }, { actorId: actor, clientId: pid, generation: 0, status: 'HELD' }, { actorId: actor, clientId: pid, generation: 1, status: 'READY' }])
    await assert.rejects(readWorkspaceProject(clientFor({ ...record(), controlState }), pid), { code: 'RESPONSE_INVALID' });
});
test('적용본·제어가 없는 조회 전용 원본도 실행 가능으로 바꾸지 않고 읽는다', async () => {
  const value = { ...record(), currentMethodologyRef: null, participation: 'VIEWER', controlState: { actorId: null, clientId: null, generation: null, status: 'UNASSIGNED' } };
  assert.deepEqual(await readWorkspaceProject(clientFor(value), pid), value);
});
test('잘못된 적용 해시·준비 부족 코드·권한 목록은 거절한다', async () => {
  for (const change of [{ currentMethodologyRef: { id: actor, version: 1, contentHash: 'invalid' } }, { readinessIssues: [{ code: '<script>' }] }, { viewerPermissions: [] }])
    await assert.rejects(readWorkspaceProject(clientFor({ ...record(), ...change }), pid), { code: 'RESPONSE_INVALID' });
});
test('로그인 만료·조회 거절·네트워크 실패를 빈 성공으로 바꾸지 않는다', async () => {
  for (const status of [401, 403, 404, 503]) await assert.rejects(readWorkspaceProject(clientFor({ code: 'AUTH_REQUIRED' }, status), pid), (error: unknown) => error instanceof ApiError && error.status === status);
  await assert.rejects(readWorkspaceProject(new ApiClient((async () => { throw Error('private'); }) as typeof fetch), pid), { code: 'CONNECTION_LOST' });
});

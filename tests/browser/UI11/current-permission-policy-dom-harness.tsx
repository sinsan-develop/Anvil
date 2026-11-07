import React, { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { AccountSecurity } from '../../../apps/web/src/shell/AccountSecurity.tsx';
import { ordered } from '../../../apps/web/src/features/knowledge/review-view.ts';

const w = window as any;
const projectId = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222', clientId = '33333333-3333-4333-8333-333333333333';
const other = '44444444-4444-4444-8444-444444444444';
type Request = { path: string; method: string | undefined; jsonStarted: boolean; settled: boolean; release: null | (() => void) };
const qa = w.__currentPolicyQA = { requests: [] as Request[], unexpected: [] as string[], authLost: 0, mode: 'NORMAL', pending: false, hashPending: false, hashRelease: null as null | (() => void), hashSettled: true, policyHash: '' };
const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
async function hash(value: unknown) { return [...new Uint8Array(await originalDigest('SHA-256', new TextEncoder().encode(ordered(value))))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function policy(mode: string) {
  const scope = { kind: 'PROJECT', projectId };
  const rule = (ruleId: string, operations: string[], disposition: string, user = userId) => ({ ruleId, subjectRef: { kind: 'HUMAN', userId: user }, operations, targetScopes: [scope], disposition, limitPolicyRef: null, expiresAt: '2099-10-25T00:00:00.000Z' });
  const rules: Record<string, any>[] = [rule('CANDIDATE_RULE', ['registerConnection'], 'AUTO'), rule('OTHER_PERSON_MATERIAL', ['saveDocumentDraft'], 'DENY', other), rule('APPROVAL_RULE', ['confirmWorkPlan'], 'REQUIRE_APPROVAL')];
  const sourceRef = { id: '66666666-6666-4666-8666-666666666666', version: 2, contentHash: 'b'.repeat(64) };
  const sourceScope = { sourceRootRef: sourceRef, mappingRef: null, observationRef: { ...sourceRef, id: '99999999-9999-4999-8999-999999999999' }, baselineRef: { ...sourceRef, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, targets: [{ relativePath: 'src/policy.ts', kind: 'FILE', access: 'READ', recursive: false }] };
  rules.push({ ...rule('EXECUTION_RULE', ['authorizeExecution'], 'REQUIRE_APPROVAL', other), targetScopes: [{ kind: 'EXECUTION', projectId, executionId: '55555555-5555-4555-8555-555555555555', executionGeneration: 7, sourceScopes: [sourceScope] }], limitPolicyRef: { id: '77777777-7777-4777-8777-777777777777', version: 3, contentHash: 'a'.repeat(64) } });
  if (mode === 'UNKNOWN') { rules[0]!.disposition = ['AUTO']; rules[0]!.reason = '<script>window.policyUnsafe=1</script> 미지원 필드'; }
  if (mode === 'UNKNOWN_NESTED') Object.assign(rules[0]!, { subjectRef: { kind: 'SERVICE', userId }, operations: [42], targetScopes: [{}], expiresAt: 'not-an-instant' });
  const value = { rules, reason: '<script>window.policyUnsafe=1</script> 저장 사유 전체', reviewRefs: [] };
  const result = { ...value, ref: { id: '88888888-8888-4888-8888-888888888888', version: 12, contentHash: await hash(value) }, createdAt: '2026-10-25T01:02:03.000Z' };
  qa.policyHash = result.ref.contentHash;
  if (mode === 'HASH') result.reason = '변조된 저장 사유';
  return result;
}
crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
  const result = await originalDigest(...args);
  if (qa.hashPending) { qa.hashPending = false; qa.hashSettled = false; await new Promise<void>(resolve => qa.hashRelease = resolve); qa.hashRelease = null; qa.hashSettled = true; }
  return result;
};
function transport(): typeof fetch { return async (path, init) => {
  const request: Request = { path: String(path), method: init?.method, jsonStarted: false, settled: false, release: null }; qa.requests.push(request);
  if (init?.method !== 'GET' || !/^\/api\/v1\/projects\/[0-9a-f-]+\/permission-policy$/.test(String(path))) { qa.unexpected.push(String(path)); throw Error('등록하지 않은 합성 요청'); }
  const mode = qa.mode, pending = qa.pending; qa.pending = false;
  const status = /^ERROR_/.test(mode) ? Number(mode.slice(6)) : 200;
  const value = status !== 200 ? { code: status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'ACCESS_DENIED' : 'NOT_FOUND', raw: '노출 금지 오류 원문' } : mode === 'UNCONFIGURED' ? { configured: false, policy: null } : { configured: true, policy: await policy(mode) };
  const response = Response.json(value, { status }), json = response.json.bind(response);
  response.json = async () => { request.jsonStarted = true; if (pending) await new Promise<void>(resolve => request.release = resolve); try { return await json(); } finally { request.release = null; request.settled = true; } };
  return response;
}; }
function Harness() {
  const initial = { projectId, userId, clientId, clientVersion: 0, epoch: 0, shown: true };
  const [model, setModel] = useState(initial), clients = useMemo(() => [new ApiClient(transport()), new ApiClient(transport())], []);
  qa.reset = (mode = 'NORMAL') => { qa.mode = mode; qa.pending = false; qa.hashPending = false; flushSync(() => setModel(previous => ({ ...initial, epoch: previous.epoch + 1 }))); };
  qa.context = (kind: string) => flushSync(() => setModel(previous => kind === 'unmount' ? { ...previous, shown: false } : kind === 'project' ? { ...previous, projectId: previous.projectId === projectId ? other : projectId } : kind === 'user' ? { ...previous, userId: previous.userId === userId ? other : userId } : kind === 'device' ? { ...previous, clientId: previous.clientId === clientId ? other : clientId } : { ...previous, clientVersion: previous.clientVersion + 1 }));
  // App의 settings 소비자와 같은 사용자·client key 경계. 프로젝트 전환은 viewer가 직접 폐기한다.
  return model.shown ? <AccountSecurity key={model.epoch + ':' + model.userId + ':' + model.clientId} projectId={model.projectId} client={clients[model.clientVersion % 2]!} csrfToken={'C'.repeat(43)} onSession={() => { throw Error('조회에서 세션 변경 금지'); }} onRevoked={() => qa.authLost++} /> : <p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness />);

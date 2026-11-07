import { useLayoutEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../api/client.ts';
import { readCandidatePermissionPolicy, type CandidatePermissionPolicy } from '../features/connections/candidate-policy-api.ts';
import { validRef } from '../features/connections/api.ts';

type View =
  | { kind: 'closed' | 'loading' | 'empty' | 'error' }
  | { kind: 'ready'; policy: CandidatePermissionPolicy; observedAt: string };

const ruleKeys = ['ruleId', 'subjectRef', 'operations', 'targetScopes', 'disposition', 'limitPolicyRef', 'expiresAt'];
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
function definedDisposition(rule: Record<string, unknown>): string {
  if (!exact(rule, ruleKeys) || typeof rule.ruleId !== 'string') return '정의 미확인';
  const subject = rule.subjectRef, operations = rule.operations, scopes = rule.targetScopes;
  if (!exact(subject, ['kind', 'userId']) || subject.kind !== 'HUMAN' || !uuid(subject.userId)
    || !Array.isArray(operations) || !operations.length || !operations.every(operation => typeof operation === 'string')
    || !Array.isArray(scopes) || !scopes.length || !scopes.every(scope => exact(scope, ['kind', 'projectId']) && scope.kind === 'PROJECT' && uuid(scope.projectId))
    || rule.limitPolicyRef !== null && !validRef(rule.limitPolicyRef)
    || typeof rule.expiresAt !== 'string' || !Number.isFinite(Date.parse(rule.expiresAt))) return '정의 미확인';
  if (rule.disposition === 'AUTO') return '정의상 허용';
  if (rule.disposition === 'DENY') return '정의상 거절';
  if (rule.disposition === 'REQUIRE_APPROVAL') return '정의상 별도 승인';
  return '정의 미확인';
}

export function ProjectPermissionPolicyView({ client, projectId, onAuthenticationLost }: { client: ApiClient; projectId: string; onAuthenticationLost: () => void }) {
  const [view, setView] = useState<View>({ kind: 'closed' });
  const sequence = useRef(0), mounted = useRef(false), working = useRef(false);
  const context = useRef({ client, projectId });
  context.current = { client, projectId };
  const lost = useRef(onAuthenticationLost);
  lost.current = onAuthenticationLost;

  useLayoutEffect(() => {
    mounted.current = true;
    sequence.current++;
    working.current = false;
    setView({ kind: 'closed' });
    return () => { mounted.current = false; sequence.current++; working.current = false; };
  }, [client, projectId]);

  function close() { sequence.current++; working.current = false; setView({ kind: 'closed' }); }
  async function read() {
    if (working.current) return;
    working.current = true;
    const ticket = ++sequence.current, selectedClient = client, selectedProject = projectId;
    const active = () => mounted.current && sequence.current === ticket && context.current.client === selectedClient && context.current.projectId === selectedProject;
    setView({ kind: 'loading' });
    try {
      const policy = await readCandidatePermissionPolicy(selectedClient, selectedProject);
      if (active()) setView(policy ? { kind: 'ready', policy, observedAt: new Date().toISOString() } : { kind: 'empty' });
    } catch (cause) {
      if (active()) {
        setView({ kind: 'error' });
        if (cause instanceof ApiError && cause.status === 401) lost.current();
      }
    } finally {
      if (sequence.current === ticket) working.current = false;
    }
  }

  return <section className="status-card" role="region" aria-label="현재 프로젝트 권한 정책">
    <h2>현재 프로젝트 권한 정책</h2>
    <p>선택한 프로젝트 {projectId}의 저장된 정책 정의 전체를 읽습니다. 조회는 정책을 변경하지 않습니다.</p>
    <button type="button" disabled={view.kind === 'loading'} onClick={() => void read()}>현재 권한 정책 조회</button>
    {view.kind !== 'closed' ? <button type="button" onClick={close}>현재 권한 정책 닫기</button> : null}
    {view.kind === 'loading' ? <p role="status">현재 권한 정책 조회 중</p> : null}
    {view.kind === 'empty' ? <p>현재 권한 정책이 설정되지 않았습니다.</p> : null}
    {view.kind === 'error' ? <p role="alert">현재 권한 정책을 확인하지 못했습니다. 다시 조회해 주세요.</p> : null}
    {view.kind === 'ready' ? <section role="region" aria-label="저장된 현재 권한 정책">
      <h3>저장된 현재 권한 정책</h3>
      <dl>
        <dt>정책 ID</dt><dd>{view.policy.ref.id}</dd>
        <dt>버전</dt><dd>{view.policy.ref.version}</dd>
        <dt>내용 hash</dt><dd>{view.policy.ref.contentHash}</dd>
        <dt>저장 사유</dt><dd>{view.policy.reason}</dd>
        <dt>저장 시각</dt><dd>{view.policy.createdAt}</dd>
        <dt>조회 완료 시각</dt><dd>{view.observedAt}</dd>
        <dt>검토 참조</dt><dd>{view.policy.reviewRefs.length ? JSON.stringify(view.policy.reviewRefs) : '0건'}</dd>
      </dl>
      <p>저장된 정의상 허용·거절·별도 승인 표시는 현재 행동을 허용한다고 판정하지 않습니다. 실행 시 현재 조건을 다시 검사합니다.</p>
      {view.policy.rules.map((rule, index) => <details key={rule.ruleId + ':' + index}>
        <summary>{rule.ruleId} · {definedDisposition(rule)}</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(rule, null, 2)}</pre>
      </details>)}
    </section> : null}
  </section>;
}

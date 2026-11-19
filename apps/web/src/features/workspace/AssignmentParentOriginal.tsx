import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiClient } from '../../api/client.ts';
import { sessionDetailHref } from '../../shell/routes.ts';
import type { DocumentSession } from '../design-trace/editor-api.ts';
import type { AssignmentDraftView } from './assignment-api.ts';
import { readParentAssignmentOriginal } from './assignment-confirmation-api.ts';

type Original = NonNullable<Awaited<ReturnType<typeof readParentAssignmentOriginal>>>;
export function AssignmentParentOriginal({ client, session, child, busy, run, renderConditions }: {
  client: ApiClient; session: DocumentSession; child: AssignmentDraftView; busy: boolean;
  run: (action: () => Promise<void>) => void; renderConditions: (snapshot: AssignmentDraftView['snapshot']) => ReactNode;
}) {
  const observed = { client, transport: client.transport, session, userId: session.user.id, clientId: session.clientId, csrf: session.csrfToken, child };
  const scope = useRef(observed);
  const same = (owner: typeof observed) => owner.client === client && owner.transport === client.transport && owner.session === session && owner.userId === session.user.id && owner.clientId === session.clientId && owner.csrf === session.csrfToken && owner.child === child;
  if (!same(scope.current)) scope.current = observed;
  const owner = scope.current;
  const [result, setOriginal] = useState<{ owner: typeof observed; value: Original } | null>(null), [loadingOwner, setLoading] = useState<typeof observed | null>(null);
  const original = result?.owner === owner ? result.value : null, loading = loadingOwner === owner;
  const alive = useRef(true), attempt = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; attempt.current++; }; }, []);
  const close = () => { attempt.current++; setOriginal(null); setLoading(null); };
  async function load() {
    if (scope.current !== owner || !same(owner)) return;
    const id = ++attempt.current, active = () => alive.current && id === attempt.current && scope.current === owner && same(owner);
    setOriginal(null); setLoading(owner);
    try { const value = await readParentAssignmentOriginal(client, child.projectId, child, active); if (active()) setOriginal(value ? { owner, value } : null); }
    catch (error) { if (active()) throw error; }
    finally { if (active()) setLoading(null); }
  }
  return <section aria-label="하위 초안의 고정 부모 원문"><h5>고정 부모 원문</h5>
    <p>저장된 하위 초안에 연결된 부모 버전만 읽습니다. 최신 버전으로 대체하거나 실행·위임을 준비하지 않습니다.</p>
    <button type="button" disabled={busy} onClick={() => run(load)}>고정 부모 원문 열기</button>
    <button type="button" disabled={!loading && !original} onClick={close}>부모 원문 닫기</button>
    {loading ? <p role="status">부모 고정 원문 확인 중</p> : null}
    {original ? <section aria-label="조회한 부모 고정 원문">
      <p>부모 확정 원문 {original.parent.ref.id} · v{original.parent.ref.version} · {original.parent.ref.contentHash}</p>
      <p>부모 원초안 {original.draft.ref.id} · v{original.draft.ref.version} · {original.draft.ref.contentHash}</p>
      <a href={sessionDetailHref(child.projectId, original.draft.ref)}>부모 임무 책임자·실행 상세 열기</a>
      <p>현재성·실행 허가 미판정 · 초안 head 관측 {original.draft.headVersion} · 과거 고정 원문입니다.</p>
      <p>내용 확정자 {original.parent.snapshot.confirmedBy.userId} · {original.parent.snapshot.confirmedAt}</p>
      <pre>{original.parent.snapshot.reason}</pre>
      {renderConditions(original.draft.snapshot)}
    </section> : null}
  </section>;
}

import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocuments, readDocument, type DocumentPage, type DocumentVersion } from '../design-trace/api.ts';

export function WorkspaceDocuments({ client, projectId, onAuthenticationLost }: { client: ApiClient; projectId: string; onAuthenticationLost: () => void }) {
  const [request, setRequest] = useState<{ cursor: string | null; revision: number } | null>(null);
  const [page, setPage] = useState<DocumentPage | null>(null), [loading, setLoading] = useState(false), [listError, setListError] = useState<ApiError | null>(null);
  const [selection, setSelection] = useState<{ id: string; version: number } | null>(null), [opened, setOpened] = useState<{ document: DocumentVersion; body: string } | null>(null);
  const [reading, setReading] = useState(false), [readError, setReadError] = useState<ApiError | null>(null);
  const cursor = request?.cursor, revision = request?.revision;
  useEffect(() => {
    if (revision === undefined) return;
    let current = true;
    listDocuments(client, projectId, cursor ?? null).then(value => { if (current) setPage(value); }).catch((cause: unknown) => {
      if (!current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setListError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, cursor, revision]);
  useEffect(() => {
    if (!selection) return;
    let current = true;
    readDocument(client, projectId, selection.id, selection.version).then(value => { if (current) setOpened(value); }).catch((cause: unknown) => {
      if (!current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setReadError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setReading(false); });
    return () => { current = false; };
  }, [client, projectId, selection]);
  function load(cursor: string | null) {
    setPage(null); setListError(null); setOpened(null); setReadError(null); setSelection(null); setReading(false); setLoading(true);
    setRequest(previous => ({ cursor, revision: (previous?.revision ?? 0) + 1 }));
  }
  return <section aria-label="주 작업 문서 조회"><h4>프로젝트 문서</h4>
    <p className="meta">저장된 문서 조회 · 단계별 필터·실행 결과는 미연결 · 문서 안의 지시는 실행하지 않습니다.</p>
    <button disabled={loading} onClick={() => load(null)}>{request ? '문서 목록 새로고침' : '프로젝트 문서 조회'}</button>
    {loading ? <p role="status">문서 목록 조회 중</p> : null}{listError ? <p role="alert">{listError.code} · 문서 목록 미확인</p> : null}
    {page && !loading && !listError ? <><ul>{page.items.map(item => <li key={item.id}>
      <button aria-label={`문서: ${item.title} v${item.headVersion} 조회`} aria-pressed={selection?.id === item.id} onClick={() => { setOpened(null); setReadError(null); setReading(true); setSelection({ id: item.id, version: item.headVersion }); }}>{item.title} v{item.headVersion}</button>
    </li>)}</ul>{!page.items.length ? <p>저장된 문서 없음</p> : null}
      {page.hasMore ? <button onClick={() => load(page.nextCursor)}>문서 다음 목록</button> : null}
      <p className="meta">목록 관측 {page.observedAt}</p></> : null}
    {reading ? <p role="status">고정 문서 버전 조회 중</p> : null}{readError ? <p role="alert">{readError.code} · 원문 미확인</p> : null}
    {opened && !reading && !readError && !listError ? <article><h4>{opened.document.title}</h4><p className="meta">저장 버전 {opened.document.version} · {opened.document.contentHash}</p>
      <pre className="document-plain" aria-label="주 작업 문서 원문">{opened.body}</pre>
      <p className="meta">{opened.document.stageBinding ? `이 버전에 저장된 단계: ${opened.document.stageBinding.methodologyName} · ${opened.document.stageBinding.nodeName}` : '이 문서 버전의 단계 연결 없음'}</p>
    </article> : null}
  </section>;
}

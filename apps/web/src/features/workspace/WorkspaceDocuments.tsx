import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocuments, readDocument, type DocumentPage, type DocumentVersion } from '../design-trace/api.ts';
import { sameStageRef } from '../design-trace/stage-api.ts';
import { PinnedFormOriginal } from '../methodologies/PinnedFormOriginal.tsx';
import type { WorkspaceStageSelection } from './api.ts';
import {documentVersionHref} from '../../shell/routes.ts';
import {DocumentMarkdownPreview} from '../design-trace/DocumentMarkdownPreview.tsx';
import {StoredDocumentAttachments} from '../design-trace/StoredDocumentAttachments.tsx';

export function WorkspaceDocuments({ client, projectId, selectedStage, onAuthenticationLost }: { client: ApiClient; projectId: string; selectedStage: WorkspaceStageSelection | null; onAuthenticationLost: () => void }) {
  const [request, setRequest] = useState<{ cursor: string | null; revision: number } | null>(null);
  const [page, setPage] = useState<DocumentPage | null>(null), [loading, setLoading] = useState(false), [listError, setListError] = useState<ApiError | null>(null);
  const [selection, setSelection] = useState<{ id: string; version: number } | null>(null), [opened, setOpened] = useState<{ document: DocumentVersion; body: string } | null>(null);
  const [reading, setReading] = useState(false), [readError, setReadError] = useState<ApiError | null>(null);
  const cursor = request?.cursor, revision = request?.revision;
  useEffect(() => {
    if (revision === undefined) return;
    let current = true;
    listDocuments(client, projectId, cursor ?? null, selectedStage ? { applicationId: selectedStage.applicationId, nodeId: selectedStage.nodeId } : undefined).then(value => { if (current) setPage(value); }).catch((cause: unknown) => {
      if (!current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setListError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, cursor, revision, selectedStage?.applicationId, selectedStage?.nodeId]);
  useEffect(() => {
    if (!selection) return;
    let current = true;
    readDocument(client, projectId, selection.id, selection.version, {active:()=>current,...(selectedStage?{expectedStage:{applicationId:selectedStage.applicationId,nodeId:selectedStage.nodeId}}:{})}).then(value => { if (current) { if (selectedStage && !sameStageRef(value.document.stageNodeRef, { applicationId: selectedStage.applicationId, nodeId: selectedStage.nodeId })) throw new ApiError('DOCUMENT_STAGE_CHANGED'); setOpened(value); } }).catch((cause: unknown) => {
      if (!current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setReadError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setReading(false); });
    return () => { current = false; };
  }, [client, projectId, selection, selectedStage?.applicationId, selectedStage?.nodeId]);
  function load(cursor: string | null) {
    setPage(null); setListError(null); setOpened(null); setReadError(null); setSelection(null); setReading(false); setLoading(true);
    setRequest(previous => ({ cursor, revision: (previous?.revision ?? 0) + 1 }));
  }
  return <section aria-label="주 작업 문서 조회"><h4>프로젝트 문서</h4>
    <p className="meta">{selectedStage ? `선택 정의: ${selectedStage.nodeName} · 관측 시점 최신 문서의 단계 연결 목록` : '프로젝트 전체 문서 조회 · 선택 단계 없음'} · 실제 실행 결과는 미연결 · 문서 안의 지시는 실행하지 않습니다.</p>
    <button disabled={loading} onClick={() => load(null)}>{request ? '문서 목록 새로고침' : selectedStage ? '선택 단계 문서 조회' : '프로젝트 문서 조회'}</button>
    {loading ? <p role="status">문서 목록 조회 중</p> : null}{listError ? <p role="alert">{listError.code} · 문서 목록 미확인. 프로젝트 원본·적용 절차를 다시 조회하세요.</p> : null}
    {page && !loading && !listError ? <><ul>{page.items.map(item => <li key={item.id}>
      <button aria-label={`문서: ${item.title} v${item.headVersion} 조회`} aria-pressed={selection?.id === item.id} onClick={() => { setOpened(null); setReadError(null); setReading(true); setSelection({ id: item.id, version: item.headVersion }); }}>{item.title} v{item.headVersion}</button>
    </li>)}</ul>{!page.items.length ? <p>{selectedStage ? '선택 단계에 연결된 최신 문서 없음 · 단계 완료/안전 판정이 아닙니다.' : '저장된 문서 없음'}</p> : null}
      {page.hasMore ? <button onClick={() => load(page.nextCursor)}>문서 다음 목록</button> : null}
      <p className="meta">목록 관측 {page.observedAt}</p></> : null}
    {reading ? <p role="status">고정 문서 버전 조회 중</p> : null}{readError ? <p role="alert">{readError.code} · 원문 미확인</p> : null}
    {opened && !reading && !readError && !listError ? <article><h4>{opened.document.title}</h4><p className="meta">저장 버전 {opened.document.version} · {opened.document.contentHash}</p>
      <a href={documentVersionHref(projectId,{id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash})}>이 고정 문서로 작성 화면 열기</a>
      <pre className="document-plain" aria-label="주 작업 문서 원문">{opened.body}</pre>
      <DocumentMarkdownPreview key={JSON.stringify([projectId,opened.document.id,opened.document.version,opened.document.contentHash,opened.document.content.body.contentHash])} body={opened.body} mediaType={opened.document.content.body.mediaType}/>
      <StoredDocumentAttachments key={JSON.stringify([projectId,opened.document.id,opened.document.version,opened.document.contentHash])} client={client} projectId={projectId} document={opened.document} onAuthenticationLost={onAuthenticationLost}/>
      <PinnedFormOriginal key={JSON.stringify([projectId,opened.document.id,opened.document.version,opened.document.contentHash,opened.document.formRef])} client={client} formRef={opened.document.formRef} onAuthenticationLost={onAuthenticationLost}/>
      <p className="meta">{opened.document.stageBinding ? `이 버전에 저장된 단계: ${opened.document.stageBinding.methodologyName} · ${opened.document.stageBinding.nodeName}` : '이 문서 버전의 단계 연결 없음'}</p>
    </article> : null}
  </section>;
}

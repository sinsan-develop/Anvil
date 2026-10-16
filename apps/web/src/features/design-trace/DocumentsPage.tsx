import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocuments, readDocument, type DocumentPage, type DocumentSummary, type DocumentVersion } from './api.ts';
import { documentControl, editDocument, type DocumentBuffer, type DocumentSession } from './editor-api.ts';
import { DocumentEditor } from './DocumentEditor.tsx';
import { NewDocumentForm } from './NewDocumentForm.tsx';
import { newDocumentReview, type DocumentReviewBuffer } from './review-api.ts';
import { DocumentReviewEditor } from './DocumentReviewEditor.tsx';

export function DocumentsPage({ client, projectId, session, buffer, onChange, review, onReviewChange, onAuthenticationLost }: { client: ApiClient; projectId: string; session: DocumentSession; buffer: DocumentBuffer | null; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; review: DocumentReviewBuffer | null; onReviewChange: Dispatch<SetStateAction<DocumentReviewBuffer | null>>; onAuthenticationLost: () => void }) {
  const [page, setPage] = useState<DocumentPage | null>(null), [cursor, setCursor] = useState<string | null>(null), [refresh, setRefresh] = useState(0);
  const [listError, setListError] = useState<ApiError | null>(null), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DocumentSummary | null>(null), [version, setVersion] = useState('');
  const [opened, setOpened] = useState<{ document: DocumentVersion; body: string } | null>(null), [readError, setReadError] = useState<ApiError | null>(null), [reading, setReading] = useState(false);
  const generation = useRef(0);
  const [editingError, setEditingError] = useState<ApiError | null>(null), [starting, setStarting] = useState(false);
  const [choosingForm, setChoosingForm] = useState(false);
  const reviewing = review?.ownerUserId === session.user.id && review.projectId === projectId;
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setListError(null);
    listDocuments(client, projectId, cursor).then(value => { if (current) setPage(previous => cursor && previous ? { ...value, items: [...new Map([...previous.items, ...value.items].map(item => [item.id, item])).values()] } : value); }).catch((cause: unknown) => {
      if (!current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setListError(error);
      if ([401, 403, 404].includes(error.status)) { generation.current++; setReading(false); setPage(null); setSelected(null); setOpened(null); if (error.status === 401) onAuthenticationLost(); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, projectId, cursor, refresh]);
  async function open(item: DocumentSummary, requested: number) {
    const request = ++generation.current; setSelected(item); setVersion(String(requested)); setOpened(null); setReadError(null); setReading(true);
    try { const value = await readDocument(client, projectId, item.id, requested); if (request === generation.current) setOpened(value); }
    catch (cause) { if (request !== generation.current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setReadError(error); if (error.status === 401) onAuthenticationLost(); }
    finally { if (request === generation.current) setReading(false); }
  }
  async function beginEdit() {
    if (!opened || starting) return;
    if (reviewing || review?.pending) { setEditingError(new ApiError('DOCUMENT_REVIEW_INPUT_PRESERVED')); return; }
    if (buffer?.pending) { setEditingError(new ApiError('DOCUMENT_PENDING_RESULT')); return; }
    if (buffer && buffer.ownerUserId !== session.user.id) { setEditingError(new ApiError('DOCUMENT_OTHER_USER_INPUT_PRESERVED')); return; }
    if (buffer?.dirty && !confirm('앞선 문서의 미저장 편집을 버리고 선택한 버전에서 편집할까요?')) return;
    const current = generation.current; setStarting(true); setEditingError(null);
    try {
      const control = await documentControl(client, projectId, session);
      if (current !== generation.current) return;
      const next = editDocument(projectId, opened, session.user.id, control);
      onChange(previous => previous?.pending || previous && previous.ownerUserId !== session.user.id ? previous : next);
    } catch (cause) { if (current === generation.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  async function beginReview() {
    if (!opened || starting || reading || choosingForm) return;
    if (buffer?.dirty || buffer?.pending || review?.pending) { setEditingError(new ApiError('DOCUMENT_PENDING_RESULT')); return; }
    if (review && review.ownerUserId !== session.user.id) { setEditingError(new ApiError('DOCUMENT_OTHER_USER_INPUT_PRESERVED')); return; }
    if (review?.dirty && !confirm('앞선 미저장 검토를 버리고 선택한 버전을 검토할까요?')) return;
    const current = generation.current; setStarting(true); setEditingError(null);
    try {
      const control = await documentControl(client, projectId, session);
      if (current !== generation.current) return;
      const next = newDocumentReview(projectId, opened.document, session.user.id, control);
      onReviewChange(previous => previous?.pending || previous && previous.ownerUserId !== session.user.id ? previous : next);
    } catch (cause) { if (current === generation.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setEditingError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { setStarting(false); }
  }
  return <section aria-label="프로젝트 문서 조회" className="document-workspace">
    <aside className="status-card document-list"><h2>프로젝트 문서</h2><button disabled={loading} onClick={() => { setCursor(null); setRefresh(value => value + 1); }}>문서 목록 새로고침</button>
      <button disabled={starting || reviewing || !!review?.pending || choosingForm || !!buffer?.pending || !!buffer && buffer.ownerUserId !== session.user.id} onClick={() => { if (!buffer?.dirty || confirm('앞선 미저장 문서 편집을 버리고 새 문서를 작성할까요?')) { setEditingError(null); setChoosingForm(true); } }}>새 문서 작성</button>
      {loading ? <p role="status">목록 조회 중</p> : null}{listError ? <p role="alert">{listError.message} · {listError.code}{page ? ' · 앞선 목록은 오래된 자료' : ''}</p> : null}
      {page && !loading && !listError && !page.items.length ? <p>저장된 문서가 없습니다.</p> : null}
      <ul>{page?.items.map(item => <li key={item.id}><button disabled={reading || !!listError || loading} aria-label={item.title + ' 열기'} aria-pressed={selected?.id === item.id} onClick={() => { void open(item, item.headVersion); }}>{item.title}</button><p className="meta">최신 {item.headVersion} · {item.confirmedVersion === null ? '미확정' : '확정 ' + item.confirmedVersion}</p></li>)}</ul>
      {page?.hasMore ? <button disabled={loading || !!listError} onClick={() => setCursor(page.nextCursor)}>다음 문서 더 보기</button> : null}
      {page ? <p className="meta">관측 {new Date(page.observedAt).toLocaleString('ko-KR')}</p> : null}
    </aside>
    <section className="status-card document-content"><p className="meta">원문·버전·검토 이력 조회와 양식 선택/새 문서·초안 버전 편집·내용 검토 기록을 연결했습니다. 별도 확정·작업/코드/시험 추적 화면은 아직 연결 전입니다. 문서 안의 지시는 실행하지 않습니다.</p>
      {choosingForm ? <><NewDocumentForm client={client} session={session} projectId={projectId} onAuthenticationLost={onAuthenticationLost} onPrepared={next => { onChange(previous => previous?.pending || previous && previous.ownerUserId !== session.user.id ? previous : next); setChoosingForm(false); }} /><button onClick={() => setChoosingForm(false)}>양식 선택 닫기</button></> : null}
      {selected ? <div className="project-toolbar"><label>조회 버전<input type="number" min="1" max={selected.headVersion} value={version} onChange={event => setVersion(event.target.value)} /></label><button disabled={reading || !Number.isSafeInteger(Number(version)) || Number(version) < 1 || Number(version) > selected.headVersion} onClick={() => { void open(selected, Number(version)); }}>지정 버전 조회</button></div> : <p>문서를 선택하세요.</p>}
      {reading ? <p role="status">원문 무결성 확인 중</p> : null}{readError ? <p role="alert">{readError.message} · {readError.code}</p> : null}
      {opened ? <><h2>{opened.document.title}</h2><p>{opened.document.confirmed ? '확정된 버전' : '초안 · 내용 검토/사용자 확정과 별개'}</p><p className="meta">버전 {opened.document.version} · 양식 {opened.document.formRef.id} v{opened.document.formRef.version} · SHA256 {opened.document.contentHash}</p>
        <button disabled={starting || reading || choosingForm || reviewing || !!review?.pending || !!buffer?.pending || !!buffer && buffer.ownerUserId !== session.user.id} onClick={() => { void beginEdit(); }}>이 버전에서 편집</button>
        <button disabled={starting || reading || choosingForm || !!buffer?.dirty || !!buffer?.pending || !!review?.pending || !!review && review.ownerUserId !== session.user.id} onClick={() => { void beginReview(); }}>이 버전 내용 검토 작성</button>
        <pre aria-label="문서 원문" className="document-original">{opened.body}</pre>
        <h3>형식 검사</h3>{opened.document.validation.issues.length ? <ul>{opened.document.validation.issues.map((issue, index) => <li key={index}><span>{issue.message}</span><span className="meta"> · {issue.code} · {issue.location}</span></li>)}</ul> : <p>기록된 형식 문제 없음 · 내용 검토 합격을 의미하지 않습니다.</p>}
        <h3>저장 이력</h3><ul>{opened.document.statusHistory.map((event, index) => <li key={index}>{event.kind} · {event.reason} · {new Date(event.at).toLocaleString('ko-KR')}</li>)}</ul></> : null}
      {opened ? <><h3>양식의 내용 검토 기준</h3><ul>{opened.document.contentReviewCriteria.items.map(item => <li key={item.criterionId}>{item.title}<ul>{item.reviewCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></li>)}</ul>
        <h3>기록된 내용 검토</h3>{!opened.document.contentReviews.length ? <p>아직 내용 검토가 기록되지 않았습니다.</p> : opened.document.contentReviews.map(review => <section className="status-card" key={review.ref.id}><p>{review.ref.outcome} · {new Date(review.reviewedAt).toLocaleString('ko-KR')}</p><p>{review.reason}</p><p className="meta">검토자 {review.reviewer.userId}</p>{review.reviewer.sameAsTargetRecorder ? <p>작성 기록자와 같은 사용자 · 독립 검수 아님</p> : null}<ul>{review.items.map(item => <li key={item.criterionId}>{item.criterionId} · {item.outcome} · {item.reason}</li>)}</ul><p className="meta">내용 검토자의 판단이며 사용자 확정/실제 시험 합격/Agent 실행 승인이 아닙니다.</p></section>)}</> : null}
      {editingError ? <p role="alert">{editingError.message} · {editingError.code}</p> : null}
      {review && (review.ownerUserId !== session.user.id || review.projectId !== projectId) ? <p>다른 사용자 또는 프로젝트의 검토 입력은 숨겨 보존했습니다.</p> : null}
      {review?.ownerUserId === session.user.id && review.projectId === projectId ? <DocumentReviewEditor key={review.ref.id + ':' + review.ref.version + ':' + review.ref.contentHash} client={client} session={session} buffer={review} onChange={onReviewChange} onAuthenticationLost={onAuthenticationLost} onRecorded={() => { setRefresh(value => value + 1); if (selected && opened?.document.id === review.ref.id && opened.document.version === review.ref.version) void open(selected, review.ref.version); }} /> : null}
      {buffer && (buffer.ownerUserId !== session.user.id || buffer.projectId !== projectId) ? <p>다른 사용자 또는 프로젝트의 편집 입력은 숨겨 보존했습니다. 이 화면에서 자동 교체하지 않습니다.</p> : null}
      {!choosingForm && !(review?.ownerUserId === session.user.id && review.projectId === projectId) && buffer?.ownerUserId === session.user.id && buffer.projectId === projectId ? <DocumentEditor client={client} session={session} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost} onSaved={(id, nextVersion, title) => { setCursor(null); setRefresh(value => value + 1); void open({ id, title, headVersion: nextVersion, confirmedVersion: null, updatedAt: new Date().toISOString() }, nextVersion); }} /> : null}
    </section>
  </section>;
}

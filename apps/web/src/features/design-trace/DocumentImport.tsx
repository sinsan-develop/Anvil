import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentBuffer, DocumentSession } from './editor-api.ts';
import { adoptDocumentImport, continueDocumentImport, prepareDocumentImport, type DocumentImportBuffer } from './import-api.ts';

export function DocumentImport({ client, session, buffer, onChange, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; buffer: DocumentBuffer; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; onAuthenticationLost: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<ApiError | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const running = useRef(false), mounted = useRef(true), state = buffer.importState;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function update(value: DocumentImportBuffer) { onChange(b => b?.ownerUserId === session.user.id && b.projectId === buffer.projectId && b.documentId === null && (!b.importState || b.importState.upload.commandId === value.upload.commandId) ? { ...b, importState: value, dirty: true } : b); }
  function failed(cause: unknown) { const e = cause instanceof ApiError ? cause : new ApiError('IMPORT_INPUT_INVALID'); if (mounted.current) { setError(e); if (e.status === 401) onAuthenticationLost(); } return e; }
  async function select(file: File | undefined) {
    if (!file || running.current || state || buffer.pending || buffer.ownerUserId !== session.user.id) return;
    running.current = true; setBusy(true); setError(null); setAcknowledged(false);
    try {
      if (file.size > 20 * 1024 * 1024) throw new ApiError('IMPORT_FILE_TOO_LARGE');
      const value = await prepareDocumentImport(buffer, session, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      if (mounted.current) update(value);
    } catch (cause) { failed(cause); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function create() {
    if (!state || state.candidate || running.current) return;
    running.current = true; setBusy(true); setError(null); const pending = { ...state, attempted: true }; update(pending);
    try { update(await continueDocumentImport(client, pending, buffer.formRef, session, update, () => mounted.current)); }
    catch (cause) { const e = failed(cause); onChange(b => b?.importState?.upload.commandId === state.upload.commandId ? { ...b, importState: { ...b.importState, failure: { code: e.code, status: e.status } } } : b); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function adopt() {
    if (!state?.candidate || !acknowledged || running.current) return;
    running.current = true; setBusy(true); setError(null);
    try {
      const value = await adoptDocumentImport(client, buffer, session);
      if (mounted.current) onChange(b => b?.importState?.upload.commandId === state.upload.commandId ? value : b);
    } catch (cause) { failed(cause); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  let preview: string | null = null;
  if (state?.candidate?.status === 'READY') { try { preview = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(state.bytes); } catch { /* 손실 변환 없이 후보 오류를 표시한다. */ } }
  return <section aria-label="원본 문서 가져오기" className="status-card"><h3>원본 문서 가져오기</h3><p className="meta">UTF-8 .txt/.md 본문은 최대 2MiB, 원본은 최대 20MiB입니다. 다른 형식은 원본만 보관합니다. 파일 선택만으로 업로드하거나 기존 입력을 바꾸지 않습니다.</p>
    {!state ? <><label htmlFor="document-import-file">가져올 원본 파일</label><input id="document-import-file" type="file" disabled={busy || !!buffer.pending} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }} /></> : <>
      <p>{state.name} · {state.bytes.length} bytes</p>
      {!state.candidate ? <><button disabled={busy} onClick={() => { void create(); }}>{state.attempted ? '같은 가져오기 명령 결과 확인' : '원본 보관·가져오기 후보 만들기'}</button>{state.attempted ? <p>결과 확인 전에는 새 명령이나 파일 교체를 하지 않습니다.</p> : null}</> : <>
        <p role="status">가져오기 후보 {state.candidate.status} · {state.candidate.id}</p><p className="meta">원본 SHA256 {state.candidate.originalRef.contentHash} · {state.candidate.parserVersion ?? '지원 파서 없음'}</p>
        {state.candidate.issues.map((issue, i) => <p key={i}>{issue.code} · {issue.message}</p>)}
        <a href={`/api/v1/projects/${buffer.projectId}/files/${state.candidate.originalRef.artifactId}`} download>보관한 원본 다운로드</a>
        {preview !== null ? <><pre className="document-original" aria-label="가져오기 후보 원문">{preview}</pre><label><input type="checkbox" disabled={busy} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />원문을 확인했고 현재 편집 본문을 이 후보로 바꾸겠습니다</label><button disabled={busy || !acknowledged} onClick={() => { void adopt(); }}>이 후보로 초안 준비</button></> : <p>본문 반영 불가입니다. 원본 보존을 문서 추출 성공으로 취급하지 않습니다.</p>}
      </>}
      {!state.attempted || state.candidate ? <button disabled={busy} onClick={() => onChange(b => b?.importState?.upload.commandId === state.upload.commandId ? { ...b, importState: null } : b)}>후보 선택 닫기</button> : null}
    </>}
    {error || state?.failure ? <p role="alert">{error?.code ?? state?.failure?.code} · 원문과 기존 입력·명령을 보존했습니다.</p> : null}
  </section>;
}

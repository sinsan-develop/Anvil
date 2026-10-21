import{QuarantinedOriginalNotice}from'./QuarantinedOriginalNotice.tsx';
import{isConfirmedArtifactQuarantine,documentFailure}from'./mutation-result.ts';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentBuffer, DocumentSession } from './editor-api.ts';
import { adoptDocumentImport, continueDocumentImport, prepareDocumentImport, preparePngAttachmentImport, matchesDocumentImportTarget, rejectedDocumentImport, type DocumentImportBuffer } from './import-api.ts';
import {ImportedPngAttachment} from './ImportedPngAttachment.tsx';

export function DocumentImport({ client, session, buffer, onChange, onAuthenticationLost, disabled = false }: { client: ApiClient; session: DocumentSession; buffer: DocumentBuffer; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; onAuthenticationLost: () => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<ApiError | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const running = useRef(false), mounted = useRef(true), latest=useRef(buffer), state = buffer.importState, attachmentOnly=buffer.documentId!==null;latest.current=buffer;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function sameTarget(b:DocumentBuffer|null):b is DocumentBuffer{return !!b&&b.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.documentId===buffer.documentId&&b.baseVersion===buffer.baseVersion&&b.baseHash===buffer.baseHash&&b.controlGeneration===buffer.controlGeneration;}
  function update(value: DocumentImportBuffer) { onChange(b => sameTarget(b) && matchesDocumentImportTarget(b,value) && !b.pending && b.importState?.attemptId===value.attemptId && b.importState?.upload.commandId === value.upload.commandId ? { ...b, importState: value, dirty: true } : b); }
  function failed(cause: unknown) { const e = cause instanceof ApiError ? cause : new ApiError('IMPORT_INPUT_INVALID'); if (mounted.current) { setError(e); if (e.status === 401) onAuthenticationLost(); } return e; }
  async function select(file: File | undefined) {
    if (!file || disabled || running.current || state || buffer.pending || buffer.importPreparationId || buffer.ownerUserId !== session.user.id) return;
    running.current = true; setBusy(true); setError(null); setAcknowledged(false);
    const preparationId = crypto.randomUUID();
    onChange(b => b === buffer && !b.pending && !b.importState && !b.importPreparationId ? { ...b, importPreparationId: preparationId, dirty: true } : b);
    try {
      if (file.size > (attachmentOnly?2097152:20 * 1024 * 1024)) throw new ApiError('IMPORT_FILE_TOO_LARGE');
      if(attachmentOnly&&!file.name.toLowerCase().endsWith('.png'))throw new ApiError('IMPORT_INPUT_INVALID');
      const value = await (attachmentOnly?preparePngAttachmentImport:prepareDocumentImport)(buffer, session, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      onChange(b => sameTarget(b) && b.importPreparationId === preparationId && matchesDocumentImportTarget(b,value) && !b.pending && !b.importState ? { ...b, importPreparationId: null, importState: value, dirty: true } : b);
    } catch (cause) { failed(cause); onChange(b => b?.importPreparationId === preparationId ? { ...b, importPreparationId: null } : b); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function create() {
    if (!state || disabled || state.candidate || running.current) return;
    running.current = true; setBusy(true); setError(null); const priorUncertain=state.uncertain,pending = { ...state, attempted: true, uncertain:true,attemptId:crypto.randomUUID(),failure: null }; onChange(b=>sameTarget(b)&&b.importState===state?{...b,importState:pending,dirty:true}:b);
    try { update(await continueDocumentImport(client, pending, buffer.formRef, session, update, () => mounted.current&&sameTarget(latest.current)&&latest.current.importState?.upload.commandId===state.upload.commandId&&latest.current.importState.attemptId===pending.attemptId)); }
    catch (cause) { const e=failed(cause),failure=documentFailure(e),uncertain=isConfirmedArtifactQuarantine(e)?false:priorUncertain||!rejectedDocumentImport({...pending,uncertain:false,failure}); onChange(b=>sameTarget(b)&&b.importState?.upload.commandId===state.upload.commandId&&b.importState.attemptId===pending.attemptId?{...b,importState:{...b.importState,uncertain,failure}}:b); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function adopt() {
    if (!state?.candidate || disabled || !acknowledged || running.current) return;
    running.current = true; setBusy(true); setError(null);
    try {
      const value = await adoptDocumentImport(client, buffer, session);
      if (mounted.current) onChange(b => b?.importState?.upload.commandId === state.upload.commandId ? value : b);
    } catch (cause) { failed(cause); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  let preview: string | null = null;
  if (!attachmentOnly&&state?.candidate?.status === 'READY') { try { preview = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(state.bytes); } catch { /* 손실 변환 없이 후보 오류를 표시한다. */ } }
  return <section aria-label="원본 문서 가져오기" className="status-card"><h3>{attachmentOnly?'새 PNG 첨부 원본 보관':'원본 문서 가져오기'}</h3><p className="meta">{attachmentOnly?'기존 문서에는 PNG 2MiB 이하만 새 첨부로 보관할 수 있습니다. 현재 문서 버전·해시를 고정하고 본문/구버전은 바꾸지 않습니다.':'UTF-8 .txt/.md 본문은 최대 2MiB, 원본은 최대 20MiB입니다. 다른 형식은 원본만 보관합니다.'} 파일 선택만으로 업로드하거나 기존 입력을 바꾸지 않습니다.</p>
    {!state ? <><label htmlFor="document-import-file">{attachmentOnly?'첨부할 새 PNG 파일':'가져올 원본 파일'}</label><input id="document-import-file" type="file" accept={attachmentOnly?'.png,image/png':undefined} disabled={disabled || busy || !!buffer.pending || !!buffer.importPreparationId} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }} />{buffer.importPreparationId ? <p role="status">파일을 읽는 동안 저장·교체를 잠시 보류합니다.</p> : null}</> : <>
      <p>{state.name} · {state.bytes.length} bytes</p>
      {!state.candidate ? <><button disabled={busy} onClick={() => { void create(); }}>{state.attempted ? '같은 가져오기 명령 결과 확인' : attachmentOnly?'PNG 원본 보관·후보 만들기':'원본 보관·가져오기 후보 만들기'}</button>{state.attempted ? <p>결과 확인 전에는 새 명령이나 파일 교체를 하지 않습니다.</p> : null}</> : <>
        <p role="status">가져오기 후보 {state.candidate.status} · {state.candidate.id}</p><p className="meta">원본 SHA256 {state.candidate.originalRef.contentHash} · {state.candidate.parserVersion ?? '지원 파서 없음'}</p>
        {state.candidate.issues.map((issue, i) => <p key={i}>{issue.code} · {issue.message}</p>)}
        <a href={`/api/v1/projects/${buffer.projectId}/files/${state.candidate.originalRef.artifactId}`} download>보관한 원본 다운로드</a>
        {preview !== null ? <><pre className="document-original" aria-label="가져오기 후보 원문">{preview}</pre><label><input type="checkbox" disabled={busy} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />원문을 확인했고 현재 편집 본문을 이 후보로 바꾸겠습니다</label><button disabled={busy || !acknowledged} onClick={() => { void adopt(); }}>이 후보로 초안 준비</button></> : <p>본문 반영 불가입니다. 원본 보존을 문서 추출 성공으로 취급하지 않습니다.</p>}
        {state.candidate.status==='UNSUPPORTED'&&state.candidate.originalRef.mediaType==='image/png'?<ImportedPngAttachment key={state.upload.commandId+':'+state.candidate.id} client={client} session={session} buffer={buffer} disabled={disabled||busy} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}
      </>}
      {rejectedDocumentImport(state) ? <p>서버가 현재 명령을 거절했습니다. 가져오기만 닫아 기존 편집 입력으로 돌아갈 수 있습니다. 이미 보관된 원본은 삭제하지 않으며 다음 작업은 현재 권한/제어를 다시 확인해야 합니다.</p> : null}
      {!state.attempted || state.candidate || rejectedDocumentImport(state) ? <button disabled={busy} onClick={() => onChange(b => b?.importState?.upload.commandId === state.upload.commandId ? { ...b, importState: null } : b)}>후보 선택 닫기</button> : null}
    </>}
    <QuarantinedOriginalNotice failure={state?.failure}/>{error || state?.failure ? <p role="alert">{error?.code ?? state?.failure?.code} · 원문과 기존 입력·명령을 보존했습니다.</p> : null}
  </section>;
}

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { readProjectDraft, type DraftEditorState } from './api.ts';
import { prepareDraftUpload, uploadDraftArtifact, readDraftArtifactBytes, type DraftUploadBuffer } from './draft-artifact-api.ts';
import type { DraftStoredArtifact } from '../../../../../contracts/draft-artifacts.ts';
import { isKnownDocumentRejection } from '../design-trace/mutation-result.ts';
export function DraftArtifactsPanel({ protectedRecords, onMetadata, client, session, buffer, onChange, disabled, readonly = false, projectId = null, run, onBusy, onAuthenticationLost }: {
  protectedRecords: DraftStoredArtifact[] | null; onMetadata: (draftId: string, records: DraftStoredArtifact[] | null, editable?: boolean) => void;
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; buffer: DraftEditorState; onChange: Dispatch<SetStateAction<DraftEditorState>>;
  disabled: boolean; readonly?: boolean; projectId?: string | null; run: (work: () => Promise<unknown>) => Promise<void>; onBusy: (busy: boolean) => void; onAuthenticationLost: () => void;
}) {
  const [error, setError] = useState<ApiError | null>(null), [raw, setRaw] = useState<{ key: string; client: ApiClient; artifactId: string; bytes: Uint8Array<ArrayBuffer>; mediaType: string } | null>(null);
  const mounted = useRef(true), epoch = useRef(0), live = useRef('');
  const activeClient = useRef(client); activeClient.current = client;
  const binding = JSON.stringify([session.user.id, session.clientId, session.csrfToken, buffer.draftId, projectId, readonly]); live.current = binding;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; }; }, []);
  useEffect(() => { epoch.current++; setRaw(null); setError(null); }, [binding, client]);
  const own = !buffer.ownerUserId || buffer.ownerUserId === session.user.id;
  const current = (key: string, attempt: number) => mounted.current && activeClient.current === client && live.current === key && epoch.current === attempt;
  const metadataAllowed = own && protectedRecords !== null;
  const records = metadataAllowed ? protectedRecords : [];
  const pending = buffer.upload;
  const writesBlocked = disabled || readonly || !metadataAllowed || !buffer.draftId || !!buffer.pendingAction || !!buffer.pendingCommand;
  async function select(file: File, recover?: DraftStoredArtifact) {
    if (writesBlocked || pending) return;
    await run(async () => {
      const key = binding, attempt = ++epoch.current; onBusy(true); setRaw(null); setError(null);
      try {
        const upload = await prepareDraftUpload(session.user.id, session.clientId, buffer.draftId!, recover?.expectedVersion ?? buffer.version, file);
        if (recover) {
          if (upload.command.payload.bytes !== recover.ref.bytes || upload.command.payload.contentHash !== recover.ref.contentHash) throw new ApiError('ARTIFACT_BYTES_MISMATCH');
          upload.command = { ...upload.command, commandId: recover.commandId, payload: { bytes: recover.ref.bytes, contentHash: recover.ref.contentHash, mediaType: recover.ref.mediaType } };
          upload.attempted = true; upload.uncertain = recover.state !== 'FINALIZED';
        }
        if (!current(key, attempt)) return;
        onChange(previous => current(key, attempt) && previous.draftId === upload.draftId && (!!recover || previous.version === upload.command.expectedVersion) && !previous.upload && (!previous.ownerUserId || previous.ownerUserId === session.user.id) ? { ...previous, ownerUserId: session.user.id, upload } : previous);
      } catch (e) { if (current(key, attempt)) setError(e instanceof ApiError ? e : new ApiError('RESPONSE_INVALID')); }
      finally { if (mounted.current) onBusy(false); }
    });
  }
  async function send(upload: DraftUploadBuffer) {
    if (disabled || readonly || !metadataAllowed || upload.ownerUserId !== session.user.id || upload.command.clientId !== session.clientId || upload.draftId !== buffer.draftId || buffer.pendingAction || buffer.pendingCommand) return;
    await run(async () => {
      const key = binding, attempt = ++epoch.current; onBusy(true); setRaw(null); setError(null);
      onChange(previous => current(key, attempt) && previous.draftId === upload.draftId && previous.ownerUserId === upload.ownerUserId ? { ...previous, upload: { ...upload, attempted: true } } : previous);
      try {
        const receipt = await uploadDraftArtifact(client, session.csrfToken, upload);
        if (!current(key, attempt)) return;
        const record: DraftStoredArtifact = { commandId: receipt.commandId, expectedVersion: receipt.version, state: 'FINALIZED', ref: receipt.data.artifactRef, artifactState: receipt.data.status === 'ARTIFACT_READY' ? 'READY' : 'QUARANTINED', projectId: null };
        onMetadata(upload.draftId, [...(protectedRecords ?? []).filter(x => x.commandId !== receipt.commandId), record]);
        onChange(previous => current(key, attempt) && previous.upload?.command.commandId === upload.command.commandId && previous.ownerUserId === session.user.id && previous.draftId === upload.draftId ? {
          ...previous, upload: null, uploadHistory: [...(previous.uploadHistory ?? []).filter(x => x.command.commandId !== upload.command.commandId), { ...upload, receipt, attempted: true, uncertain: false }],
          storedArtifacts: [...(previous.storedArtifacts ?? []).filter(x => x.commandId !== receipt.commandId), record],
        } : previous);
      } catch (e) {
        if (!current(key, attempt)) return;
        const failure = e instanceof ApiError ? e : new ApiError('RESPONSE_INVALID'); setError(failure);
        onChange(previous => current(key, attempt) && previous.upload?.command.commandId === upload.command.commandId ? { ...previous, upload: { ...previous.upload, uncertain: upload.uncertain || upload.attempted || !isKnownDocumentRejection(failure) } } : previous);
        if ([401,403,404].includes(failure.status)) onMetadata(upload.draftId, null);
        if (failure.status === 401) onAuthenticationLost();
      } finally { if (mounted.current) onBusy(false); }
    });
  }
  async function view(record: DraftStoredArtifact) {
    if (!buffer.draftId || !metadataAllowed || record.artifactState !== 'READY') return;
    const key = binding, attempt = ++epoch.current; setRaw(null); setError(null);
    const target = record.projectId ?? (projectId && buffer.input.artifactRefs.some(r => r.artifactId === record.ref.artifactId) ? projectId : null);
    try { const bytes = await readDraftArtifactBytes(client, buffer.draftId, record.ref, target); if (current(key, attempt)) setRaw({ key, client, artifactId: record.ref.artifactId, bytes, mediaType: record.ref.mediaType }); }
    catch (e) { if (current(key, attempt)) { const failure = e instanceof ApiError ? e : new ApiError('RESPONSE_INVALID'); setError(failure); if ([401,403,404].includes(failure.status)) onMetadata(buffer.draftId, null); if (failure.status === 401) onAuthenticationLost(); } }
  }
  async function refreshMetadata() {
    if (!buffer.draftId || !own || disabled) return;
    const key=binding, attempt=++epoch.current; setRaw(null); setError(null);
    try { const result=await readProjectDraft(client,buffer.draftId); if(current(key,attempt)) onMetadata(result.draftId, result.storedArtifacts ?? [], result.editable === true); }
    catch(e) { if(current(key,attempt)){const failure=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(failure);onMetadata(buffer.draftId, null);if(failure.status===401)onAuthenticationLost();} }
  }
  function choose(record: DraftStoredArtifact, selected: boolean) {
    if (writesBlocked || pending || record.artifactState !== 'READY' || record.projectId) return;
    epoch.current++; setRaw(null);
    onChange(previous => previous.draftId !== buffer.draftId || previous.upload || previous.pendingAction || previous.pendingCommand ? previous : { ...previous, dirty: true, input: { ...previous.input, artifactRefs: selected ? [...previous.input.artifactRefs.filter(r => r.artifactId !== record.ref.artifactId), record.ref] : previous.input.artifactRefs.filter(r => r.artifactId !== record.ref.artifactId) } });
  }
  const visibleRaw = raw?.key === binding && raw.client === client && metadataAllowed ? raw : null;
  return <section aria-label="초안 원문 자료"><h3>원문 자료</h3>
    {!buffer.draftId ? <p>먼저 중간 저장으로 초안 ID를 만든 뒤 원문을 보관하세요.</p> : <p>보관 대상: 초안 {buffer.draftId} · 저장 버전 {buffer.version}</p>}
    {!metadataAllowed && buffer.draftId && own ? <p>현재 보호 자료 목록을 확인하기 전에는 이전 원문 참조와 명령 결과를 표시하지 않습니다.</p> : null}
    {buffer.draftId && own ? <button type="button" disabled={disabled} onClick={() => { void refreshMetadata(); }}>보호 자료 목록 다시 조회</button> : null}
    {!readonly ? <label>원문 파일 선택<input type="file" disabled={writesBlocked || !!pending} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void select(file); }} /></label> : null}
    {pending && metadataAllowed ? <section aria-label="전송할 원문"><p>{pending.filename} · {pending.command.payload.mediaType} · {pending.bytes.length} bytes</p><p>원 명령 {pending.command.commandId} · 대상 초안 버전 {pending.command.expectedVersion}</p>
      <button type="button" disabled={disabled || readonly || pending.command.clientId !== session.clientId} onClick={() => { void send(pending); }}>{pending.attempted ? '같은 업로드 명령 결과 확인' : '원문 업로드'}</button>
      {pending.uncertain ? <p role="alert">결과 미확인입니다. 원 바이트와 명령을 유지하며 자동 재전송하지 않습니다.</p> : null}
      {!pending.attempted || error && !pending.uncertain ? <button type="button" disabled={disabled} onClick={() => { if (confirm('이 탭의 업로드 입력만 분리할까요? 서버 자료와 명령 이력은 삭제하지 않습니다.')) onChange(previous => previous.upload?.command.commandId === pending.command.commandId ? { ...previous, upload: null, uploadHistory: [...(previous.uploadHistory ?? []), pending] } : previous); }}>이 업로드 입력 분리</button> : null}
    </section> : null}
    <p>업로드와 첨부 선택·중간 저장·프로젝트 생성은 각각 별도 동작입니다.</p>
    {records.length ? <ul>{records.map(record => <li key={record.commandId}>
      <label><input type="checkbox" checked={buffer.input.artifactRefs.some(r => r.artifactId === record.ref.artifactId)} disabled={writesBlocked || !!pending || record.state !== 'FINALIZED' || record.artifactState !== 'READY' || !!record.projectId} onChange={e => choose(record, e.target.checked)} />초안에 첨부할 자료 선택</label>
      <p>{record.ref.artifactId} · {record.ref.bytes} bytes · {record.ref.mediaType} · SHA256 {record.ref.contentHash}</p><p>{record.artifactState === 'QUARANTINED' ? '격리 보관 · 읽기/첨부 불가' : record.state === 'FINALIZED' ? '원문 보관 완료' : `${record.state} · 복구 확인 필요`}</p>
      {!readonly && !pending && record.state !== 'REJECTED' ? <label>원 명령에 같은 원문 다시 결박<input type="file" disabled={writesBlocked} onChange={e => { const file=e.target.files?.[0];e.target.value='';if(file)void select(file,record); }} /></label> : null}
      <button type="button" disabled={disabled || record.artifactState !== 'READY'} onClick={() => { void view(record); }}>보호 원문 확인</button>
      {!readonly && !pending && buffer.uploadHistory?.find(x => x.command.commandId === record.commandId && x.receipt) ? <button type="button" disabled={disabled} onClick={() => { const original = buffer.uploadHistory?.find(x => x.command.commandId === record.commandId); if (original) void send(original); }}>같은 완료 업로드 재확인</button> : null}
    </li>)}</ul> : metadataAllowed ? <p>조회한 보관 자료가 없습니다.</p> : null}
    {error ? <p role="alert">원문 처리 거절 또는 미확인: {error.code}</p> : null}
    {visibleRaw ? <section aria-label="보호된 원문"><h4>원문 {visibleRaw.artifactId}</h4>{['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(visibleRaw.mediaType) ? <pre>{new TextDecoder().decode(visibleRaw.bytes)}</pre> : <p>이 형식은 실행하거나 화면 안에 삽입하지 않습니다.</p>}<button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([visibleRaw.bytes], { type: 'application/octet-stream' })); const a = document.createElement('a'); a.href = url; a.download = `artifact-${visibleRaw.artifactId}.bin`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }}>검증한 원문 내려받기</button></section> : null}
  </section>;
}

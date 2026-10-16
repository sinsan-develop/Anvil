import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { continueDocumentSave, prepareDocumentSave, type DocumentBuffer, type DocumentSession } from './editor-api.ts';
import { adoptDocumentConflict, canCompareDocumentConflict, compareDocumentConflict, type DocumentConflictComparison } from './conflict-api.ts';
import { DocumentImport } from './DocumentImport.tsx';
import { applyDocumentProposal, compareDocumentProposal, continueDocumentProposal, prepareDocumentProposal, prepareProposalApplication, type DocumentProposalBuffer } from './proposal-api.ts';

export function DocumentEditor({ client, session, buffer, onChange, onSaved, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; buffer: DocumentBuffer; onChange: Dispatch<SetStateAction<DocumentBuffer | null>>; onSaved: (id: string, version: number, title: string) => void; onAuthenticationLost: () => void }) {
  const [busy, setBusy] = useState(false), running = useRef(false), mounted = useRef(true);
  const [comparison, setComparison] = useState<DocumentConflictComparison | null>(null), [acknowledged, setAcknowledged] = useState(false), [comparisonError, setComparisonError] = useState<ApiError | null>(null);
  const [proposalAcknowledged, setProposalAcknowledged] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = busy || !!buffer.pending || !!buffer.importState || !!buffer.importPreparationId || !!buffer.proposalState;
  function change(patch: Partial<DocumentBuffer>) { if (!locked) onChange(previous => previous?.ownerUserId === session.user.id && previous.projectId === buffer.projectId && previous.documentId === buffer.documentId ? { ...previous, ...patch, dirty: true, savedRef: null, failure: null } : previous); }
  async function save() {
    if (running.current || buffer.proposalState || buffer.importState || buffer.importPreparationId || buffer.ownerUserId !== session.user.id) return;
    running.current = true; setBusy(true);
    let pending = buffer.pending;
    try {
      if (!pending) { pending = await prepareDocumentSave(buffer, session); const prepared = pending; onChange(previous => previous?.ownerUserId === session.user.id && previous.documentId === buffer.documentId && previous.projectId === buffer.projectId && !previous.importState && !previous.importPreparationId ? { ...previous, pending: prepared, failure: null } : previous); }
      const command = pending.upload.commandId;
      const ref = await continueDocumentSave(client, pending, session, value => onChange(previous => previous?.pending?.upload.commandId === command ? { ...previous, pending: value } : previous), () => mounted.current);
      onChange(previous => previous?.pending?.upload.commandId === command ? { ...previous, documentId: ref.id, baseVersion: ref.version, baseHash: ref.contentHash, baseTitle: buffer.title, pending: null, dirty: false, savedRef: ref, failure: null } : previous);
      if (mounted.current) onSaved(ref.id, ref.version, buffer.title);
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      onChange(previous => previous?.ownerUserId === session.user.id && previous.projectId === buffer.projectId && previous.documentId === buffer.documentId ? { ...previous, failure: { code: error.code, status: error.status } } : previous);
      if (mounted.current && error.status === 401) onAuthenticationLost();
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function compare() {
    if (running.current) return; running.current = true; setBusy(true); setComparison(null); setAcknowledged(false); setComparisonError(null);
    try { const value = await compareDocumentConflict(client, buffer, session); if (mounted.current) setComparison(value); }
    catch (cause) { if (mounted.current) { const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setComparisonError(error); if (error.status === 401) onAuthenticationLost(); } }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  function adopt() {
    if (!comparison || busy) return;
    try { const next = adoptDocumentConflict(buffer, comparison, session, acknowledged); onChange(previous => previous?.pending?.saveCommandId === comparison.rejectedCommandId && canCompareDocumentConflict(previous) ? next : previous); setComparison(null); setAcknowledged(false); }
    catch (cause) { setComparisonError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
  }
  function proposalCheckpoint(value: DocumentProposalBuffer) { onChange(b => b?.ownerUserId === session.user.id && b.projectId === buffer.projectId && b.proposalState?.snapshot.upload.commandId === value.snapshot.upload.commandId && !b.pending && !b.importState && !b.importPreparationId ? { ...b, proposalState: value } : b); }
  function proposalFailure(cause: unknown, mutation = true) {
    const e = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
    onChange(b => b?.ownerUserId === session.user.id && b.projectId === buffer.projectId && b.documentId === buffer.documentId ? { ...b, ...(b.proposalState ? { proposalState: { ...b.proposalState, uncertain: b.proposalState.uncertain || mutation && (e.code === 'RESPONSE_INVALID' || e.status >= 500 || e.status === 0 && e.code !== 'SAVE_CONTINUATION_PAUSED'), failure: { code: e.code, status: e.status } } } : { failure: { code: e.code, status: e.status } }) } : b);
    if (mounted.current && e.status === 401) onAuthenticationLost();
  }
  async function propose() {
    if (running.current || buffer.pending || buffer.importState || buffer.importPreparationId || buffer.ownerUserId !== session.user.id || buffer.proposalState?.proposal) return;
    running.current = true; setBusy(true); setProposalAcknowledged(false);
    try {
      let state = buffer.proposalState;
      if (!state) { state = await prepareDocumentProposal(buffer, session); const prepared = state; onChange(b => b?.ownerUserId === session.user.id && b.projectId === buffer.projectId && b.documentId === buffer.documentId && b.baseVersion === buffer.baseVersion && !b.pending && !b.importState && !b.importPreparationId && !b.proposalState ? { ...b, proposalState: prepared } : b); }
      state = { ...state, failure: null }; proposalCheckpoint(state);
      proposalCheckpoint(await continueDocumentProposal(client, state, session, proposalCheckpoint, () => mounted.current));
    } catch (cause) { proposalFailure(cause); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function compareProposal() {
    const state = buffer.proposalState; if (!state?.proposal || running.current) return;
    running.current = true; setBusy(true); setProposalAcknowledged(false);
    try { const value = await compareDocumentProposal(client, state, session); proposalCheckpoint({ ...state, comparison: value, failure: null }); }
    catch (cause) { proposalFailure(cause, false); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function applyProposal() {
    let state = buffer.proposalState; if (!state?.comparison || running.current || state.savedRef || !state.applyCommand && !proposalAcknowledged) return;
    running.current = true; setBusy(true);
    try {
      if (!state.applyCommand) state = { ...state, applyCommand: await prepareProposalApplication(client, state, session, proposalAcknowledged), failure: null };
      else state = { ...state, failure: null };
      proposalCheckpoint(state);
      const ref = await applyDocumentProposal(client, state, session, () => mounted.current), completed = { ...state, savedRef: ref, uncertain: false, failure: null }, content = state.comparison!.proposal.proposedContent;
      onChange(b => b?.proposalState?.snapshot.upload.commandId === completed.snapshot.upload.commandId ? { ...b, proposalState: completed, baseVersion: ref.version, baseHash: ref.contentHash, baseTitle: state!.comparison!.base.document.title, body: state!.comparison!.proposedBody, mediaType: content.body.mediaType, content: { attachments: structuredClone(content.attachments), sections: structuredClone(content.sections), sourceRefs: [] }, dirty: false, savedRef: ref } : b);
      if (mounted.current) onSaved(ref.id, ref.version, buffer.title);
    } catch (cause) { proposalFailure(cause); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  const proposal = buffer.proposalState, proposalCanClose = proposal && !proposal.uncertain && (proposal.savedRef || !proposal.applyCommand && proposal.proposal || proposal.failure && [400,401,403,404,409,412,413,415,422].includes(proposal.failure.status));
  return <section className="status-card definition-editor" aria-label="문서 초안 편집">
    <h2>문서 초안 편집</h2><p className="meta">기준 버전 {buffer.baseVersion} · 원본/구버전은 보존됩니다. 이 저장은 사용자 확정이나 Agent 실행이 아닙니다.</p>
    {buffer.documentId === null && !buffer.importCandidateRef ? <DocumentImport client={client} session={session} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost} disabled={busy} /> : null}
    {buffer.importCandidateRef ? <p className="meta">가져오기 후보 {buffer.importCandidateRef} · 원본을 첨부로 보존합니다. 아직 별도 저장/확정 전이면 다음 동작을 직접 선택하세요.</p> : null}
    {buffer.savedRef ? <p role="status">초안 버전 {buffer.savedRef.version} 저장 확인</p> : null}
    {buffer.failure ? <p role="alert">{new ApiError(buffer.failure.code, buffer.failure.status).message} · {buffer.failure.code} · 입력과 기존 명령을 보존했습니다.</p> : null}
    {buffer.pending ? <p>저장 결과 확인 전에는 입력을 바꾸거나 새 명령을 만들지 않습니다. 자동 재전송하지 않습니다.</p> : null}
    {proposal ? <section className="status-card" aria-label="문서 수정 제안"><h3>별도 수정 제안</h3><p>이 기록만으로 현재 문서나 확정본은 바뀌지 않습니다.</p>
      {proposal.failure ? <p role="alert">{proposal.failure.code} · 입력과 같은 명령을 보존했습니다.</p> : null}
      {!proposal.proposal ? <button disabled={busy} onClick={() => { void propose(); }}>같은 제안 명령 결과 확인</button> : <><p role="status">수정 제안 저장 확인 · {proposal.proposal.id}</p><button disabled={busy || !!proposal.applyCommand} onClick={() => { void compareProposal(); }}>제안 차이 비교</button></>}
      {proposal.comparison ? <><p>기준 버전 {proposal.baseRef.version} · 변경 시작 줄 {proposal.comparison.diff.startLine}</p><pre className="document-original" aria-label="제안 기준 원문">{proposal.comparison.base.body}</pre><pre className="document-original" aria-label="제안 새 원문">{proposal.comparison.proposedBody}</pre><pre aria-label="서버 생성 변경 구간">{JSON.stringify(proposal.comparison.diff, null, 2)}</pre><pre aria-label="제안 첨부와 항목 비교">{JSON.stringify({ before: { attachments: proposal.comparison.base.document.content.attachments, sections: proposal.comparison.base.document.content.sections }, after: { attachments: proposal.comparison.proposal.proposedContent.attachments, sections: proposal.comparison.proposal.proposedContent.sections } }, null, 2)}</pre>
        {!proposal.savedRef ? <><label><input type="checkbox" disabled={busy || !!proposal.applyCommand} checked={proposalAcknowledged} onChange={e => setProposalAcknowledged(e.target.checked)} />원문·첨부·항목 차이를 확인했고 이 제안을 새 초안으로 반영하겠습니다</label><button disabled={busy || !proposal.applyCommand && !proposalAcknowledged || !!proposal.comparison.proposal.selections.length} onClick={() => { void applyProposal(); }}>{proposal.applyCommand ? '같은 제안 반영 명령 결과 확인' : '이 제안으로 새 초안 저장'}</button></> : <p role="status">제안 반영 버전 {proposal.savedRef.version} 저장 확인 · 별도 확정 전</p>}
      </> : null}
      {proposalCanClose ? <button disabled={busy} onClick={() => onChange(b => b?.proposalState?.snapshot.upload.commandId === proposal.snapshot.upload.commandId ? { ...b, proposalState: null } : b)}>제안 작업 닫기</button> : null}
    </section> : null}
    {buffer.reconciliation ? <p className="meta">충돌 비교 후 기준 {buffer.reconciliation.fromVersion}→{buffer.reconciliation.toVersion} · 이전 거절 명령 {buffer.reconciliation.rejectedCommandId} · 아직 새 초안 저장 전이면 별도로 저장하세요.</p> : null}
    {canCompareDocumentConflict(buffer) ? <button disabled={busy} onClick={() => { void compare(); }}>최신 버전과 비교</button> : null}
    {comparisonError ? <p role="alert">{comparisonError.message} · {comparisonError.code} · 기존 입력과 명령을 유지했습니다.</p> : null}
    {comparison ? <section className="status-card" aria-label="문서 버전 충돌 비교"><h3>기준 {comparison.baseVersion} → 서버 {comparison.latest.document.version}</h3><p>내 제목·본문·항목 위치로 새 초안을 준비합니다. 서버 최신본은 구버전으로 보존되며 자동 합치기/저장은 하지 않습니다.</p><p>서버 제목: {comparison.latest.document.title} · 내 제목: {buffer.title}</p><pre aria-label="서버 최신 원문" className="document-original">{comparison.latest.body}</pre><pre aria-label="내 미저장 원문" className="document-original">{buffer.body}</pre>
      {!comparison.compatible ? <p role="alert">양식·첨부·원문 형식 또는 연결 자료가 달라 수동 조정이 필요합니다. 자동 채택하지 않습니다.</p> : null}
      <label><input type="checkbox" disabled={busy || !comparison.compatible} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />양쪽 내용을 비교했고 내 입력을 새 초안으로 저장하겠습니다</label><button disabled={busy || !comparison.compatible || !acknowledged} onClick={adopt}>내 입력으로 새 기준 초안 준비</button>
    </section> : null}
    <label>문서 제목<input value={buffer.title} maxLength={200} readOnly={locked} onChange={event => change({ title: event.target.value })} /></label>
    <label htmlFor={'document-body-' + buffer.documentId}>문서 본문 편집</label><textarea id={'document-body-' + buffer.documentId} value={buffer.body} rows={14} readOnly={locked} onChange={event => change({ body: event.target.value })} />
    <fieldset disabled={locked}><legend>양식 항목의 원문 위치</legend>{buffer.criteria.map(item => <label key={item.criterionId}>{item.title} 시작 줄<input type="number" min="1" value={buffer.content.sections.find(section => section.itemId === item.criterionId)?.anchor.slice(5) ?? ''} onChange={event => { const kept = buffer.content.sections.filter(section => section.itemId !== item.criterionId); change({ content: { ...buffer.content, sections: event.target.value ? [...kept, { itemId: item.criterionId, anchor: 'line:' + event.target.value }] : kept } }); }} /></label>)}</fieldset>
    <label htmlFor={'document-reason-' + buffer.documentId}>문서 변경 이유</label><textarea id={'document-reason-' + buffer.documentId} value={buffer.reason} rows={2} maxLength={20_000} readOnly={locked} onChange={event => change({ reason: event.target.value })} />
    <div className="project-toolbar"><button disabled={busy || !!buffer.proposalState || !!buffer.importState || !!buffer.importPreparationId || !buffer.pending && (!buffer.dirty || !buffer.title.trim() || !buffer.reason.trim())} onClick={() => { void save(); }}>{buffer.pending ? '같은 저장 명령 결과 확인' : '새 초안 버전 저장'}</button>
      {buffer.documentId && !proposal ? <button disabled={locked || !buffer.dirty || !buffer.reason.trim() || buffer.title !== buffer.baseTitle} onClick={() => { void propose(); }}>수정 제안으로 저장</button> : null}
      <button disabled={locked} onClick={() => { if (!buffer.dirty || confirm('이 문서의 미저장 편집 입력을 버릴까요?')) onChange(previous => previous === buffer ? null : previous); }}>편집 닫기</button></div>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listForms, type FormSummary } from '../methodologies/forms-api.ts';
import type { DocumentBuffer, DocumentSession } from './editor-api.ts';
import { listDocumentMaterials, prepareStoredImport, readStoredImport, type ImportSummary, type MaterialPage, type ProposalSummary, type StoredImportView } from './materials-api.ts';
import { readStoredProposal, resumeStoredProposal, type ProposalComparison } from './proposal-api.ts';

export function MaterialLibrary({ client, projectId, session, canPrepare, onPrepared, onBusy, onAuthenticationLost }: { client: ApiClient; projectId: string; session: DocumentSession; canPrepare: boolean; onPrepared: (buffer: DocumentBuffer) => void; onBusy: (busy: boolean) => void; onAuthenticationLost: () => void }) {
  const [imports, setImports] = useState<MaterialPage<ImportSummary> | null>(null), [proposals, setProposals] = useState<MaterialPage<ProposalSummary> | null>(null);
  const [importStatus, setImportStatus] = useState(''), [proposalStatus, setProposalStatus] = useState(''), [importCursor, setImportCursor] = useState<string | null>(null), [proposalCursor, setProposalCursor] = useState<string | null>(null), [reload, setReload] = useState(0);
  const [importLoading, setImportLoading] = useState(true), [proposalLoading, setProposalLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<ApiError | null>(null);
  const [importView, setImportView] = useState<StoredImportView | null>(null), [proposalView, setProposalView] = useState<ProposalComparison | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const [forms, setForms] = useState<FormSummary[]>([]), [selectedForm, setSelectedForm] = useState('');
  const mounted = useRef(true), running = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function failed(cause: unknown) { if (!mounted.current) return; const e = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(e); if ([401,403,404].includes(e.status)) { setImportView(null); setProposalView(null); setImports(null); setProposals(null); if (e.status === 401) onAuthenticationLost(); } }
  useEffect(() => {
    let current = true; setImportLoading(true);
    listDocumentMaterials(client,projectId,'imports',importCursor,importStatus).then(value => { if (current) setImports(old => importCursor && old ? { ...value, items: [...new Map([...old.items,...value.items].map(v => [v.id,v])).values()] } : value); }).catch(e => { if (current) failed(e); }).finally(() => { if (current) setImportLoading(false); });
    return () => { current = false; };
  }, [client,projectId,importCursor,importStatus,reload]);
  useEffect(() => {
    let current = true; setProposalLoading(true);
    listDocumentMaterials(client,projectId,'proposals',proposalCursor,proposalStatus).then(value => { if (current) setProposals(old => proposalCursor && old ? { ...value, items: [...new Map([...old.items,...value.items].map(v => [v.id,v])).values()] } : value); }).catch(e => { if (current) failed(e); }).finally(() => { if (current) setProposalLoading(false); });
    return () => { current = false; };
  }, [client,projectId,proposalCursor,proposalStatus,reload]);
  async function open(kind: 'IMPORT' | 'PROPOSAL', id: string) {
    if (running.current) return; running.current = true; setBusy(true); setError(null); setAcknowledged(false); setImportView(null); setProposalView(null); setForms([]); setSelectedForm('');
    try {
      if (kind === 'IMPORT') { const view = await readStoredImport(client,projectId,id); const options = view.candidate.intendedFormRef === null && view.candidate.status === 'READY' ? (await listForms(client)).items : []; if (mounted.current) { setImportView(view); setForms(options); } }
      else { const view = await readStoredProposal(client,projectId,id); if (mounted.current) setProposalView(view); }
    } catch (e) { failed(e); } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function prepare(kind: 'IMPORT' | 'PROPOSAL') {
    if (!canPrepare || !acknowledged || running.current) return;
    running.current = true; setBusy(true); onBusy(true); setError(null);
    try {
      let value: DocumentBuffer;
      if (kind === 'IMPORT' && importView) value = await prepareStoredImport(client,projectId,importView,session,forms.find(f => f.ref.id === selectedForm)?.ref ?? null);
      else if (kind === 'PROPOSAL' && proposalView && !proposalView.proposal.selections.length) value = await resumeStoredProposal(client,projectId,proposalView.proposal.id,session);
      else throw new ApiError('MATERIAL_SELECTION_REQUIRED');
      if (mounted.current) onPrepared(value);
    } catch (e) { failed(e); } finally { running.current = false; onBusy(false); if (mounted.current) setBusy(false); }
  }
  return <section className="status-card" aria-label="보관한 후보·제안"><h2>보관한 후보·제안</h2><p className="meta">목록은 저장 당시 상태입니다. 원문을 열 때 파일을 다시 확인하며, 보기만 해서는 문서를 변경하지 않습니다.</p>
    <button disabled={busy || importLoading || proposalLoading} onClick={() => { setError(null); setImportCursor(null); setProposalCursor(null); setReload(n => n + 1); }}>보관 자료 새로고침</button>
    {error ? <p role="alert">{error.message} · {error.code}</p> : null}
    <label htmlFor="stored-import-status">보관 후보 상태</label><select id="stored-import-status" disabled={busy} value={importStatus} onChange={e => { setImports(null); setImportCursor(null); setImportStatus(e.target.value); }}><option value="">모두</option><option value="READY">본문 확인 가능</option><option value="UNSUPPORTED">형식 미지원</option><option value="FAILED">본문 확인 실패</option></select>
    {importLoading ? <p role="status">후보 조회 중</p> : null}<ul>{imports?.items.map(v => <li key={v.id}><button disabled={busy} aria-label={`가져오기 후보 ${v.id} 열기`} onClick={() => { void open('IMPORT',v.id); }}>가져온 원본 · {v.status} · {new Date(v.createdAt).toLocaleString('ko-KR')}</button></li>)}</ul>{imports && !importLoading && !imports.items.length ? <p>보관한 후보가 없습니다.</p> : null}{imports?.hasMore ? <button disabled={busy || importLoading} onClick={() => setImportCursor(imports.nextCursor)}>다음 후보 더 보기</button> : null}
    <label htmlFor="stored-proposal-status">보관 제안 상태</label><select id="stored-proposal-status" disabled={busy} value={proposalStatus} onChange={e => { setProposals(null); setProposalCursor(null); setProposalStatus(e.target.value); }}><option value="">모두</option><option value="PENDING">미반영</option><option value="SELECTED">반영됨</option></select>
    {proposalLoading ? <p role="status">제안 조회 중</p> : null}<ul>{proposals?.items.map(v => <li key={v.id}><button disabled={busy} aria-label={`보관 제안 ${v.id} 열기`} onClick={() => { void open('PROPOSAL',v.id); }}>{v.title} · 기준 {v.baseRef.version} · {v.status === 'SELECTED' ? '반영됨' : '미반영'}</button></li>)}</ul>{proposals && !proposalLoading && !proposals.items.length ? <p>보관한 제안이 없습니다.</p> : null}{proposals?.hasMore ? <button disabled={busy || proposalLoading} onClick={() => setProposalCursor(proposals.nextCursor)}>다음 제안 더 보기</button> : null}
    {!canPrepare ? <p>기존 편집·검토·확정 작업을 먼저 닫으면 이 자료로 새 작업을 준비할 수 있습니다. 조회는 계속 가능합니다.</p> : null}
    {importView ? <section aria-label="보관 후보 원문 확인"><h3>가져오기 후보 {importView.candidate.status}</h3><p>원본 SHA256 {importView.candidate.originalRef.contentHash}</p><a href={`/api/v1/projects/${projectId}/files/${importView.candidate.originalRef.artifactId}`} download>보관한 원본 다운로드</a>{importView.candidate.issues.map((i,n) => <p key={n}>{i.code} · {i.message}</p>)}
      {importView.body !== null ? <><pre className="document-original" aria-label="보관 후보 원문">{importView.body}</pre>{!importView.candidate.intendedFormRef ? <><label htmlFor="stored-import-form">보관 후보 적용 양식</label><select id="stored-import-form" disabled={busy} value={selectedForm} onChange={e => setSelectedForm(e.target.value)}><option value="">양식 선택</option>{forms.map(f => <option value={f.ref.id} key={f.ref.id}>{f.name} · v{f.ref.version}</option>)}</select></> : <p>가져올 때 지정한 양식 v{importView.candidate.intendedFormRef.version}을 유지합니다.</p>}<label><input type="checkbox" disabled={busy || !canPrepare} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />보관 원문을 확인했고 새 문서 초안으로 준비하겠습니다</label><button disabled={busy || !canPrepare || !acknowledged || !importView.candidate.intendedFormRef && !selectedForm} onClick={() => { void prepare('IMPORT'); }}>보관 후보로 새 문서 준비</button></> : <p>미지원/확인 실패 원본은 보존하지만 본문으로 반영하지 않습니다.</p>}
    </section> : null}
    {proposalView ? <section aria-label="보관 제안 원문 비교"><h3>{proposalView.base.document.title} · 기준 {proposalView.proposal.baseRef.version}</h3><pre className="document-original" aria-label="보관 제안 기준 원문">{proposalView.base.body}</pre><pre className="document-original" aria-label="보관 제안 새 원문">{proposalView.proposedBody}</pre><pre aria-label="보관 제안 변경 구간">{JSON.stringify(proposalView.diff,null,2)}</pre><p>{proposalView.proposal.selections.length ? `이미 반영한 버전 ${proposalView.proposal.selections[0]!.version}` : '아직 반영하지 않은 제안입니다. 실제 반영 시 현재 기준을 다시 검사합니다.'}</p>
      {!proposalView.proposal.selections.length ? <><label><input type="checkbox" disabled={busy || !canPrepare} checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />보관 제안의 차이를 확인했고 반영 작업을 열겠습니다</label><button disabled={busy || !canPrepare || !acknowledged} onClick={() => { void prepare('PROPOSAL'); }}>보관 제안 반영 작업 열기</button></> : null}
    </section> : null}
  </section>;
}

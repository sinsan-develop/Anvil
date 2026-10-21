import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getForm, listForms, type FormSummary } from '../methodologies/forms-api.ts';
import { documentControl, newDocument, type DocumentBuffer, type DocumentSession } from './editor-api.ts';
import { PinnedFormOriginal } from '../methodologies/PinnedFormOriginal.tsx';
import {NewStageDocumentForm} from './NewStageDocumentForm.tsx';
import {prepareFormDocumentOutline} from './form-document-outline.ts';

export function NewDocumentForm({ client, session, projectId, onPrepared, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; projectId: string; onPrepared: (value: DocumentBuffer) => void; onAuthenticationLost: () => void }) {
  const [forms, setForms] = useState<FormSummary[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [reload, setReload] = useState(0);
  const mounted = useRef(true), preparing = useRef(false);
  const [byStage,setByStage]=useState(false);
  const selectedForm = !loading && !pending && !error ? forms.find(item => item.ref.id === selected) : undefined;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    listForms(client).then(value => { if (current) { setForms(value.items); setSelected(''); } }).catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, reload]);
  async function prepare(outline=false) {
    const summary = forms.find(item => item.ref.id === selected);
    if (!summary || preparing.current) return;
    preparing.current = true; setPending(true); setError(null);
    try {
      if(outline){const value=await prepareFormDocumentOutline(client,projectId,summary.ref,session,()=>mounted.current);if(mounted.current&&value)onPrepared(value);return;}
      const [form, control] = await Promise.all([getForm(client, summary), documentControl(client, projectId, session)]);
      if (mounted.current) onPrepared(newDocument(projectId, form, session.user.id, control));
    } catch (cause) { if (mounted.current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); } }
    finally { preparing.current = false; if (mounted.current) setPending(false); }
  }
  if(byStage)return <NewStageDocumentForm key={JSON.stringify([projectId,session.user.id,session.clientId])} client={client} projectId={projectId} session={session} onPrepared={onPrepared} onBack={()=>setByStage(false)} onAuthenticationLost={onAuthenticationLost}/>;
  return <section className="status-card" aria-label="새 문서 양식 선택"><h2>새 문서 작성</h2><p>양식의 정확 버전을 선택해 빈 초안을 엽니다. 예시 본문을 실제 작성 결과로 넣지 않으며, 명시 저장 전 서버 문서는 만들지 않습니다.</p><button type="button" disabled={pending} onClick={()=>setByStage(true)}>방법론 단계에서 산출문서 작성</button>
    {loading ? <p role="status">양식 조회 중</p> : null}{error ? <p role="alert">{error.message} · {error.code}</p> : null}
    <label htmlFor="new-document-form">새 문서 양식</label><select id="new-document-form" value={selected} disabled={loading || pending} onChange={event => setSelected(event.target.value)}><option value="">양식 선택</option>{forms.map(form => <option key={form.ref.id} value={form.ref.id}>{form.name} · v{form.ref.version}</option>)}</select>
    {selectedForm ? <PinnedFormOriginal key={JSON.stringify([session.user.id, session.clientId, projectId, selectedForm.ref])} client={client} formRef={selectedForm.ref} onAuthenticationLost={onAuthenticationLost} /> : null}
    <button disabled={loading || pending || !selected || !!error} onClick={() => { void prepare(); }}>선택 양식으로 작성</button><button disabled={loading||pending||!selected||!!error} onClick={()=>{void prepare(true);}}>선택 양식의 빈 작성틀로 준비</button><p className="meta">작성틀은 항목 제목·빈 반복표·시작 줄만 채웁니다. 본문 내용·검토 결과를 만들지 않으며 이유를 작성한 뒤 별도로 저장하세요.</p>{error ? <button disabled={pending} onClick={() => setReload(value => value + 1)}>양식 다시 조회</button> : null}
  </section>;
}

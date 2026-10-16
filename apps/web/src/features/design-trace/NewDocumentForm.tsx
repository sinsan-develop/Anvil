import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getForm, listForms, type FormSummary } from '../methodologies/forms-api.ts';
import { documentControl, newDocument, type DocumentBuffer, type DocumentSession } from './editor-api.ts';

export function NewDocumentForm({ client, session, projectId, onPrepared, onAuthenticationLost }: { client: ApiClient; session: DocumentSession; projectId: string; onPrepared: (value: DocumentBuffer) => void; onAuthenticationLost: () => void }) {
  const [forms, setForms] = useState<FormSummary[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [reload, setReload] = useState(0);
  const mounted = useRef(true), preparing = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true; setLoading(true); setError(null);
    listForms(client).then(value => { if (current) { setForms(value.items); setSelected(''); } }).catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, reload]);
  async function prepare() {
    const summary = forms.find(item => item.ref.id === selected);
    if (!summary || preparing.current) return;
    preparing.current = true; setPending(true); setError(null);
    try {
      const [form, control] = await Promise.all([getForm(client, summary), documentControl(client, projectId, session)]);
      if (mounted.current) onPrepared(newDocument(projectId, form, session.user.id, control));
    } catch (cause) { if (mounted.current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); } }
    finally { preparing.current = false; if (mounted.current) setPending(false); }
  }
  return <section className="status-card" aria-label="새 문서 양식 선택"><h2>새 문서 작성</h2><p>양식의 정확 버전을 선택해 빈 초안을 엽니다. 예시 본문을 실제 작성 결과로 넣지 않으며, 명시 저장 전 서버 문서는 만들지 않습니다.</p>
    {loading ? <p role="status">양식 조회 중</p> : null}{error ? <p role="alert">{error.message} · {error.code}</p> : null}
    <label htmlFor="new-document-form">새 문서 양식</label><select id="new-document-form" value={selected} disabled={loading || pending} onChange={event => setSelected(event.target.value)}><option value="">양식 선택</option>{forms.map(form => <option key={form.ref.id} value={form.ref.id}>{form.name} · v{form.ref.version}</option>)}</select>
    <button disabled={loading || pending || !selected || !!error} onClick={() => { void prepare(); }}>선택 양식으로 작성</button>{error ? <button disabled={pending} onClick={() => setReload(value => value + 1)}>양식 다시 조회</button> : null}
  </section>;
}

import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { readProjectDraft, writeProjectDraft, type DraftEditorState, type PendingDraftCommand } from './api.ts';

export function ProjectCreatePage({ client, session, buffer, onChange, onAuthenticationLost }: { client: ApiClient; session: { clientId: string; csrfToken: string }; buffer: DraftEditorState; onChange: Dispatch<SetStateAction<DraftEditorState>>; onAuthenticationLost: () => void }) {
  const fieldId = useId();
  const [requestedId, setRequestedId] = useState(() => new URLSearchParams(location.search).get('draftId'));
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const [editable, setEditable] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!requestedId) return;
    let current = true;
    setPending(true);
    readProjectDraft(client, requestedId).then(result => {
      if (!current) return;
      setEditable(result.editable === true);
      onChange(previous => previous.dirty || previous.pendingCommand ? previous : { input: result.input, draftId: result.draftId, version: result.version, dirty: false, pendingCommand: null });
    }).catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); setEditable(false); } })
      .finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, session.clientId, requestedId, reload]);
  async function save() {
    if (pending || !editable) return;
    const fingerprint = JSON.stringify({ draftId: buffer.draftId, version: buffer.version, input: buffer.input });
    if (buffer.pendingCommand && buffer.pendingCommand.fingerprint !== fingerprint) { setError(new ApiError('DRAFT_RECONCILIATION_REQUIRED')); return; }
    const command: PendingDraftCommand = buffer.pendingCommand ?? {
      draftId: buffer.draftId, fingerprint,
      body: buffer.draftId
        ? { schemaVersion: 1, commandId: crypto.randomUUID(), clientId: session.clientId, expectedVersion: buffer.version, step: 1, input: buffer.input }
        : { schemaVersion: 1, commandId: crypto.randomUUID(), clientId: session.clientId, expectedVersion: 0, targetId: null, ...buffer.input },
    };
    onChange(previous => ({ ...previous, pendingCommand: command }));
    setPending(true); setError(null);
    try {
      const result = await writeProjectDraft(client, command.draftId, command.body, session.csrfToken);
      if (command.draftId && result.draftId !== command.draftId || result.version !== Number(command.body.expectedVersion) + 1) throw new ApiError('RESPONSE_INVALID');
      onChange(previous => previous.pendingCommand?.body.commandId === command.body.commandId ? { input: result.input, draftId: result.draftId, version: result.version, dirty: false, pendingCommand: null } : previous);
      if (location.hash === '#/projects/new') { const url = new URL(location.href); url.searchParams.set('draftId', result.draftId); history.replaceState(history.state, '', url); }
    } catch (cause: unknown) {
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      setError(failure);
      if (failure.status >= 400 && failure.status < 500 && failure.code !== 'RESPONSE_INVALID') onChange(previous => ({ ...previous, pendingCommand: null }));
      if (failure.status === 403) setEditable(false);
      if (failure.status === 401) onAuthenticationLost();
    } finally { setPending(false); }
  }
  function change(field: 'name' | 'purpose' | 'desiredOutcome', value: string) { onChange(previous => ({ ...previous, input: { ...previous.input, [field]: value }, dirty: true })); }
  function restore() {
    if (!buffer.draftId || pending) return;
    if ((buffer.dirty || buffer.pendingCommand) && !confirm('현재 미저장 입력을 서버 저장본으로 바꿀까요?')) return;
    onChange(previous => ({ ...previous, dirty: false, pendingCommand: null }));
    setRequestedId(buffer.draftId); setReload(value => value + 1); setError(null);
  }
  return <section className="status-card auth-form create-draft-form" aria-label="프로젝트 생성 중간본">
    <ol className="wizard-steps"><li aria-current="step">목적·소스</li><li>방법론·자료 — 연결 전</li><li>총괄·환경 — 연결 전</li><li>시작 기준 — 연결 전</li></ol>
    <h2>목적·소스</h2>
    <p>중간 저장은 프로젝트 생성이나 Agent 실행이 아닙니다. 현재는 빈 소스의 목적 초안만 저장합니다.</p>
    {error ? <p role="alert">{error.message}{buffer.pendingCommand ? ' 자동으로 새 명령을 발행하지 않습니다. 같은 저장 요청의 결과를 다시 확인하세요.' : ''}</p> : null}
    {!editable ? <p role="alert">이 초안의 현재 작업 기기/로그인 소유를 확인할 수 없어 변경할 수 없습니다. 입력은 유지합니다.</p> : null}
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor={fieldId + '-name'}>프로젝트 이름</label><input id={fieldId + '-name'} value={buffer.input.name} readOnly={!editable || !!buffer.pendingCommand} disabled={pending} onChange={event => change('name', event.target.value)} />
      <label htmlFor={fieldId + '-purpose'}>왜 만드는가</label><textarea id={fieldId + '-purpose'} value={buffer.input.purpose} readOnly={!editable || !!buffer.pendingCommand} disabled={pending} onChange={event => change('purpose', event.target.value)} rows={4} />
      <label htmlFor={fieldId + '-outcome'}>기대 결과</label><textarea id={fieldId + '-outcome'} value={buffer.input.desiredOutcome} readOnly={!editable || !!buffer.pendingCommand} disabled={pending} onChange={event => change('desiredOutcome', event.target.value)} rows={3} />
      <p>소스: 새 빈 프로젝트 · 기존 소스의 보호 경로/읽기 관측은 아직 연결 전입니다.</p>
      <button disabled={pending || !editable} type="submit">{pending ? '처리 확인 중' : buffer.pendingCommand ? '저장 결과 다시 확인' : '중간 저장'}</button>
      <button disabled={pending || !buffer.draftId} type="button" onClick={restore}>저장본 다시 조회</button>
    </form>
    {buffer.draftId ? <p role="status">초안 버전 {buffer.version} · {buffer.draftId}{buffer.dirty ? ' · 미저장 입력 있음' : ''}</p> : null}
    <p className="meta">입력은 화면 이동·로그인 만료 중 이 탭에 보존됩니다. 서버 저장 전 탭 종료/새로고침에는 확인이 필요합니다.</p>
    <button disabled>방법론·자료로 다음 — 연결 전</button><button disabled>프로젝트 생성 — 필수 기준 연결 전</button>
    <p><a href="#/projects">프로젝트 목록으로 · 입력은 탭에 유지</a></p>
  </section>;
}

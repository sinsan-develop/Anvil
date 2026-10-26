import { useEffect, useLayoutEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { emptyDraft, readProjectDraft, writeProjectDraft, runDraftAction, type DraftAction, type DraftEditorState, type PendingDraftCommand, type DraftResult } from './api.ts';
import { MethodologySelection } from './MethodologySelection.tsx';
import { DraftReviewPanel } from './DraftReviewPanel.tsx';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import {draftWizardStep,moveDraftWizardStep} from './draft-wizard.ts';
import {DraftWizardReview} from './DraftWizardReview.ts';
import {PinnedMethodRequirements} from './PinnedMethodRequirements.tsx';
import {createDraftMutationGate} from './draft-mutation-gate.ts';

const nextLabels:Record<number,string>={1:'방법론·자료로 다음',2:'총괄·환경으로 다음',3:'생성 전 확인으로 다음'};
const previousLabels:Record<number,string>={2:'목적·소스로 이전',3:'방법론·자료로 이전',4:'총괄·환경으로 이전'};
type DraftReadIdentity = { client: ApiClient; key: string; attempt: number; mounted: boolean };
type DraftConsumption = { identity: DraftReadIdentity; attempt: number; projectId: string | null | undefined };
type DraftReadonlySnapshot = { identity: DraftReadIdentity; attempt: number; result: DraftResult; sourceInput: DraftEditorState['input']; sourceMethodologyState: DraftEditorState['methodologyState']; sourceReview: DraftEditorState['review']; fingerprint: string; step: number };

export function ProjectCreatePage({ client, session, buffer, onChange, onAuthenticationLost }: { client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; buffer: DraftEditorState; onChange: Dispatch<SetStateAction<DraftEditorState>>; onAuthenticationLost: () => void }) {
  const fieldId = useId();
  const mutationRef = useRef<ReturnType<typeof createDraftMutationGate> | null>(null);
  if (!mutationRef.current) mutationRef.current = createDraftMutationGate();
  const mutation = mutationRef.current;
  const [requestedId, setRequestedId] = useState(() => new URLSearchParams(location.search).get('draftId'));
  const [reload, setReload] = useState(0);
  const editorStep = draftWizardStep(buffer);
  const [pending, setPending] = useState(false);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [editable, setEditable] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const wrongOwner = !!buffer.ownerUserId && buffer.ownerUserId !== session.user.id;
  const differentDraft = !!buffer.draftId && buffer.draftId !== requestedId;
  // 조회한 동일 초안의 hydrate는 문맥을 바꾸지 않는다. 다른 초안으로 바뀐 렌더는 즉시 폐기한다.
  const readKey = JSON.stringify([session.user.id, session.clientId, requestedId, reload, wrongOwner, differentDraft ? buffer.draftId : null]);
  const liveRead = useRef<DraftReadIdentity>({ client, key: readKey, attempt: 0, mounted: true });
  if (liveRead.current.client !== client || liveRead.current.key !== readKey) liveRead.current = { client, key: readKey, attempt: 0, mounted: true };
  const readIdentity = liveRead.current;
  const [consumption, setConsumption] = useState<DraftConsumption | null>(null);
  const [readonlySnapshot, setReadonlySnapshot] = useState<DraftReadonlySnapshot | null>(null);
  const liveReadonlySnapshot = useRef<DraftReadonlySnapshot | null>(null);
  useLayoutEffect(() => { readIdentity.mounted = true; return () => { readIdentity.mounted = false; readIdentity.attempt++; }; }, [readIdentity]);
  const consumedProjectId = !differentDraft && consumption?.identity === readIdentity && consumption.attempt === readIdentity.attempt ? consumption.projectId : undefined;
  useEffect(() => {
    if (!requestedId || wrongOwner) return;
    const attempt = ++readIdentity.attempt;
    const current = () => liveRead.current === readIdentity && readIdentity.mounted && readIdentity.attempt === attempt;
    setPending(true); setError(null);
    readProjectDraft(client, requestedId).then(result => {
      if (!current()) return;
      setEditable(result.editable === true);
      setConsumption({ identity: readIdentity, attempt, projectId: result.consumedProjectId });
      const snapshot: DraftReadonlySnapshot | null = result.editable === false ? { identity: readIdentity, attempt, result: structuredClone(result), sourceInput: result.input, sourceMethodologyState: result.methodologyState, sourceReview: buffer.review, fingerprint: JSON.stringify([result.input, result.methodologyState, buffer.review]), step: result.step } : null;
      liveReadonlySnapshot.current = snapshot;
      setReadonlySnapshot(snapshot);
      onChange(previous => !current() || previous.dirty || previous.pendingCommand || previous.pendingAction || previous.ownerUserId && previous.ownerUserId !== session.user.id || previous.draftId && previous.draftId !== requestedId ? previous : { ...previous, ownerUserId: session.user.id, input: result.input, draftId: result.draftId, version: result.version, wizardStep: result.step, dirty: false, pendingCommand: null, methodologyState: result.methodologyState });
    }).catch((cause: unknown) => { if (current()) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); setEditable(false); } })
      .finally(() => { if (current()) setPending(false); });
    return () => { readIdentity.attempt++; };
  }, [readIdentity]);
  async function save() {
    if (pending || selectionBusy || !editable || wrongOwner || buffer.pendingAction) return;
    await mutation.run(async () => {
    const previouslyPending=!!buffer.pendingCommand;
    const fingerprint = JSON.stringify({ draftId: buffer.draftId, version: buffer.version, input: buffer.input, step: editorStep });
    if (buffer.pendingCommand && buffer.pendingCommand.fingerprint !== fingerprint) { setError(new ApiError('DRAFT_RECONCILIATION_REQUIRED')); return; }
    const command: PendingDraftCommand = buffer.pendingCommand ?? {
      draftId: buffer.draftId, fingerprint,
      body: buffer.draftId
        ? { schemaVersion: 1, commandId: crypto.randomUUID(), clientId: session.clientId, expectedVersion: buffer.version, step: editorStep, input: buffer.input }
        : { schemaVersion: 1, commandId: crypto.randomUUID(), clientId: session.clientId, expectedVersion: 0, targetId: null, ...buffer.input },
    };
    const dispatchId=crypto.randomUUID();
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, pendingCommand: {...command,dispatchId} }));
    setPending(true); setError(null);
    try {
      const result = await writeProjectDraft(client, command.draftId, command.body, session.csrfToken);
      if (command.draftId && result.draftId !== command.draftId || result.version !== Number(command.body.expectedVersion) + 1) throw new ApiError('RESPONSE_INVALID');
      onChange(previous => previous.pendingCommand?.body.commandId === command.body.commandId ? { ...previous, ownerUserId: session.user.id, input: result.input, draftId: result.draftId, version: result.version, wizardStep: result.step, dirty: false, pendingCommand: null, methodologyState: result.methodologyState } : previous);
      if (location.hash === '#/projects/new') { const url = new URL(location.href); url.searchParams.set('draftId', result.draftId); history.replaceState(history.state, '', url); }
    } catch (cause: unknown) {
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      setError(failure);
      if (!previouslyPending && isKnownDocumentRejection(failure)) onChange(previous => previous.ownerUserId===session.user.id&&previous.pendingCommand?.body.commandId===command.body.commandId&&previous.pendingCommand?.dispatchId===dispatchId?({ ...previous, pendingCommand: null }):previous);
      if (!previouslyPending && isKnownDocumentRejection(failure) && failure.status === 403) setEditable(false);
      if (failure.status === 401) onAuthenticationLost();
    } finally { setPending(false); }
    });
  }
  function change(field: 'name' | 'purpose' | 'desiredOutcome', value: string) { if (!wrongOwner) onChange(previous => ({ ...previous, ownerUserId: session.user.id, input: { ...previous.input, [field]: value }, dirty: true })); }
  function sourceMode(value:'EMPTY'|'EXISTING'){if(locked||wrongOwner)return;if(value==='EMPTY'&&buffer.input.sourceDeclaration&&Object.values(buffer.input.sourceDeclaration).some(Boolean)&&!confirm('이 탭의 기존 소스 선언 입력만 비울까요? 서버에 저장한 이전 선언 이력은 보존합니다.'))return;onChange(previous=>{const{sourceDeclaration,...input}=previous.input;return{...previous,ownerUserId:session.user.id,dirty:true,input:{...input,sourceMode:value,...(value==='EXISTING'?{sourceDeclaration:sourceDeclaration??{hostLabel:'',displayName:'',pathHint:'',reason:''}}:{})}};});}
  function changeSource(field:'hostLabel'|'displayName'|'pathHint'|'reason',value:string){if(locked||wrongOwner)return;onChange(previous=>({...previous,ownerUserId:session.user.id,dirty:true,input:{...previous.input,sourceDeclaration:{hostLabel:'',displayName:'',pathHint:'',reason:'',...previous.input.sourceDeclaration,[field]:value}}}));}
  function restore() {
    if (!buffer.draftId || pending || mutation.isBusy() || selectionBusy || wrongOwner || buffer.pendingAction || buffer.pendingCommand) return;
    if (buffer.dirty && !confirm('현재 미저장 입력을 서버 저장본으로 바꿀까요?')) return;
    onChange(previous => ({ ...previous, dirty: false, pendingCommand: null }));
    setRequestedId(buffer.draftId); setReload(value => value + 1); setError(null);
  }
  async function action(command: DraftAction) {
    if (pending || selectionBusy || wrongOwner || command.body.clientId !== session.clientId || command.draftId !== buffer.draftId) return;
    if (!buffer.pendingAction && (!editable || buffer.dirty || buffer.pendingCommand)) return;
    await mutation.run(async () => {
    const previouslyPending=!!buffer.pendingAction;
    const dispatchId=crypto.randomUUID();
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, pendingAction: {...command,dispatchId} }));
    setPending(true); setError(null); let applied = false;
    try {
      const created = await runDraftAction(client, command, session.csrfToken, session.user.id); applied = true;
      const result = created ? null : await readProjectDraft(client, command.draftId);
      if (result && result.version !== buffer.version) throw new ApiError('VERSION_CONFLICT', 409);
      onChange(previous => previous.ownerUserId === session.user.id && previous.pendingAction?.body.commandId === command.body.commandId ? { ...previous, pendingAction: null, createdProject: created, methodologyState: result?.methodologyState ?? previous.methodologyState, review: previous.review ? { ...previous.review, dirty: false } : null } : previous);
      if (created) setEditable(false);
    } catch (cause: unknown) {
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (!applied && !previouslyPending && isKnownDocumentRejection(failure)) onChange(previous => previous.ownerUserId===session.user.id&&previous.pendingAction?.body.commandId===command.body.commandId&&previous.pendingAction?.dispatchId===dispatchId?({ ...previous, pendingAction: null }):previous);
      if (failure.status === 401) onAuthenticationLost();
    } finally { setPending(false); }
    });
  }
  // GET 결과의 표시 사본과 편집 버퍼를 분리한다. 같은 문맥의 정확 저장본만 탐색한다.
  const snapshotMatches = !!readonlySnapshot && readonlySnapshot.identity === readIdentity && readonlySnapshot.attempt === readIdentity.attempt && !wrongOwner && !differentDraft
    && buffer.ownerUserId === session.user.id && buffer.draftId === requestedId && buffer.draftId === readonlySnapshot.result.draftId && buffer.version === readonlySnapshot.result.version && editorStep === readonlySnapshot.result.step
    && !buffer.dirty && !buffer.pendingCommand && !buffer.pendingAction && !buffer.review?.dirty && buffer.input === readonlySnapshot.sourceInput && buffer.methodologyState === readonlySnapshot.sourceMethodologyState && buffer.review === readonlySnapshot.sourceReview
    && JSON.stringify([buffer.input, buffer.methodologyState, buffer.review]) === readonlySnapshot.fingerprint;
  // 한 번 달라진 버퍼가 되돌아와도 과거 조회 권한을 복원하지 않는다. 새 GET이 필요하다.
  if (readonlySnapshot && !pending && !snapshotMatches && liveReadonlySnapshot.current === readonlySnapshot) liveReadonlySnapshot.current = null;
  const readonlyView = snapshotMatches && !pending && !selectionBusy && !editable && !error && liveReadonlySnapshot.current === readonlySnapshot ? readonlySnapshot : null;
  const step = readonlyView?.step ?? editorStep;
  const displayBuffer: DraftEditorState = readonlyView ? { ...emptyDraft(), ownerUserId: session.user.id, draftId: readonlyView.result.draftId, version: readonlyView.result.version, wizardStep: readonlyView.step, input: readonlyView.result.input, methodologyState: readonlyView.result.methodologyState } : buffer;
  if (wrongOwner) return <section className="status-card"><p role="alert">이 탭의 초안은 다른 로그인 사용자의 자료입니다. 내용을 표시하거나 전송하지 않습니다.</p><button onClick={() => { if (confirm('이 탭에 남은 이전 사용자 초안만 닫을까요? 서버 자료는 유지합니다.')) { onChange(emptyDraft()); setRequestedId(null); setError(null); const url = new URL(location.href); url.searchParams.delete('draftId'); history.replaceState(history.state, '', url); } }}>탭의 이전 사용자 초안 닫기</button></section>;
  if (buffer.createdProject) return <section className="status-card" aria-label="생성된 프로젝트 원본"><h2>프로젝트 원본 생성 확인</h2><h3>{buffer.createdProject.name}</h3><p>{buffer.createdProject.purpose}</p><p>프로젝트 ID {buffer.createdProject.id}</p><p>소유 참여 · 현재 기기 제어 세대 {buffer.createdProject.controlState.generation} · 방법론 고정 버전 {buffer.createdProject.currentMethodologyRef.version}</p>{buffer.createdProject.sourceDeclaration?<><p>기존 소스 사용자 선언 · 미확인</p><p>{buffer.createdProject.sourceDeclaration.declaration.hostLabel} · {buffer.createdProject.sourceDeclaration.declaration.displayName}</p><pre>{buffer.createdProject.sourceDeclaration.declaration.pathHint}</pre><p>{buffer.createdProject.sourceDeclaration.declaration.reason}</p></>:null}<p>Agent는 실행하지 않았습니다.</p><p>추가 준비가 필요한 항목</p><ul>{buffer.createdProject.readinessIssues.map(issue => <li key={issue.code}>{issue.code}</li>)}</ul>
    <nav aria-label="생성 후 준비"><a href={`#/projects/${buffer.createdProject.id}/documents`}>문서 화면에서 가져오기 준비</a><a href={`#/projects/${buffer.createdProject.id}/workspace`}>프로젝트 작업 화면 열기</a></nav>
    <p>이동만으로 문서를 가져오거나 작업을 실행하지 않습니다. 대상 화면에서 현재 권한과 준비 상태를 다시 확인합니다.</p>
    <a href="#/projects">프로젝트 목록에서 확인</a></section>;
  const locked = pending || selectionBusy || !editable || !!buffer.pendingAction || !!buffer.pendingCommand;
  const confirmedSelection = buffer.input.methodologySelection?.kind === 'CONFIRMED_REFERENCE' || !!buffer.methodologyState?.confirmation && buffer.methodologyState.ref.version === buffer.version && !buffer.review?.dirty;
  const move=(target:number)=>{
    if (readonlyView) {
      if (liveRead.current !== readIdentity || liveReadonlySnapshot.current !== readonlyView || mutation.isBusy() || !Number.isInteger(target) || target < 1 || target > 4 || Math.abs(target - readonlyView.step) !== 1) return;
      const next = { ...readonlyView, step: target };
      liveReadonlySnapshot.current = next;
      setReadonlySnapshot(next);
      return;
    }
    if (!editable) return;
    onChange(previous=>moveDraftWizardStep(previous,session.user.id,target,pending||selectionBusy||mutation.isBusy(),editable)??previous);
  };
  const canNext=step<4&&(!!readonlyView||!!moveDraftWizardStep(buffer,session.user.id,step+1,pending||selectionBusy,editable)),canPrevious=step>1&&(!!readonlyView||editable&&!!moveDraftWizardStep(buffer,session.user.id,step-1,pending||selectionBusy,editable));
  return <section className="status-card auth-form create-draft-form" aria-label="프로젝트 생성 중간본">
    <ol className="wizard-steps" aria-label={readonlyView ? '저장 내용 조회 위치' : '프로젝트 생성 단계'}><li aria-current={step === 1 ? 'step' : undefined}>목적·소스</li><li aria-current={step === 2 ? 'step' : undefined}>방법론·자료</li><li aria-current={step === 3 ? 'step' : undefined}>총괄·환경 — 준비 필요</li><li aria-current={step === 4 ? 'step' : undefined}>생성 전 확인</li></ol>
    <h2>프로젝트 생성 중간본</h2>
    <p>중간 저장은 프로젝트 생성이나 Agent 실행이 아닙니다. 기존 소스의 위치 설명도 미확인 사용자 선언으로만 저장합니다.</p>
    {error ? <p role="alert">{error.message}{buffer.pendingCommand ? ' 자동으로 새 명령을 발행하지 않습니다. 같은 저장 요청의 결과를 다시 확인하세요.' : ''}</p> : null}
    {consumedProjectId ? <section aria-label="저장 초안의 생성 프로젝트"><h3>이 초안으로 생성된 프로젝트</h3><p>프로젝트 ID {consumedProjectId}</p><nav aria-label="저장 초안에서 이어가기"><a href={`#/projects/${consumedProjectId}/workspace`}>프로젝트 작업 화면 열기</a><a href={`#/projects/${consumedProjectId}/documents`}>문서 화면에서 가져오기 준비</a></nav><p>대상 화면에서 현재 권한과 준비 상태를 다시 확인합니다. 이동만으로 작업을 실행하거나 문서를 가져오지 않습니다.</p></section> : null}
    {!editable ? <p role="alert">이 초안의 현재 작업 기기/로그인 소유를 확인할 수 없어 변경할 수 없습니다. 입력은 유지합니다.</p> : null}
    {readonlyView ? <section aria-label="저장 초안 내용 조회"><h3>조회 전용 · 저장 내용 {step} / 4</h3><p>저장 버전 {readonlyView.result.version}의 내용을 이전·다음으로 읽습니다. 조회 위치는 작업 진도나 저장 단계의 변경·완료가 아니며 검토·확정·생성을 실행하지 않습니다.</p></section> : null}
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      {step===1?<fieldset disabled={locked}><legend>목적·소스</legend>
      <label htmlFor={fieldId + '-name'}>프로젝트 이름</label><input id={fieldId + '-name'} value={displayBuffer.input.name} readOnly={locked} onChange={event => change('name', event.target.value)} />
      <label htmlFor={fieldId + '-purpose'}>왜 만드는가</label><textarea id={fieldId + '-purpose'} value={displayBuffer.input.purpose} readOnly={locked} onChange={event => change('purpose', event.target.value)} rows={4} />
      <label htmlFor={fieldId + '-outcome'}>기대 결과</label><textarea id={fieldId + '-outcome'} value={displayBuffer.input.desiredOutcome} readOnly={locked} onChange={event => change('desiredOutcome', event.target.value)} rows={3} />
      <label htmlFor={fieldId+'-source-mode'}>프로젝트 소스 방식</label><select id={fieldId+'-source-mode'} value={displayBuffer.input.sourceMode} disabled={locked} onChange={event=>sourceMode(event.target.value as'EMPTY'|'EXISTING')}><option value="EMPTY">새 빈 프로젝트</option><option value="EXISTING">기존 소스 사용자 선언</option></select>
      {displayBuffer.input.sourceMode==='EXISTING'?<fieldset disabled={locked}><legend>기존 소스 위치 설명 · 실제 접근 전</legend><label htmlFor={fieldId+'-source-host'}>소스가 있는 기기</label><input id={fieldId+'-source-host'} maxLength={200} value={displayBuffer.input.sourceDeclaration?.hostLabel??''} onChange={e=>changeSource('hostLabel',e.target.value)}/><label htmlFor={fieldId+'-source-name'}>소스 표시 이름</label><input id={fieldId+'-source-name'} maxLength={200} value={displayBuffer.input.sourceDeclaration?.displayName??''} onChange={e=>changeSource('displayName',e.target.value)}/><label htmlFor={fieldId+'-source-path'}>소스 위치 설명</label><input id={fieldId+'-source-path'} maxLength={4096} value={displayBuffer.input.sourceDeclaration?.pathHint??''} onChange={e=>changeSource('pathHint',e.target.value)}/><label htmlFor={fieldId+'-source-reason'}>소스 선언 이유</label><textarea id={fieldId+'-source-reason'} maxLength={20000} rows={3} value={displayBuffer.input.sourceDeclaration?.reason??''} onChange={e=>changeSource('reason',e.target.value)}/><p>기존 소스 사용자 선언 · 미확인</p><span title="기기·위치 설명은 읽기/쓰기 권한이 아닙니다. Anvil은 이 경로로 실제 파일을 조회하거나 실행하지 않습니다.">ⓘ</span></fieldset>:null}
      </fieldset>:null}
      <button disabled={pending || selectionBusy || !editable || !!buffer.pendingAction} type="submit">{pending ? '처리 확인 중' : buffer.pendingCommand ? '저장 결과 다시 확인' : '중간 저장'}</button>
      <button disabled={pending || selectionBusy || !!buffer.pendingAction || !!buffer.pendingCommand || !buffer.draftId} type="button" onClick={restore}>저장본 다시 조회</button>
    </form>
    {step === 2 ? <MethodologySelection client={client} previewContext={JSON.stringify([session.user.id, session.clientId, displayBuffer.draftId])} value={displayBuffer.input.methodologySelection} confirmed={!displayBuffer.dirty && !!displayBuffer.methodologyState?.confirmation} disabled={locked} onChange={methodologySelection => onChange(previous => ({ ...previous, ownerUserId: session.user.id, input: { ...previous.input, methodologySelection }, dirty: true }))} onAuthenticationLost={onAuthenticationLost} onBusyChange={setSelectionBusy} /> : null}
    {step === 2 ? <DraftReviewPanel buffer={displayBuffer} session={session} disabled={locked} onChange={onChange} onExecute={command => { void action(command); }} /> : null}
    {step===3||step===4?<DraftWizardReview buffer={displayBuffer} step={step} pinnedRequirements={step===3&&displayBuffer.input.methodologySelection?.kind==='CONFIRMED_REFERENCE'?<PinnedMethodRequirements client={client} userId={session.user.id} clientId={session.clientId} draftId={displayBuffer.draftId} reference={displayBuffer.input.methodologySelection.versionRef} onAuthenticationLost={onAuthenticationLost}/>:null}/>:null}
    {displayBuffer.draftId ? <p role="status">초안 버전 {displayBuffer.version} · {displayBuffer.draftId}{displayBuffer.dirty ? ' · 미저장 입력 있음' : ''}</p> : null}
    <p className="meta">입력은 화면 이동·로그인 만료 중 이 탭에 보존됩니다. 서버 저장 전 탭 종료/새로고침에는 확인이 필요합니다.</p>
    {step>1?<button disabled={!canPrevious} onClick={()=>move(step-1)}>{readonlyView ? '저장 내용 조회 · ' : ''}{previousLabels[step]}</button>:null}
    {step<4?<button disabled={!canNext} onClick={()=>move(step+1)}>{readonlyView ? '저장 내용 조회 · ' : ''}{nextLabels[step]}</button>:null}
    <p className="meta">총괄·도구·환경 및 권한 정책은 준비 필요 상태로 남깁니다. 원본 생성이 실제 작업 시작은 아닙니다.</p>
    <button disabled={step!==4 || locked || buffer.dirty || !buffer.draftId || !confirmedSelection || ![buffer.input.name, buffer.input.purpose, buffer.input.desiredOutcome].every(value => !!value.trim())} onClick={() => { void action({ kind: 'create', draftId: buffer.draftId!, body: { schemaVersion: 1, commandId: crypto.randomUUID(), clientId: session.clientId, draftId: buffer.draftId!, draftVersion: buffer.version } }); }}>저장 초안으로 프로젝트 생성</button>
    {buffer.pendingAction && !pending ? <><p role="alert">검토·생성 결과 미확인 · 입력과 같은 명령을 유지했습니다. 자동 재전송하지 않습니다.</p><button disabled={buffer.pendingAction.body.clientId !== session.clientId} onClick={() => { void action(buffer.pendingAction!); }}>{buffer.pendingAction.kind === 'create' ? '같은 생성 명령 결과 확인' : '같은 초안 검토·확정 명령 결과 확인'}</button></> : null}
    <p><a href="#/projects">프로젝트 목록으로 · 입력은 탭에 유지</a></p>
  </section>;
}

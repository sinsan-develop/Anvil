import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import { listWorkPlans, readWorkPlan, type WorkPlanView, type WorkPlanPage, type PlanRef } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import { listAssignmentDrafts, newAssignmentDraft, prepareAssignmentWrite, readAssignmentDraft, sendAssignmentDraft, type AssignmentBuffer, type AssignmentDraftView, type AssignmentPage } from './assignment-api.ts';
import type { WorkspaceProject, WorkspaceStageSelection } from './api.ts';

export function WorkspaceAssignments({ client, project, session, stage, buffer, onChange, onAuthenticationLost }: { client: ApiClient; project: WorkspaceProject; session: DocumentSession; stage: WorkspaceStageSelection | null; buffer: AssignmentBuffer | null; onChange: Dispatch<SetStateAction<AssignmentBuffer | null>>; onAuthenticationLost: () => void }) {
  const [plans, setPlans] = useState<WorkPlanPage | null>(null), [plan, setPlan] = useState<WorkPlanView | null>(null), [taskCode, setTaskCode] = useState('');
  const [drafts, setDrafts] = useState<AssignmentPage | null>(null), [opened, setOpened] = useState<AssignmentDraftView | null | undefined>(undefined), [error, setError] = useState<ApiError | null>(null), [busy, setBusy] = useState(false), [reread, setReread] = useState(false);
  const alive = useRef(true), flight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const owner = project.participation === 'OWNER' && project.controlState.status === 'HELD' && project.controlState.actorId === session.user.id && project.controlState.clientId === session.clientId;
  const bound = !buffer || buffer.ownerUserId === session.user.id && buffer.ownerClientId === session.clientId && buffer.projectId === project.id;
  const sameStage = !buffer || !!stage && ordered(buffer.input.definition.taskRef.applicationRef) === ordered(project.currentMethodologyRef) && buffer.input.definition.taskRef.nodeId === stage.nodeId && buffer.input.definition.taskRef.applicationRef.id === stage.applicationId;
  const update = (change: (value: AssignmentBuffer) => AssignmentBuffer) => { const binding = buffer?.bindingId; onChange(value => value && value.bindingId === binding ? change(value) : value); };
  async function perform(action: () => Promise<void>) {
    if (flight.current) return; flight.current = true; setBusy(true); setError(null);
    try { await action(); } catch (cause) { if (!alive.current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  const safeToReplace = () => !buffer?.pending && (!buffer?.dirty || confirm('미저장 임무 입력을 버리고 새 준비로 바꿀까요?'));
  async function prepare() {
    if (!plan || !stage || !project.currentMethodologyRef || !owner || !bound || !safeToReplace()) return;
    const generation = await documentControl(client, project.id, session); if (!alive.current) return;
    if (generation !== project.controlState.generation) throw new ApiError('CONTROL_GENERATION_CONFLICT', 409);
    const value = newAssignmentDraft(project.id, session, generation, plan, taskCode, project.currentMethodologyRef, stage.nodeId);
    const oldBinding = buffer?.bindingId; onChange(current => current?.bindingId === oldBinding ? value : current); setOpened(null); setReread(false);
  }
  async function save() {
    if (!buffer || !bound || !owner || !sameStage) return;
    const binding = buffer.bindingId;
    // 재확인 시점의 제어/정책 거절은 앞선 전송의 미적용을 증명하지 않는다.
    const previouslyUncertain = !!buffer.pending && buffer.uncertain;
    try {
      const generation = await documentControl(client, project.id, session); if (!alive.current) return;
      if (generation !== buffer.controlGeneration) throw new ApiError('CONTROL_GENERATION_CONFLICT', 409);
      const command = prepareAssignmentWrite(buffer, session);
      onChange(current => current?.bindingId === binding ? { ...current, pending: command, uncertain: true, failure: null } : current);
      const result = await sendAssignmentDraft(client, command, buffer.expectedDesignRef, session.csrfToken); if (!alive.current) return;
      onChange(current => current?.bindingId === binding ? { ...current, ref: result.ref, pending: null, result, uncertain: false, failure: null, dirty: false } : current); setOpened(undefined); setReread(false);
    } catch (cause) {
      if (!alive.current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      onChange(current => current?.bindingId === binding ? { ...current, failure: { code: failure.code, status: failure.status }, uncertain: previouslyUncertain || failure.status === 0 || failure.status >= 500 || failure.code === 'RESPONSE_INVALID' } : current);
      throw failure;
    }
  }
  async function open(ref: PlanRef) { setOpened(null); setReread(false); const value = await readAssignmentDraft(client, project.id, ref); if (alive.current) { setOpened(value); setReread(true); } }
  async function revise(view: AssignmentDraftView) {
    if (!owner || !bound || !stage || !safeToReplace()) return;
    const latest = await readAssignmentDraft(client, project.id, view.ref), generation = await documentControl(client, project.id, session); if (!alive.current) return;
    if (latest.headVersion !== latest.ref.version) throw new ApiError('VERSION_CONFLICT', 409);
    if (ordered(latest.snapshot.basis.applicationRef) !== ordered(project.currentMethodologyRef) || latest.snapshot.basis.nodeId !== stage.nodeId || generation !== project.controlState.generation) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
    const value: AssignmentBuffer = { bindingId: crypto.randomUUID(), projectId: project.id, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: generation, expectedDesignRef: latest.snapshot.basis.designRef, input: { baseRef: latest.ref, definition: structuredClone(latest.snapshot.definition), reason: '' }, ref: latest.ref, pending: null, result: null, dirty: false, uncertain: false, failure: null };
    const oldBinding = buffer?.bindingId; onChange(current => current?.bindingId === oldBinding ? value : current); setOpened(null); setReread(false);
  }
  const locked = busy || !!buffer?.pending || !!buffer?.result || !owner || !sameStage;
  // undefined는 새 저장영수증 보기, null은 명시 재조회/오류로 이전 원문을 감춘 상태다.
  const shown = opened === undefined ? (bound ? buffer?.result : null) ?? null : opened;
  return <section aria-label="임무 초안"><h4>임무 초안</h4><p className="meta">할 일·목적·검수 조건을 Anvil에 보관합니다. 저장은 확정·배정·Agent 실행이 아닙니다. 현재 확정계획·설계·단계는 저장 시 서버가 다시 검사합니다.</p>
    {!stage ? <p>먼저 적용 절차를 조회하고 단계를 선택하세요.</p> : <p>선택 정의: {stage.nodeName} · 실제 수행 단계 아님</p>}
    {!owner ? <p>초안 변경은 현재 제어권을 가진 소유자만 가능합니다. 조회는 가능합니다.</p> : null}
    {error ? <p role="alert">{error.code} · 원입력·미확인 명령은 자동 재발행하지 않습니다.</p> : null}
    <button disabled={busy || !owner || !stage || !!buffer?.pending} onClick={() => void perform(async () => { setPlan(null); setPlans(null); const page = await listWorkPlans(client, project.id, null); if (alive.current) setPlans(page); })}>계획 목록 조회</button>
    {plans ? <ul>{plans.items.map(item => <li key={item.ref.id}>{item.title} · v{item.ref.version}<button disabled={busy || !!buffer?.pending} onClick={() => void perform(async () => { setPlan(null); const value = await readWorkPlan(client, project.id, item.ref); if (alive.current) { setPlan(value); setTaskCode(value.tasks[0]?.taskCode ?? ''); } })}>계획 열기: {item.title}</button></li>)}</ul> : null}
    {plans?.hasMore ? <button disabled={busy} onClick={() => void perform(async () => { const cursor = plans.nextCursor; setPlan(null); setPlans(null); const page = await listWorkPlans(client, project.id, cursor); if (alive.current) setPlans(page); })}>계획 다음 목록</button> : null}
    {plan ? <><label>임무의 계획 업무<select value={taskCode} disabled={busy || !!buffer?.pending} onChange={event => setTaskCode(event.target.value)}>{plan.tasks.map(task => <option key={task.taskCode} value={task.taskCode}>{task.taskCode} · {task.title}</option>)}</select></label><button disabled={busy || !owner || !stage || !taskCode || !!buffer?.pending} onClick={() => void perform(prepare)}>선택 업무로 임무 초안 준비</button></> : null}
    {buffer && bound ? <fieldset disabled={locked}><legend>작성 중인 임무 · {buffer.input.definition.taskRef.taskCode}</legend>
      {!sameStage ? <p>보관한 초안과 선택 단계/적용본이 다릅니다. 원 단계로 돌아오거나 별도로 새 초안을 준비하세요.</p> : null}
      {([['purpose', '목적'], ['goal', '목표'], ['ownerRole', '책임 역할'], ['integrationResponsibility', '통합 책임']] as const).map(([field, label]) => <label key={field}>임무 {label}<textarea maxLength={field === 'ownerRole' ? 200 : 20000} value={buffer.input.definition[field]} onChange={event => update(value => ({ ...value, dirty: true, failure: null, input: { ...value.input, definition: { ...value.input.definition, [field]: event.target.value } } }))} /></label>)}
      {([['inputs', '입력'], ['outputs', '산출물'], ['acceptanceCriteria', '완료 조건'], ['verificationRequirements', '검증 조건'], ['included', '포함 범위'], ['excluded', '제외 범위'], ['requiredCapabilities', '필요 능력']] as const).map(([field, label]) => <label key={field}>임무 {label} · 한 줄 한 항목<textarea maxLength={20000} value={buffer.input.definition[field].join('\n')} onChange={event => update(value => ({ ...value, dirty: true, failure: null, input: { ...value.input, definition: { ...value.input.definition, [field]: event.target.value.split('\n') } } }))} /></label>)}
      <p className="meta">소스 허가·환경·예산·상황기록 정책·맥락 이해는 미연결/미확인입니다. 이 초안으로 실행할 수 없습니다.</p>
      <label>임무 저장 이유<textarea maxLength={20000} value={buffer.input.reason} onChange={event => update(value => ({ ...value, dirty: true, failure: null, input: { ...value.input, reason: event.target.value } }))} /></label>
    </fieldset> : null}
    {buffer && bound && !buffer.result ? <><button disabled={busy || !owner || !sameStage} onClick={() => void perform(save)}>{buffer.pending ? '같은 임무 명령 결과 확인' : '임무 초안 저장'}</button>{buffer.failure && !buffer.uncertain && buffer.pending ? <button disabled={busy} onClick={() => { if (confirm('거절된 원 명령을 확인했습니다. 입력을 수정하고 별도 명령으로 저장할까요?')) update(value => ({ ...value, pending: null, failure: null })); }}>거절 명령 확인 후 입력 수정</button> : null}</> : null}
    <button disabled={busy} onClick={() => void perform(async () => { setOpened(null); setDrafts(null); const page = await listAssignmentDrafts(client, project.id, null); if (alive.current) setDrafts(page); })}>임무 초안 목록 조회</button>
    {drafts ? <ul>{drafts.items.map(item => <li key={item.ref.id}>{item.goal || '목표 미입력'} · v{item.ref.version}<button disabled={busy} onClick={() => void perform(() => open(item.ref))}>임무 버전 열기: {item.ref.version}</button></li>)}</ul> : null}
    {drafts?.hasMore ? <button disabled={busy} onClick={() => void perform(async () => { const cursor = drafts.nextCursor; setOpened(null); setDrafts(null); const page = await listAssignmentDrafts(client, project.id, cursor); if (alive.current) setDrafts(page); })}>임무 다음 목록</button> : null}
    {shown ? <section aria-label="저장한 임무 초안">{buffer?.result ? <p role="status">임무 초안 저장 확인</p> : null}<p>고정 버전 {shown.ref.version} · {shown.ref.id}<br />{shown.ref.contentHash}</p><p>실제 배정·Agent 실행 아님 · 현재 원본 유효성은 미재검사</p><pre>{shown.snapshot.definition.goal}</pre><p>{shown.snapshot.definition.purpose}</p><ul>{shown.snapshot.readinessIssues.map((issue, index) => <li key={index}>{issue.code} · {issue.location}</li>)}</ul><button disabled={busy} onClick={() => void perform(() => open(shown.ref))}>저장 버전 재조회</button>{reread ? <p>저장 버전 재조회 확인</p> : <p>저장 영수증만 확인 · 현재 head 미확인</p>}<button disabled={busy || !owner || !!buffer?.pending} onClick={() => void perform(() => revise(shown))}>현재 버전으로 개정 준비</button></section> : null}
  </section>;
}

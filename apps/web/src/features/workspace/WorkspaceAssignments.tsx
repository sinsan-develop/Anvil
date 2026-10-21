import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import { listWorkPlans, readWorkPlan, type WorkPlanView, type WorkPlanPage, type PlanRef } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import { listAssignmentDrafts, newAssignmentDraft, prepareAssignmentWrite, readAssignmentDraft, sendAssignmentDraft, type AssignmentBuffer, type AssignmentDraftView, type AssignmentPage } from './assignment-api.ts';
import type { WorkspaceProject, WorkspaceStageSelection } from './api.ts';
import { AssignmentContentDecision } from './AssignmentContentDecision.tsx';
import { readAssignmentDecision, readConfirmedAssignment, type AssignmentDecisionBuffer } from './assignment-confirmation-api.ts';
import { WorkPlanTaskOriginal } from './work-plan-task-original.ts';
import type { ContextPreparationBuffer } from './context-api.ts';
import { AssignmentBasisDocuments } from './AssignmentBasisDocuments.ts';
import { AssignmentSourceSelection } from './WorkspaceExecutionPreparation.tsx';
import { AssignmentBudgetSelection } from './AssignmentBudgetSelection.tsx';
import { AssignmentEnvironmentSelection } from './AssignmentEnvironmentSelection.tsx';
import type { ResponsibleSessionBuffer } from './responsible-session-api.ts';
import type {PlanTaskSelection} from '../../shell/routes.ts';
import { AssignmentChildTaskSelection } from './AssignmentChildTaskSelection.tsx';
import { AssignmentParentOriginal } from './AssignmentParentOriginal.tsx';
import {AssignmentRevisionComparison} from './AssignmentRevisionComparison.tsx';

export function WorkspaceAssignments({ client, project, session, stage, buffer, requestedTask, onChange, onAuthenticationLost }: { client: ApiClient; project: WorkspaceProject; session: DocumentSession; stage: WorkspaceStageSelection | null; buffer: AssignmentBuffer | null;requestedTask?:PlanTaskSelection; onChange: Dispatch<SetStateAction<AssignmentBuffer | null>>; onAuthenticationLost: () => void }) {
  const [plans, setPlans] = useState<WorkPlanPage | null>(null), [plan, setPlan] = useState<WorkPlanView | null>(null), [taskCode, setTaskCode] = useState('');
  const [drafts, setDrafts] = useState<AssignmentPage | null>(null), [opened, setOpened] = useState<AssignmentDraftView | null | undefined>(undefined), [error, setError] = useState<ApiError | null>(null), [busy, setBusy] = useState(false), [reread, setReread] = useState(false);
  const alive = useRef(true), flight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const owner = project.participation === 'OWNER' && project.controlState.status === 'HELD' && project.controlState.actorId === session.user.id && project.controlState.clientId === session.clientId;
  const bound = !buffer || buffer.ownerUserId === session.user.id && buffer.ownerClientId === session.clientId && buffer.projectId === project.id;
  const sameStage = !buffer || ordered(buffer.input.definition.taskRef.applicationRef) === ordered(project.currentMethodologyRef) && (stage ? buffer.input.definition.taskRef.nodeId === stage.nodeId && buffer.input.definition.taskRef.applicationRef.id === stage.applicationId : buffer.input.definition.parentAssignmentRef !== null);
  const update = (change: (value: AssignmentBuffer) => AssignmentBuffer) => { const binding = buffer?.bindingId; onChange(value => value && value.bindingId === binding ? change(value) : value); };
  async function perform(action: () => Promise<void>) {
    if (flight.current) return; flight.current = true; setBusy(true); setError(null);
    try { await action(); } catch (cause) { if (!alive.current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  const safeToReplace = () => !buffer?.pending && !buffer?.contentDecision?.pending && !buffer?.contentDecision?.uncertain && !buffer?.contextPreparation?.pending && !buffer?.contextPreparation?.uncertain && !buffer?.responsibleSession?.pending && !buffer?.responsibleSession?.uncertain && (!buffer?.dirty || confirm('미저장 임무 입력을 버리고 새 준비로 바꿀까요?'));
  async function prepare() {
    if (!plan || !stage || !project.currentMethodologyRef || !owner || !bound || !safeToReplace()) return;
    const generation = await documentControl(client, project.id, session); if (!alive.current) return;
    if (generation !== project.controlState.generation) throw new ApiError('CONTROL_GENERATION_CONFLICT', 409);
    const value = newAssignmentDraft(project.id, session, generation, plan, taskCode, project.currentMethodologyRef, stage.nodeId, stage.requiredCapabilities);
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
  async function prepareChild(view: AssignmentDraftView) {
    if (!owner || !bound || !safeToReplace()) return;
    const captured = buffer;
    setOpened(null); setReread(false);
    const latest = await readAssignmentDraft(client, project.id, view.ref);
    if (!alive.current) return;
    if (latest.headVersion !== latest.ref.version || latest.snapshot.definition.parentAssignmentRef !== null) throw new ApiError('ASSIGNMENT_PARENT_NOT_CURRENT', 409);
    const decision = await readAssignmentDecision(client, project.id, latest);
    if (!alive.current) return;
    if (decision.currentIssue !== null || !decision.latestReviewAccepted || !decision.confirmedRef) throw new ApiError('ASSIGNMENT_PARENT_NOT_CURRENT', 409);
    const parent = await readConfirmedAssignment(client, project.id, decision.confirmedRef, latest);
    if (!alive.current) return;
    const task = parent.snapshot.definition.taskRef;
    if (ordered(task.applicationRef) !== ordered(project.currentMethodologyRef) || stage && (task.nodeId !== stage.nodeId || task.applicationRef.id !== stage.applicationId)) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
    const generation = await documentControl(client, project.id, session); if (!alive.current) return;
    if (generation !== project.controlState.generation) throw new ApiError('CONTROL_GENERATION_CONFLICT', 409);
    const value: AssignmentBuffer = { bindingId: crypto.randomUUID(), projectId: project.id, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: generation, expectedDesignRef: latest.snapshot.basis.designRef,
      input: { baseRef: null, reason: '', definition: { ...structuredClone(parent.snapshot.definition), parentAssignmentRef: structuredClone(parent.ref) } },
      ref: null, pending: null, result: null, dirty: true, uncertain: false, failure: null };
    onChange(current => current === captured ? value : current);
  }
  async function revise(view: AssignmentDraftView) {
    if (!owner || !bound || !stage && view.snapshot.definition.parentAssignmentRef === null || !safeToReplace()) return;
    const captured = buffer;
    const latest = await readAssignmentDraft(client, project.id, view.ref); if (!alive.current) return;
    const generation = await documentControl(client, project.id, session); if (!alive.current) return;
    if (latest.headVersion !== latest.ref.version) throw new ApiError('VERSION_CONFLICT', 409);
    if (ordered(latest.snapshot.basis.applicationRef) !== ordered(project.currentMethodologyRef) || stage && latest.snapshot.basis.nodeId !== stage.nodeId || generation !== project.controlState.generation) throw new ApiError('ASSIGNMENT_BINDING_INVALID');
    const value: AssignmentBuffer = { bindingId: crypto.randomUUID(), projectId: project.id, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: generation, expectedDesignRef: latest.snapshot.basis.designRef, input: { baseRef: latest.ref, definition: structuredClone(latest.snapshot.definition), reason: '' }, ref: latest.ref, pending: null, result: null, dirty: false, uncertain: false, failure: null };
    onChange(current => current === captured ? value : current); setOpened(null); setReread(false);
  }
  const locked = busy || !!buffer?.pending || !!buffer?.result || !owner || !sameStage;
  // undefined는 새 저장영수증 보기, null은 명시 재조회/오류로 이전 원문을 감춘 상태다.
  const shown = opened === undefined ? (bound ? buffer?.result : null) ?? null : opened;
  const contentChange: Dispatch<SetStateAction<AssignmentDecisionBuffer|null>> = action => {
    if (!shown || !bound) return;
    onChange(current => {
      if (current?.pending || current && (current.ownerUserId !== session.user.id || current.ownerClientId !== session.clientId || current.projectId !== project.id)) return current;
      const previous=current?.contentDecision??null,value=typeof action==='function'?action(previous):action;
      if (current) return {...current,contentDecision:value,dirty:!!value?.dirty||!!current.contextPreparation?.dirty||!!current.responsibleSession?.dirty,uncertain:!!value?.uncertain||!!current.contextPreparation?.uncertain||!!current.responsibleSession?.uncertain};
      return {bindingId:crypto.randomUUID(),projectId:project.id,ownerUserId:session.user.id,ownerClientId:session.clientId,controlGeneration:value?.controlGeneration??project.controlState.generation??0,expectedDesignRef:shown.snapshot.basis.designRef,input:{baseRef:shown.snapshot.previousRef,definition:structuredClone(shown.snapshot.definition),reason:shown.snapshot.reason},ref:shown.ref,pending:null,result:shown,dirty:!!value?.dirty,uncertain:!!value?.uncertain,failure:null,contentDecision:value};
    });
  };
  const contextChange: Dispatch<SetStateAction<ContextPreparationBuffer|null>> = action => {
    if (!shown || !bound) return;
    onChange(current => {
      if (current?.pending || current && (current.ownerUserId !== session.user.id || current.ownerClientId !== session.clientId || current.projectId !== project.id)) return current;
      const previous = current?.contextPreparation ?? null, value = typeof action === 'function' ? action(previous) : action;
      if (current) return { ...current, contextPreparation: value, dirty: (current.result ? !!current.contentDecision?.dirty : current.dirty) || !!value?.dirty || !!current.responsibleSession?.dirty, uncertain: !!current.contentDecision?.uncertain || !!value?.uncertain || !!current.responsibleSession?.uncertain };
      return { bindingId: crypto.randomUUID(), projectId: project.id, ownerUserId: session.user.id, ownerClientId: session.clientId, controlGeneration: value?.controlGeneration ?? project.controlState.generation ?? 0, expectedDesignRef: shown.snapshot.basis.designRef, input: { baseRef: shown.snapshot.previousRef, definition: structuredClone(shown.snapshot.definition), reason: shown.snapshot.reason }, ref: shown.ref, pending: null, result: shown, dirty: !!value?.dirty, uncertain: !!value?.uncertain, failure: null, contextPreparation: value };
    });
  };
  const responsibleChange:Dispatch<SetStateAction<ResponsibleSessionBuffer|null>>=action=>{
    if(!shown||!bound)return;
    onChange(current=>{
      if(current?.pending||current&&(current.ownerUserId!==session.user.id||current.ownerClientId!==session.clientId||current.projectId!==project.id))return current;
      const previous=current?.responsibleSession??null,value=typeof action==='function'?action(previous):action;
      if(current)return{...current,responsibleSession:value,dirty:(current.result?!!current.contentDecision?.dirty:current.dirty)||!!current.contextPreparation?.dirty||!!value?.dirty,uncertain:!!current.contentDecision?.uncertain||!!current.contextPreparation?.uncertain||!!value?.uncertain};
      return{bindingId:crypto.randomUUID(),projectId:project.id,ownerUserId:session.user.id,ownerClientId:session.clientId,controlGeneration:value?.controlGeneration??project.controlState.generation??0,expectedDesignRef:shown.snapshot.basis.designRef,input:{baseRef:shown.snapshot.previousRef,definition:structuredClone(shown.snapshot.definition),reason:shown.snapshot.reason},ref:shown.ref,pending:null,result:shown,dirty:!!value?.dirty,uncertain:!!value?.uncertain,failure:null,responsibleSession:value};
    });
  };
  return <section aria-label="임무 초안"><h4>임무 초안</h4><p className="meta">할 일·목적·검수 조건을 Anvil에 보관합니다. 저장은 확정·배정·Agent 실행이 아닙니다. 현재 확정계획·설계·단계는 저장 시 서버가 다시 검사합니다.</p>
    {!stage ? <p>먼저 적용 절차를 조회하고 단계를 선택하세요.</p> : <p>선택 정의: {stage.nodeName} · 실제 수행 단계 아님</p>}
    {!owner ? <p>초안 변경은 현재 제어권을 가진 소유자만 가능합니다. 조회는 가능합니다.</p> : null}
    {error ? <p role="alert">{error.code} · 원입력·미확인 명령은 자동 재발행하지 않습니다.</p> : null}
    {requestedTask?<section aria-label="설계에서 연결한 계획 업무"><h5>고정 업무 {requestedTask.taskCode}</h5><p>계획 {requestedTask.planRef.id} · v{requestedTask.planRef.version} · {requestedTask.planRef.contentHash}</p><p>먼저 단계를 선택한 뒤 해당 버전·업무를 확인하세요. 조회는 기존 초안·명령을 바꾸지 않으며 새 준비는 별도 선택입니다.</p><button type="button" disabled={busy||!stage||!!buffer?.pending} onClick={()=>void perform(async()=>{setPlan(null);setTaskCode('');const target=structuredClone(requestedTask),value=await readWorkPlan(client,project.id,target.planRef);if(value.relationalProjection!=='STORED'||value.tasks.filter(t=>t.taskCode===target.taskCode).length!==1)throw new ApiError('LINKED_PLAN_TASK_UNVERIFIED',422);if(alive.current){setPlan(value);setTaskCode(target.taskCode);}})}>연결된 계획 업무 확인</button></section>:null}
    <button disabled={busy || !owner || !stage || !!buffer?.pending} onClick={() => void perform(async () => { setPlan(null); setPlans(null); const page = await listWorkPlans(client, project.id, null); if (alive.current) setPlans(page); })}>계획 목록 조회</button>
    {plans ? <ul>{plans.items.map(item => <li key={item.ref.id}>{item.title} · v{item.ref.version}<button disabled={busy || !!buffer?.pending} onClick={() => void perform(async () => { setPlan(null); const value = await readWorkPlan(client, project.id, item.ref); if (alive.current) { setPlan(value); setTaskCode(value.tasks[0]?.taskCode ?? ''); } })}>계획 열기: {item.title}</button></li>)}</ul> : null}
    {plans?.hasMore ? <button disabled={busy} onClick={() => void perform(async () => { const cursor = plans.nextCursor; setPlan(null); setPlans(null); const page = await listWorkPlans(client, project.id, cursor); if (alive.current) setPlans(page); })}>계획 다음 목록</button> : null}
    {plan ? <><label>임무의 계획 업무<select value={taskCode} disabled={busy || !!buffer?.pending} onChange={event => setTaskCode(event.target.value)}>{plan.tasks.map(task => <option key={task.taskCode} value={task.taskCode}>{task.taskCode} · {task.title}</option>)}</select></label><WorkPlanTaskOriginal key={[plan.ref.id,plan.ref.version,plan.ref.contentHash,taskCode].join(':')} plan={plan} taskCode={taskCode}/><button disabled={busy || !owner || !stage || !taskCode || !!buffer?.pending} onClick={() => void perform(prepare)}>선택 업무로 임무 초안 준비</button></> : null}
    {plan ? <AssignmentBasisDocuments key={[ordered(plan.ref), ordered(plan.documentRef), ordered(plan.designRef)].join(':')} client={client} projectId={project.id} plan={plan} busy={busy} run={action => void perform(action)} /> : null}
    {buffer && bound ? <fieldset disabled={locked}><legend>작성 중인 임무 · {buffer.input.definition.taskRef.taskCode}</legend>
      {buffer.input.definition.parentAssignmentRef ? <p>부모 연결 하위 초안 · 검토·확정·배정·실행 불가</p> : null}
      {buffer.input.definition.parentAssignmentRef ? <AssignmentChildTaskSelection key={'child-task:'+buffer.bindingId} client={client} buffer={buffer} session={session} locked={locked || buffer.uncertain} update={update} run={action=>void perform(action)} /> : null}
      {buffer.input.definition.parentAssignmentRef ? <p>고정 부모 {buffer.input.definition.parentAssignmentRef.id} · v{buffer.input.definition.parentAssignmentRef.version} · {buffer.input.definition.parentAssignmentRef.contentHash} · 허용 범위 축소만 가능하며 현재성은 저장 시 다시 확인합니다.</p> : null}
      {!sameStage ? <p>보관한 초안과 선택 단계/적용본이 다릅니다. 원 단계로 돌아오거나 별도로 새 초안을 준비하세요.</p> : null}
      {([['purpose', '목적'], ['goal', '목표'], ['ownerRole', '책임 역할'], ['integrationResponsibility', '통합 책임']] as const).map(([field, label]) => <label key={field}>임무 {label}<textarea maxLength={field === 'ownerRole' ? 200 : 20000} value={buffer.input.definition[field]} onChange={event => update(value => ({ ...value, dirty: true, failure: null, input: { ...value.input, definition: { ...value.input.definition, [field]: event.target.value } } }))} /></label>)}
      {([['inputs', '입력'], ['outputs', '산출물'], ['acceptanceCriteria', '완료 조건'], ['verificationRequirements', '검증 조건'], ['included', '포함 범위'], ['excluded', '제외 범위'], ['requiredCapabilities', '필요 능력']] as const).map(([field, label]) => <label key={field}>임무 {label} · 한 줄 한 항목<textarea maxLength={20000} value={buffer.input.definition[field].join('\n')} onChange={event => update(value => ({ ...value, dirty: true, failure: null, input: { ...value.input, definition: { ...value.input.definition, [field]: event.target.value.split('\n') } } }))} /></label>)}
      <AssignmentSourceSelection key={buffer.bindingId} client={client} buffer={buffer} session={session} locked={locked} update={update} run={action=>void perform(action)}/>
      <AssignmentBudgetSelection key={'budget:'+buffer.bindingId} client={client} buffer={buffer} session={session} locked={locked||buffer.uncertain||buffer.input.definition.parentAssignmentRef!==null} update={update} run={action=>void perform(action)}/>
      <AssignmentEnvironmentSelection key={'environment:'+buffer.bindingId} client={client} buffer={buffer} session={session} locked={locked||buffer.uncertain||buffer.input.definition.parentAssignmentRef!==null} update={update} run={action=>void perform(action)}/>
      <p className="meta">선택한 소스 범위는 임무 의도입니다. 실제 소스 허가·환경·예산·상황기록 정책·맥락 이해는 미확인입니다. 이 초안으로 실행할 수 없습니다.</p>
      <label>임무 저장 이유<textarea maxLength={20000} value={buffer.input.reason} onChange={event => update(value => ({ ...value, dirty: true, failure: null, input: { ...value.input, reason: event.target.value } }))} /></label>
    </fieldset> : null}
    {buffer && bound && !buffer.result ? <><button disabled={busy || !owner || !sameStage} onClick={() => void perform(save)}>{buffer.pending ? '같은 임무 명령 결과 확인' : '임무 초안 저장'}</button>{buffer.failure && !buffer.uncertain && buffer.pending ? <button disabled={busy} onClick={() => { if (confirm('거절된 원 명령을 확인했습니다. 입력을 수정하고 별도 명령으로 저장할까요?')) update(value => ({ ...value, pending: null, failure: null })); }}>거절 명령 확인 후 입력 수정</button> : null}</> : null}
    <button disabled={busy} onClick={() => void perform(async () => { setOpened(null); setDrafts(null); const page = await listAssignmentDrafts(client, project.id, null); if (alive.current) setDrafts(page); })}>임무 초안 목록 조회</button>
    {drafts ? <ul>{drafts.items.map(item => <li key={item.ref.id}>{item.goal || '목표 미입력'} · v{item.ref.version}<button disabled={busy} onClick={() => void perform(() => open(item.ref))}>임무 버전 열기: {item.ref.version}</button></li>)}</ul> : null}
    {drafts?.hasMore ? <button disabled={busy} onClick={() => void perform(async () => { const cursor = drafts.nextCursor; setOpened(null); setDrafts(null); const page = await listAssignmentDrafts(client, project.id, cursor); if (alive.current) setDrafts(page); })}>임무 다음 목록</button> : null}
    {shown ? <section aria-label="저장한 임무 초안">{buffer?.result ? <p role="status">임무 초안 저장 확인</p> : null}<p>고정 버전 {shown.ref.version} · {shown.ref.id}<br />{shown.ref.contentHash}</p><p>실제 배정·Agent 실행 아님 · 현재 원본 유효성은 미재검사</p><AssignmentConditions snapshot={shown.snapshot} /><ul>{shown.snapshot.readinessIssues.map((issue, index) => <li key={index}>{issue.code} · {issue.location}</li>)}</ul><button disabled={busy} onClick={() => void perform(() => open(shown.ref))}>저장 버전 재조회</button>{reread ? <p>저장 버전 재조회 확인</p> : <p>저장 영수증만 확인 · 현재 head 미확인</p>}<button disabled={busy || !owner || !!buffer?.pending} onClick={() => void perform(() => revise(shown))}>현재 버전으로 개정 준비</button></section> : null}
    {shown && shown.snapshot.definition.parentAssignmentRef === null ? <button disabled={busy || !owner || !bound || !!buffer?.pending} onClick={() => void perform(() => prepareChild(shown))}>이 임무를 부모로 하위 초안 준비</button> : null}
    {shown?.snapshot.definition.parentAssignmentRef ? <p>하위 초안은 저장·개정·조회만 가능합니다. 내용 검토·확정·책임자 배정·실행은 지원하지 않습니다.</p> : null}
    {shown?.snapshot.definition.parentAssignmentRef ? <AssignmentParentOriginal key={['parent-original',project.id,session.user.id,session.clientId,ordered(shown.ref)].join(':')} client={client} child={shown} busy={busy} run={action=>void perform(action)} renderConditions={snapshot=><AssignmentConditions snapshot={snapshot}/>} /> : null}
    {shown?.snapshot.previousRef?<button disabled={busy} onClick={()=>void perform(()=>open(shown.snapshot.previousRef!))}>이전 임무 초안 원문 열기</button>:null}
    {shown?.snapshot.previousRef?<AssignmentRevisionComparison key={['revision',project.id,session.user.id,session.clientId,ordered(shown.ref)].join(':')} client={client} current={shown} busy={busy} run={action=>void perform(action)}/>:null}
    {shown&&bound&&shown.snapshot.definition.parentAssignmentRef===null?<AssignmentContentDecision key={ordered(shown.ref)} client={client} session={session} draft={shown} buffer={buffer?.contentDecision??null} onChange={contentChange} contextBuffer={buffer?.contextPreparation??null} onContextChange={contextChange} responsibleBuffer={buffer?.responsibleSession??null} onResponsibleChange={responsibleChange} owner={owner&&(!buffer||!!buffer.result)&&!buffer?.pending} busy={busy} run={action=>void perform(action)}/>:null}
  </section>;
}

function AssignmentConditions({ snapshot }: { snapshot: AssignmentDraftView['snapshot'] }) {
  const value = snapshot.definition;
  return <section aria-label="임무 고정 조건"><h5>고정 임무 전체 조건</h5><dl>
    {([['goal', '목표'], ['purpose', '목적'], ['ownerRole', '책임 역할'], ['integrationResponsibility', '통합 책임']] as const).map(([field, label]) => <div key={field}><dt>{label}</dt><dd><pre>{value[field] || '미입력'}</pre></dd></div>)}
    <div><dt>업무 · 방법론 단계</dt><dd>{value.taskRef.taskCode} · {value.taskRef.nodeId}</dd></div>
    {([['inputs', '입력'], ['outputs', '산출물'], ['acceptanceCriteria', '완료 조건'], ['verificationRequirements', '검증 조건'], ['included', '포함 범위'], ['excluded', '제외 범위'], ['requiredCapabilities', '필요 능력']] as const).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{value[field].length ? <ul>{value[field].map((text, index) => <li key={index}><pre>{text || '미입력'}</pre></li>)}</ul> : '미입력'}</dd></div>)}
    {([['작업계획', value.taskRef.planRef], ['방법론 적용본', value.taskRef.applicationRef], ['근거 설계', snapshot.basis.designRef]] as const).map(([label, ref]) => <div key={label}><dt>{label}</dt><dd>{ref.id} · v{ref.version} · {ref.contentHash}</dd></div>)}
    <div><dt>업무 카드 해시</dt><dd>{snapshot.basis.taskCardHash}</dd></div>
    <div><dt>기준 참조 · 현재 유효성 미검증</dt><dd>{value.baselineRefs.length ? <ul>{value.baselineRefs.map(ref => <li key={ref.id + ':' + ref.version + ':' + ref.contentHash}>{ref.id} · v{ref.version} · {ref.contentHash}</li>)}</ul> : '기준 참조 없음'}</dd></div>
    <div><dt>소스 허가 범위 · 현재 권한 미검증</dt><dd>{value.allowedScopes.length ? <pre>{JSON.stringify(value.allowedScopes, null, 2)}</pre> : '등록 범위 없음 · 실행 허가 아님'}</dd></div>
    {([['environmentRef', '환경 참조'], ['budgetRef', '예산 참조'], ['recordingPolicyRef', '상황기록 정책 참조']] as const).map(([field, label]) => { const ref = value[field]; return <div key={field}><dt>{label}</dt><dd>{ref ? <>{ref.id} · v{ref.version} · {ref.contentHash} · 현재 유효성 미검증</> : '미연결 · 미검증'}</dd></div>; })}
    <div><dt>부모 임무</dt><dd>{value.parentAssignmentRef ? <>{value.parentAssignmentRef.id} · v{value.parentAssignmentRef.version} · {value.parentAssignmentRef.contentHash} · 초안 연결이며 위임·실행 허가 아님</> : '부모 임무 없음'}</dd></div>
    <div><dt>이전 초안 버전</dt><dd>{snapshot.previousRef ? <>{snapshot.previousRef.id} · v{snapshot.previousRef.version} · {snapshot.previousRef.contentHash}</> : '최초 초안'}</dd></div>
    <div><dt>저장 이유</dt><dd><pre>{snapshot.reason}</pre></dd></div>
  </dl><p className="meta">저장 당시 고정 원문입니다. 참조와 범위 표시는 현재 권한·환경·예산·능력 검증이나 실행 허가가 아닙니다.</p></section>;
}

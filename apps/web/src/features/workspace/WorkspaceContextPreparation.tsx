import { useEffect, useReducer, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import type { PlanRef } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import type { ConfirmedAssignmentView } from './assignment-confirmation-api.ts';
import { ContextSourcePicker } from './ContextSourcePicker.tsx';
import { newContextPreparation, prepareContextWrite, sendContextPreparation, readContextPreparation, listContextPreparations, type ContextPreparationBuffer } from './context-api.ts';
import { contextObservation } from './context-observation.ts';
import type { ContextSourceSelection } from '../../../../server/modules/context/context-input.ts';

const labels = { PURPOSE_REASON: '목적과 이유', RULES_SCOPE: '헌법과 범위', LATEST_INSTRUCTIONS: '최신 관련 지시', DECISIONS_REASON: '결정과 이유', CURRENT_POSITION: '현재 위치', ACTUAL_GAPS: '실제 공백', NEXT_ACTION: '다음 행동' };
export function WorkspaceContextPreparation({ client, confirmed, session, buffer, onChange, owner, busy, run }: { client: ApiClient; confirmed: ConfirmedAssignmentView; session: DocumentSession; buffer: ContextPreparationBuffer | null; onChange: Dispatch<SetStateAction<ContextPreparationBuffer | null>>; owner: boolean; busy: boolean; run: (action: () => Promise<void>) => void }) {
 const alive = useRef(true), sequence = useRef(0); useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++; }; }, []);
 const [selected, setSelected] = useState<keyof typeof labels>('PURPOSE_REASON');
 const [{ opened, page }, observe] = useReducer(contextObservation, { sequence: 0, opened: null, page: null });
 const begin = () => { const next = ++sequence.current; observe({ kind: 'BEGIN', sequence: next }); return next; };
 const current = (ticket: number) => alive.current && sequence.current === ticket;
 const bound = !buffer || buffer.projectId === confirmed.projectId && buffer.ownerUserId === session.user.id && buffer.ownerClientId === session.clientId;
 const sameTarget = !buffer || ordered(buffer.assignmentRef) === ordered(confirmed.ref);
 const update = (change: (current: ContextPreparationBuffer) => ContextPreparationBuffer) => { const binding = buffer?.bindingId; onChange(current => current && current.bindingId === binding ? change(current) : current); };
 async function prepare() {
  if (!owner || !bound || buffer?.pending || buffer?.uncertain || buffer?.dirty && !confirm('미저장 맥락 준비 입력을 버리고 새로 준비할까요?')) return;
  const ticket = begin();
  const generation = await documentControl(client, confirmed.projectId, session); if (!current(ticket)) return;
  const next = newContextPreparation(confirmed, session, generation), previous = buffer?.bindingId ?? null;
  onChange(current => (current?.bindingId ?? null) === previous ? next : current);
 }
 async function save() {
  if (!buffer || !owner || !bound || !sameTarget || buffer.resultRef) return;
  const ticket = begin();
  const previouslyUncertain = !!buffer.pending && buffer.uncertain;
  try {
   const generation = await documentControl(client, confirmed.projectId, session); if (!current(ticket)) return;
   if (generation !== buffer.controlGeneration) throw new ApiError('CONTROL_GENERATION_CONFLICT', 409);
   const command = prepareContextWrite(buffer, session); update(current => ({ ...current, pending: command, uncertain: true, failure: null, result: null }));
   const resultRef = await sendContextPreparation(client, command, session.csrfToken); if (!current(ticket)) return;
   update(current => ({ ...current, pending: null, resultRef, result: null, uncertain: false, dirty: false, failure: null }));
  } catch (cause) {
   if (!current(ticket)) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
   update(current => ({ ...current, failure: { code: failure.code, status: failure.status }, uncertain: previouslyUncertain || failure.status === 0 || failure.status >= 500 || ['RESPONSE_INVALID', 'CONTEXT_INTEGRITY_FAILED'].includes(failure.code) })); throw failure;
  }
 }
 async function read(ref: PlanRef) {
  if (!bound || !sameTarget) return; const ticket = begin();
  const value = await readContextPreparation(client, confirmed.projectId, ref); if (!current(ticket)) return;
  if (ordered(value.manifest.assignmentRef) !== ordered(confirmed.ref)) throw new ApiError('CONTEXT_ASSIGNMENT_INVALID');
  observe({ kind: 'OPENED', sequence: ticket, value });
 }
 async function list() { const ticket = begin(); const value = await listContextPreparations(client, confirmed.projectId, confirmed.ref); if (current(ticket)) observe({ kind: 'LISTED', sequence: ticket, value }); }
 const locked = busy || !owner || !bound || !sameTarget || !!buffer?.pending || !!buffer?.resultRef;
 function attach(selection: ContextSourceSelection) { if (locked) return; update(current => { const input = structuredClone(current.input), slot = input.slots.find(item => item.code === selected)!; if (!slot.sources.some(item => ordered(item) === ordered(selection))) slot.sources.push(selection); return { ...current, input, dirty: true, result: null }; }); }
 return <section aria-label="임무 맥락 준비"><h6>임무 맥락 준비</h6><p>Agent 전달·실행 허가 아님 · 예산·선정의 의미·최신 관련 지시 전체성은 미확인입니다.</p>
  <button disabled={busy || !owner || !bound || !!buffer?.pending || !!buffer?.uncertain} onClick={() => run(prepare)}>새 맥락 준비 입력</button><button disabled={busy || !bound || !sameTarget} onClick={() => run(list)}>확정 임무의 준비 후보 목록</button>
  {!bound ? <p>보관 입력의 사용자·기기가 다릅니다. 원 입력과 미확인 명령은 유지합니다.</p> : !sameTarget ? <p>보관 준비의 확정 임무가 다릅니다. 원 임무로 돌아가세요.</p> : buffer ? <>
   <p>고정 임무 {buffer.assignmentRef.id} · v{buffer.assignmentRef.version} · {buffer.assignmentRef.contentHash}</p><p>예산 참조 {buffer.budgetRef ? '있음 · 실제 예산 미검증' : '없음 · BUDGET_UNVERIFIED'}</p>
   <fieldset disabled={locked}><legend>필수 맥락과 선택 이유</legend>{buffer.input.slots.map(slot => <fieldset key={slot.code}><legend>{labels[slot.code]}</legend><p>{slot.sources.length ? '선택 원문 ' + slot.sources.length + '개 · 현재 권한/효력은 저장 시 재확인' : '원문 미선택 · 필수 누락'}</p>
    <ul>{slot.sources.map((source, index) => <li key={ordered(source)}>{source.kind} · {source.kind === 'USER_INSTRUCTION' ? source.messageRef.id : source.versionRef.id} · {source.kind === 'USER_INSTRUCTION' ? '불변 발언' : 'v' + source.versionRef.version}<code>{source.kind === 'USER_INSTRUCTION' ? source.messageRef.contentHash : source.versionRef.contentHash}</code><button disabled={locked} onClick={() => update(current => { const input = structuredClone(current.input); input.slots.find(item => item.code === slot.code)!.sources.splice(index, 1); return { ...current, input, dirty: true }; })}>이 원문 선택 해제</button></li>)}</ul>
    <label>{labels[slot.code]} 선택/미선택 이유<textarea maxLength={20000} value={slot.reason} onChange={event => update(current => ({ ...current, input: { ...current.input, slots: current.input.slots.map(item => item.code === slot.code ? { ...item, reason: event.target.value } : item) }, dirty: true }))} /></label>
   </fieldset>)}<label>원문을 추가할 필수 슬롯<select value={selected} onChange={event => setSelected(event.target.value as keyof typeof labels)}>{Object.entries(labels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
    <ContextSourcePicker key={selected + ':' + buffer.bindingId} client={client} projectId={confirmed.projectId} code={selected} disabled={locked} run={run} onSelect={attach} />
    <label>준비 이유<textarea maxLength={20000} value={buffer.input.reason} onChange={event => update(current => ({ ...current, input: { ...current.input, reason: event.target.value }, dirty: true }))} /></label>
    <p>부분 최대 {buffer.input.limits.maxPartBytes} UTF8 bytes · 전체 최대 {buffer.input.limits.maxParts}부분 · 실제 Agent 예산 검증 아님</p>
   </fieldset>
   {!buffer.resultRef ? <button disabled={busy || !owner || !sameTarget} onClick={() => run(save)}>{buffer.pending ? '같은 준비 명령 결과 확인' : '준비 저장'}</button> : <><p>준비 저장 영수증 확인 · 본문/현재 상태는 별도 재조회</p><button disabled={busy} onClick={() => run(() => read(buffer.resultRef!))}>저장 후보 정확 재조회</button></>}
   {buffer.pending ? <p>미확인 명령 {buffer.pending.commandId} · 원입력 보존 · 자동 재발행 없음</p> : null}{buffer.failure ? <p role="alert">{buffer.failure.code} · 입력과 명령을 보존했습니다.</p> : null}
   {buffer.pending && buffer.failure && !buffer.uncertain ? <button disabled={busy} onClick={() => { if (confirm('거절된 원 명령을 확인했습니다. 보존한 입력을 수정할까요?')) update(current => ({ ...current, pending: null, failure: null })); }}>거절 확인 후 입력 수정</button> : null}
  </> : <p>확정 임무의 준비 입력은 아직 없습니다.</p>}
  {opened && bound && sameTarget ? <section aria-label="저장 맥락 metadata"><p>이번 조회 원문 대조: {opened.currentCheck.state} · {opened.observedAt} · 실행 준비 판정 아님</p><p>필수 누락: {opened.manifest.missingRequired.join(', ') || '당시 metadata상 없음 · 의미/예산 미검증'}</p><ul>{opened.manifest.items.map(item => <li key={item.itemId}>{labels[item.category as keyof typeof labels]} · 당시 {item.includedState} · {item.reason}</li>)}</ul><p>계획 부분 {opened.manifest.deliveryPlan.parts.length}개 · 실제 전달0</p><ul>{opened.manifest.unverified.map(issue => <li key={issue}>{issue}</li>)}</ul></section> : null}
  {page && bound && sameTarget ? <><ul>{page.items.map(item => <li key={item.ref.id}>{item.ref.id} · {item.currentCheck.state} · 누락 {item.missingRequired.length}개<button disabled={busy} onClick={() => run(() => read(item.ref))}>이 후보 정확 재조회</button></li>)}</ul>{page.hasMore ? <p>이전 후보가 더 있습니다 · 최근50건만 조회, 전체 이력 조회 아님</p> : null}</> : null}
 </section>;
}

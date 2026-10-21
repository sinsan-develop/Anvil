import { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../api/client.ts';
import type { DocumentSession } from '../design-trace/editor-api.ts';
import { readWorkPlan, type WorkPlanView } from '../design-trace/work-plan-api.ts';
import type { AssignmentBuffer } from './assignment-api.ts';
import { applyChildAssignmentTaskSelection } from './assignment-child-task.ts';
import { WorkPlanTaskOriginal } from './work-plan-task-original.ts';

export function AssignmentChildTaskSelection({ client, buffer, session, locked, update, run }: {
  client: ApiClient; buffer: AssignmentBuffer; session: DocumentSession; locked: boolean;
  update: (change: (value: AssignmentBuffer) => AssignmentBuffer) => void; run: (action: () => Promise<void>) => void;
}) {
  const [source, setSource] = useState<{ projectId: string; plan: WorkPlanView } | null>(null);
  const [taskCode, setTaskCode] = useState(buffer.input.definition.taskRef.taskCode);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load() {
    setSource(null);
    const projectId = buffer.projectId, ref = structuredClone(buffer.input.definition.taskRef.planRef);
    const value = await readWorkPlan(client, projectId, ref);
    if (alive.current) { setSource({ projectId, plan: value }); setTaskCode(buffer.input.definition.taskRef.taskCode); }
  }
  return <section aria-label="하위 초안 계획 업무 선택"><h5>하위 초안의 고정 계획 업무</h5>
    <p>부모와 같은 계획의 업무를 선택합니다. 업무 코드만 바꾸며 작성한 목적·목표·산출물과 부모 범위는 그대로입니다. 계획 원문의 현재 확정·권한은 저장 시 서버가 다시 확인합니다.</p>
    <button type="button" disabled={locked || buffer.uncertain} onClick={() => run(load)}>하위 초안의 고정 계획 조회</button>
    {source ? <>
      <label>하위 초안의 계획 업무<select aria-label="하위 초안의 계획 업무" disabled={locked || buffer.uncertain} value={taskCode} onChange={event => setTaskCode(event.target.value)}>
        {source.plan.tasks.map(task => <option key={task.taskCode} value={task.taskCode}>{task.taskCode} · {task.title}</option>)}
      </select></label>
      <WorkPlanTaskOriginal plan={source.plan} taskCode={taskCode} />
      <button type="button" disabled={locked || buffer.uncertain || source.plan.relationalProjection !== 'STORED' || !taskCode}
        onClick={() => run(async () => { applyChildAssignmentTaskSelection(buffer, session, source, taskCode, update, () => alive.current); })}>선택 업무 코드만 하위 초안에 반영</button>
    </> : null}
    <p>현재 초안의 업무 코드: {buffer.input.definition.taskRef.taskCode} · 별도 임무 저장 필요 · 실제 업무 실행 아님</p>
  </section>;
}

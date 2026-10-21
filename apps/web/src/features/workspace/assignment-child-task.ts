import { ApiError } from '../../api/client.ts';
import type { DocumentSession } from '../design-trace/editor-api.ts';
import type { WorkPlanView } from '../design-trace/work-plan-api.ts';
import { ordered } from '../knowledge/review-view.ts';
import type { AssignmentBuffer } from './assignment-api.ts';

const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);
function editable(buffer: AssignmentBuffer, session: DocumentSession) {
  return buffer.ownerUserId === session.user.id && buffer.ownerClientId === session.clientId
    && buffer.input.definition.parentAssignmentRef !== null && !buffer.pending && !buffer.result && !buffer.uncertain;
}

/** 고정 계획을 조회한 뒤 명시 선택한 taskCode만 바꾼다. 저장/현재성·위임 권위는 만들지 않는다. */
export function applyChildAssignmentTaskSelection(buffer: AssignmentBuffer, session: DocumentSession, selection: { projectId: string; plan: WorkPlanView }, taskCode: string,
  update: (change: (current: AssignmentBuffer) => AssignmentBuffer) => void, active: () => boolean) {
  const expected = structuredClone(buffer), selected = structuredClone(selection), source = selected.plan;
  if (!editable(expected, session) || selected.projectId !== expected.projectId || source.relationalProjection !== 'STORED'
    || !same(source.ref, expected.input.definition.taskRef.planRef) || !same(source.designRef, expected.expectedDesignRef)
    || !Array.isArray(source.tasks) || source.tasks.filter(task => task.taskCode === taskCode).length !== 1)
    throw new ApiError('ASSIGNMENT_CHILD_TASK_SELECTION_INVALID');
  if (!active()) return;
  update(current => {
    if (!active() || !editable(current, session) || current.bindingId !== expected.bindingId || current.projectId !== expected.projectId
      || current.controlGeneration !== expected.controlGeneration || !same(current.expectedDesignRef, expected.expectedDesignRef)
      || !same(current.input, expected.input) || !same(current.ref, expected.ref)) return current;
    const value = structuredClone(current);
    value.input.definition.taskRef.taskCode = taskCode; value.dirty = true; value.failure = null;
    return value;
  });
}

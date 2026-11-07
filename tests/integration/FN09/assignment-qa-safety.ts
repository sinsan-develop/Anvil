/** 이 시험의 새 변경 시작만 fence한다. 이미 전송한 원격 작업의 취소/rollback 증명이 아니다. */
export async function assignmentQaMutation<T>(deadline: number, signal: AbortSignal, operation: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  if (signal.aborted || !Number.isFinite(deadline) || now() >= deadline) throw Error('FN09_QA_MUTATION_WINDOW_CLOSED');
  return operation();
}
export async function assignmentQaPreparedMutation<T, R>(deadline: number, signal: AbortSignal, prepare: () => Promise<T>, operation: (value: T) => Promise<R>, now: () => number = Date.now): Promise<R> {
  const value = await assignmentQaMutation(deadline, signal, prepare, now);
  return assignmentQaMutation(deadline, signal, () => operation(value), now);
}
/** 원 실패와 정리 실패를 모두 보존하고 독립 정리 단계는 앞 단계 실패로 생략하지 않는다. */
export async function finishAssignmentQa(primary: unknown, phases: (() => Promise<void>)[]): Promise<void> {
  const failures: unknown[] = primary === null ? [] : [primary];
  for (const phase of phases) try { await phase(); } catch (e) { failures.push(e); }
  if (failures.length) throw new AggregateError(failures, 'FN09_QA_PRIMARY_AND_CLEANUP_FAILURES');
}

import { createElement as h, useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { WorkPlanView } from '../design-trace/work-plan-api.ts';
import { readAssignmentBasisDocument, type AssignmentBasisKind } from './assignment-basis-read.ts';

export function AssignmentBasisDocuments({ client, projectId, plan, busy, run }: { client: ApiClient; projectId: string; plan: Pick<WorkPlanView, 'documentRef' | 'designRef'>; busy: boolean; run: (action: () => Promise<void>) => void }) {
 type Opened = Awaited<ReturnType<typeof readAssignmentBasisDocument>>;
 const [opened, setOpened] = useState<{ binding: string; value: Opened } | null>(null), [failure, setFailure] = useState<ApiError | null>(null);
 const binding = JSON.stringify([projectId, plan.documentRef, plan.designRef]), currentBinding = useRef(binding), ticket = useRef(0), alive = useRef(true);
 currentBinding.current = binding;
 useEffect(() => { alive.current = true; return () => { alive.current = false; ticket.current++; }; }, []);
 async function open(kind: AssignmentBasisKind) {
  const sequence = ++ticket.current; setOpened(null); setFailure(null);
  try {
   const value = await readAssignmentBasisDocument(client, projectId, plan, kind);
   if (alive.current && currentBinding.current === binding && ticket.current === sequence) setOpened({ binding, value });
  } catch (cause) {
   const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
   if (alive.current && currentBinding.current === binding && ticket.current === sequence) setFailure(error);
   throw error;
  }
 }
 const shown = opened?.binding === binding ? opened.value : null;
 return h('section', { 'aria-label': '임무 기준 문서 원문' },
  h('h5', null, '임무 기준 문서 원문'),
  h('p', { className: 'meta' }, '선택 계획에 고정된 문서를 읽습니다. 현재 확정 유효성·소스 접근·실행 허가 확인이 아님. 입력과 미확인 저장 명령을 변경하지 않습니다.'),
  h('p', null, '작업계획서 v' + plan.documentRef.version + ' · ' + plan.documentRef.contentHash),
  h('button', { disabled: busy, onClick: () => run(() => open('PLAN_DOCUMENT')) }, '작업계획서 고정 원문 열기'),
  h('p', null, '설계서 v' + plan.designRef.version + ' · ' + plan.designRef.contentHash),
  h('button', { disabled: busy, onClick: () => run(() => open('DESIGN_DOCUMENT')) }, '설계서 고정 원문 열기'),
  failure ? h('p', { role: 'alert' }, failure.code + ' · 기준 원문 미확인. 이전 본문을 표시하지 않습니다.') : null,
  shown ? h('article', null, h('h6', null, shown.document.title), h('p', null, shown.ref.id + ' · v' + shown.ref.version + ' · ' + shown.ref.contentHash),
   h('p', null, '저장된 확정 이력: ' + (shown.document.confirmed ? '있음' : '없음') + ' · 현재 내용 검토/권한·실행 준비 합격 아님'), h('pre', null, shown.body)) : null);
}

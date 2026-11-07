import { createElement as h } from 'react';
import type { WorkPlanView, PlanRef } from '../design-trace/work-plan-api.ts';

/** 기존 exact 작업계획 조회 결과의 선택 카드만 읽는다. 입력/명령·실행 상태를 만들지 않는다. */
export function WorkPlanTaskOriginal({ plan, taskCode }: { plan: WorkPlanView; taskCode: string }) {
 const selected = plan.tasks.filter(task => task.taskCode === taskCode);
 if (selected.length !== 1) return h('p', { role: 'status' }, '선택 업무 원문 없음 · 업무 선택을 다시 확인하세요.');
 const task = selected[0]!;
 const list = (title: string, values: string[]) => h('div', { key: title }, h('dt', null, title), h('dd', null,
  values.length ? h('ol', null, ...values.map((value, index) => h('li', { key: index }, h('pre', null, value || '미입력')))) : '기재 없음'));
 const reference = (title: string, value: PlanRef) => h('div', { key: title }, h('dt', null, title), h('dd', null, value.id + ' · v' + value.version + ' · ' + value.contentHash));
 return h('details', { 'aria-label': '선택한 작업계획 업무 원문' },
  h('summary', null, '선택 업무 상세: ' + task.taskCode + ' · ' + task.title),
  h('p', { className: 'meta' }, '저장된 계획 정의입니다. 실제 권한·선행 완료·실행 준비를 판정하지 않습니다. 초안을 준비하거나 기존 입력을 변경하지 않습니다.'),
  h('dl', null,
   reference('고정 작업계획', plan.ref), reference('작업계획 문서', plan.documentRef), reference('근거 설계', plan.designRef),
   h('div', null, h('dt', null, '업무 유형 · 책임 역할'), h('dd', null, task.type + ' · ' + task.ownerRole)),
   h('div', null, h('dt', null, '목적'), h('dd', null, h('pre', null, task.purpose))),
   list('입력', task.inputs), list('산출물', task.outputs), list('포함 범위', task.included), list('제외 범위', task.excluded),
   list('계획상 파일 경계 · 실제 접근/수정 허가 아님', task.allowedFileRefs),
   list('착수 선행 정의 · 완료 미확인', task.startPrerequisites), list('검수 선행 정의 · 완료 미확인', task.acceptancePrerequisites),
   list('수행 절차', task.steps), list('완료 조건', task.acceptanceCriteria), list('필수 증거', task.evidenceRequirements),
   h('div', null, h('dt', null, '복구 방법'), h('dd', null, h('pre', null, task.rollback))),
   h('div', null, h('dt', null, '중단·인계 주의사항'), h('dd', null, h('pre', null, task.recoveryNotes)))),
  h('h5', null, '계획상 시험 · 실행 결과 아님'),
  task.testCases.length ? h('ul', null, ...task.testCases.map((test, index) => h('li', { key: index },
   h('p', null, test.id + ' · ' + test.kind), h('p', null, '환경: ' + test.environment),
   h('ol', null, ...test.steps.map((step, n) => h('li', { key: n }, h('pre', null, step)))), h('pre', null, '기대 결과: ' + test.expected)))) : h('p', null, '시험 정의 없음'),
  h('h5', null, '설계·화면 원문 연결'),
  [...task.designRefs, ...task.screenRefs].length ? h('ul', null, ...[...task.designRefs, ...task.screenRefs].map((link, index) => h('li', { key: index }, link.kind + ' · ' + link.localCode + ' · ' + link.anchor + ' · ' + link.id + ' · ' + link.versionRef.id + ' · v' + link.versionRef.version + ' · ' + link.versionRef.contentHash))) : h('p', null, '연결 정의 없음'));
}

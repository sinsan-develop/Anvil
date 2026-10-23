import {createElement as h} from 'react';
import type {AssignmentPage} from './assignment-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {WorkspaceStageSelection} from './api.ts';

export function AssignmentDraftRows({items,busy,currentApplicationRef,stage,onOpen}:{items:AssignmentPage['items'];busy:boolean;currentApplicationRef:PlanRef|null;stage:WorkspaceStageSelection|null;onOpen:(ref:PlanRef)=>void}){
 return h('ul',null,items.map(item=>{
  const task=item.taskRef,ref=task.applicationRef;
  const matches=!!stage&&!!currentApplicationRef&&ref.id===currentApplicationRef.id&&ref.version===currentApplicationRef.version&&ref.contentHash===currentApplicationRef.contentHash&&stage.applicationId===ref.id&&stage.nodeId===task.nodeId;
  return h('li',{key:item.ref.id},h('p',null,`${item.goal||'목표 미입력'} · v${item.ref.version}`),
   h('p',null,`업무 ${task.taskCode} · 고정 단계 ${task.nodeId}`),
   h('p',null,!stage?'선택 단계 없음 · 연계 미확인':matches?'선택 단계와 고정 참조 일치':'선택 단계 또는 적용본과 다름'),
   h('details',null,h('summary',null,'고정 업무 근거 참조'),h('p',null,`작업계획 ${task.planRef.id} · v${task.planRef.version} · ${task.planRef.contentHash}`),h('p',null,`방법론 적용본 ${ref.id} · v${ref.version} · ${ref.contentHash}`)),
   h('p',{className:'meta'},`보관 초안 · 준비 문제 ${item.issueCount}건 · 목록 원본 현재성 미재검사 · 실제 배정·실행 허가 아님`),
   h('button',{type:'button',disabled:busy,onClick:()=>{if(!busy)onOpen({...item.ref});}},`임무 버전 열기: ${item.ref.version}`));
 }));
}

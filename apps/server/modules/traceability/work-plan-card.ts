import {AuthFailure} from '../access/repository.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {analyzePlanDependencies,type PlanDependency,type DependencyIssue} from './plan-dependencies.ts';

export interface PlanTraceRef {kind:'DESIGN_ITEM'|'SCREEN_REGION';id:string;versionRef:VersionRef;localCode:string;anchor:string}
export interface TaskCase {id:string;kind:'NORMAL'|'IMPORTANT_FAILURE'|'DIRECT_IMPACT';steps:string[];expected:string;environment:string}
export interface TaskCard {taskCode:string;type:'SCREEN'|'FUNCTION'|'INTEGRATION'|'PREPARATION';title:string;purpose:string;designRefs:PlanTraceRef[];screenRefs:PlanTraceRef[];ownerRole:string;inputs:string[];outputs:string[];included:string[];excluded:string[];allowedFileRefs:string[];startPrerequisites:string[];acceptancePrerequisites:string[];steps:string[];testCases:TaskCase[];acceptanceCriteria:string[];evidenceRequirements:string[];rollback:string;recoveryNotes:string}
const fields=['taskCode','type','title','purpose','designRefs','screenRefs','ownerRole','inputs','outputs','included','excluded','allowedFileRefs','startPrerequisites','acceptancePrerequisites','steps','testCases','acceptanceCriteria','evidenceRequirements','rollback','recoveryNotes'];
export const exactKeys=(v:unknown,keys:string[]):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export const planText=(v:unknown,max=20_000):v is string=>typeof v==='string'&&v.length<=max&&v.isWellFormed();
const list=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=200&&v.every(s=>planText(s));
const code=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(s);
export function isPlanTraceRef(v:unknown,kind:PlanTraceRef['kind']):v is PlanTraceRef {
  return exactKeys(v,['kind','id','versionRef','localCode','anchor'])&&v.kind===kind&&isVersionRef({id:v.id,version:1,contentHash:'0'.repeat(64)})&&isVersionRef(v.versionRef)&&code(v.localCode)&&typeof v.anchor==='string'&&/^line:[1-9][0-9]{0,7}$/.test(v.anchor);
}
export function analyzeWorkPlanCards(value:unknown) {
  if(!Array.isArray(value)||value.length>200) throw new AuthFailure('WORK_PLAN_CARD_INVALID',422);
  const issues:DependencyIssue[]=[],dependencies:PlanDependency[]=[];
  const issue=(code:string,location:string,message:string)=>issues.push({code,location,message});
  if(!value.length) issue('TASKS_MISSING','tasks','업무 카드를 추가해야 합니다.');
  for(const [index,t] of value.entries()) {
    if(!exactKeys(t,fields)||!code(t.taskCode)||!['SCREEN','FUNCTION','INTEGRATION','PREPARATION'].includes(t.type)
      ||!['title','purpose','ownerRole','rollback','recoveryNotes'].every(k=>planText(t[k],k==='title'?200:20_000))
      ||!['inputs','outputs','included','excluded','allowedFileRefs','startPrerequisites','acceptancePrerequisites','steps','acceptanceCriteria','evidenceRequirements'].every(k=>list(t[k]))
      ||!Array.isArray(t.designRefs)||t.designRefs.length>200||!t.designRefs.every(r=>isPlanTraceRef(r,'DESIGN_ITEM'))||!Array.isArray(t.screenRefs)||t.screenRefs.length>200||!t.screenRefs.every(r=>isPlanTraceRef(r,'SCREEN_REGION'))
      ||!Array.isArray(t.testCases)||t.testCases.length>200||!t.testCases.every(c=>exactKeys(c,['id','kind','steps','expected','environment'])&&code(c.id)&&['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].includes(c.kind)&&list(c.steps)&&planText(c.expected)&&planText(c.environment))
      ||t.allowedFileRefs.some((p:string)=>!p||p.startsWith('/')||p.includes('\\')||p.includes(':')||p.split('/').some(s=>!s||s==='.'||s==='..')||/[\u0000-\u001f]/.test(p))) throw new AuthFailure('WORK_PLAN_CARD_INVALID',422);
    const at=`tasks[${index}]`;
    for(const k of ['title','purpose','ownerRole','rollback','recoveryNotes']) if(!t[k].trim()) issue('CARD_TEXT_MISSING',at+'.'+k,'업무 목적·책임·복구 조건을 입력해야 합니다.');
    for(const k of ['inputs','outputs','included','excluded','allowedFileRefs','steps','acceptanceCriteria','evidenceRequirements']) if(!t[k].length||t[k].some((s:string)=>!s.trim())) issue('CARD_LIST_MISSING',at+'.'+k,'업무 범위·입출력·검수 근거를 명시해야 합니다.');
    if(!t.designRefs.length) issue('DESIGN_LINK_MISSING',at+'.designRefs','실제 설계 항목 연결이 없습니다.');
    if(t.type==='SCREEN'&&!t.screenRefs.length) issue('SCREEN_LINK_MISSING',at+'.screenRefs','화면 업무의 실제 화면 위치 연결이 없습니다.');
    for(const kind of ['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT']) if(!t.testCases.some((c:TaskCase)=>c.kind===kind)) issue('TEST_COVERAGE_MISSING',at+'.testCases','정상·중요 실패·직접 영향 검증을 구분해야 합니다.');
    const tests=new Set<string>();for(const [n,c] of t.testCases.entries()) {if(tests.has(c.id)||!c.steps.length||c.steps.some((s:string)=>!s.trim())||!c.expected.trim()||!c.environment.trim()) issue('TEST_CASE_INCOMPLETE',`${at}.testCases[${n}]`,'중복 시험 코드 또는 시험 절차·기대 결과·환경 누락입니다.');tests.add(c.id);}
    for(const [field,phase] of [['startPrerequisites','START'],['acceptancePrerequisites','ACCEPTANCE']] as const) for(const dep of t[field]) dependencies.push({taskCode:t.taskCode,dependencyTaskCode:dep,phase});
  }
  const analysis=analyzePlanDependencies(value.map(t=>t.taskCode),dependencies);
  return {status:'DRAFT' as const,tasks:structuredClone(value) as TaskCard[],dependencies:analysis.dependencies,issues:[...issues,...analysis.issues]};
}

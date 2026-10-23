import {createElement as h} from 'react';

const invalid = (): never => {throw Error('PLAN_TRACE_COVERAGE_VIEW_INVALID');};
const uuid = (v:unknown):v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const code = (v:unknown):v is string => typeof v==='string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
function object(v:unknown,keys:readonly string[]):Record<string,any> {
  if(!v || typeof v!=='object' || Array.isArray(v) || ![Object.prototype,null].includes(Object.getPrototypeOf(v)) || Object.getOwnPropertySymbols(v).length) return invalid();
  const d=Object.getOwnPropertyDescriptors(v);
  if(Object.keys(d).sort().join(',')!==[...keys].sort().join(',') || !Object.values(d).every(p=>p.enumerable&&'value'in p)) return invalid();
  return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
function list(v:unknown,max:number):unknown[] {
  if(!Array.isArray(v) || Object.getOwnPropertySymbols(v).length) return invalid();
  const d=Object.getOwnPropertyDescriptors(v as object),n=d.length?.value;
  if(!Number.isSafeInteger(n) || n<0 || n>max || Object.keys(d).length!==n+1) return invalid();
  return Array.from({length:n},(_,i)=>{const p=d[String(i)];if(!p || !p.enumerable || !('value'in p)) return invalid();return p.value;});
}
function reference(v:unknown) {
  const r=object(v,['id','version','contentHash']);
  if(!uuid(r.id) || !Number.isSafeInteger(r.version) || r.version<1 || typeof r.contentHash!=='string' || !/^[a-f0-9]{64}$/.test(r.contentHash)) return invalid();
  return {id:r.id,version:r.version,contentHash:r.contentHash};
}
const sameRef=(a:ReturnType<typeof reference>,b:ReturnType<typeof reference>)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const authority=['projectScopeAuthenticated','sourceTextVerified','accepted','completionDetermined','storageMutationPerformed','executionAuthorized'] as const;
const linkReasons={REFERENCE_NOT_FOUND:'대상 없음',REFERENCE_MISMATCH:'정확한 참조 불일치'};
const taskReasons={DESIGN_REFERENCE_ABSENT:'설계 근거 없음',SCREEN_REFERENCE_ABSENT:'시안 근거 없음'};
function label(labels:Readonly<Record<string,string>>,v:unknown):string {
  if(typeof v!=='string' || !Object.hasOwn(labels,v)) return invalid();return labels[v]!;
}
function read(value:unknown,expected:unknown) {
  const e=object(expected,['projectId','designRef','planRef']),design=reference(e.designRef),plan=reference(e.planRef);
  const v=object(value,['projectId','analysis']);
  if(!uuid(e.projectId) || v.projectId!==e.projectId) return invalid();
  const a=object(v.analysis,['designRef','planRef','planIssueCodes',...authority,'status','reason','unlinkedDesignItems','unlinkedScreenRegions','invalidTaskLinks','ungroundedTasks']);
  if(!sameRef(reference(a.designRef),design) || !sameRef(reference(a.planRef),plan) || authority.some(k=>a[k]!==false)) return invalid();
  const issues=list(a.planIssueCodes,200_000).map(c=>{if(!code(c)) return invalid();return c;});
  if(new Set(issues).size!==issues.length) return invalid();
  const base={design,plan,issues};
  if(a.status==='UNAVAILABLE') {
    if(!['DESIGN_INDEX_UNAVAILABLE','PLAN_PROJECTION_UNAVAILABLE'].includes(a.reason) || ['unlinkedDesignItems','unlinkedScreenRegions','invalidTaskLinks','ungroundedTasks'].some(k=>a[k]!==null)) return invalid();
    return {...base,unavailable:true as const,reason:a.reason as string};
  }
  if(a.status!=='UNVERIFIED' || a.reason!=='PLAN_TRACE_COVERAGE_ONLY') return invalid();
  const designItems=list(a.unlinkedDesignItems,200).map(row=>{const r=object(row,['id','localCode']);if(!uuid(r.id)||!code(r.localCode))return invalid();return {id:r.id,localCode:r.localCode};});
  const screens=list(a.unlinkedScreenRegions,200).map(row=>{const r=object(row,['id','screenCode','designItemId']);if(!uuid(r.id)||!uuid(r.designItemId)||!code(r.screenCode))return invalid();return {id:r.id,screenCode:r.screenCode,designItemId:r.designItemId};});
  const links=list(a.invalidTaskLinks,80_000).map(row=>{const r=object(row,['taskCode','kind','referenceId','reason']);if(!code(r.taskCode)||!['DESIGN_ITEM','SCREEN_REGION'].includes(r.kind)||!uuid(r.referenceId))return invalid();return {taskCode:r.taskCode,kind:r.kind==='DESIGN_ITEM'?'설계':'시안',referenceId:r.referenceId,reason:label(linkReasons,r.reason)};});
  const tasks=list(a.ungroundedTasks,200).map(row=>{const r=object(row,['taskCode','reasons']);if(!code(r.taskCode))return invalid();const reasons=list(r.reasons,2).map(v=>label(taskReasons,v));if(!reasons.length||new Set(reasons).size!==reasons.length)return invalid();return {taskCode:r.taskCode,reasons};});
  if(new Set(designItems.map(r=>r.id)).size!==designItems.length || new Set(screens.map(r=>r.id)).size!==screens.length || new Set(tasks.map(r=>r.taskCode)).size!==tasks.length) return invalid();
  return {...base,unavailable:false as const,designItems,screens,links,tasks};
}
function group(title:string,rows:string[],empty='입력 목록 내 누락 없음 · 실제 원문·현재성 미확인') {
  return h('section',{'aria-label':title},h('h4',null,`${title} · ${rows.length}건`),
    rows.length>0?h('ul',null,...rows.slice(0,200).map((row,i)=>h('li',{key:i},row))):h('p',null,empty),
    rows.length>200?h('p',{className:'meta'},`앞 200건 표시 · 나머지 ${rows.length-200}건 생략`):null);
}

/** 기존 분석 결과를 소비하는 내부 표시 후보. Node 분석/API·상태 변경·실제 조회 경로는 등록하지 않는다. */
export function PlanTraceCoverage({value,expected}:{value:unknown;expected:unknown}) {
  let v:ReturnType<typeof read>;
  try {v=read(value,expected);} catch {return h('p',{role:'alert'},'분석 표시 자료를 확인하지 못했습니다. 연결·실제 상태는 미확인입니다.');}
  return h('section',{'aria-label':'설계·작업계획 연결 분석 표시 후보',className:'status-card'},
    h('h3',null,'설계·작업계획 연결 분석'),
    h('p',{className:'meta'},'읽기 전용 표시 후보 · 원문·프로젝트 귀속·현재성은 미확인입니다.'),
    h('p',{className:'meta'},`고정 설계 ${v.design.id} v${v.design.version} · SHA256 ${v.design.contentHash}`),
    h('p',{className:'meta'},`고정 계획 ${v.plan.id} v${v.plan.version} · SHA256 ${v.plan.contentHash}`),
    v.unavailable?h('p',{role:'status'},`분석할 자료 미확인 · ${v.reason==='DESIGN_INDEX_UNAVAILABLE'?'설계 인덱스 미확인':'계획 관계 미확인'}`):h('div',null,
      group('미연결 설계',v.designItems.map(r=>`${r.localCode} · ${r.id}`)),
      group('미연결 시안',v.screens.map(r=>`${r.screenCode} · ${r.id} · 설계 항목 ${r.designItemId}`)),
      group('잘못된 업무 연결',v.links.map(r=>`${r.taskCode} · ${r.kind} · ${r.referenceId} · ${r.reason}`)),
      group('근거 없는 업무',v.tasks.map(r=>`${r.taskCode} · ${r.reasons.join(' / ')}`))),
    group('계획 문제',v.issues,'제공된 계획 문제 코드 없음 · 문제 없음 판정이 아닙니다.'),
    h('p',{className:'meta'},'표시된 연결 분석은 기능 완료·검수 합격·실행 허가가 아닙니다. 실제 상태·3축 판정은 별도로 확인해야 합니다.'));
}

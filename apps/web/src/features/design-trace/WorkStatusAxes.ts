import {createElement as h} from 'react';

const progressLabels={NOT_STARTED:'시작 전',IN_PROGRESS:'작업 중',REVIEW:'검토',TESTING:'테스트',REWORK:'보완 필요',COMPLETED:'완료'};
const featureLabels={IMPLEMENTED_VERIFIED:'구현 완료·핵심 동작 확인',IMPLEMENTED_UNVERIFIED:'구현했지만 동작 미확인',PARTIAL:'부분 구현',NOT_IMPLEMENTED:'미구현'};
const verificationLabels={PASS:'통과',FAIL:'실패',NOT_EXECUTED:'미실행',BLOCKED:'차단',NOT_APPLICABLE:'해당 없음'};
const invalid=():never=>{throw Error('WORK_STATUS_AXES_VIEW_INVALID');};
function object(value:unknown,keys:readonly string[]):Record<string,any>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.getOwnPropertySymbols(value).length)return invalid();
 const d=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(d).sort().join(',')!==[...keys].sort().join(',')||!Object.values(d).every(p=>p.enumerable&&'value'in p))return invalid();
 return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
function list(value:unknown,max:number):unknown[]{
 if(!Array.isArray(value)||Object.getOwnPropertySymbols(value).length)return invalid();
 const d=Object.getOwnPropertyDescriptors(value as object),n=d.length?.value;
 if(!Number.isSafeInteger(n)||n<0||n>max||Object.keys(d).length!==n+1)return invalid();
 return Array.from({length:n},(_,i)=>{const p=d[String(i)];if(!p||!p.enumerable||!('value'in p))return invalid();return p.value;});
}
function reference(value:unknown){
 const r=object(value,['id','version','contentHash']);if(!uuid(r.id)||!Number.isSafeInteger(r.version)||r.version<1||typeof r.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(r.contentHash))return invalid();
 return {id:r.id,version:r.version,contentHash:r.contentHash};
}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function text(value:unknown,max:number):string{
 if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return invalid();return value;
}
function label(labels:Readonly<Record<string,string>>,value:unknown):string{
 if(typeof value!=='string'||!Object.hasOwn(labels,value))return invalid();return labels[value]!;
}
function read(value:unknown,expected:unknown){
 const e=object(expected,['projectId','planRef','taskCode']),plan=reference(e.planRef);
 const v=object(value,['projectId','planRef','taskCode','progress','feature','verification','scope','environment','evidenceRefs','unverified']),p=reference(v.planRef);
 if(!uuid(e.projectId)||v.projectId!==e.projectId||p.id!==plan.id||p.version!==plan.version||p.contentHash!==plan.contentHash
  ||typeof e.taskCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(e.taskCode)||v.taskCode!==e.taskCode)return invalid();
 const progress=label(progressLabels,v.progress),feature=label(featureLabels,v.feature),verification=label(verificationLabels,v.verification);
 const evidenceRefs=list(v.evidenceRefs,200).map(reference),unverified=list(v.unverified,20).map(s=>text(s,1000));
 if(new Set(evidenceRefs.map(r=>JSON.stringify(r))).size!==evidenceRefs.length)return invalid();
 if((v.progress==='COMPLETED'||v.feature==='IMPLEMENTED_VERIFIED'||v.verification==='PASS')&&evidenceRefs.length===0)return invalid();
 return {taskCode:e.taskCode,planRef:plan,progress,feature,verification,scope:text(v.scope,2000),environment:text(v.environment,500),evidenceRefs,unverified};
}
/** 승인된 공식 문구를 분리 표시하는 내부 props 후보. API/DB·자동판정·router·행동 handler는 연결하지 않는다. */
export function WorkStatusAxes({value,expected}:{value:unknown;expected:unknown}){
 let v:ReturnType<typeof read>;
 try{v=read(value,expected);}catch{return h('p',{role:'alert'},'표시 자료를 확인하지 못했습니다. 실제 상태·검수는 미확인입니다.');}
 return h('section',{'aria-label':'업무 상태축 표시 후보',className:'status-card'},
  h('h3',null,`${v.taskCode} · 상태 기록`),
  h('p',{className:'meta'},'읽기 전용 표시 후보입니다. 전달된 기록의 표시이며 실제 상태·검수는 미확인입니다.'),
  h('p',{className:'meta'},`고정 계획 ${v.planRef.id} v${v.planRef.version}`),
  h('dl',null,h('dt',null,'업무 진행'),h('dd',null,v.progress),h('dt',null,'기능 사용 가능성'),h('dd',null,v.feature),h('dt',null,'검증 결과'),h('dd',null,v.verification)),
  h('p',null,`검증 범위: ${v.scope}`),h('p',null,`환경: ${v.environment}`),
  v.evidenceRefs.length>0?h('details',null,h('summary',null,`연결 근거 ${v.evidenceRefs.length}건 · 진위 미확인`),h('ul',null,...v.evidenceRefs.map(r=>h('li',{key:JSON.stringify(r)},`${r.id} v${r.version} · SHA256 ${r.contentHash}`)))):h('p',{role:'status'},'연결 근거 없음 · 실제 검증 미확인'),
  v.unverified.length>0?h('section',{'aria-label':'미확인 항목'},h('h4',null,'미확인 항목'),h('ul',null,...v.unverified.map((s,i)=>h('li',{key:i},s)))):h('p',{className:'meta'},'미확인 항목이 제공되지 않았습니다. 확인이 끝난 것으로 판단하지 않습니다.'),
  h('p',{className:'meta'},'업무 진행·기능 사용 가능성·검증 결과는 별도 기록입니다. 이 표시로 완료·인수·실행을 결정하지 않습니다.'));
}

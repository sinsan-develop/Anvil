import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {analyzePlanTraceCoverageCandidate} from '../../../apps/server/modules/traceability/plan-trace-coverage.ts';
const ui:any=await import(new URL('../../../apps/web/src/features/design-trace/PlanTraceCoverage.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`92000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:2,contentHash:'a'.repeat(64)});
function fixture():any{return {projectId:id(1),analysis:{designRef:ref(2),planRef:ref(3),planIssueCodes:['DESIGN_LINK_MISSING'],projectScopeAuthenticated:false,sourceTextVerified:false,accepted:false,completionDetermined:false,storageMutationPerformed:false,executionAuthorized:false,status:'UNVERIFIED',reason:'PLAN_TRACE_COVERAGE_ONLY',unlinkedDesignItems:[{id:id(4),localCode:'D01'}],unlinkedScreenRegions:[{id:id(5),screenCode:'S01',designItemId:id(4)}],invalidTaskLinks:[{taskCode:'UI01',kind:'DESIGN_ITEM',referenceId:id(6),reason:'REFERENCE_NOT_FOUND'}],ungroundedTasks:[{taskCode:'UI01',reasons:['DESIGN_REFERENCE_ABSENT','SCREEN_REFERENCE_ABSENT']}]}};}
const expected=()=>({projectId:id(1),designRef:ref(2),planRef:ref(3)});
function render(v:unknown=fixture(),e:unknown=expected()){assert.equal(typeof ui.PlanTraceCoverage,'function','누락 연결 읽기전용 표시 미구현');return renderToStaticMarkup(createElement(ui.PlanTraceCoverage,{value:v,expected:e}));}
test('설계·시안 누락과 잘못된 링크·근거 없는 업무·계획 문제를 분리한다',()=>{
 const html=render();for(const s of ['미연결 설계','미연결 시안','잘못된 업무 연결','근거 없는 업무','계획 문제','D01','S01','UI01','설계 근거 없음','시안 근거 없음','대상 없음','DESIGN_LINK_MISSING','원문·프로젝트 귀속·현재성은 미확인','기능 완료·검수 합격·실행 허가가 아닙니다'])assert.ok(html.includes(s),s);assert.doesNotMatch(html,/<button|<input|<form|<a\s|전체 완료|전체 통과/);
});
test('전부 연결된 선언도 확인한 목록의 누락 없음으로만 표시한다',()=>{
 const f=fixture();for(const k of ['unlinkedDesignItems','unlinkedScreenRegions','invalidTaskLinks','ungroundedTasks','planIssueCodes'])f.analysis[k]=[];
 const html=render(f);assert.match(html,/입력 목록 내 누락 없음/);assert.match(html,/미확인/);assert.doesNotMatch(html,/검수 합격입니다|구현 완료|완료율|전체 통과/);
});
test('UNAVAILABLE null 목록은 미확인으로 표시하고 빈 목록과 혼동하지 않는다',()=>{
 for(const reason of ['DESIGN_INDEX_UNAVAILABLE','PLAN_PROJECTION_UNAVAILABLE']){const f=fixture();Object.assign(f.analysis,{status:'UNAVAILABLE',reason,unlinkedDesignItems:null,unlinkedScreenRegions:null,invalidTaskLinks:null,ungroundedTasks:null});const html=render(f);assert.match(html,/분석할 자료 미확인/);assert.doesNotMatch(html,/입력 목록 내 누락 없음|D01|S01|UI01/);}
 const f=fixture();f.analysis.unlinkedDesignItems=null;assert.match(render(f),/분석 표시 자료를 확인하지 못했습니다/);
});
test('다른 프로젝트·정확 버전·권위 true·추가 원문과 잘못된 행은 고정경고로 닫힌다',()=>{
 for(const mutate of [(f:any)=>f.projectId=id(99),(f:any)=>f.analysis.designRef.version++,(f:any)=>f.analysis.planRef.contentHash='b'.repeat(64),(f:any)=>f.analysis.accepted=true,(f:any)=>f.analysis.sourceTextVerified=true,(f:any)=>f.analysis.executionAuthorized=true,(f:any)=>f.analysis.body='PRIVATE_SENTINEL',(f:any)=>f.analysis.status='PASS',(f:any)=>f.analysis.invalidTaskLinks[0].reason='SAFE',(f:any)=>f.analysis.ungroundedTasks[0].reasons=[]]){const f=fixture();mutate(f);const html=render(f);assert.match(html,/분석 표시 자료를 확인하지 못했습니다/);assert.doesNotMatch(html,/PRIVATE_SENTINEL|D01|UI01/);}
});
test('getter를 실행하지 않고 과도한 잘못된 링크는 총건수와 표시 한도를 구분한다',()=>{
 let gets=0;const f=fixture();Object.defineProperty(f.analysis,'accepted',{enumerable:true,get(){gets++;return true;}});assert.match(render(f),/분석 표시 자료를 확인하지 못했습니다/);
 const g=fixture();Object.defineProperty(g.analysis.unlinkedDesignItems,'0',{enumerable:true,get(){gets++;return {id:id(4),localCode:'D01'};}});assert.match(render(g),/분석 표시 자료를 확인하지 못했습니다/);assert.equal(gets,0);
 const many=fixture();many.analysis.invalidTaskLinks=Array.from({length:201},(_,i)=>({taskCode:'TASK'+i,kind:'DESIGN_ITEM',referenceId:id(100+i),reason:'REFERENCE_MISMATCH'}));const html=render(many);assert.match(html,/잘못된 업무 연결 · 201건/);assert.match(html,/앞 200건 표시 · 나머지 1건 생략/);assert.match(html,/TASK199/);assert.doesNotMatch(html,/TASK200/);
});

test('자료 미확인·제공된 문제 코드 없음은 누락 없음이나 정상으로 표시하지 않는다',()=>{
 const f=fixture();Object.assign(f.analysis,{status:'UNAVAILABLE',reason:'PLAN_PROJECTION_UNAVAILABLE',unlinkedDesignItems:null,unlinkedScreenRegions:null,invalidTaskLinks:null,ungroundedTasks:null,planIssueCodes:[]});const html=render(f);assert.match(html,/분석할 자료 미확인/);assert.match(html,/제공된 계획 문제 코드 없음/);assert.doesNotMatch(html,/입력 목록 내 누락 없음/);
});

test('실제 순수 분석 결과를 그대로 받아도 표시만 수행하고 입력을 변경하지 않는다',()=>{
 const design=ref(2),data={documentRef:design,localCode:'D05',title:'설계',anchor:'line:1'},snapshot={documentRef:ref(7),designRef:design,screenReviewRefs:[],tasks:[],dependencies:[],reason:'합성',issues:[],relationalProjection:'STORED'};
 const plan={ref:{id:id(3),version:2,contentHash:contentHash(canonicalJson(snapshot))},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:'2026-10-24T03:00:00.000Z'},e={projectId:id(1),designRef:design,planRef:plan.ref};
 const analysis=analyzePlanTraceCoverageCandidate({projectId:id(1),index:{documentRef:design,items:[{id:id(4),...data,itemHash:contentHash(canonicalJson(data))}],screenRegions:[],status:'INDEXED',observedAt:'2026-10-24T03:00:00.000Z'},plan},e),v={projectId:id(1),analysis},before=structuredClone(v);
 const html=render(v,e);assert.match(html,/D05/);assert.match(html,/TASKS_MISSING/);assert.doesNotMatch(html,/분석 표시 자료를 확인하지 못했습니다|전체 통과/);assert.deepEqual(v,before);
});

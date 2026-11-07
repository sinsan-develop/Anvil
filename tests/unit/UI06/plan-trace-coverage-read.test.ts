import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import {analyzePlanTraceCoverageCandidate} from '../../../apps/server/modules/traceability/plan-trace-coverage.ts';
const m:any=await import(new URL('../../../apps/web/src/features/design-trace/plan-trace-coverage-read.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`93000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:2,contentHash:'a'.repeat(64)}),at='2026-10-24T03:00:00.000Z';
function fixture(options:{plan?:(v:any)=>void;index?:(v:any)=>void;afterPlan?:()=>void;afterIndex?:()=>void;status?:number}={}){
 const design=ref(2),items=[1,2].map(n=>{const data={documentRef:design,localCode:'D0'+n,title:'설계'+n,anchor:'line:'+n};return {id:id(10+n),...data,itemHash:contentHash(canonicalJson(data))};});
 const regionData={designItemId:id(11),screenCode:'S01',documentRef:ref(20),artifactRef:{artifactId:id(30),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/markdown;charset=utf-8'},anchor:'line:1'};
 const index={documentRef:design,items,screenRegions:[{id:id(40),...regionData,regionHash:contentHash(canonicalJson(regionData))}],status:'INDEXED',observedAt:at};
 const task={...blankPlanTask(),taskCode:'UI01',title:'업무',designRefs:[{kind:'DESIGN_ITEM',id:id(11),versionRef:design,localCode:'D01',anchor:'line:1'}],screenRefs:[]};
 const snapshot={documentRef:ref(3),designRef:design,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'합성',issues:[],relationalProjection:'STORED'},plan={ref:{id:id(4),version:2,contentHash:''},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};options.plan?.(plan);const {ref:r,status,executionEvidence,observedAt,...s}=plan;r.contentHash=contentHash(canonicalJson(s));options.index?.(index);
 const selection={projectId:id(1),userId:id(5),clientId:id(6),planRef:structuredClone(plan.ref),designRef:design},calls:string[]=[];
 const client=new ApiClient(async(url,init)=>{assert.equal(init?.method,'GET');const path=String(url);calls.push(path);if(path===`/api/v1/projects/${id(1)}/work-plans/${id(4)}/versions/2`){options.afterPlan?.();if(options.status)return Response.json({code:'AUTH_REQUIRED'},{status:options.status});return Response.json(plan);}if(path===`/api/v1/projects/${id(1)}/design-index?documentId=${id(2)}&version=2`){options.afterIndex?.();return Response.json(index);}throw Error('UNEXPECTED_CALL');});
 return {client,selection,calls,plan,index};
}
function read(f:ReturnType<typeof fixture>,active=()=>true){assert.equal(typeof m.readPlanTraceCoverage,'function','기존 GET 누락 분석 연결 미구현');return m.readPlanTraceCoverage(f.client,f.selection,active);}
const errorCode=(code:string)=>(e:unknown)=>e instanceof ApiError&&e.code===code;
test('기존 정확 두 GET·해시를 소비하고 서버 순수 분석과 같은 미확인 연결을 반환한다',async()=>{
 const f=fixture(),before=structuredClone(f.selection),out=await read(f),e={projectId:f.selection.projectId,designRef:f.selection.designRef,planRef:f.selection.planRef};
 assert.deepEqual(out,{projectId:id(1),analysis:analyzePlanTraceCoverageCandidate({projectId:id(1),index:f.index,plan:f.plan},e)});assert.deepEqual(out.analysis.unlinkedDesignItems,[{id:id(12),localCode:'D02'}]);assert.equal(f.calls.length,2);assert.deepEqual(f.selection,before);
});
test('닫힌 context는 조회0·계획 뒤 단절은 후속 GET0이며 요청 뒤 선택 변이를 채택하지 않는다',async()=>{
 const closed=fixture();await assert.rejects(read(closed,()=>false),errorCode('PLAN_TRACE_COVERAGE_PAUSED'));assert.equal(closed.calls.length,0);
 let active=true;const f=fixture({afterPlan:()=>{active=false;}});await assert.rejects(read(f,()=>active),errorCode('PLAN_TRACE_COVERAGE_PAUSED'));assert.equal(f.calls.length,1);
 let selected:any;const g=fixture({afterPlan:()=>{selected.projectId=id(99);selected.designRef=ref(99);}});selected=g.selection;const out=await read(g);assert.equal(out.projectId,id(1));assert.equal(out.analysis.designRef.id,id(2));assert.equal(g.calls.length,2);
});
test('다른 설계/응답변조·권한거절은 누락0이나 성공으로 반환하지 않는다',async()=>{
 const wrong=fixture();wrong.selection.designRef=ref(99);await assert.rejects(read(wrong),errorCode('PLAN_TRACE_COVERAGE_CHANGED'));assert.equal(wrong.calls.length,1);
 const bad=fixture({index:v=>v.items[0].anchor='line:9'});await assert.rejects(read(bad),errorCode('DESIGN_INDEX_INTEGRITY_FAILED'));
 for(const status of [401,403,404]){const f=fixture({status});await assert.rejects(read(f),(e:any)=>e instanceof ApiError&&e.status===status);assert.equal(f.calls.length,1);}
});
test('미인덱스와 STORED 주장 아래 중복업무는 null 목록으로 남긴다',async()=>{
 const none=fixture({index:v=>{v.items=[];v.screenRegions=[];v.status='NOT_INDEXED';}});const out=await read(none);assert.equal(out.analysis.status,'UNAVAILABLE');assert.equal(out.analysis.unlinkedDesignItems,null);
 const duplicate=fixture({plan:v=>v.tasks.push(structuredClone(v.tasks[0]))});const d=await read(duplicate);assert.equal(d.analysis.reason,'PLAN_PROJECTION_UNAVAILABLE');assert.equal(d.analysis.invalidTaskLinks,null);assert.ok(d.analysis.planIssueCodes.includes('DUPLICATE_TASK_CODE'));
});
test('잘못된 링크를 정합 재해시해도 미연결/불일치로 표시하고 getter 선택은 조회 전에 거절한다',async()=>{
 const f=fixture({plan:v=>v.tasks[0].designRefs[0].anchor='line:2'}),out=await read(f);assert.equal(out.analysis.unlinkedDesignItems.length,2);assert.equal(out.analysis.invalidTaskLinks[0].reason,'REFERENCE_MISMATCH');assert.equal(out.analysis.accepted,false);
 let gets=0;const g=fixture();Object.defineProperty(g.selection,'planRef',{enumerable:true,get(){gets++;return ref(4);}});await assert.rejects(read(g),errorCode('PLAN_TRACE_COVERAGE_SELECTION_INVALID'));assert.equal(gets,0);assert.equal(g.calls.length,0);
});

test('마지막 인덱스 응답 뒤 닫힌 문맥도 분석 결과를 채택하지 않는다',async()=>{
 let active=true;const f=fixture({afterIndex:()=>{active=false;}});await assert.rejects(read(f,()=>active),errorCode('PLAN_TRACE_COVERAGE_PAUSED'));assert.equal(f.calls.length,2);
});

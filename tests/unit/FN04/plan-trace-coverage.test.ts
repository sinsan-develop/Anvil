import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import(new URL('../../../apps/server/modules/traceability/plan-trace-coverage.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:2,contentHash:'a'.repeat(64)}),at='2026-10-24T03:00:00.000Z';
function card():any{return {taskCode:'UI01',type:'SCREEN',title:'합성 업무',purpose:'PRIVATE_PURPOSE',designRefs:[],screenRefs:[],ownerRole:'단계 책임자',inputs:['설계'],outputs:['화면'],included:['표시'],excluded:['실행'],allowedFileRefs:['apps/web/src/view.ts'],startPrerequisites:[],acceptancePrerequisites:[],steps:['조회'],testCases:[{id:'N',kind:'NORMAL',steps:['조회'],expected:'정확버전',environment:'합성'},{id:'F',kind:'IMPORTANT_FAILURE',steps:['거절'],expected:'미노출',environment:'합성'},{id:'I',kind:'DIRECT_IMPACT',steps:['기존조회'],expected:'보존',environment:'합성'}],acceptanceCriteria:['원문 일치'],evidenceRequirements:['기록'],rollback:'이전버전',recoveryNotes:'현재지점'};}
function fixture(){
 const designRef=ref(2),items=[1,2].map(n=>{const data={documentRef:designRef,localCode:'D0'+n,title:'합성 설계'+n,anchor:'line:'+n};return {id:id(10+n),...data,itemHash:contentHash(canonicalJson(data))};}),screens=[1,2].map(n=>{const data={designItemId:id(10+n),screenCode:'S0'+n,documentRef:ref(20+n),artifactRef:{artifactId:id(30+n),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'},anchor:'line:'+n};return {id:id(40+n),...data,regionHash:contentHash(canonicalJson(data))};});
 const task=card();task.designRefs=[{kind:'DESIGN_ITEM',id:items[0]!.id,versionRef:designRef,localCode:'D01',anchor:'line:1'}];task.screenRefs=[{kind:'SCREEN_REGION',id:screens[0]!.id,versionRef:screens[0]!.documentRef,localCode:'S01',anchor:'line:1'}];
 const snapshot={documentRef:ref(3),designRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'합성 계획',issues:[],relationalProjection:'STORED'},plan={ref:{id:id(4),version:1,contentHash:contentHash(canonicalJson(snapshot))},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
 return {input:{projectId:id(1),index:{documentRef:designRef,items,screenRegions:screens,status:'INDEXED',observedAt:at},plan},expected:{projectId:id(1),designRef,planRef:structuredClone(plan.ref)}};
}
function rehash(f:ReturnType<typeof fixture>){const {ref:r,status,executionEvidence,observedAt,...snapshot}=f.input.plan;r.contentHash=contentHash(canonicalJson(snapshot));f.expected.planRef=structuredClone(r);}
function run(f=fixture()){assert.equal(typeof m.analyzePlanTraceCoverageCandidate,'function','설계·계획 coverage 순수 분석 미구현');return m.analyzePlanTraceCoverageCandidate(f.input,f.expected);}
test('업무에 없는 설계·시안을 역방향으로 찾아도 완료/허가로 판정하지 않는다',()=>{
 const f=fixture(),before=structuredClone(f.input),out=run(f);assert.deepEqual(out.unlinkedDesignItems,[{id:id(12),localCode:'D02'}]);assert.deepEqual(out.unlinkedScreenRegions,[{id:id(42),screenCode:'S02',designItemId:id(12)}]);assert.deepEqual(out.invalidTaskLinks,[]);assert.deepEqual(out.ungroundedTasks,[]);assert.equal(out.status,'UNVERIFIED');assert.equal(out.reason,'PLAN_TRACE_COVERAGE_ONLY');for(const k of ['projectScopeAuthenticated','sourceTextVerified','accepted','completionDetermined','storageMutationPerformed','executionAuthorized'])assert.equal(out[k],false);assert.deepEqual(f.input,before);assert.equal(JSON.stringify(out).includes('PRIVATE_PURPOSE'),false);
});
test('선언된 모든 연결이 맞아도 실구현/원문/인수 합격을 만들지 않는다',()=>{
 const f=fixture(),t=f.input.plan.tasks[0]!;t.designRefs.push({kind:'DESIGN_ITEM',id:id(12),versionRef:f.input.index.documentRef,localCode:'D02',anchor:'line:2'});t.screenRefs.push({kind:'SCREEN_REGION',id:id(42),versionRef:ref(22),localCode:'S02',anchor:'line:2'});rehash(f);const out=run(f);assert.deepEqual(out.unlinkedDesignItems,[]);assert.deepEqual(out.unlinkedScreenRegions,[]);assert.equal(out.accepted,false);assert.equal(out.completionDetermined,false);assert.equal(out.status,'UNVERIFIED');
});
test('빈 근거·잘못된 id/fullref/code/anchor는 연결로 세지 않고 별도 문제로 반환한다',()=>{
 const empty=fixture();empty.input.plan.tasks[0]!.designRefs=[];empty.input.plan.tasks[0]!.screenRefs=[];rehash(empty);const missing=run(empty);assert.equal(missing.unlinkedDesignItems.length,2);assert.equal(missing.unlinkedScreenRegions.length,2);assert.deepEqual(missing.ungroundedTasks,[{taskCode:'UI01',reasons:['DESIGN_REFERENCE_ABSENT','SCREEN_REFERENCE_ABSENT']}]);assert.ok(missing.planIssueCodes.includes('DESIGN_LINK_MISSING'));
 for(const patch of [{id:id(99)},{versionRef:{...ref(2),version:3}},{versionRef:{...ref(2),contentHash:'f'.repeat(64)}},{localCode:'D02'},{anchor:'line:2'}]){const f=fixture();Object.assign(f.input.plan.tasks[0]!.designRefs[0],patch);rehash(f);const out=run(f);assert.equal(out.unlinkedDesignItems.length,2);assert.equal(out.invalidTaskLinks.length,1);assert.equal(out.invalidTaskLinks[0].taskCode,'UI01');assert.equal(out.invalidTaskLinks[0].reason,'id'in patch?'REFERENCE_NOT_FOUND':'REFERENCE_MISMATCH');assert.equal(out.accepted,false);}
});
test('다른 프로젝트/문서버전·원hash 변조·가짜 완료는 형식/문맥 오류로 닫힌다',()=>{
 for(const mutate of [(f:any)=>f.input.projectId=id(99),(f:any)=>f.input.index.documentRef={...ref(2),version:3},(f:any)=>f.expected.planRef.version=2,(f:any)=>f.input.plan.ref.contentHash='f'.repeat(64),(f:any)=>f.input.index.items[0].anchor='line:3',(f:any)=>f.input.plan.completed=true]){const f=fixture();mutate(f);assert.throws(()=>run(f),/PLAN_TRACE_COVERAGE_INPUT_INVALID/);}
});
test('미인덱스·관계미확인은 누락0 대신 null 목록의 미확인으로 남긴다',()=>{
 const f=fixture();f.input.index.items=[];f.input.index.screenRegions=[];f.input.index.status='NOT_INDEXED';const none=run(f);assert.equal(none.status,'UNAVAILABLE');assert.equal(none.reason,'DESIGN_INDEX_UNAVAILABLE');assert.equal(none.unlinkedDesignItems,null);assert.equal(none.accepted,false);
 const g=fixture();g.input.plan.relationalProjection='ISSUES_ONLY';rehash(g);const ambiguous=run(g);assert.equal(ambiguous.status,'UNAVAILABLE');assert.equal(ambiguous.reason,'PLAN_PROJECTION_UNAVAILABLE');assert.equal(ambiguous.unlinkedScreenRegions,null);
});
test('getter·중복 인덱스·외부 원문 필드를 실행/숨김 처리하지 않고 반환 참조는 복사한다',()=>{
 let gets=0;const f=fixture();Object.defineProperty(f.input.plan,'tasks',{enumerable:true,get(){gets++;return [];}});assert.throws(()=>run(f),/PLAN_TRACE_COVERAGE_INPUT_INVALID/);assert.equal(gets,0);
 const duplicate=fixture();duplicate.input.index.items.push(structuredClone(duplicate.input.index.items[0]!));assert.throws(()=>run(duplicate),/PLAN_TRACE_COVERAGE_INPUT_INVALID/);
 const g=fixture(),out=run(g);g.input.index.items[1]!.localCode='MUTATED';assert.equal(out.unlinkedDesignItems[0].localCode,'D02');out.designRef.contentHash='f'.repeat(64);assert.equal(g.expected.designRef.contentHash,'a'.repeat(64));
});

test('기존 인덱스의 같은 화면 코드·다른 anchor는 독립 위치로 분석한다',()=>{
 const f=fixture(),first=f.input.index.screenRegions[0]!,{id:oldId,regionHash:oldHash,...payload}=first;
 const data={...payload,anchor:'line:3'};f.input.index.screenRegions.push({id:id(43),...data,regionHash:contentHash(canonicalJson(data))});
 const out=run(f);assert.deepEqual(out.unlinkedScreenRegions,[{id:id(42),screenCode:'S02',designItemId:id(12)},{id:id(43),screenCode:'S01',designItemId:id(11)}]);assert.equal(out.accepted,false);
});

test('STORED 주장도 중복 업무·순환 관계면 재분석 후 null 목록으로 닫힌다',()=>{
 const duplicate=fixture();duplicate.input.plan.tasks.push(structuredClone(duplicate.input.plan.tasks[0]!));rehash(duplicate);
 const cycle=fixture(),second=structuredClone(cycle.input.plan.tasks[0]!);second.taskCode='UI02';second.startPrerequisites=['UI01'];cycle.input.plan.tasks[0]!.startPrerequisites=['UI02'];cycle.input.plan.tasks.push(second);cycle.input.plan.dependencies.push({taskCode:'UI01',dependencyTaskCode:'UI02',phase:'START'} as never,{taskCode:'UI02',dependencyTaskCode:'UI01',phase:'START'} as never);rehash(cycle);
 for(const [f,issue] of [[duplicate,'DUPLICATE_TASK_CODE'],[cycle,'DEPENDENCY_CYCLE']] as const){const out=run(f);assert.equal(f.input.plan.relationalProjection,'STORED');assert.equal(out.status,'UNAVAILABLE');assert.equal(out.reason,'PLAN_PROJECTION_UNAVAILABLE');for(const key of ['unlinkedDesignItems','unlinkedScreenRegions','invalidTaskLinks','ungroundedTasks'])assert.equal(out[key],null);assert.ok(out.planIssueCodes.includes(issue));assert.equal(out.accepted,false);}
});

import test from 'node:test';import assert from 'node:assert/strict';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const m:any=await import('../../../apps/web/src/features/design-trace/work-plan-draft-file.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id='22222222-2222-4222-8222-222222222222',ref={id,version:1,contentHash:'a'.repeat(64)},session={user:{id},clientId:id,csrfToken:'C'.repeat(43)};
function fixture(){const input={documentRef:{...ref},designRef:{...ref},screenReviewRefs:[],tasks:[{...blankPlanTask(),taskCode:'FN01',title:'原 업무'}],reason:'원 이유'},s={bindingId:id,input,planRef:null,pending:null,result:null,uncertain:false,failure:null,designDocumentId:id,designVersion:'1',designIndex:{documentRef:{...ref}}},b:any={ownerUserId:id,projectId:id,documentId:id,baseVersion:1,baseHash:ref.contentHash,pending:null,body:'원문 보존',dirty:true,workPlanState:s};return{b,input};}
function run(b:any,raw:string,s=session){assert.equal(typeof m.importWorkPlanDraftFile,'function');return m.importWorkPlanDraftFile(b,s,raw);}
test('현재 정확 기준에만 업무/선행/시험과 이유를 복사하고 원문·저장 대상·서버 상태는 보존한다',()=>{
 const {b,input}=fixture(),before=structuredClone(b),payload={...input,tasks:[{...blankPlanTask(),taskCode:'FN02',title:'가져온 업무',startPrerequisites:['FN01'],testCases:[{id:'TC01',kind:'NORMAL',steps:['수행'],expected:'결과',environment:'격리'}]}],reason:'파일에서 보완'},next=run(b,JSON.stringify(payload));
 assert.deepEqual(next.workPlanState.input,payload);assert.equal(next.body,b.body);assert.equal(next.projectId,b.projectId);assert.equal(next.workPlanState.bindingId,b.workPlanState.bindingId);assert.equal(next.workPlanState.pending,null);assert.equal(next.workPlanState.planRef,null);assert.equal(next.workPlanState.result,null);assert.deepEqual(b,before);payload.tasks[0]!.title='사후변경';assert.equal(next.workPlanState.input.tasks[0].title,'가져온 업무');
});
test('다른 기준·명령/승인 혼입·잠금·소유자·비밀·중복key·손상은 원입력을 유지하며 거절한다',()=>{
 assert.equal(typeof m.importWorkPlanDraftFile,'function');
 for(const mode of ['document','design','reviews','extra','secret','shape','count','size','duplicate','owner','pending','result','uncertain','sent','approval','decision','traceLink','parentPending','proposal','importing','baseChanged','indexChanged']){
  const {b,input}=fixture(),payload:any=structuredClone(input);
  if(mode==='document')payload.documentRef.version=2;if(mode==='design')payload.designRef.contentHash='b'.repeat(64);if(mode==='reviews')payload.screenReviewRefs=[ref];if(mode==='extra')payload.commandId=id;if(mode==='secret')payload.reason='password=synthetic-invalid-marker';if(mode==='shape')payload.tasks[0].verified=true;if(mode==='count')payload.tasks=Array.from({length:201},()=>input.tasks[0]);if(mode==='size')payload.reason='x'.repeat(2097153);if(mode==='baseChanged')b.baseVersion=2;if(mode==='indexChanged')b.workPlanState.designIndex.documentRef.version=2;if(mode==='owner')b.ownerUserId='33333333-3333-4333-8333-333333333333';if(['pending','result','uncertain','sent','approval','decision','traceLink'].includes(mode))b.workPlanState[mode]=true;if(mode==='parentPending')b.pending={};if(mode==='proposal')b.proposalState={};if(mode==='importing')b.importPreparationId=id;
  const before=structuredClone(b),raw=mode==='duplicate'?JSON.stringify(payload).replace('"reason":','"reason":"discarded","reason":'):JSON.stringify(payload);assert.throws(()=>run(b,raw),e=>e instanceof Error&&'code'in e&&String(e.code).startsWith('WORK_PLAN_DRAFT_FILE_'));assert.deepEqual(b,before);
 }
});
test('작업계획 내보내기도 같은 기준/형식/잠금 검사를 거치고 권한·명령/상태 없이 왕복한다',()=>{
 assert.equal(typeof m.exportWorkPlanDraftFile,'function');const {b,input}=fixture(),before=structuredClone(b),raw=m.exportWorkPlanDraftFile(b,session),next=run(b,raw);
 assert.deepEqual(JSON.parse(raw),input);assert.deepEqual(next.workPlanState.input,input);assert.deepEqual(b,before);
 for(const mode of ['secret','pending','owner']){const {b}=fixture();if(mode==='secret')b.workPlanState.input.reason='password=synthetic-export-marker';if(mode==='pending')b.workPlanState.pending={};if(mode==='owner')b.ownerUserId='33333333-3333-4333-8333-333333333333';assert.throws(()=>m.exportWorkPlanDraftFile(b,session));}
});

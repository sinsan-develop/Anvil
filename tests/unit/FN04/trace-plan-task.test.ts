import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const mod:any=await import('../../../apps/web/src/features/design-trace/trace-plan-task-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(value:unknown)=>contentHash(canonicalJson(value));
function fixture(){
 const projectId=randomUUID(),documentRef={id:randomUUID(),version:2,contentHash:'a'.repeat(64)},designRef={id:randomUUID(),version:1,contentHash:'b'.repeat(64)},task={...blankPlanTask(),taskCode:'FN01',title:'원문 업무',steps:['실제 정의를 보존']},snapshot={documentRef,designRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'고정 계획',issues:[],relationalProjection:'STORED'},ref={id:randomUUID(),version:3,contentHash:hash(snapshot)},view={ref,status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:'2026-10-20T00:00:00Z'},endpoint={kind:'PLAN_TASK',id:ref.id,versionRef:ref,localCode:'FN01'};
 return{projectId,task,view,endpoint};
}
test('trace의정확계획버전과업무ID로원문카드만읽고늦은결과는버린다',async()=>{
 assert.equal(typeof mod.readTracePlanTask,'function');const f=fixture();let calls=0,active=true;const client=new ApiClient(async(path,init)=>{calls++;assert.equal(path,`/api/v1/projects/${f.projectId}/work-plans/${f.view.ref.id}/versions/3`);assert.equal(init?.method??'GET','GET');return Response.json(f.view);});
 assert.deepEqual(await mod.readTracePlanTask(client,f.projectId,f.endpoint,()=>active),{planRef:f.view.ref,documentRef:f.view.documentRef,designRef:f.view.designRef,task:f.task});assert.equal(calls,1);
 active=false;assert.equal(await mod.readTracePlanTask(client,f.projectId,f.endpoint,()=>active),null);assert.equal(calls,1);
 let release!:()=>void;const pending=new Promise<void>(r=>release=r),lateClient=new ApiClient(async()=>{await pending;return Response.json(f.view);});active=true;const late=mod.readTracePlanTask(lateClient,f.projectId,f.endpoint,()=>active);active=false;release();assert.equal(await late,null);
});
test('trace계획hash변형·없는/중복업무·잘못된종류는현재계획으로대체하지않는다',async()=>{
 assert.equal(typeof mod.readTracePlanTask,'function');for(const kind of['HASH','MISSING','DUPLICATE','KIND']){const f=fixture();let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(f.view);});if(kind==='HASH')f.endpoint.versionRef.contentHash='f'.repeat(64);if(kind==='MISSING')f.endpoint.localCode='FN99';if(kind==='DUPLICATE'){f.view.tasks.push(structuredClone(f.task));const{ref:_,status:__,executionEvidence:___,observedAt:____,...snapshot}=f.view;f.view.ref.contentHash=hash(snapshot);}if(kind==='KIND')f.endpoint.kind='DESIGN_ITEM';await assert.rejects(mod.readTracePlanTask(client,f.projectId,f.endpoint,()=>true));assert.equal(calls,kind==='KIND'?0:1);}
});

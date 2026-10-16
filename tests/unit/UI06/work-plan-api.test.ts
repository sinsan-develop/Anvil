import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='51c0439f-791e-4bb5-8471-70938d6afaf1',id='a6f30000-0000-4000-8000-000000000090',planId='a6f30000-0000-4000-8000-000000000091',user='32b5f276-13e6-4d8a-b93f-27a15d21c788',ref={id,version:1,contentHash:'a'.repeat(64)};
test('작업계획 읽기는 정확 버전/hash와 미연결 실행 상태만 채택하고 위조 완료를 거절한다',async()=>{
  const module=await import('../../../apps/web/src/features/design-trace/work-plan-api.ts').catch(()=>null);assert.ok(module,'실제 작업계획 Web 클라이언트가 필요하다');
  const snapshot={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[],dependencies:[],reason:'초안',issues:[],relationalProjection:'STORED'},planRef={id:planId,version:1,contentHash:contentHash(canonicalJson(snapshot))};
  let value:any={ref:planRef,status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:'2026-10-16T05:00:00Z'},calls:string[]=[];
  const client=new ApiClient(async(path:any)=>{calls.push(String(path));return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});});
  assert.equal((await module.readWorkPlan(client,pid,planRef)).status,'DRAFT');assert.equal(calls[0],`/api/v1/projects/${pid}/work-plans/${planId}/versions/1`);
  value={...value,status:'COMPLETED'};await assert.rejects(module.readWorkPlan(client,pid,planRef));value={...value,status:'DRAFT',reason:'변조'};await assert.rejects(module.readWorkPlan(client,pid,planRef));
  const fakeSnapshot={...snapshot,tasks:[{taskCode:'FN01',status:'COMPLETED'}]},fakeRef={...planRef,contentHash:contentHash(canonicalJson(fakeSnapshot))};value={...value,...fakeSnapshot,ref:fakeRef};await assert.rejects(module.readWorkPlan(client,pid,fakeRef),'해시만 맞춘 가짜 완료 카드는 실제 계획이 아니다');
});
test('작업계획 쓰기는 다른 주체·중단 화면·변조 명령을 전송하지 않는다',async()=>{
  const module=await import('../../../apps/web/src/features/design-trace/work-plan-api.ts').catch(()=>null);assert.ok(module,'실제 작업계획 Web 클라이언트가 필요하다');
  const session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)};
  const b:any={ownerUserId:user,projectId:pid,documentId:id,baseVersion:1,baseHash:ref.contentHash,controlGeneration:1,pending:null};b.workPlanState=module.newWorkPlan(b);b.workPlanState.input.designRef=ref;b.workPlanState.input.reason='초안 준비';
  assert.throws(()=>module.prepareWorkPlan(b,{...session,user:{id:planId}}));b.workPlanState.pending=module.prepareWorkPlan(b,session);
  let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('전송 금지');});
  await assert.rejects(module.sendWorkPlan(client,b,session,()=>false));assert.equal(calls,0);b.workPlanState.pending.operation='confirmDocument';await assert.rejects(module.sendWorkPlan(client,b,session,()=>true));assert.equal(calls,0);
});

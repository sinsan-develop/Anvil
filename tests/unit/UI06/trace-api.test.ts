import {test}from'node:test';import assert from'node:assert/strict';import{ApiClient}from'../../../apps/web/src/api/client.ts';
const pid='51c0439f-791e-4bb5-8471-70938d6afaf1',ref={id:'a6f30000-0000-4000-8000-000000000090',version:1,contentHash:'a'.repeat(64)};
test('추적 조회는 정확 설계와 방향·cursor만 읽고 미연결 증거를 완료로 바꾸지 않는다',async()=>{
 const module=await import('../../../apps/web/src/features/design-trace/trace-api.ts').catch(()=>null);assert.ok(module,'추적 읽기 client가 필요하다');let path='';let value:any={designRef:ref,direction:'REVERSE',nodes:[],edges:[],traversal:[],missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:false,nextCursor:null,observedAt:'2026-10-16T05:00:00Z'};
 const client=new ApiClient(async(p:any)=>{path=String(p);return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});});
 const v=await module.readTrace(client,pid,ref,'REVERSE','bounded_cursor');assert.equal(v.baselineRef,null);assert.match(path,/direction=REVERSE/);assert.match(path,/cursor=bounded_cursor/);
 value={...value,status:'COMPLETED'};await assert.rejects(module.readTrace(client,pid,ref,'REVERSE',null));delete value.status;value.designRef={...ref,contentHash:'0'.repeat(64)};await assert.rejects(module.readTrace(client,pid,ref,'REVERSE',null));
});
test('업무 추적 쓰기는 저장한 계획 업무/허용 참조만 고정하고 다른 사용자·중단 화면·대상 변조는 전송하지 않는다',async()=>{
 const m=await import('../../../apps/web/src/features/design-trace/trace-api.ts');assert.equal(typeof m.newTaskTrace,'function','업무 추적 쓰기 준비가 필요하다');
 const task={taskCode:'FN01',designRefs:[{kind:'DESIGN_ITEM',id:ref.id,versionRef:ref,localCode:'D01',anchor:'line:1'}],screenRefs:[]},session={user:{id:pid},clientId:pid,csrfToken:'C'.repeat(43)},b:any={ownerUserId:pid,projectId:pid,documentId:ref.id,baseVersion:1,baseHash:ref.contentHash,controlGeneration:1,pending:null,workPlanState:{result:{ref:{...ref,id:pid},designRef:ref,tasks:[task],relationalProjection:'STORED'}}};
 b.workPlanState.traceLink=m.newTaskTrace(b,'FN01');b.workPlanState.traceLink.input.to=task.designRefs[0];b.workPlanState.traceLink.input.reason='원문 연결';assert.throws(()=>m.prepareTaskTrace(b,{...session,user:{id:ref.id}}));b.workPlanState.traceLink.pending=m.prepareTaskTrace(b,session);
 let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('전송 금지');});await assert.rejects(m.sendTaskTrace(client,b,session,()=>false));assert.equal(calls,0);b.workPlanState.traceLink.pending.payload.to={...task.designRefs[0],id:pid};await assert.rejects(m.sendTaskTrace(client,b,session,()=>true));assert.equal(calls,0);
});

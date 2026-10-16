import {test}from'node:test';import assert from'node:assert/strict';import{ApiClient}from'../../../apps/web/src/api/client.ts';
const pid='51c0439f-791e-4bb5-8471-70938d6afaf1',ref={id:'a6f30000-0000-4000-8000-000000000090',version:1,contentHash:'a'.repeat(64)};
test('추적 조회는 정확 설계와 방향·cursor만 읽고 미연결 증거를 완료로 바꾸지 않는다',async()=>{
 const module=await import('../../../apps/web/src/features/design-trace/trace-api.ts').catch(()=>null);assert.ok(module,'추적 읽기 client가 필요하다');let path='';let value:any={designRef:ref,direction:'REVERSE',nodes:[],edges:[],traversal:[],missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:false,nextCursor:null,observedAt:'2026-10-16T05:00:00Z'};
 const client=new ApiClient(async(p:any)=>{path=String(p);return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});});
 const v=await module.readTrace(client,pid,ref,'REVERSE','bounded_cursor');assert.equal(v.baselineRef,null);assert.match(path,/direction=REVERSE/);assert.match(path,/cursor=bounded_cursor/);
 value={...value,status:'COMPLETED'};await assert.rejects(module.readTrace(client,pid,ref,'REVERSE',null));delete value.status;value.designRef={...ref,contentHash:'0'.repeat(64)};await assert.rejects(module.readTrace(client,pid,ref,'REVERSE',null));
});

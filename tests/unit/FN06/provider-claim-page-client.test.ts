import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {fixture,at} from './provider-history-db-fixture.ts';
const m:any=await import('../../../apps/web/src/features/workspace/provider-claim-receipt-api.ts');
function setup(){const f=fixture(),receipt=f.provideClaim(),value=structuredClone({projectId:f.q.projectId,agentSessionId:f.q.agentSessionId,agentSessionRef:f.sessionRef,items:[{query:f.q,receipt}],hasMore:false,nextCursor:null,observedAt:at,historyOnly:true,availability:'UNVERIFIED',executionAuthorized:false,dispatchPerformed:false});return{f,value};}
const read=()=>{assert.equal(typeof m.readProviderClaimPageHistory,'function');return m.readProviderClaimPageHistory;};
test('목록 reader는 고정 예약/ref의 same-origin GET만 하고 원 receipt query를 보존한다',async()=>{
 const {f,value}=setup(),calls:any[]=[];const client=new ApiClient(async(path,init)=>{calls.push({path,init});return Response.json(value);});
 assert.deepEqual(await read()(client,f.q.projectId,f.sessionRef,null,()=>true),value);assert.equal(calls.length,1);assert.equal(calls[0].path,`/api/v1/projects/${f.q.projectId}/agent-sessions/${f.q.agentSessionId}/provider-session-claims?limit=20`);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.credentials,'same-origin');
});
test('다른 예약/hash·중복·권한/READY 승격·receipt 원문추가·cursor 불일치는 채택하지 않는다',async()=>{
 const reader=read();for(const change of [(v:any)=>v.agentSessionRef.contentHash='e'.repeat(64),(v:any)=>v.items[0].query.projectId=v.agentSessionId,(v:any)=>v.items.push(v.items[0]),(v:any)=>v.availability='READY',(v:any)=>v.items[0].receipt.rawHandle='PRIVATE_RAW',(v:any)=>v.hasMore=true,(v:any)=>v.dispatchPerformed=true]){const{f,value}=setup();change(value);await assert.rejects(reader(new ApiClient(async()=>Response.json(value)),f.q.projectId,f.sessionRef,null,()=>true));}
});
test('조회중 이탈은 늦은 페이지를 버리고401·잘못된 입력은 숨겨 성공으로 만들지 않는다',async()=>{
 const reader=read(),{f,value}=setup();let calls=0,active=true;const client=new ApiClient(async()=>{calls++;active=false;return Response.json(value);});assert.equal(await reader(client,f.q.projectId,f.sessionRef,null,()=>false),null);assert.equal(calls,0);assert.equal(await reader(client,f.q.projectId,f.sessionRef,null,()=>active),null);
 await assert.rejects(reader(new ApiClient(async()=>Response.json({code:'AUTH_REQUIRED'},{status:401})),f.q.projectId,f.sessionRef,null,()=>true),(e:any)=>e.status===401);await assert.rejects(reader(client,'../private',f.sessionRef,null,()=>true));assert.equal(calls,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
const m:any=await import('../../../apps/web/src/features/connections/limit-policy-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const s={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},at='2026-10-20T00:00:00.000Z';
const limits={maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1073741824,maxOfflineMs:300000};
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function buffer(){assert.equal(typeof m.newLimitBuffer,'function');const b=m.newLimitBuffer(pid,s,2);b.draft.reason='작업에 사용할 유한 한도';return b;}
function view(command:any){const p=command.payload,snapshot={...p,limits:p.limits??limits,state:command.operation==='applyLimitPolicy'?'APPLIED':'REVOKED',previousRef:null,decidedBy:{kind:'HUMAN',userId:uid},decidedAt:at,expiresAt:'2026-10-20T02:00:00.000Z',executionAuthorized:false,dispatchPerformed:false};return{projectId:pid,ref:{id,version:1,contentHash:hash(snapshot)},snapshot};}
function receipt(c:any){const v=view(c);return{operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:id,version:1,data:{status:'LIMIT_POLICY_APPLIED',ref:v.ref,snapshot:v.snapshot},evidenceRefs:[],warnings:[],serverReceivedAt:at};}
const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
test('회수 영수증의 원 한도·기한 결박을 바꾸면 보관 확인으로 받아들이지 않는다',async()=>{
 const first=buffer();await m.freezeLimitCommand(first,s,'applyLimitPolicy');const base=view(first.pending),b=m.newLimitBuffer(pid,s,2,base);b.draft.reason='한도 회수';await m.freezeLimitCommand(b,s,'revokeLimitPolicy');
 const c=b.pending,snapshot={...base.snapshot,reason:b.draft.reason,state:'REVOKED',previousRef:base.ref,policyBaseVersion:1,expiresAt:'2026-10-20T03:00:00.000Z'},ref={id,version:2,contentHash:hash(snapshot)};
 const r={...receipt(first.pending),commandId:c.commandId,version:2,data:{status:'LIMIT_POLICY_REVOKED',ref,snapshot}};
 await assert.rejects(m.sendLimitCommand(new ApiClient(async()=>json(r)),b,s),{code:'LIMIT_POLICY_RESPONSE_INVALID'});
});
test('늦은 거절은 같은 명령의 결과 불명을 해제하거나 원명령을 버릴 수 없다',async()=>{
 const expected=buffer();await m.freezeLimitCommand(expected,s,'applyLimitPolicy');
 const previous={...structuredClone(expected),uncertain:true,failure:{code:'CONNECTION_LOST',status:0}},late={...structuredClone(expected),uncertain:false,failure:{code:'PROJECT_OPERATION_DENIED',status:403}};
 const settled=m.settleLimitBuffer(previous,expected,late);assert.equal(settled.uncertain,true);assert.deepEqual(settled.pending,expected.pending);
 assert.equal(m.settleLimitBuffer(previous,expected,{...late,pending:null,pendingHash:null}),previous);
});
test('한도 명령을 명시 동결하고 같은 ID/bytes로만 재확인하며 성공 원문을 검증한다',async()=>{
 const b=buffer();await m.freezeLimitCommand(b,s,'applyLimitPolicy');
 const sent:string[]=[],client=new ApiClient(async(_u,i)=>{sent.push(String(i?.body));assert.equal((i?.headers as any)['Idempotency-Key'],b.pending.commandId);return json(receipt(b.pending));});
 const one=await m.sendLimitCommand(client,b,s),two=await m.sendLimitCommand(client,b,s);assert.deepEqual(one,two);assert.equal(sent[0],sent[1]);assert.equal(one.snapshot.executionAuthorized,false);
 b.draft.limits.maxCalls=49;await assert.rejects(m.sendLimitCommand(client,b,s),{code:'LIMIT_PENDING_CHANGED'});assert.equal(sent.length,2);
});
test('한도 입력의 무제한/실행범위/불완전 비용·잘못된 소유자를 허용하지 않는다',async()=>{
 for(const mutate of [(b:any)=>b.draft.limits.maxCalls=0,(b:any)=>b.draft.limits.maxElapsedMs=7200001,(b:any)=>b.draft.limits.maxOfflineMs=300001,(b:any)=>b.draft.limits.maxConcurrentAssignments=2,(b:any)=>b.draft.limits.maxCost=1,(b:any)=>b.ownerClientId=id,(b:any)=>b.draft.reason='password=not-a-real-secret']){
  const b=buffer();mutate(b);await assert.rejects(m.freezeLimitCommand(b,s,'applyLimitPolicy'));assert.equal(b.pending,null);
 }
});
test('고정 조회는 다른 hash/프로젝트·변조 snapshot을 거절하고 실행 허가로 승격하지 않는다',async()=>{
 const b=buffer();await m.freezeLimitCommand(b,s,'applyLimitPolicy');const v=view(b.pending),urls:string[]=[];
 const client=new ApiClient(async u=>{urls.push(String(u));return json(v);});assert.deepEqual(await m.readLimitPolicy(client,pid,v.ref),v);
 await assert.rejects(m.readLimitPolicy(client,pid,{...v.ref,contentHash:'0'.repeat(64)}),{code:'LIMIT_POLICY_RESPONSE_INVALID'});
 v.snapshot.executionAuthorized=true as any;await assert.rejects(m.readLimitPolicy(client,pid,v.ref));assert.equal(urls[0],'/api/v1/projects/'+pid+'/limit-policies/'+id+'/versions/1');
});
test('정책 미설정/금지 우선/승인필요/옛 제어는 저장 허가로 바꾸지 않는다',async()=>{
 assert.equal(typeof m.limitPolicyAccess,'function');
 const rule={subjectRef:{kind:'HUMAN',userId:uid},operations:['applyLimitPolicy'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+60000).toISOString()};
 for(const mode of ['MISSING','DENY','APPROVAL','CONTROL']){
  let posts=0;const client=new ApiClient(async(u,i)=>{if(i?.method==='POST')posts++;return json(String(u).endsWith('permission-policy')?(mode==='MISSING'?{configured:false,policy:null}:{configured:true,policy:{ref:{id,version:1,contentHash:'a'.repeat(64)},rules:mode==='DENY'?[rule,{...rule,disposition:'DENY'}]:[{...rule,disposition:mode==='APPROVAL'?'REQUIRE_APPROVAL':'AUTO'}]}}):{id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:mode==='CONTROL'?3:2,status:'HELD'}});});
  await assert.rejects(m.limitPolicyAccess(client,buffer(),s,'applyLimitPolicy'));assert.equal(posts,0);
 }
});
test('응답 유실과 거절은 보존하며 CAS 정리는 새 초안/동결 명령을 덮지 않는다',async()=>{
 const b=buffer();await m.freezeLimitCommand(b,s,'applyLimitPolicy');
 await assert.rejects(m.sendLimitCommand(new ApiClient(async()=>{throw Error('lost');}),b,s),{code:'CONNECTION_LOST'});assert.ok(b.pending);
 await assert.rejects(m.sendLimitCommand(new ApiClient(async()=>json({code:'VERSION_CONFLICT'},409)),b,s),{code:'VERSION_CONFLICT'});assert.ok(b.pending);
 const next={...structuredClone(b),pending:null},other={...structuredClone(b),bufferId:id};
 assert.deepEqual(m.settleLimitBuffer(b,b,next),next);assert.equal(m.settleLimitBuffer(other,b,next),other);
});

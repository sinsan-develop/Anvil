import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {buildApp} from '../../../apps/server/app.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readProviderClaimReceiptHistory} from '../../../apps/web/src/features/workspace/provider-claim-receipt-api.ts';
import {fixture,pid,at} from './provider-history-db-fixture.ts';
const cookie='__Host-anvil.sid='+'a'.repeat(43);
function setup(t:TestContext){
 t.mock.timers.enable({apis:['Date'],now:Date.parse(at)});let after=()=>{};
 const f=fixture(),auth:any[]=[];
 const repository:any={signProjectCursor:()=>'',signMethodCursor:()=>'',authenticated:async(token:string,csrf:unknown,body:any)=>{auth.push({token,csrf});try{return await body(f.db,f.actor);}finally{after();}}};
 const app=buildApp({},undefined,{repository,origin:'https://localhost:3830'}),url=`/api/v1/projects/${f.q.projectId}/agent-sessions/${f.q.agentSessionId}/provider-session-claim-receipt?`+new URLSearchParams({executionId:f.q.executionId,generation:'1',commandId:f.q.commandId,kind:'THREAD',requestIdDigest:f.q.requestIdDigest,claimHash:f.q.claimHash});
 return{f,app,auth,url,afterAuth:(fn:()=>void)=>after=fn};
}
test('제품 GET은 실제 history/resolver/journal source와 같은 인증tx로 연결하고 client가 제한 응답을 읽는다',async t=>{
 const s=setup(t);try{
  const observations:any[]=[];
  const client=new ApiClient((async(url:any,init:any)=>{const r=await s.app.inject({method:'GET',url,headers:{host:'localhost:3830',cookie}});observations.push({method:init.method,status:r.statusCode,cache:r.headers['cache-control']});return new Response(r.body,{status:r.statusCode,headers:{'content-type':'application/json'}});}) as typeof fetch);
  const out=await readProviderClaimReceiptHistory(client,s.f.q as any,()=>true);assert.equal(out?.found,false);assert.equal(out?.receipt,null);assert.equal(out?.historyOnly,true);assert.deepEqual(observations,[{method:'GET',status:200,cache:'no-store'}]);assert.deepEqual(s.auth,[{token:'a'.repeat(43),csrf:null}]);assert.ok(s.f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')));
 }finally{await s.app.close();}
});
test('익명/중복cookie·connector/execution Bearer·다른host는 인증tx/DB 진입 전에 거절한다',async t=>{
 const s=setup(t);try{
  for(const headers of [{host:'localhost:3830'},{host:'localhost:3830',cookie:cookie+'; '+cookie},{host:'evil.invalid',cookie},{host:'localhost:3830',cookie,authorization:'Bearer av3ct1_'+'a'.repeat(43)},{host:'localhost:3830',cookie,authorization:'Bearer av3ex1_'+'a'.repeat(43)}]){const r=await s.app.inject({method:'GET',url:s.url,headers});assert.ok([401,403].includes(r.statusCode),r.body);}
  assert.equal(s.auth.length,0);assert.equal(s.f.calls.length,0);
 }finally{await s.app.close();}
});
test('추가/중복query·비정규generation·TURN·타예약은 대체하지 않으며 nonOWNER는403이다',async t=>{
 const s=setup(t);try{
  for(const url of [s.url+'&actorId='+pid,s.url+'&generation=1',s.url.replace('generation=1','generation=01'),s.url.replace('kind=THREAD','kind=TURN')]){const r=await s.app.inject({method:'GET',url,headers:{host:'localhost:3830',cookie}});assert.equal(r.statusCode,400,r.body);}
  assert.equal(s.auth.length,0);s.f.member.participation='VIEWER';assert.equal((await s.app.inject({method:'GET',url:s.url,headers:{host:'localhost:3830',cookie}})).statusCode,403);assert.equal(s.f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')),false);
 }finally{await s.app.close();}
});
test('원 row의 정상 receipt/다른hash409와 같은 충돌 중 권한회수403을 구분한다',async t=>{
 const s=setup(t);try{
  const receipt=s.f.provideClaim(),normal=s.url.replace(/claimHash=[a-f0-9]{64}/,'claimHash='+s.f.q.claimHash),wrong=normal.replace(/claimHash=[a-f0-9]{64}/,'claimHash='+'f'.repeat(64));
  const found=await s.app.inject({method:'GET',url:normal,headers:{host:'localhost:3830',cookie}});assert.equal(found.statusCode,200,found.body);assert.deepEqual(found.json().receipt,receipt);
  const conflict=await s.app.inject({method:'GET',url:wrong,headers:{host:'localhost:3830',cookie}});assert.equal(conflict.statusCode,409,conflict.body);assert.equal(conflict.json().code,'PROVIDER_SESSION_CLAIM_CONFLICT');
  s.f.fault('revoke');assert.equal((await s.app.inject({method:'GET',url:wrong,headers:{host:'localhost:3830',cookie}})).statusCode,403);
 }finally{await s.app.close();}
});
test('인증 callback 뒤 COMMIT 대기에 기한을 넘기면 성공 응답을 내보내지 않는다',async t=>{
 const s=setup(t);try{
  s.afterAuth(()=>t.mock.timers.tick(31000));const r=await s.app.inject({method:'GET',url:s.url,headers:{host:'localhost:3830',cookie}});assert.equal(r.statusCode,403,r.body);
 }finally{await s.app.close();}
});
test('충돌 뒤 인증 transaction 종료 대기에서 만료돼도409로 자료 존재를 노출하지 않는다',async t=>{
 const s=setup(t);try{
  s.f.provideClaim();s.afterAuth(()=>t.mock.timers.tick(31000));
  const wrong=s.url.replace(/claimHash=[a-f0-9]{64}/,'claimHash='+'f'.repeat(64)),r=await s.app.inject({method:'GET',url:wrong,headers:{host:'localhost:3830',cookie}});assert.equal(r.statusCode,403,r.body);assert.equal(r.json().code,'PROVIDER_SESSION_HISTORY_REJECTED');
 }finally{await s.app.close();}
});

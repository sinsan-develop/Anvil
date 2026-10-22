import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import {SyntheticProviderClaimHistory} from '../../../apps/server/modules/executions/provider-session-claim-history.ts';
import {providerClaimFixture} from './provider-claim-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../../apps/web/src/features/workspace/provider-claim-receipt-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222',eid='33333333-3333-4333-8333-333333333333',cmd='44444444-4444-4444-8444-444444444444',cid='55555555-5555-4555-8555-555555555555';
const query=()=>({projectId:id,agentSessionId:sid,executionId:eid,generation:2,commandId:cmd,kind:'THREAD',requestIdDigest:'a'.repeat(64),claimHash:'b'.repeat(64)});
const value=()=>({found:true,receipt:{claimRef:{id:cid,version:1,contentHash:'b'.repeat(64)},recordedAt:'2026-10-22T02:00:00.000Z',state:'PROVIDER_CLAIM_RECORDED',sourceVerification:'PROVIDER_CLAIM_ONLY',nonceConsumed:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false},observedAt:'2026-10-22T03:00:00.000Z',historyOnly:true,executionAuthorized:false,dispatchPerformed:false});
function fixture(response:()=>unknown=value){let calls=0,path='',init:any;const client=new ApiClient((async(p:any,i:any)=>{calls++;path=p;init=i;return new Response(JSON.stringify(response()),{headers:{'content-type':'application/json'}});}) as typeof fetch);return{client,calls:()=>calls,path:()=>path,init:()=>init};}
const reader=()=>{assert.equal(typeof m.readProviderClaimReceiptHistory,'function');return m.readProviderClaimReceiptHistory;};
test('목록에서 선택한 원 receipt fullref와 기록시각이 다르면 hash가 같아도 표시를 거절한다',async()=>{for(const mode of['ID','TIME']){const f=fixture(()=>{const v=value();if(mode==='ID')v.receipt.claimRef.id=sid;else v.receipt.recordedAt='2026-10-22T02:00:01.000Z';return v;});await assert.rejects(reader()(f.client,query(),()=>true,value().receipt),(e:any)=>e.code==='PROVIDER_CLAIM_HISTORY_INVALID',mode);}const selected=value().receipt,f=fixture(()=>{selected.claimRef.id=sid;return value();});assert.deepEqual((await reader()(f.client,query(),()=>true,selected)).receipt,value().receipt);});
test('exact HUMAN receipt는 same-origin GET으로 읽고 과거 claim/제한상태만 보존한다',async()=>{
 const f=fixture(),r=await reader()(f.client,query(),()=>true);assert.deepEqual(r,value());assert.equal(f.calls(),1);
 assert.equal(f.path(),`/api/v1/projects/${id}/agent-sessions/${sid}/provider-session-claim-receipt?executionId=${eid}&generation=2&commandId=${cmd}&kind=THREAD&requestIdDigest=${'a'.repeat(64)}&claimHash=${'b'.repeat(64)}`);
 assert.equal(f.init().method,'GET');assert.equal(f.init().credentials,'same-origin');assert.equal(f.init().cache,'no-store');assert.equal(f.init().body,undefined);
});
test('잘못된 사건/해시/추가 입력과 이미 이탈한 화면은 네트워크 조회0이다',async()=>{
 for(const q of [{...query(),projectId:'https://secret.invalid'},{...query(),generation:0},{...query(),kind:'UNKNOWN'},{...query(),claimHash:'x'},{...query(),rawHandle:'PRIVATE_RAW'}]){const f=fixture();await assert.rejects(reader()(f.client,q,()=>true));assert.equal(f.calls(),0);}
 const f=fixture();assert.equal(await reader()(f.client,query(),()=>false),null);assert.equal(f.calls(),0);
});
test('다른 hash/상태/권한승격·시각·원문 추가·미발견 불일치는 응답 채택을 막는다',async()=>{
 for(const change of [(v:any)=>v.receipt.claimRef.contentHash='c'.repeat(64),(v:any)=>v.receipt.state='READY',(v:any)=>v.receipt.workAccepted=true,(v:any)=>v.executionAuthorized=true,(v:any)=>v.receipt.rawHandle='PRIVATE_RAW',(v:any)=>v.receipt.recordedAt='2026-10-23T02:00:00.000Z',(v:any)=>v.found=false]){
  const f=fixture(()=>{const v=value();change(v);return v;});await assert.rejects(reader()(f.client,query(),()=>true));
 }
 const f=fixture(()=>({...value(),found:false,receipt:null}));assert.equal((await reader()(f.client,query(),()=>true)).receipt,null);
});
test('조회 중 입력 변경·이탈은 원 사건을 바꾸거나 늦은 결과를 채택하지 않는다',async()=>{
 const q=query();let active=true;const f=fixture(()=>{q.claimHash='c'.repeat(64);active=false;return value();});assert.equal(await reader()(f.client,q,()=>active),null);assert.match(f.path(),/claimHash=b{64}$/);
 const g=new ApiClient((async()=>new Response(JSON.stringify({code:'AUTH_REQUIRED'}),{status:401,headers:{'content-type':'application/json'}})) as typeof fetch);await assert.rejects(reader()(g,query(),()=>true),(e:any)=>e.code==='AUTH_REQUIRED'&&e.status===401);
});
test('원 서명 수신→메모리 불변 원장→현재 HUMAN 조회 서비스→브라우저 reader가 같은 receipt를 보존한다',async()=>{
 const f=providerClaimFixture(),p=await f.issue(),saved=await new SyntheticProviderSessionClaims(f.store).ingest(f.scope,p.issued.ref,p.proof,p.signature,p.raw);
 const at='2026-10-22T03:00:00.000Z',q={projectId:f.claim.projectId,agentSessionId:f.claim.agentSessionRef.id,executionId:f.claim.execution.id,generation:f.claim.execution.generation,commandId:f.claim.commandId,kind:'THREAD',requestIdDigest:f.claim.source.requestIdDigest,claimHash:contentHash(canonicalJson(f.claim))};
 const service=new SyntheticProviderClaimHistory({transport:'SYNTHETIC_ONLY',transaction:async(_scope,body)=>body({clock:async()=>at,current:async()=>({transport:'SYNTHETIC_ONLY',subject:{kind:'HUMAN',userId:id,clientId:sid,sessionId:cid,credentialGeneration:1},projectId:q.projectId,agentSessionRef:f.claim.agentSessionRef,participation:'OWNER',readPermission:'VERIFIED_CURRENT',responsibleBindingRef:null,checkedAt:at,expiresAt:'2026-10-22T03:30:00.000Z'}),read:async()=>structuredClone(f.state().entries[0])})});
 const client=new ApiClient((async(path:any,init:any)=>{
  assert.equal(init.method,'GET');const url=new URL(path,'https://anvil.invalid');assert.equal(url.pathname,`/api/v1/projects/${q.projectId}/agent-sessions/${q.agentSessionId}/provider-session-claim-receipt`);
  const s=url.searchParams,r=await service.read({projectId:q.projectId,agentSessionId:q.agentSessionId,executionId:s.get('executionId'),generation:Number(s.get('generation')),commandId:s.get('commandId'),kind:s.get('kind'),requestIdDigest:s.get('requestIdDigest'),claimHash:s.get('claimHash')});
  return new Response(JSON.stringify(r.result),{headers:{'content-type':'application/json'}});
 }) as typeof fetch);
 const before=canonicalJson(f.state()),result=await reader()(client,q,()=>true);assert.deepEqual(result.receipt,saved.receipt);assert.equal(result.historyOnly,true);assert.equal(canonicalJson(f.state()),before);
});

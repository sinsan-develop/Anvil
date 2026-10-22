import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import {providerClaimFixture} from './provider-claim-fixture.ts';
const m:any=await import('../../../apps/server/modules/executions/provider-session-claim-history.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
async function fixture(){
 const f=providerClaimFixture(),p=await f.issue(),recorded=await new SyntheticProviderSessionClaims(f.store).ingest(f.scope,p.issued.ref,p.proof,p.signature,p.raw),at='2026-10-22T02:10:00.000Z';
 const query={projectId:f.claim.projectId,agentSessionId:f.claim.agentSessionRef.id,executionId:f.claim.execution.id,generation:1,commandId:f.claim.commandId,kind:'THREAD',requestIdDigest:f.claim.source.requestIdDigest,claimHash:contentHash(canonicalJson(f.claim))};
 let calls=0,readFault='',now=at;
 const access:any={transport:'SYNTHETIC_ONLY',subject:{kind:'HUMAN',userId:f.scope.projectId,clientId:f.scope.executionId,sessionId:f.scope.executionId,credentialGeneration:1},projectId:query.projectId,agentSessionRef:f.claim.agentSessionRef,participation:'OWNER',readPermission:'VERIFIED_CURRENT',responsibleBindingRef:null,checkedAt:at,expiresAt:'2026-10-22T02:20:00.000Z'};
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(_scope:any,body:any)=>body({clock:async()=>now,current:async()=>{calls++;const value=structuredClone(access);if(readFault==='switch'&&calls>1)value.subject.userId=f.claim.claimId;if(readFault==='revoke'&&calls>1)value.readPermission='DENIED';return value;},read:async()=>{if(readFault==='missing')return null;if(readFault==='expire')now='2026-10-22T02:21:00.000Z';return structuredClone(f.state().entries[0]);}})};
 const make=()=>{assert.equal(typeof m.SyntheticProviderClaimHistory,'function');return new m.SyntheticProviderClaimHistory(store);};
 return{f,recorded,query,access,store,make,fault:(v:string)=>readFault=v};
}
test('실행 grant/nonce 만료 뒤에도 현재 OWNER의 정확 원 receipt만 조회하며 쓰기·갱신0이다',async()=>{
 const f=await fixture(),before=canonicalJson(f.f.state()),r=await f.make().read(f.query);
 assert.equal(r.transport,'SYNTHETIC_ONLY');assert.deepEqual(r.result.receipt,f.recorded.receipt);assert.equal(r.result.historyOnly,true);assert.equal(r.result.executionAuthorized,false);assert.equal(r.result.dispatchPerformed,false);assert.equal(r.result.observedAt,'2026-10-22T02:10:00.000Z');assert.equal(canonicalJson(f.f.state()),before);
});
test('RESPONSIBLE은 현재 읽기 허가와 같은 책임예약을 확인하고 일반 조회자는 차단한다',async()=>{
 const f=await fixture();f.access.participation='RESPONSIBLE';f.access.responsibleBindingRef=f.f.claim.responsibleBindingRef;assert.equal((await f.make().read(f.query)).result.found,true);
 f.access.responsibleBindingRef={...f.access.responsibleBindingRef,version:2};await assert.rejects(f.make().read(f.query));f.access.participation='VIEWER';await assert.rejects(f.make().read(f.query));
});
test('미발견은 과거 미저장·안전 판정이 아니며 다른 hash 충돌은 원 결과를 유지한다',async()=>{
 const f=await fixture();f.fault('missing');const r=await f.make().read(f.query);assert.equal(r.result.found,false);assert.equal(r.result.receipt,null);
 const g=await fixture();await assert.rejects(g.make().read({...g.query,claimHash:'f'.repeat(64)}),(e:any)=>e.message==='PROVIDER_SESSION_CLAIM_CONFLICT'&&e.statusCode===409);assert.equal(g.f.state().entries.length,1);
});
test('다른 프로젝트/세션·조회중 actor/허가변경·만료·추가필드는 receipt를 내보내지 않는다',async()=>{
 for(const fault of ['switch','revoke','expire']){const f=await fixture();f.fault(fault);await assert.rejects(f.make().read(f.query));}
 const f=await fixture();for(const q of [{...f.query,projectId:f.f.claim.claimId},{...f.query,agentSessionId:f.f.claim.claimId},{...f.query,generation:2},{...f.query,extra:'PRIVATE_RAW'}])await assert.rejects(f.make().read(q));
 assert.equal(f.f.state().entries.length,1);
});
test('hash 충돌의 오류 응답도 마지막 현재 읽기 허가를 확인한다',async()=>{
 const f=await fixture();f.fault('revoke');await assert.rejects(f.make().read({...f.query,claimHash:'f'.repeat(64)}),(e:any)=>e.message==='PROVIDER_SESSION_HISTORY_REJECTED'&&e.statusCode===403);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerClaimFixture} from './provider-claim-fixture.ts';
import {providerProtectedHandleRef,validateProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
const m:any=await import('../../../apps/server/modules/executions/provider-session-claims.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function service(f:ReturnType<typeof providerClaimFixture>){assert.equal(typeof m.SyntheticProviderSessionClaims,'function');return new m.SyntheticProviderSessionClaims(f.store);}
const run=(s:any,f:any,p:any)=>s.ingest(f.scope,p.issued.ref,p.proof,p.signature,p.raw);
test('정확 THREAD claim은 서명·nonce와 같은 tx에 불변 저장되고 동시/재조회 효과는 하나다',async()=>{
 const f=providerClaimFixture(),p=await f.issue(),s=service(f),before=f.connections(),[a,b]=await Promise.all([run(s,f,p),run(s,f,p)]);assert.deepEqual(a,b);assert.equal(f.connections()-before,2);assert.deepEqual(await run(s,f,p),a);
 assert.equal(f.state().entries.length,1);assert.equal(f.state().results.length,1);assert.equal(f.state().challenges.length,2);assert.equal(f.state().audits.length,1);assert.deepEqual(f.state().audits[0].claimRef,a.receipt.claimRef);assert.equal(a.receipt.claimRef.contentHash,contentHash(canonicalJson(f.claim)));assert.equal(a.receipt.state,'PROVIDER_CLAIM_RECORDED');assert.equal(a.receipt.sourceVerification,'PROVIDER_CLAIM_ONLY');assert.equal(a.executionAuthorized,false);assert.equal(a.receipt.workAccepted,false);
 const second=await f.issue();assert.deepEqual((await run(s,f,second)).receipt,a.receipt);assert.equal(f.state().entries.length,1);assert.equal(f.state().audits.length,1);
});
test('nonce/result/append/bind/final current/COMMIT 실패는 claim과 소비를 전부 rollback하며 원문을 숨긴다',async()=>{
 for(const fault of ['nonce','result','append','bind','current','audit','commit']){const f=providerClaimFixture(),p=await f.issue(),s=service(f);f.fault(fault);await assert.rejects(run(s,f,p),(e:Error)=>e.message==='PROVIDER_SESSION_CLAIM_REJECTED');assert.equal(f.state().entries.length,0);assert.equal(f.state().results.length,0);assert.equal(f.state().challenges.length,1);assert.equal(f.state().audits.length,0);}
});
test('서버의 current·START·permit·localAttempt 불일치와 회수 scope는 쓰기0이다',async()=>{
 for(const change of [(b:any)=>b.fact.writerState='UNKNOWN',(b:any)=>b.fact.intent.assignmentRef.version=2,(b:any)=>b.commandSnapshot.envelope.envelopeHash='b'.repeat(64),(b:any)=>b.localAttemptRef.version=2,(b:any)=>b.permit.snapshot.request.localAttemptRef.version=2,(b:any)=>b.permit.ref.contentHash='b'.repeat(64),(b:any)=>b.fact.checks.permissionPolicy.state='STALE']){const f=providerClaimFixture(),p=await f.issue();change(f.basis);await assert.rejects(run(service(f),f,p));assert.equal(f.state().entries.length,0);assert.equal(f.state().results.length,0);}
 const f=providerClaimFixture(),p=await f.issue();await assert.rejects(service(f).ingest({...f.scope,mode:'RECOVERY'},p.issued.ref,p.proof,p.signature,p.raw));assert.equal(f.state().entries.length,0);
});
test('같은 사건의 다른 본문은 409로 원 receipt를 보존하고 변조 결과를 재구성하지 않는다',async()=>{
 const f=providerClaimFixture(),p=await f.issue(),s=service(f),first=await run(s,f,p),changed={...f.claim,source:{...f.claim.source,responsePayloadDigest:'b'.repeat(64)}},q=await f.issue(changed),before=canonicalJson(f.state());
 await assert.rejects(run(s,f,q),(e:any)=>e.message==='PROVIDER_SESSION_CLAIM_CONFLICT'&&e.statusCode===409);assert.equal(canonicalJson(f.state()),before);assert.deepEqual((await run(s,f,p)).receipt,first.receipt);
 f.state().bindings[0].value.receipt.claimRef.contentHash='f'.repeat(64);await assert.rejects(run(s,f,p));assert.equal(f.state().entries.length,1);
});
test('다른 route·서명·만료·TURN/원문 필드는 저장하지 않고 실제 port fallback도 없다',async()=>{
 const f=providerClaimFixture(),p=await f.issue(f.claim,f.path.replace('provider-session-claims','observations'));await assert.rejects(run(service(f),f,p));assert.equal(f.state().entries.length,0);
 const g=providerClaimFixture(),q=await g.issue();await assert.rejects(service(g).ingest(g.scope,q.issued.ref,q.proof,Buffer.alloc(64).toString('base64url'),q.raw));g.advance(31000);await assert.rejects(run(service(g),g,q));assert.equal(g.state().entries.length,0);
 for(const store of [{transport:'REAL',transaction:async()=>null},{transport:'SYNTHETIC_ONLY'}])assert.throws(()=>new m.SyntheticProviderSessionClaims(store));
 const h=providerClaimFixture(),r=await h.issue({...h.claim,threadId:'PRIVATE_RAW'});await assert.rejects(run(service(h),h,r));assert.equal(h.state().entries.length,0);
});
test('문법상 유효한 TURN도 저장된 THREAD 부모가 없으면 인증 읽기1회 뒤 거절·쓰기0이다',async()=>{
 const f=providerClaimFixture(),{protectedHandleRef:_,...base}=f.claim;
 const binding={...base,claimId:'33333333-3333-4333-8333-333333333333',kind:'TURN',parentThreadClaimRef:validateProviderSessionClaim(f.claim).ref,source:{...base.source,method:'turn/start'}},turn={...binding,protectedHandleRef:providerProtectedHandleRef(binding,'a'.repeat(64))};
 assert.equal(validateProviderSessionClaim(turn,f.claim).claim.kind,'TURN');const p=await f.issue(turn),before=f.connections(),state=canonicalJson(f.state());await assert.rejects(run(service(f),f,p));assert.equal(f.connections(),before+1);assert.equal(canonicalJson(f.state()),state);
});

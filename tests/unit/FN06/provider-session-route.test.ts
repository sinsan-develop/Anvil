import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import {SyntheticExecutionRequestRouter} from '../../../apps/server/modules/executions/execution-routes.ts';
import {providerClaimFixture} from './provider-claim-fixture.ts';
async function fixture(){
 const f=providerClaimFixture(),p=await f.issue(),service=new SyntheticProviderSessionClaims(f.store);let reads=0,fault='',now='2026-10-22T02:00:00.000Z';
 const denied=async()=>{throw Error('UNEXPECTED_SERVICE');};
 const ports:any={transport:'SYNTHETIC_ONLY',clock:()=>now,credentials:{transport:'SYNTHETIC_ONLY',current:async()=>{reads++;if(reads===2&&fault==='late')now='2026-10-22T02:00:31.000Z';return{transport:'SYNTHETIC_ONLY',scope:{...f.scope,credentialGeneration:reads===2&&fault==='revoke'?2:1},checkedAt:now,expiresAt:'2026-10-22T02:02:00.000Z',executionAuthorized:false,dispatchPerformed:false};}},observations:{transport:'SYNTHETIC_ONLY',ingest:denied},permits:{transport:'SYNTHETIC_ONLY',consume:denied},materials:{transport:'SYNTHETIC_ONLY',readWithDeadline:denied},stopInstructions:{transport:'SYNTHETIC_ONLY',read:denied},providerClaims:service};
 const request={method:'POST',path:f.path,query:[],bodyRaw:p.raw,cookie:null,credential:'av3ex1_'+'a'.repeat(43),challengeRef:p.issued.ref,proof:p.proof,signature:p.signature};
 return{f,ports,request,reads:()=>reads,fault:(v:string)=>fault=v,make:()=>new SyntheticExecutionRequestRouter(ports)};
}
test('명시 claim 서비스가 있는 실행 수신 경로만 실제 서명·nonce/불변 claim 소비로 연결한다',async()=>{
 const f=await fixture(),out=await f.make().handle(f.request);assert.equal(out.cacheControl,'no-store');assert.equal(out.data.receipt.state,'PROVIDER_CLAIM_RECORDED');assert.deepEqual(out.data.receipt,f.f.state().entries[0].receipt);assert.equal(f.reads(),2);assert.equal(f.f.state().entries.length,1);assert.equal(f.f.state().audits.length,1);
});
test('미구성/비합성 claim port·회수·본문초과는 조회·저장 전에 거절한다',async()=>{
 const f=await fixture();delete f.ports.providerClaims;await assert.rejects(f.make().handle(f.request));assert.equal(f.reads(),0);assert.equal(f.f.state().entries.length,0);
 const g=await fixture();g.ports.providerClaims={transport:'REAL',ingestWithDeadline:async()=>null};assert.throws(()=>g.make());
 for(const change of [(r:any)=>{r.path=r.path.replace('/provider-session-claims','/recovery/provider-session-claims');r.credential='av3er1_'+'a'.repeat(43);},(r:any)=>r.bodyRaw=' '.repeat(16385)]){const h=await fixture();change(h.request);await assert.rejects(h.make().handle(h.request));assert.equal(h.reads(),0);assert.equal(h.f.state().entries.length,0);}
});
test('수신 COMMIT 뒤 응답 전 기한경과/credential 회수는 성공 응답을 막되 원 claim을 지우거나 재생성하지 않는다',async()=>{
 for(const fault of ['late','revoke']){const f=await fixture();f.fault(fault);await assert.rejects(f.make().handle(f.request),(e:any)=>e.message==='EXECUTION_CLAIM_OUTCOME_UNKNOWN'&&e.statusCode===503);assert.equal(f.f.state().entries.length,1);assert.equal(f.f.state().audits.length,1);assert.equal(f.f.state().results.length,1);}
});

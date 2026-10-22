import test from 'node:test';import assert from 'node:assert/strict';
import {providerClaimFixture} from './provider-claim-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../integration/FN06/provider-claim-owner-read-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const c=providerClaimFixture().claim,receipt={claimRef:{id:c.claimId,version:1,contentHash:contentHash(canonicalJson(c))},recordedAt:c.capturedAt,state:'PROVIDER_CLAIM_RECORDED',sourceVerification:'PROVIDER_CLAIM_ONLY',nonceConsumed:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false},q={projectId:c.projectId,agentSessionId:c.agentSessionRef.id,executionId:c.execution.id,generation:c.execution.generation,commandId:c.commandId,kind:c.kind,requestIdDigest:c.source.requestIdDigest,claimHash:receipt.claimRef.contentHash},seen:any[]=[];
 const app={inject:async(v:any)=>{seen.push(v);const owner=v.headers?.cookie==='__Host-anvil.sid='+'a'.repeat(43),hasCookie=!!v.headers?.cookie;const value=v.url.includes('provider-session-claim-receipt')?{found:true,receipt,observedAt:'2026-10-22T02:00:01.000Z',historyOnly:true,executionAuthorized:false,dispatchPerformed:false}:{projectId:c.projectId,agentSessionId:c.agentSessionRef.id,agentSessionRef:c.agentSessionRef,items:[{query:q,receipt}],hasMore:false,nextCursor:null,observedAt:'2026-10-22T02:00:01.000Z',historyOnly:true,availability:'UNVERIFIED',executionAuthorized:false,dispatchPerformed:false};return{statusCode:owner?200:hasCookie?403:401,body:JSON.stringify(owner?value:{code:hasCookie?'PROVIDER_SESSION_HISTORY_REJECTED':'AUTH_REQUIRED',message:'요청을 처리하지 못했습니다',requestId:'req-1',targetId:null,retryDisposition:'not-retryable',details:{}}),headers:{'content-type':'application/json','cache-control':'no-store'}};}};
 return{claim:c,sessionRef:c.agentSessionRef,expectedReceipt:receipt,app,ownerHeaders:{host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)},outsiderHeaders:{host:'localhost:3830',cookie:'__Host-anvil.sid='+'b'.repeat(43)},seen};
}
test('기존 Webreader로 OWNER 목록·원receipt를 소비하고 타인/무인증 조회는 거절로 확인한다',async()=>{
 const f=fixture(),r=await m.verifyOwnerStoredClaimRead(f);assert.equal(r.ownerReceiptAndListConsumed,true);assert.equal(r.outsiderDenied,true);assert.equal(r.unauthenticatedDenied,true);assert.equal(r.actualProviderObserved,false);assert.equal(r.actualAgentCalls,0);
 assert.equal(f.seen.length,6);assert(f.seen.every(v=>v.method==='GET'&&v.url.startsWith('/api/v1/projects/')&&!v.payload));assert.equal(f.seen[0].url.includes('provider-session-claims?limit=20'),true);
});
test('다른 세션의 claim·다른 원receipt hash 입력은 조회 전에 거절한다',async()=>{
 for(const kind of['SESSION','HASH']){const f=fixture(),change=kind==='SESSION'?{sessionRef:{...f.sessionRef,id:'00000000-0000-4000-8000-000000000001'}}:{expectedReceipt:{...f.expectedReceipt,claimRef:{...f.expectedReceipt.claimRef,contentHash:'0'.repeat(64)}}};await assert.rejects(m.verifyOwnerStoredClaimRead({...f,...change}),/CLAIM_OWNER_READ_SELECTION_MISMATCH/);assert.equal(f.seen.length,0);}
});

test('403/401이어도 보호 receipt가 섞인 거절 응답을 성공한 격리로 취급하지 않는다',async()=>{
 for(const kind of['OUTSIDER','NO_COOKIE','NESTED']){const f=fixture(),original=f.app.inject;f.app.inject=async v=>{const r=await original(v);if(r.statusCode!==(kind==='NO_COOKIE'?401:403))return r;const dto=JSON.parse(r.body);return{...r,body:JSON.stringify(kind==='NESTED'?{...dto,details:{receipt:f.expectedReceipt}}:{...dto,receipt:f.expectedReceipt})};};await assert.rejects(m.verifyOwnerStoredClaimRead(f),/CLAIM_OWNER_READ_DENIAL_CONTENT_INVALID/);}
});

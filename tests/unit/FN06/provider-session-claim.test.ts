import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerBindingHash,providerProtectedHandleRef,validateProviderSessionClaim,verifyProviderHandleBinding} from '../../../contracts/runtime/provider-session-claim-v1.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function input():any{return{schemaVersion:1,claimId:id(1),kind:'THREAD',projectId:id(2),assignmentRef:ref(3),agentSessionRef:ref(4),responsibleBindingRef:ref(5),connectionRef:ref(6),environmentRef:ref(7),executorRegistrationRef:ref(8),execution:{id:id(9),generation:1},commandId:id(10),envelopeHash:'b'.repeat(64),authorizationReceiptRef:ref(11),permitRef:ref(12),localAttemptRef:ref(13),provider:{product:'CODEX_APP_SERVER',version:'0.161.0'},parentThreadClaimRef:null,source:{method:'thread/start',requestIdDigest:'c'.repeat(64),responseRef:ref(14),responsePayloadDigest:'d'.repeat(64)},capturedAt:'2026-10-22T00:00:00.000Z',usableBefore:'2026-10-23T00:00:00.000Z'};}
const cipher='e'.repeat(64);
function claim(i=input()){const bindingHash=contentHash(canonicalJson({domain:'ANVIL_PROVIDER_HANDLE_BINDING_V1',bindingInput:i}));return{...i,protectedHandleRef:{id:i.claimId,version:1,contentHash:contentHash(canonicalJson({format:'DPAPI_CURRENT_USER_V1',bindingHash,ciphertextHash:cipher}))}};}

test('THREAD의 비순환 결박·암호문 ref를 검증하고 원 입력과 분리한다',()=>{
 const i=input(),c=claim(i),expected=contentHash(canonicalJson({domain:'ANVIL_PROVIDER_HANDLE_BINDING_V1',bindingInput:i}));
 assert.equal(providerBindingHash(i),expected);assert.deepEqual(providerProtectedHandleRef(i,cipher),c.protectedHandleRef);
 const v=validateProviderSessionClaim(c);assert.equal(v.ref.contentHash,contentHash(canonicalJson(c)));assert.equal(v.ref.id,id(1));assert.equal(v.ref.version,1);verifyProviderHandleBinding(c,cipher);
 v.claim.source.responsePayloadDigest='f'.repeat(64);assert.equal(c.source.responsePayloadDigest,'d'.repeat(64));
 assert.throws(()=>verifyProviderHandleBinding(c,'f'.repeat(64)),/^Error: PROVIDER_HANDLE_BINDING_INVALID$/);
 assert.notEqual(providerBindingHash({...i,execution:{...i.execution,generation:2}}),expected);
});
test('TURN은 정확한 같은 프로젝트·예약·실행 세대의 THREAD 부모만 받는다',()=>{
 const parent=claim(),parentRef={id:parent.claimId,version:1,contentHash:contentHash(canonicalJson(parent))};
 const i={...input(),claimId:id(20),kind:'TURN',parentThreadClaimRef:parentRef,source:{...input().source,method:'turn/start'}},c=claim(i);
 assert.equal(validateProviderSessionClaim(c,parent).claim.kind,'TURN');
 assert.throws(()=>validateProviderSessionClaim(c),/PROVIDER_SESSION_CLAIM_INVALID/);
 for(const patch of [{projectId:id(21)},{assignmentRef:ref(22)},{execution:{id:id(9),generation:2}},{executorRegistrationRef:ref(23)},{parentThreadClaimRef:{...parentRef,contentHash:'f'.repeat(64)}}])assert.throws(()=>validateProviderSessionClaim(claim({...i,...patch}),parent),/PROVIDER_SESSION_CLAIM_INVALID/);
});
test('알 수 없는 필드·원문·getter·잘못된 형식·24시간 초과를 비밀 없는 오류로 거절한다',()=>{
 for(const patch of [{threadId:'PRIVATE_RAW_HANDLE'},{kind:'ACTIVE'},{provider:{product:'CODEX_APP_SERVER',version:'other'}},{usableBefore:'2026-10-23T00:00:00.001Z'},{usableBefore:'2026-10-22T00:00:00.000Z'},{capturedAt:'2026-10-22T00:00:00Z'},{execution:{id:id(9),generation:0}},{source:{...input().source,method:'turn/start'}},{source:{...input().source,responseRef:ref(1)}}])assert.throws(()=>validateProviderSessionClaim(claim({...input(),...patch})),/^Error: PROVIDER_SESSION_CLAIM_INVALID$/);
 let accessed=0;const raw=claim();Object.defineProperty(raw,'threadId',{enumerable:true,get(){accessed++;throw Error('PRIVATE_RAW_HANDLE');}});assert.throws(()=>validateProviderSessionClaim(raw),/^Error: PROVIDER_SESSION_CLAIM_INVALID$/);assert.equal(accessed,0);
 assert.throws(()=>validateProviderSessionClaim({...claim(),protectedHandleRef:{...ref(1),version:2}}),/PROVIDER_SESSION_CLAIM_INVALID/);
 assert.throws(()=>providerProtectedHandleRef(input(),'PRIVATE_RAW_HANDLE'),/^Error: PROVIDER_SESSION_CLAIM_INVALID$/);
});

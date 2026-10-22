import assert from 'node:assert/strict';
import {test} from 'node:test';
import {providerTurnFixture} from './provider-turn-fixture.ts';
import {providerBindingHash,providerProtectedHandleRef} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {canonicalJson} from '../../../contracts/canonical.ts';
async function module(){return import('../../../apps/connector/runtime/provider-handle-protocol.ts');}
const frame=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v));
async function fixture(){const f=await providerTurnFixture(),{protectedHandleRef:_,...input}=f.parent;return{f,input,claim:f.parent};}
test('고정 capture 요청은 exact 결박·capsule만 pipe로 준비하고 metadata만 읽는다',async()=>{
 const m=await module(),f=await fixture(),request=m.encodeProviderCaptureRequest(f.input,{threadId:'qa-thread',turnId:null});
 try{
  const decoded=JSON.parse(new TextDecoder().decode(request));
  assert.deepEqual(Object.keys(decoded).sort(),['bindingHash','capsule','capturedAt','claimId','kind','operation','usableBefore']);
  assert.equal(decoded.operation,'CREATE_PROVIDER_HANDLE');assert.equal(decoded.bindingHash,providerBindingHash(f.input));assert.equal(decoded.claimId,f.input.claimId);
  assert.equal(Buffer.from(decoded.capsule,'base64url').toString(),canonicalJson({schemaVersion:1,bindingHash:providerBindingHash(f.input),threadId:'qa-thread',turnId:null}));
  const result=m.readProviderCaptureReply(frame({ok:true,data:{ciphertextHash:'f'.repeat(64)}}),f.input);
  assert.deepEqual(result.protectedHandleRef,providerProtectedHandleRef(f.input,'f'.repeat(64)));assert.equal(result.ciphertextHash,'f'.repeat(64));assert.equal(result.executionAuthorized,false);
 }finally{request.fill(0);}
});
test('resolve는 exact claim/cipher 결박과 canonical plaintext만 반환한다',async()=>{
 const m=await module(),f=await fixture(),request=m.encodeProviderResolveRequest(f.claim,'f'.repeat(64));
 const decoded=JSON.parse(new TextDecoder().decode(request));assert.equal(decoded.operation,'RESOLVE_PROVIDER_HANDLE');assert.equal(decoded.ciphertextHash,'f'.repeat(64));assert.equal('capsule'in decoded,false);
 const plaintext=Buffer.from(canonicalJson({schemaVersion:1,bindingHash:providerBindingHash(f.input),threadId:'qa-thread',turnId:null}));
 const bytes=m.readProviderResolveReply(frame({ok:true,data:{ciphertextHash:'f'.repeat(64),plaintext:plaintext.toString('base64url')}}),f.claim,'f'.repeat(64));
 assert.deepEqual(Buffer.from(bytes),plaintext);bytes.fill(0);plaintext.fill(0);request.fill(0);
});
test('원문/추가필드·다른 hash·비canonical base64/복호 capsule·큰응답·helper 실패는 비밀없는 오류다',async()=>{
 const m=await module(),f=await fixture(),plain=Buffer.from(canonicalJson({schemaVersion:1,bindingHash:providerBindingHash(f.input),threadId:'qa-thread',turnId:null})).toString('base64url');
 const good={ok:true,data:{ciphertextHash:'f'.repeat(64),plaintext:plain}};
 const bad=[frame({...good,raw:'PRIVATE_RAW'}),frame({ok:true,data:{...good.data,ciphertextHash:'e'.repeat(64)}}),frame({ok:true,data:{...good.data,plaintext:plain+'='}}),frame({ok:true,data:{...good.data,plaintext:Buffer.from(' '+Buffer.from(plain,'base64url').toString()).toString('base64url')}}),frame({ok:false,error:'PRIVATE_RAW'}),new Uint8Array(16385),new Uint8Array([255]),frame(good).subarray(0,10)];
 for(const bytes of bad)assert.throws(()=>m.readProviderResolveReply(bytes,f.claim,'f'.repeat(64)),/^Error: PROVIDER_HANDLE_PROTOCOL_INVALID$/);
 assert.throws(()=>m.encodeProviderResolveRequest(f.claim,'e'.repeat(64)),/^Error: PROVIDER_HANDLE_PROTOCOL_INVALID$/);
 assert.throws(()=>m.readProviderCaptureReply(frame({ok:true,data:{ciphertextHash:'f'.repeat(64),plaintext:plain}}),f.input),/^Error: PROVIDER_HANDLE_PROTOCOL_INVALID$/);
});
test('TURN 재읽기는 exact 부모 없이 준비/소비하지 않으며 THREAD로 바꾸지 않는다',async()=>{
 const m=await module(),f=await providerTurnFixture(),{protectedHandleRef:_,...input}=f.claim;
 const plaintext=Buffer.from(canonicalJson({schemaVersion:1,bindingHash:providerBindingHash(input),threadId:'qa-thread',turnId:'qa-turn'}));
 const response=frame({ok:true,data:{ciphertextHash:'f'.repeat(64),plaintext:plaintext.toString('base64url')}});
 assert.throws(()=>m.encodeProviderResolveRequest(f.claim,'f'.repeat(64)),/^Error: PROVIDER_HANDLE_PROTOCOL_INVALID$/);
 assert.throws(()=>m.readProviderResolveReply(response,f.claim,'f'.repeat(64)),/^Error: PROVIDER_HANDLE_PROTOCOL_INVALID$/);
 const request=m.encodeProviderResolveRequest(f.claim,'f'.repeat(64),f.parent),result=m.readProviderResolveReply(response,f.claim,'f'.repeat(64),f.parent);
 assert.equal(JSON.parse(new TextDecoder().decode(request)).kind,'TURN');assert.deepEqual(Buffer.from(result),plaintext);
 request.fill(0);result.fill(0);plaintext.fill(0);response.fill(0);
});

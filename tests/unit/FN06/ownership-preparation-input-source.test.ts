import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
import {readOwnershipNativePreparationProfile} from '../../../apps/server/modules/executions/ownership-native-preparation-profile.ts';
const m=await import(new URL('../../../apps/connector/runtime/ownership-preparation-input-source.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const now=Date.now(),selection:Record<string,string>={};
 for(const key of ['installationId','projectId','executionId','userId','clientId','humanSessionId','rootId','runId','preparationId','authorizationReceiptId','policyId','registrationId','observerId'])selection[key]='70000000-0000-4000-8000-000000000001';
 for(const key of ['executionGeneration','controlGeneration','credentialGeneration','processGeneration','preparationVersion','authorizationReceiptVersion','policyVersion','registrationVersion','observerVersion'])selection[key]='1';
 for(const key of ['preparationHash','authorizationReceiptHash','policyHash','registrationHash','observerHash','publicKeyFingerprint','hostHash','workerHash'])selection[key]='a'.repeat(64);
 selection.issuedAt=new Date(now-1000).toISOString();selection.expiresAt=new Date(now+60000).toISOString();
 return{purpose:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY',selection,policyDisposition:'AUTO',registrationScope:'REGISTRATION_STATUS_ONLY',grants:[],checkedAt:new Date(now-100).toISOString(),expiresAt:new Date(now+30000).toISOString(),processCreationAuthorized:false,preparationAuthorized:false,executionAuthorized:false,dispatchPerformed:false,missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER']};
}
function read(profile:unknown,expected:unknown){assert.equal(typeof m.readOwnershipPreparationInputSource,'function','기존 server profile의 실행기 SOURCE 입력 대조가 필요하다');return m.readOwnershipPreparationInputSource(profile,expected);}
const rejected=(profile:unknown,expected:unknown)=>assert.throws(()=>read(profile,expected),{message:'OWNERSHIP_PREPARATION_INPUT_SOURCE_UNAVAILABLE'});
test('원profile의선택/짧은기한을불변입력으로옮기되인증과권한은false',()=>{
 const p=fixture(),v=read(p,p.selection);
 assert.equal(v.purpose,'OWNERSHIP_NATIVE_PREPARATION_INPUT_SOURCE_ONLY');assert.equal(v.selection.rootId,'70000000-0000-4000-8000-000000000001');assert.equal(v.selection.workerHash,'a'.repeat(64));assert.equal(v.expiresAt,p.expiresAt);
 assert.deepEqual(v.grants,[]);for(const k of ['serverAuthenticated','processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(v[k],false);
 p.selection.workerHash='b'.repeat(64);p.missingEvidence.length=0;
 assert.equal(v.selection.workerHash,'a'.repeat(64));assert(v.missingEvidence.includes('AUTHENTICATED_NATIVE_CHANNEL'));
 assert(Object.isFrozen(v));assert(Object.isFrozen(v.selection));assert(Object.isFrozen(v.grants));assert(Object.isFrozen(v.missingEvidence));
});
test('별도프로젝트/세대/hash·추가키와모양변조를거절',()=>{
 for(const key of ['projectId','credentialGeneration','workerHash']){const p=fixture(),expected=structuredClone(p.selection);expected[key]=key==='projectId'?'70000000-0000-4000-8000-000000000002':key==='workerHash'?'b'.repeat(64):'2';rejected(p,expected);}
 for(const key of ['projectId','processGeneration','hostHash','issuedAt']){const p=fixture();p.selection[key]='invalid';rejected(p,p.selection);}
 for(const bad of ['0','01','9007199254740992']){const p=fixture();p.selection.processGeneration=bad;rejected(p,p.selection);}
 const extra=fixture();rejected({...extra,extra:true},extra.selection);rejected(extra,{...extra.selection,extra:'x'});
 const missing=fixture();delete missing.selection.hostHash;rejected(missing,missing.selection);
});
test('권한승격·등록scope확대·grants·미확인삭제를거절',()=>{
 for(const key of ['processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed']){const p=fixture();rejected({...p,[key]:true},p.selection);}
 for(const delta of [{purpose:'OTHER'},{policyDisposition:'REQUIRE_APPROVAL'},{registrationScope:'EXECUTE'},{grants:['EXECUTE']},{missingEvidence:[]},{missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL']},{missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER','BAD\nCODE']}]){const p=fixture();rejected({...p,...delta},p.selection);}
});
test('만료·미래/오래된관측·원기한확장·최대수명을거절',()=>{
 for(const delta of [{checkedAt:new Date(Date.now()+10000).toISOString()},{checkedAt:new Date(Date.now()-20000).toISOString()},{expiresAt:new Date(Date.now()-1).toISOString()},{expiresAt:new Date(Date.now()+90000).toISOString()}]){const p=fixture();rejected({...p,...delta},p.selection);}
 const p=fixture();p.selection.expiresAt=new Date(Date.now()+121000).toISOString();rejected(p,p.selection);
 const future=fixture();future.selection.issuedAt=new Date(Date.now()+10000).toISOString();rejected(future,future.selection);
});
test('getter/symbol입력을실행하지않고거절',()=>{
 const p=fixture();let called=0;const accessor={...p};Object.defineProperty(accessor,'selection',{enumerable:true,get(){called++;return p.selection;}});rejected(accessor,p.selection);assert.equal(called,0);
 rejected({...p,[Symbol('hidden')]:1},p.selection);const selected={...p.selection};Object.defineProperty(selected,'rootId',{enumerable:true,get(){called++;return p.selection.rootId;}});rejected(p,selected);assert.equal(called,0);
});
test('미확인배열의prototype getter/iterator를실행하지않고검사한index만복사',()=>{
 for(const key of ['every','includes',Symbol.iterator]){
  const p=fixture();let called=0;const prototype=Object.create(Array.prototype);
  Object.defineProperty(prototype,key,{get(){called++;throw Error('UNTRUSTED_ARRAY_CALLBACK');}});
  Object.setPrototypeOf(p.missingEvidence,prototype);
  const v=read(p,p.selection);assert.equal(called,0);assert.deepEqual(v.missingEvidence,['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER']);
 }
});
test('기존server원기록투영을source입력으로소비하되실채널로승격하지않음',async(t)=>{
 const f=await ownershipPreparationReceiptFixture();
 // 기존 원기록 fixture는 2026-10-23T00:00:00.010Z 고정시계다. 소비측의 현재도 시험 안에서만 맞춘다.
 t.mock.timers.enable({apis:['Date'],now:f.now.getTime()});
 const p=await readOwnershipNativePreparationProfile(f.db,f.access,f.token,f.csrf,f.prep.snapshot.scope,f.prep.ref),v=read(p,p.selection);
 assert.equal(v.selection.preparationId,f.prep.ref.id);assert.equal(v.selection.authorizationReceiptHash,f.prep.snapshot.authorizationReceiptRef.contentHash);assert.equal(v.serverAuthenticated,false);assert.equal(v.dispatchPerformed,false);
 t.mock.timers.tick(60001);rejected(p,p.selection);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ownershipHumanBasisFixture as fixture} from './ownership-human-basis-fixture.ts';

test('현재 HUMAN·OWNER/제어·정확 정책과 등록 공개키를 읽되 준비/OBSERVE 권한을 만들지 않는다',async()=>{
 const f=await fixture(),v=await f.read();assert.equal(v.purpose,'OWNERSHIP_HUMAN_POLICY_REGISTRATION_BASIS_ONLY');assert.equal(v.preparationAuthorized,false);assert.equal(v.observationRequestAuthorized,false);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.equal(v.approvalRequired,false);
 assert.deepEqual(v.policyRef,f.prep.snapshot.payload.policyRef);assert.deepEqual(v.registrationRef,f.prep.snapshot.registrationRef);assert.equal(v.publicKeySpki,f.registration.public_key_spki);
 assert.deepEqual(v.missingEvidence,['ORIGINAL_PREPARATION_RECEIPT_AND_APPROVAL','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE']);assert(f.calls.every(q=>! /^(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE|SELECT set_config)/.test(q)));
});

test('OWNER·제어·정책 없거나 다름·DENY·기한·등록 회수/공개키 변조를 거절한다',async()=>{
 const changes=[(f:any)=>f.member.participation='VIEWER',(f:any)=>f.control.generation=2,(f:any)=>f.control.revoked_at=new Date(),(f:any)=>f.noPolicy(),(f:any)=>{f.rules[0].disposition='DENY';f.updatePolicy();},(f:any)=>{f.rules[0].operations=['registerConnector'];f.updatePolicy();},(f:any)=>{f.rules[0].expiresAt='2026-10-22T00:00:00.000Z';f.updatePolicy();},(f:any)=>f.noRegistration(),(f:any)=>f.registration.revoked_at=new Date(),(f:any)=>f.registration.connector_status='REVOKED',(f:any)=>f.registration.public_key_spki='invalid',(f:any)=>f.registration.session_id='30000000-0000-4000-8000-000000000099',(f:any)=>f.registration.scope_json.credentialScope='EXECUTION',(f:any)=>f.late()];
 for(const change of changes){const f=await fixture();change(f);await assert.rejects(f.read(),{message:'OWNERSHIP_HUMAN_BASIS_UNAVAILABLE'});}
});

test('REQUIRE_APPROVAL 정책은 미소비 승인을 인정하지 않고 필요한 근거로 남긴다',async()=>{
 const f=await fixture();f.rules[0]!.disposition='REQUIRE_APPROVAL';f.updatePolicy();f.registration.scope_json.policyRef=f.prep.snapshot.payload.policyRef;f.registration.policy_ref=f.prep.snapshot.payload.policyRef;f.updateRegistration();
 const v=await f.read();assert.equal(v.approvalRequired,true);assert.equal(v.preparationAuthorized,false);assert.equal(v.observationRequestAuthorized,false);assert(v.missingEvidence.includes('ORIGINAL_PREPARATION_RECEIPT_AND_APPROVAL'));
});

test('정합 재해시한 다른 등록 scope도 원 사용자/프로젝트/정책과 다르면 거절한다',async()=>{
 for(const change of [(f:any)=>f.scope.subject.userId='30000000-0000-4000-8000-000000000099',(f:any)=>f.scope.installationId='30000000-0000-4000-8000-000000000099',(f:any)=>f.scope.projectId='30000000-0000-4000-8000-000000000099',(f:any)=>f.scope.grants.push('OBSERVE')]){const f=await fixture();change(f);f.updateRegistration();await assert.rejects(f.read(),{message:'OWNERSHIP_HUMAN_BASIS_UNAVAILABLE'});}
});

test('등록 원 지문을 유지한 채 다른 정상 키와 준비 지문을 함께 바꿔도 현재 등록으로 반환하지 않는다',async()=>{
 const f=await fixture(),other=await fixture();
 assert.notEqual(f.scope.expectedHostFingerprint,other.scope.expectedHostFingerprint);
 f.registration.public_key_spki=other.registration.public_key_spki;f.prep.snapshot.payload.publicKeyFingerprint=other.prep.snapshot.payload.publicKeyFingerprint;
 await assert.rejects(f.read(),{message:'OWNERSHIP_HUMAN_BASIS_UNAVAILABLE'});
});

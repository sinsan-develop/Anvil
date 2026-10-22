import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ownershipArchiveFixture} from './ownership-archive-fixture.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-human-basis.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(){
 const f=await ownershipArchiveFixture(),prep=f.requestBasis().preparation,s=prep.snapshot,now=new Date(f.requestBasis().nowMs),end=new Date(now.getTime()+60000),row=f.authRow;
 const rules=[{ruleId:'prepare',subjectRef:{kind:'HUMAN',userId:s.subject.userId},operations:['prepareOwnershipAnchor','registerConnector'],targetScopes:[{kind:'PROJECT',projectId:s.scope.projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:end.toISOString()}];
 const policy={id:s.payload.policyRef.id,head_version:1,rules_json:rules,reason:'synthetic',review_refs:[],content_hash:'',created_at:new Date(now.getTime()-1)};
 const updatePolicy=()=>{policy.content_hash=hash({rules:policy.rules_json,reason:policy.reason,reviewRefs:policy.review_refs});s.payload.policyRef={id:policy.id,version:1,contentHash:policy.content_hash};};updatePolicy();
 const scope={kind:'HOST_TRUST_REGISTRATION',installationId:s.scope.installationId,projectId:s.scope.projectId,subject:{kind:'HUMAN',userId:s.subject.userId,clientId:s.subject.clientId,credentialGeneration:s.subject.credentialGeneration,controlGeneration:s.subject.controlGeneration},policyRef:s.payload.policyRef,expectedHostFingerprint:s.payload.publicKeyFingerprint,hostLabel:'synthetic',expiresAt:end.toISOString(),credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
 const registration={id:s.registrationRef.id,project_id:s.scope.projectId,version:4,state:'ISSUED',requested_by:s.subject.userId,client_id:s.subject.clientId,session_id:s.subject.humanSessionId,credential_generation:1,control_generation:1,revoked_at:null,connector_revoked_at:null,connector_status:'TRUSTED',owner_user_id:s.subject.userId,connector_client_id:s.subject.clientId,connector_credential_generation:1,host_fingerprint:scope.expectedHostFingerprint,expected_host_fingerprint:scope.expectedHostFingerprint,observed_host_fingerprint:scope.expectedHostFingerprint,public_key_spki:f.publicKeySpki,scope_json:scope,scope_digest:hash(scope),policy_ref:s.payload.policyRef,expires_at:end};
 const updateRegistration=()=>{registration.scope_digest=hash(registration.scope_json);s.registrationRef={id:registration.id,version:registration.version,contentHash:hash({registrationId:registration.id,version:registration.version,state:registration.state,scopeDigest:registration.scope_digest})};};updateRegistration();
 const control={actor_id:row.uid,client_id:row.client_id,generation:1,revoked_at:null},member={id:s.scope.projectId,participation:'OWNER',archived_at:null};
 let missingPolicy=false,missingRegistration=false,late=false;const calls:string[]=[];
 const db={async query(sql:string,args:any[]=[]){calls.push(sql);
  if(sql.includes('FROM anvil.auth_sessions')){assert.deepEqual(args,[createHash('sha256').update(f.authToken).digest('hex')]);return{rows:[row]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:late?end:now,transaction_id:'77'}]};
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members')){assert.deepEqual(args,[s.scope.projectId,row.uid]);assert.match(sql,/FOR UPDATE/);return{rows:[member]};}
  if(sql.includes('FROM anvil.project_control')){assert.deepEqual(args,[s.scope.projectId]);return{rows:[control]};}
  if(sql.includes('FROM anvil.permission_policies')){assert.deepEqual(args,[s.scope.projectId]);return{rows:missingPolicy?[]:[policy]};}
  if(sql.includes('FROM anvil.connector_registrations')){assert.deepEqual(args,[s.scope.projectId,s.registrationRef.id]);assert.match(sql,/FOR SHARE OF r,h/);return{rows:missingRegistration?[]:[registration]};}
  throw Error('UNEXPECTED_QUERY');
 },release(){throw Error('CALLER_OWNS_CONNECTION');}} as unknown as PoolClient;
 const read=async()=>{prep.ref.contentHash=hash(prep.snapshot);assert.equal(typeof m.readOwnershipHumanPolicyRegistrationBasis,'function','현재 원자료 검사 source가 필요하다');return m.readOwnershipHumanPolicyRegistrationBasis(db,f.access,f.authToken,f.csrf,prep);};
 return{read,row,prep,policy,rules,scope,registration,control,member,calls,updatePolicy,updateRegistration,noPolicy(){missingPolicy=true;},noRegistration(){missingRegistration=true;},late(){late=true;}};
}

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

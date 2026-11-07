import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
const moduleValue=await import(new URL('../../../apps/server/modules/executions/ownership-native-preparation-profile.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
async function fixture(options:{humanCredentialGeneration?:number;disposition?:'AUTO'|'REQUIRE_APPROVAL'}={}){
 const f=await ownershipPreparationReceiptFixture(options);
 const read=(db:PoolClient=f.db,scope:unknown=f.prep.snapshot.scope,ref:unknown=f.prep.ref)=>{
  assert.equal(typeof moduleValue.readOwnershipNativePreparationProfile,'function','원기록 기반 native profile 투영이 필요하다');
  return moduleValue.readOwnershipNativePreparationProfile(db,f.access,f.token,f.csrf,scope,ref);
 };
 return{...f,read};
}
test('원 준비/current HUMAN·receipt에서 native 32필드를 읽기 투영하되 권한은 없다',async()=>{
 const f=await fixture({humanCredentialGeneration:2}),v=await f.read(),s=v.selection,p=f.prep.snapshot;
 assert.equal(v.purpose,'OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY');assert.equal(Object.keys(s).length,32);
 assert.equal(s.projectId,p.scope.projectId);assert.equal(s.credentialGeneration,'2');assert.equal(s.preparationId,f.prep.ref.id);assert.equal(s.preparationHash,f.prep.ref.contentHash);assert.equal(s.authorizationReceiptHash,p.authorizationReceiptRef.contentHash);assert.equal(s.observerHash,p.payload.observerRef.contentHash);assert.equal(s.hostHash,p.payload.hostHash);assert.equal(s.workerHash,p.payload.workerHash);assert.equal(s.expiresAt,p.expiresAt);
 for(const key of ['installationId','projectId','executionId'])assert.equal(s[key],p.scope[key]);
 for(const key of ['userId','clientId','humanSessionId'])assert.equal(s[key],p.subject[key]);
 for(const key of ['rootId','runId','hostHash','workerHash','publicKeyFingerprint'])assert.equal(s[key],p.payload[key]);
 for(const [name,ref] of Object.entries({preparation:f.prep.ref,authorizationReceipt:p.authorizationReceiptRef,policy:p.payload.policyRef,registration:p.registrationRef,observer:p.payload.observerRef})){assert.equal(s[name+'Id'],ref.id);assert.equal(s[name+'Version'],String(ref.version));assert.equal(s[name+'Hash'],ref.contentHash);}
 for(const [key,value] of Object.entries({executionGeneration:p.scope.executionGeneration,controlGeneration:p.subject.controlGeneration,credentialGeneration:p.subject.credentialGeneration,processGeneration:p.payload.processGeneration}))assert.equal(s[key],String(value));
 assert.equal(s.issuedAt,p.at);assert(Object.values(s).every(v=>typeof v==='string'));
 assert.equal(v.policyDisposition,'AUTO');assert.equal(v.registrationScope,'REGISTRATION_STATUS_ONLY');assert.deepEqual(v.grants,[]);
 for(const key of ['processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(v[key],false);
 assert(v.missingEvidence.includes('AUTHENTICATED_NATIVE_CHANNEL'));assert(v.missingEvidence.includes('VERIFIED_WRITER_NONE_OR_RECLAIM'));
 assert(f.queries.every(q=>! /^(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE|SELECT set_config)/.test(q)));
 f.prep.snapshot.payload.hostHash='f'.repeat(64);assert.notEqual(s.hostHash,f.prep.snapshot.payload.hostHash);
});
test('입력은 scope/ref만 허용하고 변조된 원기록·누락/읽기오류·필요승인은 거절한다',async()=>{
 for(const mode of ['READ','MISSING','FINAL_SESSION','FINAL_POLICY','FINAL_CLOCK']){const f=await fixture();f.mode(mode);await assert.rejects(f.read(),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});}
 const extra=await fixture();await assert.rejects(extra.read(extra.db,{...extra.prep.snapshot.scope,hostHash:'a'.repeat(64)}),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});
 const required=await fixture({disposition:'REQUIRE_APPROVAL'});await assert.rejects(required.read(),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});
 const hash=await fixture();hash.prep.snapshot.payload.hostHash='a'.repeat(64);await assert.rejects(hash.read(),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});
});
test('await 후 caller scope/ref 변경은 선택을 바꾸지 않고 독립 원문 조회 변조는 거절한다',async()=>{
 const f=await fixture(),scope=structuredClone(f.prep.snapshot.scope),ref=structuredClone(f.prep.ref);let changed=false;
 const db={async query(sql:string,args:any[]=[]){if(!changed){changed=true;scope.projectId='changed';ref.contentHash='changed';}return f.db.query(sql,args);}} as unknown as PoolClient;
 const value=await f.read(db,scope,ref);assert.equal(value.selection.projectId,f.prep.snapshot.scope.projectId);assert.equal(value.selection.preparationHash,f.prep.ref.contentHash);
 const g=await fixture();let count=0;const altered={async query(sql:string,args:any[]=[]){const r=await g.db.query(sql,args);if(sql.includes('FROM anvil.execution_ownership_events')&&++count===2)return{rows:r.rows.map(row=>({...row,project_id:'changed'}))};return r;}} as unknown as PoolClient;
 await assert.rejects(g.read(altered),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});
});
test('투영 뒤에도 현재 인증과 원 준비를 재확인해 최종 시점 만료를 거절한다',async()=>{
 const f=await fixture();let count=0;const db={async query(sql:string,args:any[]=[]){if(sql.includes('FROM anvil.execution_ownership_events')&&++count===2)f.late();return f.db.query(sql,args);}} as unknown as PoolClient;
 await assert.rejects(f.read(db),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});
});
test('원 deadline을 고치지 않고 현재 재인증의 짧은 기한을 별도로 보존한다',async()=>{
 const f=await fixture(),short=new Date(f.now.getTime()+1000);f.row.reauth_until=short;
 const value=await f.read();assert.equal(value.expiresAt,short.toISOString());assert.equal(value.selection.expiresAt,f.prep.snapshot.expiresAt);assert(Date.parse(value.expiresAt)<Date.parse(value.selection.expiresAt));
});
test('비OWNER와 등록/제어 회수는 profile만 조회하더라도 거절한다',async()=>{
 for(const change of [(f:any)=>f.member.participation='VIEWER',(f:any)=>f.registration.revoked_at=f.now,(f:any)=>f.control.revoked_at=f.now,(f:any)=>f.noRegistration()]){const f=await fixture();change(f);await assert.rejects(f.read(),{message:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE'});}
});

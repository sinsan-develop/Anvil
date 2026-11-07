import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readTrustListQuery,trustScopeProjection} from '../../../apps/server/modules/connections/project-registration-reads.ts';
test('HUMAN 신뢰 목록 query는 한정된 scalar 페이지 입력만 허용한다',()=>{
 assert.deepEqual(readTrustListQuery({}),{limit:50,cursor:null});assert.deepEqual(readTrustListQuery({limit:'200',cursor:'abc.def'}),{limit:200,cursor:'abc.def'});
 for(const value of [{limit:'201'},{limit:['1']},{cursor:['x']},{cursor:''},{limit:'01'},{filter:'CREATED'},{cursor:'x'.repeat(4097)}])assert.throws(()=>readTrustListQuery(value),{message:'INPUT_INVALID'});
});
test('HUMAN scope는 원 DB JSON의 추가 비밀 필드를 projection에 실어 보내지 않는다',()=>{
 const id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)};
 const scope={kind:'HOST_TRUST_REGISTRATION',installationId:id,projectId:id,subject:{kind:'HUMAN',userId:id,clientId:id,credentialGeneration:1,controlGeneration:1,token:'not-exposed'},policyRef:ref,expectedHostFingerprint:'b'.repeat(64),hostLabel:'로컬 host',expiresAt:'2026-10-17T02:30:00.000Z',credentialScope:'REGISTRATION_STATUS_ONLY',grants:[],oneTimeCode:'not-exposed',nonce:'not-exposed'};
 const projected=trustScopeProjection(scope);assert.equal('oneTimeCode'in projected,false);assert.equal('nonce'in projected,false);assert.equal('token'in projected.subject,false);assert.deepEqual(projected.grants,[]);assert.equal(projected.policyRef.contentHash,'a'.repeat(64));
});

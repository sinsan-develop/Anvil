import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Ajv} from 'ajv';

// wire 양식이 새 실행 grant/비밀·추가 서명 필드를 허용하거나 nonce 크기를 잃으면 실패한다.
test('등록 JSON schema는 상태조회전용 입력/정확8필드 증명 외 권한 확대·추가 필드를 거절한다',async()=>{
 const schema=JSON.parse(await readFile(new URL('../../../contracts/connector.schema.json',import.meta.url),'utf8')),validate=new Ajv({strict:true}).compile(schema);
 const id='11111111-1111-4111-8111-111111111111',payload={protocolVersion:1,installationId:id,registrationId:id,scopeDigest:'a'.repeat(64),publicKeyFingerprint:'b'.repeat(64),serverNonce:'A'.repeat(43),clientNonce:'B'.repeat(43),expiresAt:'2026-10-17T00:01:00.000Z'};
 const registration={kind:'HOST_TRUST_REGISTRATION',hostLabel:'QA PC',expectedHostFingerprint:'a'.repeat(64),policyRef:{id,version:1,contentHash:'b'.repeat(64)},expiresAt:'2026-10-17T00:10:00.000Z',reason:'실행 권한 없는 등록'};
 assert.equal(validate(registration),true);assert.equal(validate({...registration,grants:[]}),false);assert.equal(validate({...registration,allowedProjectRefs:[]}),false);
 const proof={challengeId:id,payload,signature:'A'.repeat(86)};assert.equal(validate(proof),true);assert.equal(validate({...proof,payload:{...payload,executionAuthorized:true}}),false);assert.equal(validate({...proof,payload:{...payload,serverNonce:'A'.repeat(44)}}),false);
 assert.equal(validate({kind:'CHALLENGE',payload,signature:'A'.repeat(86)}),true);assert.equal(validate({kind:'ISSUE',challengeId:id,payload,signature:'A'.repeat(86)}),true);assert.equal(validate({kind:'ISSUE',payload,signature:'A'.repeat(86)}),false);
});

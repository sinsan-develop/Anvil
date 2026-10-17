import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readHumanRegistration,listHumanRegistrations,newTrustBuffer,prepareTrustRegistration} from '../../../apps/web/src/features/connections/trust-api.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)};
test('HUMAN 목록은 same-origin GET만 사용하고 state·cursor·비밀 승격 응답을 거절한다',async()=>{
 const hit={registrationRef:ref,connectorRef:ref,hostLabel:'합성 host',state:'CREATED',derivedExpired:false,expiresAt:new Date(Date.now()+600000).toISOString(),proofedAt:null,revokedAt:null};
 const value={view:'HOST_TRUST_REGISTRATIONS_ONLY',items:[hit],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()};
 const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/connector-registrations?limit=50`);assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');return Response.json(value);});
 assert.equal((await listHumanRegistrations(client,pid)).items[0]!.hostLabel,'합성 host');
 (value.items[0] as any).oneTimeCode='must-not-return';await assert.rejects(listHumanRegistrations(client,pid),{code:'RESPONSE_INVALID'});
});
test('상세 요청은 credential을 넣지 않고 잘못된 project/예상치 않은 token 응답을 차단한다',async()=>{
 const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/connector-registrations/${id}`);assert.equal(new Headers(init?.headers).has('authorization'),false);return Response.json({registrationRef:ref,projectId:pid,credential:{token:'must-not-return'}});});
 await assert.rejects(readHumanRegistration(client,pid,id),{code:'RESPONSE_INVALID'});await assert.rejects(readHumanRegistration(client,'bad',id),{code:'CLIENT_PATH_INVALID'});
});
test('등록 버퍼는 본인/client/project/세대와6필드 입력을 고정하고 code/Secret을 담지 않는다',async()=>{
 const b=newTrustBuffer(pid,session,1);b.draft={hostLabel:'로컬 host',expectedHostFingerprint:'b'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),reason:'명시 등록 요청'};
 const c=await prepareTrustRegistration(b,session,ref);assert.equal(c.operation,'registerConnector');assert.equal(c.targetId,null);assert.equal(c.expectedVersion,0);assert.deepEqual(Object.keys(c.payload).sort(),['expectedHostFingerprint','expiresAt','hostLabel','kind','policyRef','reason']);assert.equal('oneTimeCode'in b,false);
 await assert.rejects(prepareTrustRegistration(b,{...session,clientId:id},ref),{code:'TRUST_BINDING_INVALID'});b.draft.hostLabel='api_key=must-not-send';await assert.rejects(prepareTrustRegistration(b,session,ref),{code:'TRUST_INPUT_INVALID'});
});

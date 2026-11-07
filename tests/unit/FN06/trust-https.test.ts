import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TrustHttpsClient,readProtocolReply} from '../../../apps/connector/runtime/trust-https.ts';

test('native HTTPS 연결은 정확 Origin·3830·명시 CA만 받고 임의 URL/평문/다른 경로를 거절한다',()=>{
 for(const origin of ['http://172.27.253.53:3830','https://172.27.253.53:3831','https://user:pass@172.27.253.53:3830','https://172.27.253.53:3830/other','https://172.27.253.53:3830?token=x','https://172.27.253.53:3830#x'])assert.throws(()=>new TrustHttpsClient({origin,ca:'public-ca'}),{message:'CONNECTOR_HTTPS_CONFIG_INVALID'});
 assert.throws(()=>new TrustHttpsClient({origin:'https://172.27.253.53:3830',ca:''}),{message:'CONNECTOR_HTTPS_CONFIG_INVALID'});
 const client=new TrustHttpsClient({origin:'https://172.27.253.53:3830',ca:'public-ca'});assert.equal(client.origin,'https://172.27.253.53:3830');
});
test('native reply는 비밀 원문을 오류로 반사하지 않고 redirect·과대·잘못된 JSON을 성공 처리하지 않는다',()=>{
 for(const [status,body] of [[302,'{}'],[200,'x'.repeat(16385)],[200,'{"secret":"do-not-echo"'],[200,'{"x":1,"x":2}'],[200,'{"executionAuthorized":true,"grants":[]}'],[200,'{"executionAuthorized":false,"grants":["RUN"]}']] as const)assert.throws(()=>readProtocolReply(status,body),e=>e instanceof Error&&!e.message.includes('do-not-echo')&&!e.message.includes('xxxxx'));
 assert.throws(()=>readProtocolReply(403,'{"code":"ORIGIN_INVALID","secret":"do-not-echo"}'),{message:'ORIGIN_INVALID'});
 assert.throws(()=>readProtocolReply(403,'{"code":"PRIVATE_PASSWORD_VALUE"}'),{message:'CONNECTOR_REQUEST_FAILED'});
 assert.deepEqual(readProtocolReply(200,'{"status":"HOST_PROOF_REQUIRED","grants":[],"executionAuthorized":false}'),{status:'HOST_PROOF_REQUIRED',grants:[],executionAuthorized:false});
});

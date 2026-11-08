import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {buildApp} from '../../../apps/server/app.ts';

test('실행 Bearer의 평문 요청·미등록 목적·HUMAN 또는 다른 realm 혼용은 DB 연결 전에 거절한다',async()=>{
 let calls=0;const pool={connect:async()=>{calls++;throw Error();}};
 const opts={pool} as any,enabled=buildApp({},undefined,undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,opts,undefined,{origin:'https://anvil-synthetic.invalid'});
 const closed=buildApp();
 const url='/api/v1/connectors/'+randomUUID()+'/executions/'+randomUUID()+'/challenges',authorization='Bearer av3ex1_'+randomBytes(32).toString('base64url');
 try{
  assert.equal((await enabled.inject({url:'/api/v1/health',headers:{authorization,cookie:'qa=value'}})).statusCode,403);
  const input={method:'POST' as const,url,headers:{authorization,host:'anvil-synthetic.invalid','x-forwarded-proto':'https'},payload:{purpose:'EXECUTION_REQUEST'}};
  assert.equal((await enabled.inject(input)).statusCode,403);
  assert.ok((await closed.inject(input)).statusCode>=400);
  assert.equal((await enabled.inject({...input,payload:{purpose:'CREDENTIAL_EXCHANGE'}})).statusCode,403);
  assert.equal((await enabled.inject({...input,headers:{authorization:'Bearer av3sr1_'+randomBytes(32).toString('base64url')}})).statusCode,403);
  assert.equal(calls,0);
 }finally{await enabled.close();await closed.close();}
});
test('Authorization의 배열·중복 raw 헤더·scheme/접두사 대소문자·공백은 HUMAN 경로로 빠지지 않는다',async()=>{
 const {enforceConnectorCredentialScope}=await import('../../../apps/server/http/connector-auth.ts');
 const token='av3ex1_'+randomBytes(32).toString('base64url'),valid='Bearer '+token;
 const base={method:'GET',routeOptions:{url:'/api/v1/projects'},headers:{cookie:'qa=value'}};
 for(const value of ['bEaReR '+token,'BEARER\t'+token,' Basic '+token,'Bearer'+token,'Bearer '+token.toUpperCase()]){
  assert.throws(()=>enforceConnectorCredentialScope({...base,headers:{...base.headers,authorization:value},raw:{rawHeaders:['Authorization',value]}} as any),/CONNECTOR_CREDENTIAL_SCOPE_DENIED/);
 }
 for(const value of [valid,[valid,'Basic example'],'Basic example']){
  assert.throws(()=>enforceConnectorCredentialScope({method:'POST',routeOptions:{url:'/api/v1/connectors/:cid/executions/:eid/challenges'},
   headers:{authorization:value},raw:{rawHeaders:['Authorization','Basic example','Authorization',valid]}} as any),/CONNECTOR_CREDENTIAL_SCOPE_DENIED/);
 }
});

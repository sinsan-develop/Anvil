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

test('FN09 목적 routeOptions 양성 목록은 Cookie·중복 Bearer·다른 method/suffix를 열지 않는다',async()=>{
 const {enforceConnectorCredentialScope}=await import('../../../apps/server/http/connector-auth.ts');
 const authorization='Bearer av3ex1_'+randomBytes(32).toString('base64url'),base='/api/v1/connectors/:cid/executions/:eid/understanding-response-read';
 for(const [method,url] of [['GET',base],['POST',base+'/:requestId/result']] as const){
  const r={method,routeOptions:{url},headers:{authorization},raw:{rawHeaders:['Authorization',authorization]}};
  assert.doesNotThrow(()=>enforceConnectorCredentialScope(r as any));
  for(const p of [{...r,method:'HEAD'},{...r,method:method==='GET'?'POST':'GET'},{...r,routeOptions:{url:url+'/'}},{...r,routeOptions:{url:url.replace('understanding','Understanding')}},{...r,headers:{authorization,cookie:''}},{...r,raw:{rawHeaders:[...r.raw.rawHeaders,'Cookie','']}},{...r,raw:{rawHeaders:[...r.raw.rawHeaders,'Authorization',authorization]}}])assert.throws(()=>enforceConnectorCredentialScope(p as any),/CONNECTOR_CREDENTIAL_SCOPE_DENIED/);
 }
});

test('FN09 Fastify RAM route template는 실제 preHandler에서 단일 Bearer만 통과하고 HEAD/혼합 인증은 막는다',async()=>{
 const {default:Fastify}=await import('fastify'),{enforceConnectorCredentialScope}=await import('../../../apps/server/http/connector-auth.ts');
 const app=Fastify({logger:false}),authorization='Bearer av3ex1_'+randomBytes(32).toString('base64url');let handled=0;
 const base='/api/v1/connectors/:cid/executions/:eid/understanding-response-read',path='/api/v1/connectors/'+randomUUID()+'/executions/'+randomUUID()+'/understanding-response-read';
 app.addHook('preHandler',async request=>{enforceConnectorCredentialScope(request);});
 app.setErrorHandler((error,_request,reply)=>reply.code((error as {statusCode?:number}).statusCode??500).send({code:'RAM_REJECTED'}));
 // 시험 안에서만 template/auth 진입을 관측한다. 제품 handler/선택 저장 성공을 만들지 않는다.
 app.get(base,{exposeHeadRoute:false},async(_r,reply)=>{handled++;return reply.code(204).send();});
 app.post(base+'/:requestId/result',async(_r,reply)=>{handled++;return reply.code(204).send();});
 try{
  for(const [method,url] of [['GET',path],['POST',path+'/'+randomUUID()+'/result']] as const){
   assert.equal((await app.inject({method,url,headers:{authorization}})).statusCode,204);
   const n=handled;
   const rejectedHeaders:Record<string,string|string[]>[]=[{authorization,cookie:'x=1'},{authorization:[authorization,authorization]},{authorization:'bearer '+authorization.slice(7)}];
   for(const headers of rejectedHeaders)assert.equal((await app.inject({method,url,headers})).statusCode,403);
   assert.notEqual((await app.inject({method:'HEAD',url,headers:{authorization}})).statusCode,204);assert.equal(handled,n);
  }
  assert.equal(handled,2);
 }finally{await app.close();}
});

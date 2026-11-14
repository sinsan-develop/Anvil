import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {stopFixture} from './normal-stop-command.test.ts';
const {buildApp}=await import('../../../apps/server/app.ts');
const {registerProjectRoutes}=await import('../../../apps/server/modules/projects/routes.ts');
const {default:Fastify}=await import('fastify');

test('normal STOP 명시 앱/route만 열리고 원 START에서 current부재412, 기본·합성·잘못된채널은 활성화하지 않는다',async()=>{
 const f=await stopFixture();const args=[...f.args];args[10]=undefined;args[22]={mode:'NORMAL_PROTECTED'};
 const app=Reflect.apply(buildApp,undefined,args),defaultApp=buildApp({},undefined,args[2]);
 const path=`/api/v1/projects/${f.f.pid}/executions/${f.g.execution_id}/stop-target`,query=`?generation=${f.g.generation}&grantId=${f.g.id}&grantVersion=${f.g.version}&grantHash=${f.g.content_hash}`;
 try{
  const before=[f.f.commands.size,f.f.receipts.size,f.f.tables.execution_commands!.length,f.f.tables.delivery_outbox!.length];
  const get=await app.inject({method:'GET',url:path+query,headers:f.headers});assert.equal(get.statusCode,412,get.body);assert.equal(get.json().code,'NORMAL_STOP_CURRENT_NOT_CONNECTED');assert.equal(get.headers['cache-control'],'no-store');
  const post=await app.inject({method:'POST',url:`/api/v1/projects/${f.f.pid}/commands`,headers:f.headers,payload:f.request});assert.equal(post.statusCode,412,post.body);assert.equal(post.json().code,'NORMAL_STOP_CURRENT_NOT_CONNECTED');
  assert.deepEqual([f.f.commands.size,f.f.receipts.size,f.f.tables.execution_commands!.length,f.f.tables.delivery_outbox!.length],before);
  assert.equal((await defaultApp.inject({method:'GET',url:path+query,headers:f.headers})).statusCode,404);
  assert.equal((await app.inject({method:'GET',url:path+query+'&extra=1',headers:f.headers})).statusCode,400);
  for(const suffix of ['&generation=1','&grantId[]=x'])assert.equal((await app.inject({method:'GET',url:path+query+suffix,headers:f.headers})).statusCode,400);
  for(const pair of [['content-length','0'],['transfer-encoding','chunked']]){
   const response=await inject((req,res)=>{req.rawHeaders.push(...pair);if(pair[0]==='transfer-encoding')req.headers['transfer-encoding']='chunked';app.routing(req,res);},{method:'GET',url:path+query,headers:{...f.headers,'content-length':'0'}});
   assert.equal(response.statusCode,400,response.body);
  }

  assert.equal((await app.inject({method:'GET',url:path+query,headers:{...f.headers,authorization:'Bearer bad'}})).statusCode,403);
  assert.equal((await app.inject({method:'GET',url:path+query,headers:{...f.headers,'content-type':'application/json'},payload:{}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:`/api/v1/projects/${f.f.pid}/commands?extra=1`,headers:f.headers,payload:f.request})).statusCode,400);
 }finally{await app.close();await defaultApp.close();await f.close();}
});
test('STOP 옵션 exported app/routes 경계는 callback·getter·Proxy와 합성 혼합을 거절한다',async()=>{
 const access:any={repository:{},origin:'https://anvil-synthetic.invalid',artifactRoot:'never-opened-stop-memory'};
 let traps=0;for(const option of [{},{mode:'SYNTHETIC_ONLY'},{mode:'NORMAL_PROTECTED',current:()=>true},new Proxy({mode:'NORMAL_PROTECTED'},{ownKeys(){traps++;return[];}}),Object.defineProperty({},'mode',{enumerable:true,get(){traps++;return 'NORMAL_PROTECTED';}})]){
  const args:any[]=[{},undefined,access];args[22]=option;assert.throws(()=>Reflect.apply(buildApp,undefined,args),/NORMAL_STOP_CONFIGURATION_INVALID/);
  const app=Fastify();try{assert.throws(()=>registerProjectRoutes(app,access,undefined,undefined,undefined,undefined,undefined,option as any),/NORMAL_STOP_CONFIGURATION_INVALID/);}finally{await app.close();}
 }
 assert.equal(traps,0);const mixed:any[]=[{},undefined,access,{}];mixed[22]={mode:'NORMAL_PROTECTED'};assert.throws(()=>Reflect.apply(buildApp,undefined,mixed),/NORMAL_STOP_CONFIGURATION_INVALID/);
});

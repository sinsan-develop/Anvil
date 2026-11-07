import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {understandingHistoryFixture} from '../UI05/understanding-history-fixture.ts';
const module:any=await import('../../../apps/server/modules/executions/understanding-history-routes.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',token='t'.repeat(43),scope={projectId:pid,executionId:eid,executionGeneration:2},path=`/api/v1/projects/${pid}/executions/${eid}/understanding-reviews?generation=2`;
const history=()=>({transport:'SYNTHETIC_ONLY',scope,items:[],currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false});
async function fixture(provider:any={transport:'SYNTHETIC_ONLY',list:async(t:string,s:unknown)=>{assert.equal(t,token);assert.deepEqual(s,scope);return history();}}){
 assert.equal(typeof module.registerUnderstandingHistoryRoutes,'function');const app=Fastify();app.setErrorHandler((e,_,r)=>r.code(e instanceof AuthFailure?e.statusCode:503).send({code:e instanceof AuthFailure?e.message:'STORAGE_FAILED'}));module.registerUnderstandingHistoryRoutes(app,{origin:'https://anvil.test'},provider);await app.ready();return app;
}
test('정확 HUMAN·실행 세대 GET은 빈 보관 이력도 no-store로 반환하고 실행 허가를 만들지 않는다',async()=>{
 const app=await fixture();try{const r=await app.inject({url:path,headers:{host:'anvil.test',cookie:'__Host-anvil.sid='+token}});assert.equal(r.statusCode,200);assert.equal(r.headers['cache-control'],'no-store');assert.deepEqual(r.json(),history());}finally{await app.close();}
});
test('다른 Origin을 명시한 GET은 같은 host·cookie여도 자료 제공자를 호출하지 않는다',async()=>{
 let calls=0;const app=await fixture({transport:'SYNTHETIC_ONLY',list:async()=>{calls++;return history();}});try{const r=await app.inject({url:path,headers:{host:'anvil.test',origin:'https://other.test',cookie:'__Host-anvil.sid='+token}});assert.equal(r.statusCode,403);assert.equal(calls,0);}finally{await app.close();}
});
test('인증/host·Bearer와 누락/중복/추가·비정수 세대는 제공자를 호출하지 않는다',async()=>{
 let calls=0;const app=await fixture({transport:'SYNTHETIC_ONLY',list:async()=>{calls++;return history();}});try{
  for(const change of [{headers:{host:'other.test',cookie:'__Host-anvil.sid='+token}},{headers:{host:'anvil.test',authorization:'Bearer av3ex1_'+token,cookie:'__Host-anvil.sid='+token}},{headers:{host:'anvil.test'}},{headers:{host:'anvil.test',cookie:`__Host-anvil.sid=${token}; __Host-anvil.sid=${token}`}},{url:path.replace('?generation=2','')},{url:path+'&generation=3'},{url:path+'&other=1'},{url:path.replace('generation=2','generation=0')},{url:path.replace('generation=2','generation=02')},{url:path.replace('generation=2','generation=1.5')}]){const r=await app.inject({url:path,headers:{host:'anvil.test',cookie:'__Host-anvil.sid='+token},...change});assert.ok(r.statusCode>=400);assert.equal(r.body.includes(token),false);}assert.equal(calls,0);
 }finally{await app.close();}
});
test('미연결·다른 scope/권위 위조·저장 오류는 이력 성공으로 반환하지 않는다',async()=>{
 for(const mode of ['missing','scope','authority','error','port']){const provider:any=mode==='missing'?undefined:{transport:'SYNTHETIC_ONLY',list:async()=>{if(mode==='error')throw Error('PRIVATE_STORAGE_DETAIL');if(mode==='port')provider.transport='REAL';return{...history(),...(mode==='scope'?{scope:{...scope,executionGeneration:1}}:{}),...(mode==='authority'?{executionAuthorized:true}:{})};}};const app=await fixture(provider??null);try{const r=await app.inject({url:path,headers:{host:'anvil.test',cookie:'__Host-anvil.sid='+token}});assert.equal(r.statusCode,503);assert.equal(r.body.includes('PRIVATE'),false);}finally{await app.close();}}
});
test('제품 app은 명시 이력 제공자를 연결하며 비어 있지 않은 체인도 재검사한다',async()=>{
 const f=understandingHistoryFixture(),unused={command:async()=>assert.fail('변경 명령 호출 금지')},provider:any={transport:'SYNTHETIC_ONLY',list:async(t:string,s:unknown)=>{assert.equal(t,token);assert.deepEqual(s,f.scope);return f.history;}};
 const app=buildApp({},undefined,{repository:{} as any,origin:'https://anvil.test'},{transport:'SYNTHETIC_ONLY',queue:unused,stop:unused,recovery:unused,understanding:unused,understandingHistory:provider});
 const url=`/api/v1/projects/${f.scope.projectId}/executions/${f.scope.executionId}/understanding-reviews?generation=1`,headers={host:'anvil.test',cookie:'__Host-anvil.sid='+token};
 try{const good=await app.inject({url,headers});assert.equal(good.statusCode,200);assert.equal(good.json().items[0].snapshot.input.items.length,6);f.history.items[0]!.snapshot.input.reason='변조';const bad=await app.inject({url,headers});assert.equal(bad.statusCode,503);assert.equal(bad.body.includes('변조'),false);}finally{await app.close();}
});

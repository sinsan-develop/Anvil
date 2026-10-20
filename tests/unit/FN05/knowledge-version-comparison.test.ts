import assert from 'node:assert/strict';import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {comparisonProject as pid,knowledgeVersionPair} from './knowledge-version-comparison-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/knowledge/knowledge-version-comparison.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('저장된 지식 비교는 현재/앞 버전 fullref를 검증하고 앞 버전 GET만 수행한다',async()=>{
 assert.equal(typeof mod.readKnowledgeVersionComparison,'function');const pair=knowledgeVersionPair(),copy=structuredClone(pair),requests:any[]=[];
 const client=new ApiClient(async(input,init)=>{requests.push({url:String(input),method:init?.method??'GET'});return new Response(JSON.stringify(pair.before),{headers:{'content-type':'application/json'}});});
 assert.deepEqual(await mod.readKnowledgeVersionComparison(client,pid,pair.after,()=>true),pair);assert.deepEqual(requests,[{url:`/api/v1/projects/${pid}/knowledge/${pair.before.ref.id}/versions/1`,method:'GET'}]);assert.deepEqual(pair,copy);
});
test('다른 참조·변조 원문과 조회 이탈은 비교 자료로 채택하지 않는다',async()=>{
 assert.equal(typeof mod.readKnowledgeVersionComparison,'function');const pair=knowledgeVersionPair();let calls=0,active=true;
 const client=new ApiClient(async()=>{calls++;active=false;return new Response(JSON.stringify(pair.before),{headers:{'content-type':'application/json'}});});
 assert.equal(await mod.readKnowledgeVersionComparison(client,pid,pair.after,()=>false),null);assert.equal(calls,0);assert.equal(await mod.readKnowledgeVersionComparison(client,pid,pair.after,()=>active),null);assert.equal(calls,1);
 for(const bad of [{...pair.after,body:'변조'},{...pair.after,supersedesRef:{...pair.before.ref,id:'77777777-7777-4777-8777-777777777777'}}])await assert.rejects(mod.readKnowledgeVersionComparison(client,pid,bad,()=>true));assert.equal(calls,1);
 const wrong=new ApiClient(async()=>new Response(JSON.stringify({...pair.before,body:'변조'}),{headers:{'content-type':'application/json'}}));await assert.rejects(mod.readKnowledgeVersionComparison(wrong,pid,pair.after,()=>true));
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
const m:any=await import(new URL('../../../apps/web/src/features/projects/project-list-snapshot.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`95000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at='2026-10-24T04:00:00.000Z',later='2026-10-24T04:05:00.000Z';
const client=new ApiClient(async()=>{throw Error('NO_REQUEST_ALLOWED');}),request=(patch:any={})=>({client,query:'',archived:false,refresh:0,cursor:null,...patch});
const page=(n:number,time=at)=>({items:[{id:id(n),name:'프로젝트'+n,purpose:'목적',version:1,updatedAt:at}],hasMore:true,nextCursor:'next'+n,observedAt:time,baselineVersion:null});
function merge(previous:any,r:any,p:any){assert.equal(typeof m.mergeProjectListSnapshot,'function','목록 관측 보존 미구현');return m.mergeProjectListSnapshot(previous,r,p);}
function select(state:any,r:any){assert.equal(typeof m.selectProjectListSnapshot,'function');return m.selectProjectListSnapshot(state,r);}
test('다음 페이지 병합은 항목별 원관측을 보존하고 마지막 페이지 관측으로 덮지 않는다',()=>{
 const first=merge(null,request(),page(1)),before=structuredClone(first.page),next=request({cursor:'next1'}),combined=merge(first,next,page(2,later)),shown=select(combined,next);
 assert.deepEqual(shown.page.items.map((i:any)=>i.id),[id(1),id(2)]);assert.equal(shown.itemObservedAt[id(1)],at);assert.equal(shown.itemObservedAt[id(2)],later);assert.equal(shown.current,true);assert.deepEqual(first.page,before);
});
test('다른 client/검색/보관 문맥은 즉시 숨기고 같은 문맥의 새 요청은 과거 목록으로 구분한다',()=>{
 const r=request(),s=merge(null,r,page(1));for(const next of [request({client:new ApiClient()}),request({query:'다른검색'}),request({archived:true})])assert.equal(select(s,next),null);
 for(const next of [request({refresh:1}),request({cursor:'next1'})]){const v=select(s,next);assert.equal(v.current,false);assert.equal(v.page.items[0].id,id(1));}
});
test('다른 조회의 이전 목록을 새 페이지에 섞지 않고 같은 id는 실제 재관측만 갱신한다',()=>{
 const first=merge(null,request(),page(1));for(const r of [request({client:new ApiClient(),cursor:'x'}),request({query:'새검색',cursor:'x'}),request({archived:true,cursor:'x'}),request({refresh:1,cursor:'x'})]){const v=merge(first,r,page(2,later));assert.deepEqual(v.page.items.map((i:any)=>i.id),[id(2)]);assert.equal(id(1)in v.itemObservedAt,false);}
 const next=merge(first,request({cursor:'next1'}),page(1,later));assert.equal(next.page.items.length,1);assert.equal(next.itemObservedAt[id(1)],later);assert.equal(first.itemObservedAt[id(1)],at);
});

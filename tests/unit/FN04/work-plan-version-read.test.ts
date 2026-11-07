import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import * as api from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)};
function fixture(version=1){const snapshot={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[],dependencies:[],reason:`과거 계획 ${version}`,issues:[],relationalProjection:'ISSUES_ONLY'};return{ref:{id,version,contentHash:contentHash(canonicalJson(snapshot))},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:'2026-10-20T00:00:00.000Z'};}
const head={...fixture(3).ref};
const reader=()=>{const fn=(api as Record<string,unknown>).readWorkPlanAtVersion;assert.equal(typeof fn,'function');return fn as Function;};
test('열어둔 계획 범위 안의 과거 버전만 읽고 자체 본문hash를 확인한다',async()=>{
 const read=reader(),old=fixture(),calls:unknown[]=[];
 assert.deepEqual(await read(new ApiClient(async(path,init)=>{calls.push([path,init?.method]);return Response.json(old);}),pid,head,1),old);
 assert.deepEqual(calls,[[`/api/v1/projects/${pid}/work-plans/${id}/versions/1`,'GET']]);
});
test('범위 밖/잘못된 경로는 GET 전에 거절하고 다른 id/version·변조/거절도 수용하지 않는다',async()=>{
 const read=reader();let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(fixture());});
 for(const n of [0,-1,1.5,4,NaN])await assert.rejects(read(client,pid,head,n));await assert.rejects(read(client,'../other',head,1));assert.equal(calls,0);
 for(const bad of [{...fixture(),ref:{...fixture().ref,id:pid}},{...fixture(),ref:{...fixture().ref,version:2}},{...fixture(),reason:'원문 변조'}])await assert.rejects(read(new ApiClient(async()=>Response.json(bad)),pid,head,1));
 await assert.rejects(read(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),pid,head,1));
});
test('기준과 같은 버전은 기존 fullref 일치도 필요하며 조회 취소 뒤 결과를 쓰지 않는다',async()=>{
 const read=reader(),changed=fixture(3);changed.reason='다른 정상해시 원문';const {ref:ignored,status,executionEvidence,observedAt,...snapshot}=changed;changed.ref.contentHash=contentHash(canonicalJson(snapshot));
 await assert.rejects(read(new ApiClient(async()=>Response.json(changed)),pid,head,3));
 let active=true;const result=await read(new ApiClient(async()=>{active=false;return Response.json(fixture());}),pid,head,1,()=>active);assert.equal(result,null);
});

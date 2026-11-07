import test from 'node:test';import assert from 'node:assert/strict';import {ApiClient} from '../../../apps/web/src/api/client.ts';
const mod:any=await import(new URL('../../../apps/web/src/features/projects/project-pending-approvals.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',at='2026-10-20T00:00:00.000Z';
function fixture(){return{items:[{id,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',operation:'uploadArtifact',targetRef:null,scopeDigest:'a'.repeat(64),expiresAt:'2026-10-21T00:00:00.000Z',createdAt:at,integrity:'NOT_RECHECKED'}],hasMore:true,nextCursor:'signed-page-2',observedAt:at};}
const read=()=>{assert.equal(typeof mod.readProjectPendingApprovals,'function','대기 결정 목록 소비 누락');return mod.readProjectPendingApprovals;};
test('기존 PENDING GET/cursor만 사용하고 페이지 수를 전체 건수·실행 권한으로 바꾸지 않는다',async()=>{
 const calls:string[]=[],client=new ApiClient(async(url,init)=>{assert.equal(init?.method,'GET');calls.push(String(url));return Response.json(calls.length===1?fixture():{...fixture(),hasMore:false,nextCursor:null});});
 const first=await read()(client,pid,null,()=>true);assert.equal(first.pageCount,1);assert.equal(first.totalCount,null);assert.equal(first.countScope,'CURRENT_PAGE_ONLY');assert.equal(first.items[0].integrity,'NOT_RECHECKED');assert.equal(first.executionAuthorized,false);assert.equal(first.decisionPerformed,false);assert.equal(first.observedAt,at);
 await read()(client,pid,first.nextCursor,()=>true);assert.deepEqual(calls,[`/api/v1/projects/${pid}/approvals?limit=50&status=PENDING`,`/api/v1/projects/${pid}/approvals?limit=50&status=PENDING&cursor=signed-page-2`]);
 const empty=await read()(new ApiClient(async()=>Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at})),pid,null,()=>true);assert.equal(empty.pageCount,0);assert.equal(empty.totalCount,null);
});
test('거절·중복·다른 상태·관측시각에 이미 만료된 후보·불명 연산은 성공 건수로 표시하지 않는다',async()=>{
 for(const status of [401,403,404])await assert.rejects(read()(new ApiClient(async()=>Response.json({code:'PERMISSION_DENIED'},{status})),pid,null,()=>true),(e:any)=>e.status===status);
 for(const patch of [{operation:null},{operation:'<script>'},{currentVersion:2},{storedStatus:'APPROVED'},{effectiveState:'EXPIRED'},{expiresAt:at},{createdAt:'2026-10-22T00:00:00.000Z'}]){const f=fixture();f.items[0]={...f.items[0],...patch} as any;await assert.rejects(read()(new ApiClient(async()=>Response.json(f)),pid,null,()=>true));}
 const f=fixture();f.items.push({...f.items[0]!});await assert.rejects(read()(new ApiClient(async()=>Response.json(f)),pid,null,()=>true));
});
test('닫기·전환은 요청 전 또는 응답 뒤 채택을 막는다',async()=>{
 let active=false,calls=0;const client=new ApiClient(async()=>{calls++;active=false;return Response.json(fixture());});await assert.rejects(read()(client,pid,null,()=>active));assert.equal(calls,0);active=true;await assert.rejects(read()(client,pid,null,()=>active));assert.equal(calls,1);
});

test('다음 커서가 요청 커서와 같으면 무한 조회 상태로 넘기지 않고 거절한다',async()=>{
 const client=new ApiClient(async()=>Response.json(fixture()));await assert.rejects(read()(client,pid,'signed-page-2',()=>true),(e:any)=>e.code==='PROJECT_DECISIONS_RESPONSE_INVALID');
});

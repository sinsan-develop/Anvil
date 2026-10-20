import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { designChangeFixture, projectId } from './design-change-fixture.ts';
const m: any = await import('../../../apps/web/src/features/design-change/request-api.ts').catch((e: NodeJS.ErrnoException) => { if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e; });
const fn=(key:string)=>{assert.equal(typeof m[key],'function');return m[key];};
const session={user:{id:projectId},clientId:'77777777-7777-4777-8777-777777777777',csrfToken:'C'.repeat(43)};
function buffer(){const c=designChangeFixture().change,b=fn('newDesignChangeRequest')(projectId,session,3,c.beforeRef,c.afterProposalRef);b.reason='사용자가 변경 이유를 기록';return b;}
function response(command:any){const fixture=designChangeFixture(),snapshot={...command.payload},change={...fixture.change,...snapshot,ref:{id:fixture.change.ref.id,version:1,contentHash:contentHash(canonicalJson(snapshot))}};const {ref,observedAt,...base}=fixture.impactVersions[1]!;const body={...base,changeRef:change.ref,beforeRef:change.beforeRef};const impact={...body,ref:{...ref,contentHash:contentHash(canonicalJson(body))},observedAt};return{operationId:crypto.randomUUID(),commandId:command.commandId,projectId,status:'APPLIED',targetId:change.ref.id,version:1,data:{status:'DESIGN_CHANGE_PROPOSED',ref:change.ref,change,impact,activatedAsBaseline:false},evidenceRefs:[],warnings:[],serverReceivedAt:observedAt};}
test('선택한 문서 출처의 정확 버전과 hash는 명령·영수증에 보존하며 미확인 중 편집을 거절한다',async()=>{
 const b=buffer(),source={kind:'DOCUMENT_VERSION',...b.beforeRef};b.sourceRefs=[source];b.pending=fn('prepareDesignChangeRequest')(b,session,true);assert.deepEqual(b.pending.payload.sourceRefs,[source]);
 const view=await fn('sendDesignChangeRequest')(new ApiClient(async()=>Response.json(response(b.pending))),b,session);assert.deepEqual(view.change.sourceRefs,[source]);
 b.sourceRefs=[];assert.throws(()=>fn('prepareDesignChangeRequest')(b,session,true),e=>e instanceof ApiError&&e.code==='DESIGN_CHANGE_PENDING_MISMATCH');
});
test('기존 ARTIFACT 출처는 원문hash 그대로 별도 명령에 결박하고 같은 명령 재확인에 보존한다',async()=>{
 const b=buffer(),source={kind:'ARTIFACT',id:'88888888-8888-4888-8888-888888888888',contentHash:'d'.repeat(64)};b.sourceRefs=[source];b.pending=fn('prepareDesignChangeRequest')(b,session,true);assert.deepEqual(b.pending.payload.sourceRefs,[source]);const view=await fn('sendDesignChangeRequest')(new ApiClient(async()=>Response.json(response(b.pending))),b,session);assert.deepEqual(view.change.sourceRefs,[source]);assert.deepEqual(fn('prepareDesignChangeRequest')(b,session,true),b.pending);
});
test('ARTIFACT의 위장version/중복/다른 미연결 종류는 작성 계약을 통과하지 않는다',()=>{
 const b=buffer(),source={kind:'ARTIFACT',id:projectId,contentHash:'d'.repeat(64)};for(const refs of[[source,source],[{...source,version:1}],[{...source,kind:'CONVERSATION'}]]){b.sourceRefs=refs;assert.throws(()=>fn('prepareDesignChangeRequest')(b,session,true),e=>e instanceof ApiError&&e.code==='DESIGN_CHANGE_SOURCE_INVALID');}
});
test('변경 요청 문서 출처는 중복·위장키·과다 목록과 영수증의 출처 누락을 거절한다',async()=>{
 const b=buffer(),source={kind:'DOCUMENT_VERSION',...b.beforeRef};
 for(const refs of [[source,source],[{...source,verified:true}],Array(201).fill(source)]){b.sourceRefs=refs;assert.throws(()=>fn('prepareDesignChangeRequest')(b,session,true),e=>e instanceof ApiError&&e.code==='DESIGN_CHANGE_SOURCE_INVALID');}
 b.sourceRefs=[source];b.pending=fn('prepareDesignChangeRequest')(b,session,true);const reply=response(b.pending);reply.data.change.sourceRefs=[];await assert.rejects(fn('sendDesignChangeRequest')(new ApiClient(async()=>Response.json(reply)),b,session),e=>e instanceof ApiError&&e.code==='RESPONSE_INVALID');
});
test('설계변경 등록은 주체·제어세대·정확 설계와 제안을 고정하고 승인·활성화를 요청하지 않는다',()=>{
 const b=buffer(),c=fn('prepareDesignChangeRequest')(b,session,true);assert.equal(c.operation,'proposeDesignChange');assert.equal(c.expectedVersion,0);assert.equal(c.targetId,null);assert.equal(c.controlGeneration,3);assert.deepEqual(c.baselineRefs,[]);assert.equal(c.approvalRef,null);assert.deepEqual(c.payload.sourceRefs,[]);assert.equal(c.payload.beforeRef.id,'33333333-3333-4333-8333-333333333333');b.reason='편집';assert.equal(c.payload.reason,'사용자가 변경 이유를 기록');
 assert.throws(()=>fn('prepareDesignChangeRequest')(buffer(),session,false),e=>e instanceof ApiError&&e.code==='DESIGN_CHANGE_CONFIRM_REQUIRED');
 assert.throws(()=>fn('prepareDesignChangeRequest')(buffer(),{...session,clientId:projectId},true),e=>e instanceof ApiError&&e.code==='DESIGN_CHANGE_BINDING_INVALID');
});
test('설계변경 미확인 명령은 같은 입력·commandId로만 재확인하고 편집 후 재사용하지 않는다',()=>{
 const b=buffer(),prepare=fn('prepareDesignChangeRequest');b.pending=prepare(b,session,true);assert.deepEqual(prepare(b,session,true),b.pending);b.reason='바꾼 이유';assert.throws(()=>prepare(b,session,true),e=>e instanceof ApiError&&e.code==='DESIGN_CHANGE_PENDING_MISMATCH');
});
test('설계변경 응답 유실은 같은 명령으로 재확인하며 고정 영수증의 원문·기계 영향만 채택한다',async()=>{
 const b=buffer();b.pending=fn('prepareDesignChangeRequest')(b,session,true);const commands:any[]=[];let lost=true;const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${projectId}/commands`);assert.equal(init?.method,'POST');commands.push(JSON.parse(String(init?.body)));if(lost){lost=false;throw Error('synthetic lost');}return Response.json(response(commands.at(-1)));});const send=fn('sendDesignChangeRequest');await assert.rejects(send(client,b,session),e=>e instanceof ApiError&&e.code==='CONNECTION_LOST');const value=await send(client,b,session);assert.equal(value.activatedAsBaseline,false);assert.equal(value.change.reason,b.reason);assert.equal(value.impactVersions[0].sourceKind,'MECHANICAL_TRACE');assert.deepEqual(commands[0],commands[1]);
});
test('설계변경 영수증의 다른 명령·기준활성화·입력 바꿔치기는 거절한다',async()=>{
 const b=buffer();b.pending=fn('prepareDesignChangeRequest')(b,session,true);
 for(const mutate of[(v:any)=>{v.commandId=projectId;},(v:any)=>{v.data.activatedAsBaseline=true;},(v:any)=>{v.data.change.reason='변조';}]){const reply=response(b.pending);mutate(reply);await assert.rejects(fn('sendDesignChangeRequest')(new ApiClient(async()=>Response.json(reply)),b,session),e=>e instanceof ApiError);}
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaHash as hash,criteriaId as id} from '../FN12/result-criteria-fixture.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/result-rework-write-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
async function fixture(){const f=reworkFixture(),prepared=prepareResultRework(f.sources,f.input,f.now),session:any={user:{id:id(6)},clientId:id(24),csrfToken:'C'.repeat(43)};assert.equal(typeof mod.prepareResultReworkWrite,'function','보완 저장 명령 준비 미구현');const pending=await mod.prepareResultReworkWrite(prepared,session,3),at='2026-10-20T00:02:00.000Z',snapshot={scope:prepared.scope,input:f.input,criteriaRef:prepared.criteriaRef,roleRef:prepared.roleRef,stageSessionRef:prepared.stageSessionRef,remainingMissingItems:prepared.remainingMissingItems,preservedItems:[],requestedBy:{kind:'HUMAN',userId:session.user.id,clientId:session.clientId},requestedAt:at,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},ref={id:id(40),version:1,contentHash:hash(snapshot)},flags={reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},data={ref,status:'RESULT_REWORK_DRAFT_STORED',snapshot,...flags},receipt={commandId:pending.command.commandId,operationId:id(41),projectId:f.sources.assignment.projectId,targetId:ref.id,version:1,status:'APPLIED',serverReceivedAt:at,data},stored={projectId:f.sources.assignment.projectId,...data,observedAt:at};return{...f,prepared,session,pending,receipt,stored};}
test('보완 저장은 현재 주체/고정명령 한 POST와 exactGET로만 확인하고 실제배정으로 승격하지 않는다',async()=>{const f=await fixture(),calls:any[]=[];assert.equal(typeof mod.saveResultReworkWrite,'function');const value=await mod.saveResultReworkWrite(new ApiClient(async(url,init)=>{calls.push({url,init});return Response.json(calls.length===1?f.receipt:f.stored);}),f.pending,f.session,()=>true);assert.deepEqual(value,f.stored);assert.equal(calls[0].url,`/api/v1/projects/${f.stored.projectId}/commands`);assert.equal(new Headers(calls[0].init.headers).get('idempotency-key'),f.pending.command.commandId);assert.deepEqual(JSON.parse(calls[0].init.body),f.pending.command);assert.equal(calls[1].url,`/api/v1/projects/${f.stored.projectId}/result-reworks/${f.stored.ref.id}`);assert.deepEqual(f.pending.command.payload,f.input);});
test('APPLIED 뒤 GET403·변형된 원문은 저장실패 확정이 아니라 같은명령 확인 대상으로 남긴다',async()=>{for(const corrupt of [false,true]){const f=await fixture();let n=0;const client=new ApiClient(async()=>{n++;if(n===1)return Response.json(f.receipt);const v=structuredClone(f.stored);v.snapshot.stageSessionRef.id=id(99);return corrupt?Response.json(v):Response.json({code:'ACCESS_DENIED'},{status:403});});await assert.rejects(mod.saveResultReworkWrite(client,f.pending,f.session,()=>true),(e:any)=>e.writeMayHaveApplied===true&&(corrupt?e.code==='RESULT_REWORK_RESPONSE_INVALID':e.status===403));assert.equal(n,2);}});
test('다른주체/client·실행승격 준비는 보내지 않으며 이탈 후 후속GET도 중단한다',async()=>{const f=await fixture();await assert.rejects(mod.prepareResultReworkWrite({...f.prepared,executionAuthorized:true},f.session,3));for(const session of [{...f.session,user:{id:id(99)}},{...f.session,clientId:id(99)}]){let calls=0;await assert.rejects(mod.saveResultReworkWrite(new ApiClient(async()=>{calls++;return Response.json(f.receipt);}),f.pending,session,()=>true));assert.equal(calls,0);}let active=true,n=0;assert.equal(await mod.saveResultReworkWrite(new ApiClient(async()=>{n++;active=false;return Response.json(f.receipt);}),f.pending,f.session,()=>active),null);assert.equal(n,1);});

test('미전송 증거는 원 준비/세션/내용만 해제하며 복제·변조에는 발급하지 않는다',async()=>{
 const f=await fixture();assert.equal(typeof mod.canReleaseUnsentRework,'function');
 assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),true);
 assert.equal(mod.canReleaseUnsentRework(structuredClone(f.pending),f.session),false);
 assert.equal(mod.canReleaseUnsentRework(f.pending,{...f.session}),false);
 const reason=f.pending.prepared.reason;f.pending.prepared.reason+='변경';assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),false);f.pending.prepared.reason=reason;
 const restored=mod.releaseUnsentRework(f.pending,f.session);assert.deepEqual(restored,f.prepared);assert.notEqual(restored,f.prepared);
 assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),false);assert.throws(()=>mod.releaseUnsentRework(f.pending,f.session));
});
test('send-ready 전 이탈은 증거 보존, 복제 직접 전송은 transport 전에 원 증거를 소진한다',async()=>{
 const f=await fixture();let calls=0;const client=new ApiClient(async()=>{calls++;assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),false);throw Error('synthetic loss');});
 assert.equal(await mod.saveResultReworkWrite(client,f.pending,f.session,()=>false),null);assert.equal(calls,0);assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),true);
 await assert.rejects(mod.saveResultReworkWrite(client,structuredClone(f.pending),f.session,()=>true),{code:'CONNECTION_LOST'});assert.equal(calls,1);assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),false);
 await assert.rejects(mod.saveResultReworkWrite(client,f.pending,f.session,()=>true),{code:'CONNECTION_LOST'});assert.equal(calls,2,'원 동일 명령 재확인은 유지');
});
test('APPLIED readback 불명과 명확 거절 모두 미전송 해제로 바꾸지 않는다',async()=>{
 for(const applied of [false,true]){const f=await fixture();let n=0;await assert.rejects(mod.saveResultReworkWrite(new ApiClient(async()=>{n++;return Response.json(applied&&n===1?f.receipt:{code:'ACCESS_DENIED'},{status:applied&&n===1?200:403});}),f.pending,f.session,()=>true));assert.equal(mod.canReleaseUnsentRework(f.pending,f.session),false);assert.equal(n,applied?2:1);}
});

test('준비 await 중 인증 내용 변경은 원 스냅샷의 미전송 증거를 갱신하지 않는다',async()=>{
 const f=await fixture(),preparing=mod.prepareResultReworkWrite(f.prepared,f.session,3);f.session.csrfToken='D'.repeat(43);const pending=await preparing;assert.equal(mod.canReleaseUnsentRework(pending,f.session),false);
});

test('직접 복제 전송이 hash를 기다리는 중 원 준비 해제는 그 시작된 전송을 차단한다',async()=>{
 const f=await fixture();let posts=0;const sending=mod.saveResultReworkWrite(new ApiClient(async()=>{posts++;return Response.json(f.receipt);}),structuredClone(f.pending),f.session,()=>true);
 assert.deepEqual(mod.releaseUnsentRework(f.pending,f.session),f.prepared);await assert.rejects(sending,{code:'RESULT_REWORK_BINDING_INVALID'});assert.equal(posts,0);
});

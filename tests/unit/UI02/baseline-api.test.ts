import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import * as baseline from '../../../apps/web/src/features/project-create/baseline-api.ts';
import { ordered } from '../../../apps/web/src/features/knowledge/review-view.ts';
import { validateBaselineInput, validateBaselineReview } from '../../../apps/web/src/features/project-create/baseline-validation.ts';
const pid=randomUUID(), user=randomUUID(), cid=randomUUID(), session={user:{id:user},clientId:cid,csrfToken:'C'.repeat(43)};
const ref=(value:unknown,id=randomUUID(),version=1)=>({id,version,contentHash:createHash('sha256').update(ordered(value)).digest('hex')});
const input=()=>({baseRef:null,source:{kind:'NONE_SELECTED' as const,declarationRef:null,sourceRootRef:null,snapshotRef:null,grantRef:null,unverifiedReason:'관측하지 않았다'},items:[{itemId:'FN-A',title:'기능 A',designRef:null,featureState:'NOT_IMPLEMENTED' as const,evidenceRefs:[],limitations:'미구현',reason:'사용자 분류'}],coverageReason:'범위 미확인',reason:'시작 기준 기록'});
const snapshot=(i:baseline.BaselineDraftInput=input())=>({schemaVersion:1,input:i,sourceBinding:{kind:i.source.kind,declaration:null,observation:null,declarationReportRelation:'UNVERIFIED'},evidenceBindings:i.items.map(item=>({itemId:item.itemId,evidenceRefs:item.evidenceRefs})),issues:[{code:'CONTENT_REVIEW_REQUIRED',location:'items'},{code:'SOURCE_UNVERIFIED',location:'source'},{code:'COVERAGE_UNVERIFIED',location:'coverageReason'},{code:'EXECUTION_NOT_CONNECTED',location:'execution'}],recordedBy:{kind:'HUMAN',userId:user},recordedAt:'2026-10-18T07:00:00.000Z',contentConfirmed:false,sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false});
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
test('기준선 쓰기는 같은 pending 명령만 재확인하고 주체·세대·입력 변경을 거절한다',()=>{
 const b=baseline.newBaselineBuffer(pid,session,3,null); b.input=input();
 const c=baseline.prepareBaselineCommand(b,session,'saveBaselineDraft'); b.pending=c;
 assert.deepEqual(baseline.prepareBaselineCommand(b,session,'saveBaselineDraft'),c);
 assert.throws(()=>baseline.prepareBaselineCommand(b,{...session,clientId:randomUUID()},'saveBaselineDraft'));
 assert.throws(()=>baseline.prepareBaselineCommand({...b,controlGeneration:4},session,'saveBaselineDraft'));
 assert.throws(()=>baseline.prepareBaselineCommand({...b,input:{...b.input,reason:'다른 입력'}},session,'saveBaselineDraft'));
 assert.throws(()=>baseline.prepareBaselineCommand(b,session,'confirmBaseline'));
});
test('정확 초안 수신은 상대경로·원명령·hash·false flags를 확인하며 변조/타입 coercion을 거절한다',async()=>{
 const b=baseline.newBaselineBuffer(pid,session,3,null); b.input=input(); const c=baseline.prepareBaselineCommand(b,session,'saveBaselineDraft');
 const s=snapshot(),r=ref(s), result={commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:randomUUID(),targetId:r.id,version:1,serverReceivedAt:'2026-10-18T07:00:00.000Z',data:{status:'BASELINE_DRAFT_STORED',ref:r,snapshot:s}};
 const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/commands`);assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');assert.equal((init?.headers as any)['Idempotency-Key'],c.commandId);return response(result);});
 assert.deepEqual((await baseline.sendBaselineCommand(client,c,session)).ref,r);
 for(const corrupt of [{...s,executionAuthorized:true},{...s,input:{...s.input,items:[{...s.input.items[0],featureState:['NOT_IMPLEMENTED']}]}},{...s,sourceBinding:{...s.sourceBinding,kind:'ATTRIBUTE_REPORT'}}]){
  const bad={...result,data:{...result.data,snapshot:corrupt,ref:ref(corrupt,r.id)}}; await assert.rejects(baseline.sendBaselineCommand(new ApiClient(async()=>response(bad)),c,session));
 }
 await assert.rejects(baseline.sendBaselineCommand(new ApiClient(async()=>response({...result,data:{...result.data,snapshot:{...s,reason:'위조'}}})),c,session));
});
test('현재 미확정·legacy와 채택 metadata는 실행 허가가 아니며 목록/정확 조회는 교차 프로젝트를 거절한다',async()=>{
 const flags={sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const unconfirmed={projectId:pid,status:'UNCONFIRMED',ref:null,contentConfirmed:false,...flags};
 assert.deepEqual(await baseline.readCurrentBaseline(new ApiClient(async()=>response(unconfirmed)),pid),unconfirmed);
 await assert.rejects(baseline.readCurrentBaseline(new ApiClient(async()=>response({...unconfirmed,executionAuthorized:true})),pid));
 await assert.rejects(baseline.listBaselineRecords(new ApiClient(async()=>response({projectId:randomUUID(),items:[],hasMore:false,nextCursor:null,metadataIntegrity:'NOT_RECHECKED',...flags})),pid,'drafts',null));
 const s=snapshot(),r=ref(s); await assert.rejects(baseline.readBaselineDraft(new ApiClient(async()=>response({projectId:randomUUID(),ref:r,snapshot:s,headVersion:1,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,...flags,observedAt:s.recordedAt})),pid,r));
});
test('늦은 결과는 새 버퍼·다른 로그인·다른 pending에 결합되지 않는다',()=>{
 const b=baseline.newBaselineBuffer(pid,session,3,null);b.input=input();b.pending=baseline.prepareBaselineCommand(b,session,'saveBaselineDraft');
 const change=(v:typeof b)=>({...v,dirty:false,pending:null});
 assert.equal(baseline.mergeBaselineBuffer({...b,bindingId:randomUUID()},b,change)!.dirty,true);
 assert.equal(baseline.mergeBaselineBuffer({...b,ownerUserId:randomUUID()},b,change)!.dirty,true);
 assert.equal(baseline.mergeBaselineBuffer({...b,pending:{...b.pending,commandId:randomUUID()}},b,change)!.dirty,true);
 assert.equal(baseline.mergeBaselineBuffer(b,b,change)!.dirty,false);
});
test('근거 업로드는 바이트·hash와 원명령을 보존하며 보호 원문은 거절/변조 시 반환하지 않는다',async()=>{
 const b=baseline.newBaselineBuffer(pid,session,3,null);b.input=input(); const bytes=new TextEncoder().encode('실제 기능 증거 원문');
 const prepared=await baseline.prepareBaselineUpload(b,session,'FN-A',bytes,'text/plain;charset=utf-8');
 const a={artifactId:randomUUID(),bytes:bytes.length,contentHash:createHash('sha256').update(bytes).digest('hex'),mediaType:'text/plain;charset=utf-8'};
 const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/files`);assert.deepEqual(init?.body,bytes);return response({commandId:prepared.pending!.commandId,projectId:pid,status:'APPLIED',operationId:randomUUID(),targetId:a.artifactId,version:null,serverReceivedAt:'2026-10-18T07:00:00.000Z',data:{status:'ARTIFACT_READY',artifactRef:a}});});
 const saved=await baseline.sendBaselineUpload(client,prepared,session);assert.deepEqual(saved.input.items[0]!.evidenceRefs,[a]);assert.equal(saved.pending,null);
 assert.equal(new TextDecoder().decode(await baseline.readBaselineEvidence(new ApiClient(async()=>new Response(bytes,{headers:{'content-type':'application/octet-stream'}})),pid,a)),'실제 기능 증거 원문');
 await assert.rejects(baseline.readBaselineEvidence(new ApiClient(async()=>response({code:'ARTIFACT_QUARANTINED'},412)),pid,a));
 await assert.rejects(baseline.readBaselineEvidence(new ApiClient(async()=>new Response('변조',{headers:{'content-type':'application/octet-stream'}})),pid,a));
});
test('저장본 선택·검토 시작은 별도이며 미해결 명령/초안 변경은 검토·채택을 막는다',async()=>{
 const s=snapshot(),r=ref(s),flags={sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const view=await baseline.readBaselineDraft(new ApiClient(async()=>response({projectId:pid,ref:r,snapshot:s,headVersion:1,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,...flags,observedAt:s.recordedAt})),pid,r);
 const b=baseline.newBaselineBuffer(pid,session,3,null), restored=baseline.restoreBaselineDraft(b,session,view);
 assert.equal(restored.dirty,false);assert.equal(restored.review,null);
 const reviewing=baseline.beginBaselineReview(restored,session);assert.equal(reviewing.review!.outcome,'NOT_EXECUTED');assert.equal(reviewing.review!.items[0]!.outcome,'NOT_EXECUTED');
 reviewing.review!.items[0]!.outcome='ACCEPTED';reviewing.review!.items[0]!.reason='미구현으로 기록한 분류와 대조';reviewing.review!.coverage={outcome:'ACCEPTED',reason:'기능 범위 기록을 대조'};reviewing.review!.outcome='ACCEPTED';reviewing.review!.reason='사용자 내용 확인';
 const command=baseline.prepareBaselineCommand(reviewing,session,'reviewBaselineContent');reviewing.pending=command;
 assert.deepEqual(baseline.recheckBaselineCommand(reviewing,session),command);
 assert.throws(()=>baseline.restoreBaselineDraft(reviewing,session,view));
 assert.throws(()=>baseline.beginBaselineReview({...restored,dirty:true},session));
 const reviewSnapshot={input:reviewing.review,reviewedBy:{kind:'HUMAN',userId:user},reviewedAt:s.recordedAt,independence:'NOT_CLAIMED'},rr=ref(reviewSnapshot);
 const d={projectId:pid,draftRef:r,criteriaVersion:1,reviews:[{ref:rr,snapshot:reviewSnapshot,serverSequence:7}],hasMoreReviews:false,latestReviewAccepted:true,adoptedRef:null,draftIsHead:true,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,...flags,observedAt:s.recordedAt};
 const decision=await baseline.readBaselineDecision(new ApiClient(async()=>response(d)),pid,r);
 const adopting={...reviewing,pending:null,reviewDirty:false,confirmation:{reason:'기능 분류 기록만 채택',acknowledged:true}};
 const adopt=baseline.prepareBaselineAdoption(adopting,session,decision);
 assert.equal(adopt.operation,'confirmBaseline');assert.deepEqual(adopt.payload.reviewRefs,[rr]);
 assert.throws(()=>baseline.prepareBaselineAdoption(adopting,session,{...decision,latestReviewAccepted:false}));
 assert.throws(()=>baseline.prepareBaselineAdoption({...adopting,confirmation:{...adopting.confirmation,acknowledged:false}},session,decision));
 assert.throws(()=>baseline.prepareBaselineAdoption({...adopting,dirty:true},session,decision));
 const awaiting={...adopting,pending:adopt};assert.deepEqual(baseline.recheckBaselineCommand(awaiting,session),adopt);
 await assert.rejects(baseline.readBaselineDecision(new ApiClient(async()=>response({...d,reviews:[{...d.reviews[0],snapshot:{...reviewSnapshot,independence:'INDEPENDENT'}}]})),pid,r));
});
test('CORE 합격은 ACTUAL와 정상·저장조회·중요실패의 exact 근거가 모두 필요하고 다른 분류를 검토하지 않는다',()=>{
 const i:any=input(),a={artifactId:randomUUID(),bytes:2,contentHash:'d'.repeat(64),mediaType:'text/plain'};i.items[0].featureState='IMPLEMENTED_CORE_CHECKED';i.items[0].evidenceRefs=[a];validateBaselineInput(i);
 const s=snapshot(i),r=ref(s),b=baseline.newBaselineBuffer(pid,session,3,null),stored={projectId:pid,ref:r,snapshot:s,headVersion:1,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false as const,observedAt:s.recordedAt};
 const reviewing=baseline.beginBaselineReview(baseline.restoreBaselineDraft(b,session,stored),session),v=reviewing.review!;
 v.outcome='ACCEPTED';v.reason='실제 원문 검토';v.coverage={outcome:'ACCEPTED',reason:'기능 범위 확인'};v.items[0]!.outcome='ACCEPTED';v.items[0]!.reason='실제 기능 근거 확인';
 assert.throws(()=>validateBaselineReview(v));
 v.items[0]!.coreEvidence={basis:'ACTUAL',environment:'격리 개발',checkedAt:s.recordedAt,normalFlow:[a],storageRead:[a],importantFailure:[a]};validateBaselineReview(v);
 assert.throws(()=>validateBaselineReview({...v,items:[{...v.items[0],coreEvidence:{...v.items[0]!.coreEvidence,basis:'STATIC'}}]}));
 assert.throws(()=>validateBaselineReview({...v,items:[{...v.items[0],coreEvidence:{...v.items[0]!.coreEvidence,importantFailure:[]}}]}));
 assert.throws(()=>baseline.prepareBaselineCommand({...reviewing,review:{...v,items:[{...v.items[0]!,featureState:'NOT_IMPLEMENTED'}]}},session,'reviewBaselineContent'));
 assert.throws(()=>validateBaselineInput({...input(),items:[{...input().items[0],featureState:['IMPLEMENTED_CORE_CHECKED']}]}));
});
test('검증된 격리 종결은 원명령·격리 사실을 보존하여 명시 분리하며 유실 후 일반4xx는 잠금을 유지한다',async()=>{
 const b=baseline.newBaselineBuffer(pid,session,3,null);b.input=input();const bytes=new TextEncoder().encode('합성 시험');const next=await baseline.prepareBaselineUpload(b,session,'FN-A',bytes,'text/plain'),artifactId=randomUUID();
 const quarantined=new ApiClient(async()=>response({commandId:next.pending!.commandId,projectId:pid,status:'APPLIED',operationId:randomUUID(),targetId:artifactId,version:null,serverReceivedAt:'2026-10-18T07:00:00.000Z',data:{status:'ARTIFACT_QUARANTINED',artifactRef:{artifactId,...next.pending!.payload},inspection:{policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'SUSPECTED',reasonCodes:['PRIVATE_KEY_MARKER']}}}));
 let caught:ApiError|null=null;try{await baseline.sendBaselineUpload(quarantined,next,session);}catch(e){assert.ok(e instanceof ApiError);caught=e;}
 assert.ok(caught);const terminal=baseline.baselineMutationFailed({...next,uncertain:true},true,caught);assert.equal(terminal.uncertain,false);assert.equal(terminal.failure?.quarantinedArtifactId,artifactId);
 const released=baseline.releaseRejectedBaseline(terminal,session);assert.equal(released.pending,null);assert.equal(released.upload,null);assert.deepEqual(released.rejectedCommands[0]!.command,next.pending);assert.equal(released.rejectedCommands[0]!.failure.quarantinedArtifactId,artifactId);assert.deepEqual(released.input,b.input);
 const lost=baseline.baselineMutationFailed({...next,uncertain:true},true,new ApiError('FORBIDDEN',403));assert.equal(lost.uncertain,true);assert.throws(()=>baseline.releaseRejectedBaseline(lost,session));
 const rejected=baseline.baselineMutationFailed(next,false,new ApiError('FORBIDDEN',403));assert.equal(rejected.uncertain,false);assert.equal(baseline.releaseRejectedBaseline(rejected,session).pending,null);
});
test('현재 세대 새 초안은 해결된 옛세대 입력과 분리하고 미해결 원명령은 자동 이전하지 않는다',()=>{
 const old=baseline.newBaselineBuffer(pid,session,3,null);old.input=input();const before=structuredClone(old);
 const fresh=baseline.restartBaselineDraft(old,session,4,null);assert.equal(fresh.controlGeneration,4);assert.notEqual(fresh.bindingId,old.bindingId);assert.deepEqual(old,before);assert.equal(fresh.pending,null);
 const pending={...old,pending:baseline.prepareBaselineCommand(old,session,'saveBaselineDraft'),uncertain:true};assert.throws(()=>baseline.restartBaselineDraft(pending,session,4,null));
 assert.throws(()=>baseline.restartBaselineDraft(old,{...session,clientId:randomUUID()},4,null));
});
test('빈 항목 ID나 중복 항목 ID의 업로드는 다른 기능 근거로 연결되지 않도록 전송 전에 거절한다',async()=>{
 const b=baseline.newBaselineBuffer(pid,session,3,null);b.input=input();const bytes=new Uint8Array([1]);
 await assert.rejects(baseline.prepareBaselineUpload({...b,input:{...b.input,items:[{...b.input.items[0]!,itemId:''}]}},session,'',bytes,'text/plain'));
 await assert.rejects(baseline.prepareBaselineUpload({...b,input:{...b.input,items:[b.input.items[0]!,{...b.input.items[0]!,title:'다른 기능'}]}},session,'FN-A',bytes,'text/plain'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareDocumentSave,continueDocumentSave,type DocumentBuffer,type PendingDocumentSave,type DocumentWrite} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {newDocumentUploadApproval,prepareDocumentUploadApproval,bindDocumentUploadApproval} from '../../../apps/web/src/features/design-trace/document-upload-approval.ts';
import type {ApprovalView,ApprovalCommand,ApprovalRequestWork} from '../../../apps/web/src/features/decisions/api.ts';
const pid='ae600000-0000-4000-8000-000000000001',uid='ae600000-0000-4000-8000-000000000002',device='ae600000-0000-4000-8000-000000000003',rid='ae600000-0000-4000-8000-000000000004',did='ae600000-0000-4000-8000-000000000005',aid='ae600000-0000-4000-8000-000000000006';
const session={user:{id:uid},clientId:device,csrfToken:'C'.repeat(43)},at='2026-10-26T00:00:00.000Z',hash=(v:unknown)=>contentHash(canonicalJson(v));
async function draft(){const b:DocumentBuffer={ownerUserId:uid,projectId:pid,documentId:uid,baseVersion:2,formRef:{id:uid,version:1,contentHash:'a'.repeat(64)},title:'정확 문서',body:'\uFEFF# 원문\r\n',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],reason:'별도 개정',controlGeneration:4,dirty:true,pending:null,savedRef:null,failure:null};return {...b,pending:await prepareDocumentSave(b,session),failure:{code:'APPROVAL_REQUIRED',status:412}};}
function details():ApprovalRequestWork['details']{return{reason:'원문 한 번 보관',risks:{data:'합성 문서',security:'현재 권한 확인',cost:'없음',interruption:'없음',unverified:'DB 미확인'},rollback:{method:'원문 보존',limitations:'자동 삭제 안 함',evidenceRefs:[]},expiresAt:new Date(Date.now()+60000).toISOString()};}
function fixture(){
 let view:ApprovalView,generation=4,lost=false,saveDenied=false;const writes:DocumentWrite[]=[],raw:number[][]=[],reads:string[]=[];
 const policyBody={rules:[{ruleId:'UPLOAD',subjectRef:{kind:'HUMAN',userId:uid},operations:['uploadArtifact'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:new Date(Date.now()+300000).toISOString()}],reason:'업로드 승인',reviewRefs:[]},policyRef={id:aid,version:1,contentHash:hash(policyBody)};
 function approved(c:ApprovalCommand){const body={projectId:pid,details:structuredClone(c.payload.details),scopeDigest:hash(c.payload.details.actionScope),requiredDecider:{kind:'HUMAN' as const,userId:uid},policyRef,requestedBy:{kind:'HUMAN' as const,userId:uid,clientId:device},controlGeneration:4},requestRef={id:rid,version:1,contentHash:hash(body)},decision={requestId:rid,requestVersion:1,requestRef,scopeDigest:body.scopeDigest,decision:'APPROVE' as const,reason:'정확 범위 확인',decidedBy:body.requestedBy,controlGeneration:4,policyRef};
  view={request:{id:rid,version:1,status:'PENDING',...body,createdAt:at},requestRef,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision:{id:did,...decision,ref:{id:did,version:1,contentHash:hash(decision)},decidedAt:at},consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};return view;
 }
 const receipt=(c:DocumentWrite,data:unknown,targetId:string,version:number|null)=>Response.json({operationId:aid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId,version,serverReceivedAt:at,data});
 const client=new ApiClient(async(path,init)=>{
  if(init?.method!=='POST'){reads.push(String(path));if(String(path).endsWith('/permission-policy'))return Response.json({configured:true,policy:{ref:policyRef,...policyBody,createdAt:at}});if(String(path).includes('/approvals/'))return Response.json(view);return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:device,generation}});}
  const header=new Headers(init.headers).get('X-Anvil-Command'),c:DocumentWrite=JSON.parse(header??String(init.body));writes.push(c);
  if(header){raw.push(Array.from(new Uint8Array(await new Response(init.body).arrayBuffer())));if(lost){lost=false;view={...view,currentVersion:3,storedStatus:'CONSUMED',effectiveState:'CONSUMED',consumption:{id:aid,status:'CONSUMED',commandId:c.commandId,serverCommandId:aid,requestHash:hash(c),scopeDigest:view.request.scopeDigest,policyRef,consumedAt:at}};throw Error('응답 유실');}return receipt(c,{status:'ARTIFACT_READY',artifactRef:{artifactId:aid,...c.payload}},aid,null);}
  if(saveDenied)return Response.json({code:'DOCUMENT_APPROVAL_NOT_CONNECTED'},{status:412});
  const ref={id:uid,version:3,contentHash:hash({title:c.payload.title,formRef:c.payload.formRef,stageNodeRef:c.payload.stageNodeRef,content:c.payload.content})};return receipt(c,{status:'DRAFT',ref},uid,3);
 });
 return{client,approved,writes,raw,reads,get view(){return view;},stale(){generation++;},lose(){lost=true;},denySave(){saveDenied=true;}};
}
async function bound(){const b=await draft(),f=fixture(),w=await newDocumentUploadApproval(b,session);w.details=details();const request=await prepareDocumentUploadApproval(f.client,w,b,session,()=>true);f.approved(request);return{f,b,w,request,next:await bindDocumentUploadApproval(f.client,b,rid,session,()=>true)};}
test('문서 원문 승인 요청·결박은 전송하지 않으며 별도 재개에서 같은 bytes·명령과 승인 없는 문서 저장을 사용한다',async()=>{
 const{f,b,next}=await bound();assert.equal(f.writes.length,0);assert.equal(next.pending!.upload.commandId,b.pending.upload.commandId);assert.deepEqual(next.pending!.upload.payload,b.pending.upload.payload);assert.equal(b.pending.upload.approvalRef,null);
 const ref=await continueDocumentSave(f.client,next.pending!,session,()=>{},()=>true);assert.equal(ref.version,3);assert.equal(f.writes.length,2);assert.deepEqual(f.raw,[Array.from(new TextEncoder().encode(b.body))]);assert.equal(f.writes[0]!.commandId,b.pending.upload.commandId);assert.equal(f.writes[1]!.commandId,b.pending.saveCommandId);assert.equal(f.writes[1]!.approvalRef,null);
});
test('명확한412 이외·다른buffer·주체·본문 변조·이미 문서저장단계는 승인 준비를 열지 않는다',async()=>{
 for(const mutate of [(b:DocumentBuffer)=>b.failure={code:'CONNECTION_LOST',status:0},(b:DocumentBuffer)=>b.failure={code:'APPROVAL_REQUIRED',status:403},(b:DocumentBuffer)=>b.failure={code:'RESPONSE_INVALID',status:412},(b:DocumentBuffer)=>b.ownerUserId=aid,(b:DocumentBuffer)=>b.body+='변경',(b:DocumentBuffer)=>b.pending!.body+='변경',(b:DocumentBuffer)=>b.pending!.save={...b.pending!.upload,operation:'saveDocumentDraft'}]){const b=await draft();mutate(b);await assert.rejects(newDocumentUploadApproval(b,session),ApiError);}
});
test('원업로드·승인·명령 hash 변조는 실제 업로드 전에 거절한다',async()=>{
 const{f,next}=await bound();for(const mutate of [(p:PendingDocumentSave)=>p.upload.commandId=aid,(p:PendingDocumentSave)=>p.upload.approvalRef!.requestId=aid,(p:PendingDocumentSave)=>p.upload.payload.bytes=0,(p:PendingDocumentSave)=>p.body+='다름']){const p=structuredClone(next.pending!);mutate(p);await assert.rejects(continueDocumentSave(f.client,p,session,()=>{},()=>true),ApiError);}assert.equal(f.writes.length,0);
});
test('만료·현재정책회수·다른명령소비·옛제어는 승인 결박 뒤에도 업로드를 차단한다',async()=>{
 for(const mode of ['EXPIRED','REVOKED','OTHER_CONSUMED','CONTROL'] as const){const{f,next}=await bound();if(mode==='EXPIRED'){f.view.expired=true;f.view.effectiveState='EXPIRED';}if(mode==='REVOKED'){f.view.basisCurrent=false;f.view.effectiveState='REVOKED';}if(mode==='OTHER_CONSUMED'){f.view.currentVersion=3;f.view.storedStatus='CONSUMED';f.view.effectiveState='CONSUMED';f.view.consumption={id:aid,status:'CONSUMED',commandId:aid,serverCommandId:aid,requestHash:'b'.repeat(64),scopeDigest:f.view.request.scopeDigest,policyRef:f.view.request.policyRef,consumedAt:at};}if(mode==='CONTROL')f.stale();await assert.rejects(continueDocumentSave(f.client,next.pending!,session,()=>{},()=>true),ApiError);assert.equal(f.writes.length,0);}
});
test('업로드 응답 유실은 동일 승인 결박 명령을 재확인하고 소비된 exact hash만 재개한다',async()=>{
 const{f,next}=await bound();let pending=next.pending!;f.lose();await assert.rejects(continueDocumentSave(f.client,pending,session,p=>pending=p,()=>true),e=>e instanceof ApiError&&e.code==='CONNECTION_LOST');f.view.expired=true;const ref=await continueDocumentSave(f.client,pending,session,p=>pending=p,()=>true);assert.equal(ref.version,3);assert.deepEqual(f.writes[0],f.writes[1]);assert.deepEqual(f.raw[0],f.raw[1]);assert.equal(f.writes[2]!.approvalRef,null);
});
test('후속 문서저장의 별도 승인 거절을 업로드 승인으로 승격하지 않고 원명령을 보존한다',async()=>{
 const{f,next}=await bound();let pending=next.pending!;f.denySave();await assert.rejects(continueDocumentSave(f.client,pending,session,p=>pending=p,()=>true),e=>e instanceof ApiError&&e.code==='DOCUMENT_APPROVAL_NOT_CONNECTED');assert.equal(pending.save!.approvalRef,null);assert.equal(pending.save!.commandId,next.pending!.saveCommandId);assert.deepEqual(f.writes.map(c=>c.operation),['uploadArtifact','saveDocumentDraft']);
});

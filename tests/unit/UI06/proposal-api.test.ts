import {documentTextDiff} from '../../../apps/server/modules/documents/document-diff.ts';
import {readStoredProposal,compareDocumentProposal,readSelectedProposalDocument} from '../../../apps/web/src/features/design-trace/proposal-api.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import type { DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
import { continueDocumentProposal, prepareDocumentProposal, prepareProposalApplication, applyDocumentProposal } from '../../../apps/web/src/features/design-trace/proposal-api.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788', project = '51c0439f-791e-4bb5-8471-70938d6afaf1';
test('제안의 다른 주체·중단 화면·선택 없는 반영은 어떤 쓰기 요청도 만들지 않는다', async () => {
  const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) }, buffer: DocumentBuffer = { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, baseHash: 'a'.repeat(64), baseTitle: '원본', title: '원본', formRef: { id, version: 1, contentHash: 'b'.repeat(64) }, body: '# 제안\n변경', mediaType: 'text/markdown;charset=utf-8', content: { attachments: [], sections: [], sourceRefs: [] }, criteria: [], reason: '별도 제안', controlGeneration: 1, dirty: true, pending: null, savedRef: null, failure: null };
  const state = await prepareDocumentProposal(buffer, session); let requests = 0; const client = new ApiClient(async () => { requests++; return new Response('{}'); });
  await assert.rejects(continueDocumentProposal(client, state, { ...session, user: { id: project } }, () => {}, () => true), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_INPUT_INVALID');
  await assert.rejects(continueDocumentProposal(client, state, session, () => {}, () => false), (e: unknown) => (e as { code: string }).code === 'SAVE_CONTINUATION_PAUSED');
  await assert.rejects(prepareProposalApplication(client, state, session, false), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_SELECTION_REQUIRED');
  assert.equal(requests, 0);
});

test('수정 제안 선택은 원 문서의 고정 단계를 보존하고 단계가 바뀐 반영 명령은 전송하지 않는다', async () => {
  const session = { user: { id }, clientId: id, csrfToken: 'C'.repeat(43) }, stageNodeRef = { applicationId: project, nodeId: 'REQUIREMENTS' };
  const formRef = { id, version: 1, contentHash: 'b'.repeat(64) }, body = { artifactId: id, bytes: 3, contentHash: 'c'.repeat(64), mediaType: 'text/plain;charset=utf-8' }, content = { body, attachments: [], sections: [], sourceRefs: [] };
  const buffer: DocumentBuffer = { ownerUserId: id, projectId: project, documentId: id, baseVersion: 2, baseHash: 'a'.repeat(64), baseTitle: '원본', title: '원본', formRef, body: '변경', mediaType: body.mediaType, content: { attachments: [], sections: [], sourceRefs: [] }, criteria: [], reason: '별도 제안', controlGeneration: 1, dirty: true, pending: null, savedRef: null, failure: null, stageNodeRef };
  Object.assign(buffer, { baseStageNodeRef: stageNodeRef });
  await assert.rejects(prepareDocumentProposal({ ...buffer, stageNodeRef: null }, session), (e: unknown) => (e as { code: string }).code === 'PROPOSAL_BASE_REQUIRED');
  const state = await prepareDocumentProposal(buffer, session);
  state.proposal = { id: project, baseRef: state.baseRef, proposedContentRef: body, diffRef: { ...body, mediaType: 'application/json;charset=utf-8' }, status: 'PENDING' };
  state.comparison = { proposal: { ...state.proposal, proposedContent: content, selections: [], reason: buffer.reason, createdAt: '2026-10-17T00:00:00Z', proposedBy: id }, base: { document: { title: buffer.title, formRef, stageNodeRef }, body: '원문' }, proposedBody: buffer.body } as any;
  let writes = 0;
  const client = new ApiClient(async (url, init) => {
    if (init?.method !== 'POST') return new Response(JSON.stringify({ id: project, participation: 'OWNER', controlState: { actorId: id, clientId: id, generation: 1, status: 'HELD' } }), { headers: { 'content-type': 'application/json' } });
    writes++; const command = JSON.parse(String(init.body)), ref = { id, version: 3, contentHash: contentHash(canonicalJson({ title: buffer.title, formRef, stageNodeRef, content })) };
    return new Response(JSON.stringify({ commandId: command.commandId, projectId: project, status: 'APPLIED', operationId: id, targetId: id, version: 3, serverReceivedAt: '2026-10-17T00:00:00Z', data: { ref, status: 'DRAFT', proposalRef: project } }), { headers: { 'content-type': 'application/json' } });
  });
  state.applyCommand = await prepareProposalApplication(client, state, session, true);
  assert.deepEqual(state.applyCommand.payload.stageNodeRef, stageNodeRef);
  await assert.rejects(applyDocumentProposal(client, { ...state, applyCommand: { ...state.applyCommand, payload: { ...state.applyCommand.payload, stageNodeRef: null } } }, session, () => true));
  assert.equal(writes, 0);
  const result = await applyDocumentProposal(client, state, session, () => true);
  assert.equal(result.version, 3); assert.equal(writes, 1);
});

function sourceProposalFixture(bad=false){
 const pid='11111111-1111-4111-8111-111111111111',did='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',proposalId='44444444-4444-4444-8444-444444444444',diffId='55555555-5555-4555-8555-555555555555',at='2026-11-08T00:00:00.000Z',session={user:{id},clientId:id,csrfToken:'C'.repeat(43)},old='이전 원문\n',body='변경 원문\n';
 const H=(v:unknown)=>contentHash(canonicalJson(v)),file=(artifactId:string,text:string,mediaType='text/plain;charset=utf-8')=>({artifactId,bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType});
 const formRef={id,version:1,contentHash:'b'.repeat(64)},baseContent={body:file(id,old),attachments:[],sections:[],sourceRefs:[]},baseRef={id:did,version:1,contentHash:H({title:'원본',formRef,stageNodeRef:null,content:baseContent})};
 const sources=[{kind:'DOCUMENT_VERSION',id:pid,version:1,contentHash:'a'.repeat(64)},{kind:'ARTIFACT',id:aid,contentHash:'b'.repeat(64)},{kind:'CONVERSATION',id:proposalId,contentHash:'c'.repeat(64)},{kind:'USER_INSTRUCTION',id:diffId,contentHash:'d'.repeat(64)}],content={body:file(aid,body),attachments:[],sections:[],sourceRefs:bad?[{kind:'REMOTE_FILE',id:aid,contentHash:'b'.repeat(64)}]:sources};
 const diff={...documentTextDiff(old,body),baseRef,baseBodyRef:baseContent.body,proposedBodyRef:content.body,beforeContent:baseContent,afterContent:content},diffText=canonicalJson(diff),proposal={id:proposalId,baseRef,proposedContentRef:content.body,diffRef:file(diffId,diffText,'application/json;charset=utf-8'),status:'PENDING'},detail={...proposal,proposedContent:content,reason:'출처 보존 제안',createdAt:at,proposedBy:id,selections:[] as any[]};
 const wire=(version:number,c:any)=>({id:did,version,title:'원본',formRef,stageNodeRef:null,content:c,sourceRefs:structuredClone(c.sourceRefs),contentHash:H({title:'원본',formRef,stageNodeRef:null,content:c}),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]});
 const calls:{path:string;method:string;packet?:any}[]=[];let hook:((p:string)=>Response|Promise<Response>|null)|null=null,lost=false;
 const client=new ApiClient(async(path,init)=>{const p=String(path),method=init?.method??'GET',packet=method==='POST'?(typeof init?.body==='string'?JSON.parse(init.body):JSON.parse((init?.headers as Record<string,string>)['X-Anvil-Command']!)):undefined;calls.push({path:p,method,packet});if(hook){const v=await hook(p);if(v)return v;}
  if(packet){const base={operationId:id,commandId:packet.commandId,projectId:pid,status:'APPLIED',serverReceivedAt:at};
   if(packet.operation==='uploadArtifact')return Response.json({...base,targetId:content.body.artifactId,version:null,data:{status:'ARTIFACT_READY',artifactRef:content.body}});
   if(packet.operation==='proposeDocumentChange'){assert.deepEqual(packet.payload.proposedContent.sourceRefs,sources);assert.deepEqual(packet.payload.sourceRefs,[]);if(lost){lost=false;throw Error('응답 유실');}return Response.json({...base,targetId:did,version:1,data:{status:'PROPOSAL_RECORDED',ref:baseRef,proposal}});}
   assert.equal(packet.operation,'saveDocumentDraft');assert.deepEqual(packet.payload.content.sourceRefs,sources);detail.selections=[{documentId:did,version:2,selectedBy:id,at}];return Response.json({...base,targetId:did,version:2,data:{status:'DRAFT',ref:{id:did,version:2,contentHash:wire(2,content).contentHash},proposalRef:proposalId}});
  }
  if(p.endsWith('/proposals/'+proposalId))return Response.json(detail);
  if(p.includes('/documents/'+did+'/versions/'))return Response.json(p.endsWith('/1')?wire(1,baseContent):wire(2,content));
  if(p.includes('/files/')){const text=p.endsWith('/'+diffId)?diffText:p.endsWith('/'+aid)?body:old;return new Response(Buffer.from(text),{headers:{'content-type':'application/octet-stream'}});}
  if(p==='/api/v1/projects/'+pid)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:id,clientId:id,generation:1,status:'HELD'}});
  throw Error('UNMODELED_SOURCE_PROPOSAL_REQUEST');
 });
 const buffer:DocumentBuffer={ownerUserId:id,projectId:pid,documentId:did,baseVersion:1,baseHash:baseRef.contentHash,baseTitle:'원본',baseStageNodeRef:null,stageNodeRef:null,formRef,title:'원본',body,mediaType:'text/plain;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:sources as any},criteria:[],reason:detail.reason,controlGeneration:1,dirty:true,pending:null,savedRef:null,failure:null};
 return {pid,did,proposalId,client,calls,session,buffer,sources,detail,setHook:(h:typeof hook)=>{hook=h;},lose:()=>{lost=true;}};
}
test('4종 proposedContent는 원 제안packet/diff/상세와 명시반영·고정 GET에 그대로 보존된다',async()=>{
 const f=sourceProposalFixture();let state=await prepareDocumentProposal(f.buffer,f.session);
 state=await continueDocumentProposal(f.client,state,f.session,p=>{state=p;},()=>true);state.comparison=await compareDocumentProposal(f.client,state,f.session);
 assert.deepEqual(state.comparison.proposal.proposedContent.sourceRefs,f.sources);state.applyCommand=await prepareProposalApplication(f.client,state,f.session,true);const ref=await applyDocumentProposal(f.client,state,f.session,()=>true);assert.equal(ref.version,2);
 const selected=await readStoredProposal(f.client,f.pid,f.proposalId),document=await readSelectedProposalDocument(f.client,f.pid,selected,()=>true);assert.deepEqual(document.document.content.sourceRefs,f.sources);assert.equal(document.document.contentHash,ref.contentHash);assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
});
test('hash-valid diff/상세에 넣은 미지원 proposed SourceRef도 본문으로 채택하지 않는다',async()=>{
 const f=sourceProposalFixture(true);await assert.rejects(readStoredProposal(f.client,f.pid,f.proposalId));
});

test('제안응답 UNKNOWN은 원 snapshot/UUID를 재사용하고 닫힌상세/다른주체는 추가효과0이다',async()=>{
 const f=sourceProposalFixture();let state=await prepareDocumentProposal(f.buffer,f.session);f.lose();
 await assert.rejects(continueDocumentProposal(f.client,state,f.session,p=>{state=p;},()=>true),{code:'CONNECTION_LOST'});const original=structuredClone(state);assert.ok(state.command);const first=f.calls.filter(c=>c.method==='POST').at(-1)!.packet;
 state=await continueDocumentProposal(f.client,state,f.session,p=>{state=p;},()=>true);assert.ok(state.proposal);assert.deepEqual(f.calls.filter(c=>c.method==='POST').at(-1)!.packet,first);assert.deepEqual(state.snapshot,original.snapshot);assert.equal(f.calls.filter(c=>c.packet?.operation==='uploadArtifact').length,1);
 const count=f.calls.length;await assert.rejects(readStoredProposal(f.client,f.pid,f.proposalId,()=>false),{code:'DOCUMENT_READ_PAUSED'});assert.equal(f.calls.length,count);
 await assert.rejects(compareDocumentProposal(f.client,state,{...f.session,clientId:project}),{code:'PROPOSAL_INPUT_INVALID'});assert.equal(f.calls.length,count);
});
test('상세 await 뒤 scope/transport 이탈은 후속 원문 GET·본문반환을 막는다',async()=>{
 const f=sourceProposalFixture();let active=true,files=0;const old=f.client.transport;
 f.client.transport=async(path,init)=>{const r=await old(path,init);if(String(path).includes('/proposals/'))active=false;if(String(path).includes('/files/'))files++;return r;};
 await assert.rejects(readStoredProposal(f.client,f.pid,f.proposalId,()=>active),{code:'DOCUMENT_READ_PAUSED'});assert.equal(files,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {prepareKnowledgeCorrection,sendKnowledgeCorrection} from '../../../apps/web/src/features/knowledge/correction-api.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {correctionFixture,documentSource,pid,uid,aid,kid,freshAid,session} from './knowledge-correction-source-fixture.ts';
async function module(){return import('../../../apps/web/src/features/knowledge/knowledge-correction-sources.ts');}
test('정정의 이번 문서근거만 추가/해제하며 본문·이유·이전 출처는 보존한다',async()=>{
 const m=await module(),{buffer}=correctionFixture(),before=structuredClone(buffer),source={...documentSource};
 const next=m.attachKnowledgeCorrectionDocument(buffer,session,pid,source);
 assert.deepEqual(buffer,before);assert.equal(next.body,buffer.body);assert.equal(next.reason,buffer.reason);assert.deepEqual(next.target,buffer.target);assert.deepEqual(next.additionalDocumentSources,[source]);
 source.contentHash='c'.repeat(64);assert.equal(next.additionalDocumentSources![0]!.contentHash,'a'.repeat(64));
 const detached=m.detachKnowledgeCorrectionDocument(next,session,pid,documentSource);assert.deepEqual(detached.additionalDocumentSources,[]);assert.deepEqual(detached.target.entry.sourceRefs,before.target.entry.sourceRefs);
 assert.throws(()=>m.detachKnowledgeCorrectionDocument(detached,session,pid,documentSource));
});
test('중복/기존출처·한도와 원문자리·동결/다른owner·client·project·세대는 변경0이다',async()=>{
 const m=await module(),{buffer}=correctionFixture(),next=m.attachKnowledgeCorrectionDocument(buffer,session,pid,documentSource);
 for(const source of [documentSource,{...documentSource,contentHash:'f'.repeat(64)},{...documentSource,version:0},{...documentSource,extra:true}])assert.throws(()=>m.attachKnowledgeCorrectionDocument(next,session,pid,source));
 for(const patch of [{pending:{}},{uncertain:true},{savedRef:buffer.target.ref},{ownerUserId:aid},{ownerClientId:aid},{projectId:aid},{controlGeneration:0}]){
  const bad={...buffer,...patch} as any,before=structuredClone(bad);assert.throws(()=>m.attachKnowledgeCorrectionDocument(bad,session,pid,documentSource));assert.deepEqual(bad,before);
 }
 const old={...buffer,target:{...buffer.target,entry:{...buffer.target.entry,sourceRefs:[documentSource]}}};
 assert.throws(()=>m.attachKnowledgeCorrectionDocument(old,session,pid,documentSource));assert.throws(()=>m.detachKnowledgeCorrectionDocument(old,session,pid,documentSource));
 const full={...buffer,target:{...buffer.target,entry:{...buffer.target.entry,sourceRefs:Array.from({length:198},(_,n)=>({...documentSource,version:n+10}))}}};
 assert.throws(()=>m.attachKnowledgeCorrectionDocument(full,session,pid,documentSource));
});
test('선택근거를 고정명령·entry/changeSources에 저장하고 유실 재확인도 같은 payload다',async()=>{
 const m=await module(),{buffer,view}=correctionFixture(),b=m.attachKnowledgeCorrectionDocument(buffer,session,pid,documentSource);
 b.pending=await prepareKnowledgeCorrection(b,session);assert.deepEqual(b.pending.input.additionalDocumentSources,[documentSource]);
 const writes:any[]=[];const client=new ApiClient(async(input,init)=>{
  const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);
  if(!upload&&writes.length===2)throw Error('lost');
  return Response.json({operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?freshAid:kid,version:upload?null:2,
   data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:freshAid,...c.payload}}:{status:'PROPOSED',ref:{id:kid,version:2,contentHash:contentHash(canonicalJson(c.payload.entry))},entry:c.payload.entry,baseRef:view.ref,supersedesRef:view.ref,reason:b.changeReason,changeSources:c.payload.sourceRefs,eventId:aid},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-10-22T00:00:00Z'});
 });
 await assert.rejects(sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true));assert.equal(writes.length,2);
 assert.throws(()=>m.detachKnowledgeCorrectionDocument(b,session,pid,documentSource));
 const result=await sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true);assert.equal(result.version,2);assert.deepEqual(writes[1],writes[2]);
 assert(writes[1].payload.entry.sourceRefs.some((r:any)=>canonicalJson(r)===canonicalJson(documentSource)));assert(writes[1].payload.sourceRefs.some((r:any)=>canonicalJson(r)===canonicalJson(documentSource)));assert.equal(view.body,'기존 원문');
 const tampered={...b,additionalDocumentSources:[{...documentSource,version:3}]};let calls=0;
 await assert.rejects(sendKnowledgeCorrection(new ApiClient(async()=>{calls++;throw Error();}),tampered,session,()=>{},()=>true));assert.equal(calls,0);
});
test('업로드 await 중 caller의 선택목록이 변해도 최초 고정 문서근거만 전송한다',async()=>{
 const m=await module(),{buffer,view}=correctionFixture(),b=m.attachKnowledgeCorrectionDocument(buffer,session,pid,documentSource);
 b.pending=await prepareKnowledgeCorrection(b,session);const writes:any[]=[];
 const client=new ApiClient(async(input,init)=>{
  const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);
  if(upload)b.additionalDocumentSources![0]!.version=3;
  return Response.json({operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?freshAid:kid,version:upload?null:2,data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:freshAid,...c.payload}}:{status:'PROPOSED',ref:{id:kid,version:2,contentHash:contentHash(canonicalJson(c.payload.entry))},entry:c.payload.entry,baseRef:view.ref,supersedesRef:view.ref,reason:b.changeReason,changeSources:c.payload.sourceRefs,eventId:aid},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-10-22T00:00:00Z'});
 });
 await sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true);
 assert.equal(writes.length,2);assert.deepEqual(writes[1].payload.sourceRefs.find((r:any)=>r.kind==='DOCUMENT_VERSION'),documentSource);
 assert.deepEqual(writes[1].payload.entry.sourceRefs.find((r:any)=>r.kind==='DOCUMENT_VERSION'),documentSource);
});
test('새 선택 필드가 없는 과거 pending은 원 capture 형식과 중단 의미를 유지한다',async()=>{
 const {buffer}=correctionFixture();delete buffer.additionalDocumentSources;buffer.pending=await prepareKnowledgeCorrection(buffer,session);
 assert.equal('additionalDocumentSources'in buffer.pending.input,false);let calls=0;
 await assert.rejects(sendKnowledgeCorrection(new ApiClient(async()=>{calls++;throw Error();}),buffer,session,()=>{},()=>false),(e:any)=>e.code==='KNOWLEDGE_CORRECTION_PAUSED');assert.equal(calls,0);
});

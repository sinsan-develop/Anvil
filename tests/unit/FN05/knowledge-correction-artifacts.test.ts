import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {prepareKnowledgeCorrection,sendKnowledgeCorrection} from '../../../apps/web/src/features/knowledge/correction-api.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {correctionFixture,documentSource,pid,aid,kid,freshAid,session} from './knowledge-correction-source-fixture.ts';
const file={projectId:pid,artifact:{artifactId:'77777777-7777-4777-8777-777777777777',bytes:12,contentHash:'c'.repeat(64),mediaType:'text/plain;charset=utf-8'}};
const source={kind:'ARTIFACT' as const,id:file.artifact.artifactId,contentHash:file.artifact.contentHash};
async function module(){const m:any=await import('../../../apps/web/src/features/knowledge/knowledge-correction-sources.ts');assert.equal(typeof m.attachKnowledgeCorrectionArtifact,'function');assert.equal(typeof m.detachKnowledgeCorrectionArtifact,'function');return m;}
test('정정 새파일근거만 선택/해제하고 기존문서·본문·원본출처를 보존한다',async()=>{
 const m=await module(),{buffer}=correctionFixture(),old=structuredClone(buffer),selected=structuredClone(file);
 const next=m.attachKnowledgeCorrectionArtifact(buffer,session,selected);selected.artifact.contentHash='d'.repeat(64);
 assert.deepEqual(buffer,old);assert.deepEqual(next.additionalArtifactSources,[source]);assert.equal(next.body,buffer.body);assert.deepEqual(next.target,buffer.target);
 const both=m.attachKnowledgeCorrectionDocument(next,session,pid,documentSource),detached=m.detachKnowledgeCorrectionArtifact(both,session,pid,source);
 assert.deepEqual(detached.additionalArtifactSources,[]);assert.deepEqual(detached.additionalDocumentSources,[documentSource]);assert.throws(()=>m.detachKnowledgeCorrectionArtifact(detached,session,pid,source));
});
test('정정 파일근거의 다른프로젝트·주체/기기·동결·기존원문/중복·합산한도를 거절한다',async()=>{
 const m=await module(),{buffer}=correctionFixture(),next=m.attachKnowledgeCorrectionArtifact(buffer,session,file);
 for(const selected of [file,{...file,projectId:aid},{...file,artifact:{...file.artifact,contentHash:'e'.repeat(64)}},{...file,artifact:{...file.artifact,mediaType:'image/png'}},{...file,artifact:{...file.artifact,bytes:2097153}},{...file,artifact:{...file.artifact,artifactId:aid}}])assert.throws(()=>m.attachKnowledgeCorrectionArtifact(next,session,selected));
 for(const patch of [{pending:{}},{savedRef:buffer.target.ref},{uncertain:true},{ownerUserId:aid},{ownerClientId:aid},{controlGeneration:0}]){const bad={...buffer,...patch},old=structuredClone(bad);assert.throws(()=>m.attachKnowledgeCorrectionArtifact(bad,session,file));assert.deepEqual(bad,old);}
 const full={...buffer,additionalDocumentSources:Array.from({length:197},(_,n)=>({...documentSource,version:n+1}))};assert.throws(()=>m.attachKnowledgeCorrectionArtifact(full,session,file));
});
test('정정 파일근거는 고정명령/재시도에 보존되며 await caller변조와 과거필드 누락을 구분한다',async()=>{
 const m=await module(),{buffer,view}=correctionFixture(),b=m.attachKnowledgeCorrectionArtifact(buffer,session,file);b.pending=await prepareKnowledgeCorrection(b,session);assert.deepEqual(b.pending.input.additionalArtifactSources,[source]);const writes:any[]=[];
 const client=new ApiClient(async(input,init)=>{const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);if(upload)b.additionalArtifactSources[0].contentHash='d'.repeat(64);if(writes.length===2)throw Error('SYNTHETIC_LOST_REPLY');
  return Response.json({operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?freshAid:kid,version:upload?null:2,data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:freshAid,...c.payload}}:{status:'PROPOSED',ref:{id:kid,version:2,contentHash:contentHash(canonicalJson(c.payload.entry))},entry:c.payload.entry,baseRef:view.ref,supersedesRef:view.ref,reason:b.changeReason,changeSources:c.payload.sourceRefs,eventId:aid},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-10-22T00:00:00Z'});
 });
 await assert.rejects(sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true));assert.deepEqual(writes[1].payload.sourceRefs.find((r:any)=>r.id===source.id),source);assert.deepEqual(writes[1].payload.entry.sourceRefs.find((r:any)=>r.id===source.id),source);
 b.additionalArtifactSources=[{...source}];await sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true);assert.equal(writes.length,3);assert.deepEqual(writes[1],writes[2]);b.additionalArtifactSources[0].contentHash='d'.repeat(64);
 let calls=0;await assert.rejects(sendKnowledgeCorrection(new ApiClient(async()=>{calls++;throw Error();}),b,session,()=>{},()=>true));assert.equal(calls,0);
 delete buffer.additionalArtifactSources;const legacy=await prepareKnowledgeCorrection(buffer,session);assert.equal('additionalArtifactSources'in legacy.input,false);
});

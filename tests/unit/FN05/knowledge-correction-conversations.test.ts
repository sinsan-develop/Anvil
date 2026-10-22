import assert from 'node:assert/strict';import{test}from'node:test';
import {prepareKnowledgeCorrection,sendKnowledgeCorrection} from '../../../apps/web/src/features/knowledge/correction-api.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {fixtureData} from './knowledge-conversation-source-fixture.ts';
import {correctionFixture,documentSource,pid,uid,aid,kid,freshAid,session} from './knowledge-correction-source-fixture.ts';
const ref={kind:'CONVERSATION' as const,id:'99999999-9999-4999-8999-999999999999',contentHash:'c'.repeat(64)},message={kind:'USER_MESSAGE',effectiveScope:{projectId:pid}};
async function module(){const m:any=await import('../../../apps/web/src/features/knowledge/knowledge-correction-sources.ts');assert.equal(typeof m.attachKnowledgeCorrectionConversation,'function');assert.equal(typeof m.detachKnowledgeCorrectionConversation,'function');return m;}
test('정정 보관 발언/지시 근거는 본문·과거출처를 보존하고 새선택만 해제한다',async()=>{
 const m=await module(),{buffer}=correctionFixture(),copy=structuredClone(buffer);
 const a=m.attachKnowledgeCorrectionConversation(buffer,session,pid,{sourceRef:ref,message});assert.deepEqual(a.additionalConversationSources,[ref]);assert.deepEqual(buffer,copy);assert.equal(a.body,buffer.body);
 const detached=m.detachKnowledgeCorrectionConversation(a,session,pid,ref);assert.deepEqual(detached.additionalConversationSources,[]);assert.deepEqual(detached.target,buffer.target);
 const instruction=m.attachKnowledgeCorrectionConversation(buffer,session,pid,{sourceRef:ref,message:{...message,kind:'USER_INSTRUCTION'}});assert.equal(instruction.additionalConversationSources[0].kind,'USER_INSTRUCTION');
 const pending=await prepareKnowledgeCorrection(instruction,session);assert.deepEqual(pending.input.additionalConversationSources,[{...ref,kind:'USER_INSTRUCTION'}]);
});
test('발언근거의 다른귀속·중복/종류변조·동결·합산한도·과거참조 해제는 거절한다',async()=>{
 const m=await module(),{buffer}=correctionFixture(),a=m.attachKnowledgeCorrectionConversation(buffer,session,pid,{sourceRef:ref,message});
 for(const source of [{sourceRef:ref,message},{sourceRef:{...ref,contentHash:'e'.repeat(64)},message},{sourceRef:{...ref,kind:'USER_INSTRUCTION'},message},{sourceRef:ref,message:{...message,effectiveScope:{projectId:aid}}},{sourceRef:ref,message:{...message,kind:'AGENT'}}])assert.throws(()=>m.attachKnowledgeCorrectionConversation(a,session,pid,source));
 for(const patch of [{pending:{}},{uncertain:true},{savedRef:buffer.target.ref},{ownerUserId:aid},{ownerClientId:aid},{controlGeneration:0}])assert.throws(()=>m.attachKnowledgeCorrectionConversation({...buffer,...patch},session,pid,{sourceRef:ref,message}));
 assert.throws(()=>m.detachKnowledgeCorrectionConversation(buffer,session,pid,{kind:'CONVERSATION',id:uid,contentHash:'b'.repeat(64)}));
 const full={...buffer,additionalDocumentSources:Array.from({length:197},(_,n)=>({...documentSource,version:n+1}))};assert.throws(()=>m.attachKnowledgeCorrectionConversation(full,session,pid,{sourceRef:ref,message}));
});
test('선택한 지시근거는 await변조와 유실뒤에도 고정 payload로만 저장하며 과거필드누락은 보존한다',async()=>{
 const m=await module(),{buffer,view}=correctionFixture(),f=fixtureData(true),b=m.attachKnowledgeCorrectionConversation(buffer,session,pid,f.conversation);b.pending=await prepareKnowledgeCorrection(b,session);const writes:any[]=[];
 const client=new ApiClient(async(input,init)=>{const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);if(upload)b.additionalConversationSources[0].contentHash='d'.repeat(64);if(writes.length===2)throw Error('SYNTHETIC_REPLY_LOST');return Response.json({operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?freshAid:kid,version:upload?null:2,data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:freshAid,...c.payload}}:{status:'PROPOSED',ref:{id:kid,version:2,contentHash:contentHash(canonicalJson(c.payload.entry))},entry:c.payload.entry,baseRef:view.ref,supersedesRef:view.ref,reason:b.changeReason,changeSources:c.payload.sourceRefs,eventId:aid},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-10-23T00:00:00Z'});});
 await assert.rejects(sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true));assert.deepEqual(writes[1].payload.sourceRefs.find((r:any)=>r.id===f.source.id),f.source);assert.deepEqual(writes[1].payload.entry.sourceRefs.find((r:any)=>r.id===f.source.id),f.source);
 b.additionalConversationSources=[{...f.source}];await sendKnowledgeCorrection(client,b,session,p=>b.pending=p,()=>true);assert.equal(writes.length,3);assert.deepEqual(writes[1],writes[2]);
 b.additionalConversationSources[0].kind='CONVERSATION';let calls=0;await assert.rejects(sendKnowledgeCorrection(new ApiClient(async()=>{calls++;throw Error();}),b,session,()=>{},()=>true));assert.equal(calls,0);
 delete buffer.additionalConversationSources;assert.equal('additionalConversationSources'in(await prepareKnowledgeCorrection(buffer,session)).input,false);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const reader=await import(new URL('../../../apps/web/src/features/workspace/workspace-conversation-reader.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const presenter=await import(new URL('../../../apps/web/src/features/workspace/conversation-source-read-only.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const pid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',mid='33333333-3333-4333-8333-333333333333',uid='44444444-4444-4444-8444-444444444444',at='2026-10-18T05:00:00Z';
function fixture(){
 const body='<script>window.RUN=1</script>\n개발 주도권은 사용자에게 있다',authorRef={kind:'HUMAN' as const,userId:uid},message={kind:'USER_INSTRUCTION' as const,bodyRef:{artifactId:uid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8' as const},attachmentRefs:[] as never[],replyTo:null,supersedesInstructionRef:{kind:'CONVERSATION' as const,id:uid,contentHash:'c'.repeat(64)},effectiveScope:{projectId:pid,stageRefs:[] as never[],taskRefs:[] as never[]}};
 const sourceRef={kind:'CONVERSATION' as const,id:mid,contentHash:contentHash(canonicalJson({conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:2,authorRef}))},source={sourceRef,conversationId:cid,serverSequence:2,authorRef,message,body,deliveryState:'STORED' as const,redactionState:'NOT_REDACTED' as const,sensitiveInspection:'KNOWN_PATTERNS_ONLY' as const,recordedAt:at};
 const conversations={items:[{id:cid,headSequence:2,targetRoleRef:null,updatedAt:at,integrity:'NOT_RECHECKED' as const}],hasMore:false,nextCursor:null,observedAt:at};
 const messages={conversationId:cid,observedHeadSequence:2,items:[{sourceRef,serverSequence:2,authorRef,kind:message.kind,replyTo:null,supersedesInstructionRef:message.supersedesInstructionRef,recordedAt:at,deliveryState:'STORED' as const}],hasMore:false,nextCursor:null,observedAt:at};
 return{body,sourceRef,source,conversations,messages};
}
function make(client:ApiClient,onState=(value:any)=>{},onAuth=()=>{}){assert.equal(typeof reader.WorkspaceConversationReader,'function');return new reader.WorkspaceConversationReader(client,pid,onState,onAuth);}
test('목록→대화→정확 발언 GET으로 원문을 읽고 저장·전달·효력을 구분한다',async()=>{
 const f=fixture(),calls:string[]=[],client=new ApiClient(async(path,init)=>{calls.push(String(path));assert.equal(init?.method,'GET');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');if(String(path).endsWith('/messages/'+mid))return Response.json(f.source);if(String(path).includes('/messages?'))return Response.json(f.messages);return Response.json(f.conversations);});
 const model=make(client);await model.list();assert.equal(model.state.source,null);await model.open(cid);await model.read(f.sourceRef);assert.equal(model.state.source?.body,f.body);assert.equal(calls.length,3);
 assert.equal(typeof presenter.ConversationSourceReadOnly,'function');const html=renderToStaticMarkup(createElement(presenter.ConversationSourceReadOnly,{source:model.state.source}));
 for(const value of ['사용자 지시 원문','서버 순번 2',mid,f.sourceRef.contentHash,'정정 대상',uid,'현재 유효한 지시 선별·임무 맥락 편입은 미판정','Agent 전달·수신·이해 확인이 아닙니다.'])assert.ok(html.includes(value),value);
 assert.ok(html.includes('&lt;script&gt;window.RUN=1&lt;/script&gt;'));assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<button'),false);model.dispose();
});
test('목록 밖 참조는 조회하지 않고 본문 변조·401 뒤 이전 원문을 남기지 않는다',async()=>{
 const f=fixture();let mode='valid',sourceCalls=0,auth=0;const client=new ApiClient(async(path)=>{if(String(path).endsWith('/messages/'+mid)){sourceCalls++;return mode==='401'?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(mode==='bad'?{...f.source,body:'변조'}:f.source);}return Response.json(String(path).includes('/messages?')?f.messages:f.conversations);});
 const model=make(client,()=>{},()=>auth++);await model.list();await model.open(cid);await model.read({...f.sourceRef,contentHash:'f'.repeat(64)});assert.equal(sourceCalls,0);assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_SELECTION_INVALID');
 await model.read(f.sourceRef);assert.equal(model.state.source?.body,f.body);mode='bad';await model.read(f.sourceRef);assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_INTEGRITY_FAILED');mode='401';await model.read(f.sourceRef);assert.equal(model.state.source,null);assert.equal(auth,1);model.dispose();
});
test('해제 뒤 늦은 응답과 재사용은 상태·인증 콜백이나 새 조회를 만들지 않는다',async()=>{
 let release!:(value:Response)=>void,calls=0;const gate=new Promise<Response>(resolve=>{release=resolve;}),states:any[]=[];const model=make(new ApiClient(async()=>{calls++;return gate;}),value=>states.push(value));const pending=model.list();const count=states.length;model.dispose();release(Response.json(fixture().conversations));await pending;assert.equal(states.length,count);await model.list();assert.equal(calls,1);
});

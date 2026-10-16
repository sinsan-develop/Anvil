import assert from'node:assert/strict';import{test}from'node:test';
import{ApiClient,ApiError}from'../../../apps/web/src/api/client.ts';import{canonicalJson,contentHash}from'../../../contracts/canonical.ts';
const load=()=>import('../../../apps/web/src/features/knowledge/conversation-api.ts').catch(()=>null);
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',cid='44444444-4444-4444-8444-444444444444',mid='55555555-5555-4555-8555-555555555555';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
test('사용자 원문 대화 저장은 실제 출처/순번 receipt를 대조하고 단절 뒤 같은 명령을 보존한다',async()=>{
 const m=await load();assert.ok(m,'대화 Web 연결이 필요하다');const b=m.newConversation(pid,session,1);b.kind='USER_INSTRUCTION';b.body='프로젝트 지식은 사용자가 소유한다';b.pending=await m.prepareConversation(b,session);
 const writes:any[]=[];const client=new ApiClient(async(input,init)=>{
  const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);if(!upload&&writes.length===2)throw Error('lost');
  const snapshot=upload?null:{conversationId:cid,targetRoleRef:null,message:c.payload.message,sourceRefs:[],serverSequence:1,authorRef:{kind:'HUMAN',userId:uid}},hash=upload?'':contentHash(canonicalJson(snapshot));
  const data=upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:aid,...c.payload}}:{status:'CONVERSATION_STORED',sourceRef:{kind:'CONVERSATION',id:mid,contentHash:hash},conversationId:cid,serverSequence:1,deliveryState:'STORED',message:snapshot};
  return new Response(JSON.stringify({operationId:mid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?aid:mid,version:upload?null:1,data,evidenceRefs:[],warnings:[],serverReceivedAt:'2026-10-16T05:00:00Z'}),{headers:{'content-type':'application/json'}});
 });
 await assert.rejects(m.sendConversation(client,b,session,p=>b.pending=p,()=>true),ApiError);const result=await m.sendConversation(client,b,session,p=>b.pending=p,()=>true);assert.equal(result.serverSequence,1);assert.equal(result.conversationId,cid);assert.equal(writes.length,3);assert.deepEqual(writes[1],writes[2]);assert.equal(writes[1].payload.message.kind,'USER_INSTRUCTION');
 let calls=0;await assert.rejects(m.sendConversation(new ApiClient(async()=>{calls++;throw Error();}),b,session,()=>{},()=>false),ApiError);assert.equal(calls,0);
});
test('대화 원문 조회는 사용자 출처/hash·STORED를 대조하고 가짜 전달/변조 본문을 채택하지 않는다',async()=>{
 const m=await load();assert.ok(m,'대화 조회 연결이 필요하다');const body='보존할 지시',message={kind:'USER_INSTRUCTION',bodyRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:pid,stageRefs:[],taskRefs:[]}},authorRef={kind:'HUMAN',userId:uid};
 const sourceRef={kind:'CONVERSATION' as const,id:mid,contentHash:contentHash(canonicalJson({conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:1,authorRef}))},view={sourceRef,conversationId:cid,serverSequence:1,authorRef,message,body,deliveryState:'STORED',redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',recordedAt:'2026-10-16T05:00:00Z'};
 const client=(v:unknown)=>new ApiClient(async()=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}}));assert.equal((await m.readConversationMessage(client(view),pid,cid,sourceRef)).body,body);
 for(const bad of [{...view,body:'changed'},{...view,deliveryState:'EXECUTED'},{...view,authorRef:{kind:'AGENT',userId:uid}}])await assert.rejects(m.readConversationMessage(client(bad),pid,cid,sourceRef),ApiError);
});
test('대화 목록의 잘못된 종류·순번·cursor 상태는 빈 결과로 숨기지 않는다',async()=>{
 const m=await load();assert.ok(m);const at='2026-10-16T05:00:00Z',page={items:[],hasMore:false,nextCursor:null,observedAt:at},client=(v:unknown)=>new ApiClient(async()=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}}));
 assert.deepEqual((await m.listConversations(client(page),pid)).items,[]);
 for(const bad of [{...page,items:null},{...page,hasMore:true},{...page,items:[{id:cid,headSequence:0,targetRoleRef:null,updatedAt:at,integrity:'NOT_RECHECKED'}]}])await assert.rejects(m.listConversations(client(bad),pid),ApiError);
 await assert.rejects(m.listConversationMessages(client({...page,conversationId:cid,observedHeadSequence:1,items:[{sourceRef:{kind:'CONVERSATION',id:mid,contentHash:'a'.repeat(64)},serverSequence:2,kind:'USER_MESSAGE',authorRef:{kind:'HUMAN',userId:uid},replyTo:null,supersedesInstructionRef:null,recordedAt:at,deliveryState:'STORED'}]}),pid,cid),ApiError);
});

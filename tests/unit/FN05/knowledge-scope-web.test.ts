import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newKnowledge,prepareKnowledge,sendKnowledge,readKnowledge} from '../../../apps/web/src/features/knowledge/api.ts';
import {newKnowledgeCorrection,prepareKnowledgeCorrection,sendKnowledgeCorrection} from '../../../apps/web/src/features/knowledge/correction-api.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333';
const s={user:{id},clientId:id,csrfToken:'C'.repeat(43)},r={id,version:2,contentHash:'a'.repeat(64)},scope={projectId:pid,stageRefs:[{applicationRef:r,nodeId:'N1'}],taskRefs:[{planRef:r,taskCode:'UI10'}]};
function transport(writes:any[],lost=false){return new ApiClient(async(input,init)=>{const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);if(lost&&!upload&&writes.length===2)throw Error('lost');const e=c.payload.entry,ref=upload?null:{id,version:c.operation==='correctKnowledge'?2:1,contentHash:contentHash(canonicalJson(e))};return Response.json({operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?aid:id,version:upload?null:ref!.version,data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:aid,...c.payload}}:{status:'PROPOSED',ref,entry:e,...(c.operation==='correctKnowledge'?{baseRef:c.payload.baseRef,supersedesRef:c.payload.baseRef,reason:c.payload.reason,changeSources:c.payload.sourceRefs,eventId:aid}:{})},serverReceivedAt:'2026-10-25T00:00:00Z'});});}
function view(){const body='본문',entry={kind:'FACT',title:'관련성',reason:'고정 원문',scope:structuredClone(scope),relatedRefs:[],sourceRefs:[],contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'}};return{ref:{id,version:1,contentHash:contentHash(canonicalJson(entry))},entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:id},recordedAt:'2026-10-25T00:00:00Z'}]};}
test('선택 관련성을 준비명령에 고정하고 응답유실 재확인에서도 같은 저장내용을 보존한다',async()=>{
  const b:any=newKnowledge(pid,s,1);Object.assign(b,{title:'범위',body:'본문',reason:'고정',scope:structuredClone(scope)});b.pending=await prepareKnowledge(b,s);
  const writes:any[]=[],client=transport(writes,true);await assert.rejects(sendKnowledge(client,b,s,p=>b.pending=p,()=>true));await sendKnowledge(client,b,s,p=>b.pending=p,()=>true);
  assert.deepEqual(writes[1].payload.entry.scope,scope);assert.deepEqual(writes[1],writes[2]);
  b.scope.taskRefs=[];const count=writes.length;await assert.rejects(sendKnowledge(client,b,s,()=>{},()=>true));assert.equal(writes.length,count);
});
test('정확 지식 조회는 고정 관련성을 보존하고 재해시된 목적·헌법 국소화도 거절한다',async()=>{
  const v=view(),client=(value:unknown)=>new ApiClient(async()=>Response.json(value));assert.deepEqual((await readKnowledge(client(v),pid,v.ref)).entry.scope,scope);
  for(const kind of ['PURPOSE','CONSTITUTION']){const bad={...v,entry:{...v.entry,kind}};bad.ref={...v.ref,contentHash:contentHash(canonicalJson(bad.entry))};await assert.rejects(readKnowledge(client(bad),pid,bad.ref));}
});
test('정정은 관련성을 새 버전에 고정하고 기존 원문의 scope를 덮어쓰지 않는다',async()=>{
  const original=view(),b:any=newKnowledgeCorrection(pid,original as any,s,1);b.changeReason='업무 관련성 해제';b.scope={...structuredClone(scope),taskRefs:[]};b.pending=await prepareKnowledgeCorrection(b,s);const writes:any[]=[];
  await sendKnowledgeCorrection(transport(writes),b,s,p=>b.pending=p,()=>true);
  assert.deepEqual(writes[1].payload.entry.scope,b.scope);assert.deepEqual(original.entry.scope,scope);
});
test('scope 없는 과거 준비명령은 빈 공통 관련성을 유지하고 새 준비도 형식을 바꾸지 않는다',async()=>{
 const b:any=newKnowledge(pid,s,1);delete b.scope;Object.assign(b,{title:'과거 입력',body:'본문',reason:'이전 명령 보존'});b.pending=await prepareKnowledge(b,s);assert.equal(Object.hasOwn(b.pending.snapshot,'scope'),false);const writes:any[]=[];
 await sendKnowledge(transport(writes),b,s,p=>b.pending=p,()=>true);assert.deepEqual(writes[1].payload.entry.scope,{projectId:pid,stageRefs:[],taskRefs:[]});assert.equal(Object.hasOwn(b.pending.snapshot,'scope'),false);
});
test('업로드 await 중 바뀐 caller scope는 현재 전송에 섞이지 않고 다음 재확인에서 거절한다',async()=>{
 const b:any=newKnowledge(pid,s,1);Object.assign(b,{title:'고정 입력',body:'본문',reason:'기준 보존',scope:structuredClone(scope)});b.pending=await prepareKnowledge(b,s);const writes:any[]=[];
 const transportWithMutation=new ApiClient(async(input,init)=>{const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);if(upload)b.scope.taskRefs=[];return Response.json({operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?aid:id,version:upload?null:1,data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:aid,...c.payload}}:{status:'PROPOSED',ref:{id,version:1,contentHash:contentHash(canonicalJson(c.payload.entry))},entry:c.payload.entry},serverReceivedAt:'2026-10-25T00:00:00Z'});});
 await sendKnowledge(transportWithMutation,b,s,p=>b.pending=p,()=>true);assert.deepEqual(writes[1].payload.entry.scope,scope);const count=writes.length;await assert.rejects(sendKnowledge(transportWithMutation,b,s,()=>{},()=>true));assert.equal(writes.length,count);
});

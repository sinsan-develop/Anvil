import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import * as api from '../../../apps/web/src/features/knowledge/conversation-api.ts';
const pid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',aid='44444444-4444-4444-8444-444444444444';
const canonical=(v:any):string=>JSON.stringify(sort(v));
const sort=(v:any):any=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
function fixture(body='가'.repeat(22000)+'😀끝',mediaType='text/plain;charset=utf-8'){
 const bytes=Buffer.from(body),bodyRef={artifactId:aid,bytes:bytes.length,contentHash:hash(bytes),mediaType};
 const message={kind:'USER_INSTRUCTION',bodyRef,attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:pid,stageRefs:[],taskRefs:[]}};
 const snapshot={conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:1,authorRef:{kind:'HUMAN',userId:aid}};
 const view={conversationId:cid,sourceRef:{kind:'CONVERSATION',id,contentHash:hash(canonical(snapshot))},serverSequence:1,authorRef:snapshot.authorRef,message,body,deliveryState:'STORED',redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',recordedAt:'2026-11-15T00:00:00Z'};
 let start=0;const parts=[];while(start<bytes.length){let end=Math.min(start+65536,bytes.length);while(end<bytes.length&&(bytes[end]!&0xc0)===0x80)end--;const part=bytes.subarray(start,end);parts.push({partIndex:parts.length+1,byteOffset:start,utf8Bytes:part.length,contentHash:hash(part)});start=end;}
 const plan={schemaVersion:1,purpose:'INSTRUCTION_PARTS_PLAN',algorithm:'UTF8_CODEPOINT_64K_V1',bodyRef,limits:{maxSourceBytes:2097152,maxPartBytes:65536,maxParts:200},parts};
 const response={instructionRef:{id,version:1,contentHash:view.sourceRef.contentHash},partsRef:{id:aid,version:1,contentHash:hash(canonical(plan))},plan};return{view,response};
}
async function read(f:ReturnType<typeof fixture>,value:unknown=f.response,active=()=>true){
 const calls:any[]=[];const client=new ApiClient(async(path,init)=>{calls.push({path,init});return Response.json(value);});
 assert.equal(typeof (api as any).readInstructionParts,'function');
 const result=await (api as any).readInstructionParts(client,pid,cid,f.view,active);return{result,calls};
}
test('명시 same-origin GET은 원 지시와 plain/markdown 다부분·2MiB 계획을 WebCrypto로 검산한다',async()=>{
 for(const f of [fixture(),fixture('\ufeff원문\r\n😀'),fixture('a'.repeat(65535)+'😀끝','text/markdown;charset=utf-8'),fixture('x'.repeat(2097152))]){
  const {result,calls}=await read(f);assert.deepEqual(result,f.response);assert.equal(calls.length,1);assert.equal(calls[0].path,`/api/v1/projects/${pid}/conversations/${cid}/messages/${id}/instruction-parts`);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.body,undefined);
 }
});
test('재해시한 짧은 분할도 최대 UTF8 prefix 정본과 다르면 거절한다',async()=>{
 const f=fixture('ab');f.response.plan.parts=[{partIndex:1,byteOffset:0,utf8Bytes:1,contentHash:hash('a')},{partIndex:2,byteOffset:1,utf8Bytes:1,contentHash:hash('b')}];f.response.partsRef.contentHash=hash(canonical(f.response.plan));await assert.rejects(read(f),{code:'INSTRUCTION_PARTS_INVALID'});
});
test('원문·지시·추가필드·재해시된 경계/offset/부분 변조를 거절한다',async()=>{
 for(const mutate of [(r:any)=>r.instructionRef.id=aid,(r:any)=>r.plan.parts[0].byteOffset=1,(r:any)=>r.plan.parts[0].contentHash='a'.repeat(64),(r:any)=>r.plan.limits.maxPartBytes=65535,(r:any)=>r.plan.bodyRef.extra=true,(r:any)=>r.extra=true,(r:any)=>r.partsRef.id=id]){
  const f=fixture(),r=structuredClone(f.response);mutate(r);r.partsRef.contentHash=hash(canonical(r.plan));await assert.rejects(read(f,r),{code:'INSTRUCTION_PARTS_INVALID'});
 }
 for(const body of ['', '\ud800','x'.repeat(2097153)])await assert.rejects(read(fixture(body)),{code:'INSTRUCTION_PARTS_INVALID'});
 const f=fixture();f.view.body+='변조';await assert.rejects(read(f),{code:'INSTRUCTION_PARTS_INVALID'});
});
test('각 WebCrypto await 뒤 폐기하며 원문/선택 변조와 accessor를 성공으로 돌리지 않는다',async t=>{
 const real=crypto.subtle.digest.bind(crypto.subtle);
 for(const phase of [1,2,3,4,5]){
  const f=fixture();let active=true,n=0,calls=0,release!:()=>void,started!:()=>void;
  const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>started=r);
  const mock=t.mock.method(crypto.subtle,'digest',async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{const result=await real(algorithm,data);if(++n===phase){started();await gate;}return result;});
  try{
   const client=new ApiClient(async()=>{calls++;return Response.json(f.response);});
   const pending=(api as any).readInstructionParts(client,pid,cid,f.view,()=>active);await ready;active=false;release();await assert.rejects(pending,{code:'INSTRUCTION_PARTS_STALE'});assert.equal(n,phase);assert.equal(calls,phase<=2?0:1);
  }finally{mock.mock.restore();}
 }
 const f=fixture();let release!:()=>void,started!:()=>void;const ready=new Promise<void>(r=>started=r),gate=new Promise<void>(r=>release=r);
 const client=new ApiClient(async()=>({ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>{started();await gate;return f.response;}} as Response));
 const pending=(api as any).readInstructionParts(client,pid,cid,f.view,()=>true);await ready;f.view.message.bodyRef.artifactId=id;release();await assert.rejects(pending,{code:'INSTRUCTION_PARTS_INVALID'});
 let traps=0;const g=fixture();Object.defineProperty(g.view,'body',{enumerable:true,get(){traps++;return 'fake';}});await assert.rejects(read(g),{code:'INSTRUCTION_PARTS_INVALID'});assert.equal(traps,0);
});
test('현재401 및 서버의 정정/격리 거절은 성공 계획으로 대체하지 않는다',async()=>{
 for(const [status,code] of [[401,'AUTH_REQUIRED'],[412,'INSTRUCTION_SOURCE_EXCLUDED'],[404,'NOT_FOUND']] as const){
  const f=fixture(),client=new ApiClient(async()=>Response.json({code},{status}));await assert.rejects((api as any).readInstructionParts(client,pid,cid,f.view,()=>true),{code,status});
 }
});
test('오래된 요청은 전송0, 늦은 JSON과 늦은401을 폐기한다',async()=>{
 const f=fixture();let active=false,calls=0;
 const client=new ApiClient(async()=>{calls++;return Response.json(f.response);});
 await assert.rejects((api as any).readInstructionParts(client,pid,cid,f.view,()=>active),{code:'INSTRUCTION_PARTS_STALE'});assert.equal(calls,0);
 for(const status of [200,401]){
  active=true;let release!:()=>void;const gate=new Promise<void>(r=>release=r);let started!:()=>void;const ready=new Promise<void>(r=>started=r);
  const slow=new ApiClient(async()=>({ok:status===200,status,headers:new Headers({'content-type':'application/json'}),json:async()=>{started();await gate;return status===200?f.response:{code:'AUTH_REQUIRED'};}} as Response));
  const pending=(api as any).readInstructionParts(slow,pid,cid,f.view,()=>active);await ready;active=false;release();await assert.rejects(pending,{code:'INSTRUCTION_PARTS_STALE'});
 }
});

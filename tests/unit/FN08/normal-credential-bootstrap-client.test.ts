import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {NormalCredentialBootstrapClient} from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';
import {NormalProtectedPostClient} from '../../../apps/connector/runtime/normal-protected-post-client.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const at=Date.parse('2030-01-01T00:00:00.000Z'),expiresAt=new Date(at+60000).toISOString();
const binding={projectId:id(1),executionId:id(3),executionGeneration:1,registration:{connectorId:id(2)},executionCredentialReservation:{generation:1}};
const grant={kind:'EXECUTION',state:'GRANTED',transport:'NORMAL_PROTECTED',binding,allowedOperations:['START_SESSION'],expiresAt,
 factHash:hash(canonicalJson(binding)),scopeDigest:hash(canonicalJson({binding,allowedOperations:['START_SESSION'],expiresAt}))};
const ref={id:id(4),version:1,contentHash:hash(canonicalJson(grant))};
const scope={projectId:id(1),connectorId:id(2),executionId:id(3),executionGeneration:1,grantRef:ref,credentialGeneration:1};
function fixture(size=2800000){const calls:any[]=[],response=Buffer.from(canonicalJson({body:'x'.repeat(size)}));let offset=0;let mode='OK';
 const host={async send(op:string,p:any){calls.push([op,p]);if(mode==='HANG')return new Promise(()=>{});
  if(op==='NORMAL_EXECUTION_BOOTSTRAP')return {slotId:id(7),receiptRef:ref,scope,origin:'https://example.invalid',expiresAt,caHash:hash('RAM CA')};
  if(op==='NORMAL_EXECUTION_CALL'){offset=0;return chunk();}
  if(op==='NORMAL_EXECUTION_READ'){assert.equal(p.offset,offset);return chunk();}throw Error(op);}};
 function chunk(){const start=offset;offset=Math.min(response.length,offset+48000);return {handle:id(9),offset:start,total:response.length,hash:hash(response),expiresAt,bytes:response.subarray(start,offset).toString('base64url'),done:offset===response.length};}
 const factory={async open(){return {send:(op:string,p:any)=>host.send(op,p),async close(){return {state:mode==='CLOSE_UNKNOWN'?'UNKNOWN':'CLOSED_CONFIRMED'};}};}};
 const client=new NormalCredentialBootstrapClient({attemptId:id(8),origin:'https://example.invalid',ca:'RAM CA',scope},{host:factory,now:()=>at});
 return {client,calls,host,response,mode:(v:string)=>{mode=v;}};}
test('최초 보호 저장 metadata만 반환하고 encoded 한도 자료를 64-frame 안에서 검산한다',async()=>{
 const f=fixture(),p=await f.client.bootstrap(new AbortController().signal);
 assert.deepEqual(p.metadata.scope,scope);assert.equal('credential' in p.metadata,false);
 const body:any=await p.request({method:'GET',path:'/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/commands',query:'?waitMs=0',body:null,auth:'public-proof',expiresAt},new AbortController().signal);
 assert.equal(body.body.length,2800000);assert.ok(f.calls.length<=64);
 for(const c of f.calls)assert.ok(Buffer.byteLength(canonicalJson(c))<65536);
 await assert.rejects(()=>f.client.bootstrap(new AbortController().signal),/ALREADY_STARTED/);
});
test('prepare 응답 형상 오류와 close 불명은 후속 host 전송을 차단한다',async()=>{
 const r={method:'GET' as const,path:'/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/commands',query:'?waitMs=0',body:null,expiresAt};
 const f=fixture(),p=await f.client.bootstrap(new AbortController().signal);
 await assert.rejects(()=>p.prepare(r,new AbortController().signal),/UNKNOWN/);
 const count=f.calls.length;await assert.rejects(()=>p.prepare(r,new AbortController().signal),/UNKNOWN/);assert.equal(f.calls.length,count);
 const g=fixture(),q=await g.client.bootstrap(new AbortController().signal);g.mode('CLOSE_UNKNOWN');
 await assert.rejects(()=>q.request({...r,auth:'a'},new AbortController().signal),/UNKNOWN/);
 const n=g.calls.length;await assert.rejects(()=>q.request({...r,auth:'a'},new AbortController().signal),/UNKNOWN/);assert.equal(g.calls.length,n);
});
test('다른 scope metadata와 잘못된 chunk/hash는 거절하고 불명 뒤 자동 전송하지 않는다',async()=>{
 const f=fixture();const original=f.host.send;f.host.send=async(op,p)=>{const r:any=await original(op,p);return op==='NORMAL_EXECUTION_BOOTSTRAP'?{...r,scope:{...scope,credentialGeneration:2}}:r;};
 await assert.rejects(()=>f.client.bootstrap(new AbortController().signal),/UNKNOWN/);
 const g=fixture(),p=await g.client.bootstrap(new AbortController().signal),send=g.host.send;
 g.host.send=async(op,arg)=>({...await send(op,arg) as any,offset:1});
 await assert.rejects(()=>p.request({method:'GET',path:'/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/commands',query:'',body:null,auth:'a',expiresAt},new AbortController().signal));
 const count=g.calls.length;await assert.rejects(()=>p.request({method:'GET',path:'/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/commands',query:'',body:null,auth:'a',expiresAt},new AbortController().signal));assert.equal(g.calls.length,count);
});
test('abort 무시 host도 취소 후 불명 종료하고 늦은 결과로 다시 활성화하지 않는다',async()=>{
 const f=fixture();f.mode('HANG');const abort=new AbortController(),promise=f.client.bootstrap(abort.signal);await new Promise(r=>setImmediate(r));abort.abort();
 await assert.rejects(()=>promise,/UNKNOWN/);assert.equal(f.calls.length,1);
 await assert.rejects(()=>f.client.bootstrap(new AbortController().signal));assert.equal(f.calls.length,1);
});

const validRequest={method:'GET' as const,path:'/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/commands',query:'?waitMs=0',body:null,auth:'a',expiresAt};
test('encoded exact 상한은 수용하고 +1·다른 handle/hash·누락/중복 조각은 닫는다',async()=>{
 const exact=fixture(2812587-Buffer.byteLength(canonicalJson({body:''}))),port=await exact.client.bootstrap(new AbortController().signal);
 assert.equal(exact.response.length,2812587);await port.request(validRequest,new AbortController().signal);assert.ok(exact.calls.length<=60);
 for(const mode of ['OVER','HANDLE','HASH','DUPLICATE','GAP']){
  const f=fixture(mode==='OVER'?2812588-11:50000),p=await f.client.bootstrap(new AbortController().signal),send=f.host.send;
  f.host.send=async(op,arg)=>{const v:any=await send(op,arg);
   if(mode==='HASH')return {...v,hash:'f'.repeat(64)};
   if(op==='NORMAL_EXECUTION_READ')return {...v,...(mode==='HANDLE'?{handle:id(66)}:mode==='DUPLICATE'?{offset:0}:{offset:v.offset+1})};return v;};
  await assert.rejects(()=>p.request(validRequest,new AbortController().signal),/UNKNOWN/);
  const n=f.calls.length;await assert.rejects(()=>p.request(validRequest,new AbortController().signal),/UNKNOWN/);assert.equal(f.calls.length,n);
 }
});
test('늦은 open 결과는 정확 한번 닫고 close 불명 후 새 operation을 만들지 않는다',async()=>{
 let release!:(s:any)=>void,closes=0,opens=0;
 const client=new NormalCredentialBootstrapClient({attemptId:id(8),origin:'https://example.invalid',ca:'RAM CA',scope},
  {host:{open(){opens++;return new Promise(r=>{release=r;});}},now:()=>at});
 const abort=new AbortController(),run=client.bootstrap(abort.signal);abort.abort();await assert.rejects(()=>run,/CANCELLED/);
 release({async send(){throw Error('전송 금지');},async close(){closes++;return {state:'UNKNOWN'};}});await new Promise(r=>setImmediate(r));
 await assert.rejects(()=>client.bootstrap(new AbortController().signal));assert.equal(closes,1);assert.equal(opens,1);
});
test('caller의 추가 권위 객체와 보호 저장 불명은 token/성공 metadata 반환 없이 닫는다',async()=>{
 let calls=0;assert.throws(()=>new NormalCredentialBootstrapClient({attemptId:id(8),origin:'https://example.invalid',ca:'RAM CA',scope,grantSnapshot:{forged:true}} as any,
  {host:{async open(){calls++;throw Error();}}}),/INVALID/);assert.equal(calls,0);
 for(const mode of ['THROW','UNKNOWN','CLOSE_UNKNOWN']){
  const f=fixture();if(mode==='CLOSE_UNKNOWN')f.mode(mode);else f.host.send=async()=>{calls++;if(mode==='THROW')throw Error('RAM sync 실패');return {state:'UNKNOWN'};};
  await assert.rejects(()=>f.client.bootstrap(new AbortController().signal),/UNKNOWN/);const n:number=calls;
  await assert.rejects(()=>f.client.bootstrap(new AbortController().signal));assert.equal(calls,n);
 }
});

test('보호 POST 분기는 원본문·packet identity를 보존하고 다른 permit·close 불명은 거절한다',async()=>{
 for(const mode of ['OK','BAD_PERMIT','CLOSE_UNKNOWN']){
  const f=fixture(),port=await f.client.bootstrap(new AbortController().signal),saved:string[]=[];
  const post=new NormalProtectedPostClient({origin:'https://example.invalid',ca:'RAM CA',scope,credentialExpiresAt:expiresAt},{protectedCredential:port,now:()=>at});
  const raw={envelopeHash:'a'.repeat(64),localAttemptRef:ref,sourceObservationRefs:[ref],osOwnershipRef:ref};
  const expected=canonicalJson(raw);
  f.host.send=async(op,p)=>{
   f.calls.push([op,p]);assert.equal(op,'NORMAL_EXECUTION_CALL');assert.equal(p.request.method,'POST');assert.equal(p.body,expected);saved.push(p.body);
   const result=p.kind==='PREPARE'?{path:p.request.path,query:'',auth:'public_proof',challengeRef:ref,requestId:id(77),expiresAt}:
    {transport:'NORMAL_PROTECTED',proofResultRef:ref,permit:{ref,commandId:mode==='BAD_PERMIT'?id(91):id(90),envelopeHash:'a'.repeat(64),issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString()},cacheControl:'no-store',nonceConsumed:true,executionAuthorized:true,dispatchPerformed:false};
   const bytes=Buffer.from(canonicalJson(result));return {handle:id(9),offset:0,total:bytes.length,hash:hash(bytes),expiresAt,bytes:bytes.toString('base64url'),done:true};
  };
  const packet=await post.preparePermit(id(90),raw,new AbortController().signal);raw.envelopeHash='f'.repeat(64);
  assert.equal(Object.isFrozen(packet),true);await assert.rejects(()=>post.send({...packet},new AbortController().signal),/PACKET_INVALID/);
  if(mode==='CLOSE_UNKNOWN')f.mode(mode);
  if(mode==='OK')assert.equal((await post.send(packet,new AbortController().signal) as any).permit.commandId,id(90));
  else await assert.rejects(()=>post.send(packet,new AbortController().signal),mode==='BAD_PERMIT'?/RESPONSE_INVALID/:/OUTCOME_UNKNOWN/);
  assert.equal(saved.length,2);assert.ok(saved.every(v=>v===expected));
  if(mode==='CLOSE_UNKNOWN'){const count=f.calls.length;await assert.rejects(()=>post.send(packet,new AbortController().signal));assert.equal(f.calls.length,count);}
 }
});

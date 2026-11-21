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
test('host 요청 종료 disposition은 finally abort와 원 요청 실패를 구별한다',async()=>{
 for(const broken of [false,true]){
  const f=fixture(12),closes:string[]=[],signals:boolean[]=[];
  const owner=new NormalCredentialBootstrapClient({attemptId:id(8),origin:'https://example.invalid',ca:'RAM CA',scope},{
   now:()=>at,host:{async open(signal){return {send:async(op,p)=>{if(broken)throw Error('RAM 미완료');return f.host.send(op,p);},
    async close(disposition?:string){signals.push(signal.aborted);closes.push(String(disposition));return {state:'CLOSED_CONFIRMED'};}};}}});
  const run=owner.bootstrap(new AbortController().signal);
  if(broken)await assert.rejects(run,/UNKNOWN/);else assert.deepEqual((await run).metadata.scope,scope);
  assert.deepEqual(signals,[true]);assert.deepEqual(closes,[broken?'OPERATION_UNKNOWN':'HOST_REQUEST_VALIDATED']);
 }
});

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
test('명시 재교환은 만료된 같은 소유 port만 받아 새 receipt를 만들고 UNKNOWN 뒤 반복하지 않는다',async()=>{
 let now=at,calls=0,broken=false;
 const client=new NormalCredentialBootstrapClient({attemptId:id(8),origin:'https://example.invalid',ca:'RAM CA',scope},{
  now:()=>now,host:{async open(){return {async send(op:string,p:any){
   calls++;if(op==='NORMAL_EXECUTION_RENEW'){assert.equal(p.previous.slotId,id(7));assert.deepEqual(p.previous.receiptRef,ref);if(broken)throw Error('저장 불명');}
   return {slotId:op==='NORMAL_EXECUTION_RENEW'?id(10):id(7),receiptRef:op==='NORMAL_EXECUTION_RENEW'?{...ref,id:id(11)}:ref,
    scope,origin:'https://example.invalid',expiresAt:new Date(now+60000).toISOString(),caHash:hash('RAM CA')};
  },async close(){return {state:'CLOSED_CONFIRMED'};}};}}});
 const signal=new AbortController().signal,p=await client.bootstrap(signal);
 await assert.rejects(()=>client.renew(p,signal),/NOT_EXPIRED/);assert.equal(calls,1);
 now+=60000;const next=await client.renew(p,signal);assert.equal(calls,2);assert.notDeepEqual(next.metadata.receiptRef,p.metadata.receiptRef);
 await assert.rejects(()=>client.renew(p,signal),/PREDECESSOR/);assert.equal(calls,2);
 await assert.rejects(()=>p.request({...validRequest,expiresAt:new Date(now+60000).toISOString()},signal),/CANCELLED/);
 now+=60000;broken=true;await assert.rejects(()=>client.renew(next,signal),/UNKNOWN/);const n=calls;
 await assert.rejects(()=>client.renew(next,signal));assert.equal(calls,n);
});
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

test('FN09 소유 channel은 고정 read/result만 원 native 요청에 전달하고 잘못된 경로/query/body는 전송0',async()=>{
 const base='/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/understanding-response-read';
 for(const [method,path,body] of [['GET',base,null],['POST',base+'/'+id(6)+'/result',canonicalJson({requestId:id(6),parts:[]})]] as const){
  const f=fixture(12),p=await f.client.bootstrap(new AbortController().signal),r={method,path,body,query:'',auth:'public-proof',expiresAt};
  await p.request(r,new AbortController().signal);
  const sent=f.calls.find(c=>c[0]==='NORMAL_EXECUTION_CALL')[1];assert.equal(sent.request.path,path);assert.equal(sent.request.method,method);assert.equal(sent.body,body);assert.equal(sent.bodyHash,hash(body??''));
  const before=f.calls.length;
  for(const patch of [{query:'?waitMs=0'},{method:method==='GET'?'POST':'GET'},{path:path+'/'},{path:path.replace(id(2),id(11))},{path:path.replace('understanding','Understanding')},...(method==='POST'?[{path:base+'/00000000-0000-0000-0000-000000000000/result'},{path:base+'/%30'+id(6).slice(1)+'/result'},{body:null}]:[{body:'{}'}])]){
   await assert.rejects(()=>p.request({...r,...patch} as any,new AbortController().signal));assert.equal(f.calls.length,before);
  }
 }
});


test('FN09 원 owned GET ticket만 같은 client/slot/attempt에서 한 번 소비하고 오염·불명은 거절한다',async()=>{
 const {NormalProtectedGetClient,takeNormalUnderstandingRead}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');
 const {executionTarget}=await import('../../../apps/server/modules/executions/execution-proof.ts');
 for(const mode of ['OK','ATTEMPT','SCOPE','PACKET','WORK','EXTRA','CLOSE','UNAVAILABLE','DUPLICATE']){
  const f=fixture(1),signal=new AbortController().signal,port=await f.client.bootstrap(signal);
  const get=new NormalProtectedGetClient({origin:'https://example.invalid',ca:'RAM CA',scope,credentialExpiresAt:expiresAt},{protectedCredential:port,now:()=>at});
  const sourceScope={projectId:scope.projectId,executionId:scope.executionId,generation:1,plannedSidDigest:'a'.repeat(64),registrationRef:ref,profileRef:ref,assignmentRef:ref,slotRef:ref,grantRef:ref,startReadyRef:ref,dispatchAttemptRef:ref,sessionBindingRef:ref};
  const auth=Buffer.from(canonicalJson({fixture:'original proof packet'})).toString('base64url');
  let sent=0;
  f.host.send=async(op,p)=>{
   assert.equal(op,'NORMAL_EXECUTION_CALL');f.calls.push([op,p]);sent++;
   if(mode==='UNAVAILABLE')throw Error('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE');
   let value:unknown;
   const short=new Date(at+10000).toISOString();
   if(p.kind==='PREPARE')value={path:p.request.path,query:'',auth,challengeRef:ref,requestId:id(77),expiresAt:short};
   else{
    const request={schemaVersion:1,requestId:id(90),attemptId:mode==='ATTEMPT'?id(999):id(8),selection:{scope:mode==='SCOPE'?{...sourceScope,generation:2}:sourceScope,initConfirmationRef:ref,tailRef:ref,firstSequence:3,lastSequence:3},binding:{scope:sourceScope,mode:mode==='WORK'?'WORK':'CONTEXT_REVIEW',bundleRef:ref,subjectBindingRef:ref,basisRefs:[ref],requiredPartRefs:[ref],receivedPartRefs:[ref],checkedAt:new Date(at).toISOString(),expiresAt:short}};
    const requestRef={...ref,id:id(90),contentHash:hash(canonicalJson(request))};
    const receipt={kind:'NORMAL_UNDERSTANDING_READ_ACQUIRED',target:executionTarget('GET',p.request.path,[],null),packetHash:mode==='PACKET'?'f'.repeat(64):hash(Buffer.from(auth,'base64url')),challengeRef:ref,slotRef:ref,requestRef,observedAt:new Date(at).toISOString(),expiresAt:short};
    value={transport:'NORMAL_PROTECTED',proofResultRef:{...ref,contentHash:hash(canonicalJson(receipt))},receipt,requestRef,request,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false,...(mode==='EXTRA'?{raw:'forbidden'}:{})};
    if(mode==='CLOSE')f.mode('CLOSE_UNKNOWN');
   }
   const bytes=Buffer.from(canonicalJson(value));return{handle:id(9),offset:0,total:bytes.length,hash:hash(bytes),expiresAt:short,bytes:bytes.toString('base64url'),done:true};
  };
  if(['SCOPE','PACKET','WORK','EXTRA','CLOSE','UNAVAILABLE'].includes(mode))await assert.rejects(get.receiveUnderstandingRead(signal));
  else{
   const ticket=await get.receiveUnderstandingRead(signal);assert.deepEqual(Object.keys(ticket),[]);assert.equal(Object.isFrozen(ticket),true);
   assert.throws(()=>takeNormalUnderstandingRead({} as any,get,port,id(8),sourceScope));
   if(mode==='ATTEMPT')assert.throws(()=>takeNormalUnderstandingRead(ticket,get,port,id(8),sourceScope));
   else{await assert.rejects(get.receiveUnderstandingRead(signal));const held=takeNormalUnderstandingRead(ticket,get,port,id(8),sourceScope);assert.deepEqual(held.selection.request.scope,sourceScope);await assert.rejects(get.receiveUnderstandingRead(signal));held.finish();assert.throws(held.check);assert.throws(()=>takeNormalUnderstandingRead(ticket,get,port,id(8),sourceScope));}
   if(mode==='DUPLICATE')await assert.rejects(get.receiveUnderstandingRead(signal));
  }
  assert.equal(sent,mode==='UNAVAILABLE'?1:mode==='DUPLICATE'?4:2);
 }
});


test('FN09 두 exact 목적은 원 UTF8 2MiB/+1·공백 확대를 parse 전 검산하고 불명 재시도0',async()=>{
 for(const result of [false,true])for(const extra of [0,1]){
  const f=fixture(2*1024*1024-11+extra),signal=new AbortController().signal,p=await f.client.bootstrap(signal);
  assert.equal(f.response.length,2*1024*1024+extra);
  const path='/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/understanding-response-read'+(result?'/'+id(6)+'/result':'');
  const request={method:result?'POST' as const:'GET' as const,path,query:'',body:result?'{}':null,auth:'public-proof',expiresAt};
  if(!extra)assert.equal((await p.request(request,signal) as any).body.length,2*1024*1024-11);
  else{await assert.rejects(p.request(request,signal),/UNKNOWN/);const count=f.calls.length;await assert.rejects(p.request(request,signal),/UNKNOWN/);assert.equal(f.calls.length,count);}
 }
 const f=fixture(1),signal=new AbortController().signal,p=await f.client.bootstrap(signal);let calls=0;
 f.host.send=async()=>{calls++;return {handle:id(9),offset:0,total:2*1024*1024+1,hash:hash(' '.repeat(2*1024*1024-1)+'{}'),expiresAt,bytes:Buffer.from(' '.repeat(48000)).toString('base64url'),done:false};};
 await assert.rejects(p.request({method:'GET',path:'/api/v1/connectors/'+id(2)+'/executions/'+id(3)+'/understanding-response-read',query:'',body:null,auth:'public-proof',expiresAt},signal),/UNKNOWN/);assert.equal(calls,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {preparedExecution} from './normal-start-execution-fixture.ts';
import {NormalProtectedPostClient} from '../../../apps/connector/runtime/normal-protected-post-client.ts';
import {NormalProtectedGetClient} from '../../../apps/connector/runtime/normal-protected-get-client.ts';
import {prepareNormalUnderstandingResult} from '../../../apps/connector/runtime/normal-owned-spool-profile.ts';
import * as ownedBootstrap from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';
import {frameUnderstandingResult,NormalCredentialBootstrapClient,type NormalPreparedUnderstandingResult} from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';

test('canonical 큰 본문의 frame만 구성할 수 있고 정상 등록 port로 raw 목적 호출은 할 수 없다',async()=>{
 const ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
 const scope={projectId:randomUUID(),connectorId:randomUUID(),executionId:randomUUID(),executionGeneration:1,grantRef:ref(),credentialGeneration:1};
 const attemptId=randomUUID(),slotId=randomUUID(),origin='https://synthetic.invalid',ca='SYNTHETIC_CA',now=Date.now();
 const expiresAt=new Date(now+5000).toISOString(),signal=new AbortController().signal;
 const metadata={slotId,receiptRef:ref(),origin,scope,expiresAt,caHash:contentHash(ca)};
 const requestRef=ref(),acquisitionRef=ref(),path='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/understanding-response-read/'+requestRef.id+'/result';
 const body=canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:{attribution:'SESSION_ONLY',projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,
  requestRef,acquisitionRef,contextBundleRef:ref(),initConfirmationRef:ref(),tailRef:ref(),wholeConversationComplete:false,executionAuthorized:false,
  ranges:Array.from({length:200},(_,i)=>({sequence:i+1,textBytes:200,outputRef:ref(),payloadDigest:contentHash('합성'+i),padding:'합성'.repeat(30)}))}});
 const bodyHash=contentHash(body),proof={requestId:randomUUID(),method:'POST',path,queryHash:contentHash('{}'),bodyHash,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:Buffer.alloc(32,3).toString('base64url')};
 const auth=Buffer.from(canonicalJson({schemaVersion:1,challengeRef:ref(),proof,signature:Buffer.alloc(64,5).toString('base64url')})).toString('base64url');
 const prepared:NormalPreparedUnderstandingResult={state:'NATIVE_DISCOVERY_RESULT_PREPARED',requestRef,acquisitionRef,preparedHash:contentHash('synthetic row'),expiresAt,auth};
 const calls:string[]=[];
 const host={async open(){
  return {async close(){return {state:'CLOSED_CONFIRMED'};},async send(op:string){
   calls.push(op);assert.equal(op,'NORMAL_EXECUTION_BOOTSTRAP');return metadata;
  }};
 }};
 const owned=await new NormalCredentialBootstrapClient({attemptId,origin,ca,scope},{host,now:()=>now}).bootstrap(signal);
 const options={origin,ca,scope,credentialExpiresAt:expiresAt},ports={protectedCredential:owned,now:()=>now};
 const post=new NormalProtectedPostClient(options,ports),get=new NormalProtectedGetClient(options,ports);
 const binding={requestRef,acquisitionRef,bodyHash};
 const chunked=frameUnderstandingResult(attemptId,metadata,prepared,binding,Buffer.from(body));
 assert.deepEqual(chunked,{kind:'CHUNKED',begin:{attemptId,slotId,kind:'UNDERSTANDING_RESULT_SEND',requestRef,acquisitionRef,preparedHash:prepared.preparedHash,auth,bodyLength:Buffer.byteLength(body),bodyHash},chunkSize:48000});
 const directBody=canonicalJson({...JSON.parse(body),metadata:{...JSON.parse(body).metadata,ranges:[]}});
 assert.equal(frameUnderstandingResult(attemptId,metadata,prepared,{...binding,bodyHash:contentHash(directBody)},Buffer.from(directBody)).kind,'DIRECT');
 for(const candidate of [directBody,body]){
  await assert.rejects(owned.prepare({method:'POST',path,query:'',body:candidate,expiresAt},signal),/NORMAL_OWNED_RESULT_UNAVAILABLE/);
  await assert.rejects(owned.request({method:'POST',path,query:'',body:candidate,auth,expiresAt},signal),/NORMAL_OWNED_RESULT_UNAVAILABLE/);
 }
 assert.equal('holdUnderstandingResultTransmission' in ownedBootstrap,false);
 assert.equal('sendUnderstandingResult' in owned,false);
 assert.equal('sendUnderstandingResult' in post,false);
 await assert.rejects(prepareNormalUnderstandingResult(prepared as any,get,post,owned,signal),/NORMAL_POST_RESULT_SEAL_INVALID/);
 await assert.rejects(post.send(prepared as any,signal),/NORMAL_POST_PACKET_INVALID/);
 assert.deepEqual(calls,['NORMAL_EXECUTION_BOOTSTRAP']);
});
function body(f:Awaited<ReturnType<typeof preparedExecution>>){return{envelopeHash:f.e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},
 sourceObservationRefs:[...new Map(f.e.context.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:f.binding.checks.osFence.evidenceRefs[0]};}
test('POST는 서명 중 caller 본문 변경에도 최초 body/hash를 보존하고 축약 permit 원 ref를 받는다',async()=>{
 const f=await preparedExecution();try{
  const raw=body(f),before=structuredClone(raw),ports={...f.http.ports,signer:{async sign(p:any,bytes:Buffer,signal:AbortSignal){
   raw.envelopeHash='f'.repeat(64);return f.http.ports.signer.sign(p,bytes);
  }}};
  const post=new NormalProtectedPostClient(f.http.options,ports),packet=await post.preparePermit(f.e.commandId,raw,f.signal);
  await assert.rejects(post.send({...packet},f.signal),/PACKET_INVALID/);
  const first=await post.send(packet,f.signal) as any;assert.equal(first.permit.envelopeHash,before.envelopeHash);assert.equal(f.q.permits.length,1);
  assert.deepEqual(f.q.permits[0].snapshot_json.request,before);
  assert.deepEqual(await post.send(packet,f.signal),first);assert.equal(f.q.permits.length,1);
 }finally{await f.h.app.close();}
});
test('200 permit의 다른 command/hash 및 잘못된 ACK hash를 성공으로 받지 않는다',async()=>{
 for(const kind of ['permit','ack']){
  const f=await preparedExecution();try{
   f.http.mode.alter=(path,v)=>{if(path.endsWith('/permit'))v.permit.commandId=randomUUID();if(path.endsWith('/observations'))v.ack.ref.contentHash='f'.repeat(64);return v;};
   if(kind==='permit'){
    const packet=await f.post.preparePermit(f.e.commandId,body(f),f.signal);await assert.rejects(f.post.send(packet,f.signal),(e:any)=>e.code==='NORMAL_POST_RESPONSE_INVALID'&&e.outcomeUnknown);
   }else{
    const run=f.make();f.http.mode.alter=(_p,v)=>v;await run.coordinator.start(f.e,f.signal);
    f.http.mode.alter=(path,v)=>{if(path.endsWith('/observations'))v.ack.ref.contentHash='f'.repeat(64);return v;};
    await assert.rejects(run.spool.sync(f.post,f.signal),/RESPONSE_INVALID/);assert.equal(await run.spool.latestAck(),null);
   }
  }finally{await f.h.app.close();}
 }
});
test('무응답 signer는 유한 종료하며 late 결과와 abort listener/timer를 회수한다',async()=>{
 const f=await preparedExecution();try{
  let finish:(v:string)=>void=()=>{},scheduled=0,cleared=0,requests=0;
  const ports={...f.http.ports,request:(...a:any[])=>{requests++;return (f.http.ports.request as any)(...a);},
   signer:{sign:()=>new Promise<string>(ok=>finish=ok)},
   setTimeout:((fn:any,ms:number)=>{scheduled=ms;return setTimeout(fn,5);}) as typeof setTimeout,
   clearTimeout:((id:any)=>{cleared++;clearTimeout(id);}) as typeof clearTimeout};
  const post=new NormalProtectedPostClient(f.http.options,ports),controller=new AbortController();
  await assert.rejects(post.preparePermit(f.e.commandId,body(f),controller.signal),/SIGNER_UNAVAILABLE/);
  assert(scheduled<=20000&&scheduled>0);assert.equal(cleared,1);assert.equal(requests,0);assert.equal(getEventListeners(controller.signal,'abort').length,0);
  finish(Buffer.alloc(64).toString('base64url'));await new Promise(ok=>setImmediate(ok));assert.equal(requests,0);
  const second=new AbortController(),pending=post.preparePermit(f.e.commandId,body(f),second.signal);second.abort();
  await assert.rejects(pending,/SIGNER_UNAVAILABLE/);assert.equal(getEventListeners(second.signal,'abort').length,0);assert.equal(requests,0);
 }finally{await f.h.app.close();}
});
test('원문 비저장·비정규 scope/중복 source ref/배열 입력을 네트워크 전 거절한다',async()=>{
 const f=await preparedExecution();try{
  const raw=body(f),calls=f.http.calls.length;
  await assert.rejects(f.post.preparePermit(f.e.commandId,{...raw,sourceObservationRefs:[raw.sourceObservationRefs[0],raw.sourceObservationRefs[0]]},f.signal),/INPUT_INVALID/);
  await assert.rejects(f.post.preparePermit(f.e.commandId,[],f.signal),/INPUT_INVALID/);
  await assert.rejects(f.post.prepareObservations({events:[],batchHash:'a'.repeat(64)},f.signal),/INPUT_INVALID/);
  assert.equal(f.http.calls.length,calls);
  assert.throws(()=>new NormalProtectedPostClient({...f.http.options,origin:'http://anvil-synthetic.invalid'},f.http.ports),/CONFIG_INVALID/);
  assert(!JSON.stringify(f.h.store.sqlArgs).includes(f.h.token));
 }finally{await f.h.app.close();}
});


test('C 선택 connector는 기존 서명 HTTP와 원 전체 snapshot 검산을 통해 응답을 받는다',async()=>{
 const {normalInstructionRuntimeFixture}=await import('./normal-instruction-dispatch-fixture.ts');
 const x=await normalInstructionRuntimeFixture();try{
  const c=x.h.f.tables.execution_commands!.find((r:any)=>r.snapshot_json?.envelope.operation==='SEND_INSTRUCTION')!,e=c.snapshot_json.envelope,f=x.h.q.g.snapshot_json.binding;
  const request={envelopeHash:e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},sourceObservationRefs:[...new Map(f.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:f.checks.osFence.evidenceRefs[0],representation:'SEND_PERMIT_SOURCE_V1'};
  const packet=await x.post.preparePermit(e.commandId,request,x.signal),reply:any=await x.post.send(packet,x.signal);
  assert.deepEqual(reply.executionAuthority.permitSnapshot.request,request);assert.equal(x.h.permits.length,1);
  assert.deepEqual(await x.post.send(packet,x.signal),reply);assert.equal(x.h.permits.length,1);
 }finally{await x.h.close();}
});


test('구형 START의 양의 localAttemptRef v2 호환과 C 선택 START 거절을 유지한다',async()=>{
 for(const selected of [false,true]){
  const f=await preparedExecution();try{
   const raw={...body(f),localAttemptRef:{...body(f).localAttemptRef,version:2},...(selected?{representation:'SEND_PERMIT_SOURCE_V1'}:{})};
   const packet=await f.post.preparePermit(f.e.commandId,raw,f.signal);
   if(selected){await assert.rejects(f.post.send(packet,f.signal),(e:any)=>e.code==='NORMAL_POST_REJECTED'&&e.status===400);assert.equal(f.q.permits.length,0);}
   else{const reply:any=await f.post.send(packet,f.signal);assert.equal(reply.permit.commandId,f.e.commandId);assert.equal(Object.hasOwn(reply,'executionAuthority'),false);assert.equal(f.q.permits[0].snapshot_json.request.localAttemptRef.version,2);}
  }finally{await f.h.app.close();}
 }
});

test('C 응답 유실의 원 packet 보존과 원본 불일치·downgrade 거절은 추가 permit을 발급하지 않는다',async()=>{
 const {normalInstructionRuntimeFixture}=await import('./normal-instruction-dispatch-fixture.ts');
 const x=await normalInstructionRuntimeFixture();try{
  const c=x.h.f.tables.execution_commands!.find((r:any)=>r.snapshot_json?.envelope.operation==='SEND_INSTRUCTION')!,e=c.snapshot_json.envelope,f=x.h.q.g.snapshot_json.binding;
  const request={envelopeHash:e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},sourceObservationRefs:[...new Map(f.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:f.checks.osFence.evidenceRefs[0],representation:'SEND_PERMIT_SOURCE_V1'};
  const packet=await x.post.preparePermit(e.commandId,request,x.signal);x.mode.losePermit=true;
  await assert.rejects(x.post.send(packet,x.signal),(err:any)=>err.outcomeUnknown===true);assert.equal(x.h.permits.length,1);
  x.mode.losePermit=false;const good:any=await x.post.send(packet,x.signal);
  for(const mutate of [
   (v:any)=>delete v.executionAuthority,
   (v:any)=>v.executionAuthority.kind='NORMAL_FIRST_SEND_PERMIT_SOURCE_V1',
   (v:any)=>v.executionAuthority.extra=true,
   (v:any)=>v.executionAuthority.permitSnapshot.currentFact.agentSession.bindingGeneration++,
   (v:any)=>v.executionAuthority.permitSnapshot.request.representation='other',
   (v:any)=>v.permit.ref.contentHash='d'.repeat(64),
   (v:any)=>v.proofResultRef.id=randomUUID()
  ]){x.mode.mutatePermit=mutate;await assert.rejects(x.post.send(packet,x.signal),(err:any)=>err.code==='NORMAL_POST_RESPONSE_INVALID'&&err.outcomeUnknown===true);assert.equal(x.h.permits.length,1);}
  x.mode.mutatePermit=null;assert.deepEqual(await x.post.send(packet,x.signal),good);
  x.mode.wall=31000;await assert.rejects(x.post.send(packet,x.signal));assert.equal(x.h.permits.length,1);
 }finally{await x.h.close();}
});

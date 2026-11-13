import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {randomUUID} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {preparedExecution} from './normal-start-execution-fixture.ts';
import {NormalProtectedPostClient} from '../../../apps/connector/runtime/normal-protected-post-client.ts';
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

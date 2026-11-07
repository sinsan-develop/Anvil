import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticMaterialReceiver} from '../../../apps/connector/runtime/execution-material-receiver.ts';
import {instructionProtectionFixture} from './instruction-protection-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(){
 const f=instructionProtectionFixture(),e=readDispatchEnvelopeV1(f.envelope,Date.parse(f.envelope.issuedAt)),ref=e.executorRegistrationRef,bytes=Buffer.from(f.source.bytes),snapshot={projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration,commandId:e.commandId,envelopeHash:e.envelopeHash,payloadRef:ref,sourceRef:ref,partIndex:1,partCount:1,byteOffset:0,sourceBytes:bytes.length,utf8Bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'},material={ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
 const events:any[]=[],blobs=new Map<string,Uint8Array>();let writes=0,mode='',reads=0,locals=0,now=Date.parse(e.issuedAt);
 const inbox:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,body:any)=>body({read:async()=>({complete:true,events:structuredClone(events)}),readPart:async(r:any)=>new Uint8Array(blobs.get(r.id)!),appendAndSync:async(r:any,b:Uint8Array)=>{writes++;events.push(structuredClone(r));blobs.set(r.ref.id,new Uint8Array(b));}})};
 const receiver=new SyntheticMaterialReceiver(inbox,{context:e.context,executorRegistrationRef:ref},[material],{maxBytes:65536,maxParts:1,clock:()=>now});
 await receiver.record(e,{transport:'SYNTHETIC_ONLY',materialId:material.ref.id,materialRef:material.ref,sourceRef:ref,partIndex:1,partCount:1,byteOffset:0,sourceBytes:bytes.length,contentHash:snapshot.contentHash,mediaType:'text/plain',bytes,cacheControl:'no-store',completeContextVerified:false,executionAuthorized:false,dispatchPerformed:false});
 const first=await receiver.instruction(e);f.current.materialReceiptRef=first.materialReceiptRef;first.bytes.fill(0);
 const input:any={envelope:e,preSendSnapshot:structuredClone(f.current),preSendBindingHash:'a'.repeat(64),attemptRef:ref,permitRef:ref,responseRef:ref,parentThreadClaimRef:ref,fact:{}};
 const buffers:Uint8Array[]=[],source:any={transport:'SYNTHETIC_ONLY',read:async(v:any)=>{reads++;const value:any=await receiver.instructionSource().read(v);buffers.push(value.bytes);if(mode==='SOURCE_DELAY'){enter();await gate;}if(mode==='BYTES')value.bytes[0]^=1;if(mode==='RECEIPT')value.materialReceiptRef={...value.materialReceiptRef,version:2};return value;}};
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);
 const local:any={transport:'SYNTHETIC_ONLY',readCurrent:async()=>{locals++;enter();if(mode==='DELAY')await gate;const value=structuredClone(f.current);value.turnState='IN_PROGRESS';if(mode==='LOCAL_RECEIPT')value.materialReceiptRef={...value.materialReceiptRef,version:2};if(mode==='BLOB')blobs.set(events[0].ref.id,Buffer.from('변조'));if(mode==='EXPIRE')now+=30000;return value;}};
 const m=await import('../../../apps/connector/runtime/sent-turn-material-current.ts'),current=new m.SyntheticSentTurnMaterialCurrent(source,local,{clock:()=>now,timeoutMs:1000});
 return{f,input,current,buffers,bytes,events,blobs,mode:(v:string)=>mode=v,reads:()=>reads,locals:()=>locals,writes:()=>writes,entered,release:()=>release()};
}
test('응답 private current가 실제 receiver의 receipt/bytes/hash를 전후 대조하고 반환 바이트만 소거한다',async()=>{
 const x=await fixture(),before=canonicalJson(x.events),v:any=await x.current.readCurrent(x.input,new AbortController().signal);
 assert.equal(v.turnState,'IN_PROGRESS');assert.deepEqual(v.materialReceiptRef,x.events[0].ref);assert.equal(v.instructionContentHash,contentHash(x.bytes));
 assert.equal(x.reads(),2);assert.equal(x.locals(),1);assert.equal(x.writes(),1);assert.equal(canonicalJson(x.events),before);assert.deepEqual(Buffer.from(x.blobs.get(x.events[0].ref.id)!),x.bytes);
 assert.equal(x.buffers.length,2);assert(x.buffers.every(b=>b.every(v=>v===0)));assert.equal('bytes' in v,false);
});

test('자료/private 조회의 취소·timeout 뒤 늦은 바이트는 소거하고 후속 조회하지 않는다',async()=>{
 for(const mode of ['SOURCE_DELAY','DELAY'])for(const cancel of [true,false]){
  const x=await fixture();x.mode(mode);const controller=new AbortController(),work=x.current.readCurrent(x.input,controller.signal);
  const rejected=assert.rejects(work,{message:'SENT_TURN_MATERIAL_CURRENT_UNAVAILABLE'});await x.entered;if(cancel)controller.abort();await rejected;
  x.release();await new Promise<void>(r=>setImmediate(r));assert.equal(x.reads(),1);assert.equal(x.locals(),mode==='SOURCE_DELAY'?0:1);
  assert.equal(x.buffers.length,1);assert(x.buffers.every(b=>b.every(v=>v===0)));assert.equal(x.writes(),1);
 }
});
test('다른 receipt/바이트/hash·private 자료와 중간 blob변조·만료는 거절하고 읽은 바이트를 소거한다',async()=>{
 for(const mode of ['BYTES','RECEIPT','LOCAL_RECEIPT','BLOB','EXPIRE']){
  const x=await fixture();x.mode(mode);await assert.rejects(x.current.readCurrent(x.input,new AbortController().signal),{message:'SENT_TURN_MATERIAL_CURRENT_UNAVAILABLE'});
  assert.equal(x.writes(),1);assert(x.buffers.every(b=>b.every(v=>v===0)));assert.equal(x.events.length,1);
 }
});

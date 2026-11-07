import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {Codex0161Codec} from '../../../apps/connector/adapters/primary/codec.ts';
import {SyntheticObservationSpool} from '../../../apps/connector/runtime/execution-observation-spool.ts';
const m:any=await import('../../../apps/connector/adapters/primary/session-transport.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),at=Date.parse('2026-10-19T12:00:00.000Z'),frame=(v:unknown)=>Buffer.from(canonicalJson(v)+'\n');
function fixture(){
 const id=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},context={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]},unsigned={schemaVersion:1,commandId:id,issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+60000).toISOString(),executorRegistrationRef:ref,context,operation:'REQUEST_STOP',payload:{sessionBindingRef:ref,stopScopeRef:ref}},envelope={...unsigned,envelopeHash:hash(unsigned)},key={projectId:id,executionId:id,executionGeneration:1,commandId:id};
 const current:any={transport:'SYNTHETIC_ONLY',key,envelopeHash:envelope.envelopeHash,sessionBindingRef:ref,stopScopeRef:ref,ownershipRef:ref,commandReceiptRef:ref,threadId:'thread-synthetic',turnId:'turn-synthetic',checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString(),forceAllowed:false};let events:any[]=[],calls=0,fault='',clock=at,tail=Promise.resolve(),releaseLate:(()=>void)|undefined;
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,fn:any)=>{const prior=tail;let release!:()=>void;tail=new Promise(r=>release=r);await prior;try{return await fn({read:async()=>({complete:fault!=='incomplete',events:structuredClone(events)}),appendAndSync:async(e:any)=>{events.push(structuredClone(e));if(fault==='sync'){fault='incomplete';throw Error('PRIVATE_SYNC');}if(fault==='expiry'&&e.snapshot.state==='STOP_ATTEMPTED')clock+=30000;}});}finally{release();}}};
 const verifier:any={transport:'SYNTHETIC_ONLY',current:async()=>{if(fault==='changed'&&events.length) return{...current,turnId:'other-turn'};return structuredClone(current);}};
 const wire:any={transport:'SYNTHETIC_ONLY',exchange:async(bytes:Uint8Array)=>{calls++;assert.equal(events.at(-1).snapshot.state,'STOP_ATTEMPTED');const r=JSON.parse(Buffer.from(bytes).toString());assert.equal(r.method,'turn/interrupt');assert.deepEqual(r.params,{threadId:'thread-synthetic',turnId:'turn-synthetic'});if(fault==='lost')throw Error('PRIVATE_AGENT_ERROR');if(fault==='wrongId')return frame({id:'other',result:{}});if(fault==='remoteError')return frame({id:r.id,error:{code:-32603,message:'PRIVATE_AGENT_MESSAGE'}});if(fault==='timeout')await new Promise<void>(r=>releaseLate=r);return frame({id:r.id,result:{}});}};
 const ready=()=>{const codec=new Codex0161Codec({maxFrameBytes:4096,maxPending:1});assert.equal(codec.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}}).kind,'ENCODED');assert.equal(codec.push(frame({id:'init',result:{codexHome:'C:\\synthetic-only',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}))[0]!.kind,'RPC_RESPONSE');assert.equal(codec.encodeInitialized().kind,'ENCODED');return codec;};
 const make=()=>{assert.equal(typeof m.SyntheticPrimaryStopTransport,'function');return new m.SyntheticPrimaryStopTransport(store,verifier,wire,ready(),{context,envelopeExecutorRef:ref},{clock:()=>clock,timeoutMs:100});};
 return{envelope,current,store,verifier,wire,make,events:()=>events,calls:()=>calls,fault:(v:string)=>fault=v,advance:(n:number)=>clock+=n,releaseLate:()=>releaseLate?.()};
}

test('STOP관측은정확원row의요청/미확인만읽으며응답을STOPPED나writer회수로승격하지않는다',async()=>{
 const f=fixture();await f.make().stop(f.envelope);const source=f.make();assert.equal(typeof source.observations,'function');const packet=await source.observations(f.envelope);assert.deepEqual(packet.inputs.map((x:any)=>x.type),['STOP_REQUESTED','STOP_UNCONFIRMED']);assert.deepEqual(packet.inputs.map((x:any)=>x.localRecordRef),f.events().map((x:any)=>x.ref));assert.deepEqual(packet.inputs.map((x:any)=>x.eventId),f.events().map((x:any)=>x.ref.id));assert.equal(packet.inputs[1].reasonCode,'STOP_UNCONFIRMED');assert.equal(packet.writerReleaseVerified,false);assert.equal(packet.dispatchPerformed,false);assert(packet.inputs.every((x:any)=>x.processRef===null));assert(!JSON.stringify(packet).includes('thread-synthetic'));f.advance(120000);assert.deepEqual(await f.make().observations(f.envelope),packet);assert.equal(f.calls(),1);
});
test('STOP관측은응답유실/protocol오류도미확인으로남기고변조/다른context는거절한다',async()=>{
 for(const fault of ['lost','wrongId','remoteError']){const f=fixture();f.fault(fault);await f.make().stop(f.envelope);const packet=await f.make().observations(f.envelope);assert.equal(packet.inputs.at(-1).type,'STOP_UNCONFIRMED');assert.equal(packet.inputs.at(-1).reasonCode,'STOP_UNCONFIRMED');assert.equal(f.calls(),1);assert(!JSON.stringify(packet).includes('PRIVATE'));}
 const f=fixture();await f.make().stop(f.envelope);f.events()[0].snapshot.bindingHash='f'.repeat(64);await assert.rejects(f.make().observations(f.envelope));const g=fixture(),e=structuredClone(g.envelope);e.context.assignmentId=randomUUID();const{envelopeHash:_,...u}=e;e.envelopeHash=hash(u);await assert.rejects(g.make().observations(e));assert.equal(g.calls(),0);
});
test('STOP관측의명시spool수집은부분쓰기전실패뒤원ID중복0·추가interrupt0을유지한다',async()=>{
 const f=fixture();await f.make().stop(f.envelope);const rows:any[]=[],scope={projectId:f.envelope.context.projectId,executionId:f.envelope.context.executionId,executionGeneration:1};let failAt=2;const spool=new SyntheticObservationSpool({transport:'SYNTHETIC_ONLY',exclusive:async(_s,body)=>body({read:async()=>({complete:true,events:structuredClone(rows)}),appendAndSync:async r=>{if(rows.length+1===failAt){failAt=-1;throw Error('OWN_QA_BEFORE_APPEND');}rows.push(structuredClone(r));}})},scope,{clock:()=>at,maxEntries:10,maxBytes:1048576,maxBatchEntries:10,maxBatchBytes:1048576});await assert.rejects(f.make().recordObservations(f.envelope,spool));assert.equal(rows.length,1);const result=await f.make().recordObservations(f.envelope,spool);assert.equal(result.recordedRefs.length,2);assert.equal(result.ackAudited,false);assert.equal(result.writerReleaseVerified,false);assert.deepEqual(await f.make().recordObservations(f.envelope,spool),result);assert.equal(rows.length,2);assert.deepEqual((await spool.prepareBatch(0)).events.map(x=>x.type),['STOP_REQUESTED','STOP_UNCONFIRMED']);assert.equal(f.calls(),1);
});
test('STOP관측은미기록명령을발명하지않고원장종료뒤port전환도거절한다',async()=>{
 const f=fixture();assert.deepEqual((await f.make().observations(f.envelope)).inputs,[]);const source=f.make(),exclusive=f.store.exclusive;f.store.exclusive=async(s:any,body:any)=>{const result=await exclusive(s,body);f.wire.transport='REAL';return result;};await assert.rejects(source.observations(f.envelope));assert.equal(f.events().length,0);assert.equal(f.calls(),0);
});
test('정확 중지 시도를 sync한 뒤 고정 codec interrupt1회를 보내고 응답은 STOP_UNCONFIRMED로만 보존한다',async()=>{
 const f=fixture(),[a,b]=await Promise.all([f.make().stop(f.envelope),f.make().stop(f.envelope)]);assert.deepEqual(a,b);assert.equal(a.state,'STOP_UNCONFIRMED');assert.equal(a.reason,'PROVIDER_ACK_ONLY');assert.equal(a.writerReleaseVerified,false);assert.equal(a.executionAuthorized,false);assert.equal(a.dispatchPerformed,false);assert.equal(f.calls(),1);assert.deepEqual(f.events().map((e:any)=>e.snapshot.state),['STOP_ATTEMPTED','STOP_UNCONFIRMED']);const fact=f.events()[1].snapshot.responseFact;assert(fact,'응답 ref의 비밀 없는 원 사실이 내구 기록에 있어야 한다');assert.equal(hash(fact),a.responseRef.contentHash);assert.equal(fact.fact.kind,'INTERRUPT_RESPONSE');f.advance(120000);assert.deepEqual(await f.make().stop(f.envelope),a);assert.equal(f.calls(),1);
});
test('중지 응답유실·미대응ID·provider오류는 불명으로 보존하고 새 instance도 자동 재전송하지 않는다',async()=>{
 for(const fault of ['lost','wrongId','remoteError']){const f=fixture();f.fault(fault);const out=await f.make().stop(f.envelope);assert.equal(out.state,'STOP_UNCONFIRMED');assert.notEqual(out.reason,'PROVIDER_ACK_ONLY');assert.equal(f.calls(),1);assert.deepEqual(await f.make().stop(f.envelope),out);assert.equal(f.calls(),1);assert(!JSON.stringify(out).includes('PRIVATE'));}
});
test('시도 sync 실패·현재 target 변경·sync 중 기한 만료는 interrupt0이며 원 기록을 보존한다',async()=>{
 for(const fault of ['sync','changed','expiry']){const f=fixture();f.fault(fault);await assert.rejects(f.make().stop(f.envelope));assert.equal(f.calls(),0);assert.equal(f.events().length,1);}
});
test('다른 명령으로 불명 중지를 우회하거나 force·다른 binding·잘못된 scope를 전송하지 않는다',async()=>{
 const f=fixture();await f.make().stop(f.envelope);const {envelopeHash,...u}=f.envelope;u.commandId=randomUUID();await assert.rejects(f.make().stop({...u,envelopeHash:hash(u)}));assert.equal(f.calls(),1);
 for(const change of [(f:any)=>f.current.forceAllowed=true,(f:any)=>f.current.sessionBindingRef={...f.current.sessionBindingRef,version:2},(f:any)=>f.current.key.executionGeneration=2]){const g=fixture();change(g);await assert.rejects(g.make().stop(g.envelope));assert.equal(g.calls(),0);assert.equal(g.events().length,0);}
});
test('실제 wire/verifier/store fallback을 만들지 않고 비합성 port를 거절한다',async()=>{
 const f=fixture();assert.equal(typeof m.SyntheticPrimaryStopTransport,'function');for(const p of [f.store,f.verifier,f.wire]){p.transport='REAL';assert.throws(()=>f.make());p.transport='SYNTHETIC_ONLY';}assert.equal(f.calls(),0);
});

test('유한 timeout 뒤 늦은 interrupt 응답이 와도 불명 기록·전송1회를 바꾸지 않는다',async()=>{
 const f=fixture();f.fault('timeout');const first=await f.make().stop(f.envelope);assert.equal(first.state,'STOP_UNCONFIRMED');assert.equal(first.reason,'RESPONSE_LOST');assert.equal(first.responseRef,null);f.releaseLate();await Promise.resolve();assert.deepEqual(await f.make().stop(f.envelope),first);assert.equal(f.calls(),1);assert.equal(f.events().length,2);
});

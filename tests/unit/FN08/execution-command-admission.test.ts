import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticExecutionClient} from '../../../apps/connector/runtime/execution-client.ts';
import {SyntheticStartReceiver} from '../../../apps/connector/runtime/execution-start-receiver.ts';
import {SyntheticPrimaryInstructionTransport} from '../../../apps/connector/adapters/primary/instruction-transport.ts';
import {SyntheticPrimaryStopTransport} from '../../../apps/connector/adapters/primary/session-transport.ts';
import {SyntheticObservationSpool} from '../../../apps/connector/runtime/execution-observation-spool.ts';
import {Codex0161Codec} from '../../../apps/connector/adapters/primary/codec.ts';
const m:any=await import('../../../apps/connector/runtime/execution-command-admission.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),initial=Date.parse('2026-10-19T12:00:00.000Z');
function recoveryFixture(absent=false){
 const f=stopFixture(),a=f.make();Object.assign(f.scope,{mode:'RECOVERY'});let queries=0,lost=false;
 a.client.transport.perform=async(_scope:unknown,op:{kind:string})=>{queries++;assert.equal(op.kind,'STOP_INSTRUCTION');if(lost)throw Error('PRIVATE_RECOVERY_LOST');return{transport:'SYNTHETIC_ONLY',proofResultRef:f.scope.grantRef,instruction:absent?null:{commandRef:f.commandRef,envelope:f.envelope},expiresAt:new Date(initial+10000).toISOString(),cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false};};
 return{...f,a,operation:{kind:'STOP_INSTRUCTION',commandId:null,bodyRaw:canonicalJson({pollId:randomUUID()})},queries:()=>queries,lose:()=>lost=true};
}
test('회수선택은정확ref의중지봉투만읽고기존실행중지/permit/회수권한을만들지않는다',async()=>{
 const f=recoveryFixture();assert.equal(typeof f.a.readRecoveryStop,'function');const r=await f.a.readRecoveryStop(f.scope,f.operation,f.commandRef);assert.equal(r.state,'SELECTED_NOT_DISPATCHED');assert.deepEqual(r.envelope,f.envelope);assert.deepEqual(r.commandRef,f.commandRef);assert.equal(r.writerReleaseVerified,false);assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);r.envelope.payload.stopScopeRef.version=99;const again=await f.a.readRecoveryStop(f.scope,f.operation,f.commandRef);assert.deepEqual(again.envelope,f.envelope);assert.equal(f.queries(),1);assert.deepEqual(f.counts(),[0,0,0]);assert.equal(f.events.length,0);
 const empty=recoveryFixture(true),v=await empty.a.readRecoveryStop(empty.scope,empty.operation,null);assert.equal(v.state,'NO_STOP_INSTRUCTION');assert.equal(v.envelope,null);assert.equal(v.commandRef,null);assert.equal(v.writerReleaseVerified,false);assert.equal(empty.events.length,0);
});
test('회수선택은정상실행scope/잘못된ref·null선택·다른연산을거절하고정상stop에연결하지않는다',async()=>{
 for(const selection of [null,{version:2},{contentHash:'f'.repeat(64)},{id:randomUUID()}]){const f=recoveryFixture();await assert.rejects(f.a.readRecoveryStop(f.scope,f.operation,selection===null?null:{...f.commandRef,...selection}));assert.equal(f.queries(),1);assert.equal(f.events.length,0);}
 const f=recoveryFixture();await assert.rejects(f.a.readRecoveryStop({...f.scope,mode:'EXECUTION'},f.operation,f.commandRef));assert.equal(f.queries(),0);await assert.rejects(f.a.readRecoveryStop(f.scope,{...f.operation,kind:'COMMANDS'},f.commandRef));assert.equal(f.queries(),0);
 const g=recoveryFixture(true);await assert.rejects(g.a.readRecoveryStop(g.scope,g.operation,g.commandRef));assert.equal(g.queries(),1);assert.equal(g.events.length,0);
});
test('회수선택의UNKNOWN/기한경과cached응답은자동재전송/중지/새page를만들지않는다',async()=>{
 const f=recoveryFixture();f.lose();for(let i=0;i<2;i++)await assert.rejects(f.a.readRecoveryStop(f.scope,f.operation,f.commandRef));assert.equal(f.queries(),1);assert.equal(f.events.length,0);
 const g=recoveryFixture();await g.a.readRecoveryStop(g.scope,g.operation,g.commandRef);g.advance(10000);await assert.rejects(g.a.readRecoveryStop(g.scope,g.operation,g.commandRef));assert.equal(g.queries(),1);assert.equal(g.events.length,0);assert.deepEqual(g.counts(),[0,0,0]);
});
function stopFixture(){const f=fixture();Object.assign(f.envelope,{operation:'REQUEST_STOP',payload:{sessionBindingRef:f.commandRef,stopScopeRef:f.commandRef}});const{envelopeHash:_,...u}=f.envelope;f.envelope.envelopeHash=hash(u);return f;}
function selectedStop(f:ReturnType<typeof stopFixture>){
 let clock=initial,calls=0,currentCalls=0,advanceRead=false,advanceCurrent=false;const rows:any[]=[],e=f.envelope,ref=f.scope.grantRef;
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,body:any)=>body({read:async()=>{if(advanceRead)clock+=10000;return{complete:true,events:structuredClone(rows)};},appendAndSync:async(v:any)=>rows.push(structuredClone(v))})};
 const verifier:any={transport:'SYNTHETIC_ONLY',current:async()=>{currentCalls++;if(advanceCurrent)clock+=10000;return{transport:'SYNTHETIC_ONLY',key:{projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:1,commandId:e.commandId},envelopeHash:e.envelopeHash,sessionBindingRef:(e.payload as any).sessionBindingRef,stopScopeRef:(e.payload as any).stopScopeRef,ownershipRef:ref,commandReceiptRef:ref,threadId:'thread-stop-selected',turnId:'turn-stop-selected',checkedAt:new Date(initial).toISOString(),expiresAt:new Date(initial+30000).toISOString(),forceAllowed:false};}};
 const codec=new Codex0161Codec({maxFrameBytes:4096,maxPending:1}),frame=(v:unknown)=>Buffer.from(canonicalJson(v)+'\n');codec.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}});codec.push(frame({id:'init',result:{codexHome:'C:\\synthetic',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}));codec.encodeInitialized();
 const stop=new SyntheticPrimaryStopTransport(store,verifier,{transport:'SYNTHETIC_ONLY',exchange:async raw=>{calls++;assert.equal(rows.at(-1).snapshot.state,'STOP_ATTEMPTED');const r=JSON.parse(Buffer.from(raw).toString());assert.equal(r.method,'turn/interrupt');assert.deepEqual(r.params,{threadId:'thread-stop-selected',turnId:'turn-stop-selected'});return frame({id:r.id,result:{}});}},codec,{context:e.context,envelopeExecutorRef:e.executorRegistrationRef},{clock:()=>clock,timeoutMs:1000});
 return{stop,rows,counts:()=>[calls,currentCalls],expireRead:()=>advanceRead=true,expireCurrent:()=>advanceCurrent=true};
}
test('STOP선택은정확page원봉투만읽고명시중지전달도응답claim/회수false·interrupt1만보존한다',async()=>{
 const f=stopFixture(),s=selectedStop(f),a=f.make();assert.equal(typeof a.readStop,'function');const selected=await a.readStop(f.scope,f.operation,f.commandRef);assert.deepEqual(selected.envelope,f.envelope);assert.equal(selected.state,'SELECTED_NOT_DISPATCHED');assert.equal(selected.dispatchPerformed,false);assert.deepEqual(s.counts(),[0,0]);
 const result=await a.requestStop(f.scope,f.operation,f.commandRef,s.stop);assert.equal(result.stopped.state,'STOP_UNCONFIRMED');assert.equal(result.stopped.reason,'PROVIDER_ACK_ONLY');assert.equal(result.stopped.writerReleaseVerified,false);assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.deepEqual(s.counts(),[1,3]);assert.equal(s.rows.length,2);assert.deepEqual(await a.requestStop(f.scope,f.operation,f.commandRef,s.stop),result);assert.deepEqual(s.counts(),[1,3]);assert.deepEqual(f.counts(),[1,0,0]);
});
test('STOP선택은다른ref/START/SEND/회수scope·만료page·UNKNOWN에서중지와자동조회0이다',async()=>{
 for(const change of [{version:2},{contentHash:'f'.repeat(64)},{id:randomUUID()}]){const f=stopFixture(),s=selectedStop(f);await assert.rejects(f.make().requestStop(f.scope,f.operation,{...f.commandRef,...change},s.stop));assert.deepEqual(s.counts(),[0,0]);}
 for(const f of [fixture(),instructionFixture()]){await assert.rejects(f.make().readStop(f.scope,f.operation,f.commandRef),/COMMAND_ADMISSION_OPERATION_UNSUPPORTED/);assert.deepEqual(f.counts(),[1,0,0]);}
 const f=stopFixture();await assert.rejects(f.make().readStop({...f.scope,mode:'RECOVERY'},f.operation,f.commandRef));assert.deepEqual(f.counts(),[0,0,0]);await f.make().readStop(f.scope,f.operation,f.commandRef);f.advance(10000);await assert.rejects(f.make().readStop(f.scope,f.operation,f.commandRef));assert.deepEqual(f.counts(),[1,0,0]);
 const g=stopFixture(),s=selectedStop(g);g.lose();for(let i=0;i<2;i++)await assert.rejects(g.make().requestStop(g.scope,g.operation,g.commandRef,s.stop));assert.deepEqual(g.counts(),[1,0,0]);assert.deepEqual(s.counts(),[0,0]);
});
test('STOP선택상한은lock/read·current대기뒤만료를interrupt없이거절하며가짜중지기를허용하지않는다',async()=>{
 for(const kind of ['read','current']){const f=stopFixture(),s=selectedStop(f);if(kind==='read')s.expireRead();else s.expireCurrent();await assert.rejects(f.make().requestStop(f.scope,f.operation,f.commandRef,s.stop));assert.equal(s.counts()[0],0);assert.equal(s.rows.length,0);}
 const f=stopFixture();await assert.rejects(f.make().requestStop(f.scope,f.operation,f.commandRef,{stop:async()=>assert.fail('NO_FAKE_STOP')}));assert.deepEqual(f.counts(),[0,0,0]);
 const g=stopFixture(),s=selectedStop(g),append=s.stop.store.exclusive;s.stop.store.exclusive=async(scope,body)=>append(scope,async tx=>body({...tx,appendAndSync:async entry=>{await tx.appendAndSync(entry);s.expireCurrent();}}));await assert.rejects(g.make().requestStop(g.scope,g.operation,g.commandRef,s.stop));assert.equal(s.counts()[0],0);assert.equal(s.rows.length,1);assert.equal(s.rows[0].snapshot.state,'STOP_ATTEMPTED');
 for(const value of [{expiresAt:new Date(initial).toISOString()},{expiresAt:new Date(initial+30001).toISOString()},{expiresAt:'bad'},{expiresAt:new Date(initial+10000).toISOString(),force:true}]){const h=stopFixture(),t=selectedStop(h);await assert.rejects(t.stop.stop(h.envelope,value));assert.equal(t.rows.length,0);assert.deepEqual(t.counts(),[0,0]);}
});
function fixture(){
 const id=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},commandRef={...ref,id:randomUUID()},scope={mode:'EXECUTION' as const,projectId:id,connectorId:id,executionId:id,executionGeneration:1,grantRef:ref,credentialGeneration:1},streams=new Map<string,any[]>(),events:any[]=[],operation={kind:'COMMANDS',commandId:null,bodyRaw:canonicalJson({pollId:randomUUID(),afterCursor:null,waitMs:0})};let now=initial,queries=0,permits=0,wires=0,lost=false;
 const context={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE' as const,access:'READ' as const,recursive:false as const}]}]},u={schemaVersion:1,commandId:id,issuedAt:new Date(initial).toISOString(),expiresAt:new Date(initial+30000).toISOString(),executorRegistrationRef:ref,context,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}},envelope={...u,envelopeHash:hash(u)};
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(s:any,fn:any)=>{let values=streams.get(s.requestKey);if(!values){values=[];streams.set(s.requestKey,values);}return fn({read:async()=>({complete:true,events:structuredClone(values)}),appendAndSync:async(e:any)=>values!.push(structuredClone(e))});}};
 const client=new SyntheticExecutionClient(store,{transport:'SYNTHETIC_ONLY',current:async v=>({transport:'SYNTHETIC_ONLY',scope,requestKey:v.requestKey,target:v.target,checkedAt:new Date(now).toISOString(),expiresAt:new Date(initial+30000).toISOString()})},{transport:'SYNTHETIC_ONLY',sign:async()=>Buffer.alloc(64,1).toString('base64url')},{transport:'SYNTHETIC_ONLY',challenge:async(_s,r:any)=>({ref,challenge:{id,requestId:r.requestId,purpose:'EXECUTION_REQUEST',grantRef:ref,credentialGeneration:1,scopeDigest:'b'.repeat(64),serverNonce:Buffer.alloc(32,1).toString('base64url'),clientNonce:r.clientNonce,issuedAt:new Date(now).toISOString(),expiresAt:new Date(initial+30000).toISOString()},credentialIssued:false,nonceConsumed:false,executionAuthorized:false,dispatchPerformed:false}),perform:async(_s,op)=>{assert.equal(op.kind,'COMMANDS');queries++;if(lost)throw Error('PRIVATE_RESPONSE_LOST');return{transport:'SYNTHETIC_ONLY',proofResultRef:ref,items:[{sequence:1,commandRef,envelope}],nextCursor:'v1.'+'c'.repeat(43)+'.'+'s'.repeat(43),hasMore:false,observedAt:new Date(now).toISOString(),expiresAt:new Date(initial+10000).toISOString(),cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};}},{clock:()=>now,timeoutMs:1000});
 const receiver=new SyntheticStartReceiver({transport:'SYNTHETIC_ONLY',exclusive:async(_s,fn)=>fn({read:async()=>({complete:true,events:structuredClone(events)}),appendAndSync:async e=>{events.push(structuredClone(e));}})},{transport:'SYNTHETIC_ONLY',consume:async e=>{permits++;return{transport:'SYNTHETIC_ONLY',key:{projectId:id,executionId:id,executionGeneration:1,commandId:e.commandId},envelopeHash:e.envelopeHash,grantRef:ref,permitRef:ref,checkedAt:new Date(now).toISOString(),expiresAt:new Date(initial+10000).toISOString()};}},{transport:'SYNTHETIC_ONLY',send:async()=>{wires++;return{transport:'SYNTHETIC_ONLY',responseRef:ref};}},{context,executorRegistrationRef:ref,grantRef:ref},()=>now);
 const make=()=>{assert.equal(typeof m.SyntheticExecutionCommandAdmission,'function');return new m.SyntheticExecutionCommandAdmission(client,receiver,{clock:()=>now});};return{make,scope,operation,commandRef,envelope,receiver,events,counts:()=>[queries,permits,wires],advance:(n:number)=>now+=n,lose:()=>lost=true};
}
test('page의정확server ref로만시작명령을내구수신하고수신자체는permit·wire를호출하지않는다',async()=>{
 const f=fixture(),a=f.make(),first=await a.receive(f.scope,f.operation,f.commandRef);assert.equal(first.transport,'SYNTHETIC_ONLY');assert.equal(first.state,'RECEIVED');assert.deepEqual(first.commandRef,f.commandRef);assert.equal(first.envelopeHash,f.envelope.envelopeHash);assert.notEqual(f.commandRef.id,f.envelope.commandId);assert.equal(first.executionAuthorized,false);assert.equal(first.dispatchPerformed,false);assert.deepEqual(f.counts(),[1,0,0]);assert.equal(f.events.length,1);assert.deepEqual(await f.make().receive(f.scope,f.operation,f.commandRef),first);assert.deepEqual(f.counts(),[1,0,0]);
 const started=await f.receiver.start(f.envelope);assert.equal(started.state,'RESPONSE_RECORDED');assert.deepEqual(f.counts(),[1,1,1]);
});
test('선택ref의hash/version불일치나봉투commandId를server ref로쓰면수신0이다',async()=>{
 for(const change of ['hash','version','id']){const f=fixture(),selected={...f.commandRef,...(change==='hash'?{contentHash:'f'.repeat(64)}:change==='version'?{version:2}:{id:f.envelope.commandId})};await assert.rejects(f.make().receive(f.scope,f.operation,selected),/COMMAND_ADMISSION_/);assert.equal(f.events.length,0);assert.deepEqual(f.counts(),[1,0,0]);}
});
test('응답유실UNKNOWN과만료된cached page는수신/재전송·자동다음page를만들지않는다',async()=>{
 const f=fixture();f.lose();await assert.rejects(f.make().receive(f.scope,f.operation,f.commandRef),/COMMAND_ADMISSION_/);await assert.rejects(f.make().receive(f.scope,f.operation,f.commandRef),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),[1,0,0]);assert.equal(f.events.length,0);
 const g=fixture();await g.make().receive(g.scope,g.operation,g.commandRef);g.advance(10001);await assert.rejects(g.make().receive(g.scope,g.operation,g.commandRef),/COMMAND_ADMISSION_/);assert.deepEqual(g.counts(),[1,0,0]);assert.equal(g.events.length,1);
});
test('회수scope·비명령pageoperation·선택추가필드는client조회전거절한다',async()=>{
 const f=fixture(),a=f.make();await assert.rejects(a.receive({...f.scope,mode:'RECOVERY'},f.operation,f.commandRef),/COMMAND_ADMISSION_/);await assert.rejects(a.receive(f.scope,{...f.operation,kind:'OBSERVATIONS'},f.commandRef),/COMMAND_ADMISSION_/);await assert.rejects(a.receive(f.scope,f.operation,{...f.commandRef,rawEnvelope:f.envelope}),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),[0,0,0]);
});
test('중지명령은시작수신기로전달하지않고수신중page기한경과는이미쓴기록을지우지않는다',async()=>{
 const f=fixture();Object.assign(f.envelope,{operation:'REQUEST_STOP',payload:{sessionBindingRef:f.commandRef,stopScopeRef:f.commandRef}});const{envelopeHash:_,...unsigned}=f.envelope;f.envelope.envelopeHash=hash(unsigned);await assert.rejects(f.make().receive(f.scope,f.operation,f.commandRef),/COMMAND_ADMISSION_OPERATION_UNSUPPORTED/);assert.equal(f.events.length,0);assert.deepEqual(f.counts(),[1,0,0]);
 const g=fixture(),receive=g.receiver.receive.bind(g.receiver);g.receiver.receive=async e=>{const result=await receive(e);g.advance(10001);return result;};await assert.rejects(g.make().receive(g.scope,g.operation,g.commandRef),/COMMAND_ADMISSION_EXPIRED/);assert.equal(g.events.length,1);assert.deepEqual(g.counts(),[1,0,0]);
});
test('조회grant와다른receiver는append전에거절하고정상grant로다시연결할수있다',async()=>{
 const f=fixture(),wrong=new SyntheticStartReceiver(f.receiver.store,f.receiver.authority,f.receiver.wire,{context:f.envelope.context,executorRegistrationRef:f.envelope.executorRegistrationRef,grantRef:{...f.scope.grantRef,id:randomUUID()}},()=>initial),admission=new m.SyntheticExecutionCommandAdmission((f.make() as any).client,wrong,{clock:()=>initial});await assert.rejects(admission.receive(f.scope,f.operation,f.commandRef),/COMMAND_ADMISSION_/);assert.equal(f.events.length,0);assert.deepEqual(f.counts(),[1,0,0]);assert.equal((await f.make().receive(f.scope,f.operation,f.commandRef)).state,'RECEIVED');assert.equal(f.events.length,1);assert.deepEqual(f.counts(),[1,0,0]);
});

function instructionFixture(){const f=fixture();Object.assign(f.envelope,{operation:'SEND_INSTRUCTION',payload:{sessionBindingRef:f.commandRef,instructionRef:f.commandRef,partsRef:{...f.commandRef,version:2}}});const{envelopeHash:_,...u}=f.envelope;f.envelope.envelopeHash=hash(u);return f;}
test('후속지시는명시server ref로원봉투와page근거만읽고수신/permit/wire0을유지한다',async()=>{
 const f=instructionFixture(),a=f.make();assert.equal(typeof a.readInstruction,'function');const selected=await a.readInstruction(f.scope,f.operation,f.commandRef);assert.equal(selected.state,'SELECTED_NOT_DISPATCHED');assert.deepEqual(selected.envelope,f.envelope);assert.deepEqual(selected.commandRef,f.commandRef);assert.equal(selected.executionAuthorized,false);assert.equal(selected.dispatchPerformed,false);assert.equal(selected.expiresAt,new Date(initial+10000).toISOString());assert.deepEqual(f.counts(),[1,0,0]);assert.equal(f.events.length,0);
 selected.envelope.payload.partsRef.version=99;assert.deepEqual((await f.make().readInstruction(f.scope,f.operation,f.commandRef)).envelope,f.envelope);assert.deepEqual(f.counts(),[1,0,0]);
});
test('후속선택은잘못된ref와START/STOP를거절하며기존START수신을대신하지않는다',async()=>{
 for(const key of ['hash','version','id']){const f=instructionFixture(),wrong={...f.commandRef,...(key==='hash'?{contentHash:'f'.repeat(64)}:key==='version'?{version:2}:{id:f.envelope.commandId})};await assert.rejects(f.make().readInstruction(f.scope,f.operation,wrong),/COMMAND_ADMISSION_/);assert.equal(f.events.length,0);assert.deepEqual(f.counts(),[1,0,0]);}
 const g=fixture();await assert.rejects(g.make().readInstruction(g.scope,g.operation,g.commandRef),/COMMAND_ADMISSION_OPERATION_UNSUPPORTED/);assert.equal(g.events.length,0);assert.deepEqual(g.counts(),[1,0,0]);
 const stop=fixture();Object.assign(stop.envelope,{operation:'REQUEST_STOP',payload:{sessionBindingRef:stop.commandRef,stopScopeRef:stop.commandRef}});const{envelopeHash:_,...u}=stop.envelope;stop.envelope.envelopeHash=hash(u);await assert.rejects(stop.make().readInstruction(stop.scope,stop.operation,stop.commandRef),/COMMAND_ADMISSION_OPERATION_UNSUPPORTED/);assert.equal(stop.events.length,0);assert.deepEqual(stop.counts(),[1,0,0]);
 const h=instructionFixture();await assert.rejects(h.make().receive(h.scope,h.operation,h.commandRef),/COMMAND_ADMISSION_OPERATION_UNSUPPORTED/);assert.equal(h.events.length,0);assert.deepEqual(h.counts(),[1,0,0]);
});
test('후속선택의만료cached page/UNKNOWN은재조회/부작용없이거절한다',async()=>{
 const f=instructionFixture();await f.make().readInstruction(f.scope,f.operation,f.commandRef);f.advance(10000);await assert.rejects(f.make().readInstruction(f.scope,f.operation,f.commandRef),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),[1,0,0]);
 const g=instructionFixture();g.lose();await assert.rejects(g.make().readInstruction(g.scope,g.operation,g.commandRef),/COMMAND_ADMISSION_/);await assert.rejects(g.make().readInstruction(g.scope,g.operation,g.commandRef),/COMMAND_ADMISSION_/);assert.deepEqual(g.counts(),[1,0,0]);assert.equal(g.events.length,0);
});
test('후속선택의회수scope/비명령operation/다른실행봉투는거절한다',async()=>{
 const f=instructionFixture();await assert.rejects(f.make().readInstruction({...f.scope,mode:'RECOVERY'},f.operation,f.commandRef),/COMMAND_ADMISSION_/);await assert.rejects(f.make().readInstruction(f.scope,{...f.operation,kind:'OBSERVATIONS'},f.commandRef),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),[0,0,0]);
 const g=instructionFixture();g.envelope.context={...g.envelope.context,executionId:randomUUID()};const{envelopeHash:_,...u}=g.envelope;g.envelope.envelopeHash=hash(u);await assert.rejects(g.make().readInstruction(g.scope,g.operation,g.commandRef),/COMMAND_ADMISSION_/);assert.equal(g.events.length,0);assert.deepEqual(g.counts(),[1,0,0]);
});

function selectedSender(f:ReturnType<typeof instructionFixture>){
 const e=f.envelope,key={projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:1,commandId:e.commandId},ref=f.scope.grantRef,bytes=Buffer.from('선택한 합성 지시');let clock=initial,calls=0,permits=0,grant=ref,expireOnRead=false;const rows:any[]=[];
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,body:any)=>body({read:async()=>{if(expireOnRead)clock+=10000;return{complete:true,events:structuredClone(rows)};},appendAndSync:async(v:any)=>rows.push(structuredClone(v))})};
 const materials:any={transport:'SYNTHETIC_ONLY',read:async()=>({transport:'SYNTHETIC_ONLY',key,envelopeHash:e.envelopeHash,instructionRef:(e.payload as any).instructionRef,partsRef:(e.payload as any).partsRef,materialReceiptRef:ref,utf8Bytes:bytes.length,contentHash:contentHash(bytes),bytes})};
 const authority:any={transport:'SYNTHETIC_ONLY',current:async()=>({transport:'SYNTHETIC_ONLY',key,envelopeHash:e.envelopeHash,sessionBindingRef:(e.payload as any).sessionBindingRef,instructionRef:(e.payload as any).instructionRef,partsRef:(e.payload as any).partsRef,materialReceiptRef:ref,instructionContentHash:contentHash(bytes),understandingReviewRef:ref,grantRef:grant,ownershipRef:ref,threadId:'thread-selected',turnState:'IDLE',checkedAt:new Date(initial).toISOString(),expiresAt:new Date(initial+30000).toISOString()}),consume:async(_e:any,attempt:any,bindingHash:string)=>{permits++;assert.deepEqual(attempt,rows.at(-1).ref);return{transport:'SYNTHETIC_ONLY',key,envelopeHash:e.envelopeHash,grantRef:grant,permitRef:ref,bindingHash,checkedAt:new Date(initial).toISOString(),expiresAt:new Date(initial+30000).toISOString()};}};
 const codec=new Codex0161Codec({maxFrameBytes:4096,maxPending:1}),frame=(v:unknown)=>Buffer.from(canonicalJson(v)+'\n');codec.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}});codec.push(frame({id:'init',result:{codexHome:'C:\\synthetic',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}));codec.encodeInitialized();
 const wire:any={transport:'SYNTHETIC_ONLY',exchange:async(raw:Uint8Array)=>{calls++;assert.equal(rows.at(-1).snapshot.state,'PERMIT_RECORDED');const r=JSON.parse(Buffer.from(raw).toString());assert.equal(r.method,'turn/start');assert.deepEqual(r.params,{threadId:'thread-selected',input:[{type:'text',text:'선택한 합성 지시'}]});return frame({id:r.id,result:{turn:{id:'turn-selected',items:[],status:'inProgress'}}});}},sender=new SyntheticPrimaryInstructionTransport(store,materials,authority,wire,codec,{context:e.context,envelopeExecutorRef:e.executorRegistrationRef},{clock:()=>clock,timeoutMs:1000});
 return{sender,rows,counts:()=>[calls,permits],wrongGrant:()=>grant={...ref,version:2},expireRead:()=>expireOnRead=true,advance:(n:number)=>clock+=n};
}
function selectedSpool(f:ReturnType<typeof instructionFixture>,foreign=false){
 const rows:any[]=[],scope={projectId:foreign?randomUUID():f.scope.projectId,executionId:f.scope.executionId,executionGeneration:1};let failAt=0,incomplete=false;
 const spool=new SyntheticObservationSpool({transport:'SYNTHETIC_ONLY',exclusive:async(s,body)=>{assert.deepEqual(s,scope);return body({read:async()=>({complete:!incomplete,events:structuredClone(rows)}),appendAndSync:async e=>{if(rows.length+1===failAt){failAt=0;throw Error('PRIVATE_QA_SPOOL_FAILURE');}rows.push(structuredClone(e));}});}},scope,{clock:()=>initial,maxEntries:10,maxBytes:1048576,maxBatchEntries:10,maxBatchBytes:1048576});
 return{spool,rows,failSecond:()=>failAt=2,incomplete:()=>incomplete=true};
}

test('명시 선택 송신·관측 회수는 원장3행을 연결하고 재호출도 wire1·관측중복0이다',async()=>{
 const f=instructionFixture(),s=selectedSender(f),p=selectedSpool(f),a=f.make();assert.equal(typeof a.sendInstructionAndRecord,'function');
 const first=await a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool);
 assert.equal(first.sent.state,'RESPONSE_RECORDED');assert.deepEqual(first.commandRef,f.commandRef);assert.equal(first.observations.recordedRefs.length,3);assert.equal(first.observations.ackAudited,false);assert.equal(first.observations.writerReleaseVerified,false);assert.equal(first.observations.workAccepted,false);assert.equal(first.executionAuthorized,false);assert.equal(first.dispatchPerformed,false);
 assert.deepEqual(p.rows.map(r=>r.snapshot.event.localRecordRef),s.rows.map(r=>r.ref));assert.deepEqual(p.rows.map(r=>r.snapshot.event.type),['PREPARED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED']);assert(!JSON.stringify(p.rows).includes('선택한 합성 지시'));assert(!JSON.stringify(p.rows).includes('thread-selected'));
 assert.deepEqual(await a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool),first);assert.deepEqual(s.counts(),[1,1]);assert.deepEqual(f.counts(),[1,0,0]);assert.equal(p.rows.length,3);
});

test('선택 송신 후 관측 부분 실패는 원기록을 남기고 명시 재시도로 나머지만 회수한다',async()=>{
 const f=instructionFixture(),s=selectedSender(f),p=selectedSpool(f),a=f.make();assert.equal(typeof a.sendInstructionAndRecord,'function');p.failSecond();
 await assert.rejects(a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool),/COMMAND_ADMISSION_/);assert.deepEqual(s.counts(),[1,1]);assert.equal(s.rows.length,3);assert.equal(p.rows.length,1);const original=structuredClone(p.rows[0]);
 const retried=await a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool);assert.equal(retried.observations.recordedRefs.length,3);assert.deepEqual(p.rows[0],original);assert.equal(p.rows.length,3);assert.deepEqual(s.counts(),[1,1]);
});

test('다른 실행 spool·불완전원장·가짜spool은 page조회와 송신 전에 거절한다',async()=>{
 for(const bad of ['scope','incomplete','fake']){const f=instructionFixture(),s=selectedSender(f),p=selectedSpool(f,bad==='scope'),a=f.make();assert.equal(typeof a.sendInstructionAndRecord,'function');if(bad==='incomplete')p.incomplete();
  await assert.rejects(a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,bad==='fake'?{getExecutionFacts:async()=>assert.fail('NO_FAKE_SPOOL')}:p.spool),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),[0,0,0]);assert.deepEqual(s.counts(),[0,0]);assert.equal(p.rows.length,0);
 }
});

test('송신응답 유실도 UNKNOWN 관측만 회수하고 재호출로 지시를 다시 보내지 않는다',async()=>{
 const f=instructionFixture(),s=selectedSender(f),p=selectedSpool(f),a=f.make();assert.equal(typeof a.sendInstructionAndRecord,'function');let calls=0;s.sender.wire.exchange=async()=>{calls++;throw Error('PRIVATE_RESPONSE_LOST');};
 const first=await a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool);assert.equal(first.sent.state,'UNKNOWN');assert.equal(p.rows.at(-1).snapshot.event.reasonCode,'PROVIDER_RESPONSE_LOST');assert.equal(first.observations.workAccepted,false);assert(!JSON.stringify(first).includes('PRIVATE'));
 assert.deepEqual(await a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool),first);assert.equal(calls,1);assert.equal(s.counts()[1],1);assert.equal(p.rows.length,3);
});

test('page 기한 뒤 관측 회수는 정확 보관 명령만 읽고 부분 spool을 재송신 없이 완성한다',async()=>{
 const f=instructionFixture(),s=selectedSender(f),p=selectedSpool(f),a=f.make();assert.equal(typeof a.recordInstructionObservations,'function');p.failSecond();await assert.rejects(a.sendInstructionAndRecord(f.scope,f.operation,f.commandRef,s.sender,p.spool));const original=structuredClone(p.rows[0]);f.advance(120000);s.advance(120000);s.sender.send=async()=>assert.fail('NO_SEND');a.client.transport.perform=async()=>assert.fail('NO_PAGE_QUERY');a.client.signer.sign=async()=>assert.fail('NO_SIGN');
 const out=await a.recordInstructionObservations(f.scope,f.operation,f.commandRef,s.sender,p.spool);assert.equal(out.readOnlySource,true);assert.equal(out.currentAuthorityVerified,false);assert.equal(out.executionAuthorized,false);assert.equal(out.observations.recordedRefs.length,3);assert.equal(out.observations.ackAudited,false);assert.deepEqual(p.rows[0],original);assert.equal(p.rows.length,3);assert.deepEqual(s.counts(),[1,1]);assert.deepEqual(f.counts(),[1,0,0]);assert.deepEqual(await a.recordInstructionObservations(f.scope,f.operation,f.commandRef,s.sender,p.spool),out);
});

test('보관 회수는 없는page·잘못된ref·START/다른spool을 새조회/송신 없이 거절한다',async()=>{
 for(const fault of ['absent','ref','start','spool','no-send']){const f=fault==='start'?fixture():instructionFixture(),s=selectedSender(f),p=selectedSpool(f,fault==='spool'),a=f.make();assert.equal(typeof a.recordInstructionObservations,'function');if(fault!=='absent')await a.client.execute(f.scope,f.operation);const before=f.counts();s.sender.send=async()=>assert.fail('NO_SEND');a.client.transport.perform=async()=>assert.fail('NO_PAGE_QUERY');
  await assert.rejects(a.recordInstructionObservations(f.scope,f.operation,fault==='ref'?{...f.commandRef,version:2}:f.commandRef,s.sender,p.spool),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),before);assert.deepEqual(s.counts(),[0,0]);assert.equal(p.rows.length,0);
 }
});

test('보관 중지 관측은 기한 뒤 부분 회수를 재interrupt 없이 끝내고 회수false를 유지한다',async()=>{
 const f=stopFixture(),s=selectedStop(f),p=selectedSpool(f),a=f.make();assert.equal(typeof a.recordStopObservations,'function');await a.requestStop(f.scope,f.operation,f.commandRef,s.stop);const counts=s.counts();p.failSecond();
 await assert.rejects(a.recordStopObservations(f.scope,f.operation,f.commandRef,s.stop,p.spool));assert.equal(p.rows.length,1);const original=structuredClone(p.rows[0]);f.advance(120000);s.stop.stop=async()=>assert.fail('NO_INTERRUPT');a.client.transport.perform=async()=>assert.fail('NO_PAGE');a.client.signer.sign=async()=>assert.fail('NO_SIGN');
 const out=await a.recordStopObservations(f.scope,f.operation,f.commandRef,s.stop,p.spool);assert.equal(out.observations.recordedRefs.length,2);assert.equal(out.writerReleaseVerified,false);assert.equal(out.observations.writerReleaseVerified,false);assert.equal(out.currentAuthorityVerified,false);assert.equal(out.executionAuthorized,false);assert.equal(out.dispatchPerformed,false);assert.deepEqual(p.rows[0],original);assert.deepEqual(p.rows.map(r=>r.snapshot.event.type),['STOP_REQUESTED','STOP_UNCONFIRMED']);assert.deepEqual(s.counts(),counts);assert.deepEqual(f.counts(),[1,0,0]);assert.deepEqual(await a.recordStopObservations(f.scope,f.operation,f.commandRef,s.stop,p.spool),out);assert.equal(p.rows.length,2);
});

test('보관 중지 회수는 원중지 부재·SEND/ref/spool·회수scope를 새중지 없이 거절한다',async()=>{
 for(const fault of ['absent','no-stop','send','ref','spool','recovery']){const f=fault==='send'?instructionFixture():stopFixture(),s=selectedStop(f),p=selectedSpool(f,fault==='spool'),a=f.make();assert.equal(typeof a.recordStopObservations,'function');if(fault!=='absent')await a.client.execute(f.scope,f.operation);const before=f.counts();s.stop.stop=async()=>assert.fail('NO_INTERRUPT');a.client.transport.perform=async()=>assert.fail('NO_PAGE');
  await assert.rejects(a.recordStopObservations(fault==='recovery'?{...f.scope,mode:'RECOVERY'}:f.scope,f.operation,fault==='ref'?{...f.commandRef,version:2}:f.commandRef,s.stop,p.spool),/COMMAND_ADMISSION_/);assert.deepEqual(f.counts(),before);assert.deepEqual(s.counts(),[0,0]);assert.equal(p.rows.length,0);
 }
});

test('선택전송은server page→동일grant·자료/permit→codec를명시연결하고동일명령wire1만유지한다',async()=>{
 const f=instructionFixture(),s=selectedSender(f),a=f.make();assert.equal(typeof a.sendInstruction,'function');const first=await a.sendInstruction(f.scope,f.operation,f.commandRef,s.sender);assert.equal(first.sent.state,'RESPONSE_RECORDED');assert.equal(first.sent.executionAuthorized,false);assert.equal(first.sent.workAccepted,false);assert.deepEqual(first.commandRef,f.commandRef);assert.deepEqual(s.counts(),[1,1]);assert.deepEqual(f.counts(),[1,0,0]);assert.deepEqual(s.rows.map(r=>r.snapshot.state),['SEND_ATTEMPTED','PERMIT_RECORDED','RESPONSE_RECORDED']);assert.deepEqual(await a.sendInstruction(f.scope,f.operation,f.commandRef,s.sender),first);assert.deepEqual(s.counts(),[1,1]);
});
test('선택전송의다른grant는최초append전거절하고저장된다른grant재사용도거절한다',async()=>{
 const f=instructionFixture(),s=selectedSender(f);s.wrongGrant();await assert.rejects(f.make().sendInstruction(f.scope,f.operation,f.commandRef,s.sender));assert.deepEqual(s.counts(),[0,0]);assert.equal(s.rows.length,0);
 const g=instructionFixture(),t=selectedSender(g);await t.sender.send(g.envelope);await assert.rejects(t.sender.send(g.envelope,{grantRef:{...g.scope.grantRef,version:2},expiresAt:new Date(initial+10000).toISOString()}),/INSTRUCTION_SELECTION_/);assert.deepEqual(t.counts(),[1,1]);assert.equal(t.rows.length,3);
});
test('선택전송은page기한뒤lock진입/자료대조중만료와가짜sender를wire없이거절한다',async()=>{
 const f=instructionFixture(),s=selectedSender(f);s.expireRead();await assert.rejects(f.make().sendInstruction(f.scope,f.operation,f.commandRef,s.sender));assert.deepEqual(s.counts(),[0,0]);assert.equal(s.rows.length,0);
 const material=instructionFixture(),ms=selectedSender(material),read=ms.sender.materials.read.bind(ms.sender.materials);ms.sender.materials.read=async e=>{const value=await read(e);ms.advance(10000);return value;};await assert.rejects(material.make().sendInstruction(material.scope,material.operation,material.commandRef,ms.sender));assert.deepEqual(ms.counts(),[0,0]);assert.equal(ms.rows.length,0);
 const permit=instructionFixture(),ps=selectedSender(permit),consume=ps.sender.authority.consume.bind(ps.sender.authority);ps.sender.authority.consume=async(...args)=>{const value=await consume(...args);ps.advance(10000);return value;};await assert.rejects(permit.make().sendInstruction(permit.scope,permit.operation,permit.commandRef,ps.sender));assert.deepEqual(ps.counts(),[0,1]);assert.deepEqual(ps.rows.map(r=>r.snapshot.state),['SEND_ATTEMPTED','PERMIT_RECORDED']);const unknown=await ps.sender.send(permit.envelope);assert.equal(unknown.state,'UNKNOWN');assert.deepEqual(ps.counts(),[0,1]);
 const g=instructionFixture();await assert.rejects(g.make().sendInstruction(g.scope,g.operation,g.commandRef,{send:async()=>assert.fail('NO_FAKE_SENDER')}),/COMMAND_ADMISSION_/);assert.deepEqual(g.counts(),[0,0,0]);
});

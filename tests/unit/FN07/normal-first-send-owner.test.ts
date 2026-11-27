import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {normalInstructionPollingFixture} from '../FN08/normal-instruction-dispatch-fixture.ts';

const ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
const digest=(x:unknown)=>contentHash(canonicalJson(x));
async function readyFirst(f:Awaited<ReturnType<typeof firstSendFixture>>){
 const {receiveNormalStart}=await import('../../../apps/connector/runtime/normal-start-intake.ts');
 const {NormalStartCoordinator}=await import('../../../apps/connector/runtime/normal-start-coordinator.ts');
 const options=f.options(),start=f.page.items[0]!;assert.ok(start.materials!==null);
 await receiveNormalStart(f.get,options.start.intake,start,f.page.proofResultRef,f.signal);
 assert.equal((await new NormalStartCoordinator(options.start).startPage(start,f.signal))?.state,'START_READY_RECORDED');
 await f.receive();return f.make();
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('C FIRST native 읽기 수송은 원 자료와 slot을 보존하며 취소·교체·초과 뒤 추가 전송을 막는다',async()=>{
 const {takeNormalFirstPermitHandoff}=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 const {inspectNormalFirstPermitHandoff}=await import('../../../apps/connector/runtime/normal-owned-spool-profile.ts');
 const f=await firstSendFixture();let handoff:NonNullable<ReturnType<typeof takeNormalFirstPermitHandoff>>['value']|undefined;
 const create=f.source.create.bind(f.source);
 f.source.create=async(request,prompt,signal)=>{handoff=takeNormalFirstPermitHandoff(request,f.source)!.value;return create(request,prompt,signal);};
 try{
  const coordinator=await readyFirst(f),selection=coordinator.selectFirstPermit(f.wire,f.signal);
  const prepared=await coordinator.prepare(f.item.envelope,f.signal,selection);
  await coordinator.dispatch(f.item.envelope,prepared,f.wire,f.signal);assert.ok(handoff);
  for(const mode of ['ok','unicode','input-change','multipart','partial-cancel','cancel','slot-change','bad-ack','close-unknown','expired','oversize','budget-missing','budget-exhausted','budget-preused','budget-time','old-shape','extra-key','sid-mismatch','sid-empty','sid-control','sid-surrogate','sid-long','slot-mismatch'] as const){
   const life=new AbortController(),frames:any[]=[],closed:string[]=[];let opens=0,now=f.clock();
   const slot={slotId:randomUUID(),receiptRef:structuredClone(handoff.scope.slotRef),origin:'https://anvil-synthetic.invalid',scope:structuredClone(f.scope),expiresAt:new Date(now+30000).toISOString(),caHash:'a'.repeat(64)};
   const input:NonNullable<ReturnType<typeof takeNormalFirstPermitHandoff>>['value']=structuredClone(handoff);
   if(mode==='old-shape')delete (input as any).plannedSid;
   if(mode==='extra-key')(input as any).extra='not-accepted';
   if(mode==='sid-mismatch')(input as any).plannedSid='different-session';
   if(mode==='sid-empty')(input as any).plannedSid='';
   if(mode==='sid-control')(input as any).plannedSid='sid\u0000';
   if(mode==='sid-surrogate')(input as any).plannedSid='sid\ud800';
   if(mode==='sid-long')(input as any).plannedSid='s'.repeat(513);
   if(mode==='slot-mismatch')input.scope.slotRef=ref();
   if(mode==='unicode'){input.plannedSid='원 "SID"\\🙂';input.scope.plannedSidDigest=digest(input.plannedSid);}
   // 이 변경은 수송 한도만 검사한다. native 검산/권위의 양성 fixture로 쓰지 않는다.
   if(mode==='oversize')(input.executionAuthority.permitSnapshot.currentFact as any).intent.reason='가'.repeat(800000);
   if(mode==='multipart'||mode==='partial-cancel'||mode==='budget-preused')(input.executionAuthority.permitSnapshot.currentFact as any).intent.reason='가'.repeat(20000);
   if(mode==='expired')now=Date.parse(input.permit.expiresAt);
   const expected=structuredClone(input);
   const ports={attemptId:randomUUID(),slot,now:()=>now,signal:life.signal,check(){},host:{async open(_signal:AbortSignal,metadata:any){
    opens++;assert.deepEqual(metadata,slot);
    if(mode==='input-change'){input.plannedSid='changed-after-copy';input.scope.plannedSidDigest=digest(input.plannedSid);}
    return{...(mode==='budget-missing'?{}:{inspectionBudget:()=>({frames:mode==='budget-exhausted'?0:mode==='budget-preused'?1:60,remainingMs:mode==='budget-time'?0:9000})}),async send(operation:string,value:any){
     assert.equal(operation,'NORMAL_SDK_FIRST_INSPECT');assert.equal(value.index,frames.length);assert.equal(value.slotId,slot.slotId);
     const bytes=Buffer.from(value.data,'base64');assert(bytes.length<=32768);assert(Buffer.byteLength(canonicalJson(value))<64500);frames.push(structuredClone(value));
     if(mode==='cancel'||mode==='partial-cancel')life.abort();if(mode==='slot-change')slot.receiptRef=ref();
     if(mode==='bad-ack')return{state:'PART_ACCEPTED',transferId:randomUUID(),index:value.index};
     return value.final?{state:'SDK_CONFIGURATION_UNAVAILABLE'}:{state:'PART_ACCEPTED',transferId:value.transferId,index:value.index};
    },async close(disposition:string){closed.push(disposition);return{state:mode==='close-unknown'?'UNKNOWN':'CLOSED_CONFIRMED'};}};
   }}};
   if(mode==='ok'||mode==='unicode'||mode==='input-change'||mode==='multipart'){
    await inspectNormalFirstPermitHandoff(input,ports);assert.equal(opens,1);assert.deepEqual(closed,['HOST_REQUEST_VALIDATED']);
    const bytes=Buffer.concat(frames.map(x=>Buffer.from(x.data,'base64'))),decoded=JSON.parse(bytes.toString('utf8'));
    assert.equal(contentHash(bytes),frames[0].contentHash);assert.deepEqual(decoded.handoff,expected);assert.deepEqual(decoded.scope,expected.scope);
    assert.equal(digest(decoded.handoff.plannedSid),decoded.scope.plannedSidDigest);
    if(mode==='multipart')assert(frames.length>1);
    assert(frames.length>=1&&frames.length<=64);assert.equal(frames.at(-1).final,true);
   }else{
    await assert.rejects(inspectNormalFirstPermitHandoff(input,ports));
    if(mode==='expired'||mode==='oversize'||mode==='old-shape'||mode==='extra-key'||mode.startsWith('sid-')||mode==='slot-mismatch'){assert.equal(opens,0);assert.equal(frames.length,0);assert.equal(closed.length,0);}
    else{assert.equal(opens,1);assert.equal(frames.length,mode.startsWith('budget-')?0:1);assert.equal(closed.length,1);}
   }
  }
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('C FIRST private handoff는 원 claim과 create 수명에만 전체 보호 자료를 단회 전달한다',async()=>{
 const messages:unknown[]=[];
 const f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const value of input)messages.push(value);}}),owner:any=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 let seen:any,requestSaved:unknown;const create=f.source.create.bind(f.source);
 f.source.create=async(request,prompt,signal)=>{
  requestSaved=request;
  assert.throws(()=>owner.takeNormalFirstPermitHandoff({...request},f.source));
  assert.throws(()=>owner.takeNormalFirstPermitHandoff(request,{...f.source}));
  request.plannedSid='changed-request-alias';
  seen=owner.takeNormalFirstPermitHandoff(request,f.source).value;
  assert.equal(seen.plannedSid,f.source.plannedSid);request.plannedSid=f.source.plannedSid;
  assert.throws(()=>owner.takeNormalFirstPermitHandoff(request,f.source));
  assert.equal(Object.hasOwn(request,'executionAuthority'),false);
  return create(request,prompt,signal);
 };
 try{
  const c:any=await readyFirst(f),selection=c.selectFirstPermit(f.wire,f.signal);
  assert.throws(()=>c.selectFirstPermit(f.wire,f.signal));
  assert.throws(()=>f.make().selectFirstPermit(f.wire,f.signal));
  const prepared=await c.prepare(f.item.envelope,f.signal,selection);assert.equal(prepared.state,'PERMIT_RECORDED');
  assert.equal(Object.hasOwn(prepared,'executionAuthority'),false);
  assert.equal((await c.dispatch(f.item.envelope,prepared,f.wire,f.signal)).state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');
  assert.equal(f.effects.create,1);assert.ok(seen);
  assert.equal(seen.plannedSid,f.source.plannedSid);assert.equal(digest(seen.plannedSid),seen.scope.plannedSidDigest);
  assert.deepEqual(Object.keys(seen).sort(),['startEnvelope','sendEnvelope','grantRef','startReadyRef','localAttemptRef','dispatchAttemptRef','permit','proofResultRef','scope','executionAuthority','plannedSid'].sort());
  assert.equal(digest(seen.executionAuthority.permitSnapshot),prepared.permit.ref.contentHash);
  assert.equal(seen.sendEnvelope.envelopeHash,f.item.envelope.envelopeHash);
  assert.equal(seen.startEnvelope.envelopeHash,f.page.items[0]!.envelope.envelopeHash);
  assert.ok(canonicalJson(seen.permit)===canonicalJson(prepared.permit));
  assert.equal(seen.executionAuthority.permitSnapshot.request.representation,'SEND_PERMIT_SOURCE_V1');
  assert.throws(()=>owner.takeNormalFirstPermitHandoff(requestSaved,f.source));
  const calls=f.calls.length;
  assert.equal((await f.make().prepare(f.item.envelope,f.signal)).state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');assert.equal(f.calls.length,calls);
  for(const [,file] of f.fs.files)if(file.bytes){assert.equal(file.bytes.includes(Buffer.from('executionAuthority')),false);assert.equal(file.bytes.includes(Buffer.from('"plannedSid":')),false);}
  await assert.rejects(c.prepare(f.item.envelope,f.signal,selection));
  assert.throws(()=>f.make().selectFirstPermit(f.wire,f.signal));
  const {prepareLiveFollowup}=await import('../FN08/normal-instruction-dispatch-fixture.ts');
  const followup=await prepareLiveFollowup(f,'동일 Query 후속 입력');
  assert.equal(Object.hasOwn(f.h.permits.at(-1)!.snapshot_json.request,'representation'),false);
  assert.equal((await followup.c.dispatch(followup.item.envelope,followup.prepared,f.wire,f.signal)).state,'LIVE_SEND_INPUT_YIELDED');
  assert.equal(messages.length,1);assert.equal(f.effects.create,1);
  assert.throws(()=>owner.takeNormalFirstPermitHandoff(requestSaved,f.source));
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('C FIRST private handoff는 정상 해시의 다른 원 세션·연결 자료도 envelope와 다르면 거절한다',async()=>{
 for(const field of ['session','connection']){
  const f=await firstSendFixture();try{
   const c=await readyFirst(f),selection=c.selectFirstPermit(f.wire,f.signal);
   f.mode.mutatePermit=(reply:any)=>{
    const snapshot=reply.executionAuthority.permitSnapshot,fact=snapshot.currentFact;
    if(field==='session')fact.agentSession.sessionRef=ref();else fact.intent.connectionRef=ref();
    const {checkedAt:_,expires:__,...binding}=fact;
    snapshot.bindingHash=digest({scope:snapshot.scope,commandRef:snapshot.commandRef,authorizationReceiptRef:snapshot.authorizationReceiptRef,reservationRef:snapshot.reservationRef,fact:binding});
    reply.permit.ref.contentHash=digest(snapshot);
   };
   assert.equal((await c.prepare(f.item.envelope,f.signal,selection)).state,'UNKNOWN');
   assert.equal(f.effects.create,0);
  }finally{f.authority.abort();await f.h.close();}
 }
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('C FIRST private handoff는 교차 wire·만료·취소 뒤 소비와 재dispatch를 막는다',async()=>{
 for(const mode of ['wire','expiry','abort','source-sid']){
  const f=await firstSendFixture();try{
   const c=await readyFirst(f),selection=c.selectFirstPermit(f.wire,f.signal);
   const prepared=await c.prepare(f.item.envelope,f.signal,selection);assert.equal(prepared.state,'PERMIT_RECORDED');
   if(mode==='wire'){
    const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
    const other=NormalInstructionWire.forFirstSend(f.worker,f.source);
    await assert.rejects(c.dispatch(f.item.envelope,prepared,other,f.signal));
    await assert.rejects(c.dispatch(f.item.envelope,prepared,f.wire,f.signal));assert.equal(f.effects.create,0);
   }else if(mode==='expiry'){
    f.mode.wall+=30001;await assert.rejects(c.dispatch(f.item.envelope,prepared,f.wire,f.signal));assert.equal(f.effects.create,0);
   }else{
    const owner=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
    f.source.create=async(request)=>{if(mode==='source-sid')f.source.plannedSid='changed-owner';else f.authority.abort();assert.throws(()=>owner.takeNormalFirstPermitHandoff(request,f.source));throw Error('RAM_CANCELLED');};
    assert.equal((await c.dispatch(f.item.envelope,prepared,f.wire,f.signal)).state,'UNKNOWN');
   }
  }finally{f.authority.abort();await f.h.close();}
 }
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('C FIRST private handoff의 복제·교차 coordinator 선택과 기본 호출은 보호 자료를 발급하지 않는다',async()=>{
 const f=await firstSendFixture(),owner:any=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 const create=f.source.create.bind(f.source);
 f.source.create=async(request,prompt,signal)=>{assert.equal(owner.takeNormalFirstPermitHandoff(request,f.source),null);return create(request,prompt,signal);};
 try{
  const c:any=await readyFirst(f),selection=c.selectFirstPermit(f.wire,f.signal),before=f.calls.length;
  await assert.rejects(f.make().prepare(f.item.envelope,f.signal,{...selection} as any));
  await assert.rejects(f.make().prepare(f.item.envelope,f.signal,selection));assert.equal(f.calls.length,before);
  const plainCoordinator=f.make(),prepared=await plainCoordinator.prepare(f.item.envelope,f.signal);assert.equal(prepared.state,'PERMIT_RECORDED');
  const permit=f.h.permits.at(-1)!;assert.equal(Object.hasOwn(permit.snapshot_json.request,'representation'),false);
  assert.equal((await plainCoordinator.dispatch(f.item.envelope,prepared,f.wire,f.signal)).state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');
 }finally{f.authority.abort();await f.h.close();}
 const plain=await firstSendFixture();try{assert.equal((await plain.run()).state,'LIMIT_REACHED');assert.equal(plain.effects.create,1);}finally{plain.authority.abort();await plain.h.close();}
});
export async function firstSendFixture(order='yield-first',followup?:{provide(query:AsyncIterable<unknown>,input:AsyncIterable<unknown>,signal:AbortSignal):Promise<void>}){
 const f=await normalInstructionPollingFixture(Infinity,{text:'원문 🙂\n두 번째 줄',mediaType:'text/plain;charset=utf-8'});
 const {NormalClaudeStartWire}=await import('../../../apps/connector/adapters/secondary/normal-start-wire.ts');
 const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
 const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
 const o=f.options(),{intake,current,grantRef,clock,timeoutMs}=o.start;
 const worker=NormalClaudeStartWire.forWorker({intake,current,grantRef,clock,timeoutMs});
 const authority=new AbortController();let afterInit:(()=>Promise<void>)|undefined,lifetime:AbortSignal|undefined;
 const hooks:{inCreate?:()=>Promise<void>}={};let checkedPlan:string|undefined;
 const effects={create:0,iterate:0,next:0,close:0,inputs:[] as any[],rows:[] as any[],starts:[] as any[],current:true};
 let index=0,occupied=0;
 const source={profileRef:ref(),assignmentRef:ref(),slotRef:ref(),plannedSid:'ram-session',expiresAt:clock()+30000,clock,ownerSignal:authority.signal,
  check(scope:{plannedSidDigest:string}){checkedPlan=scope.plannedSidDigest;return effects.current?{scopeDigest:digest(scope),expiresAt:this.expiresAt}:null;},
  storage:{
   classify(){return 'ORDINARY';},
   async reserve(request:any){return{id:randomUUID(),requestDigest:digest(request),normalUsed:occupied,normalHeldBefore:0,channelBytes:occupied,channelRows:effects.rows.length,channelHeldBytes:0,channelHeldRows:0,managementBytes:128};},
   async strictExclusive(hold:any,body:any){await body({read:async()=>structuredClone(effects.rows),appendAndSync:async(row:any)=>{effects.rows.push(structuredClone(row));}});return{holdId:hold.id,tailRef:effects.rows.at(-1)?.ref??null,rows:effects.rows.length};},
   async settle(hold:any,dataBytes:number){occupied+=dataBytes;if(order==='init-first'&&effects.rows.at(-1)?.snapshot.state==='SESSION_INIT_CONFIRMED'&&afterInit)setImmediate(()=>void afterInit!());return{holdId:hold.id,dataBytes,managementBytes:128};}
  },
  async create(request:{start:any;send:any;scope:{plannedSidDigest:string};plannedSid:string},  prompt:AsyncIterable<unknown>,signal:AbortSignal){
   effects.create++;effects.starts.push(request.start);assert.equal(checkedPlan,digest('ram-session'));assert.equal(request.scope.plannedSidDigest,checkedPlan);assert.equal(request.plannedSid,'ram-session');lifetime=signal;assert.deepEqual(Buffer.from(request.send.instruction.bytes),Buffer.from(request.send.instruction.text));assert.ok(request.start.contextBundle.bytes.byteLength>0&&request.start.options.bytes.byteLength>0);
   const input=prompt[Symbol.asyncIterator]();
   const yieldOne=async()=>{const first=await input.next();if(!first.done)effects.inputs.push(first.value);};
   afterInit=yieldOne;
   if(hooks.inCreate)await hooks.inCreate();
   if(order==='competing-next'){
    assert.throws(()=>prompt[Symbol.asyncIterator]());
    const pulls=await Promise.all([input.next(),input.next(),input.next()]);
    assert.equal(pulls.filter(x=>!x.done).length,1);effects.inputs.push(pulls.find(x=>!x.done)!.value);
   }
   if(order==='yield-first'||order==='wrong-sid'||order==='yield-only')await yieldOne();
   if(order==='late-create')await new Promise<void>(resolve=>signal.addEventListener('abort',()=>setImmediate(resolve),{once:true}));
   if(order==='generic-ref')return {transport:'NORMAL_PROTECTED',responseRef:ref(),processRef:null} as any;
   return{[Symbol.asyncIterator](){effects.iterate++;return{async next(){
    effects.next++;if(index++||order==='yield-only')return{done:true,value:undefined};
    return{done:false,value:{type:'system',subtype:'init',uuid:'init',session_id:order==='wrong-sid'?'other':'ram-session',apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]}};
   }};}};
  },
  async close(){effects.close++;}
 };
 const wire=Reflect.apply(NormalInstructionWire.forFirstSend,NormalInstructionWire,[worker,source,followup]);
 const options=()=>({...o,start:{...o.start,wire:worker},instruction:{...o.instruction,wire}});
 return{...f,worker,wire,source,effects,hooks,options,authority,lifetime:()=>lifetime,run:()=>new NormalStartPolling(options()).run(f.signal)};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('첫 SEND 원 입력과 보호 init을 함께 정착해야 로컬 4행과 cursor가 생긴다',async()=>{
 const f=await firstSendFixture();try{
  const r=await f.run();assert.equal(r.state,'LIMIT_REACHED',JSON.stringify(r));assert.equal(r.commands,2);
  assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);assert.equal(f.effects.inputs.length,1);
  const body=await f.intake.instruction(f.item.envelope);assert.equal(f.effects.inputs[0].message.content,body.text);
  assert.deepEqual(Buffer.from(f.effects.inputs[0].message.content),Buffer.from(body.bytes));
  const start=await f.options().start.intake.startMaterials(f.page.items[0]!.envelope);
  for(const key of ['contextBundle','options'] as const)assert.deepEqual(Buffer.from(f.effects.starts[0][key].bytes),Buffer.from(start[key].bytes));
  const attempts=[...f.fs.files.entries()].filter(([p])=>p.endsWith('.json')&&p.includes('attempt-')).map(([,v])=>JSON.parse(v.bytes.toString()));
  const terminal=attempts.find(v=>v.snapshot.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED'),s=terminal.snapshot;
  assert.equal(s.sequence,4);assert.equal(s.responseRef,null);assert.equal(s.processRef,null);
  assert.deepEqual(s.startReadyRef,attempts.find(v=>v.snapshot.state==='START_READY_RECORDED').ref);
  assert.deepEqual(s.initConfirmationRef,f.effects.rows.at(-1).ref);assert.deepEqual(s.inputEvidence.dispatchAttemptRef,s.previousRef);
  assert.equal(s.inputEvidence.instructionDigest,contentHash(body.bytes));assert.equal(s.inputEvidence.messageDigest,digest(f.effects.inputs[0]));
  const events=f.h.observations.map((x:any)=>x.snapshot_json.event.type);assert(!events.includes('PROVIDER_RESPONSE_RECEIVED'));
  assert.equal((await f.make().history(f.item,f.signal)).state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');
 }finally{await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 for(const order of ['init-first','competing-next','init-only','yield-only','wrong-sid','generic-ref','late-create'])test('동일 생성의 두 증거와 늦은 원 handle 정리 '+order,async()=>{
  const f=await firstSendFixture(order);
  try{
   const r=await f.run();assert.equal(f.effects.create,1);await new Promise(resolve=>setImmediate(resolve));
   if(order==='init-first'||order==='competing-next'){
    assert.equal(r.state,'LIMIT_REACHED',JSON.stringify(r));assert.equal(f.effects.inputs.length,1);assert.equal(f.effects.iterate,1);
    assert.equal(f.lifetime()?.aborted,false);assert.equal(f.effects.close,0);
    f.authority.abort();assert.equal(f.lifetime()?.aborted,true);assert.equal(f.effects.close,1);
   }else{
    assert.equal(r.state,'UNKNOWN');assert.equal(r.cursor.afterSequence,0);assert.equal(f.effects.close,order==='generic-ref'?0:1);assert.equal(f.lifetime()?.aborted,true);
    const history=await f.make().observations(f.item.envelope,f.signal);assert.equal(history.state,'UNKNOWN');
    if(order==='wrong-sid'||order==='generic-ref')assert.equal(f.effects.rows.some(v=>v.snapshot.state==='SESSION_INIT_CONFIRMED'),false);
    if(order==='init-only')assert.equal(f.effects.inputs.length,0);
    if(order==='yield-only')assert.equal(f.effects.rows.length,0);
    if(order==='late-create')assert.equal(f.effects.iterate,0);
    const replay=await f.run();assert.equal(replay.state,'UNKNOWN');assert.equal(f.effects.create,1);
   }
  }finally{f.authority.abort();await f.h.close();}
 });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('원 Query의 scalar iterator는 같은 handle만 정리하고 함수·Proxy와 동일 SEND 재생성은 건드리지 않는다',async()=>{
 let foreignTouches=0;
 const foreign=()=>{foreignTouches++;throw Error('FOREIGN_ITERATOR_TOUCHED');};
 const references=[foreign,new Proxy(foreign,{apply:foreign,get:foreign,getOwnPropertyDescriptor:foreign,getPrototypeOf:foreign}),new Proxy({},{get:foreign,getOwnPropertyDescriptor:foreign,getPrototypeOf:foreign})];
 const malformed=[null,undefined,0,'비반복자',Symbol('non-iterator')];
 for(const [returned,closeCount] of [...malformed.map(value=>[value,1] as const),...references.map(value=>[value,0] as const)]){
  const f=await firstSendFixture(),create=f.source.create.bind(f.source);
  let query:object|undefined;
  const closed:unknown[]=[];
  f.source.create=async(...args)=>{
   await create(...args);
   const own={
    [Symbol.asyncIterator](){f.effects.iterate++;return returned as unknown as AsyncIterator<unknown>;}
   };
   query=own;return own as Awaited<ReturnType<typeof create>>;
  };
  f.source.close=async(target?:unknown)=>{closed.push(target);f.effects.close++;};
  try{
   const result=await f.run();
   assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);
   assert.deepEqual([f.effects.create,f.effects.iterate,f.effects.next,f.effects.close],[1,1,0,closeCount]);
   assert.equal(closed.length,closeCount);
   if(closeCount===1)assert.equal(closed[0],query);
   assert.equal(f.effects.rows.length,0);assert.equal(f.lifetime()?.aborted,true);
   assert.equal(f.h.observations.some((row:any)=>row.snapshot_json.event.type==='PROVIDER_RESPONSE_RECEIVED'),false);
   assert.equal((await f.make().observations(f.item.envelope,f.signal)).state,'UNKNOWN');
   const replay=await f.run();
   assert.equal(replay.state,'UNKNOWN');assert.equal(replay.cursor.afterSequence,0);
   f.authority.abort();assert.equal(foreignTouches,0);assert.equal(closed.length,closeCount);
   assert.deepEqual([f.effects.create,f.effects.iterate,f.effects.next,f.effects.close],[1,1,0,closeCount]);
  }finally{f.authority.abort();await f.h.close();}
 }
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('보호 scope 현재성 부재는 create 전 거절한다',async()=>{
 const f=await firstSendFixture();try{
  f.effects.current=false;const result=await f.run();assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);
  assert.equal(f.effects.create,0);assert.equal(f.effects.iterate,0);assert.equal(f.effects.rows.length,0);
 }finally{f.authority.abort();await f.h.close();}
});


if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('다른 READY의 생성 포트가 원 Query 또는 iterator를 돌려줘도 재소비·타 owner 정리는 없다',async()=>{
 const owner=await firstSendFixture();
 let original:AsyncIterable<unknown>|undefined,iterator:AsyncIterator<unknown>|undefined;
 const create=owner.source.create.bind(owner.source);
 owner.source.create=async(...args)=>{
  const q=await create(...args);
  original={ [Symbol.asyncIterator](){iterator=q[Symbol.asyncIterator]();return iterator!;} };
  return original;
 };
 try{
  assert.equal((await owner.run()).state,'LIMIT_REACHED');assert.ok(original&&iterator);
  const reads=owner.effects.next;
  for(const alias of ['query','iterator']){
   const contender=await firstSendFixture();
   try{
    const make=contender.source.create.bind(contender.source);
    contender.source.create=async(...args)=>{await make(...args);return alias==='query'?original!:{[Symbol.asyncIterator](){return iterator!;}};};
    const attempt=await contender.run();assert.equal(attempt.state,'UNKNOWN');assert.equal(attempt.cursor.afterSequence,0);
    assert.equal(contender.effects.create,1);assert.equal(contender.effects.close,0);assert.equal(contender.effects.rows.length,0);
    assert.equal(owner.effects.next,reads);assert.equal(owner.effects.iterate,1);assert.equal(owner.effects.close,0);
   }finally{contender.authority.abort();await contender.h.close();}
  }
  owner.authority.abort();assert.equal(owner.effects.close,1);
 }finally{owner.authority.abort();await owner.h.close();}
});


if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 test('취소된 B의 늦은 Query가 A의 iterator여도 원 handle은 A만 닫는다',async()=>{
  const a=await firstSendFixture(),b=await firstSendFixture();
  const entered=Promise.withResolvers<void>(),deliver=Promise.withResolvers<void>();
  let original:AsyncGenerator<unknown>|undefined,finalized=0,foreignClose=0;
  const makeA=a.source.create.bind(a.source);
  a.source.create=async(...args)=>{
   const query=await makeA(...args);
   return{[Symbol.asyncIterator](){
    const sourceIterator=query[Symbol.asyncIterator]();
    original=(async function*(){try{
     const init=await sourceIterator.next();if(!init.done)yield init.value;
     if(!a.authority.signal.aborted)await new Promise<void>(resolve=>a.authority.signal.addEventListener('abort',()=>resolve(),{once:true}));
    }finally{finalized++;}})();
    return original;
   }};
  };
  a.source.close=async()=>{a.effects.close++;await original?.return(undefined);};
  b.source.create=async()=>{b.effects.create++;entered.resolve();await deliver.promise;return original!;};
  b.source.close=async(target?:unknown)=>{assert.equal(target,original);foreignClose++;await original!.return(undefined);};
  try{
   assert.equal((await a.run()).state,'LIMIT_REACHED');assert.ok(original);assert.equal(a.effects.next,1);
   const pending=b.run();await entered.promise;b.authority.abort();const result=await pending;
   assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);
   deliver.resolve();await new Promise(resolve=>setImmediate(resolve));
   assert.equal(foreignClose,0);assert.equal(a.lifetime()?.aborted,false);assert.equal(finalized,0);
   assert.equal(b.effects.rows.length,0);assert.equal(a.effects.next,1);assert.equal(a.effects.close,0);
   a.authority.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(finalized,1);assert.equal(a.effects.close,1);
  }finally{deliver.resolve();a.authority.abort();b.authority.abort();await a.h.close();await b.h.close();}
 });
 test('원 owner의 Query가 자기 iterator인 경우 결합과 정리를 한 번씩 수행한다',async()=>{
  const f=await firstSendFixture();const create=f.source.create.bind(f.source);let acquired=0;
  f.source.create=async(...args)=>{
   const q=await create(...args),sourceIterator=q[Symbol.asyncIterator]();
   const self={next:()=>sourceIterator.next(),[Symbol.asyncIterator](){acquired++;return self;}};
   return self;
  };
  try{
   assert.equal((await f.run()).state,'LIMIT_REACHED');assert.equal(acquired,1);assert.equal(f.effects.next,2);
   assert.equal(f.effects.close,0);f.authority.abort();assert.equal(f.effects.close,1);
  }finally{f.authority.abort();await f.h.close();}
 });
}


/** STOP page와 독립 CURRENT reader는 RAM 자료다. 이 fixture의 정상 첫 SEND만 실제 제품 상태기계가 만든다. */
export async function liveStopFixture(followup?:Parameters<typeof firstSendFixture>[1]){
 const f=await firstSendFixture('yield-first',followup),start=f.page.items[0]!,e=start.envelope;
 assert.equal(f.item.envelope.operation,'SEND_INSTRUCTION');const session=f.item.envelope.payload.sessionBindingRef;
 const {normalStopScopeRefV1}=await import('../../../contracts/runtime/normal-stop-target-v1.ts');
 const target={kind:'NORMAL_STOP_SCOPE_V1' as const,projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration,
  grantRef:f.scope.grantRef,parentStartCommandRef:start.commandRef,parentStartEnvelopeHash:e.envelopeHash,executorRegistrationRef:e.executorRegistrationRef,
  sessionBindingRef:session,roleBindingRef:ref(),bindingGeneration:1,ownershipRef:ref(),mode:'COOPERATIVE_REQUEST_ONLY' as const,forceKillAllowed:false as const};
 const scopeRef=normalStopScopeRefV1(target,e.commandId),{envelopeHash:_,...startBody}=e;
 const unsigned={...startBody,commandId:randomUUID(),operation:'REQUEST_STOP' as const,payload:{sessionBindingRef:session,stopScopeRef:scopeRef}};
 const item={commandRef:ref(),sequence:f.item.sequence+1,envelope:{...unsigned,envelopeHash:digest(unsigned)},stopTarget:target,materials:null,materialsDescriptorHash:null};
 const original={startCommandRef:start.commandRef,startEnvelope:e,grantRef:f.scope.grantRef,sessionBindingRef:session,roleBindingRef:target.roleBindingRef,bindingGeneration:1,ownershipRef:target.ownershipRef};
 const store=f.store.stopAttempts(),calls={interrupt:0,current:0},hooks:{interrupt?:()=>Promise<void>;current?:(w:any)=>any}={};
 let checkedScope='',query:any;
 const make=f.source.create.bind(f.source);
 f.source.create=async(...args)=>{checkedScope=digest(args[0].scope);const result=await make(...args);query=Object.assign(result,{async interrupt(){assert.equal(this,query);calls.interrupt++;await hooks.interrupt?.();}});return query;};
 const stop={store,async readCurrent(){
  calls.current++;const value={owner:f.worker,query,scopeDigest:checkedScope,commandRef:structuredClone(item.commandRef),envelopeHash:item.envelope.envelopeHash,
   projection:{transport:'NORMAL_PROTECTED',grantRef:f.scope.grantRef,sessionBindingRef:session,stopScopeRef:scopeRef,target:structuredClone(target),
   checkedAt:new Date(f.clock()).toISOString(),expiresAt:new Date(f.clock()+30000).toISOString(),executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false}};
  return hooks.current?hooks.current(value):value;
 }};
 Object.assign(f.source,{stop});
 const ports=()=>({intake:f.options().start.intake,store,original,clock:f.clock,timeoutMs:1000});
 const rows=()=>f.store.exclusive('attempt-'+item.envelope.commandId,tx=>tx.read()) as Promise<any[]>;
 return{...f,original,target,stopItem:item,stop,stopPorts:ports,stopCalls:calls,stopHooks:hooks,stopQuery:()=>query,stopRows:rows};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('정착한 첫 SEND 뒤 원 출력 대기와 협력 STOP은 같은 RAM 잠금을 공유한다',async()=>{
 const {NormalStopCoordinator}=await import('../../../apps/connector/runtime/normal-stop-coordinator.ts');
 const {NormalSdkSessionOutput}=await import('../../../apps/connector/runtime/normal-sdk-session-output.ts');
 const outputNext=NormalSdkSessionOutput.prototype.next;
 const f=await liveStopFixture(),release=Promise.withResolvers<void>();
 const result={type:'result',subtype:'success',uuid:'ok',session_id:'ram-session',duration_ms:1,duration_api_ms:1,is_error:false,num_turns:1,stop_reason:null,total_cost_usd:0,usage:{},modelUsage:{},permission_denials:[],result:'원 결과'};
 const assistant={type:'assistant',uuid:'reply',session_id:'ram-session',parent_tool_use_id:null,message:{content:[{type:'text',text:'원 답변'}]}};
 const make=f.source.create.bind(f.source),strict=f.source.storage.strictExclusive.bind(f.source.storage),exclusive=f.stop.store.exclusive.bind(f.stop.store);
 let locked=false,waiting=false,active=0,maxActive=0,reads=0,settled=0;
 async function lock<T>(work:()=>Promise<T>){assert.equal(locked,false);locked=true;try{return await work();}finally{locked=false;}}
 f.source.storage.strictExclusive=(hold,body)=>lock(()=>strict(hold,body));
 f.stop.store.exclusive=(key,body)=>lock(()=>exclusive(key,body));
 const settle=f.source.storage.settle.bind(f.source.storage);
 f.source.storage.settle=async(...args)=>{const value=await settle(...args);settled++;return value;};
 f.source.create=async(...args)=>{
  const query=await make(...args),iterate=query[Symbol.asyncIterator].bind(query);
  query[Symbol.asyncIterator]=()=>{const iterator=iterate();return{async next(){
   maxActive=Math.max(maxActive,++active);
   try{switch(++reads){
    case 1:return await iterator.next();
    case 2:assert.equal(settled,1);waiting=true;await release.promise;return{value:assistant,done:false};
    case 3:assert.equal(settled,2);return{value:result,done:false};
    default:assert.equal(settled,3);return{value:undefined,done:true};
   }}finally{active--;}
  }};};
  return query;
 };
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(waiting,true);assert.equal(locked,false);
  let activeAtInterrupt=0;let rowsAtInterrupt:string[]=[];
  f.stopHooks.interrupt=async()=>{activeAtInterrupt=active;rowsAtInterrupt=(await f.stopRows()).map(r=>r.snapshot.state);};
  const stop=await new NormalStopCoordinator(f.stopPorts()).recordObservations(f.stopItem,f.spool,f.signal,f.worker);
  assert.equal(stop.state,'STOP_UNCONFIRMED');assert.equal(f.stopCalls.interrupt,1);assert.equal(reads,2);
  assert.equal(activeAtInterrupt,1);assert.deepEqual(rowsAtInterrupt,['STOP_ATTEMPTED']);
  assert.equal(Object.hasOwn(outputNext,'call'),false);let shadowCalls=0;
  Object.defineProperty(outputNext,'call',{configurable:true,value(){shadowCalls++;throw Error('own.call');}});
  release.resolve();for(let i=0;i<8&&settled<4;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(shadowCalls,0);assert.equal(settled,4);assert.equal(reads,4);assert.equal(maxActive,1);assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
  assert.deepEqual(f.effects.rows.slice(2).map(r=>Buffer.from(r.snapshot.body,'base64').toString()),[canonicalJson(assistant),canonicalJson(result)]);
  assert.equal(f.effects.close,0);assert.equal(f.lifetime()?.aborted,false);
  await f.run();assert.equal(reads,4);assert.equal(f.effects.create,1);
 }finally{Reflect.deleteProperty(outputNext,'call');release.resolve();f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 for(const mode of ['strict-close','post-commit-live'])test('첫 SEND 정착/후행 검사 실패는 예약된 출력 수집을 시작하지 않는다 '+mode,async()=>{
  const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
  const f=await firstSendFixture(),channel='attempt-'+f.item.envelope.commandId;
  const written=()=>[...f.fs.files].some(([p,v])=>p.includes(channel)&&p.endsWith('.json')&&JSON.parse(v.bytes.toString()).snapshot.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED');
  const open=f.fs.fs.open.bind(f.fs.fs);let failedClose=0,afterCommit=0;
  f.fs.fs.open=async(p:string,flags:any)=>{const file=await open(p,flags);if(mode==='strict-close'&&p.endsWith(channel+'.lock')&&flags==='wx'){
   const close=file.close.bind(file);file.close=async()=>{if(written()){failedClose++;throw Error('uncertain');}await close();};
  }return file;};
  const check=f.source.check.bind(f.source);let finalClock=false;
  f.source.check=scope=>{const current=check(scope);
   if(mode==='post-commit-live'&&written()&&![...f.fs.files.keys()].some(p=>p.endsWith(channel+'.lock')))finalClock=true;
   return current;
  };
  const options=f.options();options.instruction.clock=()=>{if(finalClock){afterCommit++;return f.clock()+60000;}return f.clock();};
  try{
   const outcome=await new NormalStartPolling(options).run(f.signal);await new Promise(resolve=>setImmediate(resolve));
   assert.equal(outcome.state,'UNKNOWN');assert.equal(outcome.cursor.afterSequence,0);assert(written());
   if(mode==='strict-close'){assert.equal(failedClose,1);assert.equal(afterCommit,0);}else{assert(afterCommit>0);assert.equal(failedClose,0);}
   assert.equal(f.effects.next,1);assert.equal(f.effects.close,1);assert.equal(f.effects.create,1);
   await f.run();assert.equal(f.effects.next,1);assert.equal(f.effects.create,1);
  }finally{f.authority.abort();await f.h.close();}
 });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)for(const when of ['stop-first','stop-after-yield'] as const)test('후속 입력과 원 STOP의 선점 '+when,async()=>{
 const {prepareLiveFollowup}=await import('../FN08/normal-instruction-dispatch-fixture.ts');
 const {requestNormalLiveStop}=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 let effect=0,delivered=0;
 const f=await liveStopFixture({async provide(query,input){effect++;assert.equal(query,f.stopQuery());const step=await input[Symbol.asyncIterator]().next();assert.equal(step.done,false);delivered++;await stop();}});
 const stop=()=>requestNormalLiveStop(f.worker,f.stopItem,f.original,f.stop.store,f.signal,()=>{});
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const {item,c,prepared}=await prepareLiveFollowup(f,'STOP 경합 입력');
  if(when==='stop-first')await stop();
  await assert.rejects(c.dispatch(item.envelope,prepared,f.wire,f.signal));
  assert.equal(effect,when==='stop-first'?0:1);assert.equal(delivered,effect);
  assert.equal(f.stopCalls.interrupt,1);assert.deepEqual((await f.stopRows()).map(r=>r.snapshot.state),['STOP_ATTEMPTED','STOP_UNCONFIRMED']);
  assert.notEqual((await f.make().history(item,f.signal)).state,'LIVE_SEND_INPUT_YIELDED');assert.equal(f.effects.create,1);
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('두 후속 명령의 경합은 먼저 점유한 같은 Query만 한 번 제공한다',async()=>{
 const {prepareLiveFollowup}=await import('../FN08/normal-instruction-dispatch-fixture.ts');
 let concurrent:()=>Promise<void>,calls=0;const messages:unknown[]=[];
 const f=await firstSendFixture('yield-first',{async provide(_query,input){
  calls++;await concurrent();const iter=input[Symbol.asyncIterator]();
  const steps=await Promise.all([iter.next(),iter.next(),iter.next()]);assert.equal(steps.filter(s=>s.done).length,2);
  for(const s of steps)if(!s.done)messages.push((s.value as any).message.content);
 }});
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const a=await prepareLiveFollowup(f,'선점한 원문'),b=await prepareLiveFollowup(f,'경합하는 다른 원문');
  concurrent=async()=>{await assert.rejects(b.c.dispatch(b.item.envelope,b.prepared,f.wire,f.signal),/BUSY/);};
  const result=await a.c.dispatch(a.item.envelope,a.prepared,f.wire,f.signal);
  assert.equal(result.state,'LIVE_SEND_INPUT_YIELDED');assert.deepEqual(messages,['선점한 원문']);assert.equal(calls,1);
  assert.notEqual((await f.make().history(b.item,f.signal)).state,'LIVE_SEND_INPUT_YIELDED');assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('등록되지 않은 직접 RAM source의 null SID는 자동 발급하거나 Query를 만들지 않는다',async()=>{
 const f=await firstSendFixture();try{
  (f.source as any).plannedSid=null;
  const result=await f.run();assert.equal(result.state,'UNKNOWN');assert.equal(f.effects.create,0);assert.equal(f.effects.inputs.length,0);assert.equal(f.effects.rows.length,0);
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('raw ticket은 원 FIRST claim의 SID 발급 근거를 만들지 않는다',async()=>{
 const f=await firstSendFixture(),{takeFirstSidOrigin}=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');try{
  assert.throws(()=>takeFirstSidOrigin({},f.source,f.worker),/NORMAL_FIRST_SEND_UNKNOWN/);
  assert.equal(f.effects.create,0);assert.equal(f.effects.rows.length,0);
 }finally{f.authority.abort();await f.h.close();}
});

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)test('C FIRST 인계 소비 뒤 원 현재성이 끝나면 다음 효과 없이 취득한 원 소유자만 닫는다',async()=>{
 const {takeNormalFirstPermitHandoff}=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 const {prepareNormalSdkChildHandoff}=await import('../../../apps/connector/runtime/normal-owned-spool-profile.ts');
 for(const mode of ['BEFORE_OPEN','AFTER_OPEN','AFTER_OWNER','DURING_CLOSE','LATE_OWNER'] as const){
  const f=await firstSendFixture();const trace:string[]=[];
  let entered=false,verified=false,releaseLateOwner:(()=>void)|undefined,finished!:()=>void;
  const finishedCreate=new Promise<void>(resolve=>{finished=resolve;});
  f.source.create=async(request,_prompt,life)=>{
   const {value:handoff,check}=takeNormalFirstPermitHandoff(request,f.source)!;
   const now=f.clock();
   const slot={slotId:randomUUID(),receiptRef:structuredClone(handoff.scope.slotRef),origin:'https://anvil-synthetic.invalid',scope:structuredClone(f.scope),expiresAt:new Date(now+30000).toISOString(),caHash:'a'.repeat(64)};
   const expire=()=>{descriptorDeadline=f.clock();assert.equal(life.aborted,false);};
   if(mode==='BEFORE_OPEN')expire();
   entered=true;
   try{
    const owner=await prepareNormalSdkChildHandoff(handoff,{attemptId:randomUUID(),slot,now:()=>now,signal:life,check,host:{async open(){
    trace.push('OPEN');if(mode==='AFTER_OPEN')expire();
    return {async send(){assert.fail('not a general request');},async close(disposition){trace.push(disposition);if(mode==='DURING_CLOSE')f.authority.abort();return {state:'CLOSED_CONFIRMED'};},
     async prepareSdkChildSource(raw){trace.push('PREPARE');return {async acknowledge(){trace.push('ACK');},
      async afterClose(){trace.push('AFTER_CLOSE');if(mode==='AFTER_OWNER')expire();const supervisor={read(){trace.push('READ_OWNER');return {
       leaseId:randomUUID(),endpointId:randomUUID(),sourceHash:digest(raw),bindingHash:'a'.repeat(64),expiresAt:new Date(now+1000).toISOString(),childCreated:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};},
       async close(){trace.push('OWNER_CLOSE');return {state:'UNKNOWN' as const};}};
       if(mode!=='LATE_OWNER')return supervisor;
       return new Promise(resolve=>{releaseLateOwner=()=>resolve(supervisor);f.authority.abort();});},
      async discard(){trace.push('DISCARD');releaseLateOwner?.();return {state:'UNKNOWN'};}};}};
   }}});
    await owner.close();verified=true;throw Error('UNEXPECTED_HANDOFF');
   }finally{finished();}
  };
  let descriptorDeadline=Infinity;const originalCheck=f.source.check;
  f.source.check=function(scope){const clocked=originalCheck.call(this,scope);return clocked&&{...clocked,expiresAt:Math.min(clocked.expiresAt,descriptorDeadline)};};
  try{
   const c=await readyFirst(f),selection=c.selectFirstPermit(f.wire,f.signal);
   const prepared=await c.prepare(f.item.envelope,f.signal,selection);assert.equal(prepared.state,'PERMIT_RECORDED');
   assert.equal((await c.dispatch(f.item.envelope,prepared,f.wire,f.signal)).state,'UNKNOWN');
   assert.equal(entered,true);await finishedCreate;assert.equal(verified,false);
   const acknowledged=['OPEN','PREPARE','ACK','HOST_REQUEST_VALIDATED'];
   const expected={BEFORE_OPEN:[],AFTER_OPEN:['OPEN','OPERATION_UNKNOWN'],AFTER_OWNER:[...acknowledged,'AFTER_CLOSE','OWNER_CLOSE'],
    DURING_CLOSE:[...acknowledged,'DISCARD'],LATE_OWNER:[...acknowledged,'AFTER_CLOSE','DISCARD','OWNER_CLOSE']};
   assert.deepEqual(trace,expected[mode]);
  }finally{f.authority.abort();await f.h.close();}
 }
});

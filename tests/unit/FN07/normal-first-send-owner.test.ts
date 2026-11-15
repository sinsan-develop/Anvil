import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {normalInstructionPollingFixture} from '../FN08/normal-instruction-dispatch-fixture.ts';

const ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
const digest=(x:unknown)=>contentHash(canonicalJson(x));
export async function firstSendFixture(order='yield-first'){
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
 const wire=NormalInstructionWire.forFirstSend(worker,source);
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
    original=(async function*(){try{const init=await sourceIterator.next();if(!init.done)yield init.value;}finally{finalized++;}})();
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
   assert.equal((await f.run()).state,'LIMIT_REACHED');assert.equal(acquired,1);assert.equal(f.effects.next,1);
   assert.equal(f.effects.close,0);f.authority.abort();assert.equal(f.effects.close,1);
  }finally{f.authority.abort();await f.h.close();}
 });
}

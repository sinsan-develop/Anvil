import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {NormalSdkSessionOutput} from '../../../apps/connector/runtime/normal-sdk-session-output.ts';

test('최초 Query 호출 전 SEND 3행 잠금이 닫혀 다른 coordinator가 원 시도행을 읽는다',async()=>{
 const {firstSendFixture}=await import('./normal-first-send-owner.test.ts');
 const f=await firstSendFixture();let observed:string|undefined,replayed:string|undefined;
 f.hooks.inCreate=async()=>{observed=(await f.make().observations(f.item.envelope,f.signal)).state;replayed=(await f.run()).state;};
 try{
  const result=await f.run();
  assert.equal(observed,'SEND_DISPATCH_ATTEMPTED');assert.equal(replayed,'UNKNOWN');
  assert.equal(result.state,'LIMIT_REACHED');
  assert.equal(f.effects.create,1);assert.equal(f.h.permits.length,1);assert.equal(f.h.startPermits.length,1);
 }finally{f.authority.abort();await f.h.close();}
});

const ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
const sid='planned-session';
const assistant=(id:string,text:string)=>({type:'assistant',uuid:id,session_id:sid,parent_tool_use_id:null,message:{content:[{type:'text',text}]}});
const init=()=>({type:'system',subtype:'init',uuid:'init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]});
const result=(bad:boolean)=>({type:'result',subtype:bad?'error_max_turns':'success',uuid:bad?'err':'ok',session_id:sid,duration_ms:1,duration_api_ms:1,is_error:bad,num_turns:1,stop_reason:null,total_cost_usd:0,usage:{},modelUsage:{},permission_denials:[],...(bad?{errors:['fixture-error']}:{result:'fixture-result'})});
const digest=(v:unknown)=>contentHash(canonicalJson(v));

function fixture(messages:unknown[],pool={used:0,held:0}){
 const context={projectId:randomUUID(),assignmentId:randomUUID(),executionId:randomUUID(),executionGeneration:1,connectionRef:ref(),environmentRef:ref(),authorizationReceiptRef:ref(),capabilityRef:ref(),budgetRef:ref(),sourceScopes:[]};
 const scope={projectId:context.projectId,executionId:context.executionId,generation:1,registrationRef:ref(),profileRef:ref(),assignmentRef:ref(),slotRef:ref(),grantRef:ref(),startReadyRef:ref(),dispatchAttemptRef:ref(),sessionBindingRef:ref(),plannedSidDigest:digest(sid)};
 const mode={nexts:0,open:0,now:Date.now(),get used(){return pool.used;},set used(v:number){pool.used=v;},get held(){return pool.held;},set held(v:number){pool.held=v;},overhead:150,reads:0,settled:0,channelHeldBytes:0,channelHeldRows:0,fault:'',active:true};
 const iterator={async next(){mode.nexts++;return messages.length?{done:false,value:messages.shift()}:{done:true,value:undefined};}};
 const query={[Symbol.asyncIterator]:()=>iterator},origin={owner:{},attempt:{},query,iterator};
 const rows:any[]=[],charges:any[]=[];
 let tailBytes=0;
 const deadline=mode.now+10000;
 const ports={clock:()=>mode.now,current:()=>mode.active?{...origin,scopeDigest:digest(scope),expiresAt:deadline}:null,
  classify:(message:any)=>JSON.stringify(message).includes('private-marker')?'SENSITIVE':JSON.stringify(message).includes('ambiguous-marker')?'UNCLASSIFIED':'ORDINARY',
  async reserve(request:any){const before=mode.held;const total=request.dataBytes+mode.overhead;
   if(mode.used+before+total>256*1024*1024)throw Error('budget');mode.held+=total;charges.push(total);
   return {id:randomUUID(),requestDigest:digest(request),normalUsed:mode.used,normalHeldBefore:before,channelBytes:tailBytes,channelRows:rows.length,channelHeldBytes:mode.channelHeldBytes,channelHeldRows:mode.channelHeldRows,managementBytes:mode.overhead};},
  async strictExclusive(hold:any,body:any){mode.open++;await body({
   async read(){mode.reads++;if(mode.fault==='readback'&&rows.length)throw Error('read');return structuredClone(rows);},
   async appendAndSync(row:any){if(mode.fault==='append')throw Error('append');rows.push(structuredClone(row));if(mode.fault==='sync')throw Error('sync');}
  });if(mode.fault==='close'&&mode.open%2===0)throw Error('write-close');return {holdId:hold.id,tailRef:rows.at(-1)?.ref??null,rows:rows.length};},
  async settle(hold:any,actual:number){if(mode.fault==='settle')throw Error('unknown');mode.settled++;mode.held-=charges.at(-1)!;mode.used+=actual+mode.overhead;tailBytes+=actual;return{holdId:hold.id,dataBytes:actual,managementBytes:mode.overhead};}
 };
 const config={origin,scope,context,plannedSid:sid,expiresAt:deadline,ports};
 return{config,origin,scope,ports,mode,rows,charges,iterator,open:()=>new NormalSdkSessionOutput(config),signal:new AbortController().signal};
}
test('init 전 assistant 원행은 불변이고 같은 세션 확인 뒤에만 일반 출력 ref를 얻는다',async()=>{
 const msg=assistant('one','full-body'),f=fixture([msg,init(),result(false),result(true)]),reader=f.open();
 const first=await reader.next(f.signal);assert.deepEqual(first.receipts,[]);assert.equal(f.rows[0].snapshot.state,'OUTPUT_PENDING_SESSION');
 assert.equal(Buffer.from(f.rows[0].snapshot.body,'base64').toString('utf8'),canonicalJson(msg));
 const original=canonicalJson(f.rows[0]);const confirmed=await reader.next(f.signal);
 assert.equal(confirmed.state,'SESSION_CONFIRMED');assert.equal(canonicalJson(f.rows[0]),original);
 assert.deepEqual(confirmed.receipts[0]!.outputRef,f.rows[0].ref);assert.equal(confirmed.receipts[0]!.attribution,'SESSION_ONLY');
 assert.equal(f.rows[2].snapshot.state,'SESSION_INIT_CONFIRMED');assert.equal(f.rows[2].snapshot.prefixCount,2);
 assert.deepEqual(f.rows[2].snapshot.tailRef,f.rows[1].ref);
 for(const message of [result(false),result(true)]){
  const out=await reader.next(f.signal);assert.equal(out.state,'OUTPUT_RECORDED');assert.equal(out.receipts[0]!.processRef,null);
  assert.equal(Buffer.from(f.rows.at(-1).snapshot.body,'base64').toString(),canonicalJson(message));
 }
 assert.equal((await reader.next(f.signal)).state,'DONE');
});

test('init 우선 확정, 원 증거 단발 소비와 동일 출력 중복 재판독',async()=>{
 const message=assistant('event','same'),f=fixture([init(),message,structuredClone(message)]),reader=f.open();
 const mark=await reader.next(f.signal),token=mark.initEvidence;
 assert.ok(token);assert.equal(reader.consumeInit({},f.origin),null);
 assert.equal(reader.consumeInit(token,{...f.origin,owner:{}}),null);
 assert.equal(reader.consumeInit(token,{...f.origin,attempt:{}}),null);
 assert.equal(reader.consumeInit(mark.receipts[0]!.outputRef,f.origin),null);
 assert.deepEqual(reader.consumeInit(token,f.origin),f.rows[1].ref);assert.equal(reader.consumeInit(token,f.origin),null);
 const first=await reader.next(f.signal),reads=f.mode.reads,again=await reader.next(f.signal);
 assert.deepEqual(again.receipts,first.receipts);assert.equal(f.mode.reads>reads,true);assert.equal(f.rows.length,3);
 assert.throws(()=>f.open());
});

test('민감 assistant와 미분류 result는 원문·예약·prefix에 포함되며 확인 뒤에도 격리된다',async()=>{
 const a=assistant('private','private-marker'),b={...result(true),errors:['ambiguous-marker']};
 const f=fixture([a,b,init(),structuredClone(a),structuredClone(b)]),reader=f.open();
 for(const [i,msg] of [a,b].entries()){
  const out=await reader.next(f.signal);assert.deepEqual(out.receipts,[]);
  assert.equal(f.rows[i].snapshot.classification,'QUARANTINED');assert.equal(f.rows[i].snapshot.sequence,i+1);
  assert.equal(Buffer.from(f.rows[i].snapshot.body,'base64').toString(),canonicalJson(msg));
 }
 const before=f.rows.map(v=>canonicalJson(v)),occupied=f.rows.reduce((n,v)=>n+Buffer.byteLength(canonicalJson(v))+1,0);
 assert.equal(f.mode.used,occupied+2*f.mode.overhead);const mark=await reader.next(f.signal);
 assert.deepEqual(f.rows.slice(0,2).map(v=>canonicalJson(v)),before);
 assert.deepEqual(mark.receipts.map(v=>v.outputRef),[f.rows[2].ref]);
 const prefix=f.rows.slice(0,3).reduce((previous,v)=>digest({previous,ref:v.ref,payloadDigest:v.snapshot.payloadDigest}),digest([]));
 assert.equal(f.rows[3].snapshot.prefixDigest,prefix);assert.equal(f.rows[3].snapshot.prefixCount,3);
 assert.deepEqual((await reader.next(f.signal)).receipts,[]);assert.deepEqual((await reader.next(f.signal)).receipts,[]);
 assert.doesNotMatch(JSON.stringify(mark),/private-marker|ambiguous-marker|planned-session/);
});

for(const fault of ['append','sync','readback','close','settle'])test('저장 '+fault+' 불명 뒤 codec cache로 영수증 발급·추가 next 0',async()=>{
 const msg=assistant('one','body'),f=fixture([msg,structuredClone(msg),init()]),reader=f.open();
 f.mode.fault=fault;const unknown={state:'UNKNOWN',receipts:[]};
 assert.deepEqual(await reader.next(f.signal),unknown);assert.equal(f.mode.held,f.charges[0]);assert.ok(f.mode.held>0);
 const reads=f.mode.reads;f.mode.fault='';assert.deepEqual(await reader.next(f.signal),unknown);
 assert.equal(f.mode.reads,reads);assert.equal(f.mode.nexts,1);assert.equal(f.mode.settled,0);assert.throws(()=>f.open());
});

for(const fault of ['missing-tail','changed-prefix','changed-parent'])test('init 확인 전 보호 원행 손상 '+fault+'이면 iterator 재진입 0',async()=>{
 const f=fixture([assistant('one','1'),assistant('two','2'),init()]),reader=f.open();
 await reader.next(f.signal);await reader.next(f.signal);
 if(fault==='missing-tail')f.rows.pop();
 else if(fault==='changed-prefix'){f.rows[0].snapshot.body='YQ==';f.rows[0].ref.contentHash=digest(f.rows[0].snapshot);}
 else{f.rows[1].snapshot.previousRef=ref();f.rows[1].ref.contentHash=digest(f.rows[1].snapshot);}
 assert.deepEqual(await reader.next(f.signal),{state:'UNKNOWN',receipts:[]});assert.equal(f.mode.nexts,2);
});

for(const fault of ['different-bytes','wrong-sid','missing-init','unsupported','oversize'])test('지원 또는 식별 경계 '+fault+'에서 재생성 0',async()=>{
 const second=fault==='different-bytes'?assistant('one','changed'):fault==='wrong-sid'?{...init(),session_id:'different'}:
  fault==='unsupported'?{type:'unknown'}:assistant('big','x'.repeat(2*1024*1024));
 const f=fixture([assistant('one','original'),...(fault==='missing-init'?[]:[second]),init()]);if(fault==='missing-init'){
  const absent=fixture([assistant('one','original')]),r=absent.open();await r.next(absent.signal);
  assert.deepEqual(await r.next(absent.signal),{state:'UNKNOWN',receipts:[]});assert.equal(absent.mode.nexts,2);return;
 }
 const r=f.open();await r.next(f.signal);assert.deepEqual(await r.next(f.signal),{state:'UNKNOWN',receipts:[]});
 assert.equal(f.rows.length,1);await r.next(f.signal);assert.equal(f.mode.nexts,2);
});

test('공동 풀의 마지막 최악 예약은 동시 원 iterator 하나만 허용한다',async()=>{
 const pool={used:252*1024*1024,held:0},a=fixture([init()],pool),b=fixture([init()],pool);
 const gate=Promise.withResolvers<void>(),entered=Promise.withResolvers<void>(),next=a.iterator.next.bind(a.iterator);
 a.iterator.next=async()=>{entered.resolve();await gate.promise;return next();};
 const ar=a.open(),br=b.open(),pending=ar.next(a.signal);await entered.promise;
 assert.ok(pool.held>3*1024*1024);assert.deepEqual(await br.next(b.signal),{state:'UNKNOWN',receipts:[]});
 assert.equal(b.mode.nexts,0);await assert.rejects(ar.next(a.signal),/BUSY/);
 gate.resolve();assert.equal((await pending).state,'SESSION_CONFIRMED');assert.equal(pool.held,0);
});

for(const fault of ['management','channel-bytes','channel-rows'])test('예약 부족 '+fault+'는 next 전 거절',async()=>{
 const f=fixture([init(),result(false)]),r=f.open();assert.equal((await r.next(f.signal)).state,'SESSION_CONFIRMED');
 if(fault==='management')f.mode.used=256*1024*1024-3*1024*1024-f.mode.overhead+1;
 if(fault==='channel-bytes'){f.mode.channelHeldBytes=63*1024*1024;f.mode.held=f.mode.channelHeldBytes;}
 if(fault==='channel-rows')f.mode.channelHeldRows=9998;
 assert.deepEqual(await r.next(f.signal),{state:'UNKNOWN',receipts:[]});assert.equal(f.mode.nexts,1);
});

for(const cause of ['abort','scope-lost','expired','clock-retreat'])test('대기 중 '+cause+' 후 늦은 원 출력은 추가 append·정산하지 않는다',async()=>{
 const f=fixture([init()]),gate=Promise.withResolvers<void>(),entered=Promise.withResolvers<void>(),next=f.iterator.next.bind(f.iterator);
 f.iterator.next=async()=>{entered.resolve();await gate.promise;return next();};const reader=f.open(),abort=new AbortController();
 const pending=reader.next(abort.signal);await entered.promise;
 if(cause==='abort')abort.abort();else if(cause==='scope-lost')f.mode.active=false;else if(cause==='expired')f.mode.now+=11000;else f.mode.now--;
 if(cause!=='abort')gate.resolve();assert.deepEqual(await pending,{state:'UNKNOWN',receipts:[]});gate.resolve();
 await new Promise<void>(resolve=>setImmediate(resolve));assert.deepEqual(f.rows,[]);assert.equal(f.mode.settled,0);assert.ok(f.mode.held>0);
 await reader.next(f.signal);assert.equal(f.mode.nexts,1);
});

test('원 owner 한 번 취득한 iterator를 소비자가 재취득하지 않는다',async()=>{
 const f=fixture([init()]);let acquisitions=0;
 f.origin.query[Symbol.asyncIterator]=()=>{acquisitions++;return f.iterator;};
 assert.equal(f.origin.query[Symbol.asyncIterator](),f.origin.iterator);
 const reader=f.open();assert.equal(acquisitions,1);assert.equal((await reader.next(f.signal)).state,'SESSION_CONFIRMED');
 assert.equal(acquisitions,1);
});

for(const hook of ['current','clock'] as const)test('생성자 '+hook+' 동기 재진입은 원 소비자를 하나만 허용한다',async()=>{
 const f=fixture([init(),assistant('one','body')]);let nested:NormalSdkSessionOutput|undefined,calls=0;
 const reenter=()=>{try{nested=f.open();}catch{}};
 if(hook==='current'){
  const current=f.ports.current;f.ports.current=()=>{if(++calls===1)reenter();return current();};
 }else{
  const clock=f.ports.clock;f.ports.clock=()=>{if(++calls===2)reenter();return clock();};
 }
 const owner=f.open();assert.equal(nested,undefined);
 assert.equal((await owner.next(f.signal)).state,'SESSION_CONFIRMED');assert.equal(f.mode.nexts,1);assert.throws(()=>f.open());
});
test('생성자 최초 clock 실패 뒤 같은 원 객체의 재구성을 거절한다',()=>{
 const f=fixture([init()]),clock=f.ports.clock;f.ports.clock=()=>{throw Error('clock unavailable');};
 assert.throws(()=>f.open());f.ports.clock=clock;assert.throws(()=>f.open());assert.equal(f.mode.nexts,0);
});
test('생성자 origin과 iterator.next 접근자는 호출하지 않는다',()=>{
 const f=fixture([init()]);let calls=0;
 const badOptions={...f.config,get origin(){calls++;return f.origin;}};
 assert.throws(()=>new NormalSdkSessionOutput(badOptions));assert.equal(calls,0);
 const next=f.iterator.next;
 Object.defineProperty(f.iterator,'next',{get(){calls++;return next;},configurable:true});
 assert.throws(()=>f.open());assert.equal(calls,0);
 Object.defineProperty(f.iterator,'next',{value:next,configurable:true});assert.throws(()=>f.open());assert.equal(f.mode.nexts,0);
});

test('출력 대기 중 최악 예약은 남고 저장 잠금은 반환된다',async()=>{
 const f=fixture([init()]),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const strict=f.ports.strictExclusive.bind(f.ports),next=f.iterator.next.bind(f.iterator);
 let locked=false;
 f.ports.strictExclusive=async(hold,body)=>{assert.equal(locked,false);locked=true;try{return await strict(hold,body);}finally{locked=false;}};
 f.iterator.next=async()=>{entered.resolve();await release.promise;return next();};
 const pending=f.open().next(f.signal);
 try{await entered.promise;assert.equal(locked,false);assert.ok(f.mode.held>0);}
 finally{release.resolve();await pending;}
});

test('잠금 밖 대기 중 중간행 변경은 행수와 tail이 같아도 정산·추가 읽기 없이 봉인한다',async()=>{
 const f=fixture([init(),assistant('late','output')]),gate=Promise.withResolvers<void>(),enter=Promise.withResolvers<void>();
 const take=f.iterator.next.bind(f.iterator);let n=0;
 f.iterator.next=async()=>{if(++n===2){enter.resolve();await gate.promise;}return take();};
 const reader=f.open();assert.equal((await reader.next(f.signal)).state,'SESSION_CONFIRMED');
 const tail=canonicalJson(f.rows[1]),settled=f.mode.settled,pending=reader.next(f.signal);
 await enter.promise;f.rows[0].snapshot.body='YQ==';f.rows[0].ref.contentHash=digest(f.rows[0].snapshot);
 gate.resolve();assert.equal((await pending).state,'UNKNOWN');assert.equal(f.rows.length,2);assert.equal(canonicalJson(f.rows[1]),tail);
 assert.equal(f.mode.settled,settled);assert.ok(f.mode.held>0);assert.equal((await reader.next(f.signal)).state,'UNKNOWN');assert.equal(n,2);
});

for(const phase of [1,2])for(const fault of ['body','hold','rows','tail','close'])test('출력 거래 '+phase+'의 '+fault+' 검산 실패는 원 예약을 유지한다',async()=>{
 const f=fixture([init()]),strict=f.ports.strictExclusive.bind(f.ports);let phaseNumber=0;
 f.ports.strictExclusive=async(hold,body)=>{
  if(++phaseNumber!==phase)return strict(hold,body);
  if(fault==='body')return{holdId:hold.id,tailRef:null,rows:0};
  const reply=await strict(hold,body);if(fault==='close')throw Error('unconfirmed close');
  if(fault==='hold')reply.holdId=randomUUID();else if(fault==='rows')reply.rows++;else reply.tailRef=ref();
  return reply;
 };
 const r=f.open();assert.equal((await r.next(f.signal)).state,'UNKNOWN');
 assert.equal(f.mode.nexts,phase-1);assert.equal(f.mode.settled,0);assert.ok(f.mode.held>0);
 assert.equal((await r.next(f.signal)).state,'UNKNOWN');assert.equal(f.mode.nexts,phase-1);
});

test('잠금 밖에서 받은 원문은 쓰기 거래 포트 호출 전에 고정한다',async()=>{
 const msg=assistant('original','원본'),f=fixture([msg]),r=f.ports.strictExclusive.bind(f.ports);
 const bytes=canonicalJson(msg);let n=0;
 f.ports.strictExclusive=(hold,body)=>{if(++n===2)msg.message.content[0]!.text='교체';return r(hold,body);};
 assert.equal((await f.open().next(f.signal)).state,'PENDING_SESSION');
 assert.equal(msg.message.content[0]!.text,'교체');assert.equal(Buffer.from(f.rows[0].snapshot.body,'base64').toString(),bytes);
});

test('거래 read 함수의 own.call은 변경된 중간행을 숨길 수 없다',async()=>{
 const f=fixture([init(),assistant('next','after')]),originalStrict=f.ports.strictExclusive.bind(f.ports),take=f.iterator.next.bind(f.iterator);
 let originalRow:any,corrupted=false,realReads=0,forgedReads=0;
 f.iterator.next=async()=>{if(originalRow){f.rows[0].snapshot.body='YQ==';corrupted=true;}return take();};
 f.ports.strictExclusive=(hold,body)=>originalStrict(hold,async(tx:any)=>{
  const read=tx.read;
  tx.read=Object.assign(async()=>{realReads++;return Reflect.apply(read,tx,[]);},{
   async call(){forgedReads++;const rows=await read();if(corrupted)rows[0]=structuredClone(originalRow);return rows;}
  });
  await body(tx);
 });
 const reader=f.open();assert.equal((await reader.next(f.signal)).state,'SESSION_CONFIRMED');originalRow=structuredClone(f.rows[0]);
 const prior=realReads;assert.equal((await reader.next(f.signal)).state,'UNKNOWN');
 assert(realReads>prior);assert.equal(forgedReads,0);assert.equal(f.rows.length,2);assert.equal(f.mode.settled,1);assert.ok(f.mode.held>0);
 assert.equal((await reader.next(f.signal)).state,'UNKNOWN');assert.equal(f.mode.nexts,2);
});

test('거래 append 함수의 own.call 대신 원 메서드가 원 tx로 실행된다',async()=>{
 const f=fixture([init()]),strict=f.ports.strictExclusive.bind(f.ports);let real=0,forged=0;
 f.ports.strictExclusive=(hold,body)=>strict(hold,async(tx:any)=>{
  const append=tx.appendAndSync;
  tx.appendAndSync=Object.assign(async function(this:unknown,value:unknown){assert.equal(this,tx);real++;return Reflect.apply(append,tx,[value]);},{
   async call(){forged++;}
  });
  await body(tx);
 });
 assert.equal((await f.open().next(f.signal)).state,'SESSION_CONFIRMED');assert.equal(real,2);assert.equal(forged,0);
});

for(const key of ['read','appendAndSync'])for(const kind of ['object','proxy'])test('거래의 비정규 메서드를 SDK 읽기 전 거절 '+key+' '+kind,async()=>{
 const f=fixture([init()]),strict=f.ports.strictExclusive.bind(f.ports);let calls=0;
 f.ports.strictExclusive=(hold,body)=>strict(hold,async(tx:any)=>{
  const original=tx[key];tx[key]=kind==='object'?{call(){calls++;return [];}}:new Proxy(original,{apply(){calls++;return [];}});
  await body(tx);
 });
 assert.equal((await f.open().next(f.signal)).state,'UNKNOWN');assert.equal(calls,0);assert.equal(f.mode.nexts,0);
 assert.equal(f.mode.settled,0);assert.ok(f.mode.held>0);
});

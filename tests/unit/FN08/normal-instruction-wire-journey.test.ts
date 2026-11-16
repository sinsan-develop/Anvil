import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {normalInstructionDurableFixture} from './normal-instruction-dispatch-fixture.ts';

test('원 서버 SEND 수신/permit 뒤 명시 driver는 내구 dispatch 선기록과 원 지시를 한 번 소비한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  await f.receive();const coordinator=f.make(),prepared=await coordinator.prepare(f.item.envelope,f.signal),original=await f.intake.instruction(f.item.envelope);
  const responseRef={id:randomUUID(),version:1,contentHash:'a'.repeat(64)};let calls=0;
  const wire=new NormalInstructionWire({driver:{async send(input:any,signal:AbortSignal){calls++;assert.equal(signal.aborted,false);
   const rows=[...f.fs.files.entries()].filter(([p])=>p.includes('attempt-'+f.item.envelope.commandId)&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>JSON.parse(v.bytes.toString()));
   assert.deepEqual(rows.map(r=>r.snapshot.state),['SEND_ATTEMPTED','PERMIT_RECORDED','SEND_DISPATCH_ATTEMPTED']);
   assert.deepEqual(input.localAttemptRef,rows[0].ref);assert.deepEqual(input.dispatchAttemptRef,rows[2].ref);assert.deepEqual(input.permit,prepared.permit);assert.deepEqual(input.proofResultRef,prepared.proofResultRef);
   assert.deepEqual(input.envelope,f.item.envelope);assert.deepEqual(Buffer.from(input.instruction.bytes),Buffer.from(original.bytes));assert.equal(input.instruction.text,original.text);
   assert.equal(input.executionAuthorized,false);assert.equal(input.actualExecutionVerified,false);
   return{transport:'NORMAL_PROTECTED',responseRef,processRef:null};}}});
  const result=await coordinator.dispatch(f.item.envelope,prepared,wire,f.signal);assert.equal(result.state,'RESPONSE_RECORDED');assert.deepEqual(result.responseRef,responseRef);assert.equal(result.processRef,null);assert.equal(result.actualExecutionVerified,false);assert.equal(result.dispatchPerformed,false);assert.equal(calls,1);
  const before=f.calls.length;await assert.rejects(coordinator.dispatch(f.item.envelope,prepared,wire,f.signal),/ELIGIBLE/);
  const restarted=f.make(),history=await restarted.prepare(f.item.envelope,f.signal);assert.deepEqual(history,prepared);
  await assert.rejects(restarted.dispatch(f.item.envelope,history,wire,f.signal),/ELIGIBLE/);assert.equal(calls,1);assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,1);
 }finally{await f.h.close();}
});

test('첫 SEND 4행 뒤 strict close 불명은 정착한 init만 보존한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');const f=await firstSendFixture();
 try{
  let uncertain=false;const open=f.fs.fs.open.bind(f.fs.fs);
  f.fs.fs.open=async(path:string,flags:any)=>{const file=await open(path,flags);
   if(flags==='wx'&&path.endsWith('attempt-'+f.item.envelope.commandId+'.lock')){
    const close=file.close.bind(file);file.close=async()=>{await close();if(!uncertain&&f.effects.rows.some(v=>v.snapshot.state==='SESSION_INIT_CONFIRMED')){
     uncertain=true;throw Error('RAM_DISPATCH_CLOSE_UNKNOWN');}};
   }return file;
  };
  const out=await f.run();assert.equal(uncertain,true);assert.equal(out.state,'UNKNOWN');assert.equal(out.cursor.afterSequence,0);
  assert.equal(f.effects.rows.at(-1)?.snapshot.state,'SESSION_INIT_CONFIRMED');assert.equal(f.effects.close,1);
  assert([...f.fs.files.keys()].some(p=>p.endsWith('attempt-'+f.item.envelope.commandId+'.lock')));
  assert.equal((await f.run()).state,'UNKNOWN');assert.equal(f.effects.create,1);
 }finally{await f.h.close();}
});

test('같은 READY에 경쟁하는 두 SEND의 단발 permit은 Query 하나만 생성한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await firstSendFixture();
 try{
  const q=f.h.q,request=q.request;request.commandId=randomUUID();
  const response=await f.h.app.inject({method:'POST',url:'/api/v1/projects/'+f.h.f.pid+'/commands',
   headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.h.f.token,'x-anvil-csrf':f.h.f.csrf},payload:request});
  assert.equal(response.statusCode,200,response.body);
  const page=await f.get.send(await f.get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal);
  const item=page.items.find(v=>v.envelope.commandId===request.commandId);assert.ok(item?.materials&&item.envelope.operation==='SEND_INSTRUCTION');
  const {receiveNormalInstruction}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
  await receiveNormalInstruction(f.get,f.intake,item,page.proofResultRef,f.signal);const competing=f.make(),permit=await competing.prepare(item.envelope,f.signal);
  const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
  const wire=NormalInstructionWire.forFirstSend(f.worker,f.source);let other='';
  f.hooks.inCreate=async()=>{other=(await competing.dispatch(item.envelope,permit,wire,f.signal)).state;};
  const outcome=await f.run();
  assert.equal(other,'UNKNOWN');assert.equal(f.h.permits.length,2);assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
  assert.equal((await f.make().history(f.item,f.signal)).state,'FIRST_SEND_INPUT_AND_INIT_RECORDED');
  assert.equal(outcome.state,'UNKNOWN');assert.equal(outcome.cursor.afterSequence,0);
 }finally{f.authority.abort();await f.h.close();}
});

test('마지막 SEND close 대기 중 원 호출 취소는 보유 Query를 닫고 cursor를 보존한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts'),f=await firstSendFixture();
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();const abort=new AbortController();
 try{
  const open=f.fs.fs.open.bind(f.fs.fs);f.fs.fs.open=async(path:string,flags:any)=>{
   const file=await open(path,flags);if(flags==='wx'&&path.endsWith('attempt-'+f.item.envelope.commandId+'.lock')){
    const close=file.close.bind(file);file.close=async()=>{if(f.effects.rows.at(-1)?.snapshot.state==='SESSION_INIT_CONFIRMED'){entered.resolve();await release.promise;}await close();};
   }return file;
  };
  const {NormalStartPolling}=await import('../../../apps/connector/runtime/normal-start-polling.ts');
  const pending=new NormalStartPolling(f.options()).run(abort.signal);await entered.promise;
  abort.abort();await new Promise(resolve=>setImmediate(resolve));
  const closed=f.effects.close;release.resolve();const result=await pending;
  assert.equal(closed,1);assert.equal(result.state,'UNKNOWN');assert.equal(result.cursor.afterSequence,0);assert.equal(f.effects.create,1);
 }finally{release.resolve();f.authority.abort();await f.h.close();}
});

for(const fault of ['missing-port','no-pull','reacquire','late-error','tampered-parent','parent-five','changed-first-ref','three-body','three-sync','three-close','four-body','four-readback','four-close','lost-current','expired'] as const)test('후속 SEND의 원 부모와 엄격한 정착 실패 '+fault,async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {prepareLiveFollowup}=await import('./normal-instruction-dispatch-fixture.ts');
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 let calls=0,yields=0;
 const port={async provide(_q:unknown,iter:AsyncIterable<unknown>){
  calls++;if(fault==='no-pull')return;const iterator=iter[Symbol.asyncIterator](),one=await iterator.next();assert.equal(one.done,false);yields++;
  if(fault==='reacquire'){assert.throws(()=>iter[Symbol.asyncIterator]());return;}
  if(fault==='lost-current')f.effects.current=false;
  if(fault==='expired')f.mode.wall+=31000;
  if(fault==='late-error')throw Error('RAM_INPUT_RETURN_LOST');
 }};
 const f=await firstSendFixture('yield-first',fault==='missing-port'?undefined:port);
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const base=f.store.instructionAttempts();let delivered=false,afterYieldReads=0;
  const store={...base,async exclusive<T>(key:any,body:any):Promise<T>{
   if(armed&&key.commandId!==f.item.envelope.commandId&&(fault==='three-body'||fault==='four-body'&&yields>0&&++afterYieldReads===3))return undefined as T;
   return base.exclusive(key,async tx=>{
    const wrapped={...tx,read:async()=>{
     const rows=await tx.read();if(fault==='four-readback'&&delivered)return rows.slice(0,-1);return rows;
    },appendAndSync:async(row:any)=>{
     if(fault==='three-sync'&&row.snapshot.state==='SEND_DISPATCH_ATTEMPTED')throw Error('RAM_SYNC');
     await tx.appendAndSync(row);if(row.snapshot.state==='LIVE_SEND_INPUT_YIELDED')delivered=true;
    }};
    return body(wrapped);
   });
  }};
  let armed=false;
  const {item,c,prepared}=await prepareLiveFollowup(f,'두 번째 본문',{store});armed=true;
  const id=f.item.envelope.commandId,at=(n:number)=>f.fs.path('attempt-'+id+'.'+String(n).padStart(6,'0')+'.json');
  if(fault==='tampered-parent')f.fs.files.get(at(2))!.bytes=Buffer.from('{}');
  if(fault==='changed-first-ref'){const file=f.fs.files.get(at(4))!,row=JSON.parse(file.bytes.toString());row.ref.id=randomUUID();file.bytes=Buffer.from(canonicalJson(row)+'\n');}
  if(fault==='parent-five'){
   const prev=JSON.parse(f.fs.files.get(at(4))!.bytes.toString()),base=JSON.parse(f.fs.files.get(at(3))!.bytes.toString());
   const snapshot={...base.snapshot,sequence:5,state:'UNKNOWN',dispatchAttemptRef:base.ref,previousRef:prev.ref,recordedAt:prev.snapshot.recordedAt};
   const row={ref:{id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};
   f.fs.files.set(at(5),{bytes:Buffer.from(canonicalJson(row)+'\n'),ino:90000,link:false});
  }
  if(fault==='three-close'||fault==='four-close'){
   const n=fault==='three-close'?3:4,open=f.fs.fs.open;
   f.fs.fs.open=async(path:string,flag:any)=>{const file=await open(path,flag);
    if(path.endsWith('attempt-'+item.envelope.commandId+'.lock')&&flag==='wx'){
     const close=file.close;file.close=async()=>{await close();if(f.fs.files.has(f.fs.path('attempt-'+item.envelope.commandId+'.00000'+n+'.json')))throw Error('RAM_CLOSE_UNKNOWN');};
    }return file;
   };
  }
  await assert.rejects(c.dispatch(item.envelope,prepared,f.wire,f.signal));
  const expectYield=['reacquire','late-error','four-body','four-readback','four-close','lost-current','expired'].some(x=>x===fault);
  assert.equal(yields,Number(expectYield));assert.equal(calls,Number(expectYield||fault==='no-pull'));
  assert.equal(f.effects.create,1);assert.equal(f.effects.iterate,1);
  await assert.rejects(c.dispatch(item.envelope,prepared,f.wire,f.signal));assert.equal(yields,Number(expectYield));
 }finally{f.authority.abort();await f.h.close();}
});

test('기존 strict 저장소의 선택형 close 메서드 없이 빈 행 RESPONSE UNKNOWN 이력을 재생한다',async()=>{
 const {normalInstructionWireFixture}=await import('./normal-instruction-dispatch-fixture.ts'),f=await normalInstructionWireFixture();
 try{
  await f.c.dispatch(f.item.envelope,f.prepared,f.wire,f.signal);
  const store=f.store.instructionAttempts(),history=f.make({store:{...store,exclusive:(key:any,body:any)=>store.exclusive(key,tx=>body({read:()=>tx.read(),appendAndSync:(v:unknown)=>tx.appendAndSync(v)}))}});
  assert.equal((await history.history(f.item,f.signal)).state,'RESPONSE_RECORDED');
  const files=f.fs.files,paths=[...files.keys()].filter(p=>p.includes('attempt-'+f.item.envelope.commandId)&&p.endsWith('.json')).sort();
  const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
  const row=JSON.parse(files.get(paths[3]!)!.bytes.toString());row.snapshot.state='UNKNOWN';row.snapshot.responseRef=null;row.snapshot.processRef=null;row.ref.contentHash=contentHash(canonicalJson(row.snapshot));files.get(paths[3]!)!.bytes=Buffer.from(canonicalJson(row)+'\n');
  assert.equal((await history.history(f.item,f.signal)).state,'UNKNOWN');for(const p of paths)files.delete(p);
  assert.equal((await history.history(f.item,f.signal)).state,'NOT_PREPARED');
 }finally{await f.h.close();}
});

test('후속 4행 정상 close 이후 commit 직전 취소는 현재와 역사의 입력 제공 사실을 보존한다',async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts');
 const {prepareLiveFollowup}=await import('./normal-instruction-dispatch-fixture.ts');
 let count=0,closed=false,queued=false;const abort=new AbortController();
 const f=await firstSendFixture('yield-first',{async provide(_query,iter){for await(const _ of iter)count++;}});
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const base=f.store.instructionAttempts();const store={...base,async exclusive<T>(key:any,body:any):Promise<T>{
   let wrote=false;const r=await base.exclusive<T>(key,tx=>body({...tx,appendAndSync:async(v:any)=>{await tx.appendAndSync(v);if(v.snapshot.state==='LIVE_SEND_INPUT_YIELDED')wrote=true;}}));
   if(wrote){closed=true;queueMicrotask(()=>{queued=true;abort.abort();});}return r;
  }};
  const {item,c,prepared}=await prepareLiveFollowup(f,'종료 후 동기 취소',{store});
  const result=await c.dispatch(item.envelope,prepared,f.wire,abort.signal);assert.equal(result.state,'LIVE_SEND_INPUT_YIELDED');assert.ok(closed&&queued&&abort.signal.aborted);assert.equal(count,1);
  const rows=[...f.fs.files.entries()].filter(([p])=>p.includes('attempt-'+item.envelope.commandId)&&p.endsWith('.json')).sort().map(([,v])=>JSON.parse(v.bytes.toString()).snapshot.state);
  assert.deepEqual(rows.slice(3),['LIVE_SEND_INPUT_YIELDED']);assert.equal((await f.make().history(item,f.signal)).state,result.state);
  const replay=await f.run();assert.equal(replay.state,'LIMIT_REACHED');assert.equal(count,1);
 }finally{f.authority.abort();await f.h.close();}
});

for(const phase of ['close-stop','close-abort','lstat-abort'] as const)test('후속 최종 lock 보호 대기 중 상실은 원 lock을 보존한다 '+phase,async()=>{
 const {liveStopFixture}=await import('../FN07/normal-first-send-owner.test.ts'),{prepareLiveFollowup}=await import('./normal-instruction-dispatch-fixture.ts');
 const {requestNormalLiveStop}=await import('../../../apps/connector/runtime/normal-first-send-owner.ts');
 const f=await liveStopFixture({async provide(_query,input){for await(const _ of input)yields++;}}),abort=new AbortController();let yields=0,inside=false;
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');const {item,c,prepared}=await prepareLiveFollowup(f,'정상 닫힘의 보호');
  const prefix='attempt-'+item.envelope.commandId,lock=f.fs.path(prefix+'.lock'),last=f.fs.path(prefix+'.000004.json'),open=f.fs.fs.open,lstat=f.fs.fs.lstat;
  const event=async()=>{inside=true;if(phase==='close-stop')await requestNormalLiveStop(f.worker,f.stopItem,f.original,f.stop.store,f.signal,()=>{});else abort.abort();};
  let inClose=false;f.fs.fs.open=async(p:string,flag:any)=>{const file=await open(p,flag);
   if(p===lock&&flag==='wx'){const close=file.close;file.close=async()=>{if(f.fs.files.has(last)){inClose=true;if(phase!=='lstat-abort')await event();}await close();};}return file;};
  f.fs.fs.lstat=async(p:string)=>{const st=await lstat(p);if(!inside&&inClose&&p===lock&&phase==='lstat-abort')await event();return st;};
  await assert.rejects(c.dispatch(item.envelope,prepared,f.wire,abort.signal));assert.ok(inside);assert.equal(yields,1);assert.ok(f.fs.files.has(lock));
  assert.equal(f.stopCalls.interrupt,phase==='close-stop'?1:0);await assert.rejects(f.make().history(item,f.signal));assert.equal((await f.run()).cursor.afterSequence,0);assert.equal(yields,1);
 }finally{f.authority.abort();await f.h.close();}
});

for(const fault of ['no-sync-port','changed-sync-port','throw-sync-release','no-final','early-final','twice-final'] as const)test('LIVE 종료 증표와 동기 해제 원함수 검산 '+fault,async()=>{
 const {firstSendFixture}=await import('../FN07/normal-first-send-owner.test.ts'),{prepareLiveFollowup}=await import('./normal-instruction-dispatch-fixture.ts');
 let yields=0,foreign=0;const f=await firstSendFixture('yield-first',{async provide(_query,input){for await(const _ of input)yields++;}});
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');
  const base=f.store.instructionAttempts();
  const store={...base,exclusive:<T>(key:any,body:any)=>base.exclusive<T>(key,tx=>body({...tx,requireLiveInputClose:(k:any,guard:()=>void)=>{
   if(fault==='early-final'){assert.throws(guard);tx.requireLiveInputClose!(k,guard);}
   else if(fault==='no-final')return;
   else if(fault==='twice-final')tx.requireLiveInputClose!(k,()=>{guard();guard();});
   else tx.requireLiveInputClose!(k,guard);
  }}))};
  const {item,c,prepared}=await prepareLiveFollowup(f,'원 해제 함수',{store});
  const id=item.envelope.commandId,last=f.fs.path('attempt-'+id+'.000004.json'),lock=f.fs.path('attempt-'+id+'.lock');
  if(fault==='no-sync-port')delete f.fs.fs.unlinkSync;
  if(fault==='changed-sync-port'){
   const open=f.fs.fs.open;f.fs.fs.open=async(p:string,flags:any)=>{const file=await open(p,flags);
    if(p===lock&&flags==='wx'){const close=file.close;file.close=async()=>{await close();if(f.fs.files.has(last))f.fs.fs.unlinkSync=()=>{foreign++;};};}return file;
   };
  }
  if(fault==='throw-sync-release'){const del=f.fs.files.delete.bind(f.fs.files);f.fs.files.delete=p=>{if(p===lock&&f.fs.files.has(last))throw Error('RAM_SYNC_RELEASE');return del(p);};}
  await assert.rejects(c.dispatch(item.envelope,prepared,f.wire,f.signal));
  assert.equal(yields,1);assert.equal(foreign,0);
  if(fault==='no-sync-port')assert.equal(f.fs.files.has(last),false);
  else{assert.ok(f.fs.files.has(lock));await assert.rejects(f.make().history(item,f.signal));}
 }finally{f.authority.abort();await f.h.close();}
});

for(const variant of ['row-proxy','snapshot-proxy','pending','rejected','thenable','proxy-result','late-release'] as const)test('LIVE 파일 경계의 원행과 동기 종료 결과 '+variant,async()=>{
 const {NormalStartFileStore}=await import('../../../apps/connector/runtime/normal-start-file-store.ts');
 const {root,scope,memoryFiles}=await import('./normal-start-local-fixture.ts'),mem=memoryFiles(),key={...scope,commandId:randomUUID()};
 const lock=mem.path('attempt-'+key.commandId+'.lock'),last=mem.path('attempt-'+key.commandId+'.000004.json'),held=Promise.withResolvers<void>();
 let calls=0,checks=0,traps=0;const proxy={ownKeys(target:object){traps++;return Reflect.ownKeys(target);}};
 mem.fs.unlinkSync=function(path:string){
  assert.equal(path,lock);calls++;
  if(variant==='pending')return held.promise;
  if(variant==='rejected')return Promise.reject(Error('RAM_RELEASE_REJECTED'));
  if(variant==='thenable')return{get then(){traps++;throw Error('RAM_THENABLE_GETTER');}};
  if(variant==='proxy-result')return new Proxy({get then(){traps++;throw Error('RAM_PROXY_GETTER');}},proxy);
  if(variant==='late-release')return held.promise.then(()=>{mem.files.delete(path);});
  assert.ok(mem.files.delete(path));
 };

 const store=new NormalStartFileStore(root,scope,mem.fs);
 await store.instructionAttempts().exclusive(key,async tx=>{await tx.read();for(let i=1;i<=3;i++)await tx.appendAndSync({snapshot:{sequence:i,state:'RAM_PREFIX'}});});
 const snapshot={sequence:4,state:'LIVE_SEND_INPUT_YIELDED'},whole={snapshot};
 const row=variant==='row-proxy'?new Proxy(whole,proxy):variant==='snapshot-proxy'?{snapshot:new Proxy(snapshot,proxy)}:whole;
 try{
  await assert.rejects(store.instructionAttempts().exclusive(key,async tx=>{
   await tx.read();if(!variant.endsWith('proxy'))tx.requireLiveInputClose!(key,()=>{checks++;});await tx.appendAndSync(row);await tx.read();
  }));
  assert.equal(traps,0);assert.ok(mem.files.has(lock));
  if(variant.endsWith('proxy')){assert.equal(mem.files.has(last),false);assert.equal(calls,0);}
  else{assert.ok(mem.files.has(last));assert.equal(calls,1);assert.equal(checks,1);}
 }finally{held.resolve();}
 if(variant==='late-release'){await Promise.resolve();assert.equal(mem.files.has(lock),false);assert.equal(calls,1);}
});

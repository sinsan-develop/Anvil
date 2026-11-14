import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedExecution} from './normal-start-execution-fixture.ts';
import {NormalStartCoordinator} from '../../../apps/connector/runtime/normal-start-coordinator.ts';
const mod:any=await import('../../../apps/connector/adapters/secondary/normal-start-wire.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('원 START 자료→normal Claude adapter→명시 합성 driver 관측, 재시작 wire0',async()=>{
 assert.equal(typeof mod.NormalClaudeStartWire,'function');
 const f=await preparedExecution();try{
  let calls=0,observed:any;
  const driver={async send(v:any){calls++;observed=v;
   const records=[...f.fs.files].filter(([p])=>p.includes('attempt-')&&!p.endsWith('.lock')).map(([,r])=>JSON.parse(r.bytes.toString()));
   assert.deepEqual(records.map(r=>r.snapshot.state),['START_ATTEMPTED','PERMIT_RECORDED']);
   assert.deepEqual(v.localAttemptRef,records[0].ref);assert.deepEqual(v.permit,records[1].snapshot.permit);
   assert.deepEqual(f.q.permits[0].snapshot_json.request.localAttemptRef,records[0].ref);
   return{transport:'NORMAL_PROTECTED',responseRef:f.grantRef,processRef:null};}};
  const wire=new mod.NormalClaudeStartWire({intake:f.intake,current:f.startPorts().current,grantRef:f.grantRef,driver,clock:f.clock,timeoutMs:1000});
  const ports={...f.startPorts(),post:f.post,wire};const out=await new NormalStartCoordinator(ports).start(f.e,f.signal);
  assert.equal(out.state,'RESPONSE_RECORDED');assert.equal(out.agentSuccessVerified,false);assert.equal(calls,1);
  assert.deepEqual(observed.params,JSON.parse(f.h.f.preparation.data.snapshot.options.body).claudeQueryParams);
  assert.deepEqual(observed.contextBundle.bytes,(await f.intake.startMaterials(f.e)).contextBundle.bytes);
  assert.deepEqual(observed.envelope,f.e);assert.equal(observed.permit.envelopeHash,f.e.envelopeHash);
  assert.equal(observed.actualExecutionVerified,false);assert.equal(observed.executionAuthorized,false);
  assert.equal((await new NormalStartCoordinator(ports).start(f.e,f.signal)).state,'RESPONSE_RECORDED');assert.equal(calls,1);
 }finally{await f.h.app.close();}
});

test('원자료·permit·attempt/current·기한·취소 불일치는 합성 driver 호출0',async()=>{
 for(const kind of ['options','context','permit','attempt','expired','abort','provider']){
  const f=await preparedExecution();try{
   let calls=0,expectedAttempt:any,reason='';const current=f.startPorts().current;
   const checked={transport:'NORMAL_PROTECTED',async current(e:any,a:any,s:AbortSignal){
    const out=await current.current(e,a,s);return kind==='attempt'?{...out,localAttemptRef:expectedAttempt}:out;
   }};
   const driver={async send(){calls++;return{transport:'NORMAL_PROTECTED',responseRef:f.grantRef,processRef:null};}};
   if(kind==='provider')assert.throws(()=>new mod.NormalClaudeStartWire({intake:f.intake,current:checked,grantRef:f.grantRef,driver:null,clock:f.clock,timeoutMs:1000}),/PORTS_REQUIRED/);
   const adapter=new mod.NormalClaudeStartWire({intake:f.intake,current:checked,grantRef:f.grantRef,driver,clock:f.clock,timeoutMs:1000});
   const wire={transport:'NORMAL_PROTECTED' as const,async send(v:any,s:AbortSignal){expectedAttempt=structuredClone(v.localAttemptRef);
    if(kind==='options')v.options.bytes[0]^=1;
    if(kind==='context')v.contextBundle.bytes[0]^=1;
    if(kind==='permit')v.permit.commandId=f.grantRef.id;
    if(kind==='attempt')v.localAttemptRef=f.grantRef;
    if(kind==='expired')f.h.store.mode.offset+=30001;
    if(kind==='abort'){const c=new AbortController();c.abort();s=c.signal;}
    if(kind==='provider')throw Error('공급자 없음');
    try{return await adapter.send(v,s);}catch(e){reason=String(e);throw e;}
   }};
   const ports={...f.startPorts(),post:f.post,wire};
   assert.equal((await new NormalStartCoordinator(ports).start(f.e,f.signal)).state,'UNKNOWN',kind);assert.equal(calls,0,kind);
   if(kind==='attempt')assert.match(reason,/CURRENT_INVALID/);
   if(kind==='context'||kind==='options')assert.match(reason,/MATERIAL_CHANGED/);
   assert.equal((await new NormalStartCoordinator(ports).start(f.e,f.signal)).state,'UNKNOWN');assert.equal(calls,0);
  }finally{await f.h.app.close();}
 }
});

test('driver throw/잘못된 관측/late timeout UNKNOWN 뒤 동일 adapter·새 coordinator 재호출0',async()=>{
 for(const kind of ['throw','malformed','late']){
  const f=await preparedExecution();try{
   let calls=0,release=()=>{},captured:any;
   const driver={async send(){calls++;if(kind==='throw')throw Error('응답 유실');if(kind==='malformed')return{};
    await new Promise<void>(ok=>release=ok);return{transport:'NORMAL_PROTECTED',responseRef:f.grantRef,processRef:null};}};
   const adapter=new mod.NormalClaudeStartWire({intake:f.intake,current:f.startPorts().current,grantRef:f.grantRef,driver,clock:f.clock,timeoutMs:kind==='late'?100:1000});
   const wire={transport:'NORMAL_PROTECTED' as const,async send(v:any,s:AbortSignal){captured=structuredClone(v);return adapter.send(v,s);}};
   const ports={...f.startPorts(),post:f.post,wire};
   assert.equal((await new NormalStartCoordinator(ports).start(f.e,f.signal)).state,'UNKNOWN');assert.equal(calls,1);
   release();await new Promise(ok=>setImmediate(ok));await assert.rejects(adapter.send(captured,f.signal),/UNKNOWN/);assert.equal(calls,1);
   assert.equal((await new NormalStartCoordinator(ports).start(f.e,f.signal)).state,'UNKNOWN');assert.equal(calls,1);
  }finally{await f.h.app.close();}
 }
});

test('동시 동일attempt 거절은 진행중 driver를 파괴하지 않고 입력 buffer를 소유하지 않는다',async()=>{
 const f=await preparedExecution();try{
  let calls=0,release=()=>{},entered=()=>{},captured:any;const ready=new Promise<void>(ok=>entered=ok);
  const driver={async send(v:any){calls++;v.options.bytes.fill(0);entered();await new Promise<void>(ok=>release=ok);return{transport:'NORMAL_PROTECTED',responseRef:f.grantRef,processRef:null};}};
  const adapter=new mod.NormalClaudeStartWire({intake:f.intake,current:f.startPorts().current,grantRef:f.grantRef,driver,clock:f.clock,timeoutMs:1000});
  const wire={transport:'NORMAL_PROTECTED' as const,async send(v:any,s:AbortSignal){captured=v;return adapter.send(v,s);}};
  const ports={...f.startPorts(),post:f.post,wire},pending=new NormalStartCoordinator(ports).start(f.e,f.signal);await ready;
  await assert.rejects(adapter.send(captured,f.signal),/BUSY/);release();assert.equal((await pending).state,'RESPONSE_RECORDED');assert.equal(calls,1);
  assert.equal(Buffer.from(captured.options.bytes).toString(),f.h.f.preparation.data.snapshot.options.body);
  await assert.rejects(adapter.send(captured,f.signal),/ALREADY_ATTEMPTED/);assert.equal(calls,1);
 }finally{await f.h.app.close();}
});

test('최신 current의 더 짧은 기한이 driver signal/timer를 줄이고 늦은 응답은 UNKNOWN이다',async()=>{
 const f=await preparedExecution();try{
  const current=f.startPorts().current;let reached=()=>{},cancelled=()=>{},release=()=>{},captured:any;
  const ready=new Promise<void>(ok=>reached=ok),stopped=new Promise<void>(ok=>cancelled=ok);
  const shorter={transport:'NORMAL_PROTECTED',async current(e:any,a:any,s:AbortSignal){return{...await current.current(e,a,s),expiresAt:new Date(f.clock()+30).toISOString()};}};
  const driver={async send(_v:any,s:AbortSignal){s.addEventListener('abort',cancelled,{once:true});reached();await new Promise<void>(ok=>release=ok);return{transport:'NORMAL_PROTECTED',responseRef:f.grantRef,processRef:null};}};
  const adapter=new mod.NormalClaudeStartWire({intake:f.intake,current:shorter,grantRef:f.grantRef,driver,clock:f.clock,timeoutMs:1000});
  const wire={transport:'NORMAL_PROTECTED' as const,async send(v:any,s:AbortSignal){captured=v;return adapter.send(v,s);}};
  const pending=new NormalStartCoordinator({...f.startPorts(),post:f.post,wire}).start(f.e,f.signal);await ready;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const result=await Promise.race([stopped.then(()=>true),new Promise<boolean>(ok=>timeout=setTimeout(()=>ok(false),150))]);
  if(timeout)clearTimeout(timeout);release();const out=await pending;
  assert.equal(result,true,'driver signal은 1000ms가 아니라 현재성 30ms 기한에 취소되어야 한다');
  assert.equal(out.state,'UNKNOWN');await assert.rejects(adapter.send(captured,f.signal),/UNKNOWN/);
 }finally{await f.h.app.close();}
});

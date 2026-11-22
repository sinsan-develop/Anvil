'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
let fixtures;
test.before(async()=>{
 const file=require.resolve('./desktop-trust-registration.test.cjs'),m=new Module(file,module),before=[];
 const register=()=>{};register.before=fn=>before.push(fn);const original=Module.createRequire(file);
 m.filename=file;m.paths=module.paths;m.require=name=>name==='node:test'?register:original(name);
 m._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports={liveNativeOwner,capture(){nativeRuntime={...nativeRuntime,createOwnedSpoolController:host=>({open:host.open})};}};',file);
 assert.equal(before.length,1);await before[0]();fixtures=m.exports;fixtures.capture();
});
const id=n=>'ce140001-0000-4000-8000-'+String(n).padStart(12,'0'),ref=n=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const resultConfiguration={mode:'NORMAL_PROTECTED',purpose:'FN09_DISCOVERY_METADATA'};
async function scenario(configuration=resultConfiguration){
 const f=await fixtures.liveNativeOwner(),row=f.stored(),calls=[],spawn=f.ports.spawn;
 const scope={projectId:row.projectId,connectorId:row.registration.connectorRef.id,executionId:id(1),executionGeneration:1,grantRef:ref(2),credentialGeneration:1};
 const config={origin:row.origin,ca:'TEST_ONLY_EXPLICIT_CA',scope},expiresAt=new Date(f.dependencies.now()+5000).toISOString();
 const slot={slotId:id(3),receiptRef:ref(4),origin:row.origin,scope,expiresAt,caHash:contentHash(config.ca)};
 const body=canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:{fixture:'TEST_ONLY_METADATA'}});
 const binding={attemptId:row.attemptId,slotId:slot.slotId,requestRef:ref(7),acquisitionRef:ref(8),bodyHash:contentHash(body)};
 const auth=Buffer.from(canonicalJson({schemaVersion:1,challengeRef:ref(9),proof:{method:'POST',path:'/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/understanding-response-read/'+binding.requestRef.id+'/result',queryHash:contentHash('{}'),bodyHash:binding.bodyHash,requestId:id(10),grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:Buffer.alloc(32).toString('base64url')},signature:Buffer.alloc(64).toString('base64url')})).toString('base64url');
 const prepared={state:'NATIVE_DISCOVERY_RESULT_PREPARED',requestRef:binding.requestRef,acquisitionRef:binding.acquisitionRef,preparedHash:'b'.repeat(64),auth,expiresAt};
 let closeMode='OK',pending=null;
 f.ports.spawn=(...args)=>{const child=spawn(...args),write=child.stdin.write,end=child.stdin.end;
  child.stdin.write=(raw,encoding,done)=>{const v=JSON.parse(Buffer.from(raw).toString());if(!/^(NORMAL_EXECUTION_|NORMAL_SPOOL_)/.test(v.operation))return write(raw,encoding,done);
   calls.push(v);const answer=()=>{let data={state:'OK'};
    if(v.operation==='NORMAL_SPOOL_CLOSE')data={state:'CLOSED_CONFIRMED',understanding:{state:'NATIVE_METADATA_CLOSED',requestRef:binding.requestRef,acquisitionRef:binding.acquisitionRef,bodyHash:binding.bodyHash}};
    if(v.operation==='NORMAL_EXECUTION_UNDERSTANDING_RESULT_PREPARE')data=prepared;
    if(v.operation==='NORMAL_EXECUTION_BEGIN')data={handle:id(20)};
    if(v.operation==='NORMAL_EXECUTION_WRITE')data={handle:id(20),offset:v.payload.offset+Buffer.from(v.payload.bytes,'base64url').length};
    child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:v.requestId,sequence:v.sequence,rootIdentity:'TEST_ONLY_ROOT',data})+'\n'));done();};
   if(closeMode==='HOLD')pending=answer;else queueMicrotask(answer);return true;
  };
  child.stdin.end=(...a)=>closeMode==='UNKNOWN'?queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);}):end(...a);return child;
 };
 const api=f.owner.createProfileExecutionClients(config,configuration===null?undefined:configuration),signal=new AbortController();
 return {f,calls,api,signal,slot,binding,prepared,body,config,mode(v){closeMode=v;},release(){pending();},async closedHost(){const h=await api.open(signal.signal,slot);await h.send('NORMAL_SPOOL_CLOSE',{writer:'NORMAL_EXECUTION',attemptId:row.attemptId,slotId:slot.slotId,allocation:id(21),understanding:{requestRef:binding.requestRef,acquisitionRef:binding.acquisitionRef,bodyHash:binding.bodyHash}});return h;}};
}

test('기본 NORMAL 어댑터는 원 metadata CLOSE/physical close를 유지하고 named 준비·전송을 노출하지 않는다',async()=>{
 const x=await scenario(null),h=await x.closedHost();
 assert.equal(Object.hasOwn(h,'prepareUnderstandingResult'),false);assert.equal(Object.hasOwn(h,'sendUnderstandingResult'),false);
 assert.equal(h.prepareUnderstandingResult,undefined);assert.equal(h.sendUnderstandingResult,undefined);
 assert.equal((await h.close('HOST_REQUEST_VALIDATED')).state,'CLOSED_CONFIRMED');
 assert.equal(x.calls.length,1);assert.equal(x.calls[0].operation,'NORMAL_SPOOL_CLOSE');assert.equal(x.f.owner.isBusy(),false);assert.equal(x.f.timers(),0);
 const next=await x.api.open(x.signal.signal,x.slot);assert.equal(next.prepareUnderstandingResult,undefined);assert.equal(next.sendUnderstandingResult,undefined);
 await next.close();assert.equal(x.calls.length,1);
});

test('전용 활성은 exact 내부 설정만 허용하며 오염·getter·Proxy는 원 host 생성 전에 거절한다',async()=>{
 const x=await scenario(null),before=x.f.calls();let traps=0;
 const getter=Object.defineProperty({purpose:resultConfiguration.purpose},'mode',{get(){traps++;return resultConfiguration.mode;},enumerable:true});
 const proxy=new Proxy(resultConfiguration,{get(){traps++;throw Error('TRAP');},ownKeys(){traps++;throw Error('TRAP');}});
 for(const config of [null,true,'FN09_DISCOVERY_METADATA',{}, {mode:'NORMAL_PROTECTED'}, {...resultConfiguration,purpose:'SELECT_TEXT'}, {...resultConfiguration,mode:'SYNTHETIC'}, {...resultConfiguration,enabled:true},getter,proxy]){
  assert.throws(()=>x.f.owner.createProfileExecutionClients(x.config,config),/PROTECTION_UNAVAILABLE/);assert.equal(x.f.calls(),before);
 }
 assert.equal(traps,0);assert.equal(x.f.owner.isBusy(),false);assert.equal(x.f.timers(),0);
});

test('원 내부 설정은 snapshot이며 활성 뒤 caller 변경도 다른 어댑터의 기본 상태를 켜지 않는다',async()=>{
 const config={...resultConfiguration},x=await scenario(config);config.purpose='SELECT_TEXT';
 const h=await x.api.open(x.signal.signal,x.slot);assert.equal(typeof h.prepareUnderstandingResult,'function');assert.equal(typeof h.sendUnderstandingResult,'function');await h.close();
 const disabled=x.f.owner.createProfileExecutionClients(x.config),next=await disabled.open(x.signal.signal,x.slot);
 assert.equal(next.prepareUnderstandingResult,undefined);assert.equal(next.sendUnderstandingResult,undefined);await next.close();assert.equal(x.calls.length,0);
});
test('generic BEGIN은 result 목적을 원 채널에 전달하지 않는다',async()=>{
 const x=await scenario(),h=await x.api.open(x.signal.signal),before=x.calls.length;
 await assert.rejects(h.send('NORMAL_EXECUTION_BEGIN',{attemptId:x.binding.attemptId,kind:'UNDERSTANDING_RESULT_SEND'}));
 assert.equal(x.calls.length,before);await h.close('HOST_REQUEST_VALIDATED');
});
for(const disposition of [undefined,'OPERATION_UNKNOWN'])test('첫 close '+String(disposition)+'는 물리 종료 뒤에도 준비를 SEND 가능 상태로 바꾸지 않는다',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);
 const first=h.close(disposition),second=h.close('HOST_REQUEST_VALIDATED');assert.equal(first,second);
 assert.equal((await first).state,'CLOSED_CONFIRMED');const before=x.f.calls();
 await assert.rejects(x.api.open(x.signal.signal,x.slot));assert.equal(x.f.calls(),before);assert.equal(x.calls.length,2);
});
test('내부 abort가 먼저 회수한 준비는 후속 VALIDATED close로 되살리지 않는다',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);x.signal.abort();
 assert.equal((await h.close('HOST_REQUEST_VALIDATED')).state,'CLOSED_CONFIRMED');const n=x.f.calls();
 await assert.rejects(x.api.open(new AbortController().signal,x.slot));assert.equal(x.f.calls(),n);assert.equal(x.f.owner.isBusy(),false);assert.equal(x.f.timers(),0);
});
test('준비 없는 기존 generic close(undefined)는 원 물리 종료를 유지한다',async()=>{
 const x=await scenario(),h=await x.api.open(x.signal.signal);assert.equal((await h.close()).state,'CLOSED_CONFIRMED');
 assert.equal(x.f.owner.isBusy(),false);assert.equal(x.f.timers(),0);assert.equal(x.calls.length,0);
});
test('같은 NORMAL 원 CLOSE만 준비하고 원 host 종료 뒤 동일 slot의 전용 SEND를 한 번 소비한다',async()=>{
 const x=await scenario(),h=await x.closedHost();assert.equal(typeof h.prepareUnderstandingResult,'function');assert.equal(typeof h.sendUnderstandingResult,'function');
 assert.deepEqual(await h.prepareUnderstandingResult(x.binding),x.prepared);assert.equal((await h.close('HOST_REQUEST_VALIDATED')).state,'CLOSED_CONFIRMED');
 const next=await x.api.open(x.signal.signal,x.slot),{bodyHash,...binding}=x.binding;
 const payload={...binding,preparedHash:x.prepared.preparedHash,auth:x.prepared.auth,body:x.body};
 await next.sendUnderstandingResult('NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND',payload);
 await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND',payload));await next.close();
 assert.deepEqual(x.calls.map(v=>v.operation),['NORMAL_SPOOL_CLOSE','NORMAL_EXECUTION_UNDERSTANDING_RESULT_PREPARE','NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND']);
});
test('일반 send의 두 direct 목적은 wire 0이며 CLOSE 없는 private 준비도 효과 0',async()=>{
 for(const op of ['NORMAL_EXECUTION_UNDERSTANDING_RESULT_PREPARE','NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND']){
  const x=await scenario(),h=await x.api.open(x.signal.signal);await assert.rejects(h.send(op,x.binding));assert.equal(x.calls.length,0);await h.close('HOST_REQUEST_VALIDATED');
 }
 const x=await scenario(),h=await x.api.open(x.signal.signal);await assert.rejects(h.prepareUnderstandingResult(x.binding));assert.equal(x.calls.length,0);await h.close('HOST_REQUEST_VALIDATED');
});
for(const kind of ['REF','HASH','EXTRA','GETTER'])test('원 CLOSE와 다른 '+kind+' 준비는 native PREPARE 0',async()=>{
 const x=await scenario(),h=await x.closedHost(),v=structuredClone(x.binding);let gets=0;
 if(kind==='REF')v.acquisitionRef=ref(99);if(kind==='HASH')v.bodyHash='c'.repeat(64);if(kind==='EXTRA')v.extra=true;if(kind==='GETTER')Object.defineProperty(v,'bodyHash',{get(){gets++;return x.binding.bodyHash;},enumerable:true});
 await assert.rejects(h.prepareUnderstandingResult(v));assert.equal(gets,0);assert.equal(x.calls.length,1);await h.close('HOST_REQUEST_VALIDATED');
});
test('준비 응답의 원 부모 close 불명은 다음 open 및 SEND 0',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);x.mode('UNKNOWN');assert.equal((await h.close('HOST_REQUEST_VALIDATED')).state,'UNKNOWN');
 const before=x.f.calls();await assert.rejects(x.api.open(x.signal.signal,x.slot));assert.equal(x.f.calls(),before);assert.equal(x.calls.length,2);
});
test('원 부모 종료 전·다른 slot·만료·취소는 새 host 0',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);const before=x.f.calls();
 await assert.rejects(x.api.open(x.signal.signal,x.slot));assert.equal(x.f.calls(),before);await h.close('HOST_REQUEST_VALIDATED');
 for(const slot of [{...x.slot,slotId:id(99)},{...x.slot,receiptRef:ref(99)},{...x.slot,expiresAt:new Date(x.f.dependencies.now()-1).toISOString()},{...x.slot,scope:{...x.slot.scope,executionId:id(99)}}])await assert.rejects(x.api.open(x.signal.signal,slot));
 assert.equal(x.f.calls(),before);x.signal.abort();await assert.rejects(x.api.open(x.signal.signal,x.slot));assert.equal(x.f.calls(),before);
});
test('동일 private 준비 진행 중 다른 준비·일반 요청은 추가 wire 0',async()=>{
 const x=await scenario(),h=await x.closedHost();x.mode('HOLD');const pending=h.prepareUnderstandingResult(x.binding);
 for(let i=0;i<30&&x.calls.length<2;i++)await Promise.resolve();assert.equal(x.calls.length,2);
 await assert.rejects(h.prepareUnderstandingResult(x.binding));await assert.rejects(h.send('NORMAL_EXECUTION_READ',{handle:id(1),offset:0}));assert.equal(x.calls.length,2);
 x.release();await pending;x.mode('OK');await h.close('HOST_REQUEST_VALIDATED');
});
test('exact BEGIN→WRITE→EXECUTE의 원 bytes/hash와 offset을 한 번만 소비한다',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);await h.close('HOST_REQUEST_VALIDATED');const next=await x.api.open(x.signal.signal,x.slot);
 const bytes=Buffer.from(x.body),{bodyHash,...binding}=x.binding;
 const header={...binding,kind:'UNDERSTANDING_RESULT_SEND',preparedHash:x.prepared.preparedHash,auth:x.prepared.auth,bodyLength:bytes.length,bodyHash};
 const begin=await next.sendUnderstandingResult('NORMAL_EXECUTION_BEGIN',header);
 await next.sendUnderstandingResult('NORMAL_EXECUTION_WRITE',{handle:begin.handle,offset:0,bytes:bytes.toString('base64url')});
 await next.sendUnderstandingResult('NORMAL_EXECUTION_EXECUTE',{handle:begin.handle});
 await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_EXECUTE',{handle:begin.handle}));await next.close();
 assert.deepEqual(x.calls.slice(2).map(v=>v.operation),['NORMAL_EXECUTION_BEGIN','NORMAL_EXECUTION_WRITE','NORMAL_EXECUTION_EXECUTE']);
});
test('기존 baseline처럼 captured slot 없는 원 open은 준비 공급자로 승격하지 않는다',async()=>{
 const x=await scenario(),h=await x.api.open(x.signal.signal);
 await h.send('NORMAL_SPOOL_CLOSE',{writer:'NORMAL_EXECUTION',attemptId:x.binding.attemptId,slotId:x.slot.slotId,allocation:id(21),understanding:{requestRef:x.binding.requestRef,acquisitionRef:x.binding.acquisitionRef,bodyHash:x.binding.bodyHash}});
 await assert.rejects(h.prepareUnderstandingResult(x.binding));assert.equal(x.calls.length,1);await h.close('HOST_REQUEST_VALIDATED');
});
test('원 owner invalidate는 준비 뒤 새 채널 효과0이며 기존 원 close는 회수한다',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);await h.close('HOST_REQUEST_VALIDATED');const n=x.f.calls();
 x.f.owner.invalidate();await assert.rejects(x.api.open(x.signal.signal,x.slot));assert.equal(x.f.calls(),n);assert.equal(x.calls.length,2);
});
test('목적 chunk 중 일반 WRITE와 미완결 EXECUTE는 효과0이며 재시작하지 않는다',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);await h.close('HOST_REQUEST_VALIDATED');const next=await x.api.open(x.signal.signal,x.slot),{bodyHash,...binding}=x.binding;
 const header={...binding,kind:'UNDERSTANDING_RESULT_SEND',preparedHash:x.prepared.preparedHash,auth:x.prepared.auth,bodyLength:Buffer.byteLength(x.body),bodyHash};
 const begin=await next.sendUnderstandingResult('NORMAL_EXECUTION_BEGIN',header),before=x.calls.length;
 await assert.rejects(next.send('NORMAL_EXECUTION_WRITE',{handle:begin.handle,offset:0,bytes:Buffer.from(x.body).toString('base64url')}));
 await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_EXECUTE',{handle:begin.handle}));
 await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_BEGIN',header));assert.equal(x.calls.length,before);await next.close();
});
for(const kind of ['BODY','AUTH','LIMIT','OFFSET','HASH'])test('SEND '+kind+' 오염은 추가 전송 0',async()=>{
 const x=await scenario(),h=await x.closedHost();await h.prepareUnderstandingResult(x.binding);await h.close('HOST_REQUEST_VALIDATED');const next=await x.api.open(x.signal.signal,x.slot),{bodyHash,...binding}=x.binding;
 const p={...binding,preparedHash:x.prepared.preparedHash,auth:x.prepared.auth,body:x.body};
 if(kind==='BODY')p.body+=' ';if(kind==='AUTH')p.auth='TEST_ONLY_OTHER';
 if(kind==='BODY'||kind==='AUTH'){await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND',p));assert.equal(x.calls.length,2);}
 else{
  const header={...binding,kind:'UNDERSTANDING_RESULT_SEND',preparedHash:x.prepared.preparedHash,auth:x.prepared.auth,bodyLength:kind==='LIMIT'?2097152:Buffer.byteLength(x.body),bodyHash};
  if(kind==='LIMIT'){await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_BEGIN',header));assert.equal(x.calls.length,2);}
  else{const begin=await next.sendUnderstandingResult('NORMAL_EXECUTION_BEGIN',header),bytes=Buffer.from(x.body);
   if(kind==='OFFSET'){await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_WRITE',{handle:begin.handle,offset:1,bytes:bytes.toString('base64url')}));assert.equal(x.calls.length,3);}
   else{bytes[0]=32;await next.sendUnderstandingResult('NORMAL_EXECUTION_WRITE',{handle:begin.handle,offset:0,bytes:bytes.toString('base64url')});await assert.rejects(next.sendUnderstandingResult('NORMAL_EXECUTION_EXECUTE',{handle:begin.handle}));assert.equal(x.calls.length,4);}
  }
 }await next.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {normalInstructionDurableFixture,normalInstructionRuntimeFixture} from './normal-instruction-dispatch-fixture.ts';
import {root,memoryFiles} from './normal-start-local-fixture.ts';
const {NormalInstructionIntake}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
const {NormalStartFileStore}=await import('../../../apps/connector/runtime/normal-start-file-store.ts');
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function parts(f:Awaited<ReturnType<typeof normalInstructionDurableFixture>>){const out=[];for(const p of f.item.materials.groups[0]!.parts)out.push(await f.get.send(await f.get.prepareMaterial(f.item,p.materialId,f.signal),f.signal));return out;}

test('SEND 내구수신은 독립 receipt/budget과 원 공통 scope를 구분하고 복제 수신을 추가 기록하지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  const data=await parts(f),a=await f.intake.receive(f.item,f.page.proofResultRef,data),files=f.fs.files.size;
  assert.equal(a.state,'RECEIVED');assert.equal(a.executionAuthorized,false);
  assert.deepEqual(await f.intake.receive(f.item,f.page.proofResultRef,data),a);assert.equal(f.fs.files.size,files);
  const restarted=new NormalInstructionIntake(new NormalStartFileStore(root,f.localScope,f.fs.fs).instructionIntake(),f.expected,f.clock);
  assert.equal((await restarted.instruction(f.item.envelope)).text,Buffer.concat(data.map(p=>Buffer.from(p.bytes))).toString());
  for(const key of ['projectId','assignmentId','executionId','executionGeneration','connectionRef','environmentRef','capabilityRef','sourceScopes','executorRegistrationRef']){
   const expected=structuredClone(f.expected) as any;
   if(key==='executorRegistrationRef')expected[key].id=randomUUID();else if(key==='sourceScopes')expected.context[key][0].observationRef.id=randomUUID();else if(key==='executionGeneration')expected.context[key]++;
   else if(typeof expected.context[key]==='string')expected.context[key]=randomUUID();else expected.context[key].id=randomUUID();
   const fs=memoryFiles(),intake=new NormalInstructionIntake(new NormalStartFileStore(root,f.localScope,fs.fs).instructionIntake(),expected,f.clock);
   await assert.rejects(intake.receive(f.item,f.page.proofResultRef,data),/CONTEXT_MISMATCH/);assert.equal(fs.files.size,0);
  }
 }finally{await f.h.close();}
});

for(const fault of ['SYNC','PARTIAL','READBACK','ABORT'] as const)test('SEND '+fault+' 중단은 불명 lock과 원 행을 보존하고 새 store도 재수신하지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  const data=await parts(f),controller=new AbortController(),open=f.fs.fs.open;
  f.fs.fs.open=async(path:string,flag:any)=>{const handle=await open(path,flag);if(flag==='wx'&&path.endsWith('.json')){
   const sync=handle.sync;handle.sync=async()=>{await sync();if(fault==='READBACK')f.fs.files.get(path)!.bytes[0]=33;if(fault==='ABORT')controller.abort();};
  }return handle;};
  if(fault==='SYNC')f.fs.mode.failSync=true;if(fault==='PARTIAL')f.fs.mode.partial=true;
  await assert.rejects(f.intake.receive(f.item,f.page.proofResultRef,data,controller.signal));
  const lock=f.fs.path('intake-'+f.item.envelope.commandId+'.lock');assert(f.fs.files.has(lock));const before=f.fs.files.size;
  const restarted=new NormalInstructionIntake(new NormalStartFileStore(root,f.localScope,f.fs.fs).instructionIntake(),f.expected,f.clock);
  await assert.rejects(restarted.receive(f.item,f.page.proofResultRef,data),/NORMAL_LOCAL_BUSY/);assert.equal(f.fs.files.size,before);assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});

test('SEND 저장 이후 session 변경·재봉인 행·원문 변조를 재읽기에서 거절한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const changed=structuredClone(f.item.envelope) as any;changed.payload.sessionBindingRef.id=randomUUID();const {envelopeHash,...u}=changed;changed.envelopeHash=hash(u);
  await assert.rejects(f.intake.instruction(changed));
  const path=f.fs.path('intake-'+f.item.envelope.commandId+'.000001.json'),row=JSON.parse(f.fs.files.get(path)!.bytes.toString());
  row.bytes=Buffer.from('변조').toString('base64url');row.snapshot.partContentHash=contentHash(Buffer.from('변조'));row.ref.contentHash=hash(row.snapshot);
  f.fs.files.get(path)!.bytes=Buffer.from(canonicalJson(row)+'\n');await assert.rejects(f.intake.instruction(f.item.envelope));assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});

test('await 중 입력 item/bytes 변조는 캡처한 원 bytes와 봉투를 교체하지 않는다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  const data=await parts(f),original=Buffer.concat(data.map(p=>Buffer.from(p.bytes))),envelope=structuredClone(f.item.envelope),open=f.fs.fs.open;
  f.fs.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(path.endsWith('.lock')){data[0]!.bytes.fill(33);f.item.envelope.context.budgetRef.id=randomUUID();}return h;};
  await f.intake.receive(f.item,f.page.proofResultRef,data);const saved=await f.intake.instruction(envelope);assert.deepEqual(Buffer.from(saved.bytes),original);
 }finally{await f.h.close();}
});

test('SEND 입력 accessor/Proxy는 getter/trap 실행 없이 기록 전에 거절한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  const data=await parts(f);let calls=0;
  const accessor={...f.item};Object.defineProperty(accessor,'envelope',{enumerable:true,get(){calls++;return f.item.envelope;}});
  await assert.rejects(f.intake.receive(accessor,f.page.proofResultRef,data));assert.equal(calls,0);
  const proxy=new Proxy(f.item,{get(t,k,r){calls++;return Reflect.get(t,k,r);},getPrototypeOf(t){calls++;return Reflect.getPrototypeOf(t);}});
  await assert.rejects(f.intake.receive(proxy,f.page.proofResultRef,data));assert.equal(calls,0);assert.equal(f.fs.files.size,0);
 }finally{await f.h.close();}
});

for(const fault of ['SCOPE','DESCRIPTOR','ENVELOPE_AFTER_PART','PART_AFTER_PART','LATE_CHALLENGE','MONO_EXPIRED','MONO_BACK'] as const)test('I1 SEND 보호수신 '+fault+'은 다음 challenge/GET 전에 닫는다',async()=>{
 const f=await normalInstructionRuntimeFixture({text:'원문🙂'.repeat(14000),mediaType:'text/plain;charset=utf-8'});
 try{
  const {receiveNormalInstruction}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
  const page=await f.get.send(await f.get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal),start=page.items[0]!,item=page.items[1]!;
  assert(start.materials!==null);assert.equal(start.envelope.operation,'START_SESSION');assert(item.materials!==null);assert.equal(item.envelope.operation,'SEND_INSTRUCTION');
  assert(item.materials.groups[0]!.parts.length>=2);const fs=memoryFiles(),expected={context:structuredClone(start.envelope.context),executorRegistrationRef:start.envelope.executorRegistrationRef};
  if(fault==='SCOPE')expected.context.assignmentId=randomUUID();if(fault==='DESCRIPTOR')item.materialsDescriptorHash='0'.repeat(64);
  let wall=f.clock(),mono=10,prepared=0,gets=0;
  const intake=new NormalInstructionIntake(new NormalStartFileStore(root,{projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:f.scope.executionGeneration},fs.fs).instructionIntake(),expected,()=>wall,()=>mono);
  const client={async prepareMaterial(...args:Parameters<typeof f.get.prepareMaterial>){prepared++;const packet=await f.get.prepareMaterial(...args);if(fault==='LATE_CHALLENGE')wall+=60000;return packet;},
   async send(packet:any,signal:AbortSignal){gets++;const part=await f.get.send(packet,signal) as any;if(gets===1){
    if(fault==='ENVELOPE_AFTER_PART')wall=Date.parse(item.envelope.expiresAt);
    if(fault==='PART_AFTER_PART'){part.expiresAt=new Date(wall+1).toISOString();wall++;}
    if(fault==='MONO_EXPIRED')mono+=60000;if(fault==='MONO_BACK')mono--;
   }return part;}};
  await assert.rejects(receiveNormalInstruction(client as any,intake,item,page.proofResultRef,f.signal));
  assert.equal(prepared,['SCOPE','DESCRIPTOR'].includes(fault)?0:1);assert.equal(gets,['SCOPE','DESCRIPTOR','LATE_CHALLENGE'].includes(fault)?0:1);
  assert.equal(fs.files.size,0);assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});


test('역사 observations는 원 수신 ref/시각을 반환하고 만료 뒤 새 GET 없이 원문 변조를 거절한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  await f.receive();const a=await f.intake.observations(f.item.envelope),calls=f.calls.length;f.mode.wall+=60000;
  assert.deepEqual(await f.intake.observations(f.item.envelope),a);assert.equal(f.calls.length,calls);assert.equal(a.type,'RECEIVED');
  const row=[...f.fs.files.entries()].find(([p])=>p.includes('intake-')&&p.endsWith('.000001.json'))!;assert(row);row[1].bytes=Buffer.from('{}');
  await assert.rejects(f.intake.observations(f.item.envelope));assert.equal(f.calls.length,calls);
 }finally{await f.h.close();}
});


test('hasReceived는 정상 미수신만 false이며 page sequence/descriptor와 역사 수신 불일치를 거절한다',async()=>{
 const f=await normalInstructionDurableFixture();try{
  assert.equal(await f.intake.hasReceived(f.item),false);await f.receive();assert.equal(await f.intake.hasReceived(f.item),true);
  const other=structuredClone(f.item);other.sequence++;await assert.rejects(f.intake.hasReceived(other));
  assert.equal(await f.intake.hasReceived(f.item),true);
 }finally{await f.h.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import inject from 'light-my-request';
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
import {normalInstructionDeliveryFixture} from './normal-instruction-dispatch-fixture.ts';
// 제품 의존성은 fixture의 MemoryFS 설치가 완료된 뒤에만 평가한다.
const {NormalProtectedGetClient}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');

async function setup(instruction?:Parameters<typeof normalInstructionDeliveryFixture>[0]){
 const h=await normalInstructionDeliveryFixture(instruction),j=h.q.j,commands=h.f.tables.execution_commands!,first=commands[0]!;
 const calls:{method:string;path:string}[]=[],mode={partGets:0,loseAt:0,wall:0,mono:0,afterPart:null as null|(()=>void|Promise<void>),mutate:null as null|((value:any)=>void)};
 const request=(url:URL,options:any,callback:(r:any)=>void)=>{
  const req:any=new EventEmitter();req.destroy=()=>{};req.end=(body?:Buffer)=>{
   calls.push({method:options.method,path:url.pathname});
   inject((rq,rp)=>{Object.defineProperty(rq.socket,'encrypted',{value:true});(url.pathname.endsWith('/challenges')?j.app:h.app).routing(rq,rp);},
    {method:options.method,url:url.pathname+url.search,headers:{host:url.host,...options.headers},...(body?{payload:body}:{})}).then(async r=>{
     if(url.pathname.includes('/materials/')){mode.partGets++;await mode.afterPart?.();if(mode.loseAt===mode.partGets){setImmediate(()=>req.emit('error',Error('RAM_RESPONSE_LOST')));return;}}
     let payload=r.rawPayload;if(mode.mutate&&r.statusCode===200){const value=r.json();mode.mutate(value);payload=Buffer.from(canonicalJson(value));}
     const res:any=new EventEmitter();res.destroy=()=>{};res.statusCode=r.statusCode;res.rawHeaders=Object.entries(r.headers).flatMap(([k,v])=>[k,String(v)]);
     callback(res);setImmediate(()=>{res.emit('data',payload);res.emit('end');});
    },e=>req.emit('error',e));
  };return req;
 };
 const client=new NormalProtectedGetClient({origin:'https://anvil-synthetic.invalid',ca:'RAM CA',credential:j.token,credentialExpiresAt:j.credentialExpiresAt,
  scope:{projectId:h.f.pid,connectorId:h.f.registration!.row.connector_id,executionId:first.execution_id,executionGeneration:first.generation,grantRef:j.mk().grantRef,credentialGeneration:j.mk().credentialGeneration}},
  {request:request as any,signer:{async sign(_purpose,bytes){return j.signBytes(bytes);}},now:()=>j.store.now().getTime()+mode.wall,monotonicNow:()=>mode.mono});
 return{h,client,calls,mode,signal:new AbortController().signal};
}
test('실제 서버 혼합 START SEND 페이지를 보호 GET client가 검산한다',async()=>{
 const f=await setup();try{
  const packet=await f.client.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),page=await f.client.send(packet,f.signal);
  assert.deepEqual(page.items.map(i=>i.envelope.operation),['START_SESSION','SEND_INSTRUCTION']);
 }finally{await f.h.close();}
});

const longText='가'.repeat(21845)+'🙂'+('명시 지시🙂\n'.repeat(10000));
for(const mediaType of ['text/plain;charset=utf-8','text/markdown;charset=utf-8'] as const)test('보호 GET 다부분 '+mediaType+' 원문과 UTF8 경계를 정확히 보존한다',async()=>{
 const f=await setup({text:longText,mediaType});try{
  const page=await f.client.send(await f.client.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal),item=page.items[1]!;
  assert(item.materials!==null);assert.equal(item.envelope.operation,'SEND_INSTRUCTION');
  assert(item.materials.groups[0]!.parts.length>=3);assert(item.materials.groups[0]!.parts.every(p=>p.utf8Bytes<=65536));
  assert.notDeepEqual(item.materials.groups[0]!.payloadRef,item.materials.groups[0]!.sourceRef);
  const result=await f.client.receiveInstruction(item,f.signal);assert.equal(result.text,longText);assert.deepEqual(Buffer.from(result.bytes),Buffer.from(longText));assert.equal(contentHash(result.bytes),item.materials.groups[0]!.contentHash);
  assert.equal(result.mediaType,mediaType);assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(f.mode.partGets,item.materials.groups[0]!.parts.length);
  assert.deepEqual(result.partsRef,f.h.plan.partsRef);assert.deepEqual(result.instructionRef,f.h.plan.instructionRef);assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});

for(const fault of ['LOST','REVOKED','CORRECTION','QUARANTINE','EXPIRED','ABORT','WALL_BACK','MONO_BACK','MATERIAL_ID','SOURCE_REF','HASH','ENCODING'] as const)test('SEND 수신 '+fault+'은 원문 성공과 자동 후속 GET을 막는다',async()=>{
 const f=await setup({text:longText,mediaType:'text/plain;charset=utf-8'});try{
  const item=(await f.client.send(await f.client.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal)).items[1]!;
  assert(item.materials!==null);assert.equal(item.envelope.operation,'SEND_INSTRUCTION');
  const controller=new AbortController();f.mode.mono=10;
  if(fault==='LOST')f.mode.loseAt=2;
  if(['MATERIAL_ID','SOURCE_REF','HASH','ENCODING'].includes(fault))f.mode.mutate=value=>{if(value.material){if(fault==='MATERIAL_ID')value.material.materialId=item.envelope.commandId;if(fault==='SOURCE_REF')value.material.sourceRef=item.commandRef;if(fault==='HASH')value.material.contentHash='a'.repeat(64);if(fault==='ENCODING')value.material.bytes+='=';}};
  f.mode.afterPart=async()=>{if(f.mode.partGets!==1)return;
   if(fault==='REVOKED')f.h.q.j.store.mode.revoked=true;
   if(fault==='CORRECTION')f.h.x.mode.afterReadCorrection=true;
   if(fault==='QUARANTINE')f.h.f.state.quarantined=true;
   if(fault==='EXPIRED')f.mode.wall=60000;
   if(fault==='ABORT')controller.abort();
   if(fault==='WALL_BACK')f.mode.wall=-1;
   if(fault==='MONO_BACK')f.mode.mono=9;
  };
  await assert.rejects(f.client.receiveInstruction(item,controller.signal),(e:any)=>{
   if(['LOST','EXPIRED','ABORT','WALL_BACK','MONO_BACK','MATERIAL_ID','SOURCE_REF','HASH','ENCODING'].includes(fault))assert.equal(e.outcomeUnknown,true);
   else assert.equal(e.status,fault==='REVOKED'?404:412);
   return true;
  });
  const expected=['LOST','CORRECTION','QUARANTINE'].includes(fault)?2:1;
  assert.equal(f.mode.partGets,expected);const before=f.calls.length;await new Promise<void>(yes=>setImmediate(yes));assert.equal(f.calls.length,before);assert.equal(f.h.permits.length,0);
 }finally{await f.h.close();}
});
test('await 중 caller item 변조는 캡처한 원 명령/자료를 교체하지 못한다',async()=>{
 const f=await setup({text:longText,mediaType:'text/plain;charset=utf-8'});try{
  const item=(await f.client.send(await f.client.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal)).items[1]!,original=structuredClone(item),calls=f.calls.length;
  assert(item.materials!==null);assert.equal(item.envelope.operation,'SEND_INSTRUCTION');
  f.mode.afterPart=()=>{item.envelope.commandId='00000000-0000-4000-8000-000000000001';item.materials.groups[0]!.parts[1]!.materialId='00000000-0000-4000-8000-000000000002';};
  const received=await f.client.receiveInstruction(item,f.signal);assert.equal(received.text,longText);assert.equal(received.envelopeHash,original.envelope.envelopeHash);
  for(const call of f.calls.slice(calls).filter(c=>c.method==='GET'))assert(call.path.includes('/commands/'+original.envelope.commandId+'/materials/'));
 }finally{await f.h.close();}
});
test('START item 또는 다른 실행 item은 INSTRUCTION 수신을 시작하지 않는다',async()=>{
 const f=await setup();try{
  const page=await f.client.send(await f.client.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal),before=f.calls.length;
  const start=page.items[0]!;assert(start.materials!==null);assert.equal(start.envelope.operation,'START_SESSION');
  await assert.rejects(f.client.receiveInstruction(start,f.signal),/NORMAL_GET_INPUT_INVALID/);
  const cross=structuredClone(page.items[1]!);assert(cross.materials!==null);assert.equal(cross.envelope.operation,'SEND_INSTRUCTION');cross.envelope.context.executionGeneration++;const {envelopeHash,...unsigned}=cross.envelope;cross.envelope.envelopeHash=contentHash(canonicalJson(unsigned));
  await assert.rejects(f.client.receiveInstruction(cross,f.signal),/NORMAL_GET_INPUT_INVALID/);assert.equal(f.calls.length,before);
 }finally{await f.h.close();}
});

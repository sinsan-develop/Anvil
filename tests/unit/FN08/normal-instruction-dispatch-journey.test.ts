import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fitPage,readPageWindow} from '../../../apps/server/modules/executions/normal-command-pages.ts';
import {pathToFileURL} from 'node:url';
import {normalInstructionFixture,normalInstructionDeliveryFixture} from './normal-instruction-dispatch-fixture.ts';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 test('원 normal START 이후 SEND는 별도 예약/영수증/원부모를 저장하고 BUSY 동일 명령을 재조회한다',async()=>{
  const f=await normalInstructionFixture();try{const first:any=await f.run();assert.equal(first.status,'APPLIED');assert.equal(first.data.status,'NORMAL_INSTRUCTION_QUEUE_STORED');assert.equal(first.data.executionAuthorized,false);assert.equal(first.data.dispatchPerformed,false);
   const row=f.stored()[0]!,s=row.snapshot_json;assert.deepEqual(s.currentBinding.parentStart,{commandRef:{id:f.start.id,version:1,contentHash:f.start.content_hash},envelopeHash:f.start.envelope_hash,authorizationReceiptRef:f.start.snapshot_json.envelope.context.authorizationReceiptRef});assert.notDeepEqual(s.reservationRef,f.g.snapshot_json.binding.budgetReservationRef);assert.equal(f.f.tables.usage_reservations!.length,2);assert.equal(f.f.tables.execution_grants!.length,1);assert.equal(f.f.tables.execution_credentials!.length,1);
   f.mode.busy=true;assert.deepEqual(await f.run(),first);assert.equal(f.stored().length,1);assert.equal(f.f.tables.usage_reservations!.length,2);
  }finally{await f.close();}
 });
 test('normal SEND 부분 저장 실패는 새 예약/명령/영수증을 함께 rollback한다',async()=>{
  const f=await normalInstructionFixture();try{const before=[f.f.commands.size,f.f.receipts.size,f.f.audits.size];f.mode.failWrite='execution_materials';await assert.rejects(f.run(),/RAM_WRITE_FAILED/);assert.equal(f.stored().length,0);assert.equal(f.f.tables.usage_reservations!.length,1);assert.deepEqual([f.f.commands.size,f.f.receipts.size,f.f.audits.size],before);}finally{await f.close();}
 });
 for(const fault of ['BUSY','REVOKED','PARENT','PARTS','SESSION_BINDING','AFTER_WRITE'] as const)test('normal SEND '+fault+' 거절은 추가 실행/예약/영수증을 남기지 않는다',async()=>{
  const f=await normalInstructionFixture();try{
   const before=[f.f.commands.size,f.f.receipts.size,f.f.audits.size];
   const expected={BUSY:'NORMAL_INSTRUCTION_BUSY',REVOKED:'EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED',PARENT:'NORMAL_INSTRUCTION_START_PARENT_REQUIRED',PARTS:'NORMAL_INSTRUCTION_SOURCE_INVALID',SESSION_BINDING:'NORMAL_INSTRUCTION_SUBJECT_MISMATCH',AFTER_WRITE:'EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED'}[fault];
   if(fault==='BUSY')f.mode.busy=true;if(fault==='REVOKED')f.mode.revoked=true;if(fault==='PARENT')f.mode.missingParent=true;
   if(fault==='PARTS')f.request.payload.partsRef={...f.request.payload.partsRef,contentHash:'a'.repeat(64)};
   if(fault==='SESSION_BINDING')f.request.payload.sessionBindingRef={...f.request.payload.sessionBindingRef,id:randomUUID()};
   if(fault==='AFTER_WRITE')f.mode.changeAfterWrite=true;
   await assert.rejects(f.run(),(e:any)=>e.code===expected||e.message===expected);
   assert.equal(f.stored().length,0);assert.equal(f.f.tables.usage_reservations!.length,1);assert.deepEqual([f.f.commands.size,f.f.receipts.size,f.f.audits.size],before);
  }finally{await f.close();}
 });
 test('동일 commandId의 다른 본문은 원 SEND를 덮거나 새 예약을 발급하지 않는다',async()=>{
  const f=await normalInstructionFixture();try{const first=await f.run();f.request.payload.reason='다른 원문';await assert.rejects(f.run(),(e:any)=>e.message==='IDEMPOTENCY_CONFLICT');assert.equal(f.stored().length,1);assert.equal(f.f.tables.usage_reservations!.length,2);assert.deepEqual(f.f.commands.get(f.stored()[0]!.created_command_id)!.result_ref,first);}finally{await f.close();}
 });
 test('외부 current 관측은 인증 거래와 project 잠금을 모두 놓은 뒤 실행한다',async()=>{
  const f=await normalInstructionFixture();try{f.mode.requireUnlocked=true;await f.run();assert.deepEqual(f.mode.observeTransactions,[false]);assert.equal(f.stored().length,1);}finally{await f.close();}
 });
 for(const field of ['session','generation','user','client','control'] as const)test('원 HUMAN '+field+' 변경은 SEND를 저장하지 않는다',async()=>{
  const f=await normalInstructionFixture();try{if(field==='control')f.request.controlGeneration++;else f.mode.authChange=field;
   await assert.rejects(f.run(),(e:any)=>['NORMAL_INSTRUCTION_SUBJECT_MISMATCH','PROJECT_CONTROL_REQUIRED','PROJECT_WRITE_DENIED','CONTROL_GENERATION_CONFLICT'].includes(e.message));assert.equal(f.stored().length,0);assert.equal(f.f.tables.usage_reservations!.length,1);
  }finally{await f.close();}
 });
 test('마지막 재인증의 HUMAN session 변경은 모든 SEND 저장을 rollback한다',async()=>{
  const f=await normalInstructionFixture();try{f.mode.finalAuthChange=true;await assert.rejects(f.run(),/NORMAL_INSTRUCTION_CURRENT_CHANGED/);assert.equal(f.stored().length,0);assert.equal(f.f.tables.usage_reservations!.length,1);}finally{await f.close();}
 });
 test('COMMIT 응답 유실은 연결을 폐기하고 자동 발급 없이 명시 동일 명령으로 원 영수증만 조회한다',async()=>{
  const f=await normalInstructionFixture();try{f.mode.commitLost=true;await assert.rejects(f.run(),/RAM_COMMIT_RESPONSE_LOST/);assert.equal(f.mode.discards,1);assert.equal(f.stored().length,1);assert.equal(f.f.tables.usage_reservations!.length,2);
   const original=f.f.commands.get(f.stored()[0]!.created_command_id)!.result_ref;assert.deepEqual(await f.run(),original);assert.equal(f.stored().length,1);assert.equal(f.f.tables.usage_reservations!.length,2);
  }finally{await f.close();}
 });

 test('원 START와 보호 instruction SEND는 같은 page에서 원 부분자료와 nonce 영수증으로 이어진다',async()=>{
  const h=await normalInstructionDeliveryFixture();try{const page=await h.prepare(h.prefix+'/commands',{waitMs:0}),r=await page.get();assert.equal(r.statusCode,200,r.body);const items=r.json().items;assert.deepEqual(items.map((i:any)=>i.envelope.operation),['START_SESSION','SEND_INSTRUCTION']);
   const item=items[1],group=item.materials.groups[0];assert.equal(item.materials.groups.length,1);assert.equal(group.kind,'INSTRUCTION');assert.deepEqual(group.payloadRef,h.plan.partsRef);assert.deepEqual(group.sourceRef,h.plan.instructionRef);
   let joined='';for(const part of group.parts){const p=await h.prepare(h.prefix+'/commands/'+item.envelope.commandId+'/materials/'+part.materialId),a=await p.get();assert.equal(a.statusCode,200,a.body);assert.equal(a.json().executionAuthorized,false);assert.equal(a.json().dispatchPerformed,false);joined+=Buffer.from(a.json().material.bytes,'base64url').toString('utf8');assert.deepEqual((await p.get()).json(),a.json());}
   const {contentHash}=await import('../../../contracts/canonical.ts');assert.equal(contentHash(joined),h.plan.plan.bodyRef.contentHash);assert.equal(h.bindings.length,group.parts.length);assert.equal(h.q.j.store.receipts().filter(r=>r.snapshot_json.kind==='NORMAL_INSTRUCTION_MATERIAL').length,group.parts.length);
  }finally{await h.close();}
 });

 test('혼합 50/51 page 입력의 순수 건수 경계는 고유 항목과 순번 공백을 보존한다',()=>{
  // 이 입력은 fitPage의 크기/건수 계산용 RAM 모형이다. DB graph·실제 50 SEND 생산·cursor 인증 증거가 아니다.
  const rows=Array.from({length:51},(_,i)=>({id:randomUUID(),sequence:String(i*3+1),materials:{groups:[{kind:i===0?'CONTEXT_BUNDLE':'INSTRUCTION',parts:[{materialId:randomUUID()}]}]}}));
  assert.equal(new Set(rows.map(r=>r.id)).size,51);assert.equal(new Set(rows.map(r=>r.materials.groups[0]!.parts[0]!.materialId)).size,51);
  assert.deepEqual(fitPage(rows.slice(0,50) as any),rows.slice(0,50));assert.equal(readPageWindow(rows.slice(0,50),0).hasMore,false);
  const first=fitPage(rows as any);assert.deepEqual(first,rows.slice(0,50));assert.equal(readPageWindow(rows,0).hasMore,true);
  const tail=rows.slice(first.length);assert.deepEqual(fitPage(tail as any),[rows[50]]);assert.deepEqual(readPageWindow(tail,Number(rows[49]!.sequence)),{sequences:[151],hasMore:false});
 });

}

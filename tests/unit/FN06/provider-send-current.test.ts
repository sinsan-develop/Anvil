import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticPgInstructionPermitBasis} from '../../../apps/server/modules/executions/execution-instruction-permit-basis.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
import {providerBindingHash} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {SyntheticProviderHandleReader} from '../../../apps/connector/adapters/primary/provider-handle-reader.ts';
import {SyntheticProviderBoundWire} from '../../../apps/connector/adapters/primary/provider-bound-wire.ts';
async function fixture(){
 const x=await providerTurnFixture(),f=x.f,e=readDispatchEnvelopeV1(x.record.snapshot.envelope,Date.parse(f.basis.fact.checkedAt)),subject=f.basis.fact.subject,at=f.basis.fact.checkedAt,scope=f.scope,entry=f.state().entries[0],c=entry.claim,pr=x.permit.snapshot;
 const actor:any={actorId:subject.userId,clientId:subject.clientId,credentialGeneration:subject.credentialGeneration,serverOwner:false,reauthUntil:null,authSession:{id:subject.humanSessionId,idleExpiresAt:'2026-10-22T02:02:00.000Z',absoluteExpiresAt:'2026-10-22T02:02:00.000Z'}},attempt={key:receiptKeyV1(e),envelopeHash:e.envelopeHash,localAttemptRef:pr.request.localAttemptRef,permitRef:x.permit.ref,instructionContentHash:'a'.repeat(64),bindingHash:'b'.repeat(64)};
 const claimRow={project_id:c.projectId,claim_id:c.claimId,version:1,execution_id:c.execution.id,generation:1,command_id:c.commandId,agent_session_id:c.agentSessionRef.id,agent_session_version:1,grant_id:scope.grantRef.id,grant_version:1,permit_id:c.permitRef.id,permit_version:1,kind:'THREAD',request_id_digest:c.source.requestIdDigest,event_key:entry.eventKey,content_hash:contentHash(canonicalJson(c)),snapshot_json:entry,recorded_at:new Date(entry.receipt.recordedAt)};
 const permitRow={project_id:scope.projectId,execution_id:scope.executionId,generation:1,id:x.permit.ref.id,version:1,content_hash:x.permit.ref.contentHash,snapshot_json:pr,command_id:pr.commandId,command_record_id:pr.commandRef.id,command_record_version:1,grant_id:scope.grantRef.id,grant_version:1,reservation_id:pr.reservationRef.id,reservation_version:1,proof_result_id:pr.proofRef.id,proof_result_version:1,envelope_hash:e.envelopeHash};
 let fault='';const calls:string[]=[],basis=new SyntheticPgInstructionPermitBasis({transport:'SYNTHETIC_ONLY',read:async()=>structuredClone(x.record),current:async()=>({...structuredClone(x.record.snapshot.currentBinding),fact:structuredClone(f.basis.fact),checkedAt:at,expiresAt:e.expiresAt,turnState:fault==='busy'?'BUSY':'IDLE'})} as any,{checkDelivery:async()=>({record:structuredClone(x.reservation),policyRef:f.basis.fact.intent.budgetPolicyRef,checkedAt:at,persisted:false,executionAuthorized:false,dispatchPerformed:false})} as any);
 async function bound<T>(body:(s:any)=>Promise<T>){const m=await import('../../../apps/server/modules/executions/provider-send-current.ts');assert.equal(typeof m.BoundSyntheticProviderSendCurrent,'function');return f.store.transaction(scope,async(tx:any)=>{
  const db:any={query:async(sql:string)=>{calls.push(sql);if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(await tx.challenges.clock())}]};if(sql.includes('FROM anvil.execution_commands'))return{rows:[{id:x.record.ref.id,version:1,content_hash:x.record.ref.contentHash}]};if(sql.includes('FROM anvil.provider_session_claims'))return{rows:fault==='missingClaim'?[]:[claimRow]};if(sql.includes('FROM anvil.execution_instruction_permits'))return{rows:fault==='missingPermit'?[]:[permitRow]};throw Error('UNEXPECTED_QA_QUERY');}};
  const current=new m.BoundSyntheticProviderSendCurrent(db,actor,scope,basis,tx.challenges,{claim:c,claimRef:entry.receipt.claimRef,attempt});return body(current);
 });}
 return{x,f,e,actor,attempt,claim:c,claimRef:entry.receipt.claimRef,permitRow,calls,bound,fault:(v:string)=>fault=v};
}
test('SEND trusted current는 기존 IDLE/새예약 basis와 원 THREAD·소비 permit/nonce·시도ref만 읽어 결박한다',async()=>{
 const f=await fixture(),before=canonicalJson(f.f.state());const value=await f.bound(s=>s.current(f.e,f.claimRef));assert.deepEqual(value.key,receiptKeyV1(f.e));assert.deepEqual(value.claimRef,f.claimRef);assert.equal(value.parentThreadClaimRef,null);assert.equal(value.expiresAt,f.e.expiresAt);assert.equal(canonicalJson(f.f.state()),before);assert(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
});

test('SEND current는 실제 인증 Date actor를 보존하고 caller 변경을 현재 주체로 채택하지 않는다',async()=>{
 const f=await fixture();f.actor.reauthUntil=new Date('2026-10-22T02:01:30.000Z');const expected=f.actor.actorId;
 const value=await f.bound(async s=>{f.actor.actorId=crypto.randomUUID();f.actor.reauthUntil.setTime(0);return s.current(f.e,f.claimRef);});assert.deepEqual(value.claimRef,f.claimRef);assert.notEqual(f.actor.actorId,expected);assert(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(s)));
});
test('BUSY·원claim/permit 부재·시도 불일치·소비nonce 부재는 새 SEND current로 승격하지 않는다',async()=>{
 for(const fault of ['busy','missingClaim','missingPermit','attempt','nonce']){const f=await fixture();f.fault(fault);if(fault==='attempt')f.attempt.localAttemptRef={...f.attempt.localAttemptRef,version:2};if(fault==='nonce')f.f.state().challenges=[];await assert.rejects(f.bound(s=>s.current(f.e,f.claimRef)));assert(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));}
});
test('기존 SEND basis/원장 current가 보호 reader와 guard factory의 exact 시도에 연결된다',async()=>{
 const f=await fixture(),text='QA-read-only-instruction',hash=(v:unknown)=>contentHash(canonicalJson(v));f.attempt.instructionContentHash=contentHash(text);let calls=0;const buffers:Uint8Array[]=[];
 await f.bound(async current=>{
  const reader=new SyntheticProviderHandleReader(current,{transport:'SYNTHETIC_ONLY',read:async c=>{const{protectedHandleRef:_,...input}=c,b=new TextEncoder().encode(canonicalJson({schemaVersion:1,bindingHash:providerBindingHash(input),threadId:'QA-thread',turnId:null}));buffers.push(b);return{ciphertextHash:'f'.repeat(64),plaintext:b};}},{clock:()=>Date.parse(f.f.basis.fact.checkedAt),timeoutMs:1000});
  const wire=new SyntheticProviderBoundWire({envelope:f.e,claim:f.claim,claimRef:f.claimRef,parent:null},a=>{assert.deepEqual(a,f.attempt);return reader;},{transport:'SYNTHETIC_ONLY',exchange:async bytes=>{calls++;assert.equal(JSON.parse(Buffer.from(bytes).toString()).params.threadId,'QA-thread');return Buffer.from('{}\n');}});
  const request=Buffer.from(canonicalJson({id:hash({key:receiptKeyV1(f.e),envelopeHash:f.e.envelopeHash}),method:'turn/start',params:{threadId:'QA-thread',input:[{type:'text',text}]}})+'\n');assert.deepEqual(await wire.exchange(request,new AbortController().signal,f.attempt),Buffer.from('{}\n'));
 });assert.equal(calls,1);assert(buffers.every(b=>b.every(v=>v===0)));
});

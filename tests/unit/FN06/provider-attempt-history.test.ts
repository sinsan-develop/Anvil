import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticProviderReaderFactory} from '../../../apps/connector/adapters/primary/provider-reader-factory.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),id=(n:number)=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const key={projectId:id(1),executionId:id(2),executionGeneration:1,commandId:id(3)},s={sequence:1,key,envelopeHash:'b'.repeat(64),state:'SEND_ATTEMPTED',bindingHash:'c'.repeat(64),materialReceiptRef:ref(4),instructionContentHash:'d'.repeat(64),grantRef:ref(5),permitRef:null,responseFact:null,at:'2026-10-23T00:00:00.000Z',previousRef:null,reason:'NONE'};
 const attempt:any={ref:{id:id(6),version:1,contentHash:hash(s)},snapshot:s},ps={...structuredClone(s),sequence:2,state:'PERMIT_RECORDED',permitRef:ref(7),previousRef:attempt.ref},permit:any={ref:{id:id(8),version:1,contentHash:hash(ps)},snapshot:ps};
 const selection={key:structuredClone(key),envelopeHash:s.envelopeHash,localAttemptRef:structuredClone(attempt.ref),permitRef:ref(7),instructionContentHash:s.instructionContentHash,bindingHash:s.bindingHash};
 let active=true,builds=0;const source:any={transport:'SYNTHETIC_ONLY',readLocked:async(a:any)=>{assert.deepEqual(a,selection);if(!active)throw Error('PRIVATE_LOCK_RELEASED');return{complete:true,attemptRecord:attempt,permitRecord:permit};}},factory:any=new SyntheticProviderReaderFactory(source,async()=>{builds++;throw Error('HANDLE_BUILD_MUST_NOT_RUN');});
 const read=()=>{assert.equal(typeof factory.readHistory,'function','handle을 만들지 않는 원 locked attempt 이력 reader가 필요하다');return factory.readHistory(selection);};
 return{source,factory,selection,attempt,permit,read,builds:()=>builds,release(){active=false;}};
}
test('잠긴 원 시도와 permit 이력을 읽되 handle을 생성하거나 실제 OS 권위로 승격하지 않는다',async()=>{
 const f=fixture(),r=await f.read();assert.equal(r.purpose,'LOCKED_PROVIDER_ATTEMPT_HISTORY_ONLY');assert.deepEqual(r.attemptRecord.ref,f.attempt.ref);assert.deepEqual(r.permitRecord.ref,f.permit.ref);assert.equal(f.builds(),0);assert.equal(r.fileSyncVerified,false);assert.equal(r.osOwnershipVerified,false);assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);assert(r.missingEvidence.includes('CURRENT_PARENT_CLAIM'));
 f.attempt.snapshot.bindingHash='f'.repeat(64);assert.equal(r.attemptRecord.snapshot.bindingHash,'c'.repeat(64));
});
test('정합 재해시한 다른 permit/선행/시도 binding이나 잠금해제·불완전 원장은 거절하고 handle0이다',async()=>{
 for(const change of [(f:any)=>f.permit.snapshot.permitRef=ref(9),(f:any)=>f.permit.snapshot.previousRef=ref(9),(f:any)=>f.permit.snapshot.bindingHash='e'.repeat(64),(f:any)=>f.release(),(f:any)=>f.source.readLocked=async()=>({complete:false,attemptRecord:f.attempt,permitRecord:f.permit})]){const f=fixture();change(f);f.permit.ref.contentHash=hash(f.permit.snapshot);await assert.rejects(f.read(),/PROVIDER_READER_FACTORY_UNAVAILABLE/);assert.equal(f.builds(),0);}
});
test('조회 중 caller 선택이 바뀌어도 조회 시작의 시도만 고정한다',async()=>{
 const f=fixture(),original=structuredClone(f.selection);let resume!:(v:unknown)=>void;f.source.readLocked=async()=>new Promise(r=>resume=r);const pending=f.read();f.selection.envelopeHash='0'.repeat(64);resume({complete:true,attemptRecord:f.attempt,permitRecord:f.permit});const r=await pending;assert.deepEqual(r.selection,original);assert.equal(f.builds(),0);
});

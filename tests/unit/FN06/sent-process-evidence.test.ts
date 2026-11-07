import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {sentProcessEvidenceFixture as fixture} from './sent-process-evidence-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
test('원 anchor·사건binding과 별도 일회 OBSERVE를 소비해 false-authority 증거만 반환한다',async()=>{
 const x=await fixture(),v=await x.consumer.read(x.selection,new AbortController().signal);
 assert.equal(v.purpose,'SENT_RESPONSE_PROCESS_EVIDENCE_ONLY');assert.equal(v.state,'SYNTHETIC_MATCHED');
 for(const k of ['fileSandboxVerified','currentAuthorityVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'])assert.equal((v as any)[k],false);
 assert.deepEqual(v.ownershipEvidenceRef,x.anchor.ref);assert.deepEqual(v.bindingRef,x.binding.ref);assert.equal(v.processRef.pid,100);
 assert.deepEqual(x.counts(),{serverReads:2,archiveReads:2,observes:1});
 await assert.rejects(x.consumer.read(x.selection,new AbortController().signal),{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'});
 assert.equal(x.counts().observes,1);
});
test('재해시된 미채택 anchor·다른 사건/세대·PID재사용·Job·image·불명 관측을 거절한다',async()=>{
 for(const mode of ['ADOPTION','EVENT','PARENT','SCOPE','HEAD','TAMPER','MISSING','STALE','OBSERVER','REVOKED','SERVER_REVOKED','PID_REUSE','JOB','GEN','IMAGE','ESCAPED','DUPLICATE','OLD_REQUEST','OLD_OBSERVE','PREPARED','FILE_AUTHORITY']){
  const x=await fixture();x.mode(mode);
  await assert.rejects(x.consumer.read(x.selection,new AbortController().signal),{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'},mode);
 }
 const x=await fixture(),original=structuredClone(x.anchor.ref);x.anchor.snapshot.processRef={...x.anchor.snapshot.processRef,pid:101};x.anchor.ref.contentHash=hash(x.anchor.snapshot);x.selection.ownershipEvidenceRef=x.anchor.ref;
 x.binding.ref.contentHash=hash(x.binding.snapshot);
 assert.notDeepEqual(x.anchor.ref,original);assert.equal(x.anchor.ref.contentHash,hash(x.anchor.snapshot));assert.equal(x.binding.ref.contentHash,hash(x.binding.snapshot));assert.deepEqual(x.binding.snapshot.ownershipEvidenceRef,x.anchor.ref);
 await assert.rejects(x.consumer.read(x.selection,new AbortController().signal),{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'});
 assert.deepEqual(x.counts(),{serverReads:1,archiveReads:0,observes:0});
});
test('독립 관측 중 취소·timeout 뒤에는 late 결과/후속 읽기를 채택하지 않는다',async()=>{
 for(const cancel of [true,false]){
  const x=await fixture();x.mode('OBSERVE_DELAY');const c=new AbortController(),p=x.consumer.read(x.selection,c.signal);
  const rejected=assert.rejects(p,{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'});await x.waiting;if(cancel)c.abort();await rejected;
  x.release();await new Promise<void>(r=>setImmediate(r));assert.deepEqual(x.counts(),{serverReads:1,archiveReads:1,observes:1});
 }
});
test('마지막 보관 await 뒤 기한 만료면 서버 추가조회 없이 거절한다',async()=>{
 const x=await fixture();x.mode('ARCHIVE_DELAY');const p=x.consumer.read(x.selection,new AbortController().signal);
 await x.waiting;x.release();await assert.rejects(p,{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'});assert.equal(x.counts().serverReads,1);
});
test('최종 서버 await 뒤 만료·취소도 성공을 반환하지 않는다',async()=>{
 for(const cancel of [true,false]){
  const x=await fixture();x.mode('LAST_DELAY');const c=new AbortController(),p=x.consumer.read(x.selection,c.signal);
  const rejected=assert.rejects(p,{message:'SENT_PROCESS_EVIDENCE_UNAVAILABLE'});await x.waiting;if(cancel)c.abort();x.release();await rejected;
  assert.deepEqual(x.counts(),{serverReads:2,archiveReads:2,observes:1});
 }
});
test('관측 대기 중 caller 입력 변조는 복제고정한 원 선택을 바꾸지 않는다',async()=>{
 const x=await fixture();x.mode('OBSERVE_DELAY');const old=structuredClone(x.selection.ownershipEvidenceRef),p=x.consumer.read(x.selection,new AbortController().signal);
 await x.waiting;x.selection.envelope.context.executionGeneration++;x.selection.ownershipEvidenceRef.version++;x.selection.permitRef.version++;
 x.release();const v=await p;assert.deepEqual(v.ownershipEvidenceRef,old);assert.equal(v.currentAuthorityVerified,false);
});

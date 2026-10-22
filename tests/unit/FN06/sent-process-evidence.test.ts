import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=(id:string,snapshot:unknown)=>({id,version:1,contentHash:hash(snapshot)});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(){
 const f=await sentResponseBasisFixture();f.fault('busy');
 if(f.e.operation!=='SEND_INSTRUCTION')throw Error('QA_SEND_REQUIRED');
 const serverValue:any=await f.bound(s=>s.currentSentResponse(f.e,f.claimRef)),fact=serverValue.basis.fact;
 let now=Date.parse(fact.checkedAt),mode='',serverReads=0,archiveReads=0,observes=0;
 const at=()=>new Date(now).toISOString(),end=new Date(now+5000).toISOString();
 const scope={projectId:f.e.context.projectId,executionId:f.e.context.executionId,executionGeneration:f.e.context.executionGeneration,sessionBindingRef:f.e.payload.sessionBindingRef,roleBindingRef:fact.agentSession.roleBindingRef,executorRegistrationRef:f.e.executorRegistrationRef};
 const processRef={runId:id(1),generation:1,jobId:id(2),pid:100,startTicks:'638960000000000001',executableHash:'1'.repeat(64)},observerRef=ref(id(3),{kind:'synthetic-observer'});
 const anchorSnapshot:any={schemaVersion:1,purpose:'PROCESS_OWNERSHIP_ANCHOR',transport:'SYNTHETIC_ONLY',scope,processRef,observerRef,recordedAt:at(),expiresAt:end,state:'BOUND',fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const anchor:any={ref:ref(id(4),anchorSnapshot),snapshot:anchorSnapshot};
 fact.checks.osFence.evidenceRefs=[structuredClone(anchor.ref)];
 const selection:any={envelope:f.e,parentThreadClaimRef:f.claimRef,attemptRef:f.attempt.localAttemptRef,permitRef:f.attempt.permitRef,ownershipEvidenceRef:anchor.ref,instructionContentHash:f.attempt.instructionContentHash,preSendBindingHash:f.attempt.bindingHash};
 const bindingSnapshot:any={schemaVersion:1,purpose:'SENT_PROCESS_BINDING',transport:'SYNTHETIC_ONLY',ownershipEvidenceRef:anchor.ref,scope,commandId:f.e.commandId,envelopeHash:f.e.envelopeHash,parentThreadClaimRef:f.claimRef,attemptRef:selection.attemptRef,permitRef:selection.permitRef,instructionContentHash:selection.instructionContentHash,preSendBindingHash:selection.preSendBindingHash,recordedAt:at(),expiresAt:end};
 const binding:any={ref:ref(id(5),bindingSnapshot),snapshot:bindingSnapshot};
 let entered!:()=>void,release!:()=>void;const waiting=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const archive:any={transport:'SYNTHETIC_ONLY',readCurrent:async()=>{
  archiveReads++;if(mode==='ARCHIVE_DELAY'&&archiveReads===2){entered();await gate;now+=6000;}
  const value:any=structuredClone({anchor,binding,anchorHeadRef:anchor.ref,bindingHeadRef:binding.ref,revoked:false,readAt:at(),expiresAt:end});
  if(mode==='REVOKED'&&archiveReads===2)value.revoked=true;
  if(mode==='HEAD')value.anchorHeadRef.version++;
  if(mode==='TAMPER')value.anchor.snapshot.processRef.pid++;
  if(mode==='MISSING')delete value.anchor;
  if(mode==='STALE')value.readAt=new Date(now-31000).toISOString();
  if(mode==='OBSERVER')value.anchor.snapshot.observerRef.version++;
  if(mode==='EVENT')value.binding.snapshot.permitRef.version++;
  if(mode==='PARENT')value.binding.snapshot.parentThreadClaimRef.version++;
  if(mode==='SCOPE')value.anchor.snapshot.scope.executionGeneration++;
  if(['EVENT','SCOPE','PARENT','OBSERVER'].includes(mode)){value.anchor.ref.contentHash=hash(value.anchor.snapshot);value.binding.ref.contentHash=hash(value.binding.snapshot);value.anchorHeadRef=value.anchor.ref;value.bindingHeadRef=value.binding.ref;}
  return value;
 }};
 const server:any={transport:'SYNTHETIC_ONLY',currentSentResponse:async()=>{serverReads++;const v=structuredClone(serverValue);if(mode==='ADOPTION')v.basis.fact.checks.osFence.evidenceRefs=[{...anchor.ref,version:2}];if(mode==='SERVER_REVOKED'&&serverReads===2)throw Error('REVOKED');if(mode==='LAST_DELAY'&&serverReads===2){entered();await gate;now+=6000;}return v;}};
 const observer:any={transport:'SYNTHETIC_ONLY',observe:async(request:any)=>{
  observes++;const r=request.snapshot;
  assert.equal(r.purpose,'OBSERVE_SENT_PROCESS');assert.equal(request.ref.contentHash,hash(r));
  if(mode==='OBSERVE_DELAY'){entered();await gate;}
  const v:any={requestRef:request.ref,ownershipEvidenceRef:anchor.ref,bindingRef:binding.ref,observerRef,observedAt:at(),expiresAt:end,facts:{processRef,state:'RUNNING',active:1,processes:[{pid:100,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false}};
  if(mode==='PID_REUSE')v.facts.processes[0].startTicks='638960000000000002';
  if(mode==='JOB')v.facts.processRef={...processRef,jobId:id(99)};
  if(mode==='GEN')v.facts.processRef={...processRef,generation:2};
  if(mode==='IMAGE')v.facts.processes[0].executableHash='2'.repeat(64);
  if(mode==='ESCAPED')v.facts.processes[0].inJob=false;
  if(mode==='DUPLICATE'){v.facts.active=2;v.facts.processes.push({...v.facts.processes[0]});}
  if(mode==='OLD_REQUEST')v.requestRef={...request.ref,id:id(99)};
  if(mode==='OLD_OBSERVE')v.observedAt=new Date(now-1).toISOString();
  if(mode==='PREPARED')v.facts.state='PREPARED';
  if(mode==='FILE_AUTHORITY')v.facts.fileSandboxVerified=true;
  return structuredClone(v);
 }};
 const m=await import('../../../apps/connector/runtime/sent-process-evidence.ts');
 const consumer=new m.SyntheticSentProcessEvidence(server,archive,observer,{clock:()=>now,timeoutMs:50});
 return{selection:structuredClone(selection),anchor,binding,consumer,mode:(s:string)=>mode=s,counts:()=>({serverReads,archiveReads,observes}),waiting,release:()=>release()};
}
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

import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=(id:string,snapshot:unknown)=>({id,version:1,contentHash:hash(snapshot)});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function sentProcessEvidenceFixture(){
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
 return{selection:structuredClone(selection),anchor,binding,consumer,responseSource:server,parent:structuredClone({claim:f.claim,claimRef:f.claimRef}),grantRef:structuredClone(f.f.scope.grantRef),setPreHash:(value:string)=>{selection.preSendBindingHash=value;serverValue.attemptBinding.bindingHash=value;binding.snapshot.preSendBindingHash=value;binding.ref.contentHash=hash(binding.snapshot);},mode:(s:string)=>mode=s,counts:()=>({serverReads,archiveReads,observes}),waiting,release:()=>release()};
}

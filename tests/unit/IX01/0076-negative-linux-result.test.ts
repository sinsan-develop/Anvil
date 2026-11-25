import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeContract,type NegativeStageResult} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 create0076NegativeLinuxResultRecorder,
 current0076NegativeLinuxResultContract,
 type NegativeLinuxResultAuthorityPorts,
 type NegativeLinuxResultBinding,
} from '../../../scripts/qa-ix01-0076-negative-linux-result.ts';
import type {NegativeClaimJournalPorts} from '../../../scripts/qa-ix01-0076-negative-claim.ts';

const at=Date.parse('2026-11-25T09:00:00.000Z');
const attemptId='d7000000-0000-4000-8000-000000000081';
const approvalId='d7000000-0000-4000-8000-000000000082';
const receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId;
const binding=Object.freeze({
 schemaVersion:1 as const,purpose:current0076NegativeLinuxResultContract.bindingPurpose,attemptId,approvalId,sourceHead:'1'.repeat(40),
 planHash:'2'.repeat(64),approvalHash:'3'.repeat(64),graphHash:'4'.repeat(64),containerId:'5'.repeat(64),
 issuedAt:at-1000,expiresAt:at+30000,receiptRoot,
}) satisfies NegativeLinuxResultBinding;
const claim=Object.freeze({schemaVersion:1,purpose:'IX01_0076_ATOMICITY_NEGATIVE_CLAIM_RECEIPT',attemptId,approvalId,sourceHead:binding.sourceHead,
 planHash:binding.planHash,approvalHash:binding.approvalHash,graphHash:binding.graphHash,receiptPath:receiptRoot+'/claim-v1.json',claimedAt:at-500,
 evidence:'SOURCE_STAGE_ONLY',runtimeVerified:false,executionAuthorized:false});
const claimBytes=new Uint8Array(Buffer.from(canonicalJson(claim),'utf8'));
const catalogHash='6'.repeat(64);
const stage=Object.freeze({status:'OBSERVATIONS_MATCHED',reason:null,evidence:'SOURCE_STAGE_ONLY',runtimeVerified:false,executionAuthorized:false,
 priorInstalled:106,priorLedgered:106,targetDispatched:true,sourceSha256:current0076NegativeContract.sourceSha256,
 executionSha256:current0076NegativeContract.executionSha256,attemptId,planHash:binding.planHash,graphHash:binding.graphHash,
 expectedSqlState:'42723',statementEndLine:2343,catalogBeforeHash:catalogHash,catalogAfterHash:catalogHash}) satisfies NegativeStageResult;
const observationRef=Object.freeze({id:'d7000000-0000-4000-8000-000000000083',version:1 as const,contentHash:contentHash(canonicalJson(stage))});
function terminal(overrides:Record<string,unknown>={}){return new Uint8Array(Buffer.from(canonicalJson({schemaVersion:1,purpose:current0076NegativeLinuxResultContract.terminalPurpose,
 attemptId,approvalId,planHash:binding.planHash,graphHash:binding.graphHash,containerId:binding.containerId,executionObservationRef:observationRef,
 ownerExit:{confirmed:true,status:0,signal:null},cleanup:{confirmed:true,toolClosed:true,containerStopped:true,containerRemoved:true,unknown:false},observedAt:at-100,...overrides}),'utf8'));}

function fixture(patch:Partial<ReturnType<typeof projection>>={},mode:'OK'|'EXISTS'|'CLOSE_UNKNOWN'|'READBACK_BAD'|'CREATE_EXPIRE'|'MALFORMED_EXTRA'|'WRONG_KIND'='OK'){
 let wall=at,mono=100,stored=new Uint8Array(),create=0,write=0,close=0,remove=0;const handle=Object.freeze(Object.create(null)),timers=new Set<()=>void>();
 const authorityRecipient=Object.freeze(Object.create(null));
 const authority:NegativeLinuxResultAuthorityPorts=Object.freeze({recipient:authorityRecipient,now:()=>wall,monotonic:()=>mono,
  assertCurrent(this:object,found:Readonly<NegativeLinuxResultBinding>){assert.equal(this,authorityRecipient);assert.equal(found,binding);},
  async read(this:object,found:Readonly<NegativeLinuxResultBinding>){assert.equal(this,authorityRecipient);assert.equal(found,binding);return Object.freeze({...projection(),...patch});}});
 const journalRecipient=Object.freeze(Object.create(null));
 const journal:NegativeClaimJournalPorts=Object.freeze({recipient:journalRecipient,schedule(callback:()=>void){timers.add(callback);return()=>timers.delete(callback);},
  async createExclusive(this:object,path:string){create++;assert.equal(this,journalRecipient);assert.equal(path,receiptRoot+'/result-candidate-v1.json');if(mode==='CREATE_EXPIRE')mono+=binding.expiresAt-at;
   if(mode==='EXISTS')return Object.freeze({kind:'EXISTS' as const});if(mode==='MALFORMED_EXTRA')return Object.freeze({kind:'CREATED',handle,extra:true}) as never;
   if(mode==='WRONG_KIND')return Object.freeze({kind:'UNKNOWN',handle}) as never;return Object.freeze({kind:'CREATED' as const,handle});},
  async write(this:object,owned:object,bytes:Uint8Array):Promise<'WRITTEN'>{write++;assert.equal(this,journalRecipient);assert.equal(owned,handle);stored=new Uint8Array(bytes);return'WRITTEN';},
  async syncFile():Promise<'SYNCED'>{return'SYNCED';},async close(this:object,owned:object):Promise<'CLOSED'|'UNKNOWN'>{close++;assert.equal(this,journalRecipient);assert.equal(owned,handle);return mode==='CLOSE_UNKNOWN'?'UNKNOWN':'CLOSED';},
  async syncDirectory():Promise<'SYNCED'>{return'SYNCED';},async readback(){return mode==='READBACK_BAD'?new Uint8Array([1]):new Uint8Array(stored);}});
 const recorder=create0076NegativeLinuxResultRecorder(authority,journal);
 return{recorder,get create(){return create;},get write(){return write;},get close(){return close;},get remove(){return remove;},get stored(){return stored;},expire(){wall=binding.expiresAt;mono+=binding.expiresAt-at;for(const timer of timers)timer();}};
}
function projection(){return{
 schemaVersion:1 as const,purpose:current0076NegativeLinuxResultContract.authorityPurpose,decision:'VERIFY_RESULT_CANDIDATE_ONLY' as const,
 attemptId,approvalId,sourceHead:binding.sourceHead,planHash:binding.planHash,approvalHash:binding.approvalHash,graphHash:binding.graphHash,
  containerId:binding.containerId,issuedAt:binding.issuedAt,expiresAt:binding.expiresAt,claimReceipt:new Uint8Array(claimBytes),terminalReceipt:terminal(),observedAt:at-100,
 };}

test('원 claim·실행·종료·정리가 같은 exact binding일 때만 SOURCE_STAGE_ONLY 후보를 기록한다',async()=>{
 const h=fixture(),result=await h.recorder.record(binding,stage);
 assert.equal(result.status,'RESULT_CANDIDATE_RECORDED_NOT_DURABLE');assert.equal(result.runtimeVerified,false);assert.equal(result.executionAuthorized,false);
 assert.equal(result.acceptance,false);assert.equal(h.create,1);assert.equal(h.write,1);assert.equal(h.close,1);
 const raw=Buffer.from(h.stored).toString('utf8'),saved=JSON.parse(raw);assert.equal(raw,canonicalJson(saved));
 assert.equal(saved.purpose,current0076NegativeLinuxResultContract.candidatePurpose);assert.equal(saved.claimReceiptHash,contentHash(claimBytes));
 assert.equal(saved.attemptId,attemptId);assert.equal(saved.containerId,binding.containerId);assert.equal(saved.priorInstalled,106);assert.equal(saved.priorLedgered,106);
 assert.equal(saved.sqlState,'42723');assert.equal(saved.statementEndLine,2343);assert.equal(saved.catalogBeforeHash,catalogHash);assert.equal(saved.catalogAfterHash,catalogHash);
 assert.equal(saved.ownerExitConfirmed,true);assert.equal(saved.cleanupConfirmed,true);assert.equal(saved.evidence,'SOURCE_STAGE_ONLY');assert.equal(saved.durable,false);
});

test('NegativeStageResult 단독 또는 exact 결박·정리 불일치는 기록 효과 0이다',async()=>{
 for(const patch of [{approvalId:'d7000000-0000-4000-8000-000000000099'},{containerId:'7'.repeat(64)},{terminalReceipt:terminal({cleanup:{confirmed:false,toolClosed:true,containerStopped:true,containerRemoved:true,unknown:true}})},{terminalReceipt:terminal({executionObservationRef:{...observationRef,contentHash:'7'.repeat(64)}})}] as const){
  const h=fixture(patch);assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN');assert.equal(h.create,0);assert.equal(h.write,0);
 }
 const h=fixture(),wrong=Object.freeze({...stage,catalogAfterHash:'7'.repeat(64)}) as NegativeStageResult;
 assert.equal((await h.recorder.record(binding,wrong)).status,'UNKNOWN');assert.equal(h.create,0);
});

test('동일 exact attempt는 결과 불명·선존 포함 한 번만 소비하고 재발급·삭제하지 않는다',async()=>{
 for(const mode of ['EXISTS','CLOSE_UNKNOWN','READBACK_BAD'] as const){
  const h=fixture({},mode);assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN');const first=[h.create,h.write,h.close,h.remove];
  assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN');assert.deepEqual([h.create,h.write,h.close,h.remove],first);assert.equal(h.remove,0);
 }
});

test('wall 정체 중 mono 원 절대기한 도달은 만료이며 늦은 create handle을 자동 close·삭제하지 않는다',async()=>{
 const h=fixture({},'CREATE_EXPIRE');assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN');assert.equal(h.create,1);assert.equal(h.write,0);assert.equal(h.close,0);assert.equal(h.remove,0);
 assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN');assert.equal(h.create,1);assert.equal(h.close,0);
});

test('handle을 포함한 malformed create 결과는 쓰기·close·삭제 없이 시도를 소진한다',async()=>{
 for(const mode of ['MALFORMED_EXTRA','WRONG_KIND'] as const){const h=fixture({},mode);assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN',mode);
  assert.equal(h.create,1);assert.equal(h.write,0);assert.equal(h.close,0);assert.equal(h.remove,0);assert.equal((await h.recorder.record(binding,stage)).status,'UNKNOWN');assert.equal(h.create,1);}
});

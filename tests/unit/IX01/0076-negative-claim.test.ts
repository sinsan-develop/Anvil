import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {current0076NegativeContract as stageContract,type NegativeOwnedTarget,type NegativeStagePorts} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 create0076NegativeClaim,
 current0076NegativeClaimContract as claimContract,
 type NegativeClaimAuthorityPorts,
 type NegativeClaimJournalPorts,
} from '../../../scripts/qa-ix01-0076-negative-claim.ts';

type StageBinding=Parameters<NegativeStagePorts['claim']>[0];
const at=Date.parse('2026-11-25T01:00:00.000Z');
const attemptId='d7000000-0000-4000-8000-000000000031';
const approvalId='d7000000-0000-4000-8000-000000000032';
const receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId;
const receiptPath=receiptRoot+'/claim-v1.json';
const binding=Object.freeze({
 purpose:stageContract.purpose,attemptId,sourceHead:'8'.repeat(40),planHash:'9'.repeat(64),approvalHash:'a'.repeat(64),approvalId,
 graphHash:'b'.repeat(64),issuedAt:at-1000,expiresAt:at+30000,
 namespace:Object.freeze({container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),receipt:receiptRoot,network:'none' as const}),
}) as StageBinding;

function authorityProjection(found:StageBinding=binding){
 return Object.freeze({
  schemaVersion:1 as const,purpose:claimContract.authorityPurpose,decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE' as const,
  attemptId:found.attemptId,approvalId:found.approvalId,sourceHead:found.sourceHead,planHash:found.planHash,approvalHash:found.approvalHash,
  graphHash:found.graphHash,issuedAt:found.issuedAt,expiresAt:found.expiresAt,receiptPath,
 });
}

function fixture(mode:'OK'|'EXISTS'|'WRITE_UNKNOWN'|'SYNC_UNKNOWN'|'DIRECTORY_UNKNOWN'|'READBACK_BAD'|'CLOSE_UNKNOWN'|'CLOSE_PENDING'|'AUTHORITY_BAD'|'EXPIRE'|'CREATE_EXPIRE'|'AUTHORITY_PENDING'|'CREATE_PENDING'|'WRITE_PENDING'|'PRE_WORK_EXPIRE'='OK',selected:StageBinding=binding){
 let wall=at,mono=100,stored=new Uint8Array(),authorityCalls=0,createCalls=0,writeCalls=0,syncCalls=0,directoryCalls=0,readCalls=0,closeCalls=0;
 let prepareCalls=0,installCalls=0,resolveAuthority:((value:Readonly<ReturnType<typeof authorityProjection>>)=>void)|undefined;
 let resolveCreate:((value:Readonly<{kind:'CREATED';handle:object}>)=>void)|undefined,resolveWrite:((value:'WRITTEN')=>void)|undefined;
 const timers=new Set<()=>void>(),scheduled:number[]=[],trace:string[]=[],currentTargets:(Readonly<NegativeOwnedTarget>|null)[]=[];const handle=Object.freeze(Object.create(null));
 const base:NegativeStagePorts={
  now:()=>wall,monotonic:()=>mono,assertCurrent(_found,target){trace.push('current');currentTargets.push(target);},async claim(){throw Error('base claim must be replaced');},
  async prepare(found){prepareCalls++;return{schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId:found.attemptId,sourceHead:found.sourceHead,planHash:found.planHash,graphHash:found.graphHash,namespace:{...found.namespace},containerId:'c'.repeat(64)};},
  async install(){installCalls++;throw Error('unused');},async appendLedger(){throw Error('unused');},async sentinel(){throw Error('unused');},async catalog(){throw Error('unused');},
 };
 const authorityRecipient=Object.freeze(Object.create(null));
 const authority:NegativeClaimAuthorityPorts={
  recipient:authorityRecipient,
  async read(this:object,request){authorityCalls++;trace.push('authority');assert.equal(this,authorityRecipient);assert.equal(request,selected);
   if(mode==='EXPIRE'){wall=selected.expiresAt;mono+=selected.expiresAt-at;}
   if(mode==='AUTHORITY_PENDING')return new Promise(resolve=>{resolveAuthority=resolve;});
   if(mode==='AUTHORITY_BAD')return Object.freeze({...authorityProjection(selected),graphHash:'c'.repeat(64)});
   return authorityProjection(selected);
  },
 };
 const journalRecipient=Object.freeze(Object.create(null));
 const journal:NegativeClaimJournalPorts={
  recipient:journalRecipient,
  schedule(callback,ms){assert(ms>0&&ms<=600000);scheduled.push(ms);timers.add(callback);
   if(mode==='PRE_WORK_EXPIRE')queueMicrotask(()=>{wall=selected.expiresAt;mono+=selected.expiresAt-at;});return()=>{timers.delete(callback);};},
  async createExclusive(this:object,path){createCalls++;trace.push('create');assert.equal(this,journalRecipient);assert.equal(path,receiptPath);
   if(mode==='EXISTS')return Object.freeze({kind:'EXISTS' as const});if(mode==='CREATE_PENDING')return new Promise(resolve=>{resolveCreate=resolve;});
   if(mode==='CREATE_EXPIRE'){wall=selected.expiresAt;mono+=selected.expiresAt-at;}return Object.freeze({kind:'CREATED' as const,handle});},
  async write(this:object,owned,bytes){writeCalls++;trace.push('write');assert.equal(this,journalRecipient);assert.equal(owned,handle);stored=new Uint8Array(bytes);
   if(mode==='WRITE_PENDING')return new Promise(resolve=>{resolveWrite=resolve;});return mode==='WRITE_UNKNOWN'?'UNKNOWN':'WRITTEN';},
  async syncFile(this:object,owned){syncCalls++;trace.push('syncFile');assert.equal(this,journalRecipient);assert.equal(owned,handle);return mode==='SYNC_UNKNOWN'?'UNKNOWN':'SYNCED';},
  async close(this:object,owned){closeCalls++;trace.push('close');assert.equal(this,journalRecipient);assert.equal(owned,handle);if(mode==='CLOSE_PENDING')return new Promise(()=>{});return mode==='CLOSE_UNKNOWN'?'UNKNOWN':'CLOSED';},
  async syncDirectory(this:object,path){directoryCalls++;trace.push('syncDirectory');assert.equal(this,journalRecipient);assert.equal(path,receiptRoot);return mode==='DIRECTORY_UNKNOWN'?'UNKNOWN':'SYNCED';},
  async readback(this:object,path){readCalls++;trace.push('readback');assert.equal(this,journalRecipient);assert.equal(path,receiptPath);return mode==='READBACK_BAD'?new Uint8Array([1]):new Uint8Array(stored);},
 };
 const adapter=create0076NegativeClaim(base,authority,journal);
 return{adapter,trace,currentTargets,scheduled,get stored(){return stored;},get authorityCalls(){return authorityCalls;},get createCalls(){return createCalls;},get writeCalls(){return writeCalls;},get syncCalls(){return syncCalls;},get directoryCalls(){return directoryCalls;},get readCalls(){return readCalls;},get closeCalls(){return closeCalls;},get prepareCalls(){return prepareCalls;},get installCalls(){return installCalls;},
  expire(){for(const callback of [...timers])callback();},resolveAuthority(){resolveAuthority?.(authorityProjection(selected));},resolveCreate(){resolveCreate?.(Object.freeze({kind:'CREATED',handle}));},resolveWrite(){resolveWrite?.('WRITTEN');},setExpired(){wall=selected.expiresAt;mono+=selected.expiresAt-at;}};
}

test('exact authority와 한 opaque handle의 create-write-sync-close 및 directory-sync-readback 뒤에만 CLAIMED다',async()=>{
 const h=fixture();assert.equal(await h.adapter.claim(binding),'CLAIMED');
 assert.deepEqual(h.trace.filter(value=>value!=='current'),['authority','create','write','syncFile','close','syncDirectory','readback']);
 const raw=Buffer.from(h.stored).toString('utf8'),receipt=JSON.parse(raw);
 assert.equal(raw,canonicalJson(receipt));assert.equal(receipt.purpose,claimContract.receiptPurpose);assert.equal(receipt.attemptId,attemptId);
 assert.equal(receipt.approvalId,approvalId);assert.equal(receipt.planHash,binding.planHash);assert.equal(receipt.approvalHash,binding.approvalHash);
 assert.equal(receipt.graphHash,binding.graphHash);assert.equal(receipt.receiptPath,receiptPath);assert.equal(receipt.evidence,'SOURCE_STAGE_ONLY');
 assert.equal(receipt.runtimeVerified,false);assert.equal(receipt.executionAuthorized,false);assert.equal(receipt.receiptHash,undefined);
 assert.equal(await h.adapter.claim(binding),'UNKNOWN');assert.equal(h.authorityCalls,1);assert.equal(h.createCalls,1);assert.equal(h.closeCalls,1);
});

test('authority mismatch·expiry는 exclusive create 전 fail closed다',async()=>{
 for(const mode of ['AUTHORITY_BAD','EXPIRE'] as const){const h=fixture(mode);assert.equal(await h.adapter.claim(binding),'UNKNOWN',mode);assert.equal(h.authorityCalls,1);assert.equal(h.createCalls,0);assert.equal(h.closeCalls,0);}
});

test('EXISTS는 정착 판독 증거가 없으므로 성공·중복 확정 없이 UNKNOWN이다',async()=>{
 const h=fixture('EXISTS');assert.equal(await h.adapter.claim(binding),'UNKNOWN');
 assert.equal(h.createCalls,1);assert.equal(h.writeCalls,0);assert.equal(h.syncCalls,0);assert.equal(h.directoryCalls,0);assert.equal(h.readCalls,0);assert.equal(h.closeCalls,0);
 assert.equal(await h.adapter.claim(binding),'UNKNOWN');assert.equal(h.createCalls,1);
});

test('write·file/directory sync·readback·close 불명은 close 외 retry·cleanup 없이 UNKNOWN이다',async()=>{
 for(const mode of ['WRITE_UNKNOWN','SYNC_UNKNOWN','DIRECTORY_UNKNOWN','READBACK_BAD','CLOSE_UNKNOWN'] as const){
  const h=fixture(mode);assert.equal(await h.adapter.claim(binding),'UNKNOWN',mode);assert.equal(h.createCalls,1);assert.equal(h.closeCalls,1,mode);
  const before=[h.authorityCalls,h.createCalls,h.writeCalls,h.syncCalls,h.directoryCalls,h.readCalls,h.closeCalls];assert.equal(await h.adapter.claim(binding),'UNKNOWN');
  assert.deepEqual([h.authorityCalls,h.createCalls,h.writeCalls,h.syncCalls,h.directoryCalls,h.readCalls,h.closeCalls],before,mode);
 }
});

test('다른 binding은 authority·receipt·prepare 권위를 만들지 않는다',async()=>{
 const h=fixture();const other=Object.freeze({...binding,attemptId:'d7000000-0000-4000-8000-000000000099'}) as StageBinding;
 assert.equal(await h.adapter.claim(other),'UNKNOWN');assert.equal(h.authorityCalls,0);assert.equal(h.createCalls,0);
});

test('claim 정착 전과 만료 뒤 prepare·하위 효과는 base를 호출하지 않는다',async()=>{
 let h=fixture();await assert.rejects(h.adapter.prepare(binding));assert.equal(h.prepareCalls,0);
 await assert.rejects(h.adapter.install({} as never,new Uint8Array(),{} as never,1));assert.equal(h.installCalls,0);
 h=fixture();assert.equal(await h.adapter.claim(binding),'CLAIMED');assert.equal((await h.adapter.prepare(binding)).attemptId,attemptId);assert.equal(h.prepareCalls,1);
 h.setExpired();await assert.rejects(h.adapter.prepare(binding));assert.equal(h.prepareCalls,1);
});

test('authority·write 대기는 원 기한에 UNKNOWN이고 늦은 handle은 한 번만 회수한다',async()=>{
 let h=fixture('AUTHORITY_PENDING');let pending=h.adapter.claim(binding);for(let i=0;i<10&&h.authorityCalls===0;i++)await Promise.resolve();
 h.expire();assert.equal(await pending,'UNKNOWN');h.resolveAuthority();await Promise.resolve();assert.equal(h.createCalls,0);
 h=fixture('CREATE_PENDING');pending=h.adapter.claim(binding);for(let i=0;i<100&&h.createCalls===0;i++)await Promise.resolve();
 h.expire();assert.equal(await pending,'UNKNOWN');h.resolveCreate();for(let i=0;i<10&&h.closeCalls===0;i++)await Promise.resolve();assert.equal(h.closeCalls,1);assert.equal(h.writeCalls,0);
 h=fixture('WRITE_PENDING');pending=h.adapter.claim(binding);for(let i=0;i<100&&h.writeCalls===0;i++)await Promise.resolve();assert.equal(h.writeCalls,1);
 h.expire();assert.equal(await pending,'UNKNOWN');h.resolveWrite();for(let i=0;i<10&&h.closeCalls===0;i++)await Promise.resolve();assert.equal(h.closeCalls,1);assert.equal(h.syncCalls,0);
});

test('create가 handle을 반환한 직후 current를 잃어도 원 handle close를 한 번 시도한다',async()=>{
 const h=fixture('CREATE_EXPIRE');assert.equal(await h.adapter.claim(binding),'UNKNOWN');for(let i=0;i<10&&h.closeCalls===0;i++)await Promise.resolve();
 assert.equal(h.createCalls,1);assert.equal(h.closeCalls,1);assert.equal(h.writeCalls,0);
});

test('close가 응답하지 않아도 원 handle close는 한 번만 시작하고 UNKNOWN을 반환한다',async()=>{
 const h=fixture('CLOSE_PENDING'),pending=h.adapter.claim(binding);for(let i=0;i<100&&h.closeCalls===0;i++)await Promise.resolve();
 assert.equal(h.closeCalls,1);h.expire();assert.equal(await pending,'UNKNOWN');assert.equal(h.closeCalls,1);
 assert.equal(await h.adapter.claim(binding),'UNKNOWN');assert.equal(h.closeCalls,1);
});

test('scheduler 뒤 operation microtask 직전 current를 잃으면 authority effect를 시작하지 않는다',async()=>{
 const h=fixture('PRE_WORK_EXPIRE');assert.equal(await h.adapter.claim(binding),'UNKNOWN');assert.equal(h.authorityCalls,0);assert.equal(h.createCalls,0);
});

test('claim 총 상한은 긴 binding에도 최초 anchor부터 10분을 넘지 않는다',async()=>{
 const longBinding=Object.freeze({...binding,expiresAt:at+1200000}) as StageBinding,h=fixture('OK',longBinding);
 assert.equal(await h.adapter.claim(longBinding),'CLAIMED');assert.equal(h.scheduled[0],600000);assert(h.scheduled.every(value=>value<=600000));
});

test('prepare owner와 별개인 실제 stage target 한 참조만 하위 효과에 사용할 수 있다',async()=>{
 const h=fixture();assert.equal(await h.adapter.claim(binding),'CLAIMED');const owner=await h.adapter.prepare(binding);
 const target=Object.freeze({...owner,namespace:binding.namespace});assert.notEqual(target,owner);h.adapter.assertCurrent(binding,target);
 await assert.rejects(h.adapter.install(target,new Uint8Array([1]),{} as never,1));assert.equal(h.installCalls,1);
 const alias=Object.freeze({...target,namespace:binding.namespace});assert.throws(()=>h.adapter.assertCurrent(binding,alias));assert.equal(h.installCalls,1);
 assert.equal(h.currentTargets.at(-1),alias);
});

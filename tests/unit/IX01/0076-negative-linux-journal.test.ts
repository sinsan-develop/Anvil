import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeContract,type NegativeStagePorts} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {create0076NegativeClaim,current0076NegativeClaimContract,type NegativeClaimAuthorityPorts} from '../../../scripts/qa-ix01-0076-negative-claim.ts';
import {current0076NegativeLinuxApprovalContract,type NegativeLinuxApprovalProjection} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';
import {create0076NegativeLinuxJournal,type NegativeLinuxJournalAuthority,type NegativeLinuxJournalStat,type NegativeLinuxJournalSystem} from '../../../scripts/qa-ix01-0076-negative-linux-journal.ts';

let sequence=300;
function fixture(mode:'NORMAL'|'EXISTS'|'CLOSE_UNKNOWN'|'DRIFT'|'OPEN_VERIFY_UNKNOWN'|'DIRECTORY_SYNC_UNKNOWN'|'READBACK_TRUNCATED'='NORMAL'){
 const attemptId='a7000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),approvalId='a7100000-0000-4000-8000-'+String(sequence).padStart(12,'0');
 const sourceHead='a'.repeat(40),planHash='b'.repeat(64),approvalHash='c'.repeat(64),graphHash='d'.repeat(64),issuedAt=4_000_000,expiresAt=4_600_000;
 const receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,receiptPath=receiptRoot+'/claim-v1.json',compact=attemptId.replaceAll('-','');
 const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,receipt:receiptRoot,network:'none' as const});
 const binding=Object.freeze({purpose:current0076NegativeContract.purpose,attemptId,sourceHead,planHash,approvalHash,approvalId,graphHash,issuedAt,expiresAt,namespace});
 const approval=Object.freeze({schemaVersion:1 as const,purpose:current0076NegativeLinuxApprovalContract.verifiedPurpose,attemptId,sourceHead,planHash,approvalHash,graphHash,
  dependencyHashes:Object.freeze(current0076NegativeLinuxApprovalContract.dependencyPaths.map((path,index)=>Object.freeze({path,bytes:index+1,sha256:String(index+1).repeat(64).slice(0,64)}))),
  evidence:'PROTECTED_READ_SOURCE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const}) satisfies NegativeLinuxApprovalProjection;
 const directories=['/home','/home/daon','/home/daon/.local','/home/daon/.local/share','/home/daon/.local/share/anvil-v3-qa-receipts',receiptRoot];
 let ino=10;const stats=new Map<string,NegativeLinuxJournalStat>();for(const path of directories)stats.set(path,Object.freeze({kind:'DIRECTORY' as const,dev:1,ino:ino++,uid:path===receiptRoot?1000:path==='/home'?0:1000,mode:path===receiptRoot?0o40700:0o40755,nlink:1,size:0,mtimeMs:1,ctimeMs:1}));
 const files=new Map<string,Uint8Array>();if(mode==='EXISTS'){files.set(receiptPath,new Uint8Array(Buffer.from('preserve')));stats.set(receiptPath,Object.freeze({kind:'FILE',dev:1,ino:ino++,uid:1000,mode:0o100600,nlink:1,size:8,mtimeMs:1,ctimeMs:1}));}
 const recipient=Object.freeze(Object.create(null)),handles=new Map<object,{path:string;kind:'FILE'|'DIRECTORY';offset:number}>(),trace:string[]=[];let closeAttempts=0,currentCalls=0;
 const error=(code:string)=>Object.assign(Error(code),{code});
 const system=Object.freeze({recipient,
  lstat(this:object,path:string){assert.equal(this,recipient);const found=stats.get(path);if(!found)throw error('ENOENT');if(mode==='DRIFT'&&trace.includes('write')&&path===receiptRoot)return Object.freeze({...found,ino:found.ino+1});return found;},
  realpath(this:object,path:string){assert.equal(this,recipient);return path;},
  open(this:object,path:string,flags:number,permission?:number){assert.equal(this,recipient);trace.push('open');if((flags&constants.O_EXCL)!==0){assert.equal(flags,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW);assert.equal(path,receiptPath);assert.equal(permission,0o600);if(files.has(path))throw error('EEXIST');files.set(path,new Uint8Array());stats.set(path,Object.freeze({kind:'FILE',dev:1,ino:ino++,uid:1000,mode:0o100600,nlink:1,size:0,mtimeMs:2,ctimeMs:2}));}
   else if(path===receiptRoot)assert.equal(flags,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);else assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const stat=stats.get(path);if(!stat)throw error('ENOENT');const handle=Object.freeze(Object.create(null));handles.set(handle,{path,kind:stat.kind,offset:0});return handle;},
  fstat(this:object,handle:object){assert.equal(this,recipient);const found=handles.get(handle);if(!found)throw error('EBADF');if(mode==='OPEN_VERIFY_UNKNOWN'&&found.path===receiptPath)throw error('EIO');return stats.get(found.path)!;},
  write(this:object,handle:object,bytes:Uint8Array,offset:number){assert.equal(this,recipient);const found=handles.get(handle);if(!found)throw error('EBADF');trace.push('write');const prior=files.get(found.path)??new Uint8Array(),next=new Uint8Array(Math.max(prior.byteLength,offset+bytes.byteLength));next.set(prior);next.set(bytes,offset);files.set(found.path,next);const stat=stats.get(found.path)!;stats.set(found.path,Object.freeze({...stat,size:next.byteLength,mtimeMs:3,ctimeMs:3}));return bytes.byteLength;},
  read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number){assert.equal(this,recipient);const found=handles.get(handle);if(!found)throw error('EBADF');const bytes=files.get(found.path)!,available=(mode==='READBACK_TRUNCATED'?Math.max(0,bytes.byteLength-1):bytes.byteLength)-found.offset;if(available<=0)return 0;const count=Math.min(length,available);buffer.set(bytes.subarray(found.offset,found.offset+count),offset);found.offset+=count;return count;},
  sync(this:object,handle:object){assert.equal(this,recipient);assert(handles.has(handle));const kind=handles.get(handle)!.kind;trace.push(kind==='DIRECTORY'?'syncDirectory':'syncFile');if(mode==='DIRECTORY_SYNC_UNKNOWN'&&kind==='DIRECTORY')throw error('EIO');},
  close(this:object,handle:object){assert.equal(this,recipient);closeAttempts++;if(!handles.has(handle))throw error('EBADF');if(mode==='CLOSE_UNKNOWN')throw error('EIO');handles.delete(handle);trace.push('close');},
  schedule(this:object,callback:()=>void,ms:number){assert.equal(this,recipient);assert.equal(typeof callback,'function');assert(ms>0);return Object.freeze({callback});},
  cancel(this:object,token:object){assert.equal(this,recipient);assert(token);},
 }) satisfies NegativeLinuxJournalSystem;
 const authorityRecipient=Object.freeze(Object.create(null)),authority=Object.freeze({recipient:authorityRecipient,approval,receiptRoot,uid:1000,
  assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalProjection>){assert.equal(this,authorityRecipient);assert.equal(found,approval);currentCalls++;},}) satisfies NegativeLinuxJournalAuthority;
 let wall=4_100_000,mono=100,prepareCalls=0;
 const base:Object&NegativeStagePorts={
  now(){return wall;},monotonic(){return mono++;},assertCurrent(found){assert.equal(found,binding);},async claim(){throw Error('replaced');},
  async prepare(){prepareCalls++;return Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId,sourceHead,planHash,graphHash,namespace,containerId:'e'.repeat(64)});},
  async install(){throw Error('not used');},async appendLedger(){throw Error('not used');},async sentinel(){throw Error('not used');},async catalog(){throw Error('not used');},
 };
 const claimAuthorityRecipient=Object.freeze(Object.create(null)),claimAuthority=Object.freeze({recipient:claimAuthorityRecipient,async read(this:object){assert.equal(this,claimAuthorityRecipient);return Object.freeze({schemaVersion:1 as const,purpose:current0076NegativeClaimContract.authorityPurpose,decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE' as const,attemptId,approvalId,sourceHead,planHash,approvalHash,graphHash,issuedAt,expiresAt,receiptPath});}}) satisfies NegativeClaimAuthorityPorts;
 const journal=create0076NegativeLinuxJournal(authority,system),adapter=create0076NegativeClaim(base,claimAuthority,journal);
 return{adapter,journal,binding,approval,authority,system,receiptPath,receiptRoot,files,trace,get handles(){return handles.size;},get closeAttempts(){return closeAttempts;},get currentCalls(){return currentCalls;},get prepareCalls(){return prepareCalls;}};
}

test('보호 approval와 같은 시도의 claim-v1만 배타 write·fsync·close·directory fsync·readback한다',async()=>{
 const h=fixture();assert.equal(await h.adapter.claim(h.binding),'CLAIMED');
 const stored=h.files.get(h.receiptPath)!;assert.equal(contentHash(stored),contentHash(new Uint8Array(Buffer.from(canonicalJson(JSON.parse(Buffer.from(stored).toString('utf8')))))));
 assert.deepEqual(h.trace,['open','write','syncFile','close','open','syncDirectory','close','open','close']);assert.equal(h.handles,0);assert(h.currentCalls>0);
});

test('선존 영수증은 보존하고 write·sync·readback·prepare를 시작하지 않는다',async()=>{
 const h=fixture('EXISTS'),before=new Uint8Array(h.files.get(h.receiptPath)!);assert.equal(await h.adapter.claim(h.binding),'UNKNOWN');
 assert.deepEqual(h.files.get(h.receiptPath),before);assert.deepEqual(h.trace,['open']);assert.equal(h.prepareCalls,0);assert.equal(h.handles,0);
});

test('parent drift와 close 불명은 CLAIMED를 만들거나 재close·후속 효과를 시작하지 않는다',async()=>{
 for(const mode of ['DRIFT','CLOSE_UNKNOWN','OPEN_VERIFY_UNKNOWN'] as const){const h=fixture(mode);assert.equal(await h.adapter.claim(h.binding),'UNKNOWN',mode);assert.equal(h.prepareCalls,0);
  if(mode==='CLOSE_UNKNOWN'){assert.equal(h.closeAttempts,1);assert.equal(h.handles,1);assert(!h.trace.includes('syncDirectory'));}}
});

test('directory sync와 readback 불명은 상태를 소진해 직접 재호출도 I/O를 시작하지 않는다',async()=>{
 for(const mode of ['DIRECTORY_SYNC_UNKNOWN','READBACK_TRUNCATED'] as const){const h=fixture(mode);assert.equal(await h.adapter.claim(h.binding),'UNKNOWN',mode);const before=h.trace.length;
  if(mode==='DIRECTORY_SYNC_UNKNOWN')assert.equal(await h.journal.syncDirectory.call(h.journal.recipient,h.receiptRoot),'UNKNOWN');
  else await assert.rejects(h.journal.readback.call(h.journal.recipient,h.receiptPath));assert.equal(h.trace.length,before);}
});

test('검증된 approval가 아니거나 exact claim path가 아니면 filesystem 효과가 없다',async()=>{
 const h=fixture(),forged=Object.freeze({...h.approval,executionAuthorized:true});
 assert.throws(()=>create0076NegativeLinuxJournal(Object.freeze({...h.authority,approval:forged}) as unknown as NegativeLinuxJournalAuthority,h.system));assert.deepEqual(h.trace,[]);
 const journal=create0076NegativeLinuxJournal(h.authority,h.system);assert.deepEqual(await journal.createExclusive.call(journal.recipient,h.receiptRoot+'/other.json'),{kind:'UNKNOWN'});assert.deepEqual(h.trace,[]);
});

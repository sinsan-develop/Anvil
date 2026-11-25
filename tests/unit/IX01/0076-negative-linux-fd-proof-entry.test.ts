import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import {
 assemble0076NegativeLinuxFdProofEntryForRam,
 current0076NegativeLinuxFdProofEntryContract,
 run0076NegativeLinuxFdProofEntry,
 type NegativeLinuxFdProofEntryAuthority,
} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof-entry.ts';
import type {NegativeLinuxFdProofNodePorts,NegativeLinuxFdProofNodeStat} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof-system.ts';

const attemptId='00000000-0000-4000-8000-000000000601';
const bytes=Uint8Array.from([0x7f,0x45,0x4c,0x46]);
const stat=Object.freeze<NegativeLinuxFdProofNodeStat>({kind:'FILE',dev:8,ino:61,uid:0,gid:0,mode:0o100755,nlink:1,size:bytes.byteLength,mtimeMs:10.5,ctimeMs:11.25});

function fixture(){
 const candidate=Object.freeze({schemaVersion:1 as const,purpose:current0076NegativeLinuxFdProofEntryContract.candidatePurpose,attemptId,sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),sourceHash:'c'.repeat(64),graphHash:'d'.repeat(64),issuedAt:1000,expiresAt:9000});
 const recipient=Object.freeze({}),platformRecipient=Object.freeze({}),child=new EventEmitter() as EventEmitter&{pid:number};child.pid=612;
 let opens=0,spawns=0,kills=0,closes=0;
 const authority=Object.freeze<NegativeLinuxFdProofEntryAuthority>({recipient,candidate,now:()=>1000,monotonic:()=>10,assertCurrent(this:object,found){assert.equal(this,recipient);assert.equal(found,candidate);}});
 const ports=Object.freeze<NegativeLinuxFdProofNodePorts>({recipient:platformRecipient,
  lstat(){return stat;},open(){opens++;return 73;},fstat(){return stat;},readlink(){return '/usr/bin/sleep';},read(_fd,offset,length){return bytes.slice(offset,offset+length);},
  spawn(_file,_args,_options){spawns++;return child;},childPid(){return child.pid;},statPath(){return stat;},
  on(_child,event,listener){child.on(event,listener);},off(_child,event,listener){child.off(event,listener);},
  kill(){kills++;queueMicrotask(()=>{child.emit('exit',null,'SIGTERM');child.emit('close',null,'SIGTERM');});return true;},
  setTimer(){return Object.freeze({});},clearTimer(){},close(){closes++;},
 });
 return {candidate,authority,ports,metrics:()=>({opens,spawns,kills,closes})};
}

test('production entry stays closed before protected evidence while the same closure assembles the RAM source candidate',async()=>{
 const h=fixture();
 const closed=await run0076NegativeLinuxFdProofEntry(h.authority);
 assert.deepEqual(closed,Object.freeze({status:'PROTECTED_START_EVIDENCE_UNAVAILABLE',nativeProviderSelected:false,effectsStarted:false,runtimeVerified:false,executionAuthorized:false}));
 assert.deepEqual(h.metrics(),{opens:0,spawns:0,kills:0,closes:0});

 const synthetic=await assemble0076NegativeLinuxFdProofEntryForRam(h.authority,h.ports);
 assert.equal(synthetic.status,'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED');
 assert.deepEqual(h.metrics(),{opens:1,spawns:1,kills:1,closes:1});
});

test('forged purpose and changed candidate stop before native selection',async()=>{
 const h=fixture();
 const forged=Object.freeze({...h.candidate,purpose:'IX01_0076_NEGATIVE_LINUX_OTHER'});
 const authority=Object.freeze({...h.authority,candidate:forged});
 const result=await run0076NegativeLinuxFdProofEntry(authority as unknown as NegativeLinuxFdProofEntryAuthority);
 assert.equal(result.status,'UNKNOWN');
 assert.deepEqual(h.metrics(),{opens:0,spawns:0,kills:0,closes:0});
});

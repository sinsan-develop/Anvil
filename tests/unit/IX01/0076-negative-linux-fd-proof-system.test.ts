import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {constants} from 'node:fs';
import test from 'node:test';
import {
 bind0076NegativeLinuxFdProofSystemSupplier,
 create0076NegativeLinuxFdProofSystem,
 current0076NegativeLinuxFdProofSystemContract,
 type NegativeLinuxFdProofNodePorts,
 type NegativeLinuxFdProofNodeStat,
} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof-system.ts';
import {
 current0076NegativeLinuxFdProofContract,
 run0076NegativeLinuxFdProof,
 type NegativeLinuxFdProofAuthorityPorts,
 type NegativeLinuxFdProofInvocation,
 type NegativeLinuxFdProofPlan,
} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof.ts';

const uuid=(suffix:string)=>`00000000-0000-4000-8000-${suffix.padStart(12,'0')}`;
const bytes=Uint8Array.from([0x7f,0x45,0x4c,0x46]);
const stat=Object.freeze<NegativeLinuxFdProofNodeStat>({kind:'FILE',dev:8,ino:19,uid:0,gid:0,mode:0o100755,nlink:1,size:bytes.byteLength,mtimeMs:10.25,ctimeMs:11.5});

function fixture(rawAttempt:string,mode:'PASS'|'NO_CLOSE'='PASS'){
 const attemptId=uuid(rawAttempt),recipient=Object.freeze({}),platformRecipient=Object.freeze({}),authorityRecipient=Object.freeze({});
 let supplierCurrent=true,opens=0,spawns=0,kills=0,closes=0,timers=0,clears=0;
 let openedPath='',openedFlags=-1,spawnFile='',spawnArgs:readonly string[]=[],spawnOptions:Readonly<Record<string,unknown>>|undefined,exePath='';
 const child=new EventEmitter() as EventEmitter&{pid:number};child.pid=321;
 const port=Object.freeze<NegativeLinuxFdProofNodePorts>({
  recipient:platformRecipient,
  lstat(this:object,path:string){assert.equal(this,platformRecipient);assert.equal(path,'/usr/bin/sleep');return stat;},
  open(this:object,path:string,flags:number){assert.equal(this,platformRecipient);opens++;openedPath=path;openedFlags=flags;return 71;},
  fstat(this:object,fd:number){assert.equal(this,platformRecipient);assert.equal(fd,71);return stat;},
  readlink(this:object,path:string){assert.equal(this,platformRecipient);assert.equal(path,'/proc/self/fd/71');return '/usr/bin/sleep';},
  read(this:object,fd:number,offset:number,length:number){assert.equal(this,platformRecipient);assert.equal(fd,71);return bytes.slice(offset,offset+length);},
  spawn(this:object,file:string,args:readonly string[],options:Readonly<Record<string,unknown>>){assert.equal(this,platformRecipient);spawns++;spawnFile=file;spawnArgs=args;spawnOptions=options;return child;},
  childPid(this:object,found:object){assert.equal(this,platformRecipient);assert.equal(found,child);return child.pid;},
  statPath(this:object,path:string){assert.equal(this,platformRecipient);exePath=path;return stat;},
  on(this:object,found:object,event:'error'|'exit'|'close',listener:(...values:unknown[])=>void){assert.equal(this,platformRecipient);assert.equal(found,child);child.on(event,listener);},
  off(this:object,found:object,event:'error'|'exit'|'close',listener:(...values:unknown[])=>void){assert.equal(this,platformRecipient);assert.equal(found,child);child.off(event,listener);},
  kill(this:object,found:object,signal:'SIGTERM'){assert.equal(this,platformRecipient);assert.equal(found,child);assert.equal(signal,'SIGTERM');kills++;if(mode==='PASS')queueMicrotask(()=>{child.emit('exit',null,'SIGTERM');child.emit('close',null,'SIGTERM');});return true;},
  setTimer(this:object,callback:()=>void,_ms:number){assert.equal(this,platformRecipient);timers++;const token=Object.freeze({});if(mode==='NO_CLOSE')queueMicrotask(callback);return token;},
  clearTimer(this:object,token:object){assert.equal(this,platformRecipient);assert.ok(Object.isFrozen(token));clears++;},
  close(this:object,fd:number){assert.equal(this,platformRecipient);assert.equal(fd,71);closes++;},
 });
 const supplier=Object.freeze({recipient,attemptId,assertCurrent(this:object,contract:typeof current0076NegativeLinuxFdProofSystemContract){assert.equal(this,recipient);assert.equal(contract.attemptId,attemptId);assert.equal(contract.executable,'/usr/bin/sleep');if(!supplierCurrent)throw Error('REVOKED');}});
 const plan=Object.freeze<NegativeLinuxFdProofPlan>({schemaVersion:1,purpose:current0076NegativeLinuxFdProofContract.purpose,attemptId,issuedAt:1000,expiresAt:9000});
 const authority=Object.freeze<NegativeLinuxFdProofAuthorityPorts>({recipient:authorityRecipient,now:()=>1000,monotonic:()=>10,assertCurrent(this:object,found){assert.equal(this,authorityRecipient);assert.equal(found,plan);}});
 return {attemptId,port,supplier,plan,authority,child,revoke(){supplierCurrent=false;},metrics:()=>({opens,spawns,kills,closes,timers,clears,openedPath,openedFlags,spawnFile,spawnArgs,spawnOptions,exePath})};
}

test('fixed sleep source drives the existing proof with fd3 and confirms exit plus close',async()=>{
 const h=fixture('501');
 const capability=bind0076NegativeLinuxFdProofSystemSupplier(h.supplier);
 const system=create0076NegativeLinuxFdProofSystem(capability,h.port);
 const result=await run0076NegativeLinuxFdProof(h.plan,h.authority,system);
 assert.equal(result.status,'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED');
 const found=h.metrics();
 assert.equal(found.openedPath,'/usr/bin/sleep');
 assert.equal(found.openedFlags,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);
 assert.equal(found.spawnFile,'/proc/self/fd/3');
 assert.deepEqual(found.spawnArgs,['10']);
 assert.equal(found.spawnOptions?.argv0,'anvil-ix01-0076-fd-proof');
 assert.deepEqual(found.spawnOptions?.stdio,['ignore','ignore','ignore',71]);
 assert.deepEqual(found.spawnOptions?.env,{LANG:'C',LC_ALL:'C',PATH:'/usr/bin:/bin'});
 assert.equal(found.exePath,'/proc/321/exe');
 assert.deepEqual([found.opens,found.spawns,found.kills,found.closes],[1,1,1,1]);
 assert.deepEqual([h.child.listenerCount('error'),h.child.listenerCount('exit'),h.child.listenerCount('close')],[0,0,0]);
});

test('supplier loss, arbitrary paths, arbitrary invocations, and duplicate bind fail before effect',()=>{
 const closed=fixture('500');
 const closedCapability=bind0076NegativeLinuxFdProofSystemSupplier(closed.supplier);
 assert.throws(()=>(create0076NegativeLinuxFdProofSystem as unknown as (capability:object)=>unknown)(closedCapability));
 assert.equal(closed.metrics().opens,0);
 create0076NegativeLinuxFdProofSystem(closedCapability,closed.port);

 const lost=fixture('502');
 const lostSystem=create0076NegativeLinuxFdProofSystem(bind0076NegativeLinuxFdProofSystemSupplier(lost.supplier),lost.port);
 lost.revoke();
 assert.throws(()=>lostSystem.openReadOnly.call(lostSystem.recipient,'/usr/bin/sleep'));
 assert.equal(lost.metrics().opens,0);

 const h=fixture('503');
 const capability=bind0076NegativeLinuxFdProofSystemSupplier(h.supplier);
 assert.throws(()=>bind0076NegativeLinuxFdProofSystemSupplier(h.supplier));
 const system=create0076NegativeLinuxFdProofSystem(capability,h.port);
 assert.throws(()=>system.openReadOnly.call(system.recipient,'/tmp/sleep'));
 assert.equal(h.metrics().opens,0);
 const handle=system.openReadOnly.call(system.recipient,'/usr/bin/sleep');
 const forged=Object.freeze<NegativeLinuxFdProofInvocation>({...current0076NegativeLinuxFdProofContract.invocation,argv:Object.freeze(['11'] as unknown as ['10'])});
 assert.throws(()=>system.spawnFromInheritedFd.call(system.recipient,handle,forged));
 assert.equal(h.metrics().spawns,0);
 assert.equal(system.close.call(system.recipient,handle),'CLOSED');
});

test('handle, child, and timer stay bound to one supplier and direct open or spawn is single use',async()=>{
 const left=fixture('505'),right=fixture('506');
 const leftSystem=create0076NegativeLinuxFdProofSystem(bind0076NegativeLinuxFdProofSystemSupplier(left.supplier),left.port);
 const rightSystem=create0076NegativeLinuxFdProofSystem(bind0076NegativeLinuxFdProofSystemSupplier(right.supplier),right.port);
 const handle=leftSystem.openReadOnly.call(leftSystem.recipient,'/usr/bin/sleep');
 assert.throws(()=>leftSystem.openReadOnly.call(leftSystem.recipient,'/usr/bin/sleep'));
 assert.throws(()=>rightSystem.stat.call(rightSystem.recipient,handle));
 assert.equal(right.metrics().opens,0);
 const invocation=Object.freeze<NegativeLinuxFdProofInvocation>({file:'/proc/self/fd/3',argv0:'anvil-ix01-0076-fd-proof',argv:Object.freeze(['10']),inheritedFd:3,shell:false,env:Object.freeze({LANG:'C',LC_ALL:'C',PATH:'/usr/bin:/bin'})});
 const child=leftSystem.spawnFromInheritedFd.call(leftSystem.recipient,handle,invocation);
 assert.throws(()=>leftSystem.spawnFromInheritedFd.call(leftSystem.recipient,handle,invocation));
 assert.throws(()=>rightSystem.terminate.call(rightSystem.recipient,child));
 assert.equal(right.metrics().kills,0);
 const timer=leftSystem.setTimer.call(leftSystem.recipient,()=>{},100);
 assert.throws(()=>rightSystem.clearTimer.call(rightSystem.recipient,timer));
 assert.equal(right.metrics().clears,0);
 leftSystem.inspectChild.call(leftSystem.recipient,child);
 leftSystem.terminate.call(leftSystem.recipient,child);
 await leftSystem.wait.call(leftSystem.recipient,child);
 leftSystem.clearTimer.call(leftSystem.recipient,timer);
 assert.equal(leftSystem.close.call(leftSystem.recipient,handle),'CLOSED');
 assert.deepEqual([left.metrics().opens,left.metrics().spawns,left.metrics().kills,left.metrics().closes],[1,1,1,1]);
});

test('timeout returns UNKNOWN without closing the fd and retains child listeners until late close',async()=>{
 const h=fixture('504','NO_CLOSE');
 const system=create0076NegativeLinuxFdProofSystem(bind0076NegativeLinuxFdProofSystemSupplier(h.supplier),h.port);
 const result=await run0076NegativeLinuxFdProof(h.plan,h.authority,system);
 assert.equal(result.status,'UNKNOWN');
 assert.equal(h.metrics().closes,0);
 assert.ok(h.child.listenerCount('error')>0);
 assert.ok(h.child.listenerCount('close')>0);
 h.child.emit('exit',null,'SIGTERM');
 h.child.emit('close',null,'SIGTERM');
 assert.deepEqual([h.child.listenerCount('error'),h.child.listenerCount('exit'),h.child.listenerCount('close')],[0,0,0]);
});

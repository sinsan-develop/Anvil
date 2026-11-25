import test from 'node:test';
import assert from 'node:assert/strict';
import {
 run0076NegativeLinuxFdProof,current0076NegativeLinuxFdProofContract,
 type NegativeLinuxFdProofAuthorityPorts,type NegativeLinuxFdProofPlan,type NegativeLinuxFdProofSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof.ts';

const at=Date.parse('2026-11-25T13:00:00.000Z');
let sequence=90;
function fixture(mode:'OK'|'IDENTITY'|'CLOSE_UNKNOWN'|'EXPIRED'|'TIMER_SYNC'|'WAIT_REJECT'|'WAIT_PENDING'|'CLOSE_EXPIRE_WALL'|'CLOSE_EXPIRE_MONO'|'CLOSE_REVOKE'='OK'){
 const attemptId=`d7000000-0000-4000-8000-${String(sequence++).padStart(12,'0')}`;
 const plan=Object.freeze({schemaVersion:1 as const,purpose:current0076NegativeLinuxFdProofContract.purpose,attemptId,issuedAt:at-1000,expiresAt:at+9000}) satisfies NegativeLinuxFdProofPlan;
 let wall=at,mono=100,revoked=false,opens=0,spawns=0,terminates=0,waits=0,closes=0,timers=0,clears=0;const handle=Object.freeze(Object.create(null)),child=Object.freeze(Object.create(null));
 const bytes=new Uint8Array(Buffer.from('fixed benign executable bytes'));
 const authorityRecipient=Object.freeze(Object.create(null));
 const authority:NegativeLinuxFdProofAuthorityPorts=Object.freeze({recipient:authorityRecipient,now:()=>wall,monotonic:()=>mono,
  assertCurrent(this:object,found:Readonly<NegativeLinuxFdProofPlan>){assert.equal(this,authorityRecipient);assert.equal(found,plan);if(revoked)throw Error('revoked');}});
 const recipient=Object.freeze(Object.create(null));
 const stat=Object.freeze({path:'/usr/bin/sleep',realpath:'/usr/bin/sleep',kind:'FILE' as const,dev:9,ino:10,uid:0,gid:0,mode:0o100755,nlink:1,size:bytes.byteLength,mtimeMs:1.5,ctimeMs:2.5});
 const system:NegativeLinuxFdProofSystem=Object.freeze({recipient,
  openReadOnly(this:object,path:string){assert.equal(this,recipient);assert.equal(path,'/usr/bin/sleep');opens++;return handle;},
  stat(this:object,found:object){assert.equal(this,recipient);assert.equal(found,handle);return stat;},
  read(this:object,found:object,offset:number,length:number){assert.equal(this,recipient);assert.equal(found,handle);return new Uint8Array(bytes.slice(offset,offset+length));},
  spawnFromInheritedFd(this:object,found:object,invocation:Parameters<NegativeLinuxFdProofSystem['spawnFromInheritedFd']>[1]){assert.equal(this,recipient);assert.equal(found,handle);spawns++;
   assert.deepEqual(invocation,{file:'/proc/self/fd/3',argv0:'anvil-ix01-0076-fd-proof',argv:['10'],inheritedFd:3,shell:false,env:{LANG:'C',LC_ALL:'C',PATH:'/usr/bin:/bin'}});return child;},
  inspectChild(this:object,found:object){assert.equal(this,recipient);assert.equal(found,child);return Object.freeze({pid:1234,exeDev:mode==='IDENTITY'?99:stat.dev,exeIno:stat.ino});},
  terminate(this:object,found:object){assert.equal(this,recipient);assert.equal(found,child);terminates++;return'TERMINATION_REQUESTED' as const;},
  async wait(this:object,found:object){assert.equal(this,recipient);assert.equal(found,child);waits++;if(mode==='WAIT_REJECT')throw Error('wait');if(mode==='WAIT_PENDING')return new Promise<never>(()=>{});return Object.freeze({status:null,signal:'SIGTERM' as const,closed:true});},
  setTimer(this:object,callback:()=>void,ms:number){assert.equal(this,recipient);assert.equal(typeof callback,'function');assert(ms>0&&ms<=10000);timers++;if(mode==='TIMER_SYNC')callback();if(mode==='WAIT_PENDING')queueMicrotask(callback);return Object.freeze({callback});},
  clearTimer(this:object){assert.equal(this,recipient);clears++;},
  close(this:object,found:object){assert.equal(this,recipient);assert.equal(found,handle);closes++;if(mode==='CLOSE_EXPIRE_WALL')wall=plan.expiresAt;
   if(mode==='CLOSE_EXPIRE_MONO')mono+=plan.expiresAt-at;if(mode==='CLOSE_REVOKE')revoked=true;return mode==='CLOSE_UNKNOWN'?'UNKNOWN' as const:'CLOSED' as const;},
 });
 if(mode==='EXPIRED'){wall=plan.expiresAt;mono+=10000;}
 return{plan,authority,system,get opens(){return opens;},get spawns(){return spawns;},get terminates(){return terminates;},get waits(){return waits;},get closes(){return closes;},get timers(){return timers;},get clears(){return clears;}};
}

test('fixed descriptor 3의 /proc/self/fd 실행과 child exe identity가 원 FD와 같을 때만 source 후보다',async()=>{
 const h=fixture(),result=await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system);
 assert.equal(result.status,'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED');assert.equal(result.runtimeVerified,false);assert.equal(result.executionAuthorized,false);
 assert.equal(result.path,'/usr/bin/sleep');assert.equal(result.dev,9);assert.equal(result.ino,10);assert.match(result.sha256!,/^[a-f0-9]{64}$/);
 assert.deepEqual([h.opens,h.spawns,h.terminates,h.waits,h.closes],[1,1,1,1,1]);
});

test('동기 timer·wait reject·timeout은 timer를 한 번 해제하고 child와 FD를 보존한 채 후속 효과를 막는다',async()=>{
 for(const mode of ['TIMER_SYNC','WAIT_REJECT','WAIT_PENDING'] as const){const h=fixture(mode);assert.equal((await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system)).status,'UNKNOWN',mode);
  assert.equal(h.timers,1,mode);assert.equal(h.clears,1,mode);assert.equal(h.closes,0,mode);const before=[h.opens,h.spawns,h.terminates,h.waits,h.closes];
  assert.equal((await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system)).status,'UNKNOWN');assert.deepEqual([h.opens,h.spawns,h.terminates,h.waits,h.closes],before,mode);}
});

test('identity mismatch·만료·close 불명은 권위나 재시도 없이 UNKNOWN이다',async()=>{
 for(const mode of ['IDENTITY','CLOSE_UNKNOWN','EXPIRED'] as const){const h=fixture(mode),result=await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system);assert.equal(result.status,'UNKNOWN',mode);
  const before=[h.opens,h.spawns,h.terminates,h.waits,h.closes];assert.equal((await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system)).status,'UNKNOWN');assert.deepEqual([h.opens,h.spawns,h.terminates,h.waits,h.closes],before,mode);}
});

test('CLOSED 뒤 wall·mono 만료 또는 authority 상실은 UNKNOWN이며 원 FD를 재close하지 않는다',async()=>{
 for(const mode of ['CLOSE_EXPIRE_WALL','CLOSE_EXPIRE_MONO','CLOSE_REVOKE'] as const){const h=fixture(mode);assert.equal((await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system)).status,'UNKNOWN',mode);assert.equal(h.closes,1,mode);
  const before=[h.opens,h.spawns,h.terminates,h.waits,h.closes];assert.equal((await run0076NegativeLinuxFdProof(h.plan,h.authority,h.system)).status,'UNKNOWN');assert.deepEqual([h.opens,h.spawns,h.terminates,h.waits,h.closes],before,mode);}
});

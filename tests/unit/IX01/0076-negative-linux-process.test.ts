import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeContract} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 bind0076NegativeLinuxProcessOwner,create0076NegativeLinuxProcess,
 type NegativeLinuxProcessOwnerPorts,type NegativeLinuxProcessSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-process.ts';
import type {NegativePsqlInvocation} from '../../../scripts/qa-ix01-0076-negative-psql.ts';

const root=new URL('../../../',import.meta.url),original=readFileSync(new URL('db/migrations/0076_native_first_receive.sql.pending',root));
const processSource=readFileSync(new URL('scripts/qa-ix01-0076-negative-linux-process.ts',root),'utf8');
const marker=Buffer.from('COMMIT;\n'),offset=384546;
assert.deepEqual(original.subarray(offset,offset+marker.length),marker);
const sql=new Uint8Array(Buffer.concat([original.subarray(0,offset),original.subarray(offset+marker.length),marker]));
assert.equal(contentHash(sql),current0076NegativeContract.executionSha256);
let sequence=40;
function expected(){
 const attemptId='e7000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),compact=attemptId.replaceAll('-','');
 return Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_PROCESS_OWNER' as const,attemptId,sourceHead:'1'.repeat(40),planHash:'2'.repeat(64),approvalHash:'3'.repeat(64),graphHash:'4'.repeat(64),
  containerId:'5'.repeat(64),database:'ix01_0076_negative_'+compact,receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId});
}
function invocation(e:ReturnType<typeof expected>,patch:Record<string,unknown>={}):Readonly<NegativePsqlInvocation>{
 return Object.freeze({executable:'/usr/bin/docker' as const,argv:Object.freeze(['--config',e.receipt+'/docker-config','--host','unix:///var/run/docker.sock','exec','-i','--user','999:999',e.containerId,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username=anvil_v3_migrator','--dbname='+e.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-']),env:Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:e.receipt}),cwd:'/' as const,stdin:new Uint8Array(sql),timeoutMs:30000,outputLimitBytes:16384 as const,...patch}) as Readonly<NegativePsqlInvocation>;
}
class Stream extends EventEmitter{ended=false;bytes=new Uint8Array();end(value?:Uint8Array){this.ended=true;this.bytes=value?new Uint8Array(value):new Uint8Array();queueMicrotask(()=>this.emit('finish'));}destroy(){}}
class Child extends EventEmitter{stdin=new Stream();stdout=new Stream();stderr=new Stream();}
function fixture(mode:'NORMAL'|'TIMEOUT'|'SYNC_TIMEOUT'|'SCHEDULE_THROW'|'BAD_STREAM'|'OWNER_LOST'|'OWNER_LOST_AT_CLOSE'='NORMAL'){
 const e=expected();let current=0,spawns=0,kills=0,schedules=0,lastOptions:unknown,lastArgs:readonly string[]|undefined;const children:Child[]=[];
 const ownerRecipient=Object.freeze(Object.create(null));
 const owner=Object.freeze({recipient:ownerRecipient,expected:e,assertCurrent(this:object,found:typeof e){current++;assert.equal(this,ownerRecipient);assert.equal(found,e);if(mode==='OWNER_LOST'&&spawns>0||mode==='OWNER_LOST_AT_CLOSE'&&spawns>0&&current>=6)throw Error('lost');}}) satisfies NegativeLinuxProcessOwnerPorts;
 const systemRecipient=Object.freeze(Object.create(null));
 const system=Object.freeze({recipient:systemRecipient,spawn(this:object,file:string,args:readonly string[],options:unknown){assert.equal(this,systemRecipient);assert.equal(file,'/usr/bin/docker');spawns++;lastArgs=args;lastOptions=options;const child=new Child();if(mode==='BAD_STREAM')Object.defineProperty(child,'stdout',{value:Object.freeze({}),enumerable:true});children.push(child);return child;},
  terminate(this:object,child:object,signal:'SIGKILL'){assert.equal(this,systemRecipient);assert(children.includes(child as Child));assert.equal(signal,'SIGKILL');kills++;},
  setTimeout(this:object,callback:()=>void,ms:number){assert.equal(this,systemRecipient);schedules++;if(mode==='SCHEDULE_THROW')throw Error('schedule');if(mode==='SYNC_TIMEOUT')callback();if(mode==='TIMEOUT')queueMicrotask(callback);return Object.freeze({ms});},
  clearTimeout(this:object){assert.equal(this,systemRecipient);},
 }) satisfies NegativeLinuxProcessSystem;
 const capability=bind0076NegativeLinuxProcessOwner(owner),ports=create0076NegativeLinuxProcess(capability,system);
 return{e,owner,system,capability,ports,children,get current(){return current;},get spawns(){return spawns;},get kills(){return kills;},get schedules(){return schedules;},get lastOptions(){return lastOptions;},get lastArgs(){return lastArgs;}};
}

test('exact owner 뒤 고정 child 한 개의 stdin·유계 stderr·close만 DDL 종료 근거로 반환한다',async()=>{
 const h=fixture(),controller=new AbortController(),pending=h.ports.run.call(h.ports.recipient,invocation(h.e),controller.signal);
 assert.equal(h.spawns,1);const child=h.children[0]!;await Promise.resolve();assert.equal(child.stdin.ended,true);assert.equal(contentHash(child.stdin.bytes),current0076NegativeContract.executionSha256);
 child.stdout.emit('end');child.stderr.emit('data',Buffer.from('psql:<stdin>:2343: ERROR:  42723: PRIVATE SQL discarded'));child.stderr.emit('end');child.emit('exit',3,null);child.emit('close',3,null);
 const result=await pending;assert.deepEqual({status:result.status,signal:result.signal,code:result.code,closed:result.closed}, {status:3,signal:null,code:null,closed:true});assert.equal(result.stdout.byteLength,0);assert(result.stderr.byteLength>0);
 assert.deepEqual(h.lastArgs,invocation(h.e).argv);assert.deepEqual(h.lastOptions,{cwd:'/',env:invocation(h.e).env,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});assert(h.current>=4);
 assert.equal((await h.ports.run.call(h.ports.recipient,invocation(h.e),controller.signal)).closed,false);assert.equal(h.spawns,1);
});

test('capability·invocation·stdin·abort가 다르면 child 시작0이다',async()=>{
 const h=fixture(),signal=new AbortController().signal;assert.doesNotMatch(processSource,/node:child_process/);assert.throws(()=>create0076NegativeLinuxProcess(Object.freeze(Object.create(null)),h.system));assert.throws(()=>create0076NegativeLinuxProcess(h.capability,undefined as never));
 for(const patch of [{executable:'/bin/sh'},{cwd:'/tmp'},{argv:Object.freeze([...invocation(h.e).argv,'--single-transaction'])},{env:Object.freeze({...invocation(h.e).env,SECRET:'x'})},{stdin:new Uint8Array([1])},{timeoutMs:30001},{outputLimitBytes:16385}]){
  const f=fixture(),result=await f.ports.run.call(f.ports.recipient,invocation(f.e,patch),signal);assert.equal(result.closed,false);assert.equal(f.spawns,0);
 }
 const aborted=fixture(),controller=new AbortController();controller.abort();assert.equal((await aborted.ports.run.call(aborted.ports.recipient,invocation(aborted.e),controller.signal)).closed,false);assert.equal(aborted.spawns,0);
 for(const mode of ['SYNC_TIMEOUT','SCHEDULE_THROW'] as const){const f=fixture(mode),result=await f.ports.run.call(f.ports.recipient,invocation(f.e),new AbortController().signal);assert.equal(result.closed,false);assert.equal(f.spawns,0);}
 const bad=fixture('BAD_STREAM'),badResult=await bad.ports.run.call(bad.ports.recipient,invocation(bad.e),signal);assert.equal(badResult.closed,false);assert.equal(bad.kills,1);assert.equal(bad.children[0]!.listenerCount('error'),1);bad.children[0]!.emit('close',null,'SIGKILL');assert.equal(bad.children[0]!.listenerCount('error'),0);
});

test('timeout·abort·출력초과는 원 child에 SIGKILL 최대1, close 불명과 raw0으로 끝난다',async()=>{
 const timed=fixture('TIMEOUT'),timedResult=await timed.ports.run.call(timed.ports.recipient,invocation(timed.e),new AbortController().signal);assert.equal(timedResult.closed,false);assert.equal(timed.kills,1);assert.equal(timedResult.stdout.byteLength+timedResult.stderr.byteLength,0);for(const stream of [timed.children[0]!,timed.children[0]!.stdin,timed.children[0]!.stdout,timed.children[0]!.stderr])assert.equal(stream.listenerCount('error'),1);timed.children[0]!.stderr.emit('error',Error('late pipe'));timed.children[0]!.emit('error',Error('late child'));timed.children[0]!.emit('close',null,'SIGKILL');for(const stream of [timed.children[0]!,timed.children[0]!.stdin,timed.children[0]!.stdout,timed.children[0]!.stderr])assert.equal(stream.listenerCount('error'),0);
 const aborted=fixture(),controller=new AbortController(),pending=aborted.ports.run.call(aborted.ports.recipient,invocation(aborted.e),controller.signal);controller.abort();const abortedResult=await pending;assert.equal(abortedResult.closed,false);assert.equal(aborted.kills,1);
 const overflow=fixture(),over=overflow.ports.run.call(overflow.ports.recipient,invocation(overflow.e),new AbortController().signal);overflow.children[0]!.stderr.emit('data',Buffer.alloc(16385));const overflowResult=await over;assert.equal(overflowResult.closed,false);assert.equal(overflow.kills,1);assert.equal(overflowResult.stderr.byteLength,0);
});

test('원 owner 상실·stdin 미완료·signal 종료는 확정 DDL 결과가 아니다',async()=>{
 const lost=fixture('OWNER_LOST'),lostResult=await lost.ports.run.call(lost.ports.recipient,invocation(lost.e),new AbortController().signal),lostChild=lost.children[0]!;assert.equal(lostChild.stdin.ended,false);assert.equal(lost.kills,1);assert.equal(lostResult.closed,false);assert.equal(lostResult.stdout.byteLength+lostResult.stderr.byteLength,0);assert.equal(lostChild.listenerCount('error'),1);lostChild.emit('error',Error('late'));lostChild.emit('close',null,'SIGKILL');assert.equal(lostChild.listenerCount('error'),0);
 const closeLost=fixture('OWNER_LOST_AT_CLOSE'),closeLostPending=closeLost.ports.run.call(closeLost.ports.recipient,invocation(closeLost.e),new AbortController().signal),closeLostChild=closeLost.children[0]!;await Promise.resolve();assert.equal(closeLostChild.stdin.ended,true);closeLostChild.stdout.emit('end');closeLostChild.stderr.emit('end');closeLostChild.emit('exit',3,null);closeLostChild.emit('close',3,null);assert.equal((await closeLostPending).closed,false);
 const noExit=fixture(),noExitPending=noExit.ports.run.call(noExit.ports.recipient,invocation(noExit.e),new AbortController().signal),noExitChild=noExit.children[0]!;noExitChild.stdout.emit('end');noExitChild.stderr.emit('end');noExitChild.emit('close',3,null);assert.equal((await noExitPending).closed,false);
 const duplicate=fixture(),duplicatePending=duplicate.ports.run.call(duplicate.ports.recipient,invocation(duplicate.e),new AbortController().signal),duplicateChild=duplicate.children[0]!;duplicateChild.emit('exit',3,null);duplicateChild.emit('exit',3,null);assert.equal((await duplicatePending).closed,false);assert.equal(duplicate.kills,0);duplicateChild.emit('close',3,null);
 const lateData=fixture(),latePending=lateData.ports.run.call(lateData.ports.recipient,invocation(lateData.e),new AbortController().signal),lateChild=lateData.children[0]!;lateChild.stdout.emit('end');lateChild.stdout.emit('data',Buffer.from('late'));assert.equal((await latePending).closed,false);assert.equal(lateData.kills,1);lateChild.emit('close',null,'SIGKILL');
 const duplicateIo=fixture(),duplicateIoPending=duplicateIo.ports.run.call(duplicateIo.ports.recipient,invocation(duplicateIo.e),new AbortController().signal),duplicateIoChild=duplicateIo.children[0]!;await Promise.resolve();duplicateIoChild.stdin.emit('finish');assert.equal((await duplicateIoPending).closed,false);assert.equal(duplicateIo.kills,1);duplicateIoChild.emit('close',null,'SIGKILL');
 const signaled=fixture(),signalPending=signaled.ports.run.call(signaled.ports.recipient,invocation(signaled.e),new AbortController().signal),signalChild=signaled.children[0]!;await Promise.resolve();signalChild.stdout.emit('end');signalChild.stderr.emit('end');signalChild.emit('exit',null,'SIGKILL');signalChild.emit('close',null,'SIGKILL');const signalResult=await signalPending;assert.equal(signalResult.closed,true);assert.equal(signalResult.signal,'SIGKILL');assert.notEqual(signalResult.code,null);
});

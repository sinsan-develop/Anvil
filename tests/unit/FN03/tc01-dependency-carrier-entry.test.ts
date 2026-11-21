import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {Tc01DependencyIntakePorts} from '../../../scripts/qa-fn03-tc01-dependency-intake.ts';
import type {Tc01PreloadFilesPort} from '../../../scripts/qa-fn03-tc01-preload-files.ts';
import {createTc01DependencyCarrierEntry} from '../../../scripts/qa-fn03-tc01-dependency-carrier-entry.ts';
import {createTc01DependencyCarrierSupervisor} from '../../../scripts/qa-fn03-tc01-dependency-carrier-supervisor.ts';
import {readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';
function baseFixture(){
 const lockBytes=Buffer.from(JSON.stringify({lockfileVersion:3,packages:{'':{name:'ram'},'node_modules/example':{resolved:'https://registry.npmjs.org/example/-/example-1.tgz',integrity:'sha512-YQ=='}}}));
 const input={binding:{attemptId:'a1000000-0000-4000-8000-000000000001',sourceHead:'a'.repeat(40),lockSha256:contentHash(lockBytes),issuedAt:1000,expiresAt:1801000},lockBytes};
 const original={...input.binding},root='/home/daon/anvil-fn03-tc01-'+original.attemptId+'-qa';
 const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter()});
 let wall=1000,mono=0,mask=0o022,timer:(()=>void)|undefined,fd=10,after=false;
 const calls:string[]=[],commands:any[]=[],handles=new Map<number,string>(),buffers:Buffer[]=[],nodes=new Map<string,any>();
 const contents=new Map([['node_modules/example/index.js',Buffer.from('module.exports=7;')],['node_modules/.package-lock.json',Buffer.from('{}')]]);
 let ino=1;for(const [relative,data]of contents){const path=root+'/'+relative;let parent=posix.dirname(path);while(parent!=='/'){if(!nodes.has(parent))nodes.set(parent,{dev:1,ino:ino++,uid:parent===root||parent.startsWith(root+'/')?1000:0,gid:1000,mode:parent===root?0o040700:0o040755,size:0,mtimeMs:1,ctimeMs:1,nlink:2});parent=posix.dirname(parent);}nodes.set(path,{dev:1,ino:ino++,uid:1000,gid:1000,mode:0o100644,size:data.length,mtimeMs:1,ctimeMs:1,nlink:1});}
 const hooks={current:():void=>{},verify:(_r:any):void=>{},read:():void=>{},close:():void=>{}};
 const access=(op:string,path:string)=>{assert(after,'observe before AFTER_CLOSE');calls.push(op);const s=nodes.get(path);assert(s);return {...s};};
 const files:Tc01PreloadFilesPort={context:()=>{assert(after);calls.push('context');return{platform:'linux',uid:1000};},lstat:path=>access('lstat',path),fstat:n=>access('fstat',handles.get(n)!),realpath:path=>{access('realpath',path);return path;},open:path=>{access('open',path);const n=fd++;handles.set(n,path);return n;},read:(n,b,o,len,p)=>{const path=handles.get(n)!;access('read',path);if(!buffers.includes(b))buffers.push(b);const data=contents.get(path.slice(root.length+1))!;const count=Math.min(len,Math.max(0,data.length-p));data.copy(b,o,p,p+count);hooks.read();return count;},close:n=>{calls.push('close-file');assert(handles.has(n));handles.delete(n);hooks.close();},readdir:path=>{access('readdir',path);return[...nodes.keys()].filter(p=>posix.dirname(p)===path).map(p=>posix.basename(p)).reverse();}};
 const complete=()=>{child.stdout.emit('data',Buffer.from('PRIVATE_INSTALL_OUTPUT'));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);};
 const ports:Tc01DependencyIntakePorts={now:()=>wall,monotonic:()=>mono,assertApproved:r=>{assert.deepEqual({...r.binding as any},original);calls.push('approved');},verify:r=>{calls.push(r.phase);hooks.verify(r);if(r.phase==='AFTER_CLOSE')after=true;},prepare:r=>{calls.push('prepare');assert.equal(r.preparationRoot,'/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+original.attemptId+'-dependency-preparation');},takeChild:c=>{calls.push('take');commands.push(c);return child;},start:(c,command)=>{assert.equal(c,child);assert.equal(command,commands[0]);assert(child.listenerCount('close'));assert(timer);calls.push('start');complete();},umask:value=>{const old=mask;if(value!==undefined)mask=value;return old;},setTimeout:(fn,ms)=>{assert(ms>0&&ms<=600000);timer=fn;return 17;},clearTimeout:n=>{assert.equal(n,17);timer=undefined;calls.push('clear');},assertCurrent:b=>{assert(after);assert.deepEqual({...b},{attemptId:original.attemptId,sourceHead:original.sourceHead,packageLockSha256:original.lockSha256,issuedAt:original.issuedAt,expiresAt:original.expiresAt});calls.push('current');hooks.current();}};
 return{input,original,root,child,ports,files,calls,commands,contents,nodes,handles,buffers,hooks,complete,setTime:(w:number,m:number)=>{wall=w;mono=m;},fire:()=>timer?.(),timer:()=>timer,mask:()=>mask};
}
function fixture(){
 const f=baseFixture(),binding={purpose:'TC01_DEPENDENCY_PREPARATION',attemptId:f.original.attemptId,sourceHead:f.original.sourceHead,packageLockSha256:f.original.lockSha256,source:{entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:'c'.repeat(64),closureSha256:'d'.repeat(64)},recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',approvalSha256:'e'.repeat(64),consumptionSha256:'f'.repeat(64),issuedAt:f.original.issuedAt,expiresAt:f.original.expiresAt};
 const wire=Buffer.from(canonicalJson({schemaVersion:1,kind:'TC01_DEPENDENCY_INPUT_V1',binding,limits:{installationMs:600000,totalMs:1800000}})+'\n');
 let takes=0,checks=0;const provided={sourceHead:binding.sourceHead,packageLockSha256:binding.packageLockSha256,bytes:f.input.lockBytes};
 const supervisor={assertCurrent:(r:any)=>{checks++;assert.deepEqual(r.binding,binding);assert.equal(r.inputSha256,contentHash(wire));},takeLockBytes:(r:any)=>{takes++;assert.deepEqual(r.binding,binding);return provided;}};
 return{...f,binding,wire,provided,supervisor,stats:()=>({takes,checks})};
}
const unknown=(r:unknown)=>assert.deepEqual(r,{status:'UNKNOWN',code:'DEPENDENCY_CARRIER_ENTRY_UNKNOWN',authority:'NOT_ISSUED'});
const decode=(f:ReturnType<typeof fixture>,r:unknown)=>{assert.equal(typeof r,'string');return readTc01DependencyCarrierResult(Buffer.from(r as string),f.binding,{startedAt:1000,monotonicStartedAt:0,now:f.ports.now(),monotonicNow:f.ports.monotonic()});};
test('sender supervisor -> receiver wire -> original intake -> candidate reader uses same attempt once',async()=>{
 const f=fixture(),entry=createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files),child=Object.assign(new EventEmitter(),{stdin:new EventEmitter(),stdout:new EventEmitter()});let transmission=0,received:Promise<void>|undefined;
 const sender={now:f.ports.now,monotonic:f.ports.monotonic,assertCurrent:(c:unknown,r:any)=>{assert.equal(c,child);assert.deepEqual(r.binding,f.binding);},setTimeout:(_cb:()=>void,ms:number)=>{assert(ms>0&&ms<=1800000);return 1;},clearTimeout:(_h:unknown)=>{},transmit:(c:unknown,b:Uint8Array)=>{assert.equal(c,child);transmission++;const own=Buffer.from(b);child.stdin.emit('finish');received=entry.run(own,f.binding).then(result=>{own.fill(0);assert.equal(typeof result,'string');child.stdout.emit('data',Buffer.from(result as string));child.stdout.emit('end');child.emit('close',0,null);});}};
 const result=await createTc01DependencyCarrierSupervisor(sender).run(child,f.wire,f.binding);await received;assert.equal(result.status,'COLLECTED');assert.equal(result.authority,'NOT_ISSUED');assert.equal(result.candidate?.status,'CANDIDATE_ONLY');assert.equal(transmission,1);assert.equal(f.stats().takes,1);assert(f.calls.indexOf('AFTER_CLOSE')<f.calls.indexOf('context'));assert.equal(f.handles.size,0);assert(f.buffers.every(b=>b.every(v=>v===0)));assert.equal(f.timer(),undefined);
 const before=f.calls.length;unknown(await entry.run(f.wire,f.binding));assert.equal(f.calls.length,before);assert.equal(f.stats().takes,1);
});
test('wire purpose/approval/HEAD/lock mismatch or fake authority stops before lock/preparation',async()=>{
 for(const mode of['purpose','approval','head','lock','denied','false']){const f=fixture(),expected=structuredClone(f.binding);if(mode==='purpose')expected.purpose='OTHER';if(mode==='approval')expected.approvalSha256='0'.repeat(64);if(mode==='head')expected.sourceHead='0'.repeat(40);if(mode==='lock')expected.packageLockSha256='0'.repeat(64);if(mode==='denied')f.supervisor.assertCurrent=()=>{throw Error('PRIVATE');};if(mode==='false')f.supervisor.assertCurrent=()=>false as any;unknown(await createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files).run(f.wire,expected));assert.equal(f.stats().takes,0);assert.equal(f.calls.length,0);}
});
test('provider exact HEAD/lock/bytes and descriptor shape are required before intake effects',async()=>{
 for(const mode of['head','sha','bytes','extra','getter','proxy']){const f=fixture();let getters=0;if(mode==='head')f.provided.sourceHead='0'.repeat(40);if(mode==='sha')f.provided.packageLockSha256='0'.repeat(64);if(mode==='bytes')f.provided.bytes=Buffer.from('PRIVATE');if(mode==='extra')(f.provided as any).authority='VERIFIED';if(mode==='getter')Object.defineProperty(f.provided,'bytes',{get(){getters++;throw Error('PRIVATE');}});if(mode==='proxy')f.provided.bytes=new Proxy(f.provided.bytes,{get(){getters++;throw Error('PRIVATE');}});unknown(await createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files).run(f.wire,f.binding));assert.equal(f.stats().takes,1);assert.equal(f.calls.length,0);assert.equal(getters,0);}
});
test('supplier loss/expiry and modified current port never open preparation',async()=>{
 for(const mode of['throw','wall','mono','method']){const f=fixture(),take=f.supervisor.takeLockBytes;f.supervisor.takeLockBytes=r=>{const v=take(r);if(mode==='throw')throw Error('PRIVATE');if(mode==='wall')f.setTime(1801000,0);if(mode==='mono')f.setTime(1000,1800000);if(mode==='method')f.supervisor.assertCurrent=()=>{};return v;};unknown(await createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files).run(f.wire,f.binding));assert.equal(f.stats().takes,1);assert.equal(f.calls.length,0);}
});
test('original preparation failure or observation failure preserves original cleanup and emits UNKNOWN only',async()=>{
 for(const mode of['exit','child-close','timer','after','read','close']){const f=fixture();if(mode==='exit')f.ports.start=()=>{f.child.emit('exit',1,null);};if(mode==='child-close')f.ports.start=()=>{f.child.emit('close',0,null);};if(mode==='timer')f.ports.start=()=>f.fire();if(mode==='after')f.hooks.verify=r=>{if(r.phase==='AFTER_CLOSE')throw Error('PRIVATE');};if(mode==='read')f.hooks.read=()=>{throw Error('PRIVATE');};if(mode==='close')f.hooks.close=()=>{throw Error('PRIVATE');};const entry=createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files);unknown(await entry.run(f.wire,f.binding));if(['exit','child-close','timer','after'].includes(mode))assert(!f.calls.includes('context'));assert.equal(f.handles.size,0);assert(f.buffers.every(b=>b.every(v=>v===0)));f.complete();const n=f.calls.length;unknown(await entry.run(f.wire,f.binding));assert.equal(f.calls.length,n);}
});
test('same full window and 600s preparation budget survive receiving boundary',async()=>{
 for(const stage of['prepare','observe']){const f=fixture();if(stage==='prepare')f.ports.start=()=>{f.setTime(1000,600000);f.complete();};else f.hooks.current=()=>f.setTime(1000,1800000);unknown(await createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files).run(f.wire,f.binding));assert(!f.calls.includes('open'));}
});
test('owned wire/binding/lock survive caller mutation; new callbacks cannot repair initial mismatch',async()=>{
 const f=fixture(),originalBinding=structuredClone(f.binding),originalWire=Buffer.from(f.wire);f.supervisor.assertCurrent=r=>{assert.deepEqual(r.binding,originalBinding);assert.equal(r.inputSha256,contentHash(originalWire));};f.supervisor.takeLockBytes=()=>f.provided;
 f.hooks.verify=r=>{if(r.phase==='BEFORE_PREPARE'){f.wire.fill(0);f.binding.sourceHead='0'.repeat(40);f.provided.bytes.fill(0);}};
 const result=await createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files).run(f.wire,f.binding);f.binding.sourceHead=originalBinding.sourceHead;assert.equal(decode(f,result).candidate.status,'CANDIDATE_ONLY');
 const g=fixture(),expected=structuredClone(g.binding);expected.approvalSha256='0'.repeat(64);g.ports.now=()=>{expected.approvalSha256=g.binding.approvalSha256;return 1000;};unknown(await createTc01DependencyCarrierEntry(g.supervisor,g.ports,g.files).run(g.wire,expected));assert.equal(g.stats().takes,0);assert.equal(g.calls.length,0);
});

test('receiver UNKNOWN is never a sender candidate and corrupted lock causes installation0',async()=>{
 const f=fixture();f.provided.bytes=Buffer.from('PRIVATE');const entry=createTc01DependencyCarrierEntry(f.supervisor,f.ports,f.files),child=Object.assign(new EventEmitter(),{stdin:new EventEmitter(),stdout:new EventEmitter()});let received:Promise<void>|undefined;
 const sender={now:f.ports.now,monotonic:f.ports.monotonic,assertCurrent:()=>{},setTimeout:()=>1,clearTimeout:()=>{},transmit:(_c:unknown,b:Uint8Array)=>{const own=Buffer.from(b);child.stdin.emit('finish');received=entry.run(own,f.binding).then(result=>{own.fill(0);unknown(result);child.stdout.emit('data',Buffer.from(canonicalJson(result)+'\n'));child.stdout.emit('end');child.emit('close',0,null);});}};
 const result=await createTc01DependencyCarrierSupervisor(sender).run(child,f.wire,f.binding);await received;assert.equal(result.status,'UNKNOWN');assert.equal(Object.hasOwn(result,'candidate'),false);assert.equal(f.stats().takes,1);assert.equal(f.calls.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createTc01DependencyWindowsSender} from '../../../scripts/qa-fn03-tc01-dependency-windows-sender.ts';
const wire=(v:unknown)=>Buffer.from(canonicalJson(v)+'\n');
function fixture(existing=new Set<string>()){
 const binding={purpose:'TC01_DEPENDENCY_PREPARATION',attemptId:'b1000000-0000-4000-8000-000000000001',sourceHead:'4c44da5d432e561c672021eee14983562ac57b78',packageLockSha256:'b'.repeat(64),source:{entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:'be189d368418e5963a958fe2a4dbaf4038f0a992a88031cb183840dd40733f25',closureSha256:'d4a0ca7695ccb7d05d2c9e61e113c2cd6a09d774f59a674aa53c288b1f460132'},recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',approvalSha256:'e'.repeat(64),consumptionSha256:'f'.repeat(64),issuedAt:1000,expiresAt:1801000};
 const input=wire({schemaVersion:1,kind:'TC01_DEPENDENCY_INPUT_V1',binding,limits:{installationMs:600000,totalMs:1800000}});
 const value={profile:'TC01_DEPENDENCY_PREPARATION_WINDOWS_SENDER_V1',binding,planSha256:'a'.repeat(64),gitSha256:'c'.repeat(64),carrier:{imageSha256:'1'.repeat(64),configurationSha256:'2'.repeat(64),knownHostsSha256:'3'.repeat(64)}};
 const manifestRaw=canonicalJson({schemaVersion:1,sourceHead:binding.sourceHead,packageLockSha256:binding.packageLockSha256,files:[{path:'node_modules/x',bytes:0,sha256:contentHash('')}]})+'\n';
 const result=wire({schemaVersion:1,kind:'TC01_DEPENDENCY_RESULT_V1',binding,result:{status:'CANDIDATE_ONLY',authority:'NOT_ISSUED',manifestRaw,manifestSha256:contentHash(manifestRaw)}});
 const child=Object.assign(new EventEmitter(),{stdin:new EventEmitter(),stdout:new EventEmitter()}),token=Object.freeze({});
 let wall=1000,mono=0,closed=false,flushed=false,bytes=Buffer.alloc(0),timer:()=>void=()=>{},request:any,spawned:any;
 const calls:string[]=[],copies:Uint8Array[]=[];const hooks={review:()=>{},write:()=>{},flush:()=>{},close:()=>{},confirm:()=>{},spawn:()=>{},end:()=>{}};
 // This fixture verifies request equality only. It is not an OS/host/approval or atomic-publish verifier.
 const review=(r:Readonly<Record<string,unknown>>)=>{calls.push('review');request=r;hooks.review();};
 const complete=()=>{child.stdin.emit('finish');child.stdout.emit('data',result);child.stdout.emit('end');child.emit('exit',0,null);child.emit('close',0,null);};
 const ports={platform:()=> 'win32',now:()=>wall,monotonic:()=>mono,setTimeout:(fn:()=>void,ms:number)=>{calls.push('timer');assert(ms>0&&ms<=1800000);timer=fn;return 1;},clearTimeout:(_h:unknown)=>{calls.push('clear');},
 openExclusive:(path:string)=>{calls.push('open');assert(!existing.has(path));existing.add(path);return token;},write:(t:object,b:Uint8Array,o:number)=>{assert.equal(t,token);assert.equal(o,bytes.length);assert(!closed&&!flushed);calls.push('write');copies.push(b);const n=Math.min(71,b.length-o);bytes=Buffer.concat([bytes,Buffer.from(b.subarray(o,o+n))]);hooks.write();return n;},
 flush:(t:object)=>{assert.equal(t,token);calls.push('flush');hooks.flush();flushed=true;},close:(t:object)=>{assert.equal(t,token);assert(!closed);closed=true;calls.push('close');hooks.close();},confirmClosed:(t:object,n:number)=>{assert.equal(t,token);assert(closed&&flushed);assert.equal(n,bytes.length);calls.push('confirm');hooks.confirm();},
 spawn:(file:string,args:readonly string[],options:any)=>{calls.push('spawn');spawned={file,args,options};hooks.spawn();return child;},end:(c:EventEmitter,b:Uint8Array)=>{assert.equal(c,child);assert.deepEqual(Buffer.from(b),input);assert(child.stdin.listenerCount('finish')>0&&child.stdout.listenerCount('data')>0&&child.listenerCount('close')>=2);assert(calls.includes('timer'));calls.push('send');copies.push(b);hooks.end();complete();}};
 return{binding,input,value,ports,review,hooks,child,calls,copies,existing,complete,tick:()=>timer(),setTime:(w:number,m:number)=>{wall=w;mono=m;},get request(){return request;},get spawned(){return spawned;},get ledger(){return bytes;}};
}
const rejected=(v:any)=>{assert.equal(v.status,'UNKNOWN');assert.equal(v.authority,'NOT_ISSUED');assert.equal(v.candidate,undefined);};
test('same original SSH handle after exact exclusive record -> original sender collector; local candidate only',async()=>{
 const f=fixture(),sender=createTc01DependencyWindowsSender(f.review,f.ports),result=await sender.run(f.input,f.value);
 assert.equal(result.status,'COLLECTED');assert.equal(result.authority,'NOT_ISSUED');assert.equal(result.candidate?.status,'CANDIDATE_ONLY');assert.equal(f.calls.filter(x=>x==='spawn').length,1);assert.equal(f.calls.filter(x=>x==='send').length,1);
 assert(f.calls.indexOf('confirm')<f.calls.indexOf('spawn')&&f.calls.indexOf('timer')<f.calls.indexOf('send'));assert.equal(f.request.profile,f.value.profile);assert.equal(f.request.placement.cli.sha256,'cdbad5ad1efff6be94aa03439e9ed80968d018077961ed66b3e1fb8af2aee765');
 const {file,args,options}=f.spawned;assert.equal(file,String.raw`C:\Windows\System32\OpenSSH\ssh.exe`);assert.equal(args.at(-2),'WSL-server');assert.equal(args.at(-1),"cd '/home/daon/anvil-fn03-tc01-"+f.binding.attemptId+"-qa' && exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node /home/daon/.local/share/anvil-v3-qa-launchers/fn03-tc01-dependency-78dae503/qa-fn03-tc01-dependency-cli.mjs --run "+f.binding.attemptId+' '+f.value.planSha256+' '+f.binding.approvalSha256+' '+f.value.gitSha256);
 for(const flag of ['BatchMode=yes','StrictHostKeyChecking=yes','ClearAllForwardings=yes','UpdateHostKeys=no','AddKeysToAgent=no','VerifyHostKeyDNS=no','ProxyCommand=none','ProxyJump=none','PermitLocalCommand=no','ControlPath=none'])assert(args.includes(flag));assert.deepEqual(options.env,{});assert.equal(options.shell,false);assert.deepEqual(options.stdio,['pipe','pipe','ignore']);
 assert.equal(JSON.parse(f.ledger.toString()).purpose,'TC01_DEPENDENCY_PREPARATION_WINDOWS_EXCLUSIVE_SEND');assert(f.copies.every(b=>b.every(x=>x===0)));for(const e of[f.child,f.child.stdin,f.child.stdout])assert.equal(e.eventNames().length,0);
 rejected(await sender.run(f.input,f.value));assert.equal(f.calls.filter(x=>x==='spawn').length,1);
});
test('wrong purpose/profile/head/UUID/SHA, extra path and absent external proof have no record or spawn',async()=>{
 for(const mode of ['purpose','profile','head','attempt','plan','git','carrier','path','review','review-false','wire','getter']){
  const f=fixture();let getters=0;
  if(mode==='purpose')f.binding.purpose='IX01_WINDOWS_TWO_PHASE';if(mode==='profile')f.value.profile='IX01_WINDOWS_TWO_PHASE';if(mode==='head')f.binding.sourceHead='0'.repeat(40);if(mode==='attempt')f.binding.attemptId="x';echo bad";if(mode==='plan')f.value.planSha256='a;id';if(mode==='git')f.value.gitSha256='g'.repeat(64);if(mode==='carrier')f.value.carrier.imageSha256='';if(mode==='path')(f.value as any).ledgerRoot='C:\\other';if(mode==='wire')f.input[0]=0;if(mode==='getter')Object.defineProperty(f.value,'planSha256',{get(){getters++;return'a'.repeat(64);}});
  if(mode==='review')f.hooks.review=()=>{throw Error('PRIVATE');};const review=mode==='review-false'?()=>false as any:f.review;
  rejected(await createTc01DependencyWindowsSender(review,f.ports).run(f.input,f.value));assert(!f.calls.includes('open')&&!f.calls.includes('spawn'),mode);assert.equal(getters,0);
 }
});
test('partial record/flush/close/readback uncertainty closes original once and never spawns or restarts',async()=>{
 for(const mode of ['open','write','flush','close','confirm','late']){const f=fixture();if(mode==='open')f.ports.openExclusive=()=>{f.calls.push('open');throw Error('PRIVATE');};if(['write','flush','close','confirm'].includes(mode))(f.hooks as any)[mode]=()=>{throw Error('PRIVATE');};if(mode==='late')f.hooks.flush=()=>f.setTime(1801000,1800000);
 const sender=createTc01DependencyWindowsSender(f.review,f.ports);rejected(await sender.run(f.input,f.value));assert(!f.calls.includes('spawn'));assert.equal(f.calls.filter(x=>x==='close').length,mode==='open'?0:1);const count=f.calls.length;rejected(await sender.run(f.input,f.value));assert.equal(f.calls.length,count);assert(f.copies.every(b=>b.every(x=>x===0)));}
});
test('same attempt across factories cannot adopt existing exclusive record',async()=>{
 const used=new Set<string>(),a=fixture(used),b=fixture(used);assert.equal((await createTc01DependencyWindowsSender(a.review,a.ports).run(a.input,a.value)).status,'COLLECTED');rejected(await createTc01DependencyWindowsSender(b.review,b.ports).run(b.input,b.value));assert(!b.calls.includes('spawn'));
});
test('timeout keeps original error boundary until actual close; no late success or resend',async()=>{
 const f=fixture();f.ports.end=()=>{f.calls.push('send');};const sender=createTc01DependencyWindowsSender(f.review,f.ports),pending=sender.run(f.input,f.value);f.tick();rejected(await pending);assert.equal(f.child.listenerCount('error'),1);assert.equal(f.child.stdin.listenerCount('error'),1);assert.equal(f.child.stdout.listenerCount('error'),1);assert.doesNotThrow(()=>f.child.stdout.emit('error',Error('PRIVATE')));f.complete();for(const e of[f.child,f.child.stdin,f.child.stdout])assert.equal(e.eventNames().length,0);rejected(await sender.run(f.input,f.value));assert.equal(f.calls.filter(x=>x==='spawn').length,1);
});
test('synchronous timer failure and post-close authority loss cannot publish',async()=>{
 for(const mode of ['timer','late']){const f=fixture();if(mode==='timer')f.ports.setTimeout=fn=>{fn();return 1;};if(mode==='late')f.hooks.end=()=>f.setTime(1801000,1800000);
 const result=await createTc01DependencyWindowsSender(f.review,f.ports).run(f.input,f.value);rejected(result);if(mode==='timer')assert(!f.calls.includes('send'));}
});

test('time progressing in external review shortens timer without rejecting a valid same attempt',async()=>{
 const f=fixture();let ticks=1000,monos=0;f.hooks.review=()=>f.setTime(++ticks,++monos);let armed=0;const old=f.ports.setTimeout;f.ports.setTimeout=(fn,ms)=>{armed=ms;return old(fn,ms);};
 const result=await createTc01DependencyWindowsSender(f.review,f.ports).run(f.input,f.value);assert.equal(result.status,'COLLECTED');assert(armed>0&&armed<1800000);assert.equal(f.calls.filter(x=>x==='spawn').length,1);
});
test('malformed stream shape still retains original child and known stream errors until close',async()=>{
 const f=fixture();Object.defineProperty(f.child,'stdout',{value:null});rejected(await createTc01DependencyWindowsSender(f.review,f.ports).run(f.input,f.value));assert.equal(f.child.listenerCount('error'),1);assert.equal(f.child.stdin.listenerCount('error'),1);assert.doesNotThrow(()=>f.child.emit('error',Error('PRIVATE')));assert(!f.calls.includes('send'));f.child.emit('close',1,null);assert.equal(f.child.listenerCount('error'),0);assert.equal(f.child.stdin.listenerCount('error'),0);
});
test('input and expectation snapshot precede first review; caller mutation never changes remote argv or wire',async()=>{
 const f=fixture(),original=Buffer.from(f.input),approval=f.binding.approvalSha256,git=f.value.gitSha256;f.hooks.review=()=>{f.value.gitSha256='0'.repeat(64);f.binding.approvalSha256='0'.repeat(64);f.input.fill(0);};f.ports.end=(c,b)=>{assert.equal(c,f.child);assert.deepEqual(Buffer.from(b),original);f.complete();};
 const result=await createTc01DependencyWindowsSender(f.review,f.ports).run(f.input,f.value);assert.equal(result.status,'COLLECTED');assert.equal(f.request.gitSha256,git);assert.equal(f.request.binding.approvalSha256,approval);assert(f.spawned.args.at(-1).endsWith(approval+' '+git));
});

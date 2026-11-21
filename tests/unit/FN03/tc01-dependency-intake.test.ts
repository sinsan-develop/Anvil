import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createTc01DependencyIntake,type Tc01DependencyIntakePorts} from '../../../scripts/qa-fn03-tc01-dependency-intake.ts';
import type {Tc01PreloadFilesPort} from '../../../scripts/qa-fn03-tc01-preload-files.ts';
import {prepareTc01BootstrapInput} from '../../../scripts/qa-fn03-tc01-bootstrap-input.ts';

function fixture(){
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
const unknown=(r:unknown)=>assert.deepEqual(r,{status:'UNKNOWN',code:'DEPENDENCY_INTAKE_UNKNOWN',authority:'NOT_ISSUED'});

test('same attempt preparation close and AFTER_CLOSE precede candidate; no default effects or retry',async()=>{
 const f=fixture(),owner=createTc01DependencyIntake(f.ports,f.files);assert.equal(f.calls.length,0);
 const r=await owner.run(f.input);assert.equal(r.status,'CANDIDATE_ONLY');if(r.status!=='CANDIDATE_ONLY')return;
 assert.equal(r.authority,'NOT_ISSUED');assert.equal(r.manifestSha256,contentHash(r.manifestRaw));assert.equal(r.manifestRaw,canonicalJson(JSON.parse(r.manifestRaw))+'\n');
 assert.deepEqual(JSON.parse(r.manifestRaw),{schemaVersion:1,sourceHead:f.original.sourceHead,packageLockSha256:f.original.lockSha256,files:[...f.contents].map(([path,b])=>({path,bytes:b.length,sha256:contentHash(b)})).sort((a,b)=>a.path<b.path?-1:1)});
 assert(f.calls.indexOf('AFTER_CLOSE')<f.calls.indexOf('context'));assert.equal(f.calls.filter(x=>x==='start').length,1);assert.equal(f.handles.size,0);assert(f.buffers.every(b=>b.every(v=>v===0)));assert.equal(f.mask(),0o022);assert.equal(f.timer(),undefined);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
 const count=f.calls.length;unknown(await owner.run(f.input));assert.equal(f.calls.length,count);
});

test('invalid binding, lock, getter or proxy fail before preparation/file access',async()=>{
 for(const mode of ['attempt','head','lock','window','extra','getter','proxy']){const f=fixture();let reads=0;
  if(mode==='attempt')f.input.binding.attemptId='../other';if(mode==='head')f.input.binding.sourceHead='x'.repeat(40);if(mode==='lock')f.input.binding.lockSha256='0'.repeat(64);if(mode==='window')f.input.binding.expiresAt++;
  if(mode==='extra')(f.input as any).root='/other';if(mode==='getter')Object.defineProperty(f.input,'lockBytes',{get(){reads++;throw Error('PRIVATE');}});if(mode==='proxy')f.input.lockBytes=new Proxy(f.input.lockBytes,{get(){reads++;throw Error('PRIVATE');}});
  unknown(await createTc01DependencyIntake(f.ports,f.files).run(f.input));assert.equal(reads,0);assert.equal(f.calls.length,0);
 }
});

test('input mutation during original preparation cannot rebind evidence or its lock',async()=>{
 const f=fixture();f.hooks.verify=r=>{if(r.phase==='BEFORE_PREPARE'){f.input.binding.sourceHead='b'.repeat(40);f.input.binding.expiresAt+=1000;f.input.lockBytes.fill(0);}};
 const r=await createTc01DependencyIntake(f.ports,f.files).run(f.input);assert.equal(r.status,'CANDIDATE_ONLY');if(r.status==='CANDIDATE_ONLY'){assert.equal(JSON.parse(r.manifestRaw).sourceHead,f.original.sourceHead);assert.equal(JSON.parse(r.manifestRaw).packageLockSha256,f.original.lockSha256);}
});

test('failed preparation, timeout, close order or AFTER_CLOSE unknown means observation0 and late success0',async()=>{
 for(const mode of ['exit','close','timer','after','clear','start-return']){const f=fixture();if(mode==='after')f.hooks.verify=r=>{if(r.phase==='AFTER_CLOSE')throw Error('PRIVATE_AFTER');};if(mode==='clear')f.ports.clearTimeout=()=>{throw Error('PRIVATE_CLEAR');};
  if(mode==='exit')f.ports.start=()=>{f.child.emit('exit',1,null);};if(mode==='close')f.ports.start=()=>{f.child.emit('close',0,null);};if(mode==='timer')f.ports.start=()=>f.fire();if(mode==='start-return')f.ports.start=()=>{f.complete();return false as any;};
  const owner=createTc01DependencyIntake(f.ports,f.files);unknown(await owner.run(f.input));assert(!f.calls.includes('context'));assert(!f.calls.includes('current'));f.complete();const count=f.calls.length;unknown(await owner.run(f.input));assert.equal(count,f.calls.length);assert.equal(f.child.listenerCount('close'),0);
 }
});

test('600s preparation and same 30min wall/mono budget cannot reset between phases',async()=>{
 for(const clock of ['wall','mono']){const f=fixture();f.ports.start=()=>{f.setTime(clock==='wall'?601000:1000,clock==='mono'?600000:0);f.complete();};unknown(await createTc01DependencyIntake(f.ports,f.files).run(f.input));assert(!f.calls.includes('context'));}
 for(const clock of ['wall','mono']){const f=fixture();f.hooks.current=()=>f.setTime(clock==='wall'?1801000:1000,clock==='mono'?1800000:0);unknown(await createTc01DependencyIntake(f.ports,f.files).run(f.input));assert(!f.calls.includes('context'));}
 const f=fixture();f.ports.start=()=>{f.setTime(1000,599999);f.complete();};f.hooks.read=()=>f.setTime(1000,1800000);unknown(await createTc01DependencyIntake(f.ports,f.files).run(f.input));assert.equal(f.handles.size,0);assert.equal(f.calls.filter(x=>x==='open').length,1);
});

test('same ports cannot change after close; external current false never grants authority',async()=>{
 for(const mode of ['method','false','throw']){const f=fixture();if(mode==='method')f.hooks.verify=r=>{if(r.phase==='AFTER_CLOSE')f.ports.assertCurrent=()=>{};};if(mode==='false')f.ports.assertCurrent=()=>false as any;if(mode==='throw')f.ports.assertCurrent=()=>{throw Error('PRIVATE');};unknown(await createTc01DependencyIntake(f.ports,f.files).run(f.input));assert(!f.calls.includes('context'));}
});

test('observation change/close failure never publishes a candidate and original fd closes once',async()=>{
 for(const mode of ['read','close']){const f=fixture();if(mode==='read')f.hooks.read=()=>{throw Error('PRIVATE_READ');};else f.hooks.close=()=>{throw Error('PRIVATE_CLOSE');};unknown(await createTc01DependencyIntake(f.ports,f.files).run(f.input));assert.equal(f.calls.filter(x=>x==='open').length,1);assert.equal(f.calls.filter(x=>x==='close-file').length,1);assert.equal(f.handles.size,0);assert(f.buffers.every(b=>b.every(v=>v===0)));}
});

test('same candidate bytes and SHA enter existing bootstrap; altered dependency cannot replace pinned runtime',async()=>{
 const f=fixture(),candidate=await createTc01DependencyIntake(f.ports,f.files).run(f.input);assert.equal(candidate.status,'CANDIDATE_ONLY');if(candidate.status!=='CANDIDATE_ONLY')return;
 // RAM packet only: candidate does not create this external approval or authorize a later run.
 const entry='scripts/qa-fn03-tc01-linux-runtime.ts',app='scripts/qa-fn03-source-content-management-origin-entry.ts',native='scripts/qa-fn03-source-content-management-origin-native.ts',graphPath='scripts/qa-fn03-tc01-load-graph.json';
 const sources=new Map([['package-lock.json',f.input.lockBytes],...[entry,app,native].map(path=>[path,Buffer.from('export const fixture=true;')] as const)]);
 const graph={schemaVersion:1,entry,files:[...sources.keys(),...f.contents.keys(),graphPath].sort().map(path=>[entry,app,native].includes(path)?{path,kind:'load',format:'module-typescript'}:path==='node_modules/example/index.js'?{path,kind:'load',format:'commonjs'}:{path,kind:[graphPath,'package-lock.json'].includes(path)?'control':'nonload'}),builtins:[],imports:[{parent:entry,specifier:'example',target:'node_modules/example/index.js'}]};
 const graphBytes=Buffer.from(canonicalJson(graph));sources.set(graphPath,graphBytes);
 const sourceManifestRaw=canonicalJson({schemaVersion:1,sourceHead:f.original.sourceHead,sourceRoot:f.root,gitSha256:'3'.repeat(64),dockerSha256:'4'.repeat(64),files:[...sources].map(([path,b])=>({path,bytes:b.length,sha256:contentHash(b)})).sort((a,b)=>a.path<b.path?-1:1)})+'\n';
 const runtime={sourceHead:f.original.sourceHead,entry:app,nodeSha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',sourceClosureSha256:contentHash(sourceManifestRaw),packageLockSha256:f.original.lockSha256,installedDependenciesSha256:candidate.manifestSha256};
 const plan={schemaVersion:1,purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1',attemptId:f.original.attemptId,sourceHead:f.original.sourceHead,issuedAt:f.original.issuedAt,expiresAt:f.original.expiresAt,artifactRoot:'/tmp/fn03-tc01-'+f.original.attemptId,receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+f.original.attemptId,subnet:'172.18.0.16/28',runtime};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approval={schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId:'a1000000-0000-4000-8000-000000000002',attemptId:plan.attemptId,planHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt},approvalRaw=canonicalJson(approval),approvalHash=contentHash(approvalRaw);
 const binding={attemptId:plan.attemptId,approvalId:approval.approvalId,planHash,approvalHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt,artifactRoot:plan.artifactRoot,subnet:plan.subnet,purpose:plan.purpose,profile:plan.profile};
 const input:any={entryInput:{packet:{planRaw,planHash,approvalRaw,approvalHash},isolated:{binding,receiptRoot:plan.receiptRoot,historicalTsv:undefined,legacyBytes:undefined,sources:undefined,passwords:undefined,fixture:undefined},sql:undefined},nativePreparation:{binding,runtime,sourceManifestRaw,dependencyManifestRaw:candidate.manifestRaw},graphBytes,loadFiles:graph.files.filter(r=>r.kind==='load').map(r=>({path:r.path,bytes:sources.get(r.path)??f.contents.get(r.path)!})),now:1000};
 const calls=f.calls.length,prepared=prepareTc01BootstrapInput(input);assert.equal(f.calls.length,calls);prepared.loader.assertHealthy();const fallback=():never=>{throw Error('NO_FALLBACK');};
 prepared.loader.resolve(prepared.loader.entryURL,{parentURL:undefined,conditions:['node','import'],importAttributes:{}},fallback);
 const resolved=prepared.loader.resolve('example',{parentURL:prepared.loader.entryURL,conditions:['node','import'],importAttributes:{}},fallback);
 const loaded=prepared.loader.load(resolved.url,{conditions:['node','import'],importAttributes:{},format:undefined},fallback);assert.deepEqual(loaded.source,f.contents.get('node_modules/example/index.js'));prepared.loader.revoke();
 input.nativePreparation.dependencyManifestRaw=candidate.manifestRaw+' ';assert.throws(()=>prepareTc01BootstrapInput(input),/FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN/);assert.equal(f.calls.length,calls);
});

test('short shared window and delayed original close preserve bounded preparation timeout',async()=>{
 const f=fixture();f.input.binding.expiresAt=1500;f.original.expiresAt=1500;f.ports.start=()=>{};
 const owner=createTc01DependencyIntake(f.ports,f.files),pending=owner.run(f.input);assert.equal(f.commands[0].timeoutMs,500);assert(!f.calls.includes('context'));f.setTime(1499,499);f.complete();assert.equal((await pending).status,'CANDIDATE_ONLY');
 const g=fixture();g.ports.start=()=>{};const p=createTc01DependencyIntake(g.ports,g.files).run(g.input);g.fire();g.complete();unknown(await p);assert(!g.calls.includes('context'));
});

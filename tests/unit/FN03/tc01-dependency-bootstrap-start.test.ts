import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';
import {createTc01DependencyBootstrapStart} from '../../../scripts/qa-fn03-tc01-dependency-bootstrap-start.mjs';
const head='4c44da5d432e561c672021eee14983562ac57b78';
const sourcePaths=['contracts/canonical.ts','contracts/runtime/validation-v1.ts',...['authorized-entry','carrier-entry','carrier-wire','evidence','intake','native-ports','preparation'].map(n=>'scripts/qa-fn03-tc01-dependency-'+n+'.ts'),'scripts/qa-fn03-tc01-pinned-load.ts','scripts/qa-ix01-current-journey.ts','tests/integration/IX01/current-schema-baseline.ts','tests/integration/IX01/current-schema-installation.ts'].sort();
// Repository Git LF source only. Protected/runtime filesystem, package installation and OS providers are never used.
const sourceFiles=sourcePaths.map(path=>({path,bytes:execFileSync('git',['show',head+':'+path])}));
const entryBytes=execFileSync('git',['show','01f13077:scripts/qa-fn03-tc01-dependency-linux-entry.ts']);
let sequence=700;
// Existing authorized-entry RAM fixture, extended only with fixed source byte supplier and independent bootstrap mock.
function fixture(){
 const attemptId='a1000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),sourceHead=head,approvalId='b1000000-0000-4000-8000-000000000001';
 const root='/home/daon/anvil-fn03-tc01-'+attemptId+'-qa',base='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attemptId,prep=base+'-dependency-preparation',receipt=base+'-dependency-consumption';
 const lock=Buffer.from('{"lockfileVersion":3,"packages":{"":{}}}'),lockSha=contentHash(lock),source={entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:contentHash(sourceFiles.find(f=>f.path==='scripts/qa-fn03-tc01-dependency-intake.ts')!.bytes),closureSha256:'d'.repeat(64)};
 const env={PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:prep,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat'};
 const command={file:currentProfile.node,args:[currentProfile.npm,'ci','--ignore-scripts','--no-audit','--no-fund','--bin-links=false','--omit=dev','--include=optional','--userconfig='+prep+'/npm-user.conf','--globalconfig='+prep+'/npm-global.conf','--cache='+prep+'/npm-cache','--registry=https://registry.npmjs.org/'],cwd:root,env,shell:false,stdio:['ignore','pipe','pipe'],maxOutputBytes:65536};
 const plan={schemaVersion:1,purpose:'TC01_DEPENDENCY_PREPARATION',profile:'TC01_DEPENDENCY_PREPARATION_ENTRY_V1',attemptId,sourceHead,issuedAt:1000,expiresAt:1801000,sourceRoot:root,preparationRoot:prep,receiptRoot:receipt,packageLockSha256:lockSha,source,recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',commandSha256:contentHash(canonicalJson(command))};
 const planBytes=Buffer.from(canonicalJson(plan)),planHash=contentHash(planBytes);
 const approval={schemaVersion:1,purpose:'TC01_DEPENDENCY_PREPARATION_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId,planHash,sourceHead,issuedAt:1000,expiresAt:1801000},approvalBytes=Buffer.from(canonicalJson(approval)),approvalHash=contentHash(approvalBytes);
 const intent=Buffer.from(canonicalJson({schemaVersion:1,purpose:'TC01_DEPENDENCY_PREPARATION_INTENT',profile:plan.profile,approvalId,planHash,approvalHash,sourceHead}));
 const expected={plan,planHash,approvalHash,approvalId},binding={purpose:plan.purpose,attemptId,sourceHead,packageLockSha256:lockSha,source,recipe:plan.recipe,approvalSha256:approvalHash,consumptionSha256:contentHash(intent),issuedAt:1000,expiresAt:1801000};
 const wire=Buffer.from(canonicalJson({schemaVersion:1,kind:'TC01_DEPENDENCY_INPUT_V1',binding,limits:{installationMs:600000,totalMs:1800000}})+'\n');
 let ino=1,fd=10,wall=1000,mono=0,mask=0o022,timer:(()=>void)|undefined;
 const nodes=new Map<string,any>(),data=new Map<string,Buffer>(),handles=new Map<number,string>(),fdNodes=new Map<number,any>(),calls:string[]=[],retained:any[]=[],owned:Buffer[]=[];
 const add=(p:string,mode:number,bytes?:Buffer)=>{nodes.set(p,{dev:1,ino:ino++,uid:p==='/home'?0:1000,gid:1000,mode,size:bytes?.length??0,mtimeMs:1,ctimeMs:1,nlink:bytes?1:2});if(bytes)data.set(p,Buffer.from(bytes));};
 for(const p of [root,posix.dirname(receipt)]){let cur=p;while(cur!=='/'){if(!nodes.has(cur))add(cur,cur===root?0o040700:0o040755);cur=posix.dirname(cur);}}
 add(receipt+'-plan.json',0o100600,planBytes);add(receipt+'-approval.json',0o100600,approvalBytes);add(root+'/package-lock.json',0o100644,lock);
 const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter()});
 const hooks={current:()=>{},verify:(_r:any)=>{},mkdir:(_p:string)=>{},sync:(_p:string)=>{},close:(_p:string)=>{},read:(_p:string)=>{},write:(_p:string)=>{}};
 const stat=(p:string)=>{calls.push('stat:'+p);const s=nodes.get(p);if(!s)throw Object.assign(Error('MISSING'),{code:'ENOENT'});return{...s};};
 const system={context:()=>({platform:'linux',uid:1000}),lstat:stat,fstat:(n:number)=>{assert(fdNodes.has(n));return{...fdNodes.get(n)};},realpath:(p:string)=>p,
  mkdir:(p:string,mode:number)=>{calls.push('mkdir:'+p);if(nodes.has(p))throw Object.assign(Error('EXISTS'),{code:'EEXIST'});add(p,0o040000|mode);hooks.mkdir(p);},
  open:(p:string,kind:'READ'|'DIRECTORY'|'CREATE',mode?:number)=>{calls.push('open:'+p);if(kind==='CREATE'){assert(!nodes.has(p));add(p,0o100000|mode!,Buffer.alloc(0));}else assert(nodes.has(p));const n=fd++;handles.set(n,p);fdNodes.set(n,nodes.get(p));return n;},
  read:(n:number,b:Buffer,o:number,len:number,p:number)=>{const path=handles.get(n)!;calls.push('read:'+path);owned.push(b);const raw=data.get(path)!;const count=Math.max(0,Math.min(len,raw.length-p));raw.copy(b,o,p,p+count);hooks.read(path);return count;},
  write:(n:number,b:Buffer,offset:number)=>{const p=handles.get(n)!;calls.push('write:'+p);const take=Math.min(7,b.length-offset),next=Buffer.concat([data.get(p)!,b.subarray(offset,offset+take)]);data.set(p,next);nodes.get(p).size=next.length;hooks.write(p);return take;},
  sync:(n:number)=>{const p=handles.get(n)!;calls.push('sync:'+p);hooks.sync(p);},close:(n:number)=>{const p=handles.get(n)!;assert(p);calls.push('close:'+p);handles.delete(n);fdNodes.delete(n);hooks.close(p);},
  readdir:(p:string,limit:number)=>[...nodes.keys()].filter(k=>posix.dirname(k)===p).map(k=>posix.basename(k)).slice(0,limit),
  spawn:(_c:any)=>{calls.push('spawn');queueMicrotask(()=>{add(root+'/node_modules',0o040755);add(root+'/node_modules/a',0o100644,Buffer.from('x'));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);});return child;},
  umask:(v?:number)=>{const old=mask;if(v!==undefined)mask=v;return old;},setTimeout:(fn:()=>void,_ms:number)=>{timer=fn;return 1;},clearTimeout:(_h:unknown)=>{timer=undefined;},
 };
 const supervisor={now:()=>wall,monotonic:()=>mono,assertCurrent:(_r:any)=>hooks.current(),verifySource:(r:any)=>hooks.verify(r),retainChild:(c:unknown)=>{retained.push(c);}};
 const files=sourceFiles.map(f=>({path:f.path,bytes:Buffer.from(f.bytes)}));
 const prehook=files.filter(f=>['contracts/canonical.ts','contracts/runtime/validation-v1.ts','scripts/qa-fn03-tc01-pinned-load.ts'].includes(f.path)).map(f=>({path:f.path,bytes:Buffer.from(f.bytes)}));
 let take=0,verified=0,starts=0;
 const bootstrap={now:()=>wall,monotonic:()=>mono,verifyBootstrap:(r:any)=>{verified++;assert.equal(r.sourceHead,head);assert.equal(r.rows.length,13);assert.equal(r.prehook.length,3);assert.equal(r.dependencies.length,0);assert.equal(r.entry,'scripts/qa-fn03-tc01-dependency-authorized-entry.ts');},takeSourceFiles:()=>{take++;return{files,loadedPrehookFiles:prehook};}};
 const input={wire,expected,supervisor,system};
 const initialBytes=Buffer.from(entryBytes),packet={entryBytes:initialBytes,files,input};
 const startup={now:()=>wall,monotonic:()=>mono,assertStart:(r:any)=>{starts++;assert.equal(r.sourceHead,head);assert.equal(r.initialSources.length,4);assert.equal(r.initialEdges.length,11);assert.equal(r.environment,'EMPTY');assert.deepEqual(r.execArgv,[]);},verifyBootstrap:bootstrap.verifyBootstrap};
 const make=()=>createTc01DependencyBootstrapStart(startup);
 return{expected,binding,wire,root,base,prep,receipt,plan,planBytes,approvalBytes,intent,system,supervisor,hooks,calls,nodes,data,handles,owned,retained,make,bootstrap,input,files,prehook,startup,packet,initialBytes,get starts(){return starts;},get take(){return take;},get verified(){return verified;},setTime:(w:number,m:number)=>{wall=w;mono=m;}};
}

test('original four modules load from owned RAM -> original second loader -> authorized intake candidate',async t=>{
 const f=fixture(),start=f.make();assert.equal(f.starts,0);assert.equal(f.calls.length,0);
 const owned:Buffer[]=[],alloc=Buffer.alloc;
 const spy=t.mock.method(Buffer,'alloc',((...args:Parameters<typeof Buffer.alloc>)=>{const b=alloc(...args);owned.push(b);return b;}) as typeof Buffer.alloc);
 const result=await start.run(f.packet);spy.mock.restore();assert.equal(typeof result,'string');
 const read=readTc01DependencyCarrierResult(Buffer.from(result as string),f.binding,{startedAt:1000,monotonicStartedAt:0,now:1000,monotonicNow:0});assert.equal(read.candidate.status,'CANDIDATE_ONLY');assert.equal(read.authority,'NOT_ISSUED');
 assert(f.starts>1&&f.verified>1);assert.equal(f.calls.filter(c=>c==='spawn').length,1);assert.equal(f.handles.size,0);
 assert(owned.some(b=>b.length===21426));assert(owned.every(b=>b.every(x=>x===0)),'all private input/source copies erased');
 assert.equal((await start.run(f.packet) as any).status,'UNKNOWN');
 const calls=f.calls.length;assert.equal((await f.make().run(f.packet) as any).status,'UNKNOWN','same URL cache is not re-adopted as a fresh four-source load');assert.equal(f.calls.length,calls);
 assert.equal((await import('node:os')).EOL.length>0,true);
});

test('bad first-start evidence or original hash/prehook/extra row never reaches OS ports',async()=>{
 for(const mode of ['denied','false','entry','prehook','append-import','extra','missing','head','expiry','getter']){
  const f=fixture();let touched=0;
  if(mode==='denied')f.startup.assertStart=()=>{throw Error('PRIVATE');};if(mode==='false')f.startup.assertStart=()=>false as any;
  if(mode==='entry')f.initialBytes[0]=0;if(mode==='prehook')f.files[0]!.bytes[0]=0;
  if(mode==='append-import')f.packet.entryBytes=Buffer.concat([f.initialBytes,Buffer.from("\nimport 'node:fs/promises';")]);
  if(mode==='extra')f.files.push(f.files[0]!);if(mode==='missing')f.files.pop();if(mode==='head')f.expected.plan.sourceHead='f'.repeat(40);if(mode==='expiry')f.setTime(1801000,0);
  if(mode==='getter')Object.defineProperty(f.packet,'entryBytes',{get(){touched++;return f.initialBytes;}});
  assert.deepEqual(await f.make().run(f.packet),{status:'UNKNOWN',code:'DEPENDENCY_BOOTSTRAP_UNKNOWN',authority:'NOT_ISSUED'},mode);assert.equal(touched,0);assert.equal(f.calls.length,0,mode);
 }
});

test('first hook has no fallback: unrelated builtin import poisons load and finally revokes',async()=>{
 const f=fixture();let checks=0,blocked:Promise<unknown>|undefined;const original=f.startup.assertStart;
 f.startup.assertStart=r=>{original(r);if(++checks===1)queueMicrotask(()=>{blocked=import('node:os').then(()=>{throw Error('UNEXPECTED_IMPORT');},error=>{assert.match(String(error),/TC01_DEPENDENCY_BOOTSTRAP_UNKNOWN/);});});};
 assert.equal((await f.make().run(f.packet) as any).status,'UNKNOWN');await blocked;assert.equal(f.calls.length,0);
 assert.equal((await import('node:os')).EOL.length>0,true);
 const g=fixture();assert.equal(typeof await g.make().run(g.packet),'string','known initial teardown releases lease');
});

test('copies precede first callback; late handoff deadline and overlapping factory cannot start effects',async()=>{
 const f=fixture(),original=f.startup.assertStart;let calls=0;
 f.startup.assertStart=r=>{original(r);if(++calls===1){f.initialBytes.fill(0);for(const row of f.files)row.bytes.fill(0);f.expected.plan.source.closureSha256='0'.repeat(64);}};
 assert.equal(typeof await f.make().run(f.packet),'string');
 const late=fixture();let n=0;const check=late.startup.assertStart;late.startup.assertStart=r=>{check(r);if(++n===2)late.setTime(1801000,1800000);};
 assert.equal((await late.make().run(late.packet) as any).status,'UNKNOWN');assert.equal(late.calls.length,0);assert.equal((await import('node:os')).EOL.length>0,true);
 const a=fixture(),b=fixture(),first=a.make().run(a.packet);assert.equal((await b.make().run(b.packet) as any).status,'UNKNOWN');assert.equal(b.calls.length,0);assert.equal(typeof await first,'string');
});

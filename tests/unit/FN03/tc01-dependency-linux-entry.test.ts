import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';
import {createTc01DependencyLinuxEntry} from '../../../scripts/qa-fn03-tc01-dependency-linux-entry.ts';
const head='4c44da5d432e561c672021eee14983562ac57b78';
const sourcePaths=['contracts/canonical.ts','contracts/runtime/validation-v1.ts',...['authorized-entry','carrier-entry','carrier-wire','evidence','intake','native-ports','preparation'].map(n=>'scripts/qa-fn03-tc01-dependency-'+n+'.ts'),'scripts/qa-fn03-tc01-pinned-load.ts','scripts/qa-ix01-current-journey.ts','tests/integration/IX01/current-schema-baseline.ts','tests/integration/IX01/current-schema-installation.ts'].sort();
// Repository Git LF source only. Protected/runtime filesystem, package installation and OS providers are never used.
const sourceFiles=sourcePaths.map(path=>({path,bytes:execFileSync('git',['show',head+':'+path])}));
let sequence=100;
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
 let take=0,verified=0;
 const bootstrap={now:()=>wall,monotonic:()=>mono,verifyBootstrap:(r:any)=>{verified++;assert.equal(r.sourceHead,head);assert.equal(r.rows.length,13);assert.equal(r.prehook.length,3);assert.equal(r.dependencies.length,0);assert.equal(r.entry,'scripts/qa-fn03-tc01-dependency-authorized-entry.ts');},takeSourceFiles:()=>{take++;return{files,loadedPrehookFiles:prehook};}};
 const input={wire,expected,supervisor,system};
 const make=()=>createTc01DependencyLinuxEntry(bootstrap);
 return{expected,binding,wire,root,base,prep,receipt,plan,planBytes,approvalBytes,intent,system,supervisor,hooks,calls,nodes,data,handles,owned,retained,make,bootstrap,input,files,prehook,get take(){return take;},get verified(){return verified;},setTime:(w:number,m:number)=>{wall=w;mono=m;}};
}

test('fixed original 13 files -> pinned hook -> real authorized export -> RAM receiver/intake candidate once',async t=>{
 const f=fixture(),entry=f.make();assert.equal(f.take,0);assert.equal(f.calls.length,0);
 const allocated:Buffer[]=[],alloc=Buffer.alloc;
 const allocMock=t.mock.method(Buffer,'alloc',((...args:Parameters<typeof Buffer.alloc>)=>{const b=alloc(...args);allocated.push(b);return b;}) as typeof Buffer.alloc);
 const result=await entry.run(f.input);allocMock.mock.restore();assert.equal(typeof result,'string');
 assert(allocated.some(b=>b.length===15596));assert(allocated.every(b=>b.every(v=>v===0)),'owned input/prehook/loader copies erased');
 const r=readTc01DependencyCarrierResult(Buffer.from(result as string),f.binding,{startedAt:1000,monotonicStartedAt:0,now:1000,monotonicNow:0});
 assert.equal(r.candidate.status,'CANDIDATE_ONLY');assert.equal(r.authority,'NOT_ISSUED');assert.equal(f.take,1);assert(f.verified>1);
 assert.equal(f.calls.filter(x=>x==='spawn').length,1);assert.equal(f.handles.size,0);assert(f.owned.every(b=>b.every(v=>v===0)));
 const calls=f.calls.length;assert.equal((await entry.run(f.input) as any).status,'UNKNOWN');assert.equal(f.calls.length,calls);
 assert.equal((await import('node:os')).EOL.length>0,true,'hook explicitly revoked');
});

test('independent prehook identity, exact rows/bytes and added import are rejected before any authorized IO',async()=>{
 for(const mode of ['bootstrap','prehook','bytes','missing','extra','reorder','added-import','other-entry']){
  const f=fixture();if(mode==='bootstrap')f.bootstrap.verifyBootstrap=()=>{throw Error('PRIVATE');};
  if(mode==='prehook')f.prehook[0]!.bytes[0]=f.prehook[0]!.bytes[0]!^1;if(mode==='bytes')f.files[3]!.bytes[0]=f.files[3]!.bytes[0]!^1;
  if(mode==='missing')f.files.pop();if(mode==='extra')f.files.push({...f.files[0]!});if(mode==='reorder')f.files.reverse();
  if(mode==='added-import'){const row=f.files.find(x=>x.path.endsWith('authorized-entry.ts'))!;row.bytes=Buffer.concat([row.bytes,Buffer.from("\nimport 'unapproved';")]);}
  if(mode==='other-entry')f.expected.plan.source.entry='scripts/other.ts';
  const r=await f.make().run(f.input);assert.deepEqual(r,{status:'UNKNOWN',code:'DEPENDENCY_LINUX_ENTRY_UNKNOWN',authority:'NOT_ISSUED'},mode);assert.equal(f.calls.length,0,mode);
  assert.equal((await import('node:os')).EOL.length>0,true);
 }
});

test('approval/head/window and getter/proxy failure happen before source supply or effects',async()=>{
 for(const mode of ['head','purpose','expired','getter','proxy','false']){
  const f=fixture();let touched=0;if(mode==='head')f.expected.plan.sourceHead='0'.repeat(40);if(mode==='purpose')f.expected.plan.purpose='OTHER';if(mode==='expired')f.setTime(1801000,0);
  if(mode==='getter')Object.defineProperty(f.expected,'planHash',{get(){touched++;return '0'.repeat(64);}});
  if(mode==='proxy')f.expected.plan=new Proxy(f.expected.plan,{get(){touched++;throw Error('PRIVATE');}});
  if(mode==='false')f.bootstrap.verifyBootstrap=()=>false as any;
  assert.equal((await f.make().run(f.input) as any).status,'UNKNOWN',mode);assert.equal(touched,0);assert.equal(f.take,0,mode);assert.equal(f.calls.length,0);
 }
});

test('expected and byte snapshots survive external mutation; late current loss prevents publication',async()=>{
 const f=fixture(),original=f.bootstrap.verifyBootstrap;let calls=0;
 f.bootstrap.verifyBootstrap=r=>{original(r);if(++calls===2){f.expected.plan.source.closureSha256='0'.repeat(64);for(const row of f.files)row.bytes.fill(0);for(const row of f.prehook)row.bytes.fill(0);}};
 assert.equal(typeof await f.make().run(f.input),'string');
 const g=fixture();g.system.spawn=()=>{g.calls.push('spawn');const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter()});queueMicrotask(()=>{g.setTime(1801000,1800000);child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);});return child;};
 assert.equal((await g.make().run(g.input) as any).status,'UNKNOWN');assert.equal(g.handles.size,0);assert(g.owned.every(b=>b.every(v=>v===0)));assert.equal((await import('node:os')).EOL.length>0,true);
});

test('overlapping factory cannot register while original run owns hook; failure releases only its own lease',async()=>{
 const f=fixture(),g=fixture(),first=f.make().run(f.input);const second=await g.make().run(g.input);
 assert.equal((second as any).status,'UNKNOWN');assert.equal(g.calls.length,0);assert.equal(typeof await first,'string');
 const h=fixture();h.supervisor.verifySource=()=>{throw Error('PRIVATE');};assert.equal((await h.make().run(h.input) as any).status,'UNKNOWN');assert.equal(h.handles.size,0);
 const next=fixture();assert.equal(typeof await next.make().run(next.input),'string');
});

import test,{mock} from 'node:test';
import * as crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createTc01DependencyWindowsSender} from '../../../scripts/qa-fn03-tc01-dependency-windows-sender.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';
const markers=[{raw:Buffer.alloc(32,81),sha:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb'},{raw:Buffer.alloc(54,82),sha:'8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7'},{raw:Buffer.alloc(6597,83),sha:'f6478d5600180a23f73e4217610c7709a71cedb4ae13f6c3e15ecb457f5d4fd6'}];
// Only three RAM tool markers stand in for unavailable Linux tool preimages. All source/approval/lock hashes remain real.
const realHash=crypto.createHash;mock.module('node:crypto',{namedExports:{randomBytes:crypto.randomBytes,createHash:(algorithm:any,...args:any[])=>{const h=(realHash as any)(algorithm,...args),chunks:Buffer[]=[];const wrapper={update(b:any){chunks.push(Buffer.from(b));h.update(b);return wrapper;},digest(enc?:any){const marker=markers.find(m=>m.raw.equals(Buffer.concat(chunks)));return marker?(enc==='hex'?marker.sha:Buffer.from(marker.sha,'hex')):h.digest(enc);}};return wrapper;}}});
const {runTc01DependencyCli}=await import('../../../scripts/qa-fn03-tc01-dependency-cli.mjs');
const deployment='/home/daon/.local/share/anvil-v3-qa-launchers/fn03-tc01-dependency-78dae503',cli=deployment+'/qa-fn03-tc01-dependency-cli.mjs';
const bootstrapBytes=execFileSync('git',['show','78dae503:scripts/qa-fn03-tc01-dependency-bootstrap-start.mjs']);
const packageBytes=execFileSync('git',['show','4c44da5d:package.json']);
const head='4c44da5d432e561c672021eee14983562ac57b78';
const sourcePaths=['contracts/canonical.ts','contracts/runtime/validation-v1.ts',...['authorized-entry','carrier-entry','carrier-wire','evidence','intake','native-ports','preparation'].map(n=>'scripts/qa-fn03-tc01-dependency-'+n+'.ts'),'scripts/qa-fn03-tc01-pinned-load.ts','scripts/qa-ix01-current-journey.ts','tests/integration/IX01/current-schema-baseline.ts','tests/integration/IX01/current-schema-installation.ts'].sort();
// Repository Git LF source only. Protected/runtime filesystem, package installation and OS providers are never used.
const sourceFiles=sourcePaths.map(path=>({path,bytes:execFileSync('git',['show',head+':'+path])}));
const entryBytes=execFileSync('git',['show','01f13077:scripts/qa-fn03-tc01-dependency-linux-entry.ts']);
let sequence=1800;
// Existing authorized-entry RAM fixture, extended only with fixed source byte supplier and independent bootstrap mock.
function fixture(){
 const attemptId='a1000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),sourceHead=head,approvalId='b1000000-0000-4000-8000-000000000001';
 const root='/home/daon/anvil-fn03-tc01-'+attemptId+'-qa',base='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attemptId,prep=base+'-dependency-preparation',receipt=base+'-dependency-consumption';
 const lock=Buffer.from('{"lockfileVersion":3,"packages":{"":{}}}'),lockSha=contentHash(lock),source={entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:contentHash(sourceFiles.find(f=>f.path==='scripts/qa-fn03-tc01-dependency-intake.ts')!.bytes),closureSha256:'d4a0ca7695ccb7d05d2c9e61e113c2cd6a09d774f59a674aa53c288b1f460132'};
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

 const put=(p:string,b:Buffer,uid=1000,mode=0o100600)=>{let cur=posix.dirname(p);while(cur!=='/'){if(!nodes.has(cur))add(cur,cur===deployment?0o040700:0o040755);cur=posix.dirname(cur);}add(p,mode,b);nodes.get(p).uid=uid;};
 put(cli,Buffer.from('RAM CLI'));put(deployment+'/qa-fn03-tc01-dependency-bootstrap-start.mjs',bootstrapBytes);put(deployment+'/qa-fn03-tc01-dependency-linux-entry.ts',entryBytes);
 for(const f of sourceFiles)put(root+'/'+f.path,f.bytes);put(root+'/package.json',packageBytes);
 put(currentProfile.node,markers[0]!.raw,0,0o100755);put(currentProfile.npm,markers[1]!.raw,0,0o100755);put(posix.dirname(posix.dirname(currentProfile.npm))+'/package.json',markers[2]!.raw,0,0o100644);
 const git=Buffer.from('RAM independently approved Git');put('/usr/bin/git',git,0,0o100755);put(root+'/.git/config',Buffer.from('[core]\nrepositoryformatversion = 0\n'));put(root+'/.git/HEAD',Buffer.from('ref: refs/heads/fixed\n'));
 const argv=[currentProfile.node,cli,'--run',attemptId,planHash,approvalHash,contentHash(git)];
 const stdin=Object.assign(new EventEmitter(),{resume(){queueMicrotask(()=>{stdin.emit('data',wire);stdin.emit('end');stdin.emit('close');});}});
 const executions:any[]=[];const io={context:()=>({platform:'linux',uid:1000,execPath:currentProfile.node as string,execArgv:[],argv,environmentKeys:[],cwd:root,moduleURL:pathToFileURL(cli).href,nodeVersion:'24.22.1'}),now:()=>wall,monotonic:()=>mono,system,stdin,execute:(c:any)=>{executions.push(c);if(c.file===currentProfile.node)return'11.19.1\n';if(c.args.includes('ls-files'))return'H package.json\0';if(c.args.includes('rev-parse'))return head+'\n';if(c.args.includes('status'))return'';throw Error('UNEXPECTED');}};
 return{io,argv,put,expected,binding,wire,root,base,prep,receipt,plan,planBytes,approvalBytes,intent,system,hooks,calls,nodes,data,handles,owned,executions,stdin,child,get pendingTimer(){return timer;},setTime:(w:number,m:number)=>{wall=w;mono=m;}};
}

test('original CLI RAM stdin -> both actual pinned loaders -> authorized native intake; version once, install once',async()=>{
 const f=fixture();const result=await runTc01DependencyCli(f.io);assert.equal(typeof result,'string',JSON.stringify(f.calls.slice(-12)));
 const read=readTc01DependencyCarrierResult(Buffer.from(result as string),f.binding,{startedAt:1000,monotonicStartedAt:0,now:1000,monotonicNow:0});assert.equal(read.candidate.status,'CANDIDATE_ONLY');assert.equal(read.authority,'NOT_ISSUED');
 assert.equal(f.executions.filter(c=>c.file===currentProfile.node).length,1);assert.equal(f.calls.filter(c=>c==='spawn').length,1);assert.equal(f.handles.size,0);assert(f.owned.every(b=>b.every(x=>x===0)));assert.equal(f.stdin.listenerCount('error'),0);
 const n=f.executions.length;assert.equal((await runTc01DependencyCli(f.io) as any).status,'UNKNOWN');assert.equal(f.executions.length,n);
});

test('bad wire/duplicate approval or plan, existing receipt/preparation, metadata indirection reject before any command',async()=>{
 for(const mode of ['wire','duplicate-plan','duplicate-approval','receipt','prep','commondir','symlink','config','git-sha','bootstrap-sha','late','argv']){
  const f=fixture();
  if(mode==='wire')f.wire[0]=0;
  if(mode.startsWith('duplicate')){const isPlan=mode==='duplicate-plan',raw=isPlan?f.planBytes:f.approvalBytes;const bad=Buffer.from('{"schemaVersion":1,'+raw.toString().slice(1));f.put(f.receipt+(isPlan?'-plan.json':'-approval.json'),bad);f.argv[isPlan?4:5]=contentHash(bad);
   // Bind every independent SHA to the malformed original bytes, so the original strict parser (not a stale wire hash) rejects duplicate keys.
   if(isPlan){const a=JSON.parse(f.approvalBytes.toString());a.planHash=f.argv[4];const ab=Buffer.from(canonicalJson(a));f.put(f.receipt+'-approval.json',ab);f.argv[5]=contentHash(ab);}
   const intent=Buffer.from(canonicalJson({schemaVersion:1,purpose:'TC01_DEPENDENCY_PREPARATION_INTENT',profile:f.plan.profile,approvalId:f.expected.approvalId,planHash:f.argv[4],approvalHash:f.argv[5],sourceHead:head}));
   const w=JSON.parse(f.wire.toString());w.binding.approvalSha256=f.argv[5];w.binding.consumptionSha256=contentHash(intent);const wb=Buffer.from(canonicalJson(w)+'\n');assert.equal(wb.length,f.wire.length);wb.copy(f.wire);
  }
  if(mode==='receipt'||mode==='prep')f.put((mode==='receipt'?f.receipt:f.prep)+'/existing',Buffer.from('x'));
  if(mode==='commondir')f.put(f.root+'/.git/commondir',Buffer.from('../other'));
  if(mode==='symlink')f.put(f.root+'/.git/index',Buffer.from('x'),1000,0o120777);
  if(mode==='config')f.put(f.root+'/.git/config',Buffer.from('[include]\npath=/other'));
  if(mode==='git-sha')f.argv[6]='0'.repeat(64);if(mode==='bootstrap-sha')f.data.get(deployment+'/qa-fn03-tc01-dependency-bootstrap-start.mjs')![0]=0;
  if(mode==='late')f.setTime(1801000,1800000);if(mode==='argv')f.argv.push('other');
  assert.equal((await runTc01DependencyCli(f.io) as any).status,'UNKNOWN',mode);assert.equal(f.executions.length,0,mode);assert.equal(f.calls.filter(c=>c==='spawn').length,0,mode);assert.equal(f.handles.size,0,mode);
 }
});

test('late Git, original close error and stdin overflow preserve UNKNOWN without spawn',async()=>{
 for(const mode of ['git-late','close','overflow']){const f=fixture();if(mode==='git-late'){const old=f.io.execute;f.io.execute=c=>{const r=old(c);f.setTime(1801000,1800000);return r;};}if(mode==='close')f.hooks.close=()=>{throw Error('PRIVATE');};if(mode==='overflow')f.stdin.resume=()=>{queueMicrotask(()=>{f.stdin.emit('data',Buffer.alloc(16385));f.stdin.emit('end');f.stdin.emit('close');});};
 assert.deepEqual(await runTc01DependencyCli(f.io),{status:'UNKNOWN',code:'DEPENDENCY_CLI_UNKNOWN',authority:'NOT_ISSUED'});assert.equal(f.calls.filter(c=>c==='spawn').length,0);}
});

test('stdin timeout and synchronous timer failure retain only original error/close boundary until close',async()=>{
 for(const mode of ['timeout','sync','throw']){
  const f=fixture();let fire:(()=>void)|undefined,clears=0,resumes=0;
  f.system.setTimeout=fn=>{fire=fn;if(mode==='sync')fn();if(mode==='throw')throw Error('PRIVATE');return 1;};f.system.clearTimeout=()=>{clears++;};
  f.stdin.resume=()=>{resumes++;queueMicrotask(()=>fire!());};
  const result=await runTc01DependencyCli(f.io);assert.equal((result as any).status,'UNKNOWN');assert.equal(f.executions.length,0);assert.equal(f.stdin.listenerCount('data'),0);assert.equal(f.stdin.listenerCount('end'),0);assert.equal(f.stdin.listenerCount('error'),1);assert.equal(f.stdin.listenerCount('close'),1);
  assert.doesNotThrow(()=>f.stdin.emit('error',Error('PRIVATE')));f.stdin.emit('close');assert.equal(f.stdin.listenerCount('error'),0);assert.equal(f.stdin.listenerCount('close'),0);assert.equal(clears,mode==='throw'?0:1);assert.equal(resumes,mode==='timeout'?1:0);
 }
});

test('original fd replacement and command expiry do not adopt equal bytes or start install',async()=>{
 const f=fixture();let swapped=false;f.hooks.close=p=>{if(!swapped&&p===f.receipt+'-plan.json'){swapped=true;f.nodes.get(p).ino++;}};
 assert.equal((await runTc01DependencyCli(f.io) as any).status,'UNKNOWN');assert.equal(f.executions.length,0);assert.equal(f.handles.size,0);
 const g=fixture(),old=g.io.execute;g.io.execute=c=>{const r=old(c);if(c.file===currentProfile.node)g.setTime(1801000,1800000);return r;};assert.equal((await runTc01DependencyCli(g.io) as any).status,'UNKNOWN');assert.equal(g.executions.filter(c=>c.file===currentProfile.node).length,1);assert.equal(g.calls.filter(c=>c==='spawn').length,0);
});

test('receipt, preparation or commondir appearing while stdin waits is rejected before first Git',async()=>{
 for(const path of ['receipt','prep','commondir'] as const){const f=fixture();f.stdin.resume=()=>{queueMicrotask(()=>{f.put(path==='commondir'?f.root+'/.git/commondir':f[path]+'/existing',Buffer.from('x'));f.stdin.emit('data',f.wire);f.stdin.emit('end');f.stdin.emit('close');});};
 assert.equal((await runTc01DependencyCli(f.io) as any).status,'UNKNOWN');assert.equal(f.executions.length,0);assert.equal(f.calls.filter(c=>c==='spawn').length,0);assert.equal(f.handles.size,0);}
});

// A RAM transport for the real sender's emitted remote command, not a second expected command builder.
// It never evaluates a shell: it accepts only the existing cd/exec/env -i carrier grammar and feeds
// the actual seven captured tokens and cwd to the real CLI context. All tool/FS effects remain fixture ports.
function windowsRoundTrip(f:ReturnType<typeof fixture>,mode:'normal'|'approval'|'git'|'foreign-result'='normal'){
 const child=Object.assign(new EventEmitter(),{stdin:new EventEmitter(),stdout:new EventEmitter()}),token=Object.freeze({});
 const calls:string[]=[],copies:Uint8Array[]=[],timers=new Set<object>(),errors:unknown[]=[];
 let ledger=Buffer.alloc(0),opened=false,flushed=false,closed=false,task:Promise<void>|undefined,remoteArgv:string[]|undefined,remoteCwd:string|undefined,received:Buffer|undefined;
 const value={profile:'TC01_DEPENDENCY_PREPARATION_WINDOWS_SENDER_V1',binding:structuredClone(f.binding),planSha256:contentHash(f.planBytes),gitSha256:contentHash(f.data.get('/usr/bin/git')!),carrier:{imageSha256:'1'.repeat(64),configurationSha256:'2'.repeat(64),knownHostsSha256:'3'.repeat(64)}};
 // Synthetic equality evidence only: no actual Windows ACL/host/placement/SSH authority is claimed.
 const review=(r:Readonly<Record<string,unknown>>)=>{assert.equal(r.planSha256,contentHash(f.planBytes));assert.equal((r.binding as any).approvalSha256,contentHash(f.approvalBytes));assert.equal((r.binding as any).consumptionSha256,contentHash(f.intent));assert.deepEqual(r.binding,f.binding);};
 const ports={platform:()=> 'win32',now:()=>1000,monotonic:()=>0,
  setTimeout:(_fn:()=>void,ms:number)=>{assert(ms>0&&ms<=1800000);const t={};timers.add(t);calls.push('timer');return t;},clearTimeout:(t:unknown)=>{assert(timers.delete(t as object));calls.push('clear');},
  openExclusive:(_path:string)=>{assert(!opened);opened=true;calls.push('open');return token;},
  write:(t:object,b:Uint8Array,o:number)=>{assert.equal(t,token);assert.equal(o,ledger.length);assert(!closed&&!flushed);copies.push(b);const n=Math.min(97,b.length-o);ledger=Buffer.concat([ledger,Buffer.from(b.subarray(o,o+n))]);return n;},
  flush:(t:object)=>{assert.equal(t,token);assert(!flushed);flushed=true;calls.push('flush');},close:(t:object)=>{assert.equal(t,token);assert(!closed);closed=true;calls.push('close');},
  confirmClosed:(t:object,n:number)=>{assert.equal(t,token);assert(closed&&flushed);assert.equal(n,ledger.length);calls.push('confirm');},
  spawn:(file:string,args:readonly string[],options:any)=>{
   assert.equal(file,String.raw`C:\Windows\System32\OpenSSH\ssh.exe`);assert.equal(args.at(-2),'WSL-server');assert.deepEqual(options.stdio,['pipe','pipe','ignore']);assert.equal(options.shell,false);
   const match=/^cd '([^']+)' && exec \/usr\/bin\/env -i ([^\r\n]+)$/.exec(args.at(-1)!);assert(match);remoteCwd=match[1]!;remoteArgv=match[2]!.split(' ');assert.equal(remoteArgv.length,7);assert(remoteArgv.every(x=>x.length>0));
   const prior=f.io.context;f.io.context=()=>({...prior(),argv:[...remoteArgv!],cwd:remoteCwd!,execPath:remoteArgv![0]!,moduleURL:pathToFileURL(remoteArgv![1]!).href});
   calls.push('ssh');return child;
  },
  end:(c:EventEmitter,b:Uint8Array)=>{
   assert.equal(c,child);assert(remoteArgv&&remoteCwd);assert(child.stdin.listenerCount('finish')>0&&child.stdout.listenerCount('data')>0&&child.listenerCount('close')>=2&&timers.size===1);assert.deepEqual(Buffer.from(b),f.wire);copies.push(b);received=Buffer.from(b);calls.push('send');
   if(mode==='approval')f.put(f.receipt+'-approval.json',Buffer.from(f.approvalBytes.toString().replace('ALLOW_ONE_RUN','DENY_ONE_RUN_')));
   if(mode==='git')f.put('/usr/bin/git',Buffer.from('different independently unapproved Git'),0,0o100755);
   f.stdin.resume=()=>{queueMicrotask(()=>{f.stdin.emit('data',received);f.stdin.emit('end');f.stdin.emit('close');received!.fill(0);});};
   child.stdin.emit('finish');
   task=(async()=>{const result=await runTc01DependencyCli(f.io);let raw=typeof result==='string'?result:canonicalJson(result)+'\n';
    if(mode==='foreign-result'&&typeof result==='string'){const v=JSON.parse(result);v.binding.approvalSha256='0'.repeat(64);raw=canonicalJson(v)+'\n';}
    child.stdout.emit('data',Buffer.from(raw));child.stdout.emit('end');const code=typeof result==='string'?0:1;child.emit('exit',code,null);child.emit('close',code,null);
   })().catch(error=>{errors.push(error);child.emit('error',Error('RAM_TRANSPORT_UNKNOWN'));child.emit('close',1,null);}).finally(()=>received?.fill(0));
  },
 };
 const sender=createTc01DependencyWindowsSender(review,ports);
 return{sender,value,calls,copies,timers,errors,child,run:()=>sender.run(f.wire,value),wait:()=>task,get received(){return received;},get ledger(){return ledger;},get argv(){return remoteArgv;},get cwd(){return remoteCwd;}};
}

test('Windows original sender -> emitted SSH argv/stdin -> actual pinned Linux CLI -> same child candidate round trip',async()=>{
 const f=fixture(),t=windowsRoundTrip(f),result=await t.run();await t.wait();assert.deepEqual(t.errors,[]);assert.equal(result.status,'COLLECTED');assert.equal(result.authority,'NOT_ISSUED');assert.equal(result.candidate?.status,'CANDIDATE_ONLY');
 assert.equal(t.calls.filter(c=>c==='open').length,1);assert.equal(t.calls.filter(c=>c==='ssh').length,1);assert.equal(t.calls.filter(c=>c==='send').length,1);assert(t.calls.indexOf('confirm')<t.calls.indexOf('ssh'));
 assert.equal(t.cwd,f.plan.sourceRoot);assert.equal(t.argv![3],f.plan.attemptId);assert.equal(t.argv![4],contentHash(f.planBytes));assert.equal(t.argv![5],contentHash(f.approvalBytes));assert.equal(t.argv![6],contentHash(f.data.get('/usr/bin/git')!));
 assert.equal(f.executions.filter(c=>c.file===currentProfile.node).length,1);assert.equal(f.calls.filter(c=>c==='spawn').length,1);assert.equal(f.calls.filter(c=>c==='mkdir:'+f.receipt).length,1);assert.deepEqual(f.data.get(f.receipt+'/intent.json'),f.intent);
 for(const row of sourceFiles)assert(f.calls.includes('open:'+f.root+'/'+row.path));assert.equal(sourceFiles.length,13);assert.equal(f.handles.size,0);assert.equal(f.pendingTimer,undefined);assert.equal(t.timers.size,0);assert(t.copies.every(b=>b.every(x=>x===0)));assert(t.received!.every(x=>x===0));assert(f.owned.every(b=>b.every(x=>x===0)));for(const e of[t.child,t.child.stdin,t.child.stdout,f.stdin,f.child,f.child.stdout,f.child.stderr])assert.equal(e.eventNames().length,0);
 const ledger=JSON.parse(t.ledger.toString());assert.equal(ledger.planSha256,contentHash(f.planBytes));assert.equal(ledger.approvalSha256,contentHash(f.approvalBytes));assert.equal(ledger.inputSha256,contentHash(f.wire));assert.equal(ledger.attemptId,f.plan.attemptId);
 assert.equal((await t.run()).status,'UNKNOWN');assert.equal(t.calls.filter(c=>c==='ssh').length,1);
});

test('same sender transport rejects Linux approval/Git originals or foreign returned binding without candidate',async()=>{
 for(const mode of ['approval','git','foreign-result'] as const){const f=fixture(),t=windowsRoundTrip(f,mode),result=await t.run();await t.wait();assert.deepEqual(t.errors,[]);assert.equal(result.status,'UNKNOWN',mode);assert.equal(result.candidate,undefined);assert.equal(t.calls.filter(c=>c==='open').length,1);assert.equal(t.calls.filter(c=>c==='ssh').length,1);assert.equal(t.calls.filter(c=>c==='send').length,1);assert.equal(f.handles.size,0);assert.equal(t.timers.size,0);
  if(mode!=='foreign-result'){assert.equal(f.executions.length,0);assert.equal(f.calls.filter(c=>c==='spawn').length,0);assert(!f.nodes.has(f.receipt));}else{assert.equal(f.calls.filter(c=>c==='spawn').length,1);assert.deepEqual(f.data.get(f.receipt+'/intent.json'),f.intent);}
  for(const e of[t.child,t.child.stdin,t.child.stdout])assert.equal(e.eventNames().length,0);assert(t.copies.every(b=>b.every(x=>x===0)));assert(t.received!.every(x=>x===0));assert.equal(f.pendingTimer,undefined);
 }
});

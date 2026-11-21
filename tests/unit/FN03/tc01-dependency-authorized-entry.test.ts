import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {createTc01DependencyAuthorizedEntry} from '../../../scripts/qa-fn03-tc01-dependency-authorized-entry.ts';
import {readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';

function fixture(){
 const attemptId='a1000000-0000-4000-8000-000000000001',sourceHead='a'.repeat(40),approvalId='b1000000-0000-4000-8000-000000000001';
 const root='/home/daon/anvil-fn03-tc01-'+attemptId+'-qa',base='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attemptId,prep=base+'-dependency-preparation',receipt=base+'-dependency-consumption';
 const lock=Buffer.from('{"lockfileVersion":3,"packages":{"":{}}}'),lockSha=contentHash(lock),source={entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:'c'.repeat(64),closureSha256:'d'.repeat(64)};
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
 const make=()=>createTc01DependencyAuthorizedEntry(supervisor,system);
 return{expected,binding,wire,root,base,prep,receipt,plan,planBytes,approvalBytes,intent,system,supervisor,hooks,calls,nodes,data,handles,owned,retained,make,setTime:(w:number,m:number)=>{wall=w;mono=m;}};
}
test('protected original approval -> exclusive intent -> original lock -> receiver/native/intake candidate',async()=>{
 const f=fixture(),entry=f.make();assert.equal(f.calls.length,0);const result=await entry.run(f.wire,f.expected);assert.equal(typeof result,'string');
 const r=readTc01DependencyCarrierResult(Buffer.from(result as string),f.binding,{startedAt:1000,monotonicStartedAt:0,now:1000,monotonicNow:0});assert.equal(r.candidate.status,'CANDIDATE_ONLY');assert.equal(r.authority,'NOT_ISSUED');assert.equal(f.calls.filter(x=>x==='spawn').length,1);assert.equal(f.data.get(f.receipt+'/intent.json')?.toString(),f.intent.toString());assert(!f.nodes.has(f.base));assert.equal(f.handles.size,0);assert(f.owned.every(b=>b.every(v=>v===0)));const n=f.calls.length;assert.equal((await entry.run(f.wire,f.expected) as any).status,'UNKNOWN');assert.equal(f.calls.length,n);
});
test('cross purpose/attempt/source/command/approval or raw lock mismatch causes install0',async()=>{
 for(const mode of ['purpose','attempt','source','command','approval','lock','owner','mode']){const f=fixture();if(mode==='purpose')f.expected.plan.purpose='OTHER';if(mode==='attempt')f.expected.plan.attemptId='a2000000-0000-4000-8000-000000000001';if(mode==='source')f.expected.plan.source.closureSha256='0'.repeat(64);if(mode==='command')f.expected.plan.commandSha256='0'.repeat(64);if(mode==='approval')f.expected.approvalHash='0'.repeat(64);if(mode==='lock')f.data.get(f.root+'/package-lock.json')!.fill(32);if(mode==='owner')f.nodes.get(f.receipt+'-approval.json').uid=123;if(mode==='mode')f.nodes.get(f.receipt+'-approval.json').mode=0o100644;const r=await f.make().run(f.wire,f.expected);assert.equal((r as any).status,'UNKNOWN',mode);assert(!f.calls.includes('spawn'),mode);assert(!f.nodes.has(f.prep),mode);assert.equal(f.handles.size,0);}
});
test('same attempt across simultaneous factories consumes once; existing receipt is never adopted',async()=>{
 const f=fixture(),a=f.make(),b=f.make(),out=await Promise.all([a.run(f.wire,f.expected),b.run(f.wire,f.expected)]);assert.equal(out.filter(x=>typeof x==='string').length,1);assert.equal(f.calls.filter(x=>x==='spawn').length,1);assert.equal(f.calls.filter(x=>x==='mkdir:'+f.receipt).length,2);
});
test('mkdir, partial write, sync, close or readback failure never starts preparation and never retries',async()=>{
 for(const mode of ['mkdir','write','sync','close','readback']){const f=fixture();if(mode==='mkdir')f.hooks.mkdir=p=>{if(p===f.receipt)throw Error('PRIVATE');};if(mode==='write')f.hooks.write=()=>{throw Error('PRIVATE');};if(mode==='sync')f.hooks.sync=p=>{if(p===f.receipt+'/intent.json')throw Error('PRIVATE');};if(mode==='close')f.hooks.close=p=>{if(p===f.receipt+'/intent.json')throw Error('PRIVATE');};if(mode==='readback')f.hooks.read=p=>{if(p===f.receipt+'/intent.json')throw Error('PRIVATE');};const entry=f.make(),r=await entry.run(f.wire,f.expected);assert.equal((r as any).status,'UNKNOWN',mode);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);assert(!f.nodes.has(f.prep));assert(!f.calls.includes('spawn'));assert.equal(f.handles.size,0);const n=f.calls.length;await entry.run(f.wire,f.expected);assert.equal(f.calls.length,n);assert(f.nodes.has(f.receipt));}
});
test('loss, replacement and expired authority after consumption blocks receiver installation',async()=>{
 for(const mode of ['replace','mode','expiry','denied']){const f=fixture();let armed=false;f.hooks.read=p=>{if(p===f.receipt+'/intent.json')armed=true;};f.hooks.current=()=>{if(!armed)return;if(mode==='replace')f.nodes.get(f.receipt).ino+=1;if(mode==='mode')f.nodes.get(f.receipt+'-approval.json').mode=0o100666;if(mode==='expiry')f.setTime(1801000,1800000);if(mode==='denied')throw Error('PRIVATE');};const r=await f.make().run(f.wire,f.expected);assert.equal((r as any).status,'UNKNOWN');assert(!f.nodes.has(f.prep));assert(!f.calls.includes('spawn'));assert.equal(f.handles.size,0);}
});
test('expected snapshot precedes callbacks; getter/proxy and false external authority have no preparation effects',async()=>{
 const f=fixture();f.supervisor.now=()=>{f.expected.plan.source.closureSha256='0'.repeat(64);f.expected.approvalHash='0'.repeat(64);return 1000;};assert.equal(typeof await f.make().run(f.wire,f.expected),'string');
 for(const mode of ['getter','proxy','false','port']){const g=fixture();let touched=0;if(mode==='getter')Object.defineProperty(g.expected,'planHash',{get(){touched++;return '0'.repeat(64);}});if(mode==='proxy')g.expected.plan=new Proxy(g.expected.plan,{get(){touched++;throw Error('PRIVATE');}});if(mode==='false')g.supervisor.assertCurrent=()=>false as any;if(mode==='port')g.hooks.current=()=>{g.system.mkdir=()=>{};};assert.equal((await g.make().run(g.wire,g.expected) as any).status,'UNKNOWN');assert.equal(touched,0);assert(!g.calls.some(c=>c.startsWith('mkdir:')));assert(!g.calls.includes('spawn'));}
});
test('expired window, source denial, altered intent write and native UNKNOWN preserve fixed result and zero owned bytes',async()=>{
 for(const mode of ['wall','mono','source','write-mutation','native']){const f=fixture();if(mode==='wall')f.setTime(1801000,0);if(mode==='mono')f.hooks.verify=()=>f.setTime(1000,1800000);if(mode==='source')f.hooks.verify=()=>{throw Error('PRIVATE');};if(mode==='write-mutation'){const write=f.system.write;f.system.write=(fd,b,o)=>{const n=write(fd,b,o);b.fill(0);return n;};}if(mode==='native')f.system.spawn=()=>{throw Error('PRIVATE');};const r=await f.make().run(f.wire,f.expected);assert.deepEqual(r,{status:'UNKNOWN',code:'DEPENDENCY_AUTHORIZED_ENTRY_UNKNOWN',authority:'NOT_ISSUED'});assert.equal(f.handles.size,0);assert(f.owned.every(b=>b.every(v=>v===0)));if(mode!=='native')assert(!f.nodes.has(f.prep));}
});
for(const stage of ['sync','close'])test('CREATE inode replacement during '+stage+' is rejected before first readback pin',async()=>{
  const f=fixture(),path=f.receipt+'/intent.json';let replaced=false;
  const replace=(p:string)=>{if(p===path&&!replaced){replaced=true;const original=f.nodes.get(path);f.nodes.set(path,{...original,ino:original.ino+1000});f.data.set(path,Buffer.from(f.data.get(path)!));}};
  if(stage==='sync')f.hooks.sync=replace;else f.hooks.close=replace;
  const result=await f.make().run(f.wire,f.expected);
  assert.equal(typeof result,'object',stage);assert.deepEqual(result,{status:'UNKNOWN',code:'DEPENDENCY_AUTHORIZED_ENTRY_UNKNOWN',authority:'NOT_ISSUED'},stage);
  assert.equal(replaced,true);assert.equal(f.nodes.has(f.prep),false);assert.equal(f.calls.includes('spawn'),false);
  assert.equal(f.calls.filter(x=>x==='close:'+path).length,1);assert.equal(f.handles.size,0);
  assert.equal(f.calls.filter(x=>x==='open:'+path).length,1,'replacement must be rejected before READ open');
});

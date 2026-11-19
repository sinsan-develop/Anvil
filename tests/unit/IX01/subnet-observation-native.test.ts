import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
const epoch=1_800_000_000_000,node='/opt/node-v24.22.1-linux-x64/bin/node',ip='/usr/sbin/ip';
const proof={attemptId:'11111111-1111-4111-8111-111111111111',bundleHash:'b'.repeat(64),approvalHash:'c'.repeat(64)};
class Child extends EventEmitter{stdout=new EventEmitter();}
function fixture(mode='normal'){
 let wall=epoch,mono=1,serial=0,terms=0;const children:Child[]=[],calls:{file:string;args:readonly string[];options:any}[]=[],timers=new Map<number,{fn:()=>void;ms:number}>();
 const identity={now:()=>wall,monotonic:()=>mono,context:()=>({platform:'linux',uid:1000,hostname:'SINSAN',execPath:node,execArgv:[],environmentKeys:[]}),
 realpath:(p:string)=>p==='/var/run/docker.sock'?'/run/docker.sock':p,
 inspect:(p:string)=>{const kind=p==='/dev/null'?'character':p==='/run/docker.sock'?'socket':[node,ip,'/usr/bin/docker'].includes(p)?'file':'directory';return {kind,dev:'1',ino:'1',uid:0,gid:0,mode:kind==='character'?0o20666:kind==='socket'?0o140660:kind==='file'?0o100755:0o40755,nlink:1,size:kind==='file'?10:0,rdev:kind==='character'?'259':'0',mtimeNs:'1',ctimeNs:'1'};},
 fingerprint:(p:string,_n:number,check:()=>void)=>{check();return p===node?'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb':p===ip?'a'.repeat(64):'7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b';}};
 const ports={identity,spawn(file:string,args:readonly string[],options:unknown){calls.push({file,args,options});const c=new Child();children.push(c);
 queueMicrotask(()=>{if(mode==='silent')return;const raw=args.includes('info')?JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'}):args.includes('ls')?'':'[]';
 c.stdout.emit('data',Buffer.from(raw));c.stdout.emit('end');if(mode!=='hold')c.emit('close',0,null);});return c;},
 terminate(c:object,signal:string){assert(children.includes(c as Child));assert.equal(signal,'SIGKILL');terms++;return true;},
 setTimeout(fn:()=>void,ms:number){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id:unknown){timers.delete(id as number);}};
 return {ports,calls,children,timers,binding:{issuedAt:epoch,expiresAt:epoch+60_000,ip:{path:ip,sha256:'a'.repeat(64)}},advance(ms:number){wall+=ms;mono+=ms;},get terms(){return terms;}};
}
test('IX01 native RAM: 원 검산 이후 닫힌 spawn 옵션과 stdout/close 완료를 같은 수거기로 연결한다',async()=>{
 const {observeSubnetNative}=await import('../../../scripts/qa-ix01-subnet-observation-native.ts');const f=fixture();
 const r=await observeSubnetNative(f.binding,proof,f.ports);assert.equal(r.code,'REMOTE_COMPLETE');assert.equal(f.calls.length,5);assert.equal(f.terms,0);assert.equal(f.timers.size,0);
 for(const c of f.calls){assert(['/usr/bin/docker',ip].includes(c.file));assert.deepEqual(c.options,{cwd:'/',env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',LC_ALL:'C'},stdio:['ignore','pipe','ignore'],shell:false,windowsHide:true});assert(!('timeout' in c.options));}
 assert.deepEqual(f.calls[0]!.args.slice(0,4),['--config','/dev/null','--host','unix:///var/run/docker.sock']);
 if(r.code!=='REMOTE_COMPLETE')return;
 const {collectSubnetRemoteCompletion}=await import('../../../scripts/qa-ix01-subnet-observation-supervisor.ts');const c=Object.assign(new Child(),{stdin:new EventEmitter()});
 const pending=collectSubnetRemoteCompletion(c,proof,{issuedAt:epoch,expiresAt:epoch+60_000},{now:()=>epoch,monotonic:()=>1,setTimeout:()=>1,clearTimeout:()=>{}});
 c.stdin.emit('finish');c.stdout.emit('data',Buffer.from(JSON.stringify(r.envelope)));c.stdout.emit('end');let settled=false;void pending.then(()=>settled=true);await Promise.resolve();assert.equal(settled,false);c.emit('close',0,null);
 assert.deepEqual(await pending,{status:'OBSERVATION_COLLECTED',result:{code:'CANDIDATE',cidr:'172.16.0.0/28'}});
});
test('IX01 native RAM: 고정 Linux/Node·도구·기한 검산 실패는 spawn0',async()=>{
 const {observeSubnetNative}=await import('../../../scripts/qa-ix01-subnet-observation-native.ts');
 for(const kind of ['platform','node','hash','deadline']){const f=fixture(),context=f.ports.identity.context;
 if(kind==='platform')f.ports.identity.context=()=>({...context(),platform:'win32'});if(kind==='node')f.ports.identity.context=()=>({...context(),execPath:'/usr/bin/node'});
 if(kind==='hash')f.ports.identity.fingerprint=()=> 'd'.repeat(64);if(kind==='deadline')f.advance(60_000);
 assert.deepEqual(await observeSubnetNative(f.binding,proof,f.ports),{code:'UNKNOWN'});assert.equal(f.calls.length,0);assert.equal(f.terms,0);}
});
test('IX01 native RAM: 원 객체만 종료 요청1·close 없이 UNKNOWN·늦은 성공/다음호출0',async()=>{
 const {observeSubnetNative}=await import('../../../scripts/qa-ix01-subnet-observation-native.ts');const f=fixture('silent');
 const pending=observeSubnetNative(f.binding,proof,f.ports);await Promise.resolve();const work=[...f.timers.values()][0]!;f.advance(work.ms);work.fn();assert.equal(f.terms,1);
 const reap=[...f.timers.values()][0]!;f.advance(reap.ms);reap.fn();assert.deepEqual(await pending,{code:'UNKNOWN'});assert.equal(f.calls.length,1);
 f.children[0]!.emit('error',new Error('PRIVATE'));f.children[0]!.stdout.emit('data',Buffer.from('PRIVATE'));f.children[0]!.emit('close',0,null);
 assert.equal(f.terms,1);assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);assert.equal(f.children[0]!.listenerCount('error'),0);
});

test('IX01 native RAM: exit 관측은 kill0이며 출력/close 없이 완료로 승격하지 않는다',async()=>{
 const {observeSubnetNative}=await import('../../../scripts/qa-ix01-subnet-observation-native.ts');const f=fixture('silent');
 let settled=false;const pending=observeSubnetNative(f.binding,proof,f.ports).then(r=>{settled=true;return r;});await Promise.resolve();
 f.children[0]!.emit('exit',0,null);await Promise.resolve();assert.equal(settled,false);
 const work=[...f.timers.values()][0]!;f.advance(work.ms);work.fn();assert.equal(f.terms,0);
 const reap=[...f.timers.values()][0]!;f.advance(reap.ms);reap.fn();assert.deepEqual(await pending,{code:'UNKNOWN'});
 f.children[0]!.stdout.emit('end');f.children[0]!.emit('close',0,null);assert.equal(f.calls.length,1);assert.equal(f.terms,0);assert.equal(f.children[0]!.listenerCount('exit'),0);
});

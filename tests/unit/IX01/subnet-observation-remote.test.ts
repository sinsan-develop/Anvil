import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
const epoch=1_800_000_000_000,id='a'.repeat(64),ip='/usr/sbin/ip',node='/opt/node-v24.22.1-linux-x64/bin/node';
const proof={attemptId:'11111111-1111-4111-8111-111111111111',bundleHash:'b'.repeat(64),approvalHash:'c'.repeat(64)};
class Child extends EventEmitter{stdout=new EventEmitter();constructor(){super();this.on('error',()=>{});this.stdout.on('error',()=>{});}}
function fixture(mode='normal'){
 let wall=epoch,mono=10,active=0,maxActive=0,terms=0,serial=0;const calls:string[][]=[],children:Child[]=[],timers=new Map<number,{fn:()=>void;ms:number}>();
 const identity={now:()=>wall,monotonic:()=>mono,context:()=>({platform:'linux',uid:1000,hostname:'SINSAN',execPath:node,execArgv:[],environmentKeys:[]}),
  realpath:(p:string)=>p==='/var/run/docker.sock'?'/run/docker.sock':p,
  inspect:(p:string)=>{const kind=p==='/dev/null'?'character':p==='/run/docker.sock'?'socket':[node,ip,'/usr/bin/docker'].includes(p)?'file':'directory';return {kind,dev:'1',ino:'1',uid:0,gid:0,mode:kind==='character'?0o20666:kind==='socket'?0o140660:kind==='file'?0o100755:0o40755,nlink:1,size:kind==='file'?10:0,rdev:kind==='character'?'259':'0',mtimeNs:'1',ctimeNs:'1'};},
  fingerprint:(p:string,_n:number,check:()=>void)=>{check();return p===node?'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb':p===ip?'a'.repeat(64):'7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b';}};
 const ports={start(_file:string,args:readonly string[],options:unknown){assert(options);calls.push([...args]);const c=new Child();children.push(c);active++;maxActive=Math.max(maxActive,active);c.once('close',()=>active--);
   queueMicrotask(()=>{if(mode==='silent')return;const raw=args.includes('info')?JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'}):args.includes('ls')?JSON.stringify(id)+'\n':args.includes('inspect')?JSON.stringify({Id:id,IPAM:{Config:null}}):'[]';
    if(mode==='split')for(const b of Buffer.from(raw)){c.stdout.emit('data',Buffer.alloc(0));c.stdout.emit('data',Buffer.from([b]));}
    else c.stdout.emit('data',Buffer.from(mode==='overflow'?'x'.repeat(1_048_577):raw));
    c.stdout.emit('end');if(mode!=='hold')c.emit('close',mode==='status'?1:0,null);});return c;},
  requestTermination(c:object){assert(children.includes(c as Child));terms++;if(mode!=='silent')(c as Child).emit('close',null,'SIGKILL');},
  setTimeout(fn:()=>void,ms:number){const n=++serial;timers.set(n,{fn,ms});return n;},clearTimeout(n:unknown){timers.delete(n as number);}};
 return {identity,ports,calls,children,timers,binding:{issuedAt:epoch,expiresAt:epoch+60_000,ip:{path:ip,sha256:'a'.repeat(64)}},proof,
  advance(ms:number){wall+=ms;mono+=ms;},get terms(){return terms;},get maxActive(){return maxActive;}};
}
test('IX01 remote RAM: 같은 host 검산·6단계 직접 close 뒤에만 원 결박 완료를 반환',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');const f=fixture();
 const r=await observeSubnetRemote(f.binding,f.proof,f.identity,f.ports);
 assert.equal(r.code,'REMOTE_COMPLETE');if(r.code!=='REMOTE_COMPLETE')return;
 assert.deepEqual(r.envelope.result,{code:'CANDIDATE',cidr:'172.16.0.0/28'});assert.equal(r.envelope.attemptId,proof.attemptId);
 assert.equal(f.calls.length,6);assert.equal(f.maxActive,1);assert.equal(f.terms,0);assert.equal(f.timers.size,0);
 assert.deepEqual(f.calls.map(a=>a.includes('info')?'daemon':a.includes('ls')?'ids':a.includes('address')?'address':a.includes('route')?'route':'ipam'),['daemon','ids','address','route','ipam','ids']);
});
test('IX01 remote RAM: 결과 선도착·timeout/종료 요청만으로 성공하지 않고 늦은 close 뒤 다음0',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');const f=fixture('silent');
 let settled=false;const p=observeSubnetRemote(f.binding,f.proof,f.identity,f.ports).then(r=>{settled=true;return r;});await Promise.resolve();
 const work=[...f.timers.values()][0]!;assert.equal(work.ms,9000);f.advance(9000);work.fn();assert.equal(f.terms,1);assert.equal(settled,false);
 const reap=[...f.timers.values()][0]!;assert.equal(reap.ms,1000);f.advance(1000);reap.fn();assert.deepEqual(await p,{code:'UNKNOWN'});
 f.children[0]!.emit('close',0,null);assert.equal(f.calls.length,1);assert.equal(f.terms,1);assert.equal(f.timers.size,0);
});
test('IX01 remote RAM: 출력 초과·비0·없는 신원은 후속0이며 후보·원문 노출0',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');
 for(const mode of ['overflow','status']){const f=fixture(mode);assert.deepEqual(await observeSubnetRemote(f.binding,f.proof,f.identity,f.ports),{code:'UNKNOWN'});assert.equal(f.calls.length,1);}
 const f=fixture();assert.deepEqual(await observeSubnetRemote({...f.binding,ip:null},f.proof,f.identity,f.ports),{code:'UNKNOWN'});assert.equal(f.calls.length,0);
});
test('IX01 remote completion RAM: 원 6단계 완료 envelope와 같은 연결 정상 종료를 둘 다 검산한다',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');
 const {collectSubnetRemoteCompletion}=await import('../../../scripts/qa-ix01-subnet-observation-supervisor.ts');
 const f=fixture(),remote=await observeSubnetRemote(f.binding,f.proof,f.identity,f.ports);assert.equal(remote.code,'REMOTE_COMPLETE');if(remote.code!=='REMOTE_COMPLETE')return;
 const window={issuedAt:epoch,expiresAt:epoch+60_000};
 for(const mode of ['normal','missing','attempt','bundle','approval','window','extra','result','close']){
  const child=Object.assign(new Child(),{stdin:new EventEmitter()});child.stdin.on('error',()=>{});
  const clock={now:()=>epoch,monotonic:()=>1,setTimeout:()=>1,clearTimeout:()=>{}};
  const p=collectSubnetRemoteCompletion(child,proof,window,clock);let settled=false;void p.then(()=>settled=true);
  const e=structuredClone(remote.envelope) as any;
  if(mode==='attempt')e.attemptId='22222222-2222-4222-8222-222222222222';if(mode==='bundle')e.bundleHash='d'.repeat(64);if(mode==='approval')e.approvalHash='d'.repeat(64);
  if(mode==='window')e.expiresAt--;if(mode==='extra')e.private='PRIVATE';if(mode==='result')e.result={code:'CANDIDATE',cidr:'192.168.0.0/28'};
  child.stdin.emit('finish');child.stdout.emit('data',Buffer.from(JSON.stringify(mode==='missing'?remote.envelope.result:e)+'\n'));child.stdout.emit('end');
  await Promise.resolve();assert.equal(settled,false);child.emit('close',mode==='close'?1:0,null);const r=await p;
  if(mode==='normal')assert.deepEqual(r,{status:'OBSERVATION_COLLECTED',result:{code:'CANDIDATE',cidr:'172.16.0.0/28'}});else{assert.equal(r.status,'UNKNOWN');assert(!JSON.stringify(r).includes('PRIVATE'));}
 }
});
test('IX01 remote RAM: timer 등록 예외/동기 발화는 원 handle만 종료요청하고 원 기한 밖은 요청0',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');
 for(const kind of ['throw','inline','expired']){
  const f=fixture('silent'),set=f.ports.setTimeout;
  f.ports.setTimeout=(fn,ms)=>{if(kind==='expired')f.advance(60_000);if(kind!=='inline')throw Error('PRIVATE');const id=set(fn,ms);fn();return id;};
  const result=await observeSubnetRemote(f.binding,proof,f.identity,f.ports);assert.deepEqual(result,{code:'UNKNOWN'});
  assert.equal(f.terms,kind==='expired'?0:1);assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
  f.children[0]!.emit('close',0,null);assert.equal(f.calls.length,1);
 }
});
test('IX01 remote completion RAM: 호출 전 결박 snapshot은 호출 후 교체와 late 성공을 받지 않는다',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');const {collectSubnetRemoteCompletion}=await import('../../../scripts/qa-ix01-subnet-observation-supervisor.ts');
 const f=fixture(),remote=await observeSubnetRemote(f.binding,proof,f.identity,f.ports);assert.equal(remote.code,'REMOTE_COMPLETE');if(remote.code!=='REMOTE_COMPLETE')return;
 for(const kind of ['proof','window','late','invalid']){
  const child=Object.assign(new Child(),{stdin:new EventEmitter()}),p={...proof},w={issuedAt:epoch,expiresAt:epoch+60_000};
  let wall=epoch,timer:(()=>void)|undefined,calls=0;
  const clock={now:()=>wall,monotonic:()=>1,setTimeout(fn:()=>void){calls++;timer=fn;return 1;},clearTimeout:()=>{}};
  if(kind==='invalid')p.bundleHash='invalid';
  const result=collectSubnetRemoteCompletion(child,p,w,clock),e={...structuredClone(remote.envelope)};
  if(kind==='invalid'){assert.equal((await result).status,'UNKNOWN');assert.equal(calls,0);continue;}
  if(kind==='proof'){p.bundleHash='d'.repeat(64);e.bundleHash=p.bundleHash;}
  if(kind==='window'){w.expiresAt--;e.expiresAt=w.expiresAt;}
  if(kind==='late'){wall+=60_000;assert(timer);timer();}
  child.stdin.emit('finish');child.stdout.emit('data',Buffer.from(JSON.stringify(e)));child.stdout.emit('end');child.emit('close',0,null);
  assert.equal((await result).status,'UNKNOWN');
 }
});
test('IX01 remote RAM: 각 단계 close 전 다음0·모든 단계 비0 차단·잘게 나눈 원 출력 보존',async()=>{
 const {observeSubnetRemote}=await import('../../../scripts/qa-ix01-subnet-observation-remote.ts');
 const f=fixture('hold');let done=false;const promise=observeSubnetRemote(f.binding,proof,f.identity,f.ports).then(r=>{done=true;return r;});
 for(let n=1;n<=6;n++){
  for(let spin=0;spin<30;spin++)await Promise.resolve();assert.equal(f.calls.length,n);assert.equal(done,false);
  f.children[n-1]!.emit('close',0,null);
 }
 assert.equal((await promise).code,'REMOTE_COMPLETE');
 for(let failAt=1;failAt<=6;failAt++){
  const g=fixture('hold'),p=observeSubnetRemote(g.binding,proof,g.identity,g.ports);
  for(let n=1;n<=failAt;n++){for(let spin=0;spin<30;spin++)await Promise.resolve();g.children[n-1]!.emit('close',n===failAt?1:0,null);}
  assert.deepEqual(await p,{code:'UNKNOWN'});assert.equal(g.calls.length,failAt);
 }
 const h=fixture('split');assert.equal((await observeSubnetRemote(h.binding,proof,h.identity,h.ports)).code,'REMOTE_COMPLETE');assert.equal(h.calls.length,6);
});

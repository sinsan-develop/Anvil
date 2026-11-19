import assert from 'node:assert/strict';
import test from 'node:test';

const epoch=1_800_000_000_000,node='/opt/node-v24.22.1-linux-x64/bin/node',ip='/usr/sbin/ip';
const nodeHash='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',dockerHash='7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b',ipHash='a'.repeat(64);
function identity(kind:string,path:string){return {kind,dev:'1',ino:String([...path].reduce((sum,c)=>sum+c.charCodeAt(0),1)),uid:0,gid:0,mode:kind==='character'?0o20666:kind==='file'?0o100755:kind==='socket'?0o140660:0o40755,nlink:1,size:kind==='file'?16:0,rdev:kind==='character'?'259':'0',mtimeNs:'1',ctimeNs:'1'};}
function fixture(){
 let wall=epoch,mono=100;const calls:{file:string;args:readonly string[];options:unknown}[]=[],reads:string[]=[];
 const binding={issuedAt:epoch,expiresAt:epoch+60_000,ip:{path:ip,sha256:ipHash}};
 const ports={now:()=>wall,monotonic:()=>mono,
  context:()=>({platform:'linux',uid:1000,hostname:'SINSAN',execPath:node,execArgv:[] as string[],environmentKeys:[] as string[]}),
  realpath:(path:string)=>path==='/var/run/docker.sock'?'/run/docker.sock':path,
  inspect:(path:string)=>{reads.push(path);return identity(path==='/dev/null'?'character':path==='/run/docker.sock'?'socket':[node,ip,'/usr/bin/docker'].includes(path)?'file':'directory',path);},
  fingerprint:(path:string,_max:number,check:()=>void)=>{check();return path===node?nodeHash:path===ip?ipHash:dockerHash;},
  execute:(file:string,args:readonly string[],options:unknown):unknown=>{
   calls.push({file,args,options});return {ok:true,stdout:args.includes('info')?JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'}):args.includes('ls')?'':'[]'};
  },
 };
 return {ports,binding,calls,reads,advance:(ms:number)=>{wall+=ms;mono+=ms;},monoOnly:(ms:number)=>{mono+=ms;}};
}

test('IX01 observation host RAM: 실제 호스트 어댑터 흐름의 고정 읽기 argv/env와 후보',async()=>{
 const {observeSubnetOnHost}=await import('../../../scripts/qa-ix01-subnet-observation-host.ts');const f=fixture();
 assert.deepEqual(observeSubnetOnHost(f.binding,f.ports),{code:'CANDIDATE',cidr:'172.16.0.0/28'});assert.equal(f.calls.length,5);
 assert(f.calls.filter(c=>c.file==='/usr/bin/docker').every(c=>c.args[0]==='--config'&&c.args[1]==='/dev/null'&&c.args[2]==='--host'&&c.args[3]==='unix:///var/run/docker.sock'));
 assert.deepEqual(f.calls[2]!.args,['-j','-4','address','show']);assert.deepEqual(f.calls[3]!.args,['-j','-4','-details','route','show','table','all']);
 for(const call of f.calls)assert.deepEqual(call.options,{cwd:'/',env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',LC_ALL:'C'},timeout:10_000,maxBuffer:1_048_576,killSignal:'SIGKILL',stdio:['ignore','pipe','ignore'],shell:false,windowsHide:true});
 assert(f.reads.includes('/dev/null'));assert(!f.reads.some(p=>p.includes('config.json')));
});

test('IX01 observation host RAM: 부재 ip 결박·tool digest·context·null/socket 신원 오류 효과0',async()=>{
 const {observeSubnetOnHost}=await import('../../../scripts/qa-ix01-subnet-observation-host.ts');
 for(const kind of ['missing','digest','uid','environment','null','socket','symlink','parent'] as const){const f=fixture();
  if(kind==='digest')f.ports.fingerprint=()=>'b'.repeat(64);
  if(kind==='uid')f.ports.context=()=>({...fixture().ports.context(),uid:0});
  if(kind==='environment')f.ports.context=()=>({...fixture().ports.context(),environmentKeys:['NODE_OPTIONS']});
  if(kind==='symlink')f.ports.realpath=path=>path===ip?'/other/ip':path==='/var/run/docker.sock'?'/run/docker.sock':path;
  if(['null','socket','parent'].includes(kind)){const inspect=f.ports.inspect;f.ports.inspect=path=>{const v=inspect(path);if(kind==='null'&&path==='/dev/null')v.rdev='1';if(kind==='socket'&&path==='/run/docker.sock')v.uid=1000;if(kind==='parent'&&path==='/usr')v.mode|=0o022;return v;};}
  assert.deepEqual(observeSubnetOnHost(kind==='missing'?{...f.binding,ip:null}:f.binding,f.ports),{code:'UNKNOWN'});assert.equal(f.calls.length,0);
 }
});

test('IX01 observation host RAM: preflight와 child 기한·원도구 교체는 후속 명령0',async()=>{
 const {observeSubnetOnHost}=await import('../../../scripts/qa-ix01-subnet-observation-host.ts');
 for(const kind of ['preflight','child','mono','replacement','failed','throw','output'] as const){const f=fixture(),execute=f.ports.execute;let replaced=false;
  const inspect=f.ports.inspect;f.ports.inspect=p=>({...inspect(p),ctimeNs:replaced&&p==='/usr/bin/docker'?'2':'1'});
  if(kind==='preflight'){const fp=f.ports.fingerprint;f.ports.fingerprint=(p,m,c)=>{f.advance(60_000);return fp(p,m,c);};}
  f.ports.execute=(file,args,options)=>{const out=execute(file,args,options);if(kind==='child')f.advance(10_001);if(kind==='mono')f.monoOnly(10_001);
   if(kind==='replacement')replaced=true;
   if(kind==='throw')throw Error('PRIVATE_ERROR');if(kind==='failed')return {ok:false,stdout:'PRIVATE'};if(kind==='output')return {ok:true,stdout:'x'.repeat(1_048_577)};return out;
  };
  assert.deepEqual(observeSubnetOnHost(f.binding,f.ports),{code:'UNKNOWN'},kind);assert.equal(f.calls.length,kind==='preflight'?0:1,kind);
 }
});

test('IX01 observation host RAM: daemon 불일치·축소된 남은 timeout·getter/Promise는 닫힘',async()=>{
 const {observeSubnetOnHost}=await import('../../../scripts/qa-ix01-subnet-observation-host.ts');
 const f=fixture();f.ports.execute=(file,args,options)=>{f.calls.push({file,args,options});return {ok:true,stdout:'{"ID":"OTHER","Name":"SINSAN"}'};};
 assert.deepEqual(observeSubnetOnHost(f.binding,f.ports),{code:'UNKNOWN'});assert.equal(f.calls.length,1);
 const g=fixture();g.advance(55_000);assert.equal(observeSubnetOnHost(g.binding,g.ports).code,'CANDIDATE');assert(g.calls.every(c=>(c.options as {timeout:number}).timeout===5000));
 let traps=0;const h=fixture();Object.defineProperty(h.binding.ip,'sha256',{get(){traps++;throw Error('PRIVATE');}});assert.deepEqual(observeSubnetOnHost(h.binding,h.ports),{code:'UNKNOWN'});assert.equal(h.calls.length,0);
 const k=fixture(),promise=Promise.resolve({ok:true,stdout:''});Object.defineProperty(promise,'constructor',{get(){traps++;throw Error('PRIVATE');}});k.ports.execute=()=>promise;
 assert.deepEqual(observeSubnetOnHost(k.binding,k.ports),{code:'UNKNOWN'});assert.equal(traps,0);
 const a=fixture(),argv=['--input-type=module'];Object.defineProperty(argv,'0',{get(){traps++;throw Error('PRIVATE');}});
 a.ports.context=()=>({...fixture().ports.context(),execArgv:argv});assert.deepEqual(observeSubnetOnHost(a.binding,a.ports),{code:'UNKNOWN'});assert.equal(traps,0);assert.equal(a.calls.length,0);
});

test('IX01 observation async host RAM: 기존 신원 검산 뒤 원 실행 포트만 기다린다',async()=>{
 const {observeSubnetOnHostAsync}=await import('../../../scripts/qa-ix01-subnet-observation-host.ts');const f=fixture(),execute=f.ports.execute;
 f.ports.execute=async(...args)=>execute(...args);assert.deepEqual(await observeSubnetOnHostAsync(f.binding,f.ports),{code:'CANDIDATE',cidr:'172.16.0.0/28'});assert.equal(f.calls.length,5);
 const bad=fixture();assert.deepEqual(await observeSubnetOnHostAsync({...bad.binding,ip:null},bad.ports),{code:'UNKNOWN'});assert.equal(bad.calls.length,0);
});

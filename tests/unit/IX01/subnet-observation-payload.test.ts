import assert from 'node:assert/strict';
import test from 'node:test';

const epoch=1_800_000_000_000,id='a'.repeat(64);
function fixture(){
 let wall=epoch,mono=100;const calls:{tool:string;args:readonly string[];timeoutMs:number;maxOutputBytes:number}[]=[];
 const ports={now:()=>wall,monotonic:()=>mono,run(request:typeof calls[number]):unknown{
  calls.push(request);let stdout='';
  if(request.args.includes('info'))stdout=JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'});
  else if(request.args.includes('ls'))stdout=JSON.stringify(id)+'\n';
  else if(request.args.includes('address'))stdout=JSON.stringify([{ifname:'PRIVATE_NAME',addr_info:[{family:'inet',local:'172.16.1.2',prefixlen:16,scope:'global'}]}]);
  else if(request.args.includes('route'))stdout=JSON.stringify([{table:'main',dst:'172.17.0.0/16',dev:'PRIVATE_NAME'}]);
  else stdout=JSON.stringify({Id:id,IPAM:{Config:[{Subnet:'172.18.0.0/16',IPRange:'',Gateway:'172.18.0.1',AuxiliaryAddresses:null}]}});
  return {status:'OK',stdout};
 }};
 return {ports,calls,window:{issuedAt:epoch,expiresAt:epoch+60_000},advance:(ms:number)=>{wall+=ms;mono+=ms;},monoOnly:(ms:number)=>{mono+=ms;}};
}

test('IX01 observation payload RAM: 고정 읽기 인자와 허용 투영만 후보로 연결',async()=>{
 const {observeSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-observation-payload.ts');const f=fixture();
 assert.deepEqual(observeSubnetCandidate(f.ports,f.window),{code:'CANDIDATE',cidr:'172.19.0.0/28'});
 assert.deepEqual(f.calls.map(c=>c.tool),['docker','docker','ip','ip','docker','docker']);
 assert.deepEqual(f.calls[2]!.args,['-j','-4','address','show']);
 assert.deepEqual(f.calls[3]!.args,['-j','-4','-details','route','show','table','all']);
 assert.deepEqual(f.calls[0]!.args,['--host','unix:///var/run/docker.sock','info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);
 assert.deepEqual(f.calls[1]!.args,['--host','unix:///var/run/docker.sock','network','ls','--no-trunc','--format','{{json .ID}}']);
 assert.equal(f.calls[4]!.args.at(-1),id);assert(f.calls[4]!.args.includes('--format'));
 for(const call of f.calls){assert.equal(call.timeoutMs,10_000);assert.equal(call.maxOutputBytes,1_048_576);assert(Object.isFrozen(call));assert(Object.isFrozen(call.args));}
});

test('IX01 observation payload RAM: daemon 오류 및 누락 table 원문은 UNKNOWN 후속 호출0',async()=>{
 const {observeSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-observation-payload.ts');
 for(const kind of ['daemon','table','json','status','throw','bytes','changed-id'] as const){const f=fixture(),run=f.ports.run;let lists=0;
  f.ports.run=request=>{const result=run(request) as {status:string;stdout:string};
   if(kind==='daemon'&&request.args.includes('info'))result.stdout=JSON.stringify({ID:'PRIVATE_ID',Name:'SINSAN'});
   if(request.args.includes('route')){if(kind==='table')result.stdout='[{"dst":"default"}]';if(kind==='json')result.stdout='PRIVATE_BODY';if(kind==='status')result.status='FAILED';if(kind==='throw')throw Error('PRIVATE_ERROR');if(kind==='bytes')result.stdout='x'.repeat(1_048_577);}
   if(kind==='changed-id'&&request.args.includes('ls')&&++lists===2)result.stdout=JSON.stringify('b'.repeat(64));return result;
  };
  assert.deepEqual(observeSubnetCandidate(f.ports,f.window),{code:'UNKNOWN'});assert.equal(f.calls.length,kind==='daemon'?1:kind==='changed-id'?6:4);
 }
});

test('IX01 observation payload RAM: 60초 전체 및 호출10초 monotonic 초과에서 후속0',async()=>{
 const {observeSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-observation-payload.ts');
 for(const kind of ['step','mono','window'] as const){const f=fixture(),run=f.ports.run;
  f.ports.run=request=>{const result=run(request);if(kind==='mono')f.monoOnly(10_001);else f.advance(kind==='step'?10_001:60_000);return result;};
  assert.deepEqual(observeSubnetCandidate(f.ports,f.window),{code:'UNKNOWN'});assert.equal(f.calls.length,1);
 }
 const f=fixture();f.advance(55_000);assert.deepEqual(observeSubnetCandidate(f.ports,f.window),{code:'CANDIDATE',cidr:'172.19.0.0/28'});assert(f.calls.every(c=>c.timeoutMs===5000));
 const bad=fixture();assert.deepEqual(observeSubnetCandidate(bad.ports,{issuedAt:epoch,expiresAt:epoch+60_001}),{code:'UNKNOWN'});assert.equal(bad.calls.length,0);
});

test('IX01 observation payload RAM: getter Proxy Promise 형상은 평가 없이 거절',async()=>{
 const {observeSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-observation-payload.ts');let traps=0;
 const f=fixture(),promise=Promise.resolve({status:'OK',stdout:'PRIVATE'});Object.defineProperty(promise,'constructor',{get(){traps++;throw Error('PRIVATE');}});
 f.ports.run=()=>promise;assert.deepEqual(observeSubnetCandidate(f.ports,f.window),{code:'UNKNOWN'});
 const g=fixture();Object.defineProperty(g.ports,'run',{get(){traps++;throw Error('PRIVATE');}});assert.deepEqual(observeSubnetCandidate(g.ports,g.window),{code:'UNKNOWN'});
 const h=fixture();h.ports.run=()=>new Proxy({},{get(){traps++;throw Error('PRIVATE');},ownKeys(){traps++;throw Error('PRIVATE');}});assert.deepEqual(observeSubnetCandidate(h.ports,h.window),{code:'UNKNOWN'});assert.equal(traps,0);
});

test('IX01 observation payload RAM: 명시 빈 Docker 목록은 정상이며 IPAM 누락과 다른 ID는 거절',async()=>{
 const {observeSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-observation-payload.ts');
 const f=fixture(),run=f.ports.run;f.ports.run=request=>request.args.includes('ls')?(f.calls.push(request),{status:'OK',stdout:''}):run(request);
 assert.deepEqual(observeSubnetCandidate(f.ports,f.window),{code:'CANDIDATE',cidr:'172.18.0.0/28'});assert.equal(f.calls.length,5);
 for(const kind of ['missing','wrong-id'] as const){const g=fixture(),original=g.ports.run;
  g.ports.run=request=>{const result=original(request);if(!request.args.includes('inspect'))return result;
   return {status:'OK',stdout:JSON.stringify(kind==='missing'?{Id:id,IPAM:{Config:[{Subnet:'172.18.0.0/16',IPRange:null,AuxiliaryAddresses:null}]}}:{Id:'b'.repeat(64),IPAM:{Config:null}})};
  };assert.deepEqual(observeSubnetCandidate(g.ports,g.window),{code:'UNKNOWN'});assert.equal(g.calls.length,5);
 }
});

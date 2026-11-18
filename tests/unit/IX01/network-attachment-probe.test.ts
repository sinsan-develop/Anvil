import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const now=1_800_000_000_000,cid='a'.repeat(64),nid='b'.repeat(64),noneId='c'.repeat(64),eid='d'.repeat(64);
async function fixture(){
 const api=await import('../../../scripts/qa-ix01-network-attachment-probe.ts');
 const shared=await import('../../../scripts/qa-ix01-current-journey.ts');
 const p=api.networkProbeProfile;
 const plan={schemaVersion:1,purpose:'IX01_NETWORK_ATTACHMENT',profile:p.owner,subnet:'172.30.250.0/28',sourceHead:'e'.repeat(40),issuedAt:now,expiresAt:now+300_000,
  sourceFiles:api.networkProbeSources.map(path=>({path,sha256:'f'.repeat(64)}))};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw);
 const approval={schemaVersion:1,purpose:'IX01_NETWORK_ATTACHMENT_RUN_APPROVAL',profile:p.owner,decision:'ALLOW_ONE_RUN',approvalId:'11111111-1111-4111-8111-111111111111',planHash,sourceHead:plan.sourceHead,issuedAt:now,expiresAt:plan.expiresAt};
 const approvalRaw=canonicalJson(approval),input={planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw)};
 const labels={'anvil.owner':p.owner,'anvil.instance':plan.sourceHead.slice(0,32),'anvil.plan':planHash};
 const calls:string[][]=[],records:unknown[]=[];let running=false,created=false,networkCreated=false,attached=false,detached=false,time=now;
 const container=()=>({id:cid,name:'/'+p.container,image:shared.currentNetworkProbeContract.image,user:'999:999',labels,running,
  host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:shared.currentNetworkProbeContract.tmpfs},
  mounts:Object.keys(shared.currentNetworkProbeContract.tmpfs).map(Destination=>({Type:'tmpfs',Destination,RW:true,Source:''})),ports:{'5432/tcp':null},
  networks:attached?{[p.network]:{NetworkID:nid,IPAddress:'172.30.250.2',IPPrefixLen:28,EndpointID:eid}}:detached?{}:{none:{NetworkID:noneId,IPAddress:''}},entrypoint:['/bin/sleep'],command:['120']});
 const ports={now:()=>time,assertCurrent(){assert(time<plan.expiresAt);},preflight(){calls.push(['PREFLIGHT']);},claim():'CLAIMED'|'DUPLICATE'{calls.push(['CLAIM']);return 'CLAIMED';},
  docker(args:readonly string[]):string{
   calls.push([...args]);
   if(args[0]==='image')return canonicalJson({id:shared.currentNetworkProbeContract.image,volumes:{'/var/lib/postgresql/data':{}}});
   if(args[0]==='container'&&args[1]==='ls')return created?cid:'';
   if(args[0]==='network'&&args[1]==='ls')return networkCreated?nid:'';
   if(args[0]==='create'){created=true;return cid;}
   if(args[0]==='start'){running=true;return cid;}
   if(args[0]==='container'&&args[1]==='inspect')return canonicalJson(container());
   if(args[0]==='network'&&args[1]==='create'){networkCreated=true;return nid;}
   if(args[0]==='network'&&args[1]==='inspect')return args.at(-1)===noneId?canonicalJson({id:noneId,name:'none',driver:'null',internal:false,labels:{},containers:{}}):canonicalJson({id:nid,name:p.network,driver:'bridge',internal:true,labels,ipam:[{Subnet:'172.30.250.0/28',Gateway:'172.30.250.1'}],containers:attached?{[cid]:{Name:p.container,IPv4Address:'172.30.250.2/28',EndpointID:eid}}:{}});
   if(args[0]==='network'&&args[1]==='disconnect'){detached=true;return '';}
   if(args[0]==='network'&&args[1]==='connect'){attached=true;return '';}
   if(args[0]==='stop'){running=false;return cid;}
   if(args[0]==='container'&&args[1]==='rm'){created=false;attached=false;return cid;}
   if(args[0]==='network'&&args[1]==='rm'){networkCreated=false;return nid;}
   throw Error('unexpected synthetic command');
  },record(value:unknown){records.push(value);}};
 return {api,shared,p,plan,input,calls,records,ports,expire:()=>{time=plan.expiresAt;}};
}

test('IX01 무DB 망 후보 RAM: 별도 승인과 source closure 및 5분 상한',async()=>{
 const h=await fixture();assert.equal(h.api.networkProbeSources.length,5);
 assert.equal(h.p.owner,'IX01_NETWORK_ATTACHMENT_20261118_N2');
 assert.deepEqual([h.p.source,h.p.receipt,h.p.container,h.p.network],[
  '/home/daon/anvil-ix01-network-attachment-20261118-n2-qa',
  '/home/daon/.local/share/anvil-v3-qa-receipts/ix01-network-attachment-20261118-n2',
  'anvil-ix01-network-attachment-20261118-n2','anvil-ix01-network-attachment-net-20261118-n2']);
 assert.equal(h.api.readNetworkProbeAuthorization(h.input,now).plan.profile,h.p.owner);
 for(const change of [{profile:'IX01_CURRENT_TC01_20261108_A14'},{expiresAt:now+300_001},{issuedAt:now+1}]){
  const planRaw=canonicalJson({...h.plan,...change});const input={...h.input,planRaw,planHash:contentHash(planRaw)};
  const result=h.api.runNetworkAttachmentProbe(input,h.ports);assert.equal(result.status,'REJECTED');assert.deepEqual(h.calls,[]);
 }
 assert(![h.p.source,h.p.receipt,h.p.container,h.p.network].some(value=>value.includes('tc01')||value.includes('a14')));
});

test('IX01 무DB 망 후보 RAM: 실제 명령 배열은 유한 대기와 원 검산 성공 뒤만 회수',async()=>{
 const h=await fixture(),result=h.api.runNetworkAttachmentProbe(h.input,h.ports);
 assert.deepEqual(result,{status:'CLEANED',stage:'RECORD',code:'NETWORK_ATTACHMENT_VERIFIED'});
 const create=h.calls.find(args=>args[0]==='create')!;
 assert.deepEqual(create.slice(-3),['/bin/sleep',h.shared.currentNetworkProbeContract.image,'120']);
 assert.deepEqual(create.slice(1,3),['--pull','never']);
 assert(h.calls.findIndex(args=>args[0]==='CLAIM')<h.calls.findIndex(args=>args[0]==='image'));
 assert(create.includes('--read-only'));assert(create.includes('--internal')===false);assert(!create.includes('--env'));assert(!create.includes('--publish'));assert(!create.includes('--volume'));
 assert.equal(h.calls.filter(args=>args[0]==='create').length,1);assert.equal(h.calls.filter(args=>args[0]==='network'&&args[1]==='create').length,1);
 assert.deepEqual(h.calls.find(args=>args[0]==='network'&&args[1]==='create'),[
  'network','create','--internal','--driver','bridge','--subnet','172.30.250.0/28',
  '--label','anvil.owner='+h.p.owner,'--label','anvil.instance='+h.plan.sourceHead.slice(0,32),
  '--label','anvil.plan='+h.input.planHash,h.p.network]);
 assert(h.calls.filter(args=>args[0]==='network'&&args[1]==='inspect'&&args.at(-1)===nid).every(args=>args[args.indexOf('--format')+1]!.includes('{{json .IPAM.Config}}')));
 assert.equal(h.calls.filter(args=>args[0]==='stop').length,1);assert.equal(h.calls.filter(args=>args[1]==='rm').length,2);
 assert.equal(h.records.length,1);assert(!h.calls.some(args=>args.includes('exec')||args.includes('postgres')||args.includes('psql')));
 assert(!JSON.stringify(result).includes(cid));assert(!JSON.stringify(result).includes('172.'));
});

test('IX01 N2 RAM: N1 및 혼합 승인과 다른 subnet은 효과 전에 거절',async()=>{
 for(const kind of ['old','mixed','subnet','missing'] as const){
  const h=await fixture();const plan:Record<string,unknown>={...h.plan};const approval=JSON.parse(h.input.approvalRaw);
  if(kind==='old'){plan.profile='IX01_NETWORK_ATTACHMENT_20261118_N1';delete plan.subnet;approval.profile=plan.profile;}
  if(kind==='mixed')approval.profile='IX01_NETWORK_ATTACHMENT_20261118_N1';
  if(kind==='subnet')plan.subnet='172.30.251.0/28';
  if(kind==='missing')delete plan.subnet;
  const planRaw=canonicalJson(plan),planHash=contentHash(planRaw);approval.planHash=planHash;
  const approvalRaw=canonicalJson(approval),result=h.api.runNetworkAttachmentProbe({planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw)},h.ports);
  assert.equal(result.status,'REJECTED');assert.deepEqual(h.calls,[]);assert.deepEqual(h.records,[]);
 }
});

test('IX01 N2 RAM: 단일 exact IPAM이 아니면 분리와 연결 전 보존',async()=>{
 for(const ipam of [undefined,null,[],[{Subnet:'172.30.251.0/28',Gateway:'172.30.251.1'}],
  [{Subnet:'172.30.250.0/28',Gateway:'172.30.250.1',IPRange:'172.30.250.8/29'}],
  [{Subnet:'172.30.250.0/28',Gateway:'172.30.250.1'},{Subnet:'172.30.251.0/28',Gateway:'172.30.251.1'}],
  [{Subnet:'172.30.250.0/28',Gateway:'172.30.250.0'}],[{Subnet:'172.30.250.0/28',Gateway:'172.30.250.15'}]]){
  const h=await fixture(),docker=h.ports.docker;
  h.ports.docker=args=>{const raw=docker(args);if(args[0]==='network'&&args[1]==='inspect'&&args.at(-1)===nid){const v=JSON.parse(raw);v.ipam=ipam;return canonicalJson(v);}return raw;};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);
  assert.deepEqual(result,{status:'UNKNOWN',stage:'NETWORK',code:'STOPPED_NETWORK_CREATE_VERIFY'});
  assert(!h.calls.some(a=>a[1]==='disconnect'||a[1]==='connect'||a[1]==='rm'||a[0]==='stop'));assert.equal(h.records.length,1);
 }
});

test('IX01 N2 RAM: 연결 주소의 subnet 호스트 prefix 및 원 endpoint 결박',async()=>{
 for(const kind of ['network','broadcast','outside','gateway','network-prefix','container-prefix','endpoint','changed-ipam'] as const){
  const h=await fixture(),docker=h.ports.docker;let connected=false;
  const ip=kind==='network'?'172.30.250.0':kind==='broadcast'?'172.30.250.15':kind==='outside'?'172.30.250.16':kind==='gateway'?'172.30.250.1':'172.30.250.2';
  h.ports.docker=args=>{const raw=docker(args);if(args[0]==='network'&&args[1]==='connect')connected=true;
   if(connected&&args[1]==='inspect'){
    const v=JSON.parse(raw);
    if(args[0]==='network'){
     v.containers[cid].IPv4Address=ip+(kind==='network-prefix'?'/27':'/28');
     if(kind==='changed-ipam')v.ipam[0].Subnet='172.30.251.0/28';
    }else{v.networks[h.p.network].IPAddress=ip;if(kind==='container-prefix')v.networks[h.p.network].IPPrefixLen=27;if(kind==='endpoint')v.networks[h.p.network].EndpointID='e'.repeat(64);}
    return canonicalJson(v);
   }return raw;};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);assert.equal(result.status,'UNKNOWN',kind);
  assert(!h.calls.some(a=>a[0]==='stop'||a[1]==='rm'),kind);assert.equal(h.records.length,1);
 }
 for(const ip of ['172.30.250.2','172.30.250.14']){
  const h=await fixture(),docker=h.ports.docker;
  h.ports.docker=args=>{const raw=docker(args);if(args[1]!=='inspect')return raw;const v=JSON.parse(raw);
   if(args[0]==='network'&&v.containers?.[cid])v.containers[cid].IPv4Address=ip+'/28';
   if(args[0]==='container'&&v.networks?.[h.p.network])v.networks[h.p.network].IPAddress=ip;
   return canonicalJson(v);};
  assert.equal(h.api.runNetworkAttachmentProbe(h.input,h.ports).status,'CLEANED');
 }
});

test('IX01 N2 RAM: 생성 충돌 또는 불명은 대체 망과 connect 및 삭제 없음',async()=>{
 for(const kind of ['rejected','unknown'] as const){const h=await fixture(),docker=h.ports.docker;let creates=0;
  h.ports.docker=args=>{if(args[0]==='network'&&args[1]==='create'){creates++;if(kind==='rejected')throw Error('private conflict');docker(args);throw Error('private outcome');}return docker(args);};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);
  assert.deepEqual(result,{status:'UNKNOWN',stage:'NETWORK',code:'STOPPED_NETWORK_CREATE'});assert.equal(creates,1);
  assert(!h.calls.some(a=>a[1]==='connect'||a[1]==='disconnect'||a[1]==='rm'||a[0]==='stop'));assert.equal(h.records.length,1);
  assert(!JSON.stringify(result).includes('private'));
 }
});

test('IX01 무DB 망 후보 RAM: 단회 불명과 중복은 기록 덮기나 자원 생성이 없다',async()=>{
 for(const kind of ['unknown','duplicate'] as const){const h=await fixture();
  h.ports.claim=()=>{if(kind==='unknown')throw Error('private storage error');return 'DUPLICATE';};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);
  assert.deepEqual(result,{status:kind==='unknown'?'UNKNOWN':'REJECTED',stage:'CLAIM',code:'STOPPED_CLAIM'});
  assert.equal(h.records.length,0);assert.deepEqual(h.calls,[['PREFLIGHT']]);
 }
});

test('IX01 무DB 망 후보 RAM: 미검산 생성 출력은 보호 기록에도 남기지 않는다',async()=>{
 for(const target of ['container','network'] as const){const h=await fixture(),docker=h.ports.docker;
  h.ports.docker=args=>{if(target==='container'&&args[0]==='create'||target==='network'&&args[0]==='network'&&args[1]==='create')return 'private output';return docker(args);};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);assert.equal(result.status,'UNKNOWN');
  assert.equal(h.records.length,1);assert(!JSON.stringify(h.records).includes('private'));
  const stored=h.records[0] as {containerId:unknown;networkId:unknown};assert.equal(stored.networkId,null);assert.equal(stored.containerId,target==='container'?null:cid);
  assert(!h.calls.some(args=>args[0]==='stop'||args[1]==='rm'));
 }
});

test('IX01 무DB 망 후보 RAM: 원 JSON 분류와 시작 ID 및 sleep 원형 검산',async()=>{
 for(const target of ['json','start','process'] as const){const h=await fixture(),docker=h.ports.docker;let connected=false;
  h.ports.docker=args=>{const raw=docker(args);if(args[0]==='network'&&args[1]==='connect')connected=true;
   if(target==='start'&&args[0]==='start')return nid;
   if(connected&&args[0]==='container'&&args[1]==='inspect'){
    if(target==='json')return '{';if(target==='process'){const value=JSON.parse(raw);value.entrypoint=['postgres'];return canonicalJson(value);}
   }return raw;};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);assert.equal(result.status,'UNKNOWN');
  assert.equal(result.code,target==='json'?'STOPPED_NETWORK_ATTACHED_VERIFY_CONTAINER_JSON':target==='start'?'STOPPED_START':'STOPPED_NETWORK_ATTACHED_VERIFY');
  assert(!h.calls.some(args=>args[0]==='stop'||args[1]==='rm'));
 }
});

test('IX01 무DB 망 후보 RAM: wall 역행과 monotonic 경과는 기한을 연장하지 않는다',async()=>{
 const h=await fixture();let wall=now,mono=10;const clock=h.api.networkProbeClock(now+300_000,()=>wall,()=>mono);
 assert.equal(clock.timeout(),10_000);wall=now-20_000;mono+=295_000;assert.equal(clock.now(),now+295_000);assert.equal(clock.timeout(),5_000);
 mono+=5_000;assert.throws(()=>clock.now());assert.throws(()=>clock.timeout());
 assert.throws(()=>h.api.networkProbeClock(now+300_001,()=>now,()=>0));
 let tick=5;const backwards=h.api.networkProbeClock(now+1000,()=>now,()=>tick);tick=4;assert.throws(()=>backwards.now());
 assert(Object.isFrozen(h.shared.currentNetworkProbeContract.tmpfs));
});

test('IX01 무DB 망 후보 RAM: 연결 검산 실패는 원 고정 진단과 보존만',async()=>{
 const h=await fixture(),docker=h.ports.docker;let connected=false;
 h.ports.docker=args=>{const raw=docker(args);if(args[0]==='network'&&args[1]==='connect')connected=true;
  if(connected&&args[0]==='container'&&args[1]==='inspect'){const value=JSON.parse(raw);value.host.NetworkMode=h.p.network;return canonicalJson(value);}return raw;};
 const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);
 assert.deepEqual(result,{status:'UNKNOWN',stage:'NETWORK',code:'STOPPED_NETWORK_ATTACHED_VERIFY_HOST_NETWORK_MODE'});
 assert.equal(h.records.length,1);assert(!h.calls.some(args=>args[0]==='stop'||args[1]==='rm'));assert.equal(h.calls.at(-1)?.[1],'inspect');
});

test('IX01 무DB 망 후보 RAM: 명령 실패 만료 중복 및 기록 실패는 추가 효과 없음',async()=>{
 for(const boundary of ['preflight','claim','create','network-connect','record','expire'] as const){
  const h=await fixture(),docker=h.ports.docker;
  if(boundary==='preflight')h.ports.preflight=()=>{throw Error('private source');};
  if(boundary==='claim')h.ports.claim=()=>{throw Error('already used');};
  if(boundary==='record')h.ports.record=()=>{throw Error('private path');};
  h.ports.docker=args=>{if(boundary==='create'&&args[0]==='create'||boundary==='network-connect'&&args[0]==='network'&&args[1]==='connect')throw Object.assign(Error('private exception'),{stdout:'private output'});
   const value=docker(args);if(boundary==='expire'&&args[0]==='network'&&args[1]==='connect')h.expire();return value;};
  const result=h.api.runNetworkAttachmentProbe(h.input,h.ports);assert.notEqual(result.status,'CLEANED');
  if(boundary!=='record')assert(!h.calls.some(args=>args[0]==='stop'||args[1]==='rm'));
  assert(!JSON.stringify(result).includes('private'));assert(!JSON.stringify(result).includes(cid));
 }
});

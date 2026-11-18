import assert from 'node:assert/strict';
import test from 'node:test';

const now=1_800_000_000_000,id='a'.repeat(64),other='b'.repeat(64);
function fixture(){
 let tick=now,lists=0;const calls:string[]=[];
 const ports={now:()=>tick,
  readAddresses(){calls.push('addresses');return JSON.stringify([{addr_info:[{family:'inet',local:'172.16.20.3',prefixlen:16}]}]);},
  readRoutes(){calls.push('routes');return JSON.stringify([{table:'main',dst:'172.17.0.0/16'}]);},
  readDockerIds(){calls.push('ids');lists++;return JSON.stringify([id]);},
  readDockerIpam(want:string){calls.push('ipam');assert.equal(want,id);return JSON.stringify({Id:id,IPAM:{Config:[{Subnet:'172.18.0.0/16',Gateway:'172.18.0.1',IPRange:'172.18.0.128/25',AuxiliaryAddresses:{PRIVATE_NAME:'172.18.0.2'}}]}});},
 };
 return {ports,calls,window:{issuedAt:now,expiresAt:now+60_000},expire:()=>{tick=now+60_000;},slow:()=>{tick+=10_001;},backwards:()=>{tick=now-1;},lists:()=>lists};
}
test('IX01 projection RAM: 제한 투영과 시작 종료 ID 검산 뒤 후보만 반환',async()=>{
 const {projectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-projection.ts');const h=fixture();
 assert.deepEqual(projectSubnetCandidate(h.ports,h.window),{code:'CANDIDATE',cidr:'172.19.0.0/28'});
 assert.deepEqual(h.calls,['ids','addresses','routes','ipam','ids']);assert.equal(h.lists(),2);
});
test('IX01 projection RAM: ID 변경 중복 누락과 다른 응답은 UNKNOWN',async()=>{
 const {projectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-projection.ts');
 for(const kind of ['changed','duplicate','invalid','wrong-id','missing','missing-ipv4-field'] as const){const h=fixture();let n=0;
  if(kind==='changed')h.ports.readDockerIds=()=>JSON.stringify(++n===1?[id]:[other]);
  if(kind==='duplicate')h.ports.readDockerIds=()=>JSON.stringify([id,id]);
  if(kind==='invalid')h.ports.readDockerIds=()=>JSON.stringify(['PRIVATE_ID']);
  if(kind==='wrong-id')h.ports.readDockerIpam=()=>JSON.stringify({Id:other,IPAM:{Config:[]}});
  if(kind==='missing')h.ports.readDockerIpam=()=>JSON.stringify({Id:id,IPAM:{}});
  if(kind==='missing-ipv4-field')h.ports.readDockerIpam=()=>JSON.stringify({Id:id,IPAM:{Config:[{Subnet:'172.18.0.0/16',IPRange:null,AuxiliaryAddresses:null}]}});
  const result=projectSubnetCandidate(h.ports,h.window);assert.deepEqual(result,{code:'UNKNOWN'});assert(!JSON.stringify(result).includes(id));
 }
});
test('IX01 projection RAM: 명시 IPv6만 제외하고 혼합 누락 malformed는 UNKNOWN',async()=>{
 const {projectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-projection.ts');const h=fixture();
 h.ports.readAddresses=()=>JSON.stringify([{addr_info:[{family:'inet6',local:'::1',prefixlen:128}]}]);
 h.ports.readRoutes=()=>JSON.stringify([{table:'main',dst:'::/0'}]);
 h.ports.readDockerIpam=()=>JSON.stringify({Id:id,IPAM:{Config:[{Subnet:'fd00::/64',Gateway:'fd00::1',IPRange:'fd00::/80',AuxiliaryAddresses:{hidden:'fd00::2'}}]}});
 assert.deepEqual(projectSubnetCandidate(h.ports,h.window),{code:'CANDIDATE',cidr:'172.16.0.0/28'});
 h.ports.readDockerIpam=()=>JSON.stringify({Id:id,IPAM:{Config:[{Subnet:'fd00::/64',Gateway:'172.16.0.1',IPRange:null,AuxiliaryAddresses:null}]}});
 assert.deepEqual(projectSubnetCandidate(h.ports,h.window),{code:'UNKNOWN'});
 for(const raw of ['{','[{"table":"main","dst":"default","dst":"172.0.0.0/8"}]',JSON.stringify([{dst:'default'}]),JSON.stringify([{table:'main',dst:'unknown'}])]){
  const f=fixture();f.ports.readRoutes=()=>raw;assert.deepEqual(projectSubnetCandidate(f.ports,f.window),{code:'UNKNOWN'});
 }
 const f=fixture();f.ports.readAddresses=()=>JSON.stringify([{addr_info:[{family:'inet6',local:'172.16.0.1',prefixlen:16}]}]);
 assert.deepEqual(projectSubnetCandidate(f.ports,f.window),{code:'UNKNOWN'});
});
test('IX01 projection RAM: 기한 역행 원예외 및 동기 포트 형상은 후속 읽기 없이 닫힘',async()=>{
 const {projectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-projection.ts');
 for(const kind of ['expire','slow','backwards','error','promise'] as const){const h=fixture();
  const read=()=>{h.calls.push('addresses');if(kind==='expire')h.expire();if(kind==='slow')h.slow();if(kind==='backwards')h.backwards();if(kind==='error')throw Error('PRIVATE_PATH');return kind==='promise'?Promise.resolve('[]'):'[]';};
  const result=projectSubnetCandidate({...h.ports,readAddresses:read},h.window);
  assert.deepEqual(result,{code:'UNKNOWN'});assert.deepEqual(h.calls,['ids','addresses']);assert(!JSON.stringify(result).includes('PRIVATE'));
 }
 const h=fixture();assert.deepEqual(projectSubnetCandidate(h.ports,{...h.window,expiresAt:now+60_001}),{code:'UNKNOWN'});assert.deepEqual(h.calls,[]);
});
test('IX01 projection RAM: 원문 및 배열 총량 초과는 UNKNOWN',async()=>{
 const {projectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-projection.ts');
 for(const kind of ['bytes','ids','addresses','routes','configs','reserved'] as const){const h=fixture();
  if(kind==='bytes')h.ports.readAddresses=()=>' '.repeat(1_048_577);
  if(kind==='ids')h.ports.readDockerIds=()=>JSON.stringify(new Array(4097).fill(id));
  if(kind==='addresses')h.ports.readAddresses=()=>JSON.stringify([{addr_info:new Array(4097).fill({family:'inet',local:'127.0.0.1',prefixlen:8})}]);
  if(kind==='routes')h.ports.readRoutes=()=>JSON.stringify(new Array(16385).fill({table:'main',dst:'default'}));
  if(kind==='configs')h.ports.readDockerIpam=()=>JSON.stringify({Id:id,IPAM:{Config:new Array(4097).fill({Subnet:'10.0.0.0/8',Gateway:null,IPRange:null,AuxiliaryAddresses:null})}});
  if(kind==='reserved')h.ports.readDockerIpam=()=>JSON.stringify({Id:id,IPAM:{Config:[{Subnet:'10.0.0.0/8',Gateway:null,IPRange:null,AuxiliaryAddresses:Object.fromEntries(Array.from({length:16385},(_,i)=>['k'+i,'10.0.0.1']))}]}});
  assert.deepEqual(projectSubnetCandidate(h.ports,h.window),{code:'UNKNOWN'});
 }
});
test('IX01 projection RAM: 빈 IPAM과 목록 순서 변경은 허용하며 callable own call은 실행0',async()=>{
 const {projectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-projection.ts');const h=fixture();let n=0,traps=0;
 h.ports.readDockerIds=()=>JSON.stringify(++n===1?[id,other]:[other,id]);
 h.ports.readDockerIpam=want=>JSON.stringify({Id:want,IPAM:{Config:want===id?null:[]}});
 Object.defineProperty(h.ports.readRoutes,'call',{get(){traps++;throw Error('PRIVATE');}});
 assert.deepEqual(projectSubnetCandidate(h.ports,h.window),{code:'CANDIDATE',cidr:'172.18.0.0/28'});assert.equal(traps,0);
 const invalid=Object.defineProperty({...h.ports},'readAddresses',{get(){traps++;throw Error('PRIVATE');}});
 assert.deepEqual(projectSubnetCandidate(invalid,h.window),{code:'UNKNOWN'});assert.equal(traps,0);
 const resolved=Promise.resolve('[]');Object.defineProperty(resolved,'constructor',{get(){traps++;throw Error('PRIVATE_SPECIES');}});
 assert.deepEqual(projectSubnetCandidate({...h.ports,readAddresses:()=>resolved},h.window),{code:'UNKNOWN'});assert.equal(traps,0);
});

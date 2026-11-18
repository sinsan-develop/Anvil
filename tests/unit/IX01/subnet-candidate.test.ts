import assert from 'node:assert/strict';
import test from 'node:test';

const now=1_800_000_000_000;
const snapshot=()=>({schemaVersion:1,observedAt:now,complete:{interfaces:true,routesAllTables:true,dockerIpam:true},
 interfaces:[] as {address:string;prefixLength:number}[],routes:[] as {table:string|number;destination:string}[],
 dockerIpam:[] as {subnet:string;ipRange:string|null;gateway:string|null;reserved:string[]}[]});

test('IX01 subnet RAM: 선언된 완전 투영의 첫 후보만 반환하고 입력은 불변',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');
 const input=snapshot(),before=JSON.stringify(input);
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'CANDIDATE',cidr:'172.16.0.0/28'});
 assert.equal(JSON.stringify(input),before);
 assert.deepEqual(selectSubnetCandidate({...input,observedAt:now-300_000},now),{code:'CANDIDATE',cidr:'172.16.0.0/28'});
});

test('IX01 subnet RAM: 인터페이스 전체 prefix와 모든 table 집계 및 역포함 차단',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');
 const input=snapshot();input.interfaces.push({address:'172.16.255.254',prefixLength:16});
 input.routes.push({table:'main',destination:'172.17.9.7/16'},{table:123,destination:'172.18.0.8/29'},
  {table:'local',destination:'172.18.0.16'},{table:'main',destination:'default'},{table:254,destination:'0.0.0.0/0'});
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'CANDIDATE',cidr:'172.18.0.32/28'});
 input.routes.push({table:123,destination:'172.0.0.0/8'});
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'NO_CANDIDATE'});
});

test('IX01 subnet RAM: 경계 인접 및 원 attached 호스트 범위를 유지',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');
 const input=snapshot();input.routes.push({table:'main',destination:'172.16.0.16/28'});
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'CANDIDATE',cidr:'172.16.0.0/28'});
 input.routes=[{table:'main',destination:'172.16.0.0/17'},{table:'main',destination:'172.16.128.0/18'},
  {table:'main',destination:'172.16.192.0/19'},{table:'main',destination:'172.16.224.0/20'},
  {table:'main',destination:'172.16.240.0/21'},{table:'main',destination:'172.16.248.0/22'},
  {table:'main',destination:'172.16.252.0/23'},{table:'main',destination:'172.16.254.0/24'}];
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'CANDIDATE',cidr:'172.17.0.0/28'});
 const last=snapshot();last.routes.push({table:1,destination:'172.16.0.0/13'},{table:2,destination:'172.24.0.0/14'},
  {table:3,destination:'172.28.0.0/15'},{table:4,destination:'172.30.0.0/16'},
  {table:5,destination:'172.31.0.0/17'},{table:6,destination:'172.31.128.0/18'},
  {table:7,destination:'172.31.192.0/19'},{table:8,destination:'172.31.224.0/20'},
  {table:9,destination:'172.31.240.0/21'},{table:10,destination:'172.31.248.0/22'},
  {table:11,destination:'172.31.252.0/23'});
 for(let start=0;start<240;start+=16)last.routes.push({table:12,destination:'172.31.254.'+start+'/28'});
 assert.deepEqual(selectSubnetCandidate(last,now),{code:'CANDIDATE',cidr:'172.31.254.240/28'});
 last.routes.push({table:12,destination:'172.31.254.240/28'});
 assert.deepEqual(selectSubnetCandidate(last,now),{code:'NO_CANDIDATE'});
});

test('IX01 subnet RAM: Docker IPAM 전체 subnet과 range gateway reserved 검산',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');
 const input=snapshot();input.dockerIpam.push({subnet:'172.16.0.0/24',ipRange:'172.16.0.128/25',gateway:'172.16.0.1',reserved:['172.16.0.2']});
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'CANDIDATE',cidr:'172.16.1.0/28'});
 for(const change of [{ipRange:'172.17.0.0/24'},{gateway:'172.17.0.1'},{reserved:['172.17.0.2']},
  {subnet:'::/0'},{ipRange:'bad'},{gateway:''},{reserved:[null]},{gateway:undefined}]){
  assert.deepEqual(selectSubnetCandidate({...input,dockerIpam:[{...input.dockerIpam[0],...change}]},now),{code:'UNKNOWN'});
 }
 assert.deepEqual(selectSubnetCandidate({...input,dockerIpam:[{subnet:'172.16.0.0/12',ipRange:null,gateway:null,reserved:[]}]},now),{code:'NO_CANDIDATE'});
});

test('IX01 subnet RAM: 누락 불완전 시각 형상 및 계산량 한도는 UNKNOWN',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');
 const input=snapshot();
 for(const value of [null,{}, {...input,observedAt:now+1},{...input,observedAt:now-300_001},
  {...input,complete:{...input.complete,routesAllTables:false}}, {...input,complete:undefined},
  {...input,interfaces:[{address:'172.016.0.1',prefixLength:16}]}, {...input,interfaces:[{address:'172.16.0.1',prefixLength:33}]},
  {...input,routes:[{table:'main',destination:'172.0.0.1/0'}]}, {...input,routes:[{destination:'default'}]},
  {...input,routes:[{table:'main',destination:'172.16.0.0/033'}]}, {...input,routes:[{table:'main',destination:'::/0'}]},
  {...input,interfaces:new Array(4097).fill({address:'127.0.0.1',prefixLength:8})},
  {...input,routes:new Array(16385).fill({table:'main',destination:'default'})},
  {...input,dockerIpam:new Array(4097).fill({subnet:'10.0.0.0/8',ipRange:null,gateway:null,reserved:[]})},
  {...input,dockerIpam:[{subnet:'10.0.0.0/8',ipRange:null,gateway:null,reserved:new Array(16385).fill('10.0.0.1')}]},
 ])assert.deepEqual(selectSubnetCandidate(value,now),{code:'UNKNOWN'});
 for(const clock of [NaN,Infinity,-1,now+0.5])assert.deepEqual(selectSubnetCandidate(input,clock),{code:'UNKNOWN'});
});

test('IX01 subnet RAM: Proxy accessor 및 임의 caller 코드를 실행하거나 출력하지 않음',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');let traps=0;
 const proxy=new Proxy({}, {get(){traps++;throw Error('PRIVATE');},getPrototypeOf(){traps++;throw Error('PRIVATE');},ownKeys(){traps++;throw Error('PRIVATE');}});
 const input=snapshot(),accessor=Object.defineProperty({...input},'interfaces',{get(){traps++;throw Error('PRIVATE');},enumerable:true});
 const nested=Object.defineProperty({table:'main'},'destination',{get(){traps++;throw Error('PRIVATE');},enumerable:true});
 for(const value of [proxy,accessor,{...input,interfaces:proxy},{...input,routes:[nested]},
  {...input,dockerIpam:[{subnet:'10.0.0.0/8',ipRange:null,gateway:null,reserved:proxy}]}]){
  const result=selectSubnetCandidate(value,now);assert.deepEqual(result,{code:'UNKNOWN'});assert(!JSON.stringify(result).includes('PRIVATE'));
 }
 assert.equal(traps,0);
});

test('IX01 subnet RAM: 정확 배열 상한 수용과 여러 IPAM 행의 총 reserved 상한',async()=>{
 const {selectSubnetCandidate}=await import('../../../scripts/qa-ix01-subnet-candidate.ts');const input=snapshot();
 input.interfaces=new Array(4096).fill({address:'127.0.0.1',prefixLength:8});
 input.routes=new Array(16384).fill({table:'main',destination:'default'});
 input.dockerIpam=Array.from({length:4096},()=>({subnet:'10.0.0.0/8',ipRange:null,gateway:null,reserved:[] as string[]}));
 input.dockerIpam[0]!.reserved=new Array(8192).fill('10.0.0.1');input.dockerIpam[1]!.reserved=new Array(8192).fill('10.0.0.2');
 assert.deepEqual(selectSubnetCandidate(input,now),{code:'CANDIDATE',cidr:'172.16.0.0/28'});
 input.dockerIpam[2]!.reserved=['10.0.0.3'];assert.deepEqual(selectSubnetCandidate(input,now),{code:'UNKNOWN'});
});

import {types} from 'node:util';
import {createSubnetNativeIdentity,type SubnetHostPorts} from './qa-ix01-subnet-observation-host.ts';
import {readSubnetCompletionBinding} from './qa-ix01-subnet-observation-remote.ts';
const node='/opt/node-v24.22.1-linux-x64/bin/node',nodeHash='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
const locations=Object.freeze({USR_BIN:'/usr/bin/ip',USR_SBIN:'/usr/sbin/ip',BIN:'/bin/ip',SBIN:'/sbin/ip'});
const maxBytes=160*1024*1024,unknown=Object.freeze({code:'UNKNOWN',line:'{"code":"UNKNOWN"}\n'} as const);
const keys=['kind','dev','ino','uid','gid','mode','nlink','size','rdev','mtimeNs','ctimeNs'] as const;
type Metadata={kind:string;dev:string;ino:string;uid:number;gid:number;mode:number;nlink:number;size:number;rdev:string;mtimeNs:string;ctimeNs:string};
function fail():never{throw null;}
function fields(value:unknown,names:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==names.length)return fail();
 const out:Record<string,unknown>=Object.create(null);for(const name of names){const d=Object.getOwnPropertyDescriptor(value,name);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return fail();out[name]=d.value;}return out;
}
function metadata(raw:unknown):Metadata{
 const v=fields(raw,keys);
 for(const name of ['uid','gid','mode','nlink','size'])if(typeof v[name]!=='number'||!Number.isSafeInteger(v[name])||(v[name] as number)<0)return fail();
 for(const name of ['dev','ino','rdev','mtimeNs','ctimeNs'])if(typeof v[name]!=='string'||!/^\d{1,30}$/.test(v[name] as string))return fail();
 if(typeof v.kind!=='string'||!['file','directory'].includes(v.kind))return fail();return v as Metadata;
}
function strings(raw:unknown,max:number):string[]{
 if(types.isProxy(raw)||!Array.isArray(raw)||Object.getPrototypeOf(raw)!==Array.prototype||raw.length>max||Reflect.ownKeys(raw).length!==raw.length+1)return fail();
 const out:string[]=[];for(let i=0;i<raw.length;i++){const d=Object.getOwnPropertyDescriptor(raw,String(i));if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return fail();out.push(d.value);}return out;
}
const same=(a:Metadata,b:Metadata)=>keys.every(k=>a[k]===b[k]);
/** 기존 신뢰 SSH host 아래 고정 Node와 OS 경로의 파일 측정만 수행한다.
 * root 소유/metadata는 배포·패키지 서명의 독립 증명이 아니다. 패키지 DB·서명 조회나
 * 임의 VERIFIED 입력을 추가하지 않는다. helperHash/approvalHash는 외부 감독의 상관 결박이며
 * 이 함수가 승인/자기 소스 신원을 발급하지 않는다. import는 실제 OS 읽기 효과0이다.
 * default fingerprint는 기존 host의 NOFOLLOW·전후 lstat/fstat·65,536B 분할·finally close를
 * 그대로 재사용한다. 실제 SSH/Node 진입·외부 단회 기록·절대 종료 감독은 별도 실행안 선행이다.
 */
export function inspectSubnetIpPreflight(input:unknown,ports:Omit<SubnetHostPorts,'execute'>=createSubnetNativeIdentity()){
 try{
  const v=fields(input,['proof','window','location']),p=fields(v.proof,['attemptId','helperHash','approvalHash']);
  const binding=readSubnetCompletionBinding({attemptId:p.attemptId,bundleHash:p.helperHash,approvalHash:p.approvalHash},v.window);
  if(typeof v.location!=='string'||!Object.hasOwn(locations,v.location))return unknown;
  const location=v.location as keyof typeof locations,ip=locations[location];
  const callbacks=fields(ports,['now','monotonic','context','realpath','inspect','fingerprint']);
  for(const fn of Object.values(callbacks))if(typeof fn!=='function'||types.isProxy(fn))return unknown;
  const invoke=(name:string,args:unknown[]=[])=>Reflect.apply(callbacks[name] as Function,ports,args) as unknown;
  const firstWall=invoke('now'),firstMono=invoke('monotonic');
  if(typeof firstWall!=='number'||!Number.isSafeInteger(firstWall)||firstWall<binding.window.issuedAt||firstWall>=binding.window.expiresAt||typeof firstMono!=='number'||!Number.isFinite(firstMono)||firstMono<0)return unknown;
  const until=Math.min(binding.window.expiresAt,firstWall+10000);let lastWall=firstWall,lastMono=firstMono;
  const clock=()=>{const wall=invoke('now'),mono=invoke('monotonic');if(typeof wall!=='number'||!Number.isSafeInteger(wall)||wall<lastWall||wall>=until||typeof mono!=='number'||!Number.isFinite(mono)||mono<lastMono||mono-firstMono>=10000)return fail();lastWall=wall;lastMono=mono;return wall;};
  const context=()=>{clock();const c=fields(invoke('context'),['platform','uid','hostname','execPath','execArgv','environmentKeys']);
   const argv=strings(c.execArgv,1);strings(c.environmentKeys,0);
   if(c.platform!=='linux'||c.uid!==1000||c.hostname!=='SINSAN'||c.execPath!==node||!(argv.length===0||argv[0]==='--input-type=module'))return fail();clock();};
  const inspect=(path:string)=>{clock();const m=metadata(invoke('inspect',[path]));clock();return m;};
  const resolved=(path:string)=>{clock();const r=invoke('realpath',[path]);clock();if(r!==path)return fail();};
  const held=new Map<string,Metadata>();
  const pin=(path:string,m:Metadata)=>{const prior=held.get(path);if(prior&&!same(prior,m))return fail();held.set(path,m);};
  const parents=(path:string)=>{let current='';for(const part of ['',...path.split('/').filter(Boolean)]){current=part?current==='/'?'/'+part:current+'/'+part:'/';
   const m=inspect(current);if(m.kind!=='directory'||m.uid!==0||(m.mode&0o022)!==0)return fail();resolved(current);pin(current,m);}};
  const readFile=(path:string)=>{
   parents(path.slice(0,path.lastIndexOf('/')));const before=inspect(path);resolved(path);
   if(before.kind!=='file'||before.uid!==0||before.nlink!==1||(before.mode&0o7777)!==0o755||before.size<=0||before.size>maxBytes)return fail();
   const digest=invoke('fingerprint',[path,maxBytes,clock]);clock();
   if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest)||!same(before,inspect(path)))return fail();resolved(path);pin(path,before);return {digest,metadata:before};
  };
  context();if(readFile(node).digest!==nodeHash)return unknown;
  const measured=readFile(ip);
  context();for(const [path,prior]of held){resolved(path);if(!same(prior,inspect(path)))return unknown;}
  const measuredAt=clock();
  const envelope={schemaVersion:1,purpose:'IX01_SUBNET_IP_MEASUREMENT',basis:'FIXED_NODE_PATH_METADATA',
   attemptId:binding.proof.attemptId,helperHash:binding.proof.bundleHash,approvalHash:binding.proof.approvalHash,
   ...binding.window,measuredAt,location,measurement:{sha256:measured.digest,bytes:measured.metadata.size,metadata:measured.metadata}};
  const line=JSON.stringify(envelope)+'\n';if(Buffer.byteLength(line)>4096)return unknown;clock();
  // 반환 후 원 파일을 계속 보유하지 않는다. 다음 관측 host가 expected SHA와 현재 파일을 다시 검산한다.
  return Object.freeze({code:'MEASURED' as const,line});
 }catch{return unknown;}
}

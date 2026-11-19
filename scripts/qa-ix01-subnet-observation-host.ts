import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants,lstatSync,realpathSync,openSync,fstatSync,readSync,closeSync,type BigIntStats} from 'node:fs';
import {hostname} from 'node:os';
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {observeSubnetCandidate,type SubnetReadCommand} from './qa-ix01-subnet-observation-payload.ts';
import type {SubnetCandidateResult} from './qa-ix01-subnet-candidate.ts';

/** 상위 감독이 정확 승인/소스 및 SSH 단1회 진입을 결박한 뒤 공급할 운영 입력이다.
 * ip는 새 관측 지문이 없으면 null이다. 이 객체·합성 포트는 승인이나 신원을 발급하지 않는다.
 * 기존 실행안/판정기 승인을 이 어댑터의 실제 실행 승인으로 자동 확대하지 않는다.
 */
export interface SubnetHostBinding {
 readonly issuedAt:number;readonly expiresAt:number;
 readonly ip:Readonly<{path:string;sha256:string}>|null;
}
export interface SubnetHostCommandOptions {
 readonly cwd:'/';readonly env:Readonly<Record<string,string>>;readonly timeout:number;
 readonly maxBuffer:number;readonly killSignal:'SIGKILL';readonly stdio:readonly ['ignore','pipe','ignore'];
 readonly shell:false;readonly windowsHide:true;
}
/** 합성 검수용 포트. 기본 구현만 실제 OS 읽기/원 자식 호출을 수행한다.
 * 포트가 돌려준 모의 지문/metadata를 실제 운영 증거로 취급하지 않는다.
 */
export interface SubnetHostPorts {
 now():number;monotonic():number;context():unknown;
 realpath(path:string):unknown;inspect(path:string):unknown;
 fingerprint(path:string,maxBytes:number,check:()=>void):unknown;
 execute(file:string,args:readonly string[],options:SubnetHostCommandOptions):unknown;
}
const tools=Object.freeze({node:'/opt/node-v24.22.1-linux-x64/bin/node',
 nodeHash:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',
 docker:'/usr/bin/docker',dockerHash:'7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b'});
// 기존 A14/N1에서 고정했던 Node/Docker 원바이트 지문. ip 지문을 추측하여 추가하지 않는다.
const env=Object.freeze({PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',LC_ALL:'C'});
const unknown=Object.freeze({code:'UNKNOWN'} as const),maxToolBytes=160*1024*1024;
const metadataKeys=['kind','dev','ino','uid','gid','mode','nlink','size','rdev','mtimeNs','ctimeNs'] as const;
type Metadata={kind:string;dev:string;ino:string;uid:number;gid:number;mode:number;nlink:number;size:number;rdev:string;mtimeNs:string;ctimeNs:string};
function invalid():never{throw null;}
function exact(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(value===null||typeof value!=='object'||types.isProxy(value))return invalid();
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return invalid();
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))return invalid();
 const result:Record<string,unknown>=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return invalid();result[key]=d.value;}return result;
}
function metadata(value:unknown):Metadata{
 const row=exact(value,metadataKeys);
 for(const key of ['uid','gid','mode','nlink','size'])if(typeof row[key]!=='number'||!Number.isSafeInteger(row[key])||(row[key] as number)<0)return invalid();
 for(const key of ['dev','ino','rdev','mtimeNs','ctimeNs'])if(typeof row[key]!=='string'||!/^\d{1,30}$/.test(row[key] as string))return invalid();
 if(typeof row.kind!=='string'||!['file','directory','socket','character'].includes(row.kind))return invalid();return row as Metadata;
}
function stringArray(value:unknown,max:number):string[]{
 if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||Reflect.ownKeys(value).length!==value.length+1)return invalid();
 const result:string[]=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable||typeof d.value!=='string')return invalid();result.push(d.value);
 }return result;
}
const same=(a:Metadata,b:Metadata)=>metadataKeys.every(k=>a[k]===b[k]);
function snapshot(s:BigIntStats):Metadata{
 return {kind:s.isFile()?'file':s.isDirectory()?'directory':s.isSocket()?'socket':s.isCharacterDevice()?'character':'other',
  dev:String(s.dev),ino:String(s.ino),uid:Number(s.uid),gid:Number(s.gid),mode:Number(s.mode),nlink:Number(s.nlink),size:Number(s.size),rdev:String(s.rdev),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs)};
}
function nativePorts():SubnetHostPorts{
 return {
  now:()=>Date.now(),monotonic:()=>performance.now(),
  context:()=>({platform:process.platform,uid:process.getuid?.(),hostname:hostname(),execPath:process.execPath,
   execArgv:[...process.execArgv],environmentKeys:Object.keys(process.env)}),
  realpath:path=>realpathSync(path),inspect:path=>snapshot(lstatSync(path,{bigint:true})),
  fingerprint(path,maxBytes,check){
   check();const before=metadata(snapshot(lstatSync(path,{bigint:true})));
   if(before.kind!=='file'||before.uid!==0||before.nlink!==1||(before.mode&0o7777)!==0o755||before.size<=0||before.size>maxBytes||realpathSync(path)!==path)return invalid();
   const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   try{
    if(!same(before,metadata(snapshot(fstatSync(fd,{bigint:true})))))return invalid();
    const hash=createHash('sha256'),buffer=Buffer.alloc(65_536);let size=0;
    for(;;){check();const n=readSync(fd,buffer,0,Math.min(buffer.length,before.size-size+1),null);check();
     if(n===0)break;size+=n;if(size>before.size)return invalid();hash.update(buffer.subarray(0,n));}
    if(size!==before.size||!same(before,metadata(snapshot(fstatSync(fd,{bigint:true}))))||!same(before,metadata(snapshot(lstatSync(path,{bigint:true})))))return invalid();
    check();return hash.digest('hex');
   }finally{closeSync(fd);}
  },
  execute(file,args,options){
   // shell/input/상속 env 없음. stderr는 OS null로 보내며 예외·출력 원문을 반환하지 않는다.
   const out=spawnSync(file,[...args],{...options,env:{...options.env},stdio:['ignore','pipe','ignore']});
   if(out.error||out.status!==0||out.signal!==null||!Buffer.isBuffer(out.stdout)||out.stdout.length>options.maxBuffer)return {ok:false,stdout:''};
   try{return {ok:true,stdout:new TextDecoder('utf-8',{fatal:true}).decode(out.stdout)};}catch{return {ok:false,stdout:''};}
  },
 };
}

const daemonTemplate='{"ID":{{json .ID}},"Name":{{json .Name}}}';
const ipamTemplate='{"Id":{{json .Id}},"IPAM":{"Config":{{if .IPAM.Config}}[{{range $i, $c := .IPAM.Config}}{{if $i}},{{end}}{"Subnet":{{json $c.Subnet}},"IPRange":{{json $c.IPRange}},"Gateway":{{json $c.Gateway}},"AuxiliaryAddresses":{{json $c.AuxiliaryAddresses}}}{{end}}]{{else}}null{{end}}}}';
function sameArgs(actual:readonly string[],expected:readonly string[]):boolean{return actual.length===expected.length&&actual.every((v,i)=>v===expected[i]);}
function allowed(command:SubnetReadCommand):boolean{
 const a=command.args;
 if(command.tool==='ip')return sameArgs(a,['-j','-4','address','show'])||sameArgs(a,['-j','-4','-details','route','show','table','all']);
 if(command.tool!=='docker'||a[0]!=='--host'||a[1]!=='unix:///var/run/docker.sock')return false;
 return sameArgs(a,['--host','unix:///var/run/docker.sock','info','--format',daemonTemplate])
  ||sameArgs(a,['--host','unix:///var/run/docker.sock','network','ls','--no-trunc','--format','{{json .ID}}'])
  ||a.length===7&&sameArgs(a.slice(0,6),['--host','unix:///var/run/docker.sock','network','inspect','--format',ipamTemplate])&&/^[a-f0-9]{64}$/.test(a[6]!);
}

/** 직접 실행/CLI/SSH entry가 없다. 운영 호출은 상위 감독의 정확 소스·승인·단회 결박 후에만.
 * native timeout은 SIGKILL과 원 spawnSync 종결을 사용한다. OS가 동기 read/종결에서 반환하지
 * 못하는 경우까지 JS가 선점할 수는 없으므로 외부 감독도 원 프로세스의 절대 한도를 강제해야 한다.
 * /dev/null 방식은 기존 N1 사전검산 선례이며 현재 Docker 호환성은 재검증 전 미확인이다.
 * 소유자 root의 도구/부모/current metadata를 검산하나 특권 주체의 교체와 원자적 실행까지
 * 증명하는 새로운 보호 권위는 아니다. 파일/외피/설정/자원 생성 또는 정리는 수행하지 않는다.
 */
export function observeSubnetOnHost(input:unknown,ports:SubnetHostPorts=nativePorts()):SubnetCandidateResult{
 try{
  const binding=exact(input,['issuedAt','expiresAt','ip']),ip=exact(binding.ip,['path','sha256']);
  if(typeof ip.path!=='string'||!['/usr/bin/ip','/usr/sbin/ip','/bin/ip','/sbin/ip'].includes(ip.path)||typeof ip.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ip.sha256))return unknown;
  const start=binding.issuedAt,end=binding.expiresAt;
  if(typeof start!=='number'||typeof end!=='number'||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<=0||end<=start||end-start>60_000)return unknown;
  const callbacks=exact(ports,['now','monotonic','context','realpath','inspect','fingerprint','execute']);
  for(const callback of Object.values(callbacks))if(typeof callback!=='function'||types.isProxy(callback))return unknown;
  const invoke=(name:string,args:unknown[]=[])=>Reflect.apply(callbacks[name] as Function,ports,args) as unknown;
  const firstMono=invoke('monotonic');if(typeof firstMono!=='number'||!Number.isFinite(firstMono)||firstMono<0)return unknown;
  let lastWall=start,lastMono=firstMono;
  const clock=()=>{const wall=invoke('now'),mono=invoke('monotonic');
   if(typeof wall!=='number'||!Number.isSafeInteger(wall)||wall<lastWall||wall>=end||typeof mono!=='number'||!Number.isFinite(mono)||mono<lastMono||mono-firstMono>=60_000)return invalid();
   lastWall=wall;lastMono=mono;return {wall,mono};};
  const context=()=>{
   clock();const c=exact(invoke('context'),['platform','uid','hostname','execPath','execArgv','environmentKeys']);
   const argv=stringArray(c.execArgv,1);stringArray(c.environmentKeys,0);
   if(c.platform!=='linux'||c.uid!==1000||c.hostname!=='SINSAN'||c.execPath!==tools.node
    ||!(argv.length===0||argv[0]==='--input-type=module'))return invalid();clock();
  };
  context();const held=new Map<string,Metadata>();
  const inspect=(path:string)=>{clock();const s=metadata(invoke('inspect',[path]));clock();return s;};
  const resolved=(path:string)=>{clock();const value=invoke('realpath',[path]);clock();return value;};
  const directories=(path:string)=>{
   let current='';for(const part of ['',...path.split('/').filter(Boolean)]){current=part?current==='/'?'/'+part:current+'/'+part:'/';
    const s=inspect(current);if(s.kind!=='directory'||s.uid!==0||(s.mode&0o022)!==0||resolved(current)!==current)return invalid();
    const prior=held.get(current);if(prior&&!same(prior,s))return invalid();held.set(current,s);
   }
  };
  for(const [path,digest] of [[tools.node,tools.nodeHash],[tools.docker,tools.dockerHash],[ip.path,ip.sha256]]){
   directories(path!.slice(0,path!.lastIndexOf('/')));const before=inspect(path!);
   if(before.kind!=='file'||before.uid!==0||before.nlink!==1||(before.mode&0o7777)!==0o755||before.size<=0||before.size>maxToolBytes||resolved(path!)!==path)return unknown;
   if(invoke('fingerprint',[path,maxToolBytes,clock])!==digest||!same(before,inspect(path!)))return unknown;held.set(path!,before);
  }
  directories('/dev');const nullDevice=inspect('/dev/null');
  if(nullDevice.kind!=='character'||nullDevice.uid!==0||nullDevice.gid!==0||nullDevice.rdev!=='259'||nullDevice.nlink!==1||(nullDevice.mode&0o7777)!==0o666||resolved('/dev/null')!=='/dev/null')return unknown;held.set('/dev/null',nullDevice);
  const socket=resolved('/var/run/docker.sock');if(socket!=='/run/docker.sock'&&socket!=='/var/run/docker.sock')return unknown;
  directories(socket.slice(0,socket.lastIndexOf('/')));const socketIdentity=inspect(socket);
  if(socketIdentity.kind!=='socket'||socketIdentity.uid!==0||(socketIdentity.mode&0o002)!==0)return unknown;held.set(socket,socketIdentity);
  const fresh=()=>{context();for(const [path,prior] of held){if(resolved(path)!==path||!same(prior,inspect(path)))return invalid();}
   if(resolved('/var/run/docker.sock')!==socket)return invalid();clock();};
  const result=observeSubnetCandidate({now:()=>clock().wall,monotonic:()=>clock().mono,
   run(command){
    if(!allowed(command)||!Number.isInteger(command.timeoutMs)||command.timeoutMs<=0||command.timeoutMs>10_000||command.maxOutputBytes!==1_048_576)return invalid();
    fresh();const before=clock(),timeout=Math.floor(Math.min(command.timeoutMs,end-before.wall,60_000-(before.mono-firstMono)));if(timeout<=0)return invalid();
    const options:SubnetHostCommandOptions=Object.freeze({cwd:'/',env,timeout,maxBuffer:1_048_576,killSignal:'SIGKILL',stdio:Object.freeze(['ignore','pipe','ignore'] as const),shell:false,windowsHide:true});
    const args=Object.freeze(command.tool==='docker'?['--config','/dev/null',...command.args]:[...command.args]);
    const raw=invoke('execute',[command.tool==='docker'?tools.docker:ip.path,args,options]),after=clock();
    if(after.wall-before.wall>timeout||after.mono-before.mono>timeout)return invalid();
    const out=exact(raw,['ok','stdout']);if(out.ok!==true||typeof out.stdout!=='string'||!out.stdout.isWellFormed()||out.stdout.length>options.maxBuffer||Buffer.byteLength(out.stdout)>options.maxBuffer)return invalid();
    fresh();return {status:'OK',stdout:out.stdout};
   },
  },{issuedAt:start,expiresAt:end});
  if(result.code==='UNKNOWN')return result;fresh();return result;
 }catch{return unknown;}
}

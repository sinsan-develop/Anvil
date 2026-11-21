import {isTc01OfficialEvidencePath} from './qa-fn03-tc01-evidence-paths.ts';
import * as fs from 'node:fs';
import {posix} from 'node:path';
import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';

interface Row {path:string;bytes:number;sha256:string}
export interface Tc01PreloadSupervisor {
 now():number;monotonic():number;
 /** 동일 감독의 실제 승인/원 source·runtime 보유 검산. void/합성 포트가 권위를 발급하지 않는다. */
 assertCurrent(binding:Readonly<Record<string,unknown>>,runtime:Readonly<Record<string,unknown>>):void;
}
export interface Tc01PreloadFilesPort {
 context():unknown;lstat(path:string):unknown;fstat(fd:number):unknown;realpath(path:string):string;
 open(path:string):number;read(fd:number,buffer:Buffer,offset:number,length:number,position:number):number;close(fd:number):void;
 readdir(path:string,limit:number):unknown;
}
export interface Tc01PreloadInput {preparation:unknown;retainPaths:readonly string[]}
const error=():never=>{throw Error('FN03_TC01_PRELOAD_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)error();}
const statKeys=['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs','nlink'] as const;
const parentKeys=['dev','ino','uid','gid','mode'] as const;
const portKeys=['context','lstat','fstat','realpath','open','read','close','readdir'] as const;
const supervisorKeys=['now','monotonic','assertCurrent'] as const;
const bindingKeys=['attemptId','approvalId','planHash','approvalHash','sourceHead','issuedAt','expiresAt','artifactRoot','subnet','purpose','profile'];
const runtimeKeys=['sourceHead','entry','nodeSha256','sourceClosureSha256','packageLockSha256','installedDependenciesSha256'];
const MiB=1048576;
const fill=Uint8Array.prototype.fill;
const clear=(b:Buffer)=>{fill.call(b,0);};
function record(v:unknown,keys:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);for(const key of keys){const x=d[key];check(x&&'value'in x);out[key]=x.value;}return out;
}
function array(v:unknown,max:number):unknown[]{
 check(Array.isArray(v)&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v) as unknown as Record<string,PropertyDescriptor>,n=d.length?.value;
 check(Number.isSafeInteger(n)&&n>=0&&n<=max&&Reflect.ownKeys(d).length===n+1);return Array.from({length:n},(_,i)=>{const x=d[String(i)];check(x&&'value'in x);return x.value;});
}
function stat(v:unknown){const s=record(v,statKeys);for(const k of statKeys)check(typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=0&&(k==='mtimeMs'||k==='ctimeMs'||Number.isSafeInteger(s[k])));check(s.mode<=65535);return Object.freeze(s);}
const same=(a:Record<string,any>,b:Record<string,any>,keys:readonly string[]=statKeys)=>keys.every(k=>a[k]===b[k]);
function nativeFiles():Tc01PreloadFilesPort{
 const project=(s:fs.Stats)=>Object.fromEntries(statKeys.map(k=>[k,s[k]]));
 return Object.freeze({context:()=>({platform:process.platform,uid:process.getuid?.()}),lstat:(p:string)=>project(fs.lstatSync(p)),fstat:(fd:number)=>project(fs.fstatSync(fd)),realpath:(p:string)=>fs.realpathSync(p),
  open:(p:string)=>{check(typeof fs.constants.O_NOFOLLOW==='number'&&fs.constants.O_NOFOLLOW>0&&typeof fs.constants.O_NONBLOCK==='number'&&fs.constants.O_NONBLOCK>0);return fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);},
  read:(fd:number,b:Buffer,o:number,n:number,p:number)=>fs.readSync(fd,b,o,n,p),close:(fd:number)=>fs.closeSync(fd),readdir:(p:string,limit:number)=>{check(Number.isSafeInteger(limit)&&limit>0&&limit<=20001);const dir=fs.opendirSync(p,{bufferSize:1}),names:string[]=[];try{while(names.length<limit){const entry=dir.readSync();if(entry===null)break;names.push(entry.name);}return names;}finally{dir.closeSync();}}});
}
function manifest(raw:unknown,sha:unknown,dependency:boolean):Record<string,any>&{rows:Row[]}{
 check(typeof raw==='string'&&raw.isWellFormed()&&Buffer.byteLength(raw)<=2*MiB&&hashV1(sha));const encoded=Buffer.from(raw);try{check(contentHash(encoded)===sha);}finally{clear(encoded);}
 const m=parseWireJson(raw);check(recordV1(m,dependency?['schemaVersion','sourceHead','packageLockSha256','files']:['schemaVersion','sourceHead','sourceRoot','gitSha256','dockerSha256','files'])&&m.schemaVersion===1);
 const input=array(m.files,20000);check(input.length>0);let prior='',total=0;
 const rows:Row[]=input.map(v=>{const r=record(v,['path','bytes','sha256']);check(typeof r.path==='string'&&(/^[A-Za-z0-9_@.+/-]{1,400}$/.test(r.path)||!dependency&&isTc01OfficialEvidencePath(r.path))&&!r.path.startsWith('/')&&posix.normalize(r.path)===r.path&&!r.path.split('/').some((p:string)=>p==='.'||p==='..'||p==='')&&!r.path.startsWith('.git/')&&r.path.startsWith('node_modules/')===dependency&&r.path>prior&&Number.isSafeInteger(r.bytes)&&r.bytes>=0&&r.bytes<=16*MiB&&hashV1(r.sha256));prior=r.path;total+=r.bytes;check(total<=256*MiB);return Object.freeze({path:r.path,bytes:r.bytes,sha256:r.sha256});});
 return{...m,rows};
}
/** 앱 import/CLI/설치/권위 발급 없음. factory 생성은 효과0, read는 단회다.
 * 기존 native NOFOLLOW/fd 전후·부모 pin·node_modules 정확 집합 검사를 재사용한다.
 * 이름 목록은 예상 자식수+1까지 수거하고 디렉터리 핸들을 원 finally에서 닫는다.
 * 모든 승인 행을 검산하되 retainPaths의 동일 byte만 보유(합계256MiB); 나머지는 즉시 소거.
 * 반환 bytes는 caller가 수정할 수 있으므로 소비 직전 assertCurrent 및 downstream 원 SHA 검산 필요.
 * OS syscall 정지/외부 전체 프로세스 감독·Git HEAD/설치 provenance·완전 graph는 별도 책임이다.
 */
export function createTc01PreloadFiles(supervisor:Tc01PreloadSupervisor,injected?:Tc01PreloadFilesPort){
 let spent=false;
 return Object.freeze({read(input:Tc01PreloadInput){
  if(spent)return error();spent=true;const owned:Buffer[]=[];let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;let failed=false;for(const b of owned){try{clear(b);}catch{failed=true;}}if(failed)error();};
  try{
   const methods=record(supervisor,supervisorKeys);check(supervisorKeys.every(k=>typeof methods[k]==='function'));
   let wall=-1,mono=-1,until=Infinity;
   const clock=()=>{const w=methods.now.call(supervisor),m=methods.monotonic.call(supervisor);check(Number.isSafeInteger(w)&&Number.isSafeInteger(m)&&w>=wall&&m>=mono&&m>=0);wall=w;mono=m;};clock();const startedWall=wall,startedMono=mono;
   const top=record(input,['preparation','retainPaths']),p=record(top.preparation,['binding','runtime','sourceManifestRaw','dependencyManifestRaw']);
   const b=Object.freeze(record(p.binding,bindingKeys)),r=Object.freeze(record(p.runtime,runtimeKeys));
   check(b.purpose==='FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED'&&b.profile==='FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1'&&uuidV1(b.attemptId)&&uuidV1(b.approvalId)&&hashV1(b.planHash)&&hashV1(b.approvalHash)&&typeof b.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(b.sourceHead)&&Number.isSafeInteger(b.issuedAt)&&b.issuedAt>=0&&Number.isSafeInteger(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
   const root='/home/daon/anvil-fn03-tc01-'+b.attemptId+'-qa';check(b.artifactRoot==='/tmp/fn03-tc01-'+b.attemptId);
   const subnet=typeof b.subnet==='string'&&/^172\.(1[6-9]|2\d|3[01])\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(b.subnet);check(subnet&&Number(subnet[2])<=254&&Number(subnet[3])<=240&&Number(subnet[3])%16===0);
   check(r.sourceHead===b.sourceHead&&r.entry==='scripts/qa-fn03-source-content-management-origin-entry.ts'&&r.nodeSha256==='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb'&&[r.sourceClosureSha256,r.packageLockSha256,r.installedDependenciesSha256].every(hashV1));
   const sources=manifest(p.sourceManifestRaw,r.sourceClosureSha256,false),dependencies=manifest(p.dependencyManifestRaw,r.installedDependenciesSha256,true);
   check(sources.sourceHead===b.sourceHead&&sources.sourceRoot===root&&hashV1(sources.gitSha256)&&hashV1(sources.dockerSha256)&&dependencies.sourceHead===b.sourceHead&&dependencies.packageLockSha256===r.packageLockSha256&&sources.rows.find(x=>x.path==='package-lock.json')?.sha256===r.packageLockSha256);
   const rows=[...sources.rows,...dependencies.rows],byPath=new Map(rows.map(row=>[row.path,row]));check(byPath.size===rows.length);
   const keep=array(top.retainPaths,20000) as string[];let prior='',retained=0;for(const path of keep){check(typeof path==='string'&&path>prior&&byPath.has(path));prior=path;retained+=byPath.get(path)!.bytes;check(retained<=256*MiB);}const retain=new Set(keep);
   until=startedMono+b.expiresAt-startedWall;check(Number.isSafeInteger(until));
   const io=injected??nativeFiles(),ops=record(io,portKeys);check(portKeys.every(k=>typeof ops[k]==='function'));
   const guard=()=>{check(!disposed);const current=record(supervisor,supervisorKeys),files=record(io,portKeys);check(supervisorKeys.every(k=>current[k]===methods[k])&&portKeys.every(k=>files[k]===ops[k]));clock();check(wall>=b.issuedAt&&wall<b.expiresAt&&mono<until);check(methods.assertCurrent.call(supervisor,b,r)===undefined);clock();check(wall>=b.issuedAt&&wall<b.expiresAt&&mono<until);};
   const call=(key:typeof portKeys[number],...args:unknown[])=>{guard();const out=ops[key].apply(io,args);guard();return out;};
   const context=record(call('context'),['platform','uid']);check(context.platform==='linux'&&context.uid===1000);
   const pins=new Map<string,Readonly<Record<string,any>>>(),filePins=new Map<string,Readonly<Record<string,any>>>(),directoryPins=new Map<string,Readonly<Record<string,any>>>();
   const pin=(path:string)=>{let cur='';for(const part of path.split('/').filter(Boolean)){cur+='/'+part;const s=stat(call('lstat',cur));check((s.mode&0o170000)===0o040000&&[0,1000].includes(s.uid)&&!(s.mode&0o022));if(cur===root)check(s.uid===1000&&(s.mode&0o7777)===0o700);const old=pins.get(cur);check(!old||same(old,s,parentKeys));pins.set(cur,s);check(pins.size<=40000);}check(call('realpath',path)===path);};
   pin(root);
   const children=new Map<string,Set<string>>([['node_modules',new Set()]]);
   for(const row of dependencies.rows){const parts=row.path.split('/');for(let i=1;i<parts.length;i++){const dir=parts.slice(0,i).join('/');if(!children.has(dir)){check(children.size<20000);children.set(dir,new Set());}children.get(dir)!.add(parts[i]!);}}
   const directory=(relative:string,names:Set<string>)=>{const path=root+'/'+relative;pin(path);const before=stat(call('lstat',path)),namesRead=array(call('readdir',path,names.size+1),20000);check(namesRead.every(v=>typeof v==='string'&&v.length>0&&v.length<=400));check(canonicalJson((namesRead as string[]).sort())===canonicalJson([...names].sort()));check(same(before,stat(call('lstat',path))));directoryPins.set(path,before);};
   for(const [path,names]of children)directory(path,names);
   const output:{path:string;bytes:Buffer}[]=[];
   for(const row of rows){
    const path=root+'/'+row.path;pin(posix.dirname(path));const before=stat(call('lstat',path));
    check((before.mode&0o170000)===0o100000&&before.uid===1000&&before.nlink===1&&!(before.mode&0o022)&&before.size===row.bytes&&call('realpath',path)===path);
    guard();let fd:number|undefined,data:Buffer|undefined;const probe=Buffer.alloc(1);
    try{
     const opened=ops.open.call(io,path);check(Number.isSafeInteger(opened)&&opened>=0);fd=opened;guard();
     check(same(before,stat(call('fstat',fd))));data=Buffer.alloc(row.bytes);owned.push(data);let offset=0;
     while(offset<row.bytes){const size=Math.min(65536,row.bytes-offset),n=call('read',fd,data,offset,size,offset);check(Number.isSafeInteger(n)&&n>0&&n<=size);offset+=n;}
     check(call('read',fd,probe,0,1,row.bytes)===0&&same(before,stat(call('fstat',fd)))&&same(before,stat(call('lstat',path)))&&call('realpath',path)===path&&contentHash(data)===row.sha256);filePins.set(path,before);
    }finally{clear(probe);try{if(fd!==undefined)check(ops.close.call(io,fd)===undefined);}catch{data&&clear(data);throw Error('FN03_TC01_PRELOAD_UNKNOWN');}}
    guard();check(data);if(retain.has(row.path))output.push(Object.freeze({path:row.path,bytes:data}));else{clear(data);check(owned.pop()===data);}
   }
   const assertCurrent=()=>{try{guard();for(const [path,s]of pins)check(same(s,stat(call('lstat',path)),parentKeys)&&call('realpath',path)===path);for(const [path,s]of filePins)check(same(s,stat(call('lstat',path)))&&call('realpath',path)===path);for(const [path,s]of directoryPins)check(same(s,stat(call('lstat',path))));for(const [relative,names]of children){const actual=array(call('readdir',root+'/'+relative,names.size+1),20000);check(actual.every(v=>typeof v==='string'));check(canonicalJson((actual as string[]).sort())===canonicalJson([...names].sort()));}for(const file of output)check(contentHash(file.bytes)===byPath.get(file.path)!.sha256);guard();}catch{dispose();return error();}};
   assertCurrent();output.sort((a,c)=>a.path<c.path?-1:1);
   return Object.freeze({binding:b,runtime:r,sourceRoot:root,files:Object.freeze(output),assertCurrent,dispose});
  }catch{dispose();return error();}
 }});
}

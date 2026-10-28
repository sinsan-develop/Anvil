import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AuthFailure} from '../access/repository.ts';

/** 보호 설치 파일 전용. writable slot의 native 쓰기/삭제 경계를 대체하지 않는다. */
export interface ProtectedFileDescriptor {absolutePath:string;expectedIdentity:{device:string;inode:string};expectedSha256:string;sizeBytes:number;kind:'CATALOG'|'ARTIFACT'}
export interface ProtectedFileObservation {identity:{device:string;inode:string};kind:'directory'|'file'|'symlink'|'fifo'|'other';uid:number;gid:number;mode:number;nlink:number;size:number;mtimeNs:string;ctimeNs:string}
export interface ProtectedFileRuntime {platform:string;arch:string;node:string;napi:string;uid:number;euid:number;pid:number}
export interface ProtectedFileIo {
 open(path:string,flags:number):Promise<{handle:object;fd:number}>;
 fstat(handle:object):Promise<ProtectedFileObservation>;lstat(path:string):Promise<ProtectedFileObservation>;statfs(path:string):Promise<{type:bigint}>;
 read(handle:object,position:number,maxBytes:number):Promise<Uint8Array>;readlink(path:string):Promise<string>;close(handle:object):Promise<void>;
}
export interface ProtectedFileCapability {readCatalog():Promise<Uint8Array>;withArtifactFile<T>(callback:(heldFdPath:string)=>Promise<T>):Promise<T>;assertCurrent():Promise<void>;dispose():Promise<void>}
const problem=(code='RESOURCE_UNVERIFIED',status=412)=>new AuthFailure(code,status);
const invalid=()=>problem('INPUT_INVALID',400),unknown=()=>problem('RESOURCE_STATE_UNKNOWN',503);
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const decimal=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const identity=(v:unknown)=>exact(v,['device','inode'])&&decimal(v.device)&&decimal(v.inode);
const clone=<T>(v:T):T=>structuredClone(v);
const sameId=(a:{device:string;inode:string},b:{device:string;inode:string})=>a.device===b.device&&a.inode===b.inode;
const noFollow=constants.O_NOFOLLOW??131072,directory=constants.O_DIRECTORY??65536,nonblock=constants.O_NONBLOCK??2048;
const readFlags=constants.O_RDONLY|noFollow|nonblock;
function descriptor(value:unknown):ProtectedFileDescriptor {
 if(!exact(value,['absolutePath','expectedIdentity','expectedSha256','sizeBytes','kind'])||!['CATALOG','ARTIFACT'].includes(value.kind)||!identity(value.expectedIdentity)||typeof value.expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.expectedSha256)||!integer(value.sizeBytes,1,value.kind==='CATALOG'?1048576:16777216))throw invalid();
 const p=value.absolutePath;if(typeof p!=='string'||!p.startsWith('/')||p==='/'||p.includes('\u0000')||Buffer.byteLength(p)>4095)throw invalid();const parts=p.slice(1).split('/');if(parts.length>256||parts.some(x=>!x||x==='.'||x==='..'||Buffer.byteLength(x)>255))throw invalid();
 const result=clone(value as ProtectedFileDescriptor);Object.freeze(result.expectedIdentity);return Object.freeze(result);
}
function runtime(value:unknown):ProtectedFileRuntime {
 if(!exact(value,['platform','arch','node','napi','uid','euid','pid'])||value.platform!=='linux'||value.arch!=='x64'||value.node!=='24.22.1'||typeof value.napi!=='string'||!/^\d{1,3}$/.test(value.napi)||Number(value.napi)<8||!integer(value.uid,1,4294967295)||!integer(value.euid,1,4294967295)||value.uid!==value.euid||!integer(value.pid,1,2147483647))throw problem();return Object.freeze(clone(value as ProtectedFileRuntime));
}
function observation(value:unknown):ProtectedFileObservation {
 if(!exact(value,['identity','kind','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'])||!identity(value.identity)||!['directory','file','symlink','fifo','other'].includes(value.kind)||!integer(value.uid,0,4294967295)||!integer(value.gid,0,4294967295)||!integer(value.mode,0,0o7777)||!integer(value.nlink,1)||!integer(value.size)||typeof value.mtimeNs!=='string'||!/^[-]?[0-9]{1,30}$/.test(value.mtimeNs)||typeof value.ctimeNs!=='string'||!/^[-]?[0-9]{1,30}$/.test(value.ctimeNs))throw problem();return clone(value as ProtectedFileObservation);
}
function protectedNode(v:ProtectedFileObservation,kind:'directory'|'file') {if(v.kind!==kind||v.uid!==0||(v.mode&0o7022)!==0)throw problem();}
function stable(a:ProtectedFileObservation,b:ProtectedFileObservation,file=false){return sameId(a.identity,b.identity)&&a.kind===b.kind&&a.uid===b.uid&&a.gid===b.gid&&a.mode===b.mode&&(!file||a.nlink===b.nlink&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs);}
const nodeObservation=(s:Awaited<ReturnType<FileHandle['stat']>>|any):ProtectedFileObservation=>({identity:{device:s.dev.toString(),inode:s.ino.toString()},kind:s.isDirectory()?'directory':s.isFile()?'file':s.isSymbolicLink()?'symlink':s.isFIFO()?'fifo':'other',uid:Number(s.uid),gid:Number(s.gid),mode:Number(s.mode&0o7777n),nlink:Number(s.nlink),size:Number(s.size),mtimeNs:s.mtimeNs.toString(),ctimeNs:s.ctimeNs.toString()});
// Node/libuv의 FileHandle 수명에서 close-on-exec을 유지한다. openat 지원으로 취급하지 않는다.
const actualIo:ProtectedFileIo={
 async open(path,flags){const handle=await fs.open(path,flags);return{handle,fd:handle.fd};},
 async fstat(handle){return nodeObservation(await(handle as FileHandle).stat({bigint:true}));},
 async lstat(path){return nodeObservation(await fs.lstat(path,{bigint:true}));},
 async statfs(path){const s=await fs.statfs(path,{bigint:true});return{type:s.type};},
 async read(handle,position,maxBytes){const bytes=new Uint8Array(maxBytes),r=await(handle as FileHandle).read(bytes,0,maxBytes,position);return bytes.slice(0,r.bytesRead);},
 readlink:path=>fs.readlink(path),close:handle=>(handle as FileHandle).close()
};
const actualRuntime=():ProtectedFileRuntime=>({platform:process.platform,arch:process.arch,node:process.versions.node,napi:process.versions.napi??'',uid:process.getuid?.()??0,euid:process.geteuid?.()??0,pid:process.pid});
interface Owned {handle:object;fd:number;attempted:boolean;path:string;parent:Owned|null;name:string;baseline:ProtectedFileObservation|null;mountId:string|null}

class ProtectedReader {
 readonly #descriptor:ProtectedFileDescriptor;readonly #io:ProtectedFileIo;readonly #observeRuntime:()=>ProtectedFileRuntime;readonly #runtime:ProtectedFileRuntime;
 readonly #owned=new Set<Owned>();readonly #chain:Owned[]=[];#file:Owned|null=null;#proc:ProtectedFileObservation[]|null=null;
 #poison=false;#closing=false;#closeUnknown=false;#active:Promise<unknown>|null=null;#disposed:Promise<void>|null=null;
 constructor(d:ProtectedFileDescriptor,io:ProtectedFileIo,observeRuntime:()=>ProtectedFileRuntime,r:ProtectedFileRuntime){this.#descriptor=d;this.#io=io;this.#observeRuntime=observeRuntime;this.#runtime=r;}
 #fdPath(e:Owned){if(e.attempted||!this.#owned.has(e))throw problem();return`/proc/self/fd/${e.fd}`;}
 #guard(){if(this.#closing||this.#poison)throw problem();}
 #runtimeCurrent(){const now=runtime(this.#observeRuntime());if(Object.keys(now).some(k=>(now as any)[k] !== (this.#runtime as any)[k]))throw problem();}
 async #open(path:string,flags:number,parent:Owned|null=null,name=''):Promise<Owned>{
  const result=await this.#io.open(path,flags);if(!exact(result,['handle','fd'])||!object(result.handle))throw unknown();
  const entry:Owned={handle:result.handle,fd:result.fd,attempted:false,path,parent,name,baseline:null,mountId:null};
  if([...this.#owned].some(e=>e.handle===entry.handle||e.fd===entry.fd))throw unknown();this.#owned.add(entry);
  if(!integer(entry.fd,0,2147483647)){await this.#close(entry);throw unknown();}return entry;
 }
 async #close(e:Owned){if(e.attempted)return;e.attempted=true;this.#owned.delete(e);try{await this.#io.close(e.handle);}catch{this.#closeUnknown=true;throw unknown();}}
 async #closeAll(){for(const e of [...this.#owned].reverse())try{await this.#close(e);}catch{/* 나머지 자기 FD 회수를 계속하고 실패 상태를 보존한다. */}if(this.#closeUnknown)throw unknown();}
 async #procCurrent(){
  this.#runtimeCurrent();if((await this.#io.statfs('/proc')).type!==0x9fa0n||(await this.#io.statfs('/proc/self/fd')).type!==0x9fa0n||(await this.#io.statfs('/proc/self/fdinfo')).type!==0x9fa0n||await this.#io.readlink('/proc/self')!==String(this.#runtime.pid))throw problem();
  const paths=['/proc','/proc/self/fd','/proc/self/fdinfo'],now:ProtectedFileObservation[]=[];
  for(const [index,path] of paths.entries()){const v=observation(await this.#io.lstat(path));if(v.kind!=='directory'||v.uid!==(index===0?0:this.#runtime.euid)||(v.mode&0o7022)!==0)throw problem();now.push(v);}
  if(this.#proc&&now.some((v,i)=>!stable(v,this.#proc![i]!)))throw problem();if(!this.#proc)this.#proc=now;
 }
 async #bounded(e:Owned,limit:number):Promise<Uint8Array>{
  const parts:Uint8Array[]=[];let length=0;
  while(length<=limit){const requested=Math.min(65536,limit+1-length),data=await this.#io.read(e.handle,length,requested);if(!(data instanceof Uint8Array)||data.length>requested)throw problem();if(!data.length)break;parts.push(Uint8Array.from(data));length+=data.length;if(length>limit)throw problem();}
  const result=new Uint8Array(length);let position=0;for(const p of parts){result.set(p,position);position+=p.length;}return result;
 }
 async #procBytes(path:string,limit:number){
  const e=await this.#open(path,readFlags);try{const s=observation(await this.#io.fstat(e.handle));if(s.kind!=='file'||s.uid!==this.#runtime.euid||(s.mode&0o7022)!==0||(await this.#io.statfs(path)).type!==0x9fa0n)throw problem();return await this.#bounded(e,limit);}finally{await this.#close(e);}
 }
 #text(bytes:Uint8Array){let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw problem();}if(text.includes('\u0000')||text.startsWith('\uFEFF'))throw problem();return text;}
 async #mountId(e:Owned){const text=this.#text(await this.#procBytes(`/proc/self/fdinfo/${e.fd}`,8192)),matches=[...text.matchAll(/^mnt_id:\s*([0-9]+)$/gm)],inos=[...text.matchAll(/^ino:\s*([0-9]+)$/gm)];if(matches.length!==1||inos.length!==1||!decimal(matches[0]![1])||!decimal(inos[0]![1])||inos[0]![1]!==e.baseline!.identity.inode)throw problem();return matches[0]![1]!;}
 async #mount(e:Owned){
  const mountId=await this.#mountId(e);if(e.mountId!==null&&e.mountId!==mountId)throw problem();const text=this.#text(await this.#procBytes('/proc/self/mountinfo',1048576)),ids=new Set<string>();let selected:string[]|null=null;
  for(const line of text.split('\n')){if(!line)continue;const halves=line.split(' - ');if(halves.length!==2)throw problem();const left=halves[0]!.split(' '),right=halves[1]!.split(' ');if(left.length<6||right.length<3||!decimal(left[0])||!decimal(left[1])||!/^\d+:\d+$/.test(left[2]!)||ids.has(left[0]!))throw problem();ids.add(left[0]!);if(left[0]===mountId){if(right[0]!=='ext4')throw problem();selected=left;}}
  if(!selected||await this.#mountId(e)!==mountId||(await this.#io.statfs(this.#fdPath(e))).type!==0xef53n)throw problem();
  const dev=BigInt(e.baseline!.identity.device),major=((dev>>8n)&0xfffn)|((dev>>32n)&0xfffff000n),minor=(dev&0xffn)|((dev>>12n)&0xffffff00n);if(selected[2]!==`${major}:${minor}`)throw problem();e.mountId=mountId;return mountId;
 }
 async #inspect(e:Owned,file:boolean){
  const current=observation(await this.#io.fstat(e.handle));protectedNode(current,file?'file':'directory');if(!e.baseline)e.baseline=current;else if(!stable(current,e.baseline,file))throw problem();
  if(file&&(current.nlink!==1||current.size!==this.#descriptor.sizeBytes||!sameId(current.identity,this.#descriptor.expectedIdentity)))throw problem();
  const namePath=e.parent?`${this.#fdPath(e.parent)}/${e.name}`:'/',named=observation(await this.#io.lstat(namePath));if(!stable(current,named,file))throw problem();const heldMount=await this.#mount(e);
  // 현재 이름을 같은 보호 부모에서 별도 열어 inode뿐 아니라 실제 mount도 대조한다.
  const observed=await this.#open(namePath,file?readFlags:constants.O_RDONLY|directory|noFollow);
  try{const actual=observation(await this.#io.fstat(observed.handle));protectedNode(actual,file?'file':'directory');if(!stable(current,actual,file))throw problem();observed.baseline=actual;if(await this.#mount(observed)!==heldMount)throw problem();}finally{await this.#close(observed);}
 }
 async #metadata(){await this.#procCurrent();for(const e of this.#chain)await this.#inspect(e,e===this.#file);}
 async #fileBytes(){
  const e=this.#file!;const data=await this.#bounded(e,this.#descriptor.sizeBytes);if(data.length!==this.#descriptor.sizeBytes||createHash('sha256').update(data).digest('hex')!==this.#descriptor.expectedSha256)throw problem();return data;
 }
 async #current(){this.#guard();await this.#metadata();const bytes=await this.#fileBytes();await this.#metadata();this.#guard();return bytes;}
 async initialize(){
  try{await this.#procCurrent();let parent:Owned|null=await this.#open('/',constants.O_RDONLY|directory|noFollow);this.#chain.push(parent);await this.#inspect(parent,false);
   const parts=this.#descriptor.absolutePath.slice(1).split('/');for(let i=0;i<parts.length;i++){const name=parts[i]!,file=i===parts.length-1,entry:Owned=await this.#open(`${this.#fdPath(parent)}/${name}`,file?readFlags:constants.O_RDONLY|directory|noFollow,parent,name);this.#chain.push(entry);if(file)this.#file=entry;await this.#inspect(entry,file);parent=entry;}
   await this.#current();
  }catch{this.#poison=true;try{await this.#closeAll();}catch{throw unknown();}throw problem();}
 }
 #run<T>(body:(effect:{started:boolean})=>Promise<T>):Promise<T>{
  try{this.#guard();if(this.#active)throw problem('RESOURCE_PROCESSING',409);}catch(e){return Promise.reject(e);}
  const effect={started:false},task=Promise.resolve().then(async()=>{try{const result=await body(effect);this.#guard();return result;}catch{this.#poison=true;if(effect.started||this.#closeUnknown)throw unknown();throw problem();}});
  this.#active=task;void task.then(()=>{if(this.#active===task)this.#active=null;},()=>{if(this.#active===task)this.#active=null;});return task;
 }
 readCatalog(){if(this.#descriptor.kind!=='CATALOG')return Promise.reject(invalid());return this.#run(async()=>{const bytes=await this.#current();await this.#current();return Uint8Array.from(bytes);});}
 withArtifactFile<T>(callback:(heldFdPath:string)=>Promise<T>):Promise<T>{
  if(this.#descriptor.kind!=='ARTIFACT'||typeof callback!=='function')return Promise.reject(invalid());
  return this.#run(async effect=>{await this.#current();const path=this.#fdPath(this.#file!);effect.started=true;const result=await callback(path);await this.#current();return result;});
 }
 assertCurrent(){return this.#run(async()=>{await this.#current();});}
 dispose():Promise<void>{if(this.#disposed)return this.#disposed;this.#closing=true;const active=this.#active;this.#disposed=(async()=>{if(active)try{await active;}catch{/* 원래 작업 실패는 해당 Promise에 보존한다. */}await this.#closeAll();})();return this.#disposed;}
 capability():ProtectedFileCapability{return Object.freeze({readCatalog:()=>this.readCatalog(),withArtifactFile:<T>(callback:(path:string)=>Promise<T>)=>this.withArtifactFile(callback),assertCurrent:()=>this.assertCurrent(),dispose:()=>this.dispose()});}
}

export async function openProtectedInstallationFile(value:ProtectedFileDescriptor,dependencies:{io?:ProtectedFileIo;runtime?:()=>ProtectedFileRuntime}={}):Promise<ProtectedFileCapability>{
 const d=descriptor(value);if(!object(dependencies)||Object.keys(dependencies).some(k=>!['io','runtime'].includes(k)))throw invalid();
 const io=dependencies.io??actualIo,observe=dependencies.runtime??actualRuntime;if(!object(io)||['open','fstat','lstat','statfs','read','readlink','close'].some(k=>typeof(io as any)[k]!=='function')||typeof observe!=='function')throw invalid();
 let r:ProtectedFileRuntime;try{r=runtime(observe());}catch{throw problem();}const reader=new ProtectedReader(d,io,observe,r);await reader.initialize();return reader.capability();
}

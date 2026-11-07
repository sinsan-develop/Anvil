import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import {AuthFailure} from '../access/repository.ts';
import type {ProtectedFileIo,ProtectedFileObservation} from './installation-resource-protected-files.ts';
import type {ArtifactByteReader,ArtifactByteRef,ArtifactByteHandle} from './artifact-byte-verification.ts';

export interface ArtifactReaderRuntime{platform:string;arch:string;node:string;uid:number;euid:number;pid:number}
interface Binding{absoluteRoot:string;expectedRootIdentity:{device:string;inode:string};ownerUid:number}
export interface ArtifactReadonlyReader extends ArtifactByteReader{dispose():Promise<void>}
const MAX=20*1024*1024,UINT32=4294967295;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const decimal=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const sameId=(a:{device:string;inode:string},b:{device:string;inode:string})=>a.device===b.device&&a.inode===b.inode;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
// getter를 거쳐 재조회하지 않고 검증한 동일 own-data snapshot을 보관한다.
function record(v:unknown,keys:readonly string[]):Record<string,any>{
 if(!plain(v))throw Error();const d=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(d);
 if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw Error();
 const out:Record<string,any>={};for(const key of keys){const p=d[key];if(!p||!Object.hasOwn(p,'value')||!p.enumerable)throw Error();out[key]=p.value;}return out;
}
function id(v:unknown){const o=record(v,['device','inode']);if(!decimal(o.device)||!decimal(o.inode))throw Error();return Object.freeze({device:o.device,inode:o.inode});}
const error=(code:string,status:number)=>new AuthFailure(code,status);
function binding(value:unknown):Binding{
 try{const v=record(value,['absoluteRoot','expectedRootIdentity','ownerUid']);if(typeof v.absoluteRoot!=='string'||v.absoluteRoot==='/'||!v.absoluteRoot.startsWith('/')||v.absoluteRoot.includes('\0')||Buffer.byteLength(v.absoluteRoot)>4095||!integer(v.ownerUid,1,UINT32))throw Error();const parts=v.absoluteRoot.slice(1).split('/');if(parts.length>256||parts.some((p:string)=>!p||p==='.'||p==='..'||Buffer.byteLength(p)>255))throw Error();return Object.freeze({absoluteRoot:v.absoluteRoot,expectedRootIdentity:id(v.expectedRootIdentity),ownerUid:v.ownerUid});}catch{throw error('INPUT_INVALID',400);}
}
function ref(value:unknown):Readonly<ArtifactByteRef>{
 try{const v=record(value,['projectId','artifactId','bytes','contentHash']);if(!uuid(v.projectId)||!uuid(v.artifactId)||!integer(v.bytes,0,MAX)||typeof v.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(v.contentHash))throw Error();return Object.freeze({projectId:v.projectId,artifactId:v.artifactId,bytes:v.bytes,contentHash:v.contentHash});}catch{throw error('INPUT_INVALID',400);}
}
function runtime(value:unknown,ownerUid:number):Readonly<ArtifactReaderRuntime>{
 const v=record(value,['platform','arch','node','uid','euid','pid']);const version=typeof v.node==='string'?/^24\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(v.node):null;
 if(v.platform!=='linux'||v.arch!=='x64'||!version||!Number.isSafeInteger(Number(version[1]))||Number(version[1])<18||!Number.isSafeInteger(Number(version[2]))||v.uid!==ownerUid||v.euid!==ownerUid||!integer(v.pid,1,2147483647))throw Error();return Object.freeze(v as unknown as ArtifactReaderRuntime);
}
function observation(value:unknown):ProtectedFileObservation{
 const v=record(value,['identity','kind','uid','gid','mode','nlink','size','mtimeNs','ctimeNs']),identity=id(v.identity);
 if(!['directory','file','symlink','fifo','other'].includes(v.kind)||!integer(v.uid,0,UINT32)||!integer(v.gid,0,UINT32)||!integer(v.mode,0,0o7777)||!integer(v.nlink,1)||!integer(v.size)||typeof v.mtimeNs!=='string'||!/^[-]?[0-9]{1,30}$/.test(v.mtimeNs)||typeof v.ctimeNs!=='string'||!/^[-]?[0-9]{1,30}$/.test(v.ctimeNs))throw Error();return{...v,identity}as ProtectedFileObservation;
}
const stable=(a:ProtectedFileObservation,b:ProtectedFileObservation,file=false)=>sameId(a.identity,b.identity)&&a.kind===b.kind&&a.uid===b.uid&&a.gid===b.gid&&a.mode===b.mode&&(!file||a.nlink===b.nlink&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs);
const nodeStat=(s:any):ProtectedFileObservation=>({identity:{device:s.dev.toString(),inode:s.ino.toString()},kind:s.isDirectory()?'directory':s.isFile()?'file':s.isSymbolicLink()?'symlink':s.isFIFO()?'fifo':'other',uid:Number(s.uid),gid:Number(s.gid),mode:Number(s.mode&0o7777n),nlink:Number(s.nlink),size:Number(s.size),mtimeNs:s.mtimeNs.toString(),ctimeNs:s.ctimeNs.toString()});
// Linux 전용 플래그. Node의 미지원 호스트에서는 factory가 IO 전에 거절한다.
const readFlags=constants.O_RDONLY|(constants.O_NOFOLLOW??131072)|(constants.O_NONBLOCK??2048),dirFlags=readFlags|(constants.O_DIRECTORY??65536);
const actualIo:ProtectedFileIo={
 async open(path,flags){const handle=await fs.open(path,flags);return{handle,fd:handle.fd};},
 async fstat(handle){return nodeStat(await(handle as FileHandle).stat({bigint:true}));},
 async lstat(path){return nodeStat(await fs.lstat(path,{bigint:true}));},
 async statfs(path){return{type:(await fs.statfs(path,{bigint:true})).type};},
 async read(handle,position,maxBytes){const bytes=new Uint8Array(maxBytes);const r=await(handle as FileHandle).read(bytes,0,maxBytes,position);return bytes.slice(0,r.bytesRead);},
 readlink:path=>fs.readlink(path),close:handle=>(handle as FileHandle).close()
};
const actualRuntime=():ArtifactReaderRuntime=>({platform:process.platform,arch:process.arch,node:process.versions.node,uid:process.getuid?.()??0,euid:process.geteuid?.()??0,pid:process.pid});
interface Owned{handle:object;fd:number;attempted:boolean;parent:Owned|null;name:string;path:string;baseline:ProtectedFileObservation|null;mountId:string|null;strict:boolean;file:boolean}

class Session{
 readonly #binding:Binding;readonly #ref:Readonly<ArtifactByteRef>;readonly #io:ProtectedFileIo;readonly #runtime:Readonly<ArtifactReaderRuntime>;readonly #observe:()=>ArtifactReaderRuntime;readonly #originalSignal?:AbortSignal;
 readonly #poisonReader:()=>void;readonly #released:()=>void;readonly #known=new WeakSet<AuthFailure>();readonly #owned=new Set<Owned>();readonly #chain:Owned[]=[];
 #file:Owned|null=null;#root:Owned|null=null;#proc:ProtectedFileObservation[]|null=null;#offset=0;#poison=false;#closing=false;#closeUnknown=false;#active:Promise<unknown>|null=null;#ending:Promise<void>|null=null;
 constructor(b:Binding,r:Readonly<ArtifactByteRef>,io:ProtectedFileIo,rt:Readonly<ArtifactReaderRuntime>,observe:()=>ArtifactReaderRuntime,signal:AbortSignal|undefined,poison:()=>void,released:()=>void){this.#binding=b;this.#ref=r;this.#io=io;this.#runtime=rt;this.#observe=observe;this.#originalSignal=signal;this.#poisonReader=poison;this.#released=released;}
 #fail(code='ARTIFACT_READER_UNVERIFIED',status=412):never{const e=error(code,status);this.#known.add(e);throw e;}
 #normalize(e:unknown){return e instanceof AuthFailure&&this.#known.has(e)?e:error('ARTIFACT_READER_IO_FAILED',503);}
 #stop(signal?:AbortSignal){if(this.#closing)this.#fail('ARTIFACT_READER_CLOSED',409);if(this.#poison)this.#fail();if(this.#originalSignal?.aborted||signal?.aborted)this.#fail('ARTIFACT_READER_CANCELLED',409);}
 async #call<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch{this.#fail('ARTIFACT_READER_IO_FAILED',503);}}
 #observed(value:unknown){try{return observation(value);}catch{this.#fail();}}
 #runtimeCurrent(){try{const now=runtime(this.#observe(),this.#binding.ownerUid);if(Object.keys(now).some(k=>(now as any)[k] !==(this.#runtime as any)[k]))throw Error();}catch{this.#fail();}}
 #fdPath(e:Owned){if(e.attempted||!this.#owned.has(e))this.#fail();return`/proc/self/fd/${e.fd}`;}
 async #open(path:string,flags:number,parent:Owned|null=null,name='',strict=false,file=false):Promise<Owned>{
  const result=await this.#call(()=>this.#io.open(path,flags));let v:Record<string,any>;try{v=record(result,['handle','fd']);}catch{this.#fail('ARTIFACT_READER_IO_FAILED',503);}
  if(!v!.handle||typeof v!.handle!=='object'||[...this.#owned].some(e=>e.handle===v!.handle||e.fd===v!.fd))this.#fail('ARTIFACT_READER_IO_FAILED',503);
  const e:Owned={handle:v!.handle,fd:v!.fd,attempted:false,parent,name,path,baseline:null,mountId:null,strict,file};this.#owned.add(e);
  if(!integer(e.fd,0,2147483647))this.#fail('ARTIFACT_READER_IO_FAILED',503);return e;
 }
 async #close(e:Owned){if(e.attempted)return;e.attempted=true;this.#owned.delete(e);try{await this.#io.close(e.handle);}catch{this.#closeUnknown=true;this.#poisonReader();this.#fail('ARTIFACT_READER_CLEANUP_FAILED',503);}}
 async #closeAll(){for(const e of [...this.#owned].reverse())try{await this.#close(e);}catch{/* 다른 자기 FD 회수는 계속한다. */}if(this.#closeUnknown)this.#fail('ARTIFACT_READER_CLEANUP_FAILED',503);}
 async #procCurrent(){
  this.#runtimeCurrent();for(const p of ['/proc','/proc/self/fd','/proc/self/fdinfo'])if((await this.#call(()=>this.#io.statfs(p))).type!==0x9fa0n)this.#fail();if(await this.#call(()=>this.#io.readlink('/proc/self'))!==String(this.#runtime.pid))this.#fail();
  const next:ProtectedFileObservation[]=[];for(const[index,p]of ['/proc','/proc/self/fd','/proc/self/fdinfo'].entries()){const v=this.#observed(await this.#call(()=>this.#io.lstat(p)));if(v.kind!=='directory'||v.uid!==(index===0?0:this.#runtime.uid)||(v.mode&0o7022)!==0)this.#fail();next.push(v);}
  if(this.#proc&&next.some((v,i)=>!stable(v,this.#proc![i]!)))this.#fail();if(!this.#proc)this.#proc=next;
 }
 async #bounded(e:Owned,limit:number){const chunks:Uint8Array[]=[];let size=0;
  for(;;){const max=Math.min(65536,limit-size+1),b=await this.#call(()=>this.#io.read(e.handle,size,max));if(!(b instanceof Uint8Array)||b.length>max)this.#fail();if(!b.length)break;if(b.length>limit-size)this.#fail();chunks.push(Uint8Array.from(b));size+=b.length;}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;
 }
 async #procBytes(path:string,limit:number){const e=await this.#open(path,readFlags);try{const o=this.#observed(await this.#call(()=>this.#io.fstat(e.handle)));if(o.kind!=='file'||o.uid!==this.#runtime.uid||(o.mode&0o7022)!==0||(await this.#call(()=>this.#io.statfs(this.#fdPath(e)))).type!==0x9fa0n)this.#fail();return await this.#bounded(e,limit);}finally{await this.#close(e);}}
 #text(b:Uint8Array){try{const s=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);if(s.includes('\0')||s.startsWith('\uFEFF'))throw Error();return s;}catch{this.#fail();}}
 async #mountId(e:Owned){const text=this.#text(await this.#procBytes(`/proc/self/fdinfo/${e.fd}`,8192)),m=[...text.matchAll(/^mnt_id:\s*([0-9]+)$/gm)],i=[...text.matchAll(/^ino:\s*([0-9]+)$/gm)];if(m.length!==1||i.length!==1||!decimal(m[0]![1])||!decimal(i[0]![1])||i[0]![1]!==e.baseline!.identity.inode)this.#fail();return m[0]![1]!;}
 async #mount(e:Owned){
  const mountId=await this.#mountId(e);if(e.mountId!==null&&e.mountId!==mountId)this.#fail();const text=this.#text(await this.#procBytes('/proc/self/mountinfo',1048576)),ids=new Set<string>();let found:string[]|null=null;
  for(const line of text.split('\n')){if(!line)continue;const halves=line.split(' - ');if(halves.length!==2)this.#fail();const left=halves[0]!.split(' '),right=halves[1]!.split(' ');if(left.length<6||right.length<3||!decimal(left[0])||!decimal(left[1])||!/^\d+:\d+$/.test(left[2]!)||ids.has(left[0]!))this.#fail();ids.add(left[0]!);if(left[0]===mountId){if(right[0]!=='ext4')this.#fail();found=left;}}
  if(!found||await this.#mountId(e)!==mountId||(await this.#call(()=>this.#io.statfs(this.#fdPath(e)))).type!==0xef53n)this.#fail();
  const dev=BigInt(e.baseline!.identity.device),major=((dev>>8n)&0xfffn)|((dev>>32n)&0xfffff000n),minor=(dev&0xffn)|((dev>>12n)&0xffffff00n);if(found[2]!==`${major}:${minor}`)this.#fail();e.mountId=mountId;return mountId;
 }
 #node(o:ProtectedFileObservation,e:Owned){
  if(e.file){if(o.kind!=='file'||o.uid!==this.#binding.ownerUid||o.mode!==0o600||o.nlink!==1||o.size!==this.#ref.bytes||o.size>MAX)this.#fail();}
  else if(o.kind!=='directory'||(e.strict?o.uid!==this.#binding.ownerUid||o.mode!==0o700:![0,this.#binding.ownerUid].includes(o.uid)||(o.mode&0o7022)!==0))this.#fail();
 }
 async #inspect(e:Owned){
  const now=this.#observed(await this.#call(()=>this.#io.fstat(e.handle)));this.#node(now,e);if(!e.baseline)e.baseline=now;else if(!stable(now,e.baseline,e.file))this.#fail();if(e===this.#root&&!sameId(now.identity,this.#binding.expectedRootIdentity))this.#fail();
  const namePath=e.parent?`${this.#fdPath(e.parent)}/${e.name}`:'/',named=this.#observed(await this.#call(()=>this.#io.lstat(namePath)));if(!stable(now,named,e.file))this.#fail();const mount=await this.#mount(e);
  if(this.#root&&e.strict&&e!==this.#root&&(!this.#root.baseline||now.identity.device!==this.#root.baseline.identity.device||mount!==this.#root.mountId))this.#fail();
  const observed=await this.#open(namePath,e.file?readFlags:dirFlags);try{const actual=this.#observed(await this.#call(()=>this.#io.fstat(observed.handle)));this.#node(actual,e);if(!stable(now,actual,e.file))this.#fail();observed.baseline=actual;if(await this.#mount(observed)!==mount)this.#fail();}finally{await this.#close(observed);}
 }
 async #current(signal?:AbortSignal){this.#stop(signal);await this.#procCurrent();for(const e of this.#chain){this.#stop(signal);await this.#inspect(e);}await this.#procCurrent();this.#stop(signal);}
 #mark(e:AuthFailure){if(e.statusCode===412||e.statusCode===503){this.#poison=true;this.#poisonReader();}}
 initialize():Promise<ArtifactByteHandle>{
  const task=Promise.resolve().then(async()=>{try{this.#stop();await this.#procCurrent();let parent=await this.#open('/',dirFlags);this.#chain.push(parent);await this.#inspect(parent);
   const rootParts=this.#binding.absoluteRoot.slice(1).split('/'),parts=[...rootParts,'blobs',this.#ref.projectId,this.#ref.artifactId];
   for(let index=0;index<parts.length;index++){this.#stop();const name=parts[index]!,file=index===parts.length-1,strict=index>=rootParts.length-1,entry=await this.#open(`${this.#fdPath(parent)}/${name}`,file?readFlags:dirFlags,parent,name,strict,file);this.#chain.push(entry);if(index===rootParts.length-1)this.#root=entry;if(file)this.#file=entry;await this.#inspect(entry);parent=entry;}
   await this.#current();return this.capability();
  }catch(caught){const e=this.#normalize(caught);this.#mark(e);try{await this.#closeAll();}catch{throw error('ARTIFACT_READER_CLEANUP_FAILED',503);}throw e;}});
  this.#active=task;void task.then(()=>{if(this.#active===task)this.#active=null;},()=>{if(this.#active===task)this.#active=null;});return task;
 }
 read(maxBytes:number,signal?:AbortSignal):Promise<Uint8Array>{
  try{this.#stop(signal);if(!integer(maxBytes,1,65536))throw error('INPUT_INVALID',400);if(this.#active)this.#fail('ARTIFACT_READER_BUSY',409);}catch(e){return Promise.reject(e);}
  const task=Promise.resolve().then(async()=>{try{await this.#current(signal);const requested=Math.min(maxBytes,this.#ref.bytes-this.#offset+1);if(requested<1)this.#fail();const bytes=await this.#call(()=>this.#io.read(this.#file!.handle,this.#offset,requested));this.#stop(signal);if(!(bytes instanceof Uint8Array)||bytes.length>requested)this.#fail('ARTIFACT_READER_IO_FAILED',503);const result=Uint8Array.from(bytes);await this.#current(signal);this.#offset+=result.length;return result;}catch(caught){const e=this.#normalize(caught);this.#mark(e);throw e;}});
  this.#active=task;void task.then(()=>{if(this.#active===task)this.#active=null;},()=>{if(this.#active===task)this.#active=null;});return task;
 }
 close():Promise<void>{if(this.#ending)return this.#ending;this.#closing=true;const active=this.#active;this.#ending=(async()=>{if(active)try{await active;}catch{/* 진행 결과는 원래 호출에 남긴다. */}try{await this.#closeAll();}finally{this.#released();}})();return this.#ending;}
 capability():ArtifactByteHandle{return Object.freeze({read:(n:number,s?:AbortSignal)=>this.read(n,s),close:()=>this.close()});}
}

class Reader implements ArtifactReadonlyReader{
 readonly #binding:Binding;readonly #io:ProtectedFileIo;readonly #runtime:Readonly<ArtifactReaderRuntime>;readonly #observe:()=>ArtifactReaderRuntime;
 #session:Session|null=null;#closing=false;#poison=false;#ending:Promise<void>|null=null;
 constructor(b:Binding,io:ProtectedFileIo,r:Readonly<ArtifactReaderRuntime>,observe:()=>ArtifactReaderRuntime){this.#binding=b;this.#io=io;this.#runtime=r;this.#observe=observe;}
 open(value:Readonly<ArtifactByteRef>,signal?:AbortSignal):Promise<ArtifactByteHandle>{
  let r:Readonly<ArtifactByteRef>;try{if(this.#closing)throw error('ARTIFACT_READER_CLOSED',409);if(this.#poison)throw error('ARTIFACT_READER_UNVERIFIED',412);r=ref(value);if(signal?.aborted)throw error('ARTIFACT_READER_CANCELLED',409);if(this.#session)throw error('ARTIFACT_READER_BUSY',409);}catch(e){return Promise.reject(e);}
  const session=new Session(this.#binding,r,this.#io,this.#runtime,this.#observe,signal,()=>{this.#poison=true;},()=>{if(this.#session===session)this.#session=null;});this.#session=session;
  return session.initialize().catch(e=>{if(this.#session===session)this.#session=null;throw e;});
 }
 dispose():Promise<void>{if(this.#ending)return this.#ending;this.#closing=true;const session=this.#session;this.#ending=session?session.close():Promise.resolve();return this.#ending;}
}

/** 내부 주입만 제공한다. 실제 원문 root 설정·인증·DB 귀속·백업 실행에 자동 연결하지 않는다. */
export function createArtifactReadonlyReader(value:unknown,dependencies:{io?:ProtectedFileIo;runtime?:()=>ArtifactReaderRuntime}={}):ArtifactReadonlyReader{
 const b=binding(value);let io:ProtectedFileIo,observe:()=>ArtifactReaderRuntime;
 try{if(!plain(dependencies))throw Error();const names=Reflect.ownKeys(dependencies);if(names.some(k=>k!=='io'&&k!=='runtime'))throw Error();const d=Object.getOwnPropertyDescriptors(dependencies);if(Object.values(d).some(p=>!Object.hasOwn(p,'value')))throw Error();io=d.io?.value??actualIo;observe=d.runtime?.value??actualRuntime;if(!io||typeof io!=='object'||typeof observe!=='function')throw Error();const functions=['open','fstat','lstat','statfs','read','readlink','close']as const;const port:any={};for(const key of functions){const fn=io[key];if(typeof fn!=='function')throw Error();port[key]=fn.bind(io);}io=Object.freeze(port);}catch{throw error('INPUT_INVALID',400);}
 let r:Readonly<ArtifactReaderRuntime>;try{r=runtime(observe!(),b.ownerUid);}catch{throw error('ARTIFACT_READER_UNSUPPORTED',412);}const reader=new Reader(b,io!,r,observe!);return Object.freeze({open:(v:Readonly<ArtifactByteRef>,s?:AbortSignal)=>reader.open(v,s),dispose:()=>reader.dispose()});
}
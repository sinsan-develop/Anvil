import {createHash} from 'node:crypto';
import {constants,closeSync,fstatSync,lstatSync,openSync,readSync,realpathSync,type Stats} from 'node:fs';
import {types} from 'node:util';
import {contentHash} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeLinuxApprovalContract,type NegativeLinuxApprovalSelection} from './qa-ix01-0076-negative-linux-approval.ts';

const receiptParent='/home/daon/.local/share/anvil-v3-qa-receipts';
const nodePath='/opt/node-v24.22.1-linux-x64/bin/node';
const nodeHash='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
const nodeBytes=126879696;
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_HOST_INVALID');};
const retainedNativeHandles=new Map<object,number>();

export interface NegativeLinuxHostStat{
 readonly kind:'FILE'|'DIRECTORY';readonly dev:number;readonly ino:number;readonly uid:number;readonly gid:number;readonly mode:number;
 readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number;
}
export interface NegativeLinuxHostFileObservation extends NegativeLinuxHostStat{
 readonly path:string;readonly realpath:string;readonly sha256:string;readonly text:string|null;readonly closed:true;
}
export interface NegativeLinuxHostSystem{
 readonly recipient:object;
 platform(this:object):string;euid(this:object):number;cwd(this:object):string;execPath(this:object):string;execArgv(this:object):readonly string[];
 lstat(this:object,path:string):Readonly<NegativeLinuxHostStat>;realpath(this:object,path:string):string;
 inspectFile(this:object,path:string,maxBytes:number,captureText:boolean):Readonly<NegativeLinuxHostFileObservation>;
}
export interface NegativeLinuxHostProjection{
 readonly schemaVersion:1;readonly purpose:'IX01_0076_NEGATIVE_LINUX_HOST_SOURCE_VERIFIED';readonly attemptId:string;readonly sourceHead:string;
 readonly sourceRoot:string;readonly nodePath:typeof nodePath;readonly nodeHash:typeof nodeHash;
 readonly evidence:'NODE_AND_DETACHED_HEAD_SOURCE_ONLY';readonly gitToolVerified:false;readonly runtimeVerified:false;readonly executionAuthorized:false;
}

type Stat=Readonly<NegativeLinuxHostStat>;
type Pin=Readonly<{path:string;dev:number;ino:number;uid:number;gid:number;mode:number}>;

function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function statShape(raw:Readonly<NegativeLinuxHostStat>):Stat{
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!Object.isFrozen(raw)||!['FILE','DIRECTORY'].includes(raw.kind)
  ||![raw.dev,raw.ino,raw.uid,raw.gid,raw.mode,raw.nlink,raw.size].every(safeInteger)||![raw.mtimeMs,raw.ctimeMs].every(value=>typeof value==='number'&&Number.isFinite(value)))invalid();
 return raw;
}
function same(left:Stat,right:Stat){return left.kind===right.kind&&left.dev===right.dev&&left.ino===right.ino&&left.uid===right.uid&&left.gid===right.gid
 &&left.mode===right.mode&&left.nlink===right.nlink&&left.size===right.size&&left.mtimeMs===right.mtimeMs&&left.ctimeMs===right.ctimeMs;}
function samePin(left:Pin,right:Stat){return right.kind==='DIRECTORY'&&left.dev===right.dev&&left.ino===right.ino&&left.uid===right.uid&&left.gid===right.gid&&left.mode===right.mode;}
function normalized(raw:Stats):Stat{
 const kind=raw.isFile()?'FILE':raw.isDirectory()?'DIRECTORY':invalid();
 return Object.freeze({kind,dev:raw.dev,ino:raw.ino,uid:raw.uid,gid:raw.gid,mode:raw.mode,nlink:raw.nlink,size:raw.size,mtimeMs:raw.mtimeMs,ctimeMs:raw.ctimeMs});
}
function parentPaths(path:string){let cursor='';const rows:string[]=[];for(const segment of path.split('/').filter(Boolean)){cursor+='/'+segment;rows.push(cursor);}return rows;}
function nativeSystem():NegativeLinuxHostSystem{
 const recipient=Object.freeze(Object.create(null));
 const inspectFile=(path:string,maxBytes:number,captureText:boolean)=>{
  const before=normalized(lstatSync(path));if(before.kind!=='FILE'||before.size<1||before.size>maxBytes||realpathSync.native(path)!==path)invalid();
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK),handle=Object.freeze(Object.create(null));retainedNativeHandles.set(handle,fd);
  let closeStarted=false;const digest=createHash('sha256'),captured:number[]=[],buffer=new Uint8Array(Math.min(1048576,before.size+1));
  try{if(!same(before,normalized(fstatSync(fd))))invalid();let total=0;
   while(total<=before.size){const count=readSync(fd,buffer,0,Math.min(buffer.byteLength,before.size+1-total),null);if(count===0)break;total+=count;if(total>before.size)invalid();digest.update(buffer.subarray(0,count));if(captureText)captured.push(...buffer.subarray(0,count));}
   const after=normalized(fstatSync(fd)),found=normalized(lstatSync(path));if(total!==before.size||!same(before,after)||!same(before,found)||realpathSync.native(path)!==path)invalid();
   closeStarted=true;closeSync(fd);retainedNativeHandles.delete(handle);let text:string|null=null;if(captureText)try{text=new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(captured));}catch{invalid();}
   return Object.freeze({...before,path,realpath:path,sha256:digest.digest('hex'),text,closed:true as const});
  }finally{buffer.fill(0);if(!closeStarted)try{closeStarted=true;closeSync(fd);retainedNativeHandles.delete(handle);}catch{/* close 불명 FD와 handle은 process-private Map에 보존한다. */}}
 };
 return Object.freeze({recipient,
  platform(this:object){if(this!==recipient)invalid();return process.platform;},euid(this:object){if(this!==recipient)return invalid();const geteuid=process.geteuid?.bind(process);if(!geteuid)return invalid();return geteuid();},
  cwd(this:object){if(this!==recipient)invalid();return process.cwd();},execPath(this:object){if(this!==recipient)invalid();return process.execPath;},execArgv(this:object){if(this!==recipient)invalid();return Object.freeze([...process.execArgv]);},
  lstat(this:object,path:string){if(this!==recipient)invalid();return normalized(lstatSync(path));},realpath(this:object,path:string){if(this!==recipient)invalid();return realpathSync.native(path);},
  inspectFile(this:object,path:string,maxBytes:number,captureText:boolean){if(this!==recipient)invalid();return inspectFile(path,maxBytes,captureText);},
 });
}
function selectionShape(raw:Readonly<NegativeLinuxApprovalSelection>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','graphHash'])||!Object.isFrozen(raw)||raw.schemaVersion!==1
  ||raw.purpose!==current0076NegativeLinuxApprovalContract.selectionPurpose||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.approvalHash,raw.graphHash].every(hashV1))invalid();return raw;
}
function systemShape(raw:NegativeLinuxHostSystem){
 const keys=['recipient','platform','euid','cwd','execPath','execArgv','lstat','realpath','inspectFile'] as const;
 if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();for(const key of keys.slice(1))if(typeof descriptors[key]!.value!=='function')invalid();
 return{keys,recipient,platform:descriptors.platform!.value as NegativeLinuxHostSystem['platform'],euid:descriptors.euid!.value as NegativeLinuxHostSystem['euid'],cwd:descriptors.cwd!.value as NegativeLinuxHostSystem['cwd'],
  execPath:descriptors.execPath!.value as NegativeLinuxHostSystem['execPath'],execArgv:descriptors.execArgv!.value as NegativeLinuxHostSystem['execArgv'],lstat:descriptors.lstat!.value as NegativeLinuxHostSystem['lstat'],realpath:descriptors.realpath!.value as NegativeLinuxHostSystem['realpath'],
  inspectFile:descriptors.inspectFile!.value as NegativeLinuxHostSystem['inspectFile']};
}
function ownEmptyArray(raw:readonly string[]){if(types.isProxy(raw)||!Array.isArray(raw)||!Object.isFrozen(raw)||raw.length!==0||Reflect.ownKeys(Object.getOwnPropertyDescriptors(raw)).length!==1)invalid();}
function sourceRootFor(attemptId:string){return'/home/daon/anvil-ix01-0076-negative-'+attemptId.replaceAll('-','')+'-qa';}

/** Node와 detached HEAD만 source-only로 검산한다. 미실측 Git binary나 전체 checkout clean 권위를 만들지 않는다. */
export function verify0076NegativeLinuxHostSource(rawSelection:Readonly<NegativeLinuxApprovalSelection>,rawSystem:NegativeLinuxHostSystem):Readonly<NegativeLinuxHostProjection>{
 const selection=selectionShape(rawSelection),system=systemShape(rawSystem),sourceRoot=sourceRootFor(selection.attemptId),pins=new Map<string,Pin>();
 let nodePin:Stat|undefined,headPin:Stat|undefined;
 const unchanged=()=>system.keys.every(key=>rawSystem[key]===({recipient:system.recipient,platform:system.platform,euid:system.euid,cwd:system.cwd,execPath:system.execPath,execArgv:system.execArgv,
  lstat:system.lstat,realpath:system.realpath,inspectFile:system.inspectFile} as const)[key]);
 const stat=(path:string)=>statShape(system.lstat.call(system.recipient,path));
 const pin=(path:string,privateLeaf=false)=>{for(const cursor of parentPaths(path)){const found=stat(cursor);
  if(found.kind!=='DIRECTORY'||![0,1000].includes(found.uid)||(found.mode&0o022)!==0||cursor===path&&privateLeaf&&(found.uid!==1000||(found.mode&0o777)!==0o700))invalid();
  const prior=pins.get(cursor);if(prior&&!samePin(prior,found))invalid();pins.set(cursor,Object.freeze({path:cursor,dev:found.dev,ino:found.ino,uid:found.uid,gid:found.gid,mode:found.mode}));}
  if(system.realpath.call(system.recipient,path)!==path)invalid();};
 const current=()=>{if(!unchanged()||system.platform.call(system.recipient)!=='linux'||system.euid.call(system.recipient)!==1000||system.cwd.call(system.recipient)!==sourceRoot
  ||system.execPath.call(system.recipient)!==nodePath)invalid();ownEmptyArray(system.execArgv.call(system.recipient));for(const prior of pins.values())if(!samePin(prior,stat(prior.path)))invalid();
  if(nodePin&&(!same(nodePin,stat(nodePath))||system.realpath.call(system.recipient,nodePath)!==nodePath))invalid();
  if(headPin&&(!same(headPin,stat(sourceRoot+'/.git/HEAD'))||system.realpath.call(system.recipient,sourceRoot+'/.git/HEAD')!==sourceRoot+'/.git/HEAD'))invalid();};
 current();pin(sourceRoot,true);pin(sourceRoot+'/.git');pin(nodePath.slice(0,nodePath.lastIndexOf('/')));pin(receiptParent);current();
 const node=system.inspectFile.call(system.recipient,nodePath,160*1024*1024,false),head=system.inspectFile.call(system.recipient,sourceRoot+'/.git/HEAD',64,true);
 if(!Object.isFrozen(node)||types.isProxy(node)||node.path!==nodePath||node.realpath!==nodePath||node.kind!=='FILE'||node.uid!==0||node.gid!==0||(node.mode&0o777)!==0o755||node.nlink!==1
  ||node.size!==nodeBytes||node.sha256!==nodeHash||node.text!==null||node.closed!==true)invalid();
 if(!Object.isFrozen(head)||types.isProxy(head)||head.path!==sourceRoot+'/.git/HEAD'||head.realpath!==head.path||head.kind!=='FILE'||head.uid!==1000||(head.mode&0o777)!==0o644||head.nlink!==1
  ||head.size!==41||head.text!==selection.sourceHead+'\n'||head.sha256!==contentHash(head.text)||head.closed!==true)invalid();nodePin=statShape(node);headPin=statShape(head);current();
 const projection=Object.freeze({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_HOST_SOURCE_VERIFIED',attemptId:selection.attemptId,sourceHead:selection.sourceHead,sourceRoot,nodePath,nodeHash,
  evidence:'NODE_AND_DETACHED_HEAD_SOURCE_ONLY',gitToolVerified:false,runtimeVerified:false,executionAuthorized:false}) satisfies NegativeLinuxHostProjection;
 return projection;
}

/** 명시 호출에서만 실제 read-only Node/HEAD 관측을 수행한다. authority, claim, stage 또는 실행 권위를 반환하지 않는다. */
export function read0076NegativeLinuxHostSource(rawSelection:Readonly<NegativeLinuxApprovalSelection>):Readonly<NegativeLinuxHostProjection>{
 return verify0076NegativeLinuxHostSource(rawSelection,nativeSystem());
}

import {constants,closeSync,fstatSync,lstatSync,openSync,readSync,realpathSync,type Stats} from 'node:fs';
import {types} from 'node:util';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeLinuxApprovalContract,type NegativeLinuxApprovalReadObservation,type NegativeLinuxApprovalReadPorts,type NegativeLinuxApprovalSelection} from './qa-ix01-0076-negative-linux-approval.ts';

const receiptParent='/home/daon/.local/share/anvil-v3-qa-receipts';
const sourceRootPattern=/^\/home\/daon\/[A-Za-z0-9._-]{1,100}$/;
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_PROTECTED_READ_INVALID');};
// CloseHandle 결과가 불명인 원 FD wrapper는 process 수명 동안 강하게 보유한다. 재close·조회·성공 추정은 하지 않는다.
const retainedNativeHandles=new Set<object>();

export interface NegativeLinuxProtectedReaderStat{
 readonly kind:'FILE'|'DIRECTORY';readonly dev:number;readonly ino:number;readonly uid:number;readonly mode:number;
 readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number;
}
export interface NegativeLinuxProtectedReaderSystem{
 readonly recipient:object;
 lstat(this:object,path:string):Readonly<NegativeLinuxProtectedReaderStat>;
 realpath(this:object,path:string):string;
 open(this:object,path:string,flags:number):object;
 fstat(this:object,handle:object):Readonly<NegativeLinuxProtectedReaderStat>;
 read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number):number;
 close(this:object,handle:object):void;
}
export interface NegativeLinuxProtectedReaderAuthority{
 readonly recipient:object;readonly selection:Readonly<NegativeLinuxApprovalSelection>;
 readonly sourceRoot:string;readonly receiptRoot:string;readonly uid:1000;
 now(this:object):number;monotonic(this:object):number;
 assertCurrent(this:object,selection:Readonly<NegativeLinuxApprovalSelection>):void;
}

type FileFact=Readonly<NegativeLinuxProtectedReaderStat>;
type DirectoryPin=Readonly<{path:string;dev:number;ino:number;uid:number;mode:number}>;

function normalized(stat:Stats):FileFact{
 const kind=stat.isFile()?'FILE':stat.isDirectory()?'DIRECTORY':invalid();
 return Object.freeze({kind,dev:stat.dev,ino:stat.ino,uid:stat.uid,mode:stat.mode,nlink:stat.nlink,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs});
}
function nativeSystem():NegativeLinuxProtectedReaderSystem{
 const recipient=Object.freeze(Object.create(null)),handles=new WeakMap<object,number>();
 const fdFor=(handle:object)=>{const fd=handles.get(handle);return fd===undefined?invalid():fd;};
 return Object.freeze({recipient,
  lstat(this:object,path:string){if(this!==recipient)invalid();return normalized(lstatSync(path));},
  realpath(this:object,path:string){if(this!==recipient)invalid();return realpathSync(path);},
  open(this:object,path:string,flags:number){if(this!==recipient)invalid();const handle=Object.freeze(Object.create(null));handles.set(handle,openSync(path,flags));retainedNativeHandles.add(handle);return handle;},
  fstat(this:object,handle:object){if(this!==recipient)invalid();return normalized(fstatSync(fdFor(handle)));},
  read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number){if(this!==recipient)invalid();return readSync(fdFor(handle),buffer,offset,length,null);},
  close(this:object,handle:object){if(this!==recipient)invalid();closeSync(fdFor(handle));handles.delete(handle);retainedNativeHandles.delete(handle);},
 });
}
function ownDataArray(raw:unknown,expected:readonly string[]):readonly string[]{
 if(types.isProxy(raw)||!Array.isArray(raw)||!Object.isFrozen(raw)||raw.length!==expected.length)invalid();
 const descriptors=Object.getOwnPropertyDescriptors(raw);
 if(Reflect.ownKeys(descriptors).length!==expected.length+1||descriptors.length?.value!==expected.length)invalid();
 for(let index=0;index<expected.length;index++){
  const descriptor=descriptors[String(index)];
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')||descriptor.value!==expected[index])invalid();
 }
 return raw as readonly string[];
}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function statShape(raw:Readonly<NegativeLinuxProtectedReaderStat>):FileFact{
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!Object.isFrozen(raw)||!['FILE','DIRECTORY'].includes(raw.kind)
  ||![raw.dev,raw.ino,raw.uid,raw.mode,raw.nlink,raw.size].every(safeInteger)||![raw.mtimeMs,raw.ctimeMs].every(value=>typeof value==='number'&&Number.isFinite(value)))invalid();
 return raw;
}
function sameFile(left:FileFact,right:FileFact){
 return left.kind===right.kind&&left.dev===right.dev&&left.ino===right.ino&&left.uid===right.uid&&left.mode===right.mode&&left.nlink===right.nlink
  &&left.size===right.size&&left.mtimeMs===right.mtimeMs&&left.ctimeMs===right.ctimeMs;
}
function parentPaths(path:string){
 let cursor='';const result:string[]=[];
 for(const segment of path.split('/').filter(Boolean)){cursor+='/'+segment;result.push(cursor);}
 return result;
}

/**
 * 기존 Linux approval validator에만 보호 read reply를 공급한다. 생성은 I/O를 하지 않으며 승인·실행 권위·기한을 발급하지 않는다.
 */
export function create0076NegativeLinuxProtectedReader(rawAuthority:Readonly<NegativeLinuxProtectedReaderAuthority>,rawSystem:NegativeLinuxProtectedReaderSystem=nativeSystem()):Readonly<NegativeLinuxApprovalReadPorts>{
 if(!rawAuthority||typeof rawAuthority!=='object'||types.isProxy(rawAuthority)||!Object.isFrozen(rawAuthority)
  ||!rawSystem||typeof rawSystem!=='object'||types.isProxy(rawSystem)||!Object.isFrozen(rawSystem))invalid();
 const authority=rawAuthority,system=rawSystem,selection=authority.selection;
 if(!Object.isFrozen(selection)||types.isProxy(selection)||!recordV1(selection,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','graphHash'])
  ||selection.schemaVersion!==1||selection.purpose!==current0076NegativeLinuxApprovalContract.selectionPurpose||!uuidV1(selection.attemptId)
  ||!/^[a-f0-9]{40}$/.test(selection.sourceHead)||![selection.planHash,selection.approvalHash,selection.graphHash].every(hashV1))invalid();
 const authorityRecipient=authority.recipient,systemRecipient=system.recipient;
 if(!authorityRecipient||typeof authorityRecipient!=='object'||types.isProxy(authorityRecipient)||!Object.isFrozen(authorityRecipient)
  ||!systemRecipient||typeof systemRecipient!=='object'||types.isProxy(systemRecipient)||!Object.isFrozen(systemRecipient)
  ||authority.uid!==1000||!sourceRootPattern.test(authority.sourceRoot))invalid();
 const expectedReceipt=receiptParent+'/ix01-0076-negative-'+selection.attemptId;
 if(authority.receiptRoot!==expectedReceipt||typeof authority.now!=='function'||typeof authority.monotonic!=='function'||typeof authority.assertCurrent!=='function'
  ||typeof system.lstat!=='function'||typeof system.realpath!=='function'||typeof system.open!=='function'||typeof system.fstat!=='function'||typeof system.read!=='function'||typeof system.close!=='function')invalid();
 const requested=Object.freeze([expectedReceipt+'-plan.json',expectedReceipt+'-approval.json',expectedReceipt+'-graph.json',...current0076NegativeLinuxApprovalContract.dependencyPaths]);
 const actual=Object.freeze([requested[0]!,requested[1]!,requested[2]!,...current0076NegativeLinuxApprovalContract.dependencyPaths.map(path=>authority.sourceRoot+'/'+path)]);
 const limits=Object.freeze([32768,16384,2097152,...current0076NegativeLinuxApprovalContract.dependencyPaths.map(()=>4194304)]);
 const authorityFunctions=Object.freeze({now:authority.now,monotonic:authority.monotonic,current:authority.assertCurrent});
 const systemFunctions=Object.freeze({lstat:system.lstat,realpath:system.realpath,open:system.open,fstat:system.fstat,read:system.read,close:system.close});
 const unchanged=()=>authority.selection===selection&&authority.sourceRoot===rawAuthority.sourceRoot&&authority.receiptRoot===expectedReceipt&&authority.uid===1000
  &&authority.recipient===authorityRecipient&&authority.now===authorityFunctions.now&&authority.monotonic===authorityFunctions.monotonic&&authority.assertCurrent===authorityFunctions.current
  &&system.recipient===systemRecipient&&system.lstat===systemFunctions.lstat&&system.realpath===systemFunctions.realpath&&system.open===systemFunctions.open
  &&system.fstat===systemFunctions.fstat&&system.read===systemFunctions.read&&system.close===systemFunctions.close;
 const current=()=>{if(!unchanged()||authorityFunctions.current.call(authorityRecipient,selection)!==undefined)invalid();};
 const stat=(path:string)=>statShape(systemFunctions.lstat.call(systemRecipient,path));
 const real=(path:string)=>{const value=systemFunctions.realpath.call(systemRecipient,path);if(value!==path)invalid();};
 const pins=new Map<string,DirectoryPin>();
 const pin=(path:string,leafPolicy:false|'PRIVATE'|'RECEIPT')=>{
  for(const cursor of parentPaths(path)){
   const value=stat(cursor);
   if(value.kind!=='DIRECTORY'||![0,1000].includes(value.uid)||((value.mode&0o022)!==0&&!(cursor==='/tmp'&&value.uid===0&&(value.mode&0o7777)===0o1777))
    ||cursor===path&&leafPolicy==='PRIVATE'&&(value.uid!==1000||(value.mode&0o777)!==0o700))invalid();
   const prior=pins.get(cursor);
   if(prior&&(prior.dev!==value.dev||prior.ino!==value.ino||prior.uid!==value.uid||prior.mode!==value.mode))invalid();
   pins.set(cursor,Object.freeze({path:cursor,dev:value.dev,ino:value.ino,uid:value.uid,mode:value.mode}));
  }
  real(path);
 };
 const checkPins=()=>{for(const prior of pins.values()){const value=stat(prior.path);if(value.kind!=='DIRECTORY'||value.dev!==prior.dev||value.ino!==prior.ino||value.uid!==prior.uid||value.mode!==prior.mode)invalid();}};
 const custody=Object.freeze(Object.create(null));let used=false;
 const recipient=Object.freeze(Object.create(null));
 const ports=Object.freeze({recipient,
  now(this:object){if(this!==recipient||!unchanged())invalid();return authorityFunctions.now.call(authorityRecipient);},
  monotonic(this:object){if(this!==recipient||!unchanged())invalid();return authorityFunctions.monotonic.call(authorityRecipient);},
  assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalSelection>){if(this!==recipient||found!==selection)invalid();current();},
  async read(this:object,rawPaths:readonly string[]){
   if(this!==recipient||used)invalid();ownDataArray(rawPaths,requested);used=true;current();
   pin(authority.sourceRoot,'PRIVATE');pin(receiptParent,'RECEIPT');
   for(const path of actual.slice(3))pin(path.slice(0,path.lastIndexOf('/')),false);
   checkPins();
   const rows:Readonly<NegativeLinuxApprovalReadObservation>[]=[];
   const identities=new Set<string>();
   for(let index=0;index<actual.length;index++){
    current();checkPins();const path=actual[index]!,before=stat(path),limit=limits[index]!;
    if(before.kind!=='FILE'||before.nlink!==1||before.uid!==1000||(before.mode&0o022)!==0||before.size<1||before.size>limit
     ||index<3&&(before.mode&0o777)!==0o600)invalid();
    const identity=before.dev+':'+before.ino;if(identities.has(identity))invalid();identities.add(identity);
    real(path);const handle=systemFunctions.open.call(systemRecipient,path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    if(!handle||typeof handle!=='object'||types.isProxy(handle))invalid();
    let closeStarted=false,closed=false,buffer:Uint8Array|undefined;try{
     if(!sameFile(before,statShape(systemFunctions.fstat.call(systemRecipient,handle))))invalid();
     buffer=new Uint8Array(before.size+1);let total=0;
     while(total<buffer.byteLength){current();const count=systemFunctions.read.call(systemRecipient,handle,buffer,total,buffer.byteLength-total);
      if(!Number.isSafeInteger(count)||count<0||count>buffer.byteLength-total)invalid();if(count===0)break;total+=count;}
     if(total!==before.size||!sameFile(before,statShape(systemFunctions.fstat.call(systemRecipient,handle)))||!sameFile(before,stat(path)))invalid();
     real(path);closeStarted=true;systemFunctions.close.call(systemRecipient,handle);closed=true;
     const bytes=new Uint8Array(buffer.subarray(0,total)),fileIdentity=Object.freeze({dev:before.dev,ino:before.ino});buffer.fill(0);
     rows.push(Object.freeze({path:requested[index]!,bytes,custody,fileIdentity,closed:true as const}));
    }finally{
     buffer?.fill(0);
     if(!closeStarted&&!closed)try{closeStarted=true;systemFunctions.close.call(systemRecipient,handle);closed=true;}catch{/* close 불명은 reply 없이 원 system custody에 남긴다. */}
    }
   }
   checkPins();current();return Object.freeze(rows);
  },
 }) satisfies NegativeLinuxApprovalReadPorts;
 return ports;
}
